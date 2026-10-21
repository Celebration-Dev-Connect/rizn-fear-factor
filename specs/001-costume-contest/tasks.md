---

description: "Task list for the RIZN Fear Factor costume contest"
---

# Tasks: Costume Contest

**Input**: Design documents from `/specs/001-costume-contest/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[quickstart.md](./quickstart.md)

**Tests**: Included only where Constitution Principle VII requires them:
- vote enforcement
- the contest state machine
- photo handling
- the rehearsal wipe
- the load check behind SC-005

Other areas are verified with the manual rehearsal in quickstart.md.

**Organization**: Tasks are grouped by user story (US1–US9 from spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US9)
- Paths are relative to the repository root. This is a single package: `src/server` is the
  Express code and `src/app` is Next.js (see plan.md, Project Structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A runnable, empty TypeScript project with Express mounting Next.js, plus a database
and tooling.

- [ ] T001 Create `package.json` (Node 24 `engines`, `"type": "module"`) and install dependencies:
  - runtime: next@16, react@19, react-dom@19, express@5, drizzle-orm, pg, zod, multer, sharp,
    qrcode, cookie-parser, cookie-signature
  - dev: typescript, tsx, drizzle-kit, vitest, supertest, @playwright/test, @axe-core/playwright,
    autocannon, eslint, eslint-config-next, prettier, and @types/* for express, multer, pg,
    qrcode, cookie-parser, supertest
- [ ] T002 Add `tsconfig.json` (strict, path alias `@/*` → `src/*`) and `next.config.ts`
  (`poweredByHeader: false`, no image remote patterns, no telemetry). Create `.npmrc` with
  `engine-strict=true`
- [ ] T003 [P] Configure ESLint and Prettier in `eslint.config.mjs` and `.prettierrc`. Add
  scripts to `package.json`: `dev`, `build`, `start`, `typecheck`, `lint`, `test`,
  `test:integration`, `test:e2e`, `test:load`, `db:generate`, `db:migrate`, `purge`, `seed:dev`
- [ ] T004 [P] Create `.env.example` listing, without values:
  - `DATABASE_URL`, `CREW_PASSCODE`, `SESSION_SECRET`, `SCREEN_TOKEN`, `PUBLIC_URL`
  - `EVENT_START`, `EVENT_END`, `PHOTO_DELETE_AT`, `PHOTO_DIR`, `DOMAIN`
  Add `.env`, `.next/`, `node_modules/`, `photos/`, `test-results/`, and `playwright-report/`
  to `.gitignore`
- [ ] T005 [P] Create `compose.dev.yml` (postgres:17-alpine on 5432 with a named volume) and
  `compose.test.yml` (postgres:17-alpine on 55432, tmpfs storage)
- [ ] T006 [P] Create `vitest.config.ts` with two projects: `unit` (`tests/unit/**`) and
  `integration` (`tests/integration/**`, single thread, global setup that migrates
  `compose.test.yml`'s database). Create `playwright.config.ts` with `iPhone 15` (webkit) and
  `Pixel 7` (chromium) projects against `http://localhost:3000`
- [ ] T007 Create `src/server/index.ts`:
  - boot Express
  - `app.disable('x-powered-by')`, `trust proxy` set to 1
  - JSON body limit 16 KB
  - mount `/api` router and `/healthz`
  - hand every other request to `next({ dev, dir: '.' }).getRequestHandler()`
  - listen on `PORT` (default 3000)
  Wire `npm run dev` (tsx watch) and `npm start` (compiled output) to it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, schema, auth, idempotency, public state, and the design system. Every story
depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T008 Implement `src/server/config.ts`:
  - parse env with zod
  - `SESSION_SECRET` at least 32 chars
  - `EVENT_START`/`EVENT_END`/`PHOTO_DELETE_AT` are ISO-8601 with offset, and `EVENT_END` is
    after `EVENT_START`
  - `PUBLIC_URL` is a URL
  - fail fast with a clear message listing missing variables
- [ ] T009 Define the Drizzle schema in `src/server/db/schema.ts` exactly per data-model.md:
  - enums `realm` (`live`|`rehearsal`), `stage`
    (`setup`|`voting_open`|`voting_closed`|`results_revealed`), `pass_origin` (`self`|`crew`),
    `vote_status` (`counted`|`voided`|`released`), and `actor_type` (`pass`|`crew`|`system`)
  - tables `settings`, `passes`, `entries`, `entry_passes`, `votes`, `contest`, `crew_sessions`,
    `audit_events`, `idempotency_keys`
  - constraints:
    - `passes` unique `(realm, nickname)`, unique `(realm, number)`, unique `token_hash`
    - `entry_passes.pass_id` unique
    - `entries.consent_confirmed_at` not null
    - votes partial unique index `(pass_id) WHERE status IN ('counted','voided')`
    - `contest.reveal_step` check 0–3
- [ ] T010 Create `src/server/db/client.ts` (pg Pool with max 10, Drizzle instance, and a
  `withTx` helper). Generate the first migration into `drizzle/` with `npm run db:generate`.
  Add `src/server/db/migrate.ts`, which runs migrations, upserts `settings` id 1 from env, and
  inserts `contest` rows for `live` and `rehearsal` at `setup`, step 0, version 0
- [ ] T011 [P] Implement `src/server/services/realm.ts`: `getSettings()`, `activeRealm()`
  (`rehearsal` when `settings.rehearsal_mode`), and `eventStatus(now, settings)` →
  `before`|`open`|`ended`. Rehearsal always returns `open` (FR-006, FR-036)
- [ ] T012 [P] Implement `src/server/services/audit.ts`:
  `record(tx, { realm, actorType, actorId, action, details })`, append-only. `details` carries
  ids and before/after values only
- [ ] T013 [P] Implement `src/server/middleware/errors.ts`: an `AppError(code, status, message,
  state?)` class and an Express error handler that emits `{ error, message, state? }` with the
  codes in contracts/api.md, plus `Cache-Control: no-store` on all `/api` responses
- [ ] T014 Implement `src/server/middleware/auth.ts`:
  - `loadPass` reads `np_live` or `np_rehearsal` for the active realm, hashes it with SHA-256,
    and attaches the pass
  - `requirePass`; `requireCrew` (signed `crew` cookie, 12 h, maps to a `crew_sessions` row and
    updates `last_seen_at`)
  - `requireScreen` (signed `screen` cookie)
  - `requireAny(['pass','crew','screen'])`
  - cookie options `HttpOnly; Secure; SameSite=Lax; Path=/`, with `Secure` off only when
    `NODE_ENV=development`
- [ ] T015 Implement `src/server/middleware/idempotency.ts`:
  - require an `Idempotency-Key` uuid on POST/PATCH/DELETE (else `400`)
  - look up `(key, scope)`, where scope is the pass id or crew session id
  - replay the stored status and body with `Idempotent-Replay: true`
  - store the response on first completion
  - delete rows older than 24 h on startup and hourly
- [ ] T016 Implement `src/server/services/contest-state.ts`:
  - `getPublicState(realm)` builds `PublicState` (contracts/api.md, Shared types) from
    `contest` + `settings` + `entriesVersion`
  - in-memory cache keyed by realm, with `invalidate(realm)` called after every write
  - an `etag(state)` helper
  - no timers modify state
- [ ] T017 Implement `GET /api/state` in `src/server/routes/state.ts`: ETag/`If-None-Match` →
  `304`, and mount it in `src/server/routes/index.ts`. Implement `GET /healthz`
  (`SELECT 1` → `200 ok`)
- [ ] T018 [P] Create shared types and zod schemas in `src/shared/types.ts` and
  `src/shared/schemas.ts`: `Stage`, `EventStatus`, `PublicState`, `Pass`, `EntryCard`,
  `RevealedPlace`, and error codes, matching contracts/api.md
- [ ] T019 [P] Create `src/lib/api.ts`, a fetch wrapper that:
  - adds `Idempotency-Key: crypto.randomUUID()` per action and reuses it on retry
  - retries network errors up to 3 times with backoff
  - parses `{ error }` bodies into typed errors
- [ ] T020 [P] Create `src/lib/usePoll.ts`, a React hook that:
  - polls a URL at an interval with ±1 s jitter
  - sends `If-None-Match`
  - backs off to at most 20 s on errors and resets on success
  - pauses while `document.hidden`
  - defaults: students 4 s, crew and screen 2 s (research §3)
- [ ] T021 [P] Create design tokens and globals in `src/styles/tokens.css` and
  `src/styles/globals.css`:
  - `--bg #1a0b2e`, `--accent #ff7a1a`, and text colors at WCAG AA contrast or better against
    `--bg`
  - `--tap 44px` minimum on buttons and links
  - focus rings
  - a `@media (prefers-reduced-motion: reduce)` block that disables animations
- [ ] T022 [P] Create `src/app/layout.tsx`:
  - `next/font/google` Creepster (headings) and Nunito (body), self-hosted at build
  - `lang="en"`
  - viewport meta
  - imports globals
  - a `<RehearsalBanner>` slot
  - no third-party scripts
- [ ] T023 [P] Create `src/components/RehearsalBanner.tsx`: when `state.rehearsal` is true it
  shows a fixed, high-contrast "REHEARSAL" banner with text and an icon (not color alone), on
  every page (FR-037)
- [ ] T024 [P] Create `src/server/nicknames.ts` with curated `ADJECTIVES` and `NOUNS` arrays of
  at least 40 each, kid-safe and spooky, giving at least 1,600 combinations. Add
  `scripts/check-nicknames.ts`, which prints every combination for staff review
- [ ] T025 Create `scripts/seed-dev.ts` for the rehearsal realm, so stories can be tested
  independently: 5 passes, 3 entries with generated placeholder WebP photos written to
  `PHOTO_DIR`, and an option to set the stage. Runs only when `NODE_ENV !== 'production'`

**Checkpoint**: The app boots, `GET /api/state` returns the live state, and migrations run.

---

## Phase 3: User Story 1 - Student gets a Night Pass (Priority: P1) 🎯 MVP

**Goal**: Scanning the QR code shows a Night Pass (unique spooky nickname and number) with no
input, and the same pass comes back on reopen.

**Independent Test**: Open `/` on a fresh phone and a pass appears. Close and reopen, and the
same nickname and number are shown. Outside the event window, the "doors open" or "event ended"
screen appears instead.

### Tests for User Story 1

- [ ] T026 [P] [US1] Unit tests in `tests/unit/nicknames.test.ts`:
  - generated nicknames are unique per realm
  - exhaustion returns a `nickname_exhausted` error instead of reusing a nickname
  - rehearsal and live spaces are independent
- [ ] T027 [P] [US1] Integration tests in `tests/integration/pass.test.ts`:
  - first `POST /api/pass` sets a cookie and returns a pass
  - a repeat with the cookie returns the same pass and creates no row
  - live realm before `event_start` and after `event_end` returns `403 outside_window`
  - rehearsal mode issues passes outside the window
  - the DB stores only `token_hash`, never the raw token

### Implementation for User Story 1

- [ ] T028 [US1] Implement `src/server/services/passes.ts`:
  - `issuePass(realm, origin, crewSessionId?)` picks a random unused adjective-noun pair,
    retries on unique violation, and refuses with `nickname_exhausted` after the space is full.
    `number` is next in the per-realm sequence
  - `findByToken`
  - `searchPasses(realm, q)`
  - the cookie token is `crypto.randomBytes(32)` base64url, stored as a SHA-256 `token_hash`
- [ ] T029 [US1] Implement `POST /api/pass` and `GET /api/me` in `src/server/routes/pass.ts`:
  - `POST /api/pass` returns the existing pass or issues one and sets `np_<realm>`
  - live realm outside the window → `403 outside_window`
  - `GET /api/me` returns `{ pass, ownEntryId, vote }`
- [ ] T030 [P] [US1] Create `src/components/PassBadge.tsx`: a conference-badge layout with
  "NIGHT PASS", the RIZN Fear Factor heading in Creepster, the nickname large, and the number as
  `#0042`. It has no inputs
- [ ] T031 [US1] Create the Night Pass page `src/app/page.tsx`:
  - on load it calls `POST /api/pass`, then renders `PassBadge` and a 44 px+ "Costume Contest"
    button to `/contest`
  - `event.status === 'before'` → "Doors open at 7:00 PM" style screen using `event.start`
    formatted in America/Edmonton
  - `ended` → "Fear Factor has ended. Thanks for coming!" with no photos
- [ ] T032 [P] [US1] Create the QR endpoint `GET /api/qr.svg` in `src/server/routes/qr.ts`
  (`qrcode` SVG of `PUBLIC_URL`, `Cache-Control: public, max-age=3600`)

**Checkpoint**: Students can get and keep a pass. Run T026–T027.

---

## Phase 4: User Story 2 - Student votes for one costume (Priority: P1)

**Goal**: A pass holder browses the gallery and casts exactly one vote while voting is open. The
vote is final, self-votes are blocked, and no counts are shown.

**Independent Test**: Run `npm run seed:dev` with the stage at `voting_open`. Vote from a pass,
then reload, go back, and resend. Exactly one vote is recorded and the thank-you screen persists.

### Tests for User Story 2 (required by Constitution VII)

- [ ] T033 [P] [US2] Integration tests in `tests/integration/votes.test.ts`:
  - one vote per pass, including 10 concurrent `POST /api/votes` with different idempotency
    keys → exactly 1 row with `status='counted'` and the rest `409 already_voted`
  - a replay with the same key returns the original `201` with `Idempotent-Replay: true`
  - self-vote → `409 self_vote`
  - voting in `setup`, `voting_closed`, and `results_revealed` → `409 voting_not_open`
  - a vote for a removed entry → `404`
  - a voided vote still blocks a new vote
  - a released vote allows a new vote only while `voting_open`
  - `GET /api/entries` and `/api/me` never include vote counts

### Implementation for User Story 2

- [ ] T034 [US2] Implement `src/server/services/voting.ts` `castVote(realm, passId, entryId,
  assistedBy?)`. In one transaction, with `SELECT … FOR UPDATE` on the `contest` row:
  - stage must be `voting_open`
  - the entry exists and `removed_at IS NULL`
  - the pass is not in `entry_passes` for that entry
  - insert with `status='counted'`; map the partial unique violation to `already_voted`
  - write audit `vote.cast`
- [ ] T035 [US2] Implement `src/server/services/entries.ts` read side: `listEntries(realm)`
  returns `EntryCard[]`:
  - `displayName` is the linked nicknames joined with " & "
  - `alt` is "Costume photo of <displayName>"
  - photo URLs are `/api/photos/<photoId>/thumb|full`
  - also `entriesVersion`
- [ ] T036 [US2] Implement `GET /api/entries` (ETag on `entriesVersion`, auth pass|crew|screen)
  and `POST /api/votes` (requirePass, idempotency) in `src/server/routes/entries.ts` and
  `src/server/routes/votes.ts`
- [ ] T037 [US2] Implement photo serving `GET /api/photos/:photoId/:size` in
  `src/server/routes/photos.ts`:
  - auth pass|crew|screen
  - realm must match the active realm, else `404`
  - after `PHOTO_DELETE_AT` → `410 photos_deleted`
  - stream `<PHOTO_DIR>/<photoId>-480.webp` or `-1200.webp`
  - `Cache-Control: private, max-age=86400, immutable`
  - reject path traversal by validating `photoId` as a uuid
- [ ] T038 [P] [US2] Create `src/components/Gallery.tsx`:
  - a responsive grid of `EntryCard` thumbnails (`loading="lazy"`, width/height set, alt text)
    with the nickname under each
  - selectable cards are 44 px+ buttons
  - the student's own entry is disabled with the text "That's you!"
- [ ] T039 [P] [US2] Create `src/components/VoteConfirm.tsx`: a confirm dialog showing the chosen
  photo and nickname, with "Cast my vote" and "Go back" buttons, focus trapped, and Escape closes
- [ ] T040 [US2] Create the contest page `src/app/contest/page.tsx`:
  - `usePoll('/api/state', 4000)` and `usePoll('/api/entries')`
  - a stage banner with text: "Voting opens soon", "Vote now!", "Voting is closed",
    "Results are in!"
  - shows the gallery in every stage
  - voting controls only in `voting_open` when `me.vote` is null
  - after voting, a thank-you state showing the voted costume and no controls
  - errors (`voting_not_open`, `already_voted`) re-sync from the server and show a friendly
    message
  - never shows counts

**Checkpoint**: The core vote works against seeded entries. Run T033.

---

## Phase 5: User Story 3 - Crew adds costume entries (Priority: P1)

**Goal**: Crew sign in, find a pass, photograph the costume, confirm consent, and save in under
30 seconds. They can create passes for students without phones, and edit or remove entries.

**Independent Test**: Sign in at `/crew`, add an entry for a pass with a camera photo, and it
appears in `/contest` within 5 s. Removing it releases its votes.

### Tests for User Story 3 (photo handling required by Constitution VII)

- [ ] T041 [P] [US3] Integration tests in `tests/integration/photos.test.ts`:
  - uploading a JPEG containing EXIF GPS → stored WebP files have no EXIF/XMP/GPS metadata
    (check with sharp `metadata()`)
  - over 3 MB → `413`
  - a non-image → `415`
  - no consent → `422 consent_required`
  - a pass already linked → `409 pass_already_entered`
  - photo fetch with no cookie → `401`; with a pass from the other realm → `404`; with
    pass, crew, or screen → `200`
  - after `PHOTO_DELETE_AT` → `410`
  - removing an entry deletes both files from `PHOTO_DIR` and sets its votes to `released`
  - an entry-save retry with the same idempotency key creates one entry
- [ ] T042 [P] [US3] Integration tests in `tests/integration/crew-auth.test.ts`:
  - correct passcode sets the `crew` cookie
  - a wrong passcode returns `401`, and after 5 failures `429` with `Retry-After`
  - crew endpoints without the cookie → `401 not_crew`

### Implementation for User Story 3

- [ ] T043 [US3] Implement `POST /api/crew/session` and `DELETE /api/crew/session` in
  `src/server/routes/crew/session.ts`:
  - timing-safe compare with `CREW_PASSCODE`
  - `deviceLabel` must be one of the fixed list in `src/shared/deviceLabels.ts`
    ("Crew phone 1"…"Crew phone 12", "Tablet A", "Tablet B")
  - creates a `crew_sessions` row
  - in-memory per-IP limiter in `src/server/middleware/rateLimit.ts`: after 5 failures, delay
    doubles from 2 s up to 60 s
- [ ] T044 [US3] Implement `src/server/services/photos.ts`:
  - `processUpload(buffer)`: sharp `.rotate()` (apply EXIF orientation), then write two WebP
    files, 1200 px long edge at q≈75 and 480 px at q≈70, with no metadata (`withMetadata` not
    called), named by a new random uuid
  - `deletePhoto(photoId)`
  - `photoPath(photoId, size)`
- [ ] T045 [US3] Implement entry writes in `src/server/services/entries.ts`:
  - `createEntry(realm, crewSessionId, passIds[], photoBuffer, consent)`:
    - `consent` must be true, else `consent_required`
    - `passIds` must have length 1 or more, and each pass must be in the realm and not already
      in `entry_passes`
    - set `consent_confirmed_at = now()`
  - `updateEntry` (replace the photo and delete the old files; change linked passes)
  - `removeEntry`, in one transaction: set `removed_at`, delete `entry_passes`, update votes to
    `released`, delete the photo files, and return `releasedVotes`
  - all of them write audit events and call `invalidate(realm)`
- [ ] T046 [US3] Implement the crew entry and pass routes in `src/server/routes/crew/entries.ts`
  and `src/server/routes/crew/passes.ts`:
  - `GET /api/crew/passes?q=`, max 20, matching a nickname prefix or substring
    (case-insensitive) or the exact number
  - `POST /api/crew/passes` creates a crew pass with `origin='crew'`, `token_hash` null, and the
    event window ignored
  - `POST /api/crew/entries` (multer memory storage, 3 MB limit, `image/*` only; adds
    `warning: 'added_during_voting'` when the stage is `voting_open`, FR-024)
  - `PATCH /api/crew/entries/:id` and `DELETE /api/crew/entries/:id`
- [ ] T047 [P] [US3] Create `src/lib/resizeImage.ts`: resize to a 1600 px long edge in the
  browser with canvas / `createImageBitmap` (applying orientation), output JPEG quality 0.8,
  return a Blob
- [ ] T048 [P] [US3] Create the crew sign-in and layout in `src/app/crew/layout.tsx` and
  `src/app/crew/SignIn.tsx`: a passcode field plus a device-label select (no free text), and a
  nav for Dashboard, Entries, Assist, Votes, and Results
- [ ] T049 [US3] Create the entry workflow `src/app/crew/entries/page.tsx`:
  1. Search a pass by nickname or number with large result buttons, or "Student has no phone →
     create pass", which shows the new nickname for the crew to tell the student.
  2. Take a photo with `<input type="file" accept="image/*" capture="environment">`; if the
     camera is refused, tell the crew how to allow it and let them choose from the library.
  3. A required consent checkbox: "Student and parent agree this photo can be shown tonight".
  4. Save. It retries safely through `src/lib/api.ts`, then shows a success toast and resets for
     the next costume.
  Below it, a list of entries with Edit (replace photo, change passes) and Remove (confirm
  dialog that says votes will be released).

**Checkpoint**: Crew can build the gallery. Run T041–T042.

---

## Phase 6: User Story 4 - Crew controls the contest stages (Priority: P1)

**Goal**: Crew move through setup → voting open → voting closed → results revealed with
confirmed button presses, can undo each step, and see live totals.

**Independent Test**: Step forward and back through every stage on `/crew`. `/contest` follows
within 5 s, nothing changes without a press, and two devices acting at once resolve with one
`stage_conflict`.

### Tests for User Story 4 (state machine required by Constitution VII)

- [ ] T050 [P] [US4] Unit tests in `tests/unit/contest-machine.test.ts` for the pure
  `nextState(current, action)`:
  - `advance` from each stage
  - `undo` from each stage
  - reveal steps 0→1→2→3 inside `results_revealed` and undo 3→2→1→0→`voting_closed`
  - `advance` at step 3 is refused
  - `undo` at `setup` is refused
  - entering `results_revealed` is refused when there are no counted votes
- [ ] T051 [P] [US4] Integration tests in `tests/integration/stage.test.ts`:
  - `POST /api/crew/stage` with a wrong `from` → `409 stage_conflict` including the current
    state
  - two concurrent advances with the same `from` → one succeeds and one conflicts
  - undo preserves all entries and votes
  - `contest.version` increments and `/api/state` ETag changes
  - every change writes an audit `stage.change`
  - there is no code path that changes the stage without a crew request (assert the
    contest-state module exports no timer)

### Implementation for User Story 4

- [ ] T052 [US4] Implement `src/server/services/contest-machine.ts`: the pure
  `nextState({stage, revealStep}, 'advance'|'undo', { hasCountedVotes })` following the
  transition diagram in data-model.md, returning the new state or an error code
- [ ] T053 [US4] Implement `transition(realm, crewSessionId, action, from)` in
  `src/server/services/contest-state.ts`:
  - in one transaction, `SELECT … FOR UPDATE` on `contest`
  - compare with `from`, else `stage_conflict`
  - apply `nextState`, increment `version`, write audit, then `invalidate`
- [ ] T054 [US4] Implement `POST /api/crew/stage` and `GET /api/crew/dashboard` in
  `src/server/routes/crew/stage.ts` and `src/server/routes/crew/dashboard.ts`. The dashboard
  returns `totals: { passes, votesCounted }` (counted votes only; never per-entry counts,
  FR-026) and `screenUrl` = `${PUBLIC_URL}/screen?t=${SCREEN_TOKEN}`
- [ ] T055 [P] [US4] Create `src/components/StageControls.tsx`:
  - a stepper showing all four stages, with the current one marked by an icon and text (not color
    alone)
  - a big "Next: <stage>" button and an "Undo" button, each opening a confirm dialog that names
    exactly what will change
  - on `stage_conflict`, refresh to the server state and show "Someone else changed the stage"
- [ ] T056 [US4] Create the crew dashboard `src/app/crew/page.tsx`:
  - `usePoll('/api/crew/dashboard', 2000)`
  - `StageControls`
  - totals "N votes of M passes"
  - a screen-link copy button
  - a rehearsal toggle placeholder, wired in US9

**Checkpoint**: All P1 stories are done, which is the MVP. The contest can run end to end with
the results ranking read on the crew device.

---

## Phase 7: User Story 5 - Big screen shows the contest (Priority: P2)

**Goal**: A read-only projector view with a rotating gallery, join QR code, instructions, and
"votes of passes" totals.

**Independent Test**: Open the screen link on a second device, then add an entry and cast a vote
elsewhere. Both appear within 5 s, and nothing on the screen can change contest state.

- [ ] T057 [US5] Implement the screen auth routes in `src/server/routes/screen.ts`:
  - `GET /screen?t=` is handled by Express before Next: if `t` equals `SCREEN_TOKEN`
    (timing-safe), set the signed `screen` cookie (30 days) and redirect to `/screen`
  - `GET /api/screen/totals` (requireScreen) → `{ passes, votesCounted }`
- [ ] T058 [P] [US5] Create `src/components/ScreenGallery.tsx`: rotates through entries with the
  `full` image every 6 s, with the nickname as a large caption. Under reduced motion it uses a
  plain swap instead of a crossfade
- [ ] T059 [US5] Create the screen page `src/app/screen/page.tsx`:
  - without the screen cookie (any `401`), show "Ask a crew member for the screen link"
  - otherwise a 16:9 layout with `ScreenGallery`, `<img src="/api/qr.svg">` plus "Scan to get
    your Night Pass" and the short URL, a stage-specific instruction line, and the totals
    "N votes cast of M passes"
  - polls state, entries, and totals every 2 s
  - no interactive controls

---

## Phase 8: User Story 6 - Crew runs the results reveal (Priority: P2)

**Goal**: A private ranking with shared places, then 3rd, 2nd, and 1st revealed one at a time on
the big screen and phones.

**Independent Test**: With seeded votes including a tie, close voting and open
`/crew/results`. The tie shows as a shared place, each reveal press shows one place on
`/screen` and `/contest`, and undo hides it.

### Tests for User Story 6

- [ ] T060 [P] [US6] Unit tests in `tests/unit/ranking.test.ts` for the pure
  `rank(entriesWithCounts)`:
  - dense ranking `[10,7,7,5,2]` → places 1, 2 (tied ×2), 3, and one unplaced
  - zero-vote entries are never placed
  - only one distinct total → only place 1
  - all-zero → no places
  - removed entries and voided or released votes are excluded upstream

### Implementation for User Story 6

- [ ] T061 [US6] Implement `src/server/services/ranking.ts`:
  - `rank()` as tested
  - `crewRanking(realm)` (counts included)
  - `publicResults(realm)`: in `results_revealed`, return only places `> 3 - revealStep`, in
    order 3, 2, 1, without counts; otherwise `[]` (FR-031, FR-032)
- [ ] T062 [US6] Implement `GET /api/crew/ranking` (only in `voting_closed`/`results_revealed`,
  else `409`) and `GET /api/results` (pass|screen) in `src/server/routes/crew/ranking.ts` and
  `src/server/routes/results.ts`
- [ ] T063 [P] [US6] Create `src/components/Reveal.tsx`:
  - renders `RevealedPlace[]` with the place label ("3rd Place" or "Tied for 2nd"), photo(s),
    and nickname(s)
  - a celebratory CSS animation (scale-in plus confetti made only from CSS) that becomes a static
    card under `prefers-reduced-motion`
  - the newest place is announced through an `aria-live="polite"` region
- [ ] T064 [US6] Create the crew results page `src/app/crew/results/page.tsx`:
  - the full ranking table with counts and a tie badge (text "TIE")
  - a "Reveal 3rd / 2nd / 1st" button that sends the stage `advance` with confirm
  - "Undo last reveal"
  - a note when fewer than three places exist
- [ ] T065 [US6] Wire `Reveal` into `src/app/screen/page.tsx` and `src/app/contest/page.tsx`:
  when the stage is `results_revealed`, fetch `/api/results` whenever `state.version` changes and
  show the revealed places in place of the gallery and voting UI

---

## Phase 9: User Story 7 - Crew reviews and voids suspicious votes (Priority: P3)

**Goal**: A sortable vote log, with void and restore. There is no automatic flagging.

**Independent Test**: Create several passes quickly and vote from each. Sort `/crew/votes` by pass
creation time and they sit together. Void one: totals drop and an audit entry exists. Restore it
and they rise again.

- [ ] T066 [P] [US7] Add to `tests/integration/votes.test.ts`:
  - void sets `status='voided'` and drops `votesCounted`
  - restore returns it to `counted`
  - both write audit entries with the crew session id
  - a voided vote still blocks the pass from voting again
  - there is no endpoint that voids automatically
- [ ] T067 [US7] Implement `listVotes(realm, sort, order, status)`, `voidVote`, and
  `restoreVote` in `src/server/services/voting.ts`. `restoreVote` is refused if the entry was
  removed (status `released`)
- [ ] T068 [US7] Implement `GET /api/crew/votes`, `POST /api/crew/votes/:id/void`,
  `POST /api/crew/votes/:id/restore`, and `GET /api/crew/audit` in
  `src/server/routes/crew/votes.ts` and `src/server/routes/crew/audit.ts`
- [ ] T069 [US7] Create the vote log page `src/app/crew/votes/page.tsx`:
  - a table of cast time, pass `#number nickname`, pass created time (to the second), origin,
    assisted, entry, and status
  - sort toggles for cast time and pass creation time
  - a status filter
  - Void/Restore buttons with confirm
  - status shown with text and icon

---

## Phase 10: User Story 8 - Crew-assisted voting (Priority: P3)

**Goal**: A student without a phone votes on a crew device using their crew-created pass.

**Independent Test**: During `voting_open`, use `/crew/assist` to pick or create a crew pass and
vote. The vote counts once and is marked assisted, and the student's own entry can't be chosen.

- [ ] T070 [P] [US8] Add to `tests/integration/votes.test.ts`:
  - an assisted vote follows the same one-vote, self-vote, and stage rules
  - `assisted_by_crew_session_id` is set
  - a second assisted vote for the same pass → `already_voted`
- [ ] T071 [US8] Implement `POST /api/crew/assisted-votes` in
  `src/server/routes/crew/assisted.ts`, calling `castVote(realm, passId, entryId,
  crewSessionId)`
- [ ] T072 [US8] Create `src/app/crew/assist/page.tsx`:
  1. Find the crew-created pass by nickname or number, or create one.
  2. Hand the device to the student, who sees the `Gallery` with their own entry disabled.
  3. `VoteConfirm`.
  4. A thank-you state, then a "Done, back to crew" button that clears the selection.

---

## Phase 11: User Story 9 - Rehearsal mode (Priority: P3)

**Goal**: Practise the whole flow in an isolated realm, then wipe it with one action.

**Independent Test**: Follow quickstart.md "Manual rehearsal" steps 1–11. After the wipe there
are no rehearsal rows or photo files, and live data is untouched.

### Tests for User Story 9 (dry run required by Constitution VII)

- [ ] T073 [P] [US9] Integration tests in `tests/integration/rehearsal.test.ts`:
  - turning rehearsal on switches `activeRealm`, and new passes use `np_rehearsal`
  - turning it on after the live contest left `setup` → `409 rehearsal_locked`
  - the wipe deletes all rehearsal passes, entries, entry_passes, votes, and audit events, plus
    its photo files, and resets the rehearsal contest to `setup`/0
  - live rows and live photo files are unchanged (counted before and after)
  - turning rehearsal off brings back the phone's live pass via `np_live`

### Implementation for User Story 9

- [ ] T074 [US9] Implement `src/server/services/rehearsal.ts`:
  - `setRehearsal(on, crewSessionId)`: refuse `on` when the live `contest.stage !== 'setup'`;
    write audit `rehearsal.on/off`
  - `wipeRehearsal(crewSessionId)`: in one transaction, select rehearsal `photo_id`s and delete
    the rehearsal rows in FK order; reset the rehearsal contest row; after commit, delete the
    photo files; write a live-realm audit `rehearsal.wipe` with counts
  - invalidate both realms
- [ ] T075 [US9] Implement `POST /api/crew/rehearsal` and `POST /api/crew/rehearsal/wipe`
  (`{ confirm: 'WIPE' }` required) in `src/server/routes/crew/rehearsal.ts`, and
  `PUT /api/crew/settings/window` in `src/server/routes/crew/settings.ts` (`end` must be after
  `start`; audit `settings.window`)
- [ ] T076 [US9] Wire the dashboard in `src/app/crew/page.tsx`:
  - a rehearsal on/off toggle with confirm
  - a "Wipe rehearsal data" button that requires typing `WIPE` and shows the deleted counts
  - event window start and end inputs (datetime-local in America/Edmonton)

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Deletion, deployment, load, and accessibility verification.

- [ ] T077 Implement `src/server/services/purge.ts` and `scripts/purge.ts`:
  - `purgePhotos()` deletes every file in `PHOTO_DIR` and writes a system audit event
  - `purgeAll()` additionally truncates all tables except `settings`/`contest` and resets
    `contest`
  - in `src/server/index.ts`, schedule an hourly check that calls `purgePhotos()` once
    `now >= PHOTO_DELETE_AT` (deletion only; never touches `contest`)
  - `npm run purge -- --all` runs `purgeAll()`
- [ ] T078 [P] Add security headers middleware in `src/server/middleware/security.ts`:
  - CSP `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline';
    script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`
  - `Referrer-Policy: no-referrer`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy: camera=(self)`
  This enforces "no third-party origins" (Constitution I)
- [ ] T079 [P] Create the `Dockerfile`:
  - multi-stage on node:24-alpine, with libvips for sharp
  - `npm ci`, `next build`, compile the server
  - the runtime stage copies `.next`, `dist`, `drizzle`, `public`, `node_modules` (prod)
  - runs as a non-root user
  - `CMD` runs migrations, then the server
  - `HEALTHCHECK` on `/healthz`
- [ ] T080 [P] Create `compose.yml`:
  - `app` (built image, `env_file: .env`, `photos` volume at `PHOTO_DIR`, depends on a healthy db)
  - `db` (postgres:17-alpine, `pgdata` volume, healthcheck)
  - `caddy` (ports 80/443, `Caddyfile`, `caddy_data` volume)
  Create the `Caddyfile`: `{$DOMAIN}` reverse proxies to `app:3000` with gzip/zstd encoding
- [ ] T081 [P] Create `scripts/deploy.sh` (`set -euo pipefail`, verify `.env` exists,
  `docker compose up -d --build`, poll `https://$DOMAIN/healthz` for up to 60 s, and print the
  result) and make it executable
- [ ] T082 [P] Create `scripts/load-test.ts` with autocannon:
  - 400 connections polling `GET /api/state` with ETags for 60 s
  - in parallel, 350 distinct passes each casting one vote
  - assert p95 under 300 ms, 0 non-2xx/304 errors except expected 409s, and exactly 350 counted
    votes in the DB
  - wire it to `npm run test:load`
- [ ] T083 [P] Create `tests/e2e/student.spec.ts`:
  - fresh context → `/` shows a pass → `/contest` → vote → thank-you, in under 60 s (SC-001)
  - reload and `page.goBack()` show no vote controls (SC-002)
  - the own entry is disabled
- [ ] T084 [P] Create `tests/e2e/a11y.spec.ts`:
  - runs `@axe-core/playwright` on `/`, `/contest`, `/crew`, `/crew/entries`, and `/screen` with
    WCAG 2 AA rules and zero violations
  - asserts every button and link has a bounding box of at least 44×44
  - with `reducedMotion: 'reduce'`, the reveal has no running animations
- [ ] T085 Measure the student payload with `next build` output and a Playwright network capture.
  Initial JS must be under 200 KB gzipped and `/api/state` under 1 KB. Fix any regressions in
  `src/app/contest/page.tsx` and `src/app/page.tsx`
- [ ] T086 Write `README.md`:
  - project summary
  - local setup and commands
  - the env var table
  - the deploy steps (`./scripts/deploy.sh`)
  - the event-night runbook (rehearsal, then open voting, then reveal)
  - the show-of-hands fallback note
  - the data-deletion procedure (`npm run purge -- --all`, then `docker compose down -v`, and
    record date and operator)
  Update `CLAUDE.md` with the final verified commands
- [ ] T087 Run the full quickstart.md validation on the production server: all automated checks
  pass, then the manual rehearsal steps 1–11, then wipe. Record the results in
  `specs/001-costume-contest/checklists/rehearsal.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks every story.
- **User Stories (Phases 3–11)**: depend on Foundational.
- **Polish (Phase 12)**: T077–T081 can start after Foundational; T082–T087 need US1–US6
  complete.

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 Night Pass | Foundational | Fully independent |
| US2 Vote | Foundational (+ `seed:dev` T025) | Uses seeded entries and stage, so it does not need US3 or US4 to be built first |
| US3 Crew entries | Foundational | Its entries show up in US2's gallery once both exist |
| US4 Stages | Foundational | T052 is pure and has no dependencies |
| US5 Big screen | US2 (T035–T037 entries and photo routes) | |
| US6 Reveal | US4 (T052–T053 `results_revealed` steps), US5 (T059 screen page) | |
| US7 Vote log | US2 (T034 voting service) | |
| US8 Assisted voting | US2 (T034), US3 (T046 crew passes) | |
| US9 Rehearsal | US4 (T056 dashboard) | Realm plumbing is already in Foundational |

### Within Each Story

Tests come first (they should fail), then the service, then routes, then UI. Commit after each
task, following the `CLAUDE.md` commit workflow.

### Parallel Opportunities

- Setup: T003–T006 together, after T001–T002.
- Foundational: T011, T012, T013, and T018–T024 in parallel after T008–T010. T014–T017 follow T010.
- After Foundational, US1, US2, US3, and US4 can proceed in parallel, since each touches different
  files. The only shared files are `src/server/services/entries.ts` (read side in US2, write side
  in US3) and `src/server/services/contest-state.ts` (US4 adds `transition`). Sequence those two
  edits.
- Each story's tests marked [P] run in parallel with its UI components marked [P].
- Polish T078–T084 are all different files and can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Tests and pure UI components together:
Task: "T033 Integration tests in tests/integration/votes.test.ts"
Task: "T038 Gallery component in src/components/Gallery.tsx"
Task: "T039 VoteConfirm component in src/components/VoteConfirm.tsx"

# Then the server chain in order:
Task: "T034 castVote in src/server/services/voting.ts"
Task: "T035 listEntries in src/server/services/entries.ts"
Task: "T036 routes in src/server/routes/entries.ts and votes.ts"
Task: "T037 photo route in src/server/routes/photos.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T041 Photo integration tests in tests/integration/photos.test.ts"
Task: "T042 Crew auth tests in tests/integration/crew-auth.test.ts"
Task: "T047 Client resize in src/lib/resizeImage.ts"
Task: "T048 Crew sign-in in src/app/crew/layout.tsx"
```

---

## Implementation Strategy

The event is 2026-10-30, and the constitution requires a full rehearsal before doors open.

### MVP First (all P1 stories: US1–US4)

1. Phases 1–2, target by 2026-10-22.
2. US1, then US2 (against seed data), then US3, then US4, target by 2026-10-25. All four are P1
   because the contest cannot run without any one of them.
3. **STOP and VALIDATE**:
   - run T026–T027, T033, T041–T042, and T050–T051
   - run a crew-device and phone walk-through
   - deploy with T079–T081 to the real server early, so HTTPS, cookies, and the camera are
     tested on real phones
4. At this point the contest can run, with winners read off the crew device if needed.

### Incremental Delivery

5. US5 big screen, then US6 reveal (P2), target by 2026-10-27.
6. US9 rehearsal, then US7 vote log, then US8 assisted voting (P3), target by 2026-10-28. US9
   goes first among the P3 stories because Constitution VII requires the dry run.
7. Polish: T077 purge, T082 load test, T083–T085 checks, T086 docs.
8. T087: full rehearsal on production by 2026-10-29, then wipe.

### If Time Runs Short

Cut in this order:
- T072 assisted-vote UI (crew can let the student use a spare crew phone's browser instead)
- T069 vote-log UI polish
- T063 reveal animation (keep the static reveal)

Never cut the T033/T041/T050/T051/T073 tests, the purge (T077), or the rehearsal (T087).

---

## Notes

- [P] tasks touch different files and have no dependency on incomplete tasks.
- Every constraint quoted in a task comes from data-model.md or contracts/api.md. Don't loosen
  one without updating those documents.
- Run `npm run test:integration` before any commit touching voting, stages, photos, or rehearsal.
