---

description: "Task list for Contest Night Polish"
---

# Tasks: Contest Night Polish

**Input**: design documents in `specs/002-contest-polish/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: these are required. Constitution VII mandates tests for vote enforcement, the state
machine, and photo handling. The spec's success criteria (SC-102, SC-104, SC-106, SC-107, SC-109) are
verified by automated tests. Within each story, write the tests first and confirm they fail.

**Organization**: tasks are grouped by user story, in priority order: US1 and US2 (P1), then US3, US4,
and US6 (P2), then US5 (P3). Story numbers follow `spec.md`.

**Deadline**: event 2026-10-30 18:30 (America/Edmonton). Deploy after each story phase (GitHub →
Actions → *Deploy*). The production rehearsal (001 T087) runs after the last phase that ships.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task belongs to (US1–US6)

---

## Phase 1: Setup

**Purpose**: dependencies and the brand-asset pipeline that later phases use.

- [X] T001 Add `jsqr@1.4.0` (Apache-2.0) to `dependencies` in package.json with `npm install jsqr@1.4.0`, and commit package-lock.json.
- [X] T002 [P] Create scripts/brand-assets.ts. It reads `media-bundle/` (gitignored) and writes optimized WebP files to public/brand/ with sharp, per research §9:
  - `fear-factor-logo.webp` at 360 px wide and `fear-factor-logo@2x.webp` at 720 px, cropped to the artwork from `Workfiles/RiznFearFactor_1080x1920_Logo.png`, each ≤ 60 KB
  - `fear-factor-banner.webp` at 1080 px from `fearfactorlogos/Rizn Fear Factor WebsiteBanner_2026.png`, ≤ 90 KB
  - `rizn-youth-black.webp` and `rizn-youth-white.webp` (recoloured) at 480 px from `fearfactorlogos/IMG_4716.PNG`, ≤ 15 KB each
  - `sticker-stars.webp` and `sticker-horse.webp` from `Graphic elements/Stars.png` and `Red horse.png`
  - `sticker-beetle.webp`, `sticker-clock.webp`, `sticker-spiral.webp`, and `sticker-phone.webp`, cut from `Graphic elements/details.png` with `sharp().extract()` crop boxes
  - stickers at 160–240 px, ≤ 20 KB each, keeping transparency

  It exits non-zero with a clear message if `media-bundle/` is missing, and prints each output's size.
- [X] T003 Add `"brand:assets": "tsx scripts/brand-assets.ts"` to the scripts in package.json. Run it, inspect the outputs visually, delete public/brand/.gitkeep, and commit the public/brand/*.webp files.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: the single migration and the shared types every story compiles against.

**⚠️ CRITICAL**: no story work can start until this phase is done.

- [X] T004 Update src/server/db/schema.ts per data-model.md:
  - add `"replaced"` to `voteStatusEnum` (`["counted", "voided", "released", "replaced"]`);
  - add `costumeTitle: text("costume_title")` (nullable) to `entries`, with check `entries_costume_title_len`: `costume_title IS NULL OR char_length(costume_title) BETWEEN 1 AND 40`;
  - add `votingClosesAt: ts("voting_closes_at")` (nullable) to `contest`;
  - leave the `votes_one_per_pass` partial index (`status in ('counted','voided')`) **unchanged**.
- [X] T005 Run `npm run db:generate` and rename the output to drizzle/0001_contest_polish.sql, updating drizzle/meta/_journal.json to match. Check that the SQL contains `ALTER TYPE "public"."vote_status" ADD VALUE 'replaced'`, the two `ADD COLUMN` statements, and the check constraint. Then check that `npm run db:migrate` applies it cleanly to a dev database that already has data.
- [X] T006 [P] Update src/shared/types.ts per contracts/api.md:
  - add `"vote_voided"`, `"bad_scan_code"`, and `"wrong_realm"` to `ERROR_CODES`;
  - add `votingClosesAt: string | null` to `PublicState`;
  - add `costumeTitle: string | null` to `EntryCard`;
  - add `ownEntry: EntryCard | null`, `ownPlace: { place: 1 | 2 | 3; tied: boolean } | null`, and `voteChangeable: boolean` to `Me`.
- [X] T007 [P] Update src/shared/schemas.ts:
  - `changeVoteBody = z.object({ entryId: z.uuid() })`;
  - `costumeTitleField`: a string, trimmed, inner whitespace collapsed to single spaces, rejecting control characters (`/[\u0000-\u001F\u007F]/`), max 40 characters after normalizing, with `""` meaning clear (stored as `NULL`);
  - `votingCloseBody = z.object({ at: z.iso.datetime({ offset: true }).nullable() })`;
  - `scanQuery = z.object({ code: z.string().regex(/^NP1\.[LR]\.\d{1,6}\.[A-Z2-7]{12}$/) })`;
  - add `"replaced"` to the `status` enum in `voteListQuery`.
- [X] T008 Make the server compile against the new types:
  - in src/server/services/contest-state.ts, return `votingClosesAt: row.votingClosesAt?.toISOString() ?? null` from `getPublicState`;
  - in src/server/services/entries.ts, select `entries.costumeTitle` in `listEntries`/`getEntryCard`, and have `toCard` return `costumeTitle` and the alt text "Costume photo: {displayName} as {title}" (or "Costume photo of {displayName}" when the title is null);
  - in src/server/routes/pass.ts, fill the new `Me` fields with `null`/`false` placeholders.

  Run `npm run typecheck` and fix the fallout in src/app and src/components.
- [X] T009 [P] Create src/components/EntryLabel.tsx (+ EntryLabel.module.css). It renders `{displayName}` in small type, then "as", then `{costumeTitle}` in large uppercase display type, or `displayName` alone when `costumeTitle` is null. It has a `size` prop (`sm | md | xl`), and wraps long titles instead of truncating them (spec edge case: very small phones).
- [X] T010 Run `npm run typecheck && npm test && npm run test:integration` to confirm 001 behaviour is intact after the migration. Commit as `chore: migration 0001 and shared types for 002`.

**Checkpoint**: the schema is migrated and the app behaves exactly as before.

---

## Phase 3: User Story 1 - Student changes their vote (Priority: P1) 🎯 MVP

**Goal**: while voting is open, a student can move their single vote to a different costume.

**Independent Test**: vote for A, change to B, reload, double-tap, and resend. Exactly one counted
vote, for B. The log shows A as replaced, and the totals are unchanged.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T011 [US1] Add a `describe("vote change")` block to tests/integration/votes.test.ts, using the existing helpers in tests/integration/helpers.ts. It covers:
  - (a) A → B leaves one `counted` row for B and one `replaced` row for A, with `status_changed_at` set;
  - (b) `PUT /api/votes/mine` to the current entry returns `changed: false` and writes no new row or audit event;
  - (c) with no prior vote it behaves as a first vote;
  - (d) it is refused with `voting_not_open` in setup, voting_closed, and results_revealed;
  - (e) a `voided` vote returns `409 vote_voided`;
  - (f) changing to the pass's own entry returns `self_vote`;
  - (g) 20 concurrent changes from one pass to alternating entries end with exactly one `counted` row (SC-102);
  - (h) `GET /api/screen/totals` `votesCounted` is unchanged across changes;
  - (i) a second `POST /api/votes` still returns `already_voted`;
  - (j) the `vote.change` audit event carries `{ fromVoteId, toVoteId, passId, fromEntryId, toEntryId, assisted }`;
  - (k) the ranking counts only the latest choice;
  - (l) `PUT /api/crew/assisted-votes/:passId` changes a crew pass's vote, marks the new row's `assisted_by_crew_session_id`, and sets the old row's `status_changed_by_crew_session_id` (FR-106);
  - (m) after crew restore a voided vote, the restored vote is the counted one and replaced rows stay replaced.

### Implementation for User Story 1

- [ ] T012 [US1] Implement `changeVote(realm, passId, entryId, assistedByCrewSessionId?)` in src/server/services/voting.ts, per research §1. In one `withTx`:
  - lock the contest row `FOR UPDATE` and require `voting_open`;
  - check the entry exists in the realm and is not removed;
  - reject a self-vote;
  - select the pass's vote where status in (`counted`, `voided`) `FOR UPDATE`:
    - none: delegate to the `castVote` logic (share a helper; don't nest transactions);
    - `voided`: throw `AppError("vote_voided", 409, "This vote can't be changed")`;
    - same entry: return `{ entryId, changed: false }`;
    - otherwise: update the old row to `status: "replaced", statusChangedAt: now, statusChangedByCrewSessionId: assisted ?? null`, insert the new `counted` row (with `assistedByCrewSessionId`), and `record` `vote.change`.

  Map `isUniqueViolation` to `already_voted` as `castVote` does.
- [ ] T013 [US1] Add `PUT /api/votes/mine` (`requirePass`, `idempotency`, `changeVoteBody`) to src/server/routes/votes.ts. It returns `200 { vote: { entryId }, changed }`.
- [ ] T014 [P] [US1] Add `PUT /api/crew/assisted-votes/:passId` (`requireCrew`, `idempotency`, `changeVoteBody`, `uuidSchema` for the param) to src/server/routes/crew/votes.ts, calling `changeVote(req.realm, passId, entryId, req.crew!.id)`.
- [ ] T015 [US1] In src/server/routes/pass.ts, have `GET /api/me` return `voteChangeable: true` only when the contest stage is `voting_open` (via `getContest`) and the pass's vote status is `counted`. `vote` stays the `counted`/`voided` row only, never a `replaced` one.
- [ ] T016 [US1] Extend `listVotes` in src/server/services/voting.ts to accept `status` `"replaced"` and return `statusChangedAt` and `entry.costumeTitle`. In src/app/crew/votes/page.tsx, add a "Replaced" filter option and a "replaced" badge (as text, not colour alone), hide the void/restore buttons on replaced rows, and label entries with `EntryLabel size="sm"`.
- [ ] T017 [P] [US1] Add a `change` variant to src/components/VoteConfirm.tsx. When given `current: EntryCard` and `next: EntryCard`, it shows "Change your vote from {current} to {next}?" using `EntryLabel`, with Confirm and Cancel buttons; Cancel changes nothing.
- [ ] T018 [US1] Update src/app/contest/page.tsx:
  - The thank-you state names the current choice with `EntryLabel`. When `me.voteChangeable`, it shows a "Change my vote" button (≥ 44 px) that returns to the gallery in "changing" mode, with the current choice marked "Your vote" and own entries still disabled.
  - Picking a different entry opens `VoteConfirm` in the change variant, which calls `PUT /api/votes/mine` with an Idempotency-Key, then refetches `/api/me`.
  - On `voting_not_open`, it shows "Voting has closed — your vote for {current} stands".
  - The button disappears when `state.stage` leaves `voting_open` (within one poll).
- [ ] T019 [US1] Update src/app/crew/assist/page.tsx so that when the chosen crew pass already has a counted vote during `voting_open`, crew can pick a new entry and confirm, calling `PUT /api/crew/assisted-votes/:passId`.
- [ ] T020 [US1] Add a Playwright test to tests/e2e/student.spec.ts: vote A, then "Change my vote", pick B, confirm, and see the thank-you state for B. Close voting from a crew context and assert "Change my vote" is gone within 5 s. Run `npm run test:integration` and `npm run test:e2e`, and commit `feat: students can change their vote while voting is open (FR-101–FR-106)`.

**Checkpoint**: US1 works alone. **Deploy.**

---

## Phase 4: User Story 2 - Crew add a costume title (Priority: P1)

**Goal**: entries read "{nickname} *as* TITLE" on every screen. The title is crew-entered, optional,
and editable.

**Independent Test**: add an entry titled "Superman". The gallery, big screen, vote confirmation,
and reveal show it. Edit it and clear it, and every screen updates within 5 s.

### Tests for User Story 2 ⚠️

- [ ] T021 [US2] Create tests/integration/entries.test.ts, reusing the photo fixture from tests/integration/photos.test.ts. It covers:
  - `POST /api/crew/entries` with `costumeTitle=" Super   man "` stores `"Super man"`;
  - 41 characters returns `400 invalid_request`;
  - a control character returns `400`;
  - omitting the field gives `null`;
  - `PATCH` with `costumeTitle=""` clears it to `null`;
  - `GET /api/entries` cards carry `costumeTitle` and alt "Costume photo: {nicknames} as {title}";
  - an `entry.update` audit event with `costumeTitle: { from, to }`, and `entry.create` including `costumeTitle`;
  - the rehearsal wipe deletes rehearsal entries with their titles;
  - a student request (pass cookie) to the crew endpoint returns `401 not_crew`.

### Implementation for User Story 2

- [ ] T022 [US2] In src/server/routes/crew/entries.ts, parse the optional multipart field `costumeTitle` with `costumeTitleField` on POST and PATCH. Pass it to `createEntry`/`updateEntry` in src/server/services/entries.ts, which persist it (an empty value is stored as `NULL`), include it in the `entry.create` and `entry.update` audit details (`costumeTitle: { from, to }` only when it changed), and call `bumpEntriesVersion` on a title-only edit.
- [ ] T023 [US2] Add a single-line text input to the add and edit forms in src/app/crew/entries/page.tsx, labelled "Costume (what are they dressed as?)", with helper text "Describe the costume — no real names", `maxLength={40}`, a live character count, `autoComplete="off"`, and placeholder "e.g. Superman". Send it as `costumeTitle` in the FormData. Show existing titles in the entry list with `EntryLabel size="sm"`.
- [ ] T024 [P] [US2] Replace the bare `displayName` rendering with `EntryLabel` in src/components/Gallery.tsx (`md`), src/components/ScreenGallery.tsx (`xl`), src/components/Reveal.tsx (`xl` when `big`, else `md`), src/components/VoteConfirm.tsx, and src/app/crew/results/page.tsx.
- [ ] T025 [P] [US2] Return `costumeTitle` on every entry in the crew ranking and public results (`crewRanking` and `publicResults` in src/server/services/ranking.ts) by reusing `toCard`.
- [ ] T026 [US2] Run `npm run test:integration` and `npm run test:e2e`, check the a11y suite still passes, and commit `feat: crew-entered costume titles shown as "nickname as title" (FR-107–FR-110)`.

**Checkpoint**: US1 and US2 both work. **Deploy.** This is the minimum shippable set.

---

## Phase 5: User Story 3 - Big-screen countdown (Priority: P2)

**Goal**: crew set "voting closes at", and the big screen counts down using the server's clock. It
never closes voting by itself.

**Independent Test**: set the close time 61 min ahead and open voting. The screen shows `1h 01m`,
then `59:59`-style ticking, then "Voting closes any moment" at zero, and the stage is still
`voting_open`.

### Tests for User Story 3 ⚠️

- [ ] T027 [P] [US3] Create tests/unit/countdown.test.ts for `formatCountdown(remainingMs)` in src/lib/countdown.ts:
  - 3 601 000 ms gives `{ kind: "hm", text: "1h 01m" }`;
  - 3 600 000 gives "1h 00m";
  - 3 599 000 gives `{ kind: "ms", text: "59:59" }`;
  - 61 000 gives "1:01";
  - 1 000 gives "0:01";
  - 0 and −5 000 give `{ kind: "closing" }`;
  - 7 265 000 gives "2h 02m".

  Also test `estimateOffset(samples)`, which takes the median of `serverDate + rtt/2 − clientNow`, using a clock skewed by +300 s.
- [ ] T028 [P] [US3] Create tests/integration/voting-close.test.ts. It covers:
  - `PUT /api/crew/voting-close { at }` returns `PublicState` with `votingClosesAt`;
  - `{ at: null }` clears it;
  - a `voting_close.set` audit event with `{ from, to }`;
  - `/api/state` includes it and its ETag changes;
  - the response carries a `Date` header on both 200 and 304;
  - a past time is accepted;
  - the stage remains `voting_open` after the time passes (Constitution VI);
  - a rehearsal value is invisible in live and is cleared by `POST /api/crew/rehearsal/wipe`;
  - a pass cookie gets `401`.

### Implementation for User Story 3

- [ ] T029 [US3] Add `setVotingClose(realm, crewSessionId, at: Date | null)` to src/server/services/contest-state.ts. It updates `contest.voting_closes_at`, bumps `version`, records `voting_close.set` with `{ from, to }`, calls `invalidate(realm)`, and returns `getPublicState(realm)`. Add a `PUT /api/crew/voting-close` route (`requireCrew`, `idempotency`, `votingCloseBody`) in src/server/routes/crew/dashboard.ts.
- [ ] T030 [US3] In src/server/services/rehearsal.ts, add `voting_closes_at = null` to the wipe's `update contest … where realm = 'rehearsal'` statement.
- [ ] T031 [P] [US3] Create src/lib/countdown.ts with the pure functions `formatCountdown` and `estimateOffset` tested in T027. Minutes are rounded up when ≥ 1 h. The format is `m:ss` under 1 h.
- [ ] T032 [US3] Create src/lib/useServerClock.ts. Have src/components/StateProvider.tsx (or `usePoll` in src/lib/usePoll.ts) record `Date.parse(res.headers.get("Date"))`, `performance.now()` before and after each `/api/state` fetch, and the client time, keep the last 5 samples, and expose `serverNow()` = `Date.now() + estimateOffset(samples)`.
- [ ] T033 [US3] Create src/components/Countdown.tsx (+ Countdown.module.css). It takes `closesAt: string`, ticks every 250 ms using `serverNow()`, and renders:
  - the large number using the condensed font slot `--font-condensed` and `font-variant-numeric: tabular-nums`;
  - "Voting closes at {formatEdmontonTime(closesAt)}" in smaller type below it;
  - "Voting closes any moment" at ≤ 0.

  The live region uses `aria-live="off"`, so it doesn't spam screen readers. It has no animation beyond the digit change.
- [ ] T034 [US3] Render `<Countdown>` in src/app/screen/page.tsx only when `state.stage === "voting_open" && state.votingClosesAt`. Place it prominently in the join aside above the instructions (src/app/screen/screen.module.css), sized for the back of the room (≥ 12vh digits).
- [ ] T035 [US3] Add a "Voting closes at" control to the crew dashboard in src/app/crew/page.tsx: `<input type="time">`, with Save and Clear buttons and a confirm. The date is the event-start date in America/Edmonton, built with a helper `edmontonTimeOnEventDate(hhmm, eventStartIso)` added to src/lib/time.ts. Show the current value with `formatEdmontonTime`, and send `PUT /api/crew/voting-close` with an Idempotency-Key.
- [ ] T036 [US3] Run the unit and integration tests, manually check quickstart scenario 3 on the dev server, and commit `feat: big-screen countdown to crew-set voting close time (FR-111–FR-115)`.

**Checkpoint**: US3 works alone. **Deploy.**

---

## Phase 6: User Story 4 - RIZN Fear Factor look (Priority: P2)

**Goal**: brand orange and blue, the logos, the stickers, and the brand font slots everywhere, with no
other-origin requests.

**Independent Test**: walk every screen and see no purple, logos present, and stickers decorative.
Axe passes, no other origins appear in the network panel, and `/brand/` bytes on `/` are ≤ 250 KB.

### Tests for User Story 4 ⚠️

- [ ] T037 [P] [US4] Extend tests/e2e/a11y.spec.ts:
  - run axe (WCAG 2 AA) on `/`, `/contest` (voted and changeable), and `/screen` (voting_open with the countdown);
  - assert every request URL's origin equals the app origin;
  - sum `transferSize` of `/brand/` responses on `/` and assert ≤ 256 000 bytes (SC-107);
  - assert every `img[src^="/brand/sticker"]` or sticker element is `aria-hidden="true"` or has `alt=""`;
  - with `reducedMotion: "reduce"`, assert stickers have no running animations (`document.getAnimations()` is empty).

### Implementation for User Story 4

- [ ] T038 [US4] Replace the palette in src/styles/tokens.css with the research §8 table:
  - `--bg #0A0E1A`, `--surface #141B2E`, `--surface-2 #1E2840`, `--border #5A6E9C`, `--text #F5F7FF`, `--text-muted #B8C2DC`;
  - `--accent #F94003`, `--accent-strong #FF6A33`, `--on-accent #0A0E1A`;
  - new tokens `--accent-2 #0069FB`, `--on-accent-2 #FFFFFF`, `--accent-2-text #5B9DFF`;
  - keep `--danger`, `--success`, and `--rehearsal`;
  - update the header comment with the contrast ratios.

  Grep src for any leftover purple or hard-coded colours (`#1a0b2e`, `#2a1548`, `#3a1f60`, `#6b4c96`) and replace them with tokens. This includes the QR colour in src/server/routes/qr.ts, which becomes `#0A0E1A`.
