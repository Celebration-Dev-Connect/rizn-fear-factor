# Data Model: Off-Season Static Site

There is no database and no student data. The only "data" is the page content, kept in one file
that organizers can edit.

## Off-season page content (`src/content/offseason.ts`)

| Field | Type | Notes |
|---|---|---|
| `title`, `description` | string | Page title and share-card text |
| `thanks.heading`, `thanks.body` | string | Past-tense Fear Factor 2026 thank-you |
| `weekly.heading`, `weekly.when`, `weekly.where`, `weekly.grades`, `weekly.body[]` | string | Reused from `src/content/rizn.ts` |
| `instagram.heading`, `instagram.body`, `instagram.handle`, `instagram.url` | string | `url` must be `https://www.instagram.com/...` |
| `backNextYear.heading`, `backNextYear.body` | string | "Fear Factor will be back next October" |
| `nextEvent` | object or null | VANAGEDDON: `kicker`, `heading`, `body[]`, `photoAlt`, `endsAt` (ISO with offset). `null` removes the section for good. |

**Rules**:
- The `weekly` and `instagram` sections import from `rizn.ts`, so there is one source of truth.
- Once `endsAt` has passed, the section is hidden in the browser. No text may say "next week" or
  "tonight", because the HTML is served unchanged for a year (FR-307).
- A type check runs in the publish workflow, so a broken edit fails the build and nothing is
  uploaded (FR-309).

## Published files (`site/out/`)

`index.html`, `404.html` (same content), `_next/static/**`, `brand/*.webp` (the logo, RIZN Youth
mark, van, and share card only), `favicon.ico`, `icon.png`, and `apple-icon.png`. No photos of
students are published.
