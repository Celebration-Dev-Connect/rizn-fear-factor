# Feature Specification: Costume Contest

**Feature Branch**: `001-costume-contest`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Build the costume contest for RIZN Fear Factor, the annual Halloween
event run by RIZN Youth at Celebration Church in Edmonton for students in grades 7-12. It runs
Friday, October 30, 2026, 7:00-10:00pm, with roughly 150-400 students in costume. [...] This app
replaces a show of hands or paper ballots." (full description in the `/speckit-specify` request)

## Clarifications

### Session 2026-10-20

- Q: When rehearsal mode is on, should it ignore the event window so the crew can create passes
  and practice before doors open? → A: Yes. Rehearsal mode ignores the event window; rehearsal
  passes can be created and used any time while it is on.
- Q: Should every pass get a nickname no one else has, or can nicknames repeat? → A: Every live
  pass gets a unique nickname; the pass number is secondary.
- Q: What should count as a suspicious cluster of votes for the vote log to flag? → A: No
  automatic flag; crew sort the vote log by pass creation time and judge for themselves.
- Q: Should everyone holding the crew passcode be able to do everything? → A: Yes. One shared
  crew passcode with full access; there is no separate lead role.
- Q: If the app goes down during the event, how should the contest continue? → A: No app support
  for a fallback; crew improvise a show of hands if needed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student gets a Night Pass (Priority: P1)

A student scans the poster QR code (or types the short address) and immediately sees a Night Pass:
a conference-badge-style screen with a generated spooky nickname (for example "Midnight Gremlin")
and a pass number. Nothing is typed. When the student closes and reopens the link on the same
phone, the same pass comes back.

**Why this priority**: The pass is the student's identity for everything else: voting,
self-vote prevention, and every future feature. Without it nothing else works.

**Independent Test**: Open the link on a fresh phone, confirm a pass appears with no input, close
the browser, reopen the link, and confirm the same nickname and number are shown.

**Acceptance Scenarios**:

1. **Given** a phone that has never visited, **When** the student opens the link, **Then** a new
   pass with a nickname from the curated list and a unique pass number is shown without any
   input or sign-up step.
2. **Given** a phone that already has a pass, **When** the student reopens the link, **Then** the
   same pass is shown and no new pass is created.
3. **Given** a student on the pass screen, **When** they look for a place to type or upload,
   **Then** there is none.

---

### User Story 2 - Student votes for one costume (Priority: P1)

From the pass, the student opens the costume contest and browses a gallery of costume photos,
each labeled with the contestant's nickname. When voting is open, the student picks a costume,
confirms, and the vote is cast. The student sees a thank-you state and can no longer vote,
even after reloading, going back, or reopening the link.

**Why this priority**: Collecting one fair vote per student is the reason this app exists.

**Independent Test**: With entries present and voting open, cast a vote from a pass, then try
reloading, using the back button, and resubmitting; confirm exactly one vote is recorded.

**Acceptance Scenarios**:

1. **Given** voting is open and the student has not voted, **When** they select a costume and
   confirm, **Then** one vote is recorded and the thank-you state is shown.
2. **Given** the student has voted, **When** they reload, go back, reopen the link, or resend the
   request, **Then** no further vote is recorded and the thank-you state is shown.
3. **Given** the student's pass is linked to a costume entry, **When** they view the gallery,
   **Then** their own costume cannot be selected and the screen says why.