- [ ] T039 [US4] Set up the font slots in src/app/layout.tsx, per research §10. Remove Creepster, and keep the existing pattern of `next/font` variables on `<html>`:
  - `--font-display`: `Lilita_One` (weight 400);
  - `--font-condensed`: `Barlow_Condensed` (weight 800);
  - `--font-accent`: aliased to `--font-display`;
  - `--font-body`: Nunito.

  Add `--font-condensed` and `--font-accent` to src/styles/tokens.css. Above the font imports, add a comment explaining how to switch a slot to `next/font/local` with a file in src/fonts/ when RIZN supply licensed Cubano, Asket Condensed, or Kuhlman files.
- [ ] T040 [P] [US4] Switch src/components/BrandMark.tsx (+ BrandMark.module.css) to the logo image:
  - `<img src="/brand/fear-factor-logo.webp" srcSet="… 1x, /brand/fear-factor-logo@2x.webp 2x" alt="RIZN Fear Factor" width height decoding="async">`, sized by the `size` prop;
  - remove the text wordmark;
  - add a `RiznYouthMark` export using `/brand/rizn-youth-white.webp` with alt "RIZN Youth".
- [ ] T041 [P] [US4] Create src/components/Stickers.tsx (+ Stickers.module.css). It takes a `layout` prop (`pass | contest | screen | crew`), renders absolutely positioned, rotated `<span aria-hidden="true">` elements with `background-image: url(/brand/sticker-*.webp)`, uses `pointer-events: none`, and never overlaps text, buttons, or the QR code. A gentle float animation runs only inside `@media (prefers-reduced-motion: no-preference)`. The pass layout uses at most 3 stickers to stay within the byte budget.
- [ ] T042 [US4] Apply the look to student pages:
  - src/app/page.tsx (logo, Stickers `pass`, RIZN Youth sign-off in the footer, and the "doors open" and "ended" screens);
  - src/app/contest/page.tsx (Stickers `contest`);
  - src/styles/globals.css: headings use `--font-display`; kickers and labels use `--font-condensed`; primary buttons are orange with `--on-accent` text; secondary buttons are blue (`--accent-2`) with `--on-accent-2` text; links use `--accent-2-text`;
  - src/components/PassBadge.module.css: an orange header band and a blue number strip, echoing the poster's orange and blue blocks.
