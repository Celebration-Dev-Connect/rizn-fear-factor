# Feature Specification: Contest Night Polish

**Feature Branch**: `main` (spec directory `specs/002-contest-polish`)

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Add a live countdown on the big screen to the crew-set voting close time
(hours and minutes above an hour, minutes and seconds below), with 'Voting closes at [time]' in finer
print under it. Use the RIZN media bundle (logos, fonts, graphic elements) and switch the orange and
purple scheme to the orange and blue from the logos. Let students change their vote while voting is
open (still one vote). Let crew add a short costume title (for example 'Superman') during entry, shown
as '[nickname] as [costume]'. Think about whether students need a pass number, and whether contestants
could see their own costume on their pass."

This feature changes the live costume contest built in `specs/001-costume-contest`. Where this spec
and 001 disagree, this spec wins; the changed 001 requirements are listed under
[Changes to 001](#changes-to-001).

## Clarifications

### Session 2026-10-27

- Q: Should the student's pass still show a pass number? → A: Yes. Tapping the pass flips it over,
  with an animation, to show a QR code for that pass, and crew can scan it to register the student's
  costume. The pass, its number, and its code stay bound to the student's device and cannot be
  changed or moved to another device.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student changes their vote while voting is open (Priority: P1)

A student votes, keeps scrolling, and finds a costume they like more. From the thank-you state
they tap "Change my vote", pick the new costume, confirm, and their vote moves to it. They still
hold exactly one vote. Once the crew closes voting, the choice is locked.

**Why this priority**: The contest team asked for it, and it touches vote counting, which has to
stay correct on the night.

**Independent Test**: With voting open, vote for entry A, change to entry B, then reload and try
to change again by double-tapping and resending. Confirm the pass has exactly one counted vote
(for the last confirmed choice), and that the log shows the earlier choice as replaced.

**Acceptance Scenarios**:

1. **Given** voting is open and the student has voted for entry A, **When** they choose "Change my
   vote", pick entry B, and confirm, **Then** their counted vote is for B, A loses that vote, and
   the thank-you state now names B.
2. **Given** a vote change, **When** crew look at the vote total on the dashboard or big screen,
   **Then** the total of votes cast is unchanged.
3. **Given** a student changing their vote, **When** they reach the confirmation step, **Then** it
   shows both their current choice and the new one, and cancelling leaves their vote as it was.
4. **Given** voting is closed (or results are revealed), **When** the student views the contest,
   **Then** no "Change my vote" control is shown and any change request is refused.
5. **Given** a pass linked to entry C, **When** the student changes their vote, **Then** entry C
   still cannot be selected.
6. **Given** crew voided the student's vote, **When** the student views the contest, **Then** they
   cannot change or recast it.
7. **Given** a vote changed several times, **When** crew view the vote log, **Then** every earlier
   choice appears marked as replaced, with times, and only the latest counts.

---

### User Story 2 - Crew add a costume title (Priority: P1)

While adding an entry, a crew member types a short costume title, such as "Superman" or "The
Ghostbusters". Everywhere the entry appears, it reads as the nickname in small print with "as",
then the costume title in large type, for example *Midnight Gremlin as* **SUPERMAN**. The title is
optional and can be edited later.

**Why this priority**: The contest team asked for it, and it makes the gallery, big screen, and
reveal much easier to follow than nicknames alone.

**Independent Test**: Add an entry with the title "Superman", and confirm the gallery, the
big-screen rotation, the vote confirmation, and the results reveal all show "[nickname] as
Superman". Edit the title, and confirm every screen updates within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a crew member adding an entry, **When** they type a costume title and save, **Then**
   the entry shows "[nickname] as [title]" in the gallery, on the big screen, at vote confirmation,
   and in results.
2. **Given** an entry linked to several passes (a group costume), **When** it is shown, **Then** it
   reads "[nickname] & [nickname] as [title]".
3. **Given** an entry saved without a title, **When** it is shown, **Then** it shows the nickname(s)
   alone, as before this feature.
4. **Given** an existing entry, **When** a crew member edits or clears its title, **Then** the
   change appears everywhere within 5 seconds and is recorded in the audit log.
5. **Given** the title field, **When** a crew member is about to type, **Then** it tells them to
   describe the costume and not to type real names.
6. **Given** a student, **When** they use any screen, **Then** there is still nowhere for them to
   type anything.

---

### User Story 3 - Big-screen countdown to voting close (Priority: P2)

Crew set a "voting closes at" time on the crew dashboard. While voting is open, the big screen
shows a large live countdown to that time. Above one hour it shows hours and minutes (for example
"1h 12m"). Below one hour it shows minutes and seconds, ticking every second (for example
"14:09"). Under it, in smaller print: "Voting closes at 8:45 PM". When the countdown reaches zero,
the screen says voting is closing, and the crew still close voting by hand.

**Why this priority**: It builds urgency and gets more votes in, but the contest runs without it.

**Independent Test**: Set a close time 61 minutes ahead and open voting. Confirm the big screen
shows "1h 01m", switches to "59:59" style after a minute, and ticks each second. Let it reach
zero, and confirm the stage stays at voting open until a crew member closes it.

**Acceptance Scenarios**:

1. **Given** voting is open and a close time is set more than an hour away, **When** the big
   screen is shown, **Then** it displays the remaining hours and minutes, with "Voting closes at
   [time]" under it in smaller print.
2. **Given** less than an hour remains, **When** the big screen is shown, **Then** it displays
   minutes and seconds and updates every second.
3. **Given** the countdown reaches zero while voting is still open, **When** the big screen is
   shown, **Then** it shows a "Voting closes any moment" message instead of negative time, and
   the contest stage does not change.
4. **Given** crew change or clear the close time, **When** the big screen next updates, **Then** it
   reflects the change within 5 seconds (or hides the countdown when cleared).
5. **Given** no close time is set, or the stage is anything other than voting open, **When** the
   big screen is shown, **Then** no countdown appears.
6. **Given** the big-screen device's own clock is several minutes wrong, **When** the countdown is
   shown, **Then** it still matches the real time remaining.

---

### User Story 4 - RIZN Fear Factor look (Priority: P2)

Every screen takes on the official RIZN Fear Factor look from the media bundle: the brand orange
and blue in place of the current purple, the RIZN Fear Factor logo on the landing page, the Night
Pass, and the big screen, the RIZN Youth logo as a sign-off, and the bundle's collage elements
(stars, beetle, halftone horse, clock, and so on) as decorative stickers. Everything ships with the
app; nothing loads from elsewhere.

**Why this priority**: Students should see it is the RIZN event at a glance, and the RIZN team
supplied the artwork. The contest works without it, so it comes after the vote and title changes.

**Independent Test**: Open the landing page, the pass, the gallery, the crew screens, and the big
screen. Confirm they use the orange and blue palette with the logos and stickers, that no purple
remains, that the automated accessibility checks pass, and that the network panel shows no
other-origin requests.

**Acceptance Scenarios**:

1. **Given** any screen, **When** it loads, **Then** its primary colours are the brand orange
   (#F94003) and brand blue (#0069FB) on a dark background, and the previous purple is gone.
2. **Given** the landing page, the Night Pass, and the big screen, **When** they load, **Then**
   the RIZN Fear Factor logo is shown with alt text naming the event.
3. **Given** decorative collage stickers, **When** a screen reader reads the page, **Then** they
   are skipped.
4. **Given** a student on a slow connection, **When** they first open the pass, **Then** the brand
   imagery does not delay the nickname from appearing.
5. **Given** a user who requests reduced motion, **When** any branded screen loads, **Then**
   stickers and logos do not animate.

---

### User Story 5 - A contestant sees their own costume on their pass (Priority: P3)

A student whose pass is linked to an entry sees a "Your costume" card on their Night Pass, with
their photo and costume title and the line "You're in the costume contest!". After results are
revealed, the card says if they placed. They never see vote counts.

**Why this priority**: It gives contestants a reason to have registered with their pass and a
moment of delight, but nothing depends on it.

**Independent Test**: Link a pass to an entry, then open that pass on its phone and confirm the
card shows the photo and title with no vote counts. Reveal results with that entry in 2nd place,
and confirm the card says "You placed 2nd".

**Acceptance Scenarios**:

1. **Given** a pass linked to an entry, **When** the student opens their pass, **Then** they see
   their costume photo, title, and "You're in the costume contest!".
2. **Given** a pass with no entry, **When** the student opens their pass, **Then** no costume card
   is shown.
3. **Given** any stage before results are revealed, **When** a contestant views their card,
   **Then** no vote count, rank, or hint of standing is shown.
4. **Given** results have been revealed up to and including their place, **When** the contestant
   views their card, **Then** it shows their place (for example "You placed 2nd", or "Tied for
   2nd").
5. **Given** crew remove the entry, **When** the contestant next views their pass, **Then** the
   card is gone within 5 seconds.

---

### User Story 6 - Crew scan a pass to register a costume (Priority: P2)

The Night Pass still shows its pass number. Tapping the pass flips it over, with a card-flip
animation, to show a QR code for that pass. The pass, its number, and its code belong to that
phone: the student can't edit them, and they can't be copied to another phone. A crew member adding an entry taps "Scan pass", points the crew device camera
at the student's phone, and the pass is selected straight away, with no typing. Tapping again
flips the pass back.

**Why this priority**: It makes the busiest crew task faster and avoids picking the wrong nickname
in a loud room. Searching by nickname or number still works, so it is not required.

**Independent Test**: On a student phone, tap the pass number and confirm the QR code appears. On
a crew device, start adding an entry, scan it, and confirm that pass is selected. Scan the same
code with an ordinary phone camera while not signed in as crew, and confirm it reveals nothing and
does not give access to the pass.

**Acceptance Scenarios**:

1. **Given** a student on their Night Pass, **When** they tap the pass, **Then** it flips over with
   an animation to show a QR code with the nickname and number still visible, and tapping again
   flips it back.
2. **Given** a crew member adding an entry, **When** they scan a pass's QR code, **Then** that pass
   is selected as if they had searched for it, and the scan can be repeated for group costumes.
3. **Given** a scanned pass that is already linked to an entry, **When** crew scan it, **Then** they
   see the same "already linked" message as when searching.
4. **Given** a QR code from a rehearsal pass, **When** it is scanned while rehearsal mode is off (or
   the other way round), **Then** crew are told it is from the wrong mode and nothing is selected.
5. **Given** anyone who is not signed in as crew, **When** they scan or photograph the QR code,
   **Then** it does not let them view, use, or take over that pass.
6. **Given** a crew device whose camera is unavailable or denied, **When** crew try to scan,
   **Then** they are told how to allow it and can search by nickname or number instead.
7. **Given** a user who requests reduced motion, **When** they flip the pass, **Then** the sides
   swap without a flip animation.

---

### Edge Cases

- **Change and close collide**: a change submitted after crew closed voting is refused, the
  earlier vote stands, and the student is told voting has closed.
- **Double-tap or retry on a change**: repeats of the same change have the same effect as one.
  Two different changes sent close together leave exactly one counted vote, for whichever the
  server accepts last.
- **Change to the same costume**: nothing changes, and nothing extra is logged.
- **Change after entry removal**: a student whose vote was released (FR-018 of 001) votes again as
  a first vote, not a change.
- **Crew restore a voided vote that was changed before the void**: the restored vote is the one
  that was voided. Earlier, replaced choices are never restored.
- **Voting stage undone back to setup**: votes and any changes made so far are kept. Changes are
  not allowed in setup, because voting is not open.
- **Vote changed toward an entry that is later removed**: the vote is released as in 001.
- **Crew-assisted vote**: crew can change it through the same assisted-vote flow while voting is
  open. The change is marked crew-assisted.
- **Costume title too long**: input stops at 40 characters, and all screens fit a 40-character title
  without overflow.
- **Costume title with a real name typed by mistake**: crew can edit or clear it at any time. It is
  deleted with all other event data.
- **Close time set in the past while voting is open**: the big screen shows the "Voting closes any
  moment" message straight away.
- **Close time set while voting is not open**: it is stored and shown on the crew dashboard, and the
  big screen starts the countdown when voting opens.
- **Big screen loses network during the countdown**: it keeps counting down from the last known
  close time and corrects itself when it reconnects.
- **Rehearsal mode**: the close time and costume titles work the same in rehearsal and are wiped
  with rehearsal data. Switching rehearsal off doesn't carry a rehearsal close time into the live
  contest.
- **Student flips the pass while the crew is offline**: the QR code is drawn on the phone, so it
  shows even with no network.
- **Scanned code is not a pass code** (a poster QR code, for example): crew see "Not a Night Pass"
  and nothing is selected.
- **Student edits the cookie or page storage**: a cookie altered by hand is rejected, and the
  phone is treated as new. Nothing kept in page storage can change which pass is shown.
- **Pass from a cleared phone**: if the student lost their pass, their new pass has a new code,
  and the old one no longer matches any live pass.
- **Very small phones**: the "[nickname] as [title]" label wraps rather than truncating the title.

## Requirements *(mandatory)*

### Functional Requirements

**Changing a vote**

- **FR-101**: While the contest is in the voting-open stage, a student who has a counted vote MUST
  be able to change it to a different entry, with a confirmation step that shows both the current
  and the new choice.
- **FR-102**: A pass MUST hold at most one counted vote at all times, including during and after
  a change. This MUST be enforced on the server, and repeated or concurrent change requests MUST
  NOT create extra counted votes.
- **FR-103**: Changes MUST be refused in every stage except voting open, MUST be refused for a
  voided vote, and MUST follow the no-self-vote rule.
- **FR-104**: Each change MUST be recorded. The replaced choice stays in the vote log marked as
  replaced, with the time of the change, and is never counted. A change MUST NOT be counted as an
  additional vote cast in any total.
- **FR-105**: The thank-you state MUST name the current choice and, only while voting is open,
  offer "Change my vote".
- **FR-106**: Crew MUST be able to change a crew-assisted vote through the assisted-vote flow
  under the same rules, and the change MUST be marked crew-assisted in the log.

**Costume title**

- **FR-107**: Crew MUST be able to enter an optional costume title of up to 40 characters, on one
  line, when creating an entry, and to edit or clear it later. The field MUST be visible only on
  crew screens and MUST carry guidance to describe the costume and not type real names.
- **FR-108**: Wherever an entry is identified (student gallery, vote confirmation, thank-you state,
  big-screen rotation, results reveal, public results, crew screens, vote log), it MUST read as the
  linked nickname(s) in smaller type followed by "as" and the title in larger type. With no title,
  the nickname(s) alone are shown.
- **FR-109**: Costume titles MUST be part of each entry's photo alt text, for example "Costume
  photo: Midnight Gremlin as Superman".
- **FR-110**: Title creation, edits, and clearing MUST be recorded in the audit log. Titles MUST be
  deleted with the rest of the event data, following the existing deletion procedure, and wiped with
  rehearsal data.

**Voting countdown**

- **FR-111**: Crew MUST be able to set, change, and clear a "voting closes at" time, to the minute
  and in Edmonton time, from the crew dashboard. Each change MUST be recorded in the audit log.
- **FR-112**: While voting is open and a close time is set, the big screen MUST show a countdown to
  it. At one hour or more remaining it shows hours and minutes. Below one hour it shows minutes and
  seconds and updates every second. Under the countdown, in smaller type, it MUST show "Voting closes
  at [time]" in 12-hour Edmonton time.
- **FR-113**: The countdown MUST be based on the server's time, so a wrong clock on the big-screen
  device does not change what it shows.
- **FR-114**: At or after the close time, the big screen MUST show "Voting closes any moment"
  instead of a countdown. The close time MUST NOT change the contest stage (constitution Principle
  VI). Only a crew action closes voting.
- **FR-115**: The countdown MUST NOT appear when no close time is set or when the stage is not
  voting open. Changes to the close time MUST reach the big screen within 5 seconds.

**Look and brand**

- **FR-116**: Every screen MUST use the RIZN Fear Factor palette: brand orange (#F94003) and brand
  blue (#0069FB) as the primary colours on a dark background, replacing the dark purple of 001
  FR-042. Lighter or darker tints are allowed where needed to meet WCAG AA contrast.
- **FR-117**: The landing page, the Night Pass, and the big screen MUST show the RIZN Fear Factor
  logo. At least one student screen and the big screen MUST show the RIZN Youth logo. Logos MUST
  have alt text, and decorative collage elements MUST be hidden from screen readers.
- **FR-118**: Brand images and fonts used by the app MUST be web-sized copies shipped with the app
  and served from its own origin. The original media bundle MUST NOT be served or shipped.
- **FR-119**: Brand imagery MUST NOT block the Night Pass nickname from appearing, and MUST NOT
  animate when reduced motion is requested.
- **FR-120**: All 001 accessibility requirements (FR-042: WCAG AA contrast, 44×44 px targets, alt
  text, not relying on colour alone, reduced motion) MUST still hold with the new palette and
  imagery.

**Contestant's own costume**

- **FR-121**: A Night Pass linked to an entry MUST show a "Your costume" card with the entry's
  photo, costume title, and "You're in the costume contest!". Passes without an entry show no card.
- **FR-122**: The card MUST NOT show vote counts, rank, or standing before results are revealed.
  Once the reveal reaches the entry's place, it MUST show that place, with ties marked.
- **FR-123**: The Night Pass MUST keep showing its pass number. The whole pass MUST act as a
  control labelled for screen readers (for example "Show my pass code"), and tapping it MUST flip
  the pass, with a card-flip animation, to a back side showing a QR code for that pass. Tapping it
  again flips it back. The flip MUST be a plain swap when reduced motion is requested.
- **FR-128**: The pass, its number, and its QR code MUST stay bound to the device that received
  them, through the first-party pass cookie of 001 FR-004. The cookie MUST be set by the server,
  unreadable and unchangeable by page scripts, and tamper-evident, so changing it yields no valid
  pass. The number and code MUST always be the ones the server holds for that cookie, never values
  the phone stores or edits. The app MUST NOT offer any way to move or copy a pass to another
  device.
- **FR-124**: The QR code MUST identify the pass to crew only. It MUST NOT contain the pass's
  sign-in cookie or anything else that lets the holder of the code view, use, or take over the
  pass. Outside a crew session, using it MUST do nothing beyond showing a neutral page.
- **FR-125**: The QR code MUST be dark on a light background with a quiet zone, sized to scan from
  a phone screen at low brightness, and the back side MUST still show the nickname and number.
- **FR-126**: When adding or editing an entry, crew MUST be able to scan a pass QR code with the
  crew device camera to select that pass. A scan MUST apply the same checks as a search
  (already-linked, crew-created, and rehearsal or live mode). Searching by nickname or number MUST
  remain available.
- **FR-127**: The QR code and scanner MUST work with no third-party service or other-origin
  script, and scanning MUST NOT store any image from the camera.

### Changes to 001

| 001 requirement | Change |
|---|---|
| FR-011 ("once cast, it is final") | Replaced by FR-101 to FR-106: changeable while voting is open, locked after. |
| FR-012 (thank-you state, no voting controls) | The thank-you state now offers "Change my vote" while voting is open (FR-105). |
| FR-016 ("Crew MUST NOT be able to type a free-text name or label for any contestant") | Crew may type a costume title (FR-107). Typing a person's name stays forbidden, by guidance on the field. Students still cannot type anything. |
| FR-042 (dark purple and pumpkin orange) | Replaced by FR-116 to FR-120: brand orange and blue. |
| Vote entity statuses (counted, voided, released) | Adds "replaced". |

### Key Entities

- **Vote** (changed): now also has a "replaced" status and the time it was replaced. A pass has at
  most one counted vote. Its history of replaced choices stays in the log.
- **Costume Entry** (changed): adds an optional costume title, crew-entered, up to 40 characters.
- **Contest** (changed): adds an optional "voting closes at" time. It is shown only and never
  changes the stage.
- **Brand assets**: the web-sized logos, stickers, and fonts shipped with the app. They hold no
  student data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: A student can change their vote from the thank-you state in under 15 seconds.
- **SC-102**: In scripted tests (changes, double-taps, retries, concurrent changes, and changes
  racing a close), every pass ends with at most one counted vote, and the totals match the number
  of passes with a counted vote. Zero discrepancies.
- **SC-103**: Adding a costume entry with a title, from pass lookup to saved, takes a crew member
  under 40 seconds.
- **SC-104**: The big-screen countdown is within 2 seconds of the true time remaining, even when the
  big-screen device's clock is off by 5 minutes.
- **SC-105**: The countdown and "[nickname] as [title]" are readable from the back of the room
  during rehearsal, as confirmed by a crew member standing there.
- **SC-106**: Every student-facing screen passes the automated accessibility checks with the new
  palette and imagery, with zero contrast failures.
- **SC-107**: Brand imagery adds no more than 250 KB to the first load of the Night Pass screen.
- **SC-108**: RIZN staff sign off on the new look before the event.
- **SC-109**: Scanning a pass selects it in under 3 seconds from pointing the camera at it, on a
  student phone at half brightness. Adding an entry by scanning takes under 25 seconds.

## Assumptions

- **Time to the event.** It is 3 days away (2026-10-30) and the production rehearsal (001 T087) is
  not done yet. The stories are ordered so the P1 changes can ship alone if time runs short. The
  rehearsal has to cover these changes, so this feature has to be deployed before the rehearsal.
- **Vote counts stay hidden.** Contestants never see their own vote count before the reveal, because
  constitution Principle V forbids per-costume counts. The "Your costume" card shows only that they
  are entered and, after the reveal, their place.
- **Why contestants still use their pass.** Linking the pass to the entry is what stops a contestant
  voting for their own costume (001 FR-010). That stays, and the "Your costume" card gives it a
  visible payoff.
- **No limit on changes.** Students can change as often as they like while voting is open. Each pass
  still counts once, and the log keeps the full history for crew review.
- **Costume titles are crew-written.** They are free text, written by adults, so a profanity filter
  isn't needed. Constitution Principle I forbids *students* entering free text, and that still holds.
  The project rule against crew-typed contestant labels (001 FR-016 and CLAUDE.md) is narrowed to
  "no names", and CLAUDE.md will be updated to match.
- **Where the countdown shows.** It is on the big screen only. Showing "Voting closes at [time]" on
  student phones is a possible follow-up, but it's out of scope here.
- **Countdown format.** At one hour or more it reads "1h 05m". Below an hour it reads "59:59" down to
  "0:01". The close time is shown as, for example, "8:45 PM".
- **Brand colours.** They were sampled from the supplied artwork: orange #F94003 (the Fear Factor
  poster; the RIZN Youth logo uses the close #FF4E00) and blue #0069FB.
  - Black text on the orange and white text on the blue both pass AA.
  - White text on the orange and blue text on near-black do not pass for body text. Those pairings
    are kept to large text and surfaces.
- **Fonts.** The bundle has a `Font/` folder, but it was empty on 2026-10-27; the file may not have
  copied over.
  - The design file references Cubano. Headings use the supplied font file once it is in the
    bundle, provided its licence allows web use and self-hosting in a public repo. Otherwise they
    use a similar bold, freely licensed display font, self-hosted.
  - The poster's "RIZN FEAR FACTOR" lettering is hand-drawn artwork, so it is used as the logo image
    rather than as a typeface.
  - Body text stays the readable sans-serif from 001.
- **Media bundle stays out of the repo.** The bundle is about 74 MB and is excluded from git. Only
  optimized copies of the pieces actually used are added to the app.
- **Logos in a public repo.** The repo is public, so the optimized logos and stickers will be
  publicly visible in it. This assumes the RIZN team is fine with that, since the same art is
  already on public posters.
- **Device binding uses the cookie, not local storage.** Constitution Principle II says student
  identity MUST be a first-party cookie only. A server-set cookie that page scripts can't read or
  change is also harder to tamper with than local storage, which any script on the page can edit.
  A cleared cookie or a private tab still loses the pass (001 assumption), and that's unavoidable
  without collecting identifiers.
- **No new student data.** Nothing new is collected from students, no third-party service is added,
  and no script is loaded from another origin.

