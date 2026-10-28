---

description: "Task list for First Names and RIZN Youth Info"
---

# Tasks: First Names and RIZN Youth Info

**Input**: `specs/003-names-and-rizn-info/` ([plan](./plan.md), [spec](./spec.md), [data model](./data-model.md), [contract](./contracts/api.md))

**Tests**: required for name handling (constitution VII and Principle I v2.0.0).

## Phase 1: Foundational

- [ ] T001 Add `firstName: text("first_name")` (nullable) to `passes` in src/server/db/schema.ts, with check `passes_first_name_len`: `first_name IS NULL OR char_length(first_name) BETWEEN 1 AND 20`. Generate drizzle/0002_first_names.sql (renaming the file and its journal tag) and run `npm run db:migrate`.
- [ ] T002 [P] Add to src/shared/schemas.ts:
  - `firstNameField`: trimmed; `""` becomes null; otherwise must match `/^\p{L}(?:\p{L}|['’-](?=\p{L})){0,19}$/u`, else the message "First name only".
  - `firstNamesField`: a JSON string parsed to `Record<uuid, firstNameField>`.

## Phase 2: User Story 1 - Crew add a contestant's first name (P1)

- [ ] T003 [US1] Add a `describe("first names")` block to tests/integration/entries.test.ts. It covers:
  - creating with `firstNames` shows "Ben" in the card's `displayName` and alt text, and group entries mix names and nicknames;
  - "Ben Smith", "B3n", "B.", and 21 letters are refused with `400`;
  - a name for a pass not in the entry is refused with `400`;
  - a PATCH with `""` clears a name, and passes left out of the PATCH keep theirs;
  - removing the entry clears the names;
  - crew search finds a pass by first name, and the hit carries `firstName`;
  - audit details contain pass ids only, with the name string nowhere in `audit_events`;
  - the rehearsal wipe leaves no first names;
  - a student's `/api/me` `ownEntry.displayName` uses the name.
- [ ] T004 [US1] In src/server/services/entries.ts:
  - `displayNames` uses `coalesce(first_name, nickname)`;
  - `createEntry` and `updateEntry` take `firstNames?: Record<string, string | null>`, check the keys belong to the entry's passes, and update `passes.first_name` in the same transaction;
  - audit records `firstNamesSet` and `firstNamesCleared` pass ids;
  - `removeEntry` clears `first_name` for the entry's passes.
- [ ] T005 [US1] Parse the optional `firstNames` multipart field with `firstNamesField` in src/server/routes/crew/entries.ts and pass it to the service.
- [ ] T006 [P] [US1] In src/server/services/passes.ts and src/server/routes/crew/passes.ts, `searchPasses` also matches `ilike first_name`, and search and scan hits return `firstName`.
- [ ] T007 [US1] In src/app/crew/entries/page.tsx and src/app/crew/PassPicker.tsx:
  - each selected pass gets a "First name (optional)" input (`maxLength` 20, `autoComplete="off"`, hint "First name only — leave blank if they'd rather not"), prefilled from `firstName` when editing;
  - send `firstNames` JSON on save;
  - the consent label becomes "Student and parent agree this photo (and first name, if entered) can be shown tonight";
  - picker hits show the first name when set.
- [ ] T008 [US1] Run the tests and commit `feat: optional crew-entered first names for contestants (FR-201–FR-208)`.

## Phase 3: User Story 2 - "More about RIZN Youth" page (P1)

- [ ] T009 [P] [US2] Create src/content/rizn.ts with the page copy: the thank-you, the weekly RIZN Youth details (Fridays 7:00–9:30pm), and VANAGEDDON on Friday, November 6, 2026, worded from the leaders' message. Create src/content/van.json `{ "photo": false }`.
- [ ] T010 [US2] In scripts/brand-assets.ts, if `media-bundle/van.(jpg|jpeg|png|webp)` exists, write `public/brand/van.webp` (1080 px wide, ≤ 150 KB) and set src/content/van.json `{ "photo": true }`; otherwise set it to `{ "photo": false }`.
- [ ] T011 [US2] Create src/app/rizn/page.tsx (+ page.module.css), a server component with:
  - the logo, the thank-you, a "Every Friday" section, and a "Next Friday: VANAGEDDON" section showing the van photo when `van.json.photo` is true, otherwise a sticker collage panel;
  - the RIZN Youth sign-off and a "Back to my Night Pass" link;
  - page metadata with the title "More about RIZN Youth" and a description;
  - no pass needed. Confirm Express and the security middleware don't gate it.
- [ ] T012 [US2] Support `?to=rizn` in src/server/routes/qr.ts, encoding `PUBLIC_URL + "/rizn"` with a separate cache. Any other value returns the join QR code.
- [ ] T013 [US2] In src/app/page.tsx, add a "More about RIZN Youth" link button under the pass, and on the "event has ended" screen show the VANAGEDDON headline plus the link.
- [ ] T014 [US2] Create src/components/NextWeekPanel.tsx and render it in src/app/screen/page.tsx when the revealed places include 1st place. It shows a "Next Friday: VANAGEDDON" headline, one line, and the `/api/qr.svg?to=rizn` QR code.
- [ ] T015 [US2] E2E in tests/e2e/a11y.spec.ts and student.spec.ts:
  - `/rizn` loads in a fresh context with no pass and passes axe;
  - the pass page link navigates to it.

  Commit `feat: More about RIZN Youth page with next week's VANAGEDDON (FR-209–FR-214)`.

## Phase 4: Polish

- [ ] T016 Update CLAUDE.md (first names allowed, crew-only, single given name; content file location) and README (deletion covers first names; van photo steps). Deploy and smoke-test production.

## Dependencies

T001 and T002 come first, and both stories depend on them. US1 and US2 touch different files except src/app/page.tsx (US2 only), so they can run in parallel. T016 comes last.