- [ ] T043 [US4] Apply the look to the big screen in src/app/screen/page.tsx and screen.module.css: the `/brand/fear-factor-banner.webp` banner across the top replaces the BrandMark header, with Stickers `screen` around the gallery and countdown and a RIZN Youth mark in a corner. Totals use `--font-condensed`.
- [ ] T044 [P] [US4] Apply tokens to crew screens in src/app/crew/crew.module.css and src/components/StageControls.module.css. Keep crew screens plain (no stickers) for speed, with only the small logo in src/app/crew/layout.tsx.
- [ ] T045 [US4] Run `npm run test:e2e` (a11y and budget), then do quickstart scenario 4 by hand: Slow 4G shows the nickname before the logo, and reduced motion shows no animation. Commit `feat: RIZN Fear Factor brand palette, logos, stickers, and fonts (FR-116–FR-120)`.

**Checkpoint**: US4 works alone. **Deploy.** Ask RIZN staff to sign off (SC-108).

---

## Phase 7: User Story 6 - Pass flip to QR, crew scan to register (Priority: P2)

**Goal**: tapping the pass flips it to an unforgeable QR code. Crew scan it to select the pass. The
pass stays bound to the device's cookie.

**Independent Test**: flip a pass and scan it from the crew entries screen, and the pass is
selected. A forged or edited code is rejected. A plain camera scan reveals nothing usable, and an
edited cookie yields `no_pass`.

