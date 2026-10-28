# Implementation Plan: Contest Night Polish

**Branch**: `main` (spec directory `specs/002-contest-polish`) | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-contest-polish/spec.md`

## Summary

This adds six changes to the live costume-contest app three days before the event:

1. students can change their vote while voting is open;
2. crew can add a short costume title, so entries read "{nickname} *as* TITLE";
3. the big screen counts down to a crew-set voting close time;
4. the RIZN Fear Factor brand: orange #F94003 and blue #0069FB, with the supplied logos, stickers,
   and fonts;
5. a flip-to-QR Night Pass that crew can scan to register a costume;
6. a "Your costume" card on contestants' passes.

The technical approach extends the 001 architecture rather than adding to it:

- **One migration**: a `replaced` vote status, `entries.costume_title`, and
  `contest.voting_closes_at`.
- **The one-vote rule** is still enforced by the existing partial unique index.
- **The countdown** uses the server's HTTP `Date` header, so the device's clock doesn't matter.
- **The QR code** is an HMAC-signed scan code rendered by the server, decoded on crew devices with
  `BarcodeDetector` or a lazily loaded jsQR.
- **The palette** is a change to the token file.
- **Brand images** are pre-optimized WebP files made by a committed `sharp` script.

The details are in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 on Node 24 (unchanged)

**Primary Dependencies**:
- unchanged: Express 5, Next.js 16, React 19, Drizzle ORM, zod 4, sharp, and `qrcode` (already a
  dependency);
- **new**: `jsqr@1.4.0` (Apache-2.0). It's a crew-only QR decoder, loaded on demand and served from
  our own origin.

**Storage**: PostgreSQL 17 (one additive migration, `0001`). Photo storage is unchanged.

**Testing**: Vitest (unit and integration against real PostgreSQL), Playwright (e2e and axe a11y),
and the existing autocannon load test.

**Target Platform**: the existing Lightsail instance running Docker Compose (`app`, `db`, `caddy`),
deployed by the GitHub Actions *Deploy* workflow. Student phones run iOS Safari and Android Chrome
(latest 2). Crew devices are the same browsers with a camera, and need HTTPS for `getUserMedia`.

**Project Type**: web application. One Express process mounts Next.js (unchanged layout).

**Performance Goals**:
- `/api/state` stays memory-served with ETag/304. `votingClosesAt` adds one small field, and its
  value changes only when crew set it.
- The countdown is accurate to ±2 s (SC-104).
- A scan selects a pass in under 3 s (SC-109).
- The 001 p95 under 300 ms under load still holds.

**Constraints**:
- Student pages get no new requests on the hot path. `/api/me` is refetched only when the state
  version changes.
- Brand imagery adds 250 KB or less to the pass page (SC-107).
- There is no third-party origin, and the CSP is unchanged.
- Changes must ship in order of priority, each deployable alone ([research §11](./research.md#11-order-of-delivery)).

**Scale/Scope**: the 001 load still applies: 150–400 students and a few crew devices on one night.
This adds about 10 new or changed endpoints and pages, and one migration.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Protect minors | Students still enter no text and upload nothing. Costume titles are crew-entered, with "no real names" guidance on the field. They're deleted with the entries under the existing deletion procedure. The QR code holds no identifier or credential, and photos stay gated. The brand assets contain no student data. | ✅ (see note 1) |
| II. Mobile-first, zero-install | Identity stays the first-party `httpOnly` cookie. `localStorage` is explicitly not used (FR-128). The flip and scan work in the default browsers. | ✅ |
| III. Bad network | There are no new student polls. The countdown ticks on the client from the existing poll. The QR SVG loads with the page, so the flip works offline. Images are small WebP files sized to fit. Every new mutation uses idempotency keys. | ✅ |
| IV. Simplicity | One migration, with no new tables or services. The QR code reuses `qrcode`, and the scan code needs no column. The one new dependency, jsQR, is justified by iOS lacking `BarcodeDetector`. Every story is requested by the contest team. | ✅ |
| V. Fair and auditable voting | Still one counted vote per pass, enforced by the database index. Replaced choices are kept, never deleted, and audited as `vote.change`. Counts stay hidden, including on the "Your costume" card. | ✅ |
| VI. Crew in control | `voting_closes_at` is display-only. The state machine never reads it, and a test asserts that the stage doesn't change when it passes. | ✅ |
| VII. Test what can embarrass us | Vote change gets integration tests (races, voids, stages, self-vote). Scan-code forgery and cookie tampering are tested. Rehearsal isolation of the close time is tested. | ✅ |
| VIII. Accessible | The new tokens are AA-checked ([research §8](./research.md#8-brand-palette)). The flip is a labelled button and swaps without animation under reduced motion. Stickers are `aria-hidden`. The alt text includes the costume title. The axe suite is extended. | ✅ |
| IX. Boring operations | Same deploy, and the migration runs on boot. No new environment variable: the scan MAC reuses `SESSION_SECRET`. The deletion procedure is unchanged and covers titles because they live on entries. | ✅ |
| Quality gate: rehearsal | The production rehearsal (001 T087) must run **after** this feature is deployed and before 2026-10-30 18:30. | ⚠️ scheduling, not a violation |

**Note 1**: 001 FR-016 and CLAUDE.md said crew may not type any contestant label. The constitution
itself forbids only *student* free text and personal identifiers. Spec 002 narrows the project rule
to "no names", and the tasks include updating CLAUDE.md. No constitution amendment is needed.

**Post-design re-check**: still ✅ after [data-model.md](./data-model.md) and
[contracts/api.md](./contracts/api.md). No new violations, and nothing to track under Complexity
Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-contest-polish/
├── plan.md              # this file
├── research.md          # Phase 0: decisions 1–11
├── data-model.md        # Phase 1: migration 0001, derived values, audit actions
├── quickstart.md        # Phase 1: automated and manual validation
├── contracts/api.md     # Phase 1: API deltas against 001
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

These are the files this feature adds (new) or changes. Everything else is untouched.

```text
drizzle/
└── 0001_contest_polish.sql          # new: generated by drizzle-kit

