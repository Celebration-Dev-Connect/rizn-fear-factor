# Feature Specification: First Names and RIZN Youth Info

**Feature Branch**: `main` (spec directory `specs/003-names-and-rizn-info`)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Add a spot for crew to change a contestant's generated nickname to
their real name. It's optional, so leaders could make it say 'Ben dressed as Superman', and it's no
big deal if they don't get to it. Also add a 'More info about RIZN Youth' page: RIZN meets every
Friday 7:00–9:30pm, and next week is VANAGEDDON, when students destroy the minivan from the
halftime game with spray paint, golf clubs, and baseball bats. Include a photo of the van."

This builds on `specs/001-costume-contest` and `specs/002-contest-polish`. It depends on
constitution **v2.0.0**, which allows an optional crew-entered first name with consent (Principle I
and its child-safety review).

## Clarifications

### Session 2026-10-28

- Q: Where should a contestant's first name show? → A: Everywhere the entry appears: student
  phones, the big screen, results, and crew screens, in place of the nickname.
- Q: Where should the RIZN Youth page be linked? → A: From the Night Pass page, from the "event has
  ended" screen, and on the big screen after the reveal.
- Q: Is there a photo of the van? → A: Yes, it will be added to the media bundle. Build with a
  placeholder until it arrives.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crew add a contestant's first name (Priority: P1)

While adding or editing a costume entry, a crew member can type each contestant's first name.
Everywhere the entry appears it then reads "**Ben** *as* **SUPERMAN**" instead of "Midnight
Gremlin as SUPERMAN". The field is optional; an entry without a name keeps the nickname.

**Why this priority**: Leaders asked for it, and it makes the reveal personal. The contest still
works without it.

**Independent Test**: Add an entry with the first name "Ben" and the title "Superman". The
gallery, big screen, vote confirmation, results, and the contestant's own pass all show "Ben as
SUPERMAN". Clear the name and every screen goes back to the nickname within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a crew member adding an entry, **When** they type "Ben" as the first name and save,
   **Then** every screen shows "Ben" where the nickname was.
2. **Given** a group entry, **When** only one contestant has a first name, **Then** it reads
   "Ben & Hollow Bat as THE GHOSTBUSTERS".
3. **Given** a crew member types "Ben Smith", "B.", a phone number, or more than 20 characters,
   **When** they save, **Then** it is refused with "First name only".
4. **Given** an entry with first names, **When** crew remove the entry, **Then** those passes'
   first names are deleted too.
5. **Given** any student screen, **When** a student looks for a place to type, **Then** there is
   still none: only crew can enter a name.
6. **Given** the consent checkbox, **When** a crew member adds an entry, **Then** it covers the
   photo and the first name.

---

### User Story 2 - "More about RIZN Youth" page (Priority: P1)

Anyone with the link can open a page that thanks students for coming to Fear Factor, explains
RIZN Youth (every Friday 7:00–9:30pm with worship, a message, connection, and an afterparty), and
announces next week's VANAGEDDON with a photo of the van.

**Why this priority**: It turns a one-night event into an invitation back, which is the point of
the night for RIZN.

**Independent Test**: Open `/rizn` on a phone with no pass, before, during, and after the event
window. The page loads every time, and the van section appears. Tap "More about RIZN Youth" on the
Night Pass and on the "event has ended" screen, and both open it. After 1st place is revealed, the
big screen shows a "Next Friday: VANAGEDDON" panel with a QR code that opens the page.

**Acceptance Scenarios**:

1. **Given** anyone, with or without a pass, at any time, **When** they open `/rizn`, **Then** the
   page loads with the RIZN Youth and VANAGEDDON sections.
2. **Given** a student on the Night Pass page, **When** they tap "More about RIZN Youth", **Then**
   the page opens.
3. **Given** the event has ended, **When** a student opens the link, **Then** the "event has ended"
   screen shows next week's headline and links to the page.
