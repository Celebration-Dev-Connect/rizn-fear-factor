# Data Model: Contest Night Polish

**Feature**: [spec.md](./spec.md) | **Base model**: [001 data-model.md](../001-costume-contest/data-model.md)

This feature makes one migration (`drizzle/0001_contest_polish.sql`, generated with
`npm run db:generate` from `src/server/db/schema.ts`). Everything not listed here is unchanged from
001. No new table is added, and none of the new data comes from students.

## Changes

### `vote_status` enum: add `replaced`

```sql
ALTER TYPE vote_status ADD VALUE 'replaced';
```

| Status | Counts? | Uses up the pass? | Set by |
|---|---|---|---|
| `counted` | yes | yes | a vote, a change (new row), or a crew restore |
| `voided` | no | yes | a crew void |
| `released` | no | no | removing the entry (001 FR-018) |
| **`replaced`** | **no** | **no** | **a vote change (FR-101); the old row** |

- The partial unique index `votes_one_per_pass` (`WHERE status IN ('counted','voided')`) is
  **unchanged**. A `replaced` row falls outside it, so the new `counted` row can be inserted in the
  same transaction, and the database still allows only one live vote per pass.
- On a `replaced` row, `status_changed_at` is the time of the change.
  `status_changed_by_crew_session_id` is set when the change was crew-assisted (FR-106), and is
  `NULL` when the student made it.
- The new row's `assisted_by_crew_session_id` is set when a crew device made the change, so the log
  marks it crew-assisted.
- A vote's state moves along these paths:
  - `counted → replaced` (change)
  - `counted → voided → counted` (void and restore)
  - `counted → released` (entry removed)
  - `replaced` is final: it is never restored.

### `entries.costume_title` (new, nullable)

```sql
ALTER TABLE entries ADD COLUMN costume_title text;
ALTER TABLE entries ADD CONSTRAINT entries_costume_title_len
  CHECK (costume_title IS NULL OR char_length(costume_title) BETWEEN 1 AND 40);
```

- It's set only by crew (FR-107). The server normalizes it: it trims the value, collapses inner
  whitespace, rejects control characters, and stores `''` as `NULL`.
- It's removed with the entry and its photo. The rehearsal wipe deletes rehearsal entries (001
  FR-038). Post-event deletion drops all entries under the existing procedure (001 FR-040), so no
  change to the deletion procedure is needed.

### `contest.voting_closes_at` (new, nullable)

```sql
ALTER TABLE contest ADD COLUMN voting_closes_at timestamptz;
```

- There is one per realm, because `contest` is keyed by realm. A rehearsal close time never affects
  live.
- It's display-only (FR-114). The state machine (`contest-machine.ts`) does not read it.
- Setting it bumps `contest.version`, so pollers see the change through the ETag on `/api/state`.
- The rehearsal wipe sets it to `NULL`, alongside resetting the stage.

## Derived values (not stored)

| Value | Derived from | Notes |
|---|---|---|
| Entry label | linked nicknames (`displayNames`) + `costume_title` | Rendered as "{nicknames} *as* {TITLE}"; nicknames alone when the title is `NULL` (FR-108). |
| Photo alt text | same | "Costume photo: {nicknames} as {title}", or "Costume photo of {nicknames}" (FR-109). |
| Pass scan code | `realm`, `passes.number`, HMAC of `passes.id` | `NP1.{L\|R}.{number}.{mac12}`; see [research §4](./research.md#4-pass-qr-code). It's never stored, and doesn't change for the pass's lifetime. |
| Contestant's place | the revealed results (`/api/results` logic) + `entry_passes` | Only once `revealStep` has reached that place (FR-122). |

## Audit events (new actions)

| `action` | Actor | `details` |
|---|---|---|
| `vote.change` | pass, or crew if assisted | `{ fromVoteId, toVoteId, passId, fromEntryId, toEntryId, assisted }` |
| `entry.update` (extended) | crew | adds `costumeTitle: { from, to }` when it changed |
| `entry.create` (extended) | crew | adds `costumeTitle` |
| `voting_close.set` | crew | `{ from: iso \| null, to: iso \| null }` |

No audit entry is written for a crew scan. It only selects a pass, and the entry save that follows
is already audited.

## Validation summary

| Field | Rule | Requirement |
|---|---|---|
| `costumeTitle` | optional; after normalizing, 1–40 characters, one line, no control characters | FR-107 |
| `votingClosesAt` | ISO 8601 with offset, or `null`; may be in the past (the screen then shows "closes any moment") | FR-111, FR-114 |
| Vote change `entryId` | uuid; entry exists, isn't removed, and isn't linked to the pass | FR-103 |
| Scan `code` | matches `^NP1\.[LR]\.\d{1,6}\.[A-Z2-7]{12}$`; realm letter matches the active realm; MAC verifies | FR-124, FR-126 |
