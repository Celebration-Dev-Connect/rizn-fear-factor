# Research: Contest Night Polish

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature extends the running app from `specs/001-costume-contest` (Express 5 + Next.js 16,
PostgreSQL 17 through Drizzle, one Docker Compose stack). It adds no new service and keeps
everything on its own origin. Each decision below says what was chosen, why, and what was
rejected.

## 1. Changing a vote

**Decision**: A change runs in one transaction:
- lock the contest row (as `castVote` already does) and the pass's current vote row (`FOR UPDATE`);
- mark that row `replaced`, setting `status_changed_at` to now;
- insert a new `counted` row for the new entry;
- record a `vote.change` audit event.

`replaced` is a new value of the `vote_status` enum. The existing partial unique index
`votes_one_per_pass` (`status in ('counted','voided')`) is left as it is, so the database still
allows at most one non-replaced, non-released vote per pass.

**Rationale**:
- One vote per pass stays enforced by the database (CLAUDE.md rule; constitution V).
- Replaced rows are kept rather than updated in place, so the log shows every earlier choice (FR-104)
  and nothing is deleted (constitution V: "voids MUST be recorded, not deleted").
- Every count already filters on `status = 'counted'`: the totals, `countPlaces`, the ranking, and
  `/api/me`. So `replaced` rows drop out of all of them with no further change.
- Locking the vote row serializes two changes racing each other: the second waits, then replaces the
  first. That gives the spec's "whichever the server accepts last" behaviour.

**Rules carried in the same transaction**:
- stage must be `voting_open`;
- the target entry must exist and not be removed;
- no self-vote;
- the current vote must be `counted`, so a `voided` vote can't be changed (FR-103);
- if there is no current vote, the request is a normal first vote, so a released vote re-votes as
  in 001;
- if the target equals the current entry, nothing is written and the result is `200`, so there is no
  log noise.

**Alternatives rejected**:
- *Update `entry_id` in place*: this loses history and breaks the audit requirement.
- *Delete the old row*: this breaks constitution V.
- *A `from` entry precondition (compare-and-swap)*: this gives clearer conflict errors but makes
  a double-tap from a stale screen fail instead of succeeding. Idempotency keys already cover
  retries, so it isn't needed.

## 2. Costume title

**Decision**: Add a nullable `costume_title text` to `entries`, with a check that it is 1–40
characters after trimming. Empty strings are stored as `NULL`.
- The title is sent as a multipart field on the existing crew create and patch endpoints.
- `displayNames()` stays as it is (nicknames only). Entry cards gain `costumeTitle: string | null`,
  and the UI renders "nicknames *as* TITLE".
- Alt text becomes "Costume photo: {nicknames} as {title}".
- Edits are audited as part of the existing `entry.update` event, with `{ costumeTitle: { from, to } }`.

**Rationale**:
- Keeping the title in its own field lets each screen size the two parts differently (FR-108).
- Ranking, results, and the vote log reuse the card shape, so they get it for free.
- 40 characters fits "The Ghostbusters (all four of them)" and stays one or two lines on the
  big screen.
- Input is normalized server-side: trimmed, inner whitespace collapsed, and control characters
  rejected, so nothing odd reaches the screens.

**Alternatives rejected**:
- *A curated costume list*: this is slow to search and never complete for costumes.
- *A profanity filter*: the titles are written by adult crew, a filter adds false positives, and crew
  can edit any title at any time.

## 3. Voting close time and the countdown

**Decision**: Add a nullable `voting_closes_at timestamptz` to the per-realm `contest` row.
- It is set with `PUT /api/crew/voting-close` and audited as `voting_close.set`.
- `PublicState` gains `votingClosesAt: string | null`. It is already cached in memory and ETagged, so
  the hot poll still does no database work.
- The rehearsal wipe clears the rehearsal value. Each realm has its own row, so a rehearsal time never
  leaks into live.

The big screen works out "now" from the server: each `/api/state` response (200 or 304) carries an
HTTP `Date` header. The client keeps `offset = serverDate + rtt/2 − clientNow`, smoothed over the last
few polls, and ticks with `requestAnimationFrame`/`setInterval(250ms)` using `Date.now() + offset`.

**Rationale**:
- A wrong clock on the big-screen device doesn't matter (FR-113, SC-104).
- No new field changes every second, so the ETag/304 path stays cheap.
- `Date` has one-second resolution, and with the half-round-trip correction the error stays well
  under the 2-second budget.