### Tests for User Story 6 ⚠️

- [ ] T046 [P] [US6] Create tests/unit/scanCode.test.ts for src/server/services/scanCode.ts:
  - `encodeScanCode({ realm, number, id }, secret)` matches `^NP1\.[LR]\.\d{1,6}\.[A-Z2-7]{12}$`;
  - `parseScanCode` round-trips;
  - `verifyScanCode` fails for a changed number, a changed MAC, a different pass id, or a different secret;
  - the comparison uses `timingSafeEqual`.
- [ ] T047 [US6] Extend tests/integration/pass.test.ts. It covers:
  - `GET /api/pass/code.svg` with a pass cookie returns `200 image/svg+xml` and `Cache-Control: private, no-store`, and without a cookie returns `401`;
  - `GET /api/crew/passes/scan?code=` with crew returns the pass with `entryId`;
  - a tampered MAC returns `400 bad_scan_code`;
  - garbage returns `400`;
  - a rehearsal code while live is active returns `409 wrong_realm`;
  - an unknown number with a valid format returns `400 bad_scan_code`;
  - a pass cookie on the scan endpoint returns `401 not_crew`;
  - a pass cookie with one character changed gets `401 no_pass` from `GET /api/me`, and `POST /api/pass` then issues a **new** pass (FR-128);
  - the pass cookie is `HttpOnly` and `SameSite=Lax` (and `Secure` when `NODE_ENV=production`).

