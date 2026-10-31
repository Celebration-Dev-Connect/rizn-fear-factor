# Feature Specification: Off-Season Static Site

**Feature Branch**: `main` (spec directory `specs/004-off-season-static-site`)

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Now that the event is over, we need static content on the page,
hosted year-round until next year. Keep the VANAGEDDON info until that event passes, then show a
plain static page. The crew side doesn't need to change because we won't be using it, but the
public student side should become a static site. When that happens, stop hosting on Lightsail and
move to super cheap static hosting, maybe S3. Look into options."

Fear Factor 2026 is over. The live contest app (specs 001–003) runs on a server costing about
$12 a month and holds student data that has to be deleted. This feature replaces it with a
static page at the same address, so posters, QR codes, and shared links keep working all year.
It costs almost nothing and holds no student data. The contest app's code stays in the repo for
next year.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anyone opening the old link sees RIZN Youth info (Priority: P1)

A student scans a leftover Fear Factor poster, taps an old link in a group chat, or types the
address. Instead of a Night Pass or an error, they see a RIZN Youth page:
- a thank-you for coming to Fear Factor;
- when and where RIZN meets every Friday;
- a button to follow @riznyouth on Instagram;
- a "Fear Factor will be back" note.

**Why this priority**: The address is printed on posters and saved on hundreds of phones. A dead
link or a broken contest screen is a missed invitation back to RIZN.

**Independent Test**: Open the address, and old paths like the pass page, the contest, the crew
page, and the big screen, on a phone with no data or cookies. Every one shows the RIZN Youth page
over HTTPS, quickly, with no errors.

**Acceptance Scenarios**:

1. **Given** anyone, **When** they open the site address, **Then** they see the RIZN Youth page
   over a secure connection.
2. **Given** an old link to the contest, Night Pass, crew, big screen, or a photo, **When** it is
   opened, **Then** it shows the RIZN Youth page instead of an error, a login, or contest data.
3. **Given** the page, **When** it is shared in a message app, **Then** the link preview shows the
   RIZN Youth title, description, and share image.
4. **Given** the page, **When** it loads, **Then** it asks for nothing, sets no cookies, and
   contains no student names, nicknames, or costume photos.

---

### User Story 2 - VANAGEDDON stays up until it happens, then retires itself (Priority: P1)

Until VANAGEDDON (Friday, November 6, 2026) is over, the page leads with the VANAGEDDON section and
the van photo, as now. Once that night is over, the section disappears on its own and the page
shows only the year-round content. Nobody has to remember to change it.

**Why this priority**: VANAGEDDON is the next thing students can come back for. An outdated event
after it happens makes the page look abandoned.

**Independent Test**: View the page with the device date set to before and after the end of
VANAGEDDON. Before, the section and photo show. After, they're gone, with no redeploy.

**Acceptance Scenarios**:

1. **Given** a date before the end of VANAGEDDON, **When** the page loads, **Then** the
   VANAGEDDON section with the van photo is shown near the top.
2. **Given** a date after the end of VANAGEDDON, **When** the page loads, **Then** no VANAGEDDON
   section is shown, and the rest of the page looks complete.
3. **Given** a browser with scripts turned off, **When** the page loads after VANAGEDDON, **Then**
   it still reads sensibly. The event section is clearly past, or hidden.

---

### User Story 3 - The event server is shut down and its data deleted (Priority: P1)

After the static page is live at the address, the contest server is switched off and deleted,
along with its database and photos, following the documented deletion procedure. Monthly costs
drop from about $12 to under $1.

**Why this priority**: The constitution requires student data to be deleted after the event. The
server is also the only real ongoing cost.

**Independent Test**: After the switch-over, check that the address serves the static page, the
old server no longer exists, and the hosting bill shows only the static hosting.

**Acceptance Scenarios**:

1. **Given** the static page is live and checked, **When** the shutdown runs, **Then** the server,
   its disks, its database, its photos, and its fixed IP address are deleted. The deletion is
   recorded with the date and the person who ran it.
2. **Given** the shutdown, **When** someone opens the address, **Then** they still get the static
   page with no outage longer than a few minutes during the switch.
3. **Given** next year, **When** organizers want the contest again, **Then** the app's code and
   setup guide are still in the repository and can be redeployed.

---

### User Story 4 - Organizers can update the page without a developer (Priority: P2)

A RIZN leader wants to change the Friday time, add next year's Fear Factor date, or swap the share
image. They edit one plain content file and publish, without touching layout code or servers.

**Why this priority**: The page has to stay accurate for a year, and a developer may not be
around.

**Independent Test**: Change the Friday time in the content file and publish. The live page shows
the new time within 10 minutes.

**Acceptance Scenarios**:

1. **Given** the content file, **When** a leader changes the wording and publishes, **Then** the
   live page updates within 10 minutes.