4. **Given** voting is not open, **When** the student views the gallery, **Then** they can browse
   photos but cannot vote, and the screen shows the current stage (for example "Voting opens
   soon" or "Voting is closed").
5. **Given** any stage before results are revealed, **When** the student views the gallery,
   **Then** no per-costume vote counts or rankings are shown.

---

### User Story 3 - Crew adds costume entries (Priority: P1)

A crew member signs in with the shared crew passcode. A student shows their Night Pass; the crew
member finds the pass by nickname or pass number, takes a photo with the device camera, confirms
that the student and a parent consent to the photo being shown, and saves. The entry appears in
the gallery and on the big screen. A student without a phone can still be entered.

**Why this priority**: There is no contest without entries, and entry speed sets the pace of the
night.

**Independent Test**: Sign in as crew, look up a pass, take a photo, tick consent, save, and
confirm the entry appears in the student gallery and big-screen rotation within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a signed-in crew member and a student's pass, **When** they search by nickname or
   pass number, **Then** matching passes are listed and one can be selected.
2. **Given** a selected pass and a photo, **When** consent is not confirmed, **Then** the entry
   cannot be saved.
3. **Given** a selected pass, a photo, and confirmed consent, **When** the crew member saves,
   **Then** the entry is created once, even if the save is retried on a bad connection.
4. **Given** a student without a phone, **When** the crew member adds them, **Then** a
   crew-created pass with a generated nickname is made for them and the entry uses it; there is
   no field to type a name (see FR-016).
5. **Given** an existing entry, **When** a crew member edits its photo or linked passes or removes it,
   **Then** the change is reflected everywhere and recorded in the audit log.
6. **Given** voting is open and an entry with votes is removed, **When** the removal is saved,
   **Then** the votes for that entry are released and those students can vote again.

---

### User Story 4 - Crew controls the contest stages (Priority: P1)

Crew move the contest through its stages, setup (entries open) → voting open → voting closed →
results revealed, with a deliberate button press for each change. Any change can be undone. The
crew dashboard shows live totals of passes created and votes cast, but not per-costume counts.

**Why this priority**: The crew must decide when voting starts and stops, live, as the program
runs; timers or automatic transitions would break the event.

**Independent Test**: Step through every stage forward and back from the crew screen and confirm
student phones and the big screen follow each change within 5 seconds and nothing changes on
its own.

**Acceptance Scenarios**:

1. **Given** any stage, **When** a crew member presses the next-stage button and confirms,
   **Then** the stage advances and student phones and the big screen update within 5 seconds.
2. **Given** any stage after setup, **When** a crew member presses undo and confirms, **Then** the
   contest returns to the previous stage with all votes and entries intact.
3. **Given** no crew action, **When** any amount of time passes, **Then** the stage does not change.
4. **Given** the crew dashboard, **When** passes are created and votes cast, **Then** the totals
   update and no per-costume counts are shown on the dashboard.

---

### User Story 5 - Big screen shows the contest (Priority: P2)

A projector or TV shows a read-only screen. During setup and voting it rotates through costume
photos with nicknames, shows a how-to-join QR code with short instructions, and shows a live
"votes cast out of passes created" count.

**Why this priority**: It drives participation and lets the whole room follow along, but the
contest can technically run without it.

**Independent Test**: Open the big-screen view, add an entry and cast a vote from other devices,
and confirm the screen shows them within 5 seconds.

**Acceptance Scenarios**:

1. **Given** setup or voting stages, **When** the big screen is open, **Then** it rotates photos
   with nicknames, shows the join QR code and instructions, and shows votes cast out of passes
   created.
2. **Given** the big screen, **When** someone interacts with it, **Then** nothing about the contest
   can be changed from it.

---

### User Story 6 - Crew runs the results reveal (Priority: P2)

After voting closes, crew see the full ranking privately first, including any shared places,
then reveal 3rd, 2nd, and 1st place one at a time on the big screen with photos, nicknames, and a
celebratory animation. Tied costumes share a place.

**Why this priority**: This is the payoff moment of the contest; it depends on stories 2–5.

**Independent Test**: With votes cast and voting closed, open the private ranking, confirm a tie is shown
as a shared place, reveal each place in turn, and confirm the big screen and student phones show only what has been
revealed.

**Acceptance Scenarios**:

1. **Given** voting is closed, **When** a crew member opens results, **Then** the full ranking with
   counts is shown on the crew device only.
2. **Given** two or more entries have the same vote total within the top three places, **When**
   crew view the ranking, **Then** they are shown as sharing that place, and the reveal step for
   that place shows all of them marked as tied (see FR-030).
3. **Given** the private ranking, **When** crew reveal 3rd, then 2nd, then 1st, **Then** each place
   appears on the big screen only after its own button press, with an animation that respects
   reduced-motion settings.
4. **Given** results are revealed, **When** students open the contest, **Then** they see the
   winners.

---

### User Story 7 - Crew reviews and voids suspicious votes (Priority: P3)

Crew review a log of votes (time, voting pass, pass creation time, chosen entry), sort it by
pass creation time to spot patterns such as many passes created seconds apart that all voted for
the same costume, and void the ones they judge suspicious. The system does not flag votes
automatically.

**Why this priority**: Protects fairness against the most likely abuse, but the contest can run
without it.

**Independent Test**: Create several passes in quick succession, vote from each, open the log,
sort by pass creation time and confirm they appear together, void them, and confirm counts drop and the voids are logged.

**Acceptance Scenarios**:

1. **Given** votes exist, **When** crew open the vote log, **Then** each vote shows when it was cast,
   the pass, when the pass was created, and the entry chosen.
2. **Given** votes from passes created at different times, **When** crew sort the log by pass
   creation time, **Then** votes appear in that order with creation times shown, so passes
   created close together sit next to each other.
3. **Given** a vote, **When** crew void it, **Then** it no longer counts, remains in the log marked
   void with who/when, and can be restored.

---

### User Story 8 - Crew-assisted voting for students without phones (Priority: P3)

A student without a phone asks a crew member for help. The crew member uses that student's
crew-created pass (or creates one) on the crew device and the student picks their costume there.
The vote is marked as crew-assisted in the log.

**Why this priority**: Inclusion matters, but it serves a small number of students.

**Independent Test**: From a crew device during voting, start an assisted vote, cast it, and
confirm it counts once and is marked crew-assisted.

**Acceptance Scenarios**:

1. **Given** voting is open, **When** a crew member starts an assisted vote, **Then** they can pick
   the student's existing crew-created pass or create a new one, and one vote can be cast with it.
2. **Given** a crew-created pass linked to an entry, **When** an assisted vote is started with it,
   **Then** that entry cannot be selected.
3. **Given** an assisted vote is cast, **When** crew view the log, **Then** it is marked
   crew-assisted with the crew device and time.

---

### User Story 9 - Rehearsal mode (Priority: P3)

Before doors open, crew turn on rehearsal mode and run the whole flow (passes, entries, stages,
votes, reveal). Everything created is marked as test data, every screen shows a clear
"REHEARSAL" banner, and one wipe action removes all of it, including photos.

**Why this priority**: Required by the constitution for confidence on the night, but not needed
for the contest logic itself.

**Independent Test**: Turn on rehearsal, run a full contest, wipe, and confirm no rehearsal
passes, entries, votes, or photos remain and the contest is back at setup.

**Acceptance Scenarios**:

1. **Given** rehearsal mode is on, **When** any screen is viewed, **Then** a "REHEARSAL" banner is
   visible on it.
2. **Given** rehearsal data exists, **When** crew wipe it and confirm, **Then** all rehearsal passes,
   entries, votes, photos, and stage history are removed and live data is untouched.
3. **Given** a phone that held a rehearsal pass, **When** it reopens the link after the wipe,
   **Then** it gets a new live pass.

---

### Edge Cases

- **Cleared cookies / private browsing**: a phone that loses its pass gets a new one and could
  vote again. This cannot be fully prevented without collecting identifiers; it is mitigated by
  the vote log, sorting by pass creation time, and voiding (Story 7).
- **Double-tap or retry on vote**: two submissions from one pass record exactly one vote.
- **Voting closes mid-vote**: a vote submitted after the stage changed is rejected and the student
  is told voting has closed.
- **Entry removed after voting**: if voting is still open, released voters see the gallery again
  and can re-vote; if voting is closed, the votes are released but cannot be recast.
- **Stage undone from voting open to setup**: existing votes are kept, not deleted.
- **Undo after reveal**: returning from results revealed to voting closed hides the results on
  the big screen and student phones again; crew must confirm.
- **Fewer than three places**: if fewer than three distinct vote totals exist, the reveal shows
  only the places that exist and skips the rest.
- **Large tie**: many entries can share a place (for example five costumes tied for 3rd); all are
  shown in that reveal step, and crew see this in the private ranking before revealing.
- **Event window**: a student opening the link before the configured start sees "doors open at
  [time]" and gets no pass; after the configured end, existing passes stop working and no photos
  are shown. Organizers can adjust the times if the event runs early or late.
- **Contestant without a phone later borrows one**: their crew-created pass lives only on crew
  devices; they cannot claim it on another phone, and must vote with crew assistance.
- **Zero votes for every entry**: the crew ranking says so and the reveal cannot start.
- **Group costumes**: one entry can be linked to several passes; none of them can vote for it.
- **A pass already linked to an entry**: adding it to a second entry is blocked with a message.
- **Two crew members act at once**: stage changes apply in order and the losing device sees the
  current stage rather than an error loop.
- **Big screen loses network**: it keeps showing the last known state and catches up on reconnect.
- **Camera permission denied on crew device**: the crew member is told how to allow it and can
  choose an existing photo from the device instead.
- **Wrong crew passcode**: repeated failures are slowed down.
- **Photo request without a valid pass or crew session**: refused.
- **After the deletion date**: photos are gone; anyone opening the link sees that the event has
  ended.

## Requirements *(mandatory)*

### Functional Requirements

**Night Pass**

- **FR-001**: System MUST create a Night Pass on a student's first visit with no input from the
  student, and MUST NOT ask for a name, email, phone number, or any other personal identifier.
- **FR-002**: Each pass MUST have a nickname drawn from a curated, crew-reviewed list and a
  unique pass number. Live passes MUST NOT share a nickname; rehearsal passes are checked
  against each other separately and do not use up live nicknames.
- **FR-003**: Students MUST NOT be able to edit their nickname, enter free text, or upload files.
- **FR-004**: System MUST remember the pass on that phone using a first-party cookie only, so
  reopening the link shows the same pass.
- **FR-005**: The pass MUST be a stand-alone record that contest data references, so future
  features can attach to it without changing it.
- **FR-006**: Passes MUST only be issued and usable during an event window whose exact start and
  end times (to the minute, Edmonton time) are configured by the organizers. Before the start,
  the link MUST show a "doors open at [time]" screen and issue no pass. After the end, passes MUST
  stop working, and the link MUST show an "event has ended" screen with no photos. Crew access is
  not limited by the window. While rehearsal mode is on, the window does not apply (see FR-036).

**Gallery and voting**

- **FR-007**: Pass holders MUST be able to view a gallery of all current entries with photo and
  nickname, in every stage.
- **FR-008**: System MUST accept votes only while the contest is in the voting-open stage.
- **FR-009**: System MUST enforce one counted vote per pass on the server; repeated or duplicate
  submissions MUST NOT create additional votes.
- **FR-010**: System MUST reject a vote for an entry linked to the voting pass.
- **FR-011**: Students MUST confirm their choice before the vote is cast; once cast, it is final
  and cannot be changed by the student.
- **FR-012**: After voting, the student MUST see a thank-you state showing which costume they
  voted for, and no voting controls.
- **FR-013**: Per-costume vote counts and rankings MUST NOT be visible to students or on the big
  screen before results are revealed.

**Crew access and entries**

- **FR-014**: Crew MUST sign in with a single shared crew passcode set by the organizers, which
  grants every crew capability in this spec; there are no separate roles. Repeated failed attempts
  MUST be slowed down. Outcome-changing actions (stage changes, voids, reveal steps, rehearsal
  wipe) rely on their confirmation step and audit log entry to guard against mistakes.
- **FR-015**: Crew MUST be able to create an entry by selecting one or more passes (searchable by
  nickname or pass number), taking a photo with the device camera, and confirming student and
  parent consent; saving MUST be blocked until consent is confirmed.
- **FR-016**: Crew MUST be able to create a crew-created pass for a student without a phone; it
  gets a generated nickname like any other pass and is marked crew-created. Crew MUST NOT be able
  to type a free-text name or label for any contestant.
- **FR-017**: Photos MUST be resized before upload, and entry saves MUST be safe to retry without
  creating duplicates.
- **FR-018**: Crew MUST be able to edit an entry's photo or linked passes, and remove an entry;
  removing an entry MUST delete its photo and release its votes.
- **FR-019**: Released votes MUST allow the affected passes to vote again only while voting is
  open.
- **FR-020**: Crew MUST be able to cast a crew-assisted vote for a student without a phone, using
  that student's existing crew-created pass (found by nickname or pass number) or a new one; the
  vote MUST be marked crew-assisted and is subject to the same one-vote and no-self-vote rules.

**Contest stages**

- **FR-021**: The contest MUST have exactly four stages: setup (entries open), voting open,
  voting closed, results revealed.
- **FR-022**: Stage changes MUST happen only through an explicit crew action with confirmation,
  and MUST NEVER be triggered by a timer.
- **FR-023**: Crew MUST be able to undo any stage change back to the previous stage without
  losing entries or votes.
- **FR-024**: Entries MUST be addable in setup; adding entries during voting open MUST be allowed
  with a warning that earlier voters will not have seen them.
- **FR-025**: Student phones and the big screen MUST reflect a stage change within 5 seconds.

**Crew dashboard, audit, and results**

- **FR-026**: The crew dashboard MUST show live totals of passes created and votes counted, and
  MUST NOT show per-costume counts before voting closes.
- **FR-027**: System MUST record every vote, void, restore, entry change, stage change, reveal
  step, and rehearsal wipe with a timestamp and the crew device or pass involved.
- **FR-028**: Crew MUST be able to view the vote log, sort it by vote time or by pass creation
  time, void votes, and restore voided votes. The system MUST NOT flag or void votes
  automatically; judging what is suspicious is left to crew.
- **FR-029**: After voting closes, crew MUST be able to view the full ranking with counts on the
  crew device only.
- **FR-030**: Tied entries MUST share a place. Places MUST be assigned by distinct counted-vote
  totals (dense ranking): the highest total is 1st, the next-highest is 2nd, the next is 3rd, and
  every entry with that total holds that place. Entries with zero votes MUST NOT place. Shared
  places MUST be flagged in the private ranking before the reveal.
- **FR-031**: Crew MUST reveal 3rd, 2nd, and 1st place one at a time, each by its own action;
  each step MUST show every entry holding that place, and MUST appear on the big screen and
  student phones within 5 seconds.
- **FR-032**: Public results MUST show placings, photos, and nicknames, mark shared places
  (for example "Tied for 2nd"), and MUST NOT show vote counts.

**Big screen**

- **FR-033**: The big-screen view MUST be read-only and MUST be openable without the crew passcode
  only via a crew-provided link, so photos are not exposed to the public internet.
- **FR-034**: During setup and voting it MUST rotate entry photos with nicknames, show a join QR
  code and short instructions, and show votes cast out of passes created.
- **FR-035**: After each reveal step it MUST show the revealed winners with a celebratory
  animation that is replaced by a static presentation when reduced motion is requested.

**Rehearsal**

- **FR-036**: Crew MUST be able to turn rehearsal mode on and off; all data created while it is
  on MUST be marked as test data. While it is on, rehearsal passes MUST be issuable and usable at
  any time, regardless of the event window; turning it off restores the window rule.
- **FR-037**: While rehearsal mode is on, every screen MUST show a visible "REHEARSAL" indicator.
- **FR-038**: A single confirmed wipe action MUST permanently delete all rehearsal passes,
  entries, votes, photos, and log entries, return the contest to setup, and leave live data
  untouched.

**Privacy, safety, and presentation**

- **FR-039**: Photos MUST be stored privately, MUST NOT be reachable through public URLs, and
  MUST be served only to requests with a valid pass, crew session, or big-screen link.
- **FR-040**: All photos MUST be deleted automatically on 2026-11-02 (three days after the
  event), and all passes, votes, and logs following the documented data-deletion procedure.
- **FR-041**: The app MUST NOT include third-party analytics, ad trackers, or social embeds.
- **FR-042**: Every screen MUST use the RIZN Halloween look (dark purple and pumpkin orange, a
  spooky display font for headings, a readable body font) while meeting WCAG AA contrast,
  44×44 px minimum tap targets, descriptive alt text, no information conveyed by color alone,
  and reduced-motion support.
- **FR-043**: Every student feature MUST work in the default browser on iOS Safari and Android
  Chrome (latest two versions) with no install, account, or login.

### Key Entities

- **Night Pass**: a student's anonymous identity for the night. Nickname, pass number, created
  time, whether it is crew-created, whether it is rehearsal data. Referenced by votes and
  entries; intended to be referenced by future features (teams, points, badges).
- **Costume Entry**: one costume in the contest. Photo, display name (the linked passes'
  nicknames), linked passes (one or more), consent confirmation, created and edited
  times, rehearsal flag.
- **Vote**: one pass's choice of one entry. Pass, entry, cast time, status (counted, voided,
  released), crew-assisted flag, rehearsal flag.