### Implementation for User Story 6

- [ ] T048 [US6] Create src/server/services/scanCode.ts, per research §4:
  - `encodeScanCode(pass, secret)` returns `NP1.{L|R}.{number}.{mac}`, where mac is the first 12 characters of the base32 (RFC 4648, no padding) of `HMAC-SHA256(secret, "pass-scan:" + pass.id)`;
  - `parseScanCode(code)`;
  - `verifyScanCode(pass, mac, secret)` compares with `crypto.timingSafeEqual`.

  It uses `config().SESSION_SECRET`.
- [ ] T049 [US6] Add `GET /api/pass/code.svg` (`requirePass`) to src/server/routes/pass.ts. It renders the scan code with `QRCode.toString(code, { type: "svg", margin: 4, errorCorrectionLevel: "M", color: { dark: "#0A0E1A", light: "#FFFFFF" } })` and sets `Cache-Control: private, no-store`.
- [ ] T050 [US6] Add `GET /api/crew/passes/scan` (`requireCrew`, `scanQuery`) to src/server/routes/crew/passes.ts:
  - parse the code;
  - a realm letter that doesn't match `req.realm` returns `409 wrong_realm` ("That code is from rehearsal mode" or "That code is from the live event");
  - look up the pass by `(realm, number)`, left-joined to `entry_passes` like `searchPasses` in src/server/services/passes.ts;
  - a missing pass or failed MAC check returns `400 bad_scan_code` ("Not a Night Pass code");
  - return `{ pass: { id, number, nickname, origin, entryId } }`.
