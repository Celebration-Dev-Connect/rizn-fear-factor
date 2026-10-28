# Quickstart: Validating Contest Night Polish

**Feature**: [spec.md](./spec.md) | **Contract**: [contracts/api.md](./contracts/api.md)

Use this to prove the feature works, locally and then in the production rehearsal.

## Setup

```bash
docker compose -f compose.dev.yml up -d --wait
npm run db:migrate          # applies drizzle/0001_contest_polish.sql
npm run brand:assets        # only when media-bundle/ changed; outputs are committed in public/brand/
npm run dev                 # http://localhost:3000
```

Sign in to `/crew` on a second browser or device, turn on **rehearsal mode**, and open the big
screen from the dashboard's screen link.

## Automated checks

```bash
npm run typecheck && npm run lint
npm test                    # unit: countdown formatting, scan-code encode/verify, title normalizing
npm run test:integration    # votes (change), entries (title), scan, voting-close, pass cookie tampering
npm run test:e2e            # student change flow, pass flip, a11y on new screens, brand byte budget
```

| Requirement | Test it lives in |
|---|---|
| FR-101–104, SC-102 | `tests/integration/votes.test.ts`, the "vote change" block. It covers changes, the same-entry no-op, changes after close, a voided vote, a self-vote, 20 concurrent changes from one pass ending in one counted vote, and totals unchanged after changes. |
| FR-106 | the same block, for an assisted change |
| FR-107–110 | `tests/integration/entries.test.ts`: title create, edit, and clear; 41 characters rejected; control characters rejected; the alt text; the audit event |
| FR-111–115 | `tests/unit/countdown.test.ts` covers the format boundaries: 3601 s reads "1h 01m", 3600 s "1h 00m", 3599 s "59:59", 1 s "0:01", 0 s "closes any moment", with a clock-offset correction. `tests/integration/voting-close.test.ts` covers set, clear, audit, rehearsal isolation, and the wipe. |
| FR-124, FR-126 | `tests/unit/scanCode.test.ts`: round trip, a tampered number or MAC, the wrong realm letter. `tests/integration/pass.test.ts`: the scan endpoint is crew-only; the code SVG needs the pass cookie. |
| FR-128 | `tests/integration/pass.test.ts`: an altered cookie returns `no_pass`. `tests/e2e/student.spec.ts`: clearing or editing `localStorage` leaves the same pass. |
| FR-119, FR-120, SC-106, SC-107 | `tests/e2e/a11y.spec.ts` runs axe on `/`, `/` flipped, `/contest` voted and changeable, and `/screen` with the countdown. A budget check sums the `/brand/` bytes on `/` (must be ≤ 250 KB). |

## Manual scenarios

Run each one in rehearsal mode. The ✅ line is the expected result.

### 1. Change a vote (User Story 1)
1. Add three entries, open voting, and vote for A from a phone.
2. On the thank-you screen, tap **Change my vote**, pick B, and confirm. The dialog shows A → B.
   ✅ The thank-you screen names B, the big-screen vote total is unchanged, and `/crew/votes` shows A
   as *replaced* and B as *counted*.
3. Close voting. ✅ "Change my vote" disappears within 5 s.
4. Reopen voting, void the phone's vote in `/crew/votes`, then reload the phone. ✅ It can't change.

### 2. Costume title (User Story 2)
1. In `/crew/entries`, add an entry with the costume "Superman". Add a group entry with two passes
   titled "The Ghostbusters".
   ✅ The gallery, the big screen, the vote confirmation, and the reveal read
   *Midnight Gremlin as* **SUPERMAN** and *A & B as* **THE GHOSTBUSTERS**.
2. Edit a title, then clear it. ✅ Every screen updates within 5 s, and a cleared entry shows nicknames
   only.
3. Time an add with a title from pass lookup to saved. ✅ Under 40 s (SC-103).

### 3. Countdown (User Story 3)
1. On the dashboard, set **Voting closes at** to 61 minutes from now. Open voting.
   ✅ The big screen shows `1h 01m` and "Voting closes at h:mm PM". After a minute it shows `59:xx`,
   ticking each second.
2. Set the big-screen laptop's clock 5 minutes wrong and reload.
   ✅ The countdown still matches a phone's clock within 2 s (SC-104).
3. Set the close time 1 minute ahead and wait.
   ✅ It reaches "Voting closes any moment", and the stage stays **Voting open** until crew close it.
4. Clear the time. ✅ The countdown disappears within 5 s.
5. Stand at the back of the room. ✅ The countdown and the costume labels are readable (SC-105).

### 4. Look (User Story 4)
1. Walk through `/`, `/contest`, `/crew/*`, and `/screen`.
   ✅ They use orange and blue on dark navy, there's no purple, the logos are present, and the
   stickers are decorative.
2. DevTools → Network. ✅ No requests to any other origin, and fonts come from `/_next/static/media`.
3. Throttle to "Slow 4G" and load `/` fresh. ✅ The nickname appears before the logo finishes loading.
4. Turn on reduced motion. ✅ Nothing animates, and the pass swaps without a flip.
5. Show the result to RIZN staff and record their sign-off (SC-108).

### 5. Pass flip and scan (User Story 6)
1. On a phone, tap the pass. ✅ It flips to a QR code with the nickname and number still visible.
   Tap again to flip back.
2. Put the phone in airplane mode and tap again. ✅ It still flips and shows the code.
3. Scan the code with the phone's own camera app. ✅ It shows only text, which opens nothing useful.
4. On a crew phone (test one iPhone and one Android), go to `/crew/entries`, tap **Scan pass**, and
   point it at a student phone at half brightness.
   ✅ The pass is selected in under 3 s (SC-109), and a full add by scan takes under 25 s.
5. Scan a rehearsal pass with rehearsal turned off. ✅ The device says "That code is from rehearsal
   mode".
6. Deny camera permission. ✅ The device explains how to allow it, and nickname search still works.

### 6. "Your costume" card (User Story 5)
1. Open the pass page on a phone whose pass is in an entry.
   ✅ It shows the card with the photo, the title, and "You're in the costume contest!", and no
   counts.
2. Close voting and reveal through that entry's place. ✅ The card says "You placed 2nd" (or "Tied
   for 2nd").
3. Remove the entry. ✅ The card disappears within 5 s.

### 7. Wipe
Wipe the rehearsal data. ✅ No rehearsal entries, titles, or votes remain, the rehearsal close time is
cleared, and live data is untouched.

## Deploy

Deploy is the same as in 001: GitHub → Actions → **Deploy**. See `infra/README.md`. The app runs the
migration on boot. After the deploy, repeat scenarios 1–7 in production during the T087 rehearsal,
then wipe.