2. **Given** a broken edit (for example an unclosed quote), **When** they try to publish, **Then**
   it is refused and the live page stays as it was.

### Edge Cases

- **Cached old app on a phone**: a phone that kept the old contest page open gets the static page
  on its next load. The old pages relied on the server and can't keep showing contest data.
- **Old Night Pass cookies**: they are ignored; nothing reads them anymore.
- **Old big-screen and crew links with secret tokens in the address**: they show the static page
  and reveal nothing.
- **Old photo links**: they show the static page or "not found", never a photo. The photos are
  deleted with the server.
- **Search engines**: the page stays out of search results unless organizers decide otherwise.
- **Domain renewal**: `riznyouth.com` must stay registered for the address to keep working all
  year. That is outside this app, but noted.
- **Next year's Fear Factor**: when the contest returns, the address points back at a contest
  server, which is a deliberate redeploy.

## Requirements *(mandatory)*

### Functional Requirements

**Static page**

- **FR-301**: The site address MUST serve a single static RIZN Youth page over HTTPS with:
  - a Fear Factor 2026 thank-you;
  - the weekly RIZN Youth details;
  - a Follow @riznyouth on Instagram link;
  - a "Fear Factor will be back next year" note.
- **FR-302**: Every other path on the address, including old contest, Night Pass, crew, big
  screen, API, and photo links, MUST show the same page (or redirect to it). None may show an
  error page, a sign-in, or contest data.
- **FR-303**: The page MUST hold no student data: no names, nicknames, pass numbers, votes, or
  costume photos.
- **FR-304**: The page MUST set no cookies, load nothing from other origins, include no analytics
  or trackers, and keep the existing link-preview tags (title, description, share image) and
  favicons.
- **FR-305**: The page MUST keep the RIZN Fear Factor look from spec 002 (colours, logo, fonts),
  meet WCAG AA, and work on iOS Safari and Android Chrome (latest two versions).

**VANAGEDDON**

- **FR-306**: Until the end of VANAGEDDON (Friday, November 6, 2026, 9:30pm Edmonton time) the
  page MUST show the VANAGEDDON section with the van photo. After that it MUST hide the section
  automatically, with no republishing.
- **FR-307**: With scripts disabled, the page MUST still make sense after VANAGEDDON. For example,
  the section says it was on November 6 rather than "next Friday".

**Hosting and shutdown**

- **FR-308**: The static page MUST be hosted on low-cost static hosting at the same address, with
  HTTPS, for under $1 a month at expected traffic.
- **FR-309**: Publishing MUST be a single documented action. A content change MUST be live within
  10 minutes, and a broken publish MUST leave the live page unchanged.
- **FR-310**: After the static page is live and checked, the event server and everything on it
  MUST be deleted following the documented data-deletion procedure. The deletion MUST be recorded
  (date and operator).
- **FR-311**: The contest app's code and setup guide MUST stay in the repository, so it can be
  redeployed next year.
- **FR-312**: The page wording MUST live in one content file that organizers can edit.

### Key Entities

- **Off-season page content**: thank-you, weekly details, Instagram link, "back next year" note,
  and the VANAGEDDON section with its end time. No student data.
- **Static site**: the published page, its images, share card, and favicons, served at the event
  address.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-301**: 100% of old links tested (home, Night Pass, contest, crew, big screen, RIZN page,
  photo, API) show the RIZN Youth page with no error.
- **SC-302**: Hosting for the address costs under $1 a month, compared with about $12 for the
  event server.
- **SC-303**: The page loads in under 2 seconds on a typical phone connection.
- **SC-304**: VANAGEDDON is visible before November 6, 9:30pm, and hidden after it, with no manual
  change.
- **SC-305**: After shutdown, zero student data remains on any server: no database, photos, or
  backups. The deletion is recorded.
- **SC-306**: An organizer can change the page wording and see it live in under 10 minutes.

## Assumptions

- The address stays `fearfactor.riznyouth.com`. Its DNS record is managed by hand outside the
  app's infrastructure and is repointed at the static host as part of the switch.
- The year-round page is a simpler version of today's RIZN Youth page (spec 003). The thank-you
  wording is changed to the past tense.
- No costume photos or winners appear on the public page. The consent was for "tonight", and the
  photo archive is offline only (constitution v3.0.0).
- The crew and big-screen tools are not needed until next year, so they are not hosted.
- Shutting down the server is also how the server-side deletion is done. The automatic photo
  deletion on November 2 still runs if the server is up until then.
- Search engines stay excluded, as now. Organizers can opt in later.
- "Next year" redeploys the contest app from the repository and the existing infrastructure
  guide. That is a separate, future feature.
- Constitution impact: Principle IX (one deployable unit, documented deploy and deletion) applies
  to the static site too. Event Scope needs a small amendment (MINOR) to list the off-season
  static page.