4. **Given** the reveal has reached 1st place, **When** the big screen is shown, **Then** it shows
   a "Next Friday: VANAGEDDON" panel with a QR code to `/rizn`.
5. **Given** no van photo has been supplied yet, **When** the page loads, **Then** the section shows
   text only, with no broken image.

### Edge Cases

- **Name on a pass in two realms**: names live on the pass, so a rehearsal name never shows in live,
  and the rehearsal wipe deletes it.
- **Pass found by name**: crew search matches first names as well as nicknames and numbers.
- **Name and title both empty**: the entry shows the nickname, as in 001.
- **Name typed into the costume field**: the costume field still says "no real names"; names
  belong in the first-name field.
- **Vote log and audit**: the vote log identifies passes by nickname and number. Audit events
  record *that* a first name was set or cleared, never the name itself.
- **Info page and privacy**: it holds no student data, sets no cookies, and is excluded from search
  engines like the rest of the app. It has its own share card.

## Requirements *(mandatory)*

### Functional Requirements

**First names (constitution v2.0.0, Principle I)**

- **FR-201**: Crew MUST be able to set, change, or clear an optional first name for each pass
  linked to an entry, when creating or editing that entry.
- **FR-202**: A first name MUST be a single given name: 1–20 characters, letters with optional
  internal hyphens or apostrophes (for example "Mary-Kate", "D'Andre"), and no spaces, digits, or
  other symbols. Anything else MUST be refused with a "First name only" message.
- **FR-203**: Wherever an entry is identified (the same places as 002 FR-108, including alt text
  and the contestant's own card), each linked pass MUST show its first name if set, otherwise its
  nickname.
- **FR-204**: First names MUST be entered only on crew screens. Students MUST NOT be able to enter
  or change a name.
- **FR-205**: Removing an entry MUST clear the first names of its passes. First names MUST be
  deleted with passes under the deletion procedure and the rehearsal wipe.
- **FR-206**: The consent confirmation MUST state that the student and a parent agree to the photo
  and, if entered, the first name being shown.
- **FR-207**: Audit events MUST record that a first name was set or cleared for a pass, but MUST NOT
  store the name.
- **FR-208**: Crew pass search MUST also match first names.

**RIZN Youth page**

- **FR-209**: The app MUST serve a public `/rizn` page with no pass, cookie, or event-window
  requirement. It covers the thank-you, the weekly RIZN Youth details, and a "Next week:
  VANAGEDDON" section.
- **FR-210**: The page content MUST live in one editable content file, so organizers can change the
  wording without touching layout code.
- **FR-211**: The VANAGEDDON section MUST show the van photo when it has been supplied, and text
  only otherwise. The page has no decorative stickers.
- **FR-212**: The Night Pass page and the "event has ended" screen MUST link to `/rizn`.
- **FR-213**: Once the reveal has reached 1st place, the big screen MUST show a "Next Friday:
  VANAGEDDON" panel with a QR code to `/rizn`.
- **FR-214**: The page MUST meet the same accessibility, same-origin, and brand requirements as the
  rest of the app, and have its own share-card title and description.

### Key Entities

- **Night Pass** (changed): adds an optional first name, set by crew, 1–20 letters.
- **RIZN info content**: static text and an optional photo, with no student data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-201**: Adding a first name adds no more than 5 seconds to a costume entry.
- **SC-202**: In tests, 100% of non-first-name inputs (full names, digits, symbols, over 20
  characters) are refused.
- **SC-203**: After the deletion procedure or rehearsal wipe, zero first names remain in stored
  data, including audit records.
- **SC-204**: `/rizn` loads with no pass, at any time, and passes the automated accessibility
  checks.

## Assumptions

- "Next week" is Friday, November 6, 2026, 7:00–9:30pm, at the usual RIZN Youth time.
- The VANAGEDDON wording comes from the leaders' message. Organizers can edit it in the content file.
- The van photo is added to `media-bundle/` and run through `npm run brand:assets`. Until then the
  section uses the collage stickers.
- First names are optional and can be left blank for any student who or whose parent prefers not.