- Constitution VI is respected: the value is only displayed, and no code path reads it to change the
  stage.

**Display rules**:
- 3600 s or more remaining: `{h}h {mm}m`, with minutes rounded up, so 61 minutes reads "1h 01m" and
  exactly 60 minutes reads "1h 00m".
- Under 3600 s: `{m}:{ss}`, from "59:59" down to "0:01".
- At 0 or below: "Voting closes any moment".
- The subline is "Voting closes at 8:45 PM", using the existing Edmonton formatter in `src/lib/time.ts`.
- On the crew dashboard, crew pick a time with `<input type="time">`. The date is the event date in
  Edmonton, taken from the event window start, so crew never handle dates.

**Alternatives rejected**:
- *Server time in the state body*: it changes on every response, which defeats the ETag/304 path.
- *A separate `/api/time` endpoint*: it's an extra request when the state poll already carries
  `Date`.
- *Storing the close time in settings*: it would be shared across realms, so a rehearsal value could
  leak into live.

## 4. Pass QR code

**Decision**: The QR code holds a short **scan code** of the form
`NP1.{L|R}.{number}.{mac}`. The MAC is the first 12 base32 characters of
`HMAC-SHA256(SESSION_SECRET, "pass-scan:" + pass.id)`.
- `GET /api/pass/code.svg` renders it server-side with the existing `qrcode` package: dark on white,
  4-module quiet zone, error correction level M. The endpoint requires the pass cookie and sends
  `Cache-Control: private, no-store`.
- Crew resolve a scanned code with `GET /api/crew/passes/scan?code=…`. The server checks the realm
  letter against the active realm, looks the pass up by `(realm, number)`, recomputes the MAC from its
  id, and compares in constant time.

**Rationale**:
- The scan code holds no cookie token, so anyone who photographs it can't use the pass (FR-124).
  Scanned outside the crew screen, it is plain text with no URL, so a phone camera shows only an
  opaque string (spec: "a neutral page" or nothing).
- The MAC stops someone from printing a fake code with another student's number.
- It needs no new column or migration. It's derived from the pass id, so it never changes and works
  for crew-created passes too.
- `SESSION_SECRET` already exists in production. Rotating it would change every code, which is
  harmless because codes are rendered on demand.
- Rendering on the server reuses a dependency we already have, so nothing is added to the student
  bundle.

**Offline flip**: the pass page loads the code SVG with the page, as an `<img>` on the hidden back
face, so the browser has it decoded before the first flip. Flipping later works with no network,
as the spec's edge case requires.

**Alternatives rejected**:
- *Encoding the pass number alone*: anyone could forge a code for another student's pass.
- *A random scan code column*: it needs a migration and a backfill, and gives the same protection.
- *A URL in the QR code*: a phone camera would offer to open it, and the request would carry no crew
  session, so it's pointless and confusing.
- *Client-side QR generation*: it adds about 25 KB to the student bundle with no benefit.

## 5. Scanning on crew devices

**Decision**: On a crew screen, "Scan pass" opens the camera with
`getUserMedia({ video: { facingMode: "environment" } })` and decodes frames:
- with `BarcodeDetector` where the browser has it (Android Chrome);
- otherwise with **jsQR 1.4.0** (Apache-2.0), loaded through a dynamic `import()` so it's only fetched
  on crew screens.

Frames are drawn to an offscreen canvas at about 6 fps and capped at 640 px wide. Nothing is uploaded
or stored, and the stream stops as soon as a code is read or the dialog closes.

**Rationale**:
- iOS Safari, which many crew phones run, has no `BarcodeDetector`, so a JS decoder is required.
- jsQR is a dependency-free, single-file, pure-JS decoder. It's bundled from npm and served from our
  own origin, so CSP `script-src 'self'` is unchanged (constitution I).
- It needs no Web Worker, so no `worker-src`/`blob:` relaxation.
- `Permissions-Policy` already allows `camera=(self)`, and production is HTTPS, which `getUserMedia`
  requires.

**Fallback**: camera denied or unavailable. The dialog says how to allow the camera in Safari or
Chrome settings, and the nickname/number search stays right there.

**Alternatives rejected**:
- *`qr-scanner` (nimiq)*: it starts a Web Worker, which means relaxing the CSP.
- *`html5-qrcode` / zxing*: much larger bundles.
- *A photo through `<input capture>` then decoding*: one extra tap per student, and slower than a live
  scan.