scripts/
└── brand-assets.ts                  # new: media-bundle/ → public/brand/*.webp (sharp)

public/
├── brand/                           # new files: logos and stickers (committed outputs)
└── fonts/                           # new, only if RIZN supply Cubano with a web licence

src/server/
├── db/schema.ts                     # vote_status + replaced; entries.costumeTitle; contest.votingClosesAt
├── services/voting.ts               # changeVote(); listVotes adds replaced and costume title
├── services/entries.ts              # title normalizing, card.costumeTitle, alt text
├── services/contest-state.ts        # PublicState.votingClosesAt; setVotingClose()
├── services/rehearsal.ts            # the wipe clears voting_closes_at
├── services/scanCode.ts             # new: encode/verify NP1 codes (HMAC, constant-time compare)
├── services/ranking.ts              # place lookup for one entry (Me.ownPlace), shared with /api/results
├── routes/votes.ts                  # PUT /api/votes/mine
├── routes/pass.ts                   # GET /api/pass/code.svg; Me gains ownEntry, ownPlace, voteChangeable
├── routes/crew/votes.ts             # PUT /api/crew/assisted-votes/:passId
├── routes/crew/passes.ts            # GET /api/crew/passes/scan
├── routes/crew/entries.ts           # costumeTitle field
├── routes/crew/dashboard.ts         # PUT /api/crew/voting-close (or a new routes/crew/votingClose.ts)
└── routes/qr.ts                     # QR colours → new palette

src/shared/
├── types.ts                         # PublicState, EntryCard, Me, new error codes
└── schemas.ts                       # changeVoteBody, costumeTitle, votingCloseBody, scanQuery

src/lib/
├── useServerClock.ts                # new: offset from the Date header of state polls
├── countdown.ts                     # new: pure formatter (unit-tested)
└── scanner.ts                       # new: camera + BarcodeDetector or jsQR (dynamic import)

src/components/
├── EntryLabel.tsx                   # new: "{nicknames} as TITLE", used everywhere a card is labelled
├── Countdown.tsx                    # new: big-screen countdown block
├── PassBadge.tsx (+ .module.css)    # flip card (front/back), QR back face
├── YourCostume.tsx                  # new: contestant card
├── ScanPassButton.tsx               # new: crew scan dialog
├── BrandMark.tsx                    # logo image instead of the text wordmark
├── Stickers.tsx                     # new: aria-hidden decorative collage
├── Gallery.tsx, ScreenGallery.tsx, Reveal.tsx, VoteConfirm.tsx  # use EntryLabel
└── VoteConfirm.tsx                  # "change from → to" variant

src/app/
├── layout.tsx                       # fonts: Cubano (local) or Lilita One; drop Creepster
├── page.tsx                         # flip pass + YourCostume
├── contest/page.tsx                 # Change my vote flow
├── crew/page.tsx                    # voting close time control
├── crew/entries/page.tsx            # costume title field
├── crew/PassPicker.tsx              # Scan pass
├── crew/assist/page.tsx             # change an assisted vote
├── crew/votes/page.tsx              # replaced filter and badge, titles
└── screen/page.tsx (+ .module.css)  # countdown, banner, stickers

src/styles/tokens.css                # brand palette (research §8)

tests/
├── unit/countdown.test.ts           # new
├── unit/scanCode.test.ts            # new
├── integration/votes.test.ts        # + vote change block
├── integration/entries.test.ts      # new: costume title
├── integration/voting-close.test.ts # new
├── integration/pass.test.ts         # + scan endpoint, code.svg auth, cookie tampering
├── e2e/student.spec.ts              # + change vote, flip, storage tampering
└── e2e/a11y.spec.ts                 # + flipped pass, changeable thank-you, screen countdown, byte budget

CLAUDE.md                            # narrow the "no crew-typed labels" rule to "no names"; add brand:assets
package.json                         # + jsqr; + "brand:assets" script
```

**Structure Decision**: keep the existing single-process layout from 001: Express in `src/server`,
Next.js pages in `src/app`, and shared code in `src/shared`. No new top-level directories except
the output folders `public/brand` and (optionally) `public/fonts`.

## Delivery Order

This follows [research §11](./research.md#11-order-of-delivery). Each step is committed, tested, and
deployable on its own:

1. **P1**: migration, vote change, costume title, and the `EntryLabel` component. Deploy.
2. **P2**: the voting close time and big-screen countdown. Deploy.
3. **P2**: palette tokens, brand assets, fonts, and stickers. Deploy.
4. **P2/P3**: pass flip, scan code, crew scanner, and the "Your costume" card. Deploy.
5. Production rehearsal (001 T087), covering the quickstart scenarios, then wipe.

If time runs out, cut from the bottom of step 4 upward, and never skip step 5.

## Complexity Tracking

No constitution violations, so this section is empty.