- [ ] T051 [P] [US6] Create src/lib/scanner.ts with `startScan(video: HTMLVideoElement, onCode: (text) => void): () => void`:
  - `getUserMedia({ video: { facingMode: "environment" }, audio: false })`;
  - use `BarcodeDetector` with `formats: ["qr_code"]` when it exists; otherwise `await import("jsqr")` and decode frames from an offscreen canvas capped at 640 px wide, at about 6 fps;
  - stop all tracks on success or cleanup;
  - never upload or store frames;
  - throw a typed error for `NotAllowedError` and `NotFoundError`.
- [ ] T052 [US6] Create src/components/ScanPassButton.tsx. A "Scan pass" button (≥ 44 px) opens an accessible dialog (reuse the ConfirmDialog patterns) with a live `<video playsInline muted>` and a Cancel button.
  - On a decode it calls `GET /api/crew/passes/scan`, then calls `onPick(hit)` and closes.
  - On `bad_scan_code` or `wrong_realm` it shows the message and keeps scanning.
  - When the camera is denied or unavailable, it shows "Allow camera access in Settings → Safari → Camera (iPhone) or the site settings in Chrome (Android), or search by nickname instead".
- [ ] T053 [US6] Add `ScanPassButton` above the search input in src/app/crew/PassPicker.tsx. It applies the same `allowEntered` rule as search hits: an already-entered pass shows the "already entered" message and isn't picked. It's used by src/app/crew/entries/page.tsx (repeatable for group costumes) and src/app/crew/assist/page.tsx.
- [ ] T054 [US6] Turn src/components/PassBadge.tsx (+ PassBadge.module.css) into a flip card:
  - The root is a `<button type="button" aria-pressed={flipped}>` labelled "Show my pass code" or "Show my pass", covering the whole pass.
  - The inner wrapper has `transform-style: preserve-3d` and a `rotateY(180deg)` transition over 450 ms.
  - The front is the current badge, with the pass number still shown.
  - The back has a white panel with `<img src="/api/pass/code.svg" alt="QR code for crew to scan" width=240 height=240>`, the nickname and number in text, and "Show this to crew to enter the costume contest".
  - The `<img>` is rendered on mount (the back is hidden by `backface-visibility`), so it's loaded before the first flip and works offline.
  - Under `prefers-reduced-motion: reduce`, `transition: none`.
  - The focus ring is visible.
