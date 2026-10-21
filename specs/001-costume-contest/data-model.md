# Data Model: Costume Contest

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

All tables except `settings` carry `realm` (`live` | `rehearsal`). Requests act only on the
active realm (see [research §8](./research.md#8-rehearsal-isolation-a-realm-column)). No table
holds a student name, contact detail, or free text typed by anyone (FR-001, FR-016).

## settings (singleton)

| Field | Type | Notes |
|---|---|---|
| id | smallint PK | always `1` |
| rehearsal_mode | boolean | default `false` |
| event_start | timestamptz | from `EVENT_START` env on first boot; editable by crew |
| event_end | timestamptz | from `EVENT_END` env on first boot; editable by crew; must be after `event_start` |
| updated_at | timestamptz | |

## passes

The Night Pass is a first-class entity (FR-005). Future features reference `passes.id` and
never change this table's meaning.

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| realm | enum | |
| token_hash | bytea | SHA-256 of the cookie token; unique. `null` for crew-created passes, which have no cookie |
| nickname | text | from the curated list; **unique per realm** (FR-002) |
| number | integer | per-realm sequence, shown as `#0042`; unique per realm |
| origin | enum | `self` (student phone) or `crew` (crew-created, FR-016/FR-020) |
| created_at | timestamptz | shown and sortable in the vote log (FR-028) |
| created_by_crew_session_id | uuid FK → crew_sessions, nullable | set when `origin = crew` |

Validation: nicknames are generated, never supplied by a client. If the nickname space runs out,
new passes are refused and the dashboard shows an alert. Self-issued passes are refused outside
the event window unless rehearsal mode is on (FR-006, FR-036).

## entries

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| realm | enum | |
| photo_id | uuid | names the files `<photo_id>-1200.webp` and `-480.webp` on the photo volume; changed when the photo is replaced |
| consent_confirmed_at | timestamptz | required, not null (FR-015) |
| created_at / updated_at | timestamptz | |
| removed_at | timestamptz, nullable | soft-remove marker kept for the audit log; photo files are deleted at removal (FR-018) |

The display name is derived from the nicknames of the linked passes, joined with " & ". It is
not stored.

## entry_passes

| Field | Type | Notes |
|---|---|---|
| entry_id | uuid FK → entries | |
| pass_id | uuid FK → passes | **unique**: a pass belongs to at most one active entry (edge case "pass already linked") |

Each entry must have at least one row (enforced in the service transaction). Removing an entry
deletes its `entry_passes` rows and sets its votes to `released` in the same transaction.

## votes

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| realm | enum | |
| pass_id | uuid FK → passes | |
| entry_id | uuid FK → entries | |
| status | enum | `counted` → `voided` (crew) ↔ `counted` (restore); `counted`/`voided` → `released` (entry removed) |
| assisted_by_crew_session_id | uuid FK, nullable | set for crew-assisted votes (FR-020) |
| cast_at | timestamptz | |
| status_changed_at | timestamptz | |
| status_changed_by_crew_session_id | uuid FK, nullable | |

Constraints:

- **Partial unique index** `(pass_id) WHERE status IN ('counted','voided')`. This enforces one
  vote per pass (FR-009). A voided vote still uses up the pass's vote; only `released` frees it
  (FR-019).
- Insert rules, checked in the same transaction as the insert:
  - the contest stage is `voting_open` (FR-008);
  - the entry is not removed;
  - the pass is not in `entry_passes` for that entry (FR-010).

## contest

One row per realm.

| Field | Type | Notes |
|---|---|---|
| realm | enum PK | |
| stage | enum | `setup` · `voting_open` · `voting_closed` · `results_revealed` |
| reveal_step | smallint | 0–P, where P is the number of places that exist (1–3, from the ranking). It counts how many places have been revealed, lowest place first. Only non-zero in `results_revealed` |
| version | integer | incremented on every change; used for ETags and the in-memory cache |
| updated_at | timestamptz | |

### Stage transitions (FR-021–FR-023, FR-031)

```text
setup ──open──▶ voting_open ──close──▶ voting_closed ──reveal──▶ results_revealed
  ▲                │   ▲                  │   ▲                     (reveal_step 1→…→P)
  └──────undo──────┘   └──────undo────────┘   └────undo (step P→…→1→0, then stage back)
```

- Every transition is a crew request that includes `from` (the expected current stage and
  step). A mismatch returns 409. No timer or background job ever writes this table (Principle VI).
- Entering `results_revealed` is refused if no entry has a counted vote.
- Reveal steps only cover places that exist. With P places, `advance` at step P is refused.
  The first reveal shows the lowest existing place (3rd if it exists, otherwise 2nd, otherwise
  1st). P is computed from the ranking when `advance` is called, and ranking can't change in
  `results_revealed` because voting is closed.
- Undo keeps all entries and votes.
- Undo inside `results_revealed` hides one place at a time. Undo at step 0 returns to
  `voting_closed`.

## crew_sessions

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| device_label | text | chosen from a fixed list ("Crew phone 1"…"Crew phone 12", "Tablet A/B") so no free text is typed |
| created_at / last_seen_at | timestamptz | |

Sessions are shared across realms.

## audit_events

| Field | Type | Notes |
|---|---|---|
| id | bigserial PK | |
| realm | enum | |
| at | timestamptz | |
| actor_type | enum | `pass` · `crew` · `system` (purge only) |
| actor_id | uuid | the pass id or crew session id |
| action | text | e.g. `vote.cast`, `vote.void`, `vote.restore`, `entry.create`, `entry.update`, `entry.remove`, `stage.change`, `reveal.step`, `rehearsal.on/off`, `rehearsal.wipe`, `settings.window` |
| details | jsonb | ids and before/after values only; never photo bytes or personal data |

Append-only (FR-027).

## idempotency_keys

| Field | Type | Notes |
|---|---|---|
| key | uuid PK | |
| scope | text | the session or pass id that sent it |
| response_status / response_body | int / jsonb | replayed on retry |
| created_at | timestamptz | rows are deleted after 24 h |

## Derived: ranking (FR-029–FR-032)

Count `counted` votes per non-removed entry and drop entries with zero votes. Rank by **dense
ranking** on the count: the highest total is place 1, then 2, then 3. Entries below place 3 are
shown to crew only. Any place held by more than one entry is marked `tied`. Before
`results_revealed`, ranking is only available to crew while the stage is `voting_closed`. Public
results include `place`, `tied`, `entryId`, `displayName` and photo id, and never counts.