## 6. Flip animation

**Decision**: The Night Pass becomes a `<button>` (aria-pressed, label "Show my pass code" / "Show
my pass") that wraps a two-face card.
- The flip is a CSS 3D transform: `rotateY(180deg)` with `backface-visibility: hidden`, over 450 ms.
- Under `prefers-reduced-motion: reduce`, the transition is removed and the faces swap instantly
  (FR-123; constitution VIII).
- The back face shows the QR code on a white panel, with the nickname and number in text.
- Focus stays on the button, and the change is announced through the label.

**Rationale**: it's CSS only, needs no JS animation library, and the whole pass is well over the
44×44 px tap target.

## 7. Device binding

**Decision**: No new mechanism. 001 already binds the pass to the device with a server-set,
`httpOnly`, `Secure`, `SameSite=Lax` cookie holding a random 256-bit token. Only its SHA-256 hash is
stored. This feature:
- adds an integration test that an altered or forged cookie yields `no_pass` and is treated as a new
  device;
- adds an e2e check that the pass number and code come from the server even if `localStorage` or
  `sessionStorage` are edited (the app stores nothing there for identity).

**Rationale**:
- A random token that the server looks up by hash is already tamper-evident: any change misses the
  lookup.
- `httpOnly` keeps page scripts from reading or copying it (FR-128).
- Constitution II requires a cookie and forbids other identity stores, so `localStorage` was
  rejected. Scripts can also read and edit it, so it is weaker than the cookie.

**Accepted limit**: a student can still clear cookies or open a private tab and get a new pass. That
is mitigated, as in 001, by the vote log and voiding.

## 8. Brand palette

**Decision**: Re-point the tokens in `src/styles/tokens.css`. Every component already uses tokens,
and there are no hard-coded colours elsewhere except the QR code SVG colour.

| Token | Value | Contrast vs `--bg` | Use |
|---|---|---|---|
| `--bg` | `#0A0E1A` (ink navy) | | page background |
| `--surface` | `#141B2E` | | cards |
| `--surface-2` | `#1E2840` | | raised cards, inputs |
| `--border` | `#5A6E9C` | 3.8:1 (3.4:1 vs surface) | non-text boundaries |
| `--text` | `#F5F7FF` | ~18:1 | body text |
| `--text-muted` | `#B8C2DC` | ~10.8:1 | secondary text |
| `--accent` | `#F94003` brand orange | 5.3:1 | primary buttons, highlights, large text |
| `--on-accent` | `#0A0E1A` | 5.3:1 on orange | text on orange buttons (as on the poster) |
| `--accent-2` | `#0069FB` brand blue | 4.0:1 | surfaces, badges, large text only |
| `--on-accent-2` | `#FFFFFF` | 4.8:1 on blue | text on blue surfaces |
| `--accent-2-text` | `#5B9DFF` | ~7:1 | blue used as body-size text or links |
| `--danger`, `--success`, `--rehearsal` | unchanged | ≥ 6.7:1 | |

**Rationale**:
- These are the brand values sampled from the artwork (spec assumptions).
- Two pairings fail AA for body text: white on orange (3.6:1) and blue text on the background
  (4.0:1). Neither is used for body text; the table sends those cases to `--on-accent` and
  `--accent-2-text`.
- The automated a11y suite (axe in `tests/e2e/a11y.spec.ts`) re-checks every student screen (SC-106).

## 9. Brand imagery

**Decision**: Add a committed script, `scripts/brand-assets.ts`, that reads `media-bundle/` (which
is not committed) and writes optimized files to `public/brand/` (which is committed) using `sharp`:

| Output | Source | Size target |
|---|---|---|
| `fear-factor-logo.webp` (+ `@2x`) | `Workfiles/RiznFearFactor_1080x1920_Logo.png`, cropped to the artwork | 360 px / 720 px wide, ≤ 60 KB |
| `fear-factor-banner.webp` | `fearfactorlogos/Rizn Fear Factor WebsiteBanner_2026.png` | 1080 px, ≤ 90 KB (big screen only) |
| `rizn-youth-black.webp`, `rizn-youth-white.webp` | `fearfactorlogos/IMG_4716.PNG` (white is recoloured) | 480 px, ≤ 15 KB |
| `sticker-*.webp` (stars, beetle, horse, clock, spiral, telephone) | `Graphic elements/*`, cut out of the sheet | 160–240 px, ≤ 20 KB each |

- Logos are plain `<img>` tags with `width`/`height` set, `decoding="async"`, and
  `fetchpriority="low"` on student screens, so they never block the nickname (FR-119).
- Stickers are CSS background images on `aria-hidden` decorations, absolutely positioned and rotated,
  so they never shift layout.
- `BrandMark` switches from its text wordmark to the logo image.
- The big screen uses the banner across the top and larger stickers around the countdown.
- The pass budget is checked by a Playwright assertion that sums the transfer size of `/brand/`
  requests on `/` (SC-107: 250 KB or less).

**Rationale**:
- WebP is supported by every target browser.
- Running the script is reproducible, and the 74 MB bundle stays out of git.
- The output totals about 300 KB on disk, but each student page loads only the logo plus two or three
  stickers.

**Alternatives rejected**:
- *`next/image` optimization at runtime*: it adds CPU work on the 2 GB server during the event and
  a cache directory, while the static WebP files are already optimal.
- *Tracing the logos to SVG*: no time three days out, and the artwork is raster collage anyway.

## 10. Fonts

**What the design uses**: the font metadata in `Workfiles/Rizn Fear Factor.ai` lists three
OpenType fonts.

| Design font | Likely role in the artwork | Role in the app |
|---|---|---|
| **Cubano** Regular | "Grades 7–12" and other rounded display type | headings, nicknames, costume titles |
| **Asket Condensed** ExtraBold | tight condensed caps | kickers, stage labels, countdown digits, pass number |
| **Kuhlman** Regular | hand-drawn accents | optional accent only (for example the small "as") |

Two of the three appear in the file as `.15493.otf` and `.62320.otf`. That is how Adobe Creative
Cloud names fonts it has synced from **Adobe Fonts**. Adobe Fonts' licence does not allow
self-hosting the font files on a website. Web use goes through Adobe's own font servers, which
would be a third-party origin and is not allowed under constitution I and the CSP. The
`media-bundle/Font/` folder was still empty on 2026-10-27.

**Decision**: each design font gets its own slot, self-hosted with `next/font/local` from
`src/fonts/`.
- A font file is used only if RIZN provide it **and** its licence allows self-hosted web embedding
  in a public repo. Desktop-only and Adobe Fonts licences don't qualify.
- Otherwise the slot uses an open-licensed (OFL) look-alike, loaded with `next/font/google`.
  `next/font` downloads it at build time and serves it from our own origin, as it does for Creepster
  today.

| Slot | CSS variable | Licensed original | OFL fallback |
|---|---|---|---|
| Display | `--font-display` | Cubano | **Lilita One** |
| Condensed | `--font-condensed` | Asket Condensed ExtraBold | **Barlow Condensed** 800 |
| Accent | `--font-accent` | Kuhlman | none: falls back to `--font-display` |
| Body | `--font-body` | n/a | **Nunito** (unchanged) |

- Creepster is retired.
- Swapping in a licensed file later is a one-line change per slot in `src/app/layout.tsx`.

**Rationale**:
- No request goes to a font CDN, so CSP `font-src 'self'` holds.
- Lilita One and Barlow Condensed are the closest open matches in weight and shape. Both read
  clearly at nickname sizes in a dim room. Creepster's dripping letterforms clash with the collage
  style and are hard to read.
- Keeping slots means the app looks right today and can match the poster exactly once licensed files
  arrive.

**Alternatives rejected**:
- *Extracting fonts from the `.ai` file*: they're only subsets, and the licence forbids it.
- *Adobe Fonts web kits*: a third-party script and stylesheet origin, forbidden by constitution I.
- *Copying files from a designer's synced Creative Cloud fonts*: not licensed for web use.

## 11. Order of delivery

**Decision**: Build and deploy in this order, each one shippable on its own:
1. vote change + costume title (P1, one migration);
2. countdown;
3. palette + imagery + fonts;
4. pass flip + scan + "Your costume" card.

The production rehearsal (001 T087) runs after step 4, or after whichever step is last when time runs
out, and before 2026-10-30 18:30.

**Rationale**: the event is three days out, so the risky, data-touching work goes first while there
is still time to rehearse it. Purely visual work comes later and can be cut.
