# Contract: Off-Season Hosting Behaviour

Base: `https://fearfactor.riznyouth.com`, served by CloudFront from a private S3 bucket.

| Request | Response |
|---|---|
| `GET /` | `200 text/html`: the off-season page |
| `GET /index.html` | `200`, same page |
| Any unknown path: `/contest`, `/crew`, `/crew/entries`, `/screen?t=…`, `/rizn`, `/api/state`, `/api/photos/…/full`, `/anything` | `200 text/html`: the off-season page (CloudFront error response 403/404 → `/index.html`, 200) |
| `GET /_next/static/…` | `200` with `Cache-Control: public, max-age=31536000, immutable` |
| `GET /brand/*.webp`, `/favicon.ico`, `/icon.png`, `/apple-icon.png` | `200` with a 1-day cache |
| `http://…` | `301` to `https://` |

**Headers on every response** (response headers policy):
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
- `Strict-Transport-Security: max-age=31536000`
- `X-Robots-Tag: noindex`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**Never**: `Set-Cookie`, requests to other origins (apart from the user tapping the Instagram
link), or any student data in the HTML.

**Link preview**: `og:title`, `og:description`, and `og:image =
https://fearfactor.riznyouth.com/brand/og-image.jpg`, plus `twitter:card = summary_large_image`.
The domain is fixed at build time from `SITE_URL`.