- **Contest**: the single contest for the night. Current stage, reveal progress (none, 3rd, 2nd,
  1st), rehearsal mode on/off, event window start and end.
- **Audit Event**: a timestamped record of any crew action or vote, with the actor (crew device
  or pass) and details.
- **Crew Session**: a signed-in crew device, identified by a device label for the audit log.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can go from scanning the poster to a cast vote in under 60 seconds when
  voting is open.
- **SC-002**: In testing, no single phone can cause more than one counted vote by reloading,
  going back, double-tapping, or resubmitting (0 duplicates across all scripted attempts).
- **SC-003**: A crew member can add a costume entry, from pass lookup to saved, in under 30
  seconds.
- **SC-004**: The big screen and student phones reflect a crew action within 5 seconds.
- **SC-005**: With 400 phones active on one wifi network, students can load the gallery and cast
  a vote without errors or noticeable delay.
- **SC-006**: No student personal identifiers exist anywhere in stored data at any point.
- **SC-007**: No costume photos remain anywhere after 2026-11-02.
- **SC-008**: The crew completes a full rehearsal and wipe before doors open, with zero rehearsal
  records remaining afterward.
- **SC-009**: Crew report the contest ran without falling back to a show of hands or paper.

## Assumptions

- One contest per event; there is no need to run multiple contests or categories.
- Organizers set the crew passcode and share it only with adult crew; individual crew accounts
  are not needed.