- [ ] T055 [US6] Extend tests/e2e/student.spec.ts:
  - tap the pass, and the QR image is visible and `naturalWidth > 0`;
  - go offline (`context.setOffline(true)`) and tap twice, and it still flips with the image present;
  - set `localStorage`/`sessionStorage` keys and reload, and the same nickname and number are shown (FR-128);
  - reduced motion: the flip shows the back with no running animations.

  Run `npm test`, `npm run test:integration`, and `npm run test:e2e`, then commit `feat: flip-to-QR Night Pass and crew scan to register (FR-123–FR-128)`.

**Checkpoint**: US6 works alone. **Deploy.** Test scanning on one real iPhone and one Android crew
phone (quickstart scenario 5).

---

## Phase 8: User Story 5 - Contestant sees their own costume (Priority: P3)

**Goal**: a contestant's pass shows their photo and title, and their place after the reveal. It never
shows counts.

**Independent Test**: link a pass to an entry and open the pass, and the card appears. Reveal 2nd
place with that entry, and it shows "You placed 2nd". Remove the entry, and the card disappears
within 5 s.

### Tests for User Story 5 ⚠️

- [ ] T056 [US5] Add a `describe("own entry")` block to tests/integration/pass.test.ts. It covers:
  - `GET /api/me` for a linked pass returns `ownEntry` (an EntryCard with `costumeTitle`) and `ownPlace: null` before the reveal;
  - the JSON contains no `votes` or count field in any stage;
  - after the reveal reaches that entry's place, `ownPlace` is `{ place, tied }`;
  - while `revealStep` hasn't reached that place yet (for example only 3rd is revealed and the entry is 1st), it is still `null`;
  - after the entry is removed, `ownEntry` is `null`;
  - for an unlinked pass, both are `null`.

### Implementation for User Story 5

- [ ] T057 [US5] Add `revealedPlaceFor(realm, entryId)` to src/server/services/ranking.ts, derived from `publicResults(realm)` (only revealed places, so the rules are identical). In src/server/routes/pass.ts, `GET /api/me` fills `ownEntry` through `getEntryCard` (or `null` if removed) and `ownPlace` through `revealedPlaceFor`.
- [ ] T058 [P] [US5] Create src/components/YourCostume.tsx (+ .module.css). It shows the thumbnail photo (alt from the card), the `EntryLabel`, and "You're in the costume contest!". When `ownPlace` is set, it adds "You placed {PLACE_LABELS[place]}!" or "Tied for {PLACE_LABELS[place]}!", with a celebratory style that is static under reduced motion. It never renders numbers of votes.
- [ ] T059 [US5] In src/app/page.tsx, fetch `/api/me` when the pass is present, keyed on `state.version` and `state.entriesVersion` (refetch when either changes; no new poll), and render `<YourCostume>` under the pass when `me.ownEntry` is set. Run the tests and commit `feat: contestants see their own costume and placing on their pass (FR-121–FR-122)`.

**Checkpoint**: all six stories work. **Deploy.**

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T060 [P] Update CLAUDE.md:
  - change "crew can't type contestant names either" to "crew may type a short costume title, but never a person's name";
  - add `npm run brand:assets` to the command list;
  - note that a pass has at most one `counted` vote, and that changes mark the old row `replaced`.
