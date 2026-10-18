# RIZN Fear Factor Night Pass Constitution

## Core Principles

### I. Protect Minors First (NON-NEGOTIABLE)
The audience is students in grades 7–12. Their safety outranks every feature and convenience.

- The system MUST NOT collect names, emails, phone numbers, or any other personal identifier
  from students.
- Students MUST be identified only by a generated spooky nickname.
- Students MUST NOT be able to upload photos or enter free text anywhere in the app.
- Costume photos MUST be taken by adult crew members only.
- Photos MUST be stored privately with no public URLs, and MUST be served only to requests
  holding a valid pass.
- Photos MUST be deleted automatically after the event.
- Third-party analytics, ad trackers, and social embeds MUST NOT be included.

Rationale: a single privacy failure involving minors at a church event is unacceptable, and the
simplest way to be safe is to never hold the data.

### II. Mobile-First and Zero-Install
- Every student feature MUST work in the phone's default browser (iOS Safari and Android Chrome,
  latest two versions) with no app install, no account, and no login.
- Student identity MUST be a first-party cookie only.
- Student screens MUST be designed for a phone viewport first; crew tools MAY assume a larger
  screen but MUST remain usable on a phone.

Rationale: students will scan a code and expect it to work in seconds, on whatever phone they own.

### III. Built for a Bad Network
Design for a few hundred phones on one church wifi network shared with a livestream.

- Payloads MUST be kept small; images MUST be resized client-side before upload.
- Student phones MUST use simple polling rather than long-lived connections (WebSockets, SSE).
- Crew actions MUST be safe to retry: every mutating request MUST be idempotent or carry an
  idempotency key so a retry never double-submits.
- Polling intervals MUST be bounded and MUST back off on errors.

Rationale: the network will be the weakest link on the night; the app must degrade gracefully
rather than fail or duplicate actions.

### IV. Simplicity Over Cleverness
- The project MUST ship the smallest thing that runs the contest correctly.
- No feature MAY be built unless the costume contest needs it.
- The student pass MUST be modeled as a first-class entity (stable ID, independent of contest
  data) so later features such as teams, points, badges, or a scavenger hunt can attach to it
  without a rewrite. This MUST NOT be used to justify building those features now.

Rationale: this runs once, on a fixed date, with volunteers; every extra feature is extra risk.

### V. Fair and Auditable Voting
- Each pass MUST be limited to one vote, enforced on the server, never only in the client.
- Every vote and every crew action MUST be recorded with a timestamp.
- Crew MUST be able to review votes and void suspicious ones; voids MUST be recorded, not
  deleted.
- Students MUST NOT see per-costume vote counts until the crew reveals results.

Rationale: trust in the outcome matters more than speed, and students will notice unfairness.

### VI. The Crew Is in Control
- Contest state (entries open, voting open, voting closed, results revealed) MUST change only
  through explicit crew actions.
- Timers MUST NOT trigger state changes.
- State transitions MUST be reversible where possible; irreversible ones (such as revealing
  results) MUST require explicit confirmation and be documented as irreversible.
- Students' screens MUST reflect the current state without requiring action from them.

Rationale: live events change on the fly; a human must always be able to decide when things happen.

### VII. Test What Can Embarrass Us
- Automated tests MUST cover vote enforcement: one vote per pass, no self-voting, and no voting
  while voting is closed.
- Automated tests MUST cover the contest state machine, including invalid transitions.
- Automated tests MUST cover photo handling: crew-only upload, private storage, pass-gated
  access, and deletion.
- A dry-run mode MUST let the crew rehearse the whole event, MUST clearly indicate it is active,
  and MUST allow all test data to be wiped afterward without touching real event data.

Rationale: the failures that matter are the public, visible ones; those get tests first.

### VIII. Accessible and Readable in a Dim Room
- Text and UI MUST meet WCAG AA contrast.
- Interactive targets MUST be at least 44×44 px.
- Images MUST have descriptive alt text.
- Information MUST NOT be conveyed by color alone.
- Animations MUST respect `prefers-reduced-motion`.

Rationale: the event is in a dark room, on phones at low brightness, with students of varied
abilities.

### IX. Boring Operations
- The app MUST be one deployable unit.
- Configuration MUST come from environment variables, and secrets MUST NOT be committed to the
  repository.
- A documented one-command deploy MUST exist.
- A documented data-deletion procedure MUST exist and cover the database, stored photos, and
  backups.

Rationale: whoever deploys this may be a volunteer under time pressure; nothing should need
tribal knowledge.

## Event Scope and Constraints

- **Event**: a single youth event at Celebration Church, Edmonton, on October 30, 2026.
- **Audience**: students in grades 7–12, plus adult crew.
- **First release**: costume contest only. Anything else is out of scope until the contest is
  complete and a later feature is specified through the normal workflow.
- **Browsers**: iOS Safari and Android Chrome, latest two versions each.
- **Retention**: all student-related data and photos MUST be deleted after the event, following
  the documented deletion procedure, with deletion verified and recorded.

## Development Workflow and Quality Gates

- Every spec, plan, and task list MUST be checked against this constitution; violations MUST be
  fixed or justified under Governance.
- Changes touching voting, contest state, or photo handling MUST include or update the tests
  required by Principle VII before merge.
- Any change that adds data collected from students, a third-party service, or a client-side
  script from another origin MUST be rejected unless the constitution is amended first.
- A full dry-run rehearsal on production-like infrastructure MUST be completed, and test data
  wiped, before the event.
- Accessibility checks (contrast, tap target size, alt text, reduced motion) MUST be performed
  on every student-facing screen before release.

## Governance

This constitution supersedes other practices and conventions for this project.

- **Amendments**: changes MUST be proposed in writing with rationale, approved by the project
  owner, and recorded with an updated version and date. Principle I MUST NOT be weakened without
  a documented review of the child-safety implications.
- **Versioning**: semantic versioning. MAJOR for removing or redefining a principle in a
  backward-incompatible way; MINOR for adding a principle or materially expanding guidance;
  PATCH for clarifications and wording.
- **Compliance review**: every feature spec, plan, and pull request MUST be reviewed for
  compliance. Any exception MUST be recorded in the plan's complexity or justification section
  with the reason and a simpler alternative that was rejected.

**Version**: 1.0.0 | **Ratified**: 2026-10-17 | **Last Amended**: 2026-10-17
