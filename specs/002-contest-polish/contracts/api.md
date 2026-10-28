# HTTP API Contract Changes: Contest Night Polish

**Feature**: [spec.md](../spec.md) | **Data model**: [data-model.md](../data-model.md) |
**Base contract**: [001 contracts/api.md](../../001-costume-contest/contracts/api.md)

This lists only what changes. The 001 conventions still apply:
- idempotency keys on every mutation;
- the event window for live passes;
- the error body shape;
- `Cache-Control: no-store` on everything except photos.

## New error codes

| Code | HTTP | When |
|---|---|---|
| `vote_voided` | 409 | a change was attempted on a vote that crew voided (FR-103) |
| `bad_scan_code` | 400 | the scanned text isn't a Night Pass code, or its MAC doesn't verify |
| `wrong_realm` | 409 | the scanned code is from rehearsal while live is active, or the other way round |

These are added to `ERROR_CODES` in `src/shared/types.ts`.

## Shared types (changed)

```ts
type PublicState = {
  // …all 001 fields…
  votingClosesAt: string | null;   // NEW. ISO-8601. Display only; never changes the stage (FR-114)
};

type EntryCard = {
  id: string;
  displayName: string;             // unchanged: nicknames joined with " & "
  costumeTitle: string | null;     // NEW (FR-108)
  photo: { thumb: string; full: string };
  alt: string;                     // CHANGED: "Costume photo: <displayName> as <costumeTitle>"
                                   //          or "Costume photo of <displayName>" when no title
};

type Me = {
  pass: Pass;
  ownEntryId: string | null;
  ownEntry: EntryCard | null;      // NEW: the "Your costume" card (FR-121)
  ownPlace: { place: 1 | 2 | 3; tied: boolean } | null; // NEW: only once revealed (FR-122)
  vote: { entryId: string } | null; // still the counted or voided vote only; never a replaced one
  voteChangeable: boolean;         // NEW: true only while voting_open, with a counted vote (FR-105)
};
```

**Server clock**: every `/api/state` response, `200` or `304`, carries the standard HTTP `Date`
header. The big screen derives the server time from it (FR-113). The response body has no time
field, so ETags stay stable.

## Student (pass) endpoints

| Method & path | Auth | Request | Response |
|---|---|---|---|
| `PUT /api/votes/mine` **(new)** | pass | `{ entryId }` | `200 { vote: { entryId }, changed: boolean }`.<br>• With no counted vote, it acts exactly like `POST /api/votes`.<br>• When `entryId` equals the current choice, it returns `changed: false` and writes nothing.<br>Errors: `voting_not_open`, `self_vote`, `vote_voided`, `not_found`. |
| `POST /api/votes` | pass | unchanged | Unchanged. A second `POST` still returns `409 already_voted`, so a double-tap on the first vote can never become a change. |
| `GET /api/me` | pass | unchanged | Adds `ownEntry`, `ownPlace`, and `voteChangeable` (see above). The pass page refetches it when `state.version` or `state.entriesVersion` changes, so it needs no new poll. |
| `GET /api/pass/code.svg` **(new)** | pass | n/a | `200 image/svg+xml` with `Cache-Control: private, no-store`. A QR code of the pass scan code `NP1.{L\|R}.{number}.{mac}`: dark `#0A0E1A` on white, 4-module quiet zone, error correction M. `401 no_pass`, `403 outside_window`. |

## Crew endpoints

| Method & path | Request | Response / notes |
|---|---|---|
| `POST /api/crew/entries` | adds an optional multipart field `costumeTitle` (string) | Validated per [data-model](../data-model.md#validation-summary). Errors: `invalid_request` (too long or a control character). |
| `PATCH /api/crew/entries/:id` | adds an optional `costumeTitle`; an empty string clears it | `200 { entry }`. The change is audited in `entry.update`. |
| `PUT /api/crew/assisted-votes/:passId` **(new)** | `{ entryId }` | Same rules and response as `PUT /api/votes/mine`, for a crew-created pass. The new row is marked crew-assisted, and the old row's `status_changed_by_crew_session_id` is set (FR-106). |
| `GET /api/crew/passes/scan?code=` **(new)** | `code` = the decoded QR text | `200 { pass: Pass & { id, entryId: string \| null } }`, the same shape as one search hit, so the picker reuses it.<br>Errors: `bad_scan_code`, `wrong_realm`, `not_found`.<br>Read-only and not audited. |
| `PUT /api/crew/voting-close` **(new)** | `{ at: string \| null }` (ISO with offset) | `200 PublicState`. Audited as `voting_close.set`. Allowed in every stage. |
| `GET /api/crew/votes` | `status` filter adds `replaced` | Rows gain `entry.costumeTitle`. Replaced rows show `status: "replaced"` and `statusChangedAt`. |
| `GET /api/crew/dashboard` | n/a | `state.votingClosesAt` is included through `PublicState`. |
| `POST /api/crew/rehearsal/wipe` | unchanged | It also clears the rehearsal `voting_closes_at`. |

`replaced` votes never appear in the totals (`votesCounted`), the ranking, or the results.

## Big screen

No new endpoint. `/screen` reads `votingClosesAt` from `/api/state` and the `Date` header from the
same responses.

## Pages

| Path | Change |
|---|---|
| `/` | The pass is a flip button (front: nickname and number; back: QR code from `/api/pass/code.svg`). It shows the "Your costume" card under the pass when `ownEntry` is set. New logo and stickers. |
| `/contest` | Cards show "{nicknames} *as* TITLE". The thank-you state offers "Change my vote" while `voteChangeable` is true, and the confirm dialog shows the current and the new choice. |
| `/crew` | Dashboard: a "Voting closes at" time input with Save and Clear. |
| `/crew/entries` | A "Costume (no real names)" text field (max 40) on add and edit, and a "Scan pass" button in the pass picker. |
| `/crew/assist` | "Scan pass" in the picker. An existing assisted vote can be changed while voting is open. |
| `/crew/votes` | A `replaced` filter and badge, and costume titles. |
| `/screen` | Countdown block while voting is open and `votingClosesAt` is set, the brand banner, and labels with costume titles. |

## Static assets (new)

| Path | Notes |
|---|---|
| `/brand/*.webp` | Logos and stickers from `scripts/brand-assets.ts`; `Cache-Control: public, max-age=86400`. |
| `/_next/static/media/*.woff2` | The display font, self-hosted by `next/font`. |
