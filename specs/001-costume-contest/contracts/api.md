# HTTP API Contract: Costume Contest

**Feature**: [spec.md](../spec.md) | **Data model**: [data-model.md](../data-model.md)

The API lives under `/api` on the same origin as the pages (one Express process, see
[research §1](../research.md#1-process-layout-one-express-server-that-mounts-nextjs)). It uses
JSON unless noted. All responses send `Cache-Control: no-store` except photos.

## Conventions

- **Auth cookies**: `np_live` or `np_rehearsal` for a pass, `crew` for a crew session, and
  `screen` for the big screen. Endpoints list the cookie they require.
- **Idempotency**: every `POST`, `PATCH`, and `DELETE` from a pass or crew session MUST send an
  `Idempotency-Key: <uuid>` header. A repeated key replays the first response with
  `Idempotent-Replay: true`. A missing key returns `400`.
- **Event window**: in the live realm, every endpoint that accepts a pass cookie returns
  `403 outside_window` unless the event window is open. This includes photos, entries, votes,
  `/api/me`, and results. Crew and screen cookies are not affected, and rehearsal passes are
  exempt (spec FR-006, FR-036).
- **Errors**: the body is `{ "error": "<code>", "message": "<human text>", "state"?: PublicState }`.

| Code | HTTP | When |
|---|---|---|
| `outside_window` | 403 | live-realm pass issued or used before the start or after the end of the event window |
| `no_pass` | 401 | pass cookie missing or unknown |
| `not_crew` | 401 | crew cookie missing or expired |
| `voting_not_open` | 409 | vote while the stage is not `voting_open` |
| `already_voted` | 409 | the pass already has a counted or voided vote |
| `self_vote` | 409 | the entry is linked to the voting pass |
| `stage_conflict` | 409 | the `from` value does not match the current stage and step; includes the current state |
| `pass_already_entered` | 409 | the pass is linked to another entry |
| `consent_required` | 422 | entry saved without consent |
| `no_votes` | 409 | reveal attempted with no counted votes |
| `rehearsal_locked` | 409 | rehearsal turned on after the live contest left setup |
| `too_many_attempts` | 429 | crew passcode rate limit; includes `Retry-After` |
| `photos_deleted` | 410 | photo requested after `PHOTO_DELETE_AT` |

## Shared types

```ts
type Stage = "setup" | "voting_open" | "voting_closed" | "results_revealed";
type EventStatus = "before" | "open" | "ended";

type PublicState = {
  version: number;
  stage: Stage;
  revealStep: 0 | 1 | 2 | 3;
  rehearsal: boolean;
  event: { status: EventStatus; start: string; end: string }; // ISO-8601
  entriesVersion: number;   // changes when entries are added, edited, or removed
};

type Pass = { number: number; nickname: string; origin: "self" | "crew" };

type EntryCard = {
  id: string;
  displayName: string;      // linked passes' nicknames joined with " & "
  photo: { thumb: string; full: string }; // /api/photos/... URLs
  alt: string;              // "Costume photo of <displayName>"
};

type RevealedPlace = { place: 1 | 2 | 3; tied: boolean; entries: EntryCard[] };
```

## Student (pass) endpoints

| Method & path | Auth | Request | Response |
|---|---|---|---|
| `GET /api/state` | none | `If-None-Match` | `200 PublicState` with an `ETag`, or `304` |
| `POST /api/pass` | none | n/a | `200 { pass: Pass }`. Returns the existing pass for this realm's cookie, or issues a new one and sets the cookie. `403 outside_window` |
| `GET /api/me` | pass | n/a | `200 { pass: Pass, ownEntryId: string \| null, vote: { entryId: string } \| null }` |
| `GET /api/entries` | pass, crew, or screen | `If-None-Match` | `200 { entriesVersion, entries: EntryCard[] }` or `304` |
| `POST /api/votes` | pass | `{ entryId }` | `201 { vote: { entryId } }`. Errors: `voting_not_open`, `already_voted`, `self_vote` |
| `GET /api/results` | pass or screen | n/a | `200 { places: RevealedPlace[] }`. Only places revealed so far, lowest existing place first. Empty before `results_revealed`. Never counts |
| `GET /api/photos/:photoId/:size` | pass, crew, or screen | `size ∈ {thumb, full}` | `200 image/webp` with `Cache-Control: private, max-age=86400, immutable`. `404` if unknown or in the other realm. `410 photos_deleted` |
| `GET /api/qr.svg` | none | n/a | SVG QR code for `PUBLIC_URL` |

## Crew endpoints

All require the `crew` cookie except session creation.

| Method & path | Request | Response / notes |
|---|---|---|
| `POST /api/crew/session` | `{ passcode, deviceLabel }` | `204` and sets the `crew` cookie. `401`, or `429 too_many_attempts` |
| `DELETE /api/crew/session` | n/a | `204` |
| `GET /api/crew/dashboard` | n/a | `{ state: PublicState, totals: { passes, votesCounted }, screenUrl }`. Never per-entry counts (FR-026) |
| `GET /api/crew/passes?q=` | `q` = nickname fragment or number | `{ passes: (Pass & { id, entryId: string \| null })[] }` (max 20) |
| `POST /api/crew/passes` | n/a | `201 { pass: Pass & { id } }`. A crew-created pass with no cookie (FR-016) |
| `POST /api/crew/entries` | `multipart/form-data`: `photo` (≤3 MB image), `passIds[]` (≥1), `consent=true` | `201 { entry: EntryCard }`. Errors: `consent_required`, `pass_already_entered`. During `voting_open` the response includes `warning: "added_during_voting"` (FR-024) |
| `PATCH /api/crew/entries/:id` | multipart; optional `photo`, optional `passIds[]` | `200 { entry }` |
| `DELETE /api/crew/entries/:id` | n/a | `200 { releasedVotes: number }`. Deletes the photo files and releases the entry's votes (FR-018/019) |
| `POST /api/crew/stage` | `{ action: "advance" \| "undo", from: { stage, revealStep } }` | `200 PublicState`. Errors: `stage_conflict`, `no_votes` |
| `POST /api/crew/assisted-votes` | `{ passId, entryId }` | `201`. Same rules as `/api/votes`; the vote is marked as crew-assisted (FR-020) |
| `GET /api/crew/votes?sort=cast_at\|pass_created_at&order=asc\|desc&status=` | n/a | `{ votes: { id, castAt, status, assisted, pass: { number, nickname, createdAt, origin }, entry: { id, displayName } }[] }` |
| `POST /api/crew/votes/:id/void` / `…/restore` | n/a | `200 { vote }` (FR-028) |
| `GET /api/crew/ranking` | n/a | Available only in `voting_closed` and `results_revealed`. `{ places: (RevealedPlace & { votes: number })[], unplaced: { entry, votes }[] }` |
| `GET /api/crew/audit?limit=&before=` | n/a | `{ events: AuditEvent[] }` |
| `PUT /api/crew/settings/window` | `{ start, end }` (ISO) | `200`; `end` must be after `start` |
| `POST /api/crew/rehearsal` | `{ on: boolean }` | `200 PublicState`. Error `rehearsal_locked` |
| `POST /api/crew/rehearsal/wipe` | `{ confirm: "WIPE" }` | `200 { deleted: { passes, entries, votes, photos } }`. Touches the rehearsal realm only (FR-038) |

## Big screen

| Method & path | Notes |
|---|---|
| `GET /screen?t=<SCREEN_TOKEN>` | Page route. Sets the `screen` cookie and redirects to `/screen`. Without a valid cookie the page shows "Ask a crew member for the screen link" |

The screen uses `GET /api/state`, `/api/entries`, `/api/results`, and a screen-only
`GET /api/screen/totals` (`{ passes, votesCounted }`).

## Page routes (Next.js)

| Path | Who | Purpose |
|---|---|---|
| `/` | student | Night Pass (issues the pass on first load), or the "doors open at" / "event ended" screens |
| `/contest` | student | gallery, voting, thank-you state, and results |
| `/crew` | crew | passcode sign-in, then dashboard (stages, totals, rehearsal) |
| `/crew/entries` | crew | find pass, take photo, confirm consent, save; list, edit, remove |
| `/crew/votes` | crew | vote log with sorting, void, and restore |
| `/crew/assist` | crew | assisted voting |
| `/crew/results` | crew | private ranking and reveal controls |
| `/screen` | big screen | rotating gallery, QR code, totals, and reveal |
| `/healthz` | ops | `200 ok` when the database is reachable (served by Express) |