- [ ] T061 [P] Update README.md (commands and features) and specs/001-costume-contest/spec.md. In the 001 spec, add a one-line note at the top of the FR-011, FR-012, FR-016, and FR-042 entries: "Superseded by specs/002-contest-polish (see its Changes to 001 table)".
- [ ] T062 [P] Extend scripts/load-test.ts with a scenario where 10% of voters call `PUT /api/votes/mine` once. Run `LOAD_BASE_URL=<prod> npm run test:load` against production after the final deploy, and confirm p95 < 300 ms with 0 errors.
- [ ] T063 Run the full suite (`npm run typecheck && npm run lint && npm test && npm run test:integration && npm run test:e2e`) and deploy the final build with GitHub → Actions → *Deploy*.
- [ ] T064 Run the production rehearsal (001 T087), including quickstart.md scenarios 1–7 in rehearsal mode on production. Record the results in specs/001-costume-contest/checklists/rehearsal.md, wipe the rehearsal data, and confirm no rehearsal records remain. This must be done before 2026-10-30 18:30.
- [ ] T065 [P] If RIZN supply licensed Cubano, Asket Condensed, or Kuhlman files before the event, add them under src/fonts/ and switch the matching slot in src/app/layout.tsx to `next/font/local`. Rerun the a11y e2e suite, and redeploy before the rehearsal.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none. T002 and T003 are needed only by US4. T001 is needed only by US6.
- **Foundational (Phase 2)**: depends on T001 (lockfile). It **blocks every story**.
- **US1 (Phase 3)** and **US2 (Phase 4)**: both depend only on Phase 2. They touch some of the same
  files (VoteConfirm.tsx, contest/page.tsx, crew/assist/page.tsx), so run them in sequence.
- **US3 (Phase 5)**: depends only on Phase 2 and is independent of US1 and US2.
- **US4 (Phase 6)**: depends on Phase 2 and Setup T002–T003. It restyles screens touched by other
  stories, so run it after them to avoid merge churn.
- **US6 (Phase 7)**: depends on Phase 2 and T001. PassBadge restyling (T042) should land first.
- **US5 (Phase 8)**: depends on Phase 2. It reuses `EntryLabel` (T009) and the ranking service.
- **Polish (Phase 9)**: after the last story that will ship. T064 is always last.

### Story dependency graph

```text
Setup ─┐
       ├─► Foundational ─┬─► US1 ─► US2 ─┬─► US4 ─► US6 ─► US5 ─► Polish (T064 rehearsal last)
       │                 └─► US3 ────────┘
```

### Within each story

The tests come first and must fail. Then services, then routes, then UI. Commit at each story
checkpoint, per CLAUDE.md "commit early and often".

## Parallel Opportunities

- **Phase 1**: T002 runs alongside T001.
- **Phase 2**: T006, T007, and T009 run in parallel after T004 and T005.
- **US1**: T014 and T017 run in parallel once T012 and T013 are done.
- **US2**: T024 and T025 run in parallel.
- **US3**: T027, T028, and T031 run in parallel. US3 as a whole can run in parallel with US1 and US2,
  since it touches different files.
- **US4**: T037, T040, T041, and T044 run in parallel.
- **US6**: T046 and T051 run in parallel. The server tasks T048–T050 run in parallel with the client
  tasks T051 and T054.
- **Polish**: T060, T061, T062, and T065 run in parallel.

### Example: US3 alongside US1

```text
Developer A: T011 → T012 → T013 → … (US1)
Developer B: T027 + T028 + T031 → T029 → T030 → T032 → T033 → T034 → T035 (US3)
```

## Implementation Strategy

### MVP (ship first)

Ship Phases 1–2, then **US1 and US2**. That covers the two requests from the contest team that change
how the contest runs. Deploy, then smoke-test on production in rehearsal mode.

### Incremental delivery (the event is three days out)

1. Ship US1 and US2. Deploy.
2. Ship US3 (countdown). Deploy.
3. Ship US4 (look). Deploy, and get RIZN sign-off.
4. Ship US6 (flip and scan). Deploy, and test on real crew phones.
5. Ship US5 (your costume card). Deploy.
6. T063 and T064: final suite, final deploy, and the production rehearsal.

If time runs short, drop US5 first, then US6, then US4. **Never skip T064.** Freeze deploys after the
rehearsal, because a deploy restarts the app.

## Notes

- Every new mutation carries an `Idempotency-Key` (CLAUDE.md).
- `/api/state` must still not touch the database. `votingClosesAt` comes from the cached contest row.
- No student-entered text anywhere. The costume title is crew-only.
- No new origin: the fonts come through `next/font`, jsQR through the bundle, and the QR codes are
  drawn server-side.
- Stage changes still come only from crew actions. The close time is display-only.