- Crew devices are phones or tablets with a working camera and a modern browser.
- Each entry represents one costume; group costumes are a single entry linked to several passes.
- A pass lost through cleared cookies or a private tab is not recoverable; the student gets a
  new one. Abuse via this route is handled through the vote log and voiding.
- Photos are deleted three days after the event (2026-11-02), interpreting "a few days" in line
  with the constitution's retention rule.
- Public results show placings only, not vote counts, to avoid embarrassing contestants.
- Ties use dense ranking (for example 1st, 2nd, 2nd, 3rd), so a tie never removes a lower place;
  this may produce more than three winning costumes.
- The event window defaults to 6:30pm–10:30pm Edmonton time on 2026-10-30 (30 minutes either
  side of the program), adjustable by organizers to the minute. The window controls passes only;
  it never changes contest stages, consistent with constitution Principle VI.
- Undoing a stage keeps all votes and entries; it only changes what is allowed and shown.
- The nickname list is curated and reviewed by RIZN staff before the event, with enough
  combinations for at least 1,000 unique passes (for example about 40 adjectives × 40 nouns);
  if it were ever exhausted, new passes would be refused and crew alerted rather than reusing a
  nickname.
- The big screen is a crew-provided link opened on a church device; it is not linked from
  student screens.
- If the app fails during the event, crew fall back to a show of hands; the app provides no
  printable sheet, offline mode, or other fallback tooling.
- Teams, points, badges, scavenger hunt, leaderboards, friend codes, carnival games, and any
  student-submitted content are out of scope.
