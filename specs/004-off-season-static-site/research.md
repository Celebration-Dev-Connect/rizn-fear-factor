# Research: Off-Season Static Site

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1. How to build the static page

**Decision**: A second, minimal Next.js app in `site/` with `output: "export"`, built with
`next build site`.
- It shares the repo's `node_modules`, so there are no new dependencies.
- It imports the content file, logo component, tokens, and fonts from `src/` through the `@/`
  alias. `turbopack.root` is set to the repo root so imports outside `site/` resolve.
- Output goes to `site/out/`: `index.html`, `404.html`, and hashed `_next/static` assets, plus the
  brand images, favicons, and share card copied from `public/`.

**Rationale**:
- Static export only works when nothing needs a server. The contest app needs one in many places
  (Express API, `headers()` in `generateMetadata`, `/api/...` calls), so exporting it in place
  would mean rewriting it, and next year's contest needs it back as is.
- A tiny second app keeps the contest app untouched and reuses the look, the fonts (`next/font`
  self-hosts them at build time), and the editable content.

**Alternatives rejected**:
- *Export the existing app with a flag*: every contest route would ship as a broken shell, and the
  dynamic metadata would have to be split.
- *Hand-written HTML*: the brand would drift from the app, and the fonts and favicons would be
  duplicated by hand.
- *A separate repo*: two places to edit the content.

**Fallback**: if `next build site` can't import from `../src` under Next 16, copy the four shared
files into `site/` at build time with a small prebuild script. The output is the same.

## 2. VANAGEDDON retiring itself

**Decision**:
- The content file gets `nextEvent.endsAt = "2026-11-06T21:30:00-07:00"` (MST).
- The section is in the static HTML with date-neutral wording ("Friday, November 6") and the van
  photo.
- A tiny client component removes the section, and the leading "next" wording, once
  `Date.now() > endsAt`, checked on load and every minute.
- With scripts off, the wording stays true after the date because it never says "next week".

**Rationale**: A static host can't change content by itself, and a scheduled redeploy is something
that can break unnoticed. A client-side date check is free and always runs. A wrong phone clock
only shifts the cut-off for that one phone, which is harmless.

**Alternatives rejected**:
- *Scheduled GitHub Action to republish on Nov 7*: more moving parts, and it fails silently.
- *CloudFront Function by date*: works, but adds code at the edge for one date.

## 3. Hosting

**Decision**:
- **Bucket**: a private S3 bucket in `ca-central-1` with versioning, all public access blocked,
  and the `app = rizn-fear-factor` tag.
- **CloudFront**: one distribution with Origin Access Control, so only CloudFront can read the
  bucket.
  - `default_root_object = index.html`.
  - Custom error responses 403/404 → `/index.html` with status 200, so every old path (`/contest`,
    `/crew`, `/api/...`, `/screen?t=...`) shows the page (FR-302).
  - Price class 100 (North America and Europe), HTTP/2 and HTTP/3, and a redirect from HTTP to
    HTTPS.
- **Response headers policy**:
  - a CSP equivalent to the app's (`default-src 'self'`; `script-src 'self' 'unsafe-inline'`, which
    Next's static export needs; `img-src 'self' data:`; `font-src 'self'`; `frame-ancestors 'none'`);
  - `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options`,
    `Permissions-Policy`, and HSTS (1 year).
- **Certificate**: an ACM certificate in **us-east-1** (CloudFront requires it there) for
  `fearfactor.riznyouth.com`, validated by DNS.

**Rationale**:
- Cost: well within CloudFront's always-free tier (1 TB and 10 M requests a month), S3 storage
  under 1 MB, and a free ACM certificate. That comes to about $0.00–0.05 a month (SC-302).
- No server and no data. The headers keep the constitution's same-origin and no-tracking rules.

**Alternatives rejected**:
- *S3 static website endpoint alone*: no HTTPS on a custom domain.
- *Amplify Hosting*: fine, but it's a second deploy system next to the existing Terraform and
  GitHub Actions.
- *GitHub Pages*: free, but it can't send unknown paths to the page with a 200 status, and its
  headers can't be controlled.

## 4. DNS (managed outside AWS)

`riznyouth.com` is not a Route 53 zone in this account, so DNS changes are manual. There are two
one-time records:
1. **Certificate validation**: a CNAME that Terraform outputs (`_xxxx.fearfactor.riznyouth.com →
   _yyyy.acm-validations.aws`). Leave it in place so the certificate renews automatically.
2. **Cut-over**: change `fearfactor.riznyouth.com` from `A 3.98.19.181` to `CNAME
   dxxxx.cloudfront.net`. Lower its TTL to 300 a day before if the DNS host allows it.

**Decision**: Terraform runs in two steps.
- The first apply creates the certificate and outputs the validation record.
- `aws_acm_certificate_validation` waits (up to 45 min) until the record is in place.
- The second apply creates the distribution with the alias.

The site is verified on the `*.cloudfront.net` name, then with `curl --connect-to` on the real
name, before the DNS is changed.

## 5. Publishing

**Decision**:
- A GitHub Actions workflow `site.yml`, run by hand or on pushes to `main` that touch `site/**`,
  `src/content/**`, or `public/brand/**`. Steps: `npm ci` → typecheck → `next build site` → a check
  that `site/out/index.html` exists → `aws s3 sync site/out s3://<bucket> --delete` → CloudFront
  invalidation of `/*`.
- Cache control: HTML and the `.txt` files Next emits get `max-age=60`; `_next/static/*` and fonts
  are `public, max-age=31536000, immutable`; images get one day.
- It uses the existing GitHub OIDC role, so there are no keys. The bootstrap policy gains S3 access
  to the site bucket and CloudFront create-invalidation on that distribution.

**Rationale**:
- A failed build stops before the sync, so the live page stays as it was (FR-309).
- The first 1,000 invalidation paths each month are free.
- A content change is live in about 2–4 minutes (SC-306).

## 6. Shutting down the event server

**Decision**: run it after the cut-over is verified and the DNS has propagated.
1. On the server, run `docker compose exec app npm run purge -- --all`, then
   `docker compose down -v` (the documented deletion procedure).
2. Run Actions → *Infrastructure* → `destroy`, which deletes the instance, its disks, the static
   IP, and the firewall.
3. Record the date and operator in `specs/001-costume-contest/checklists/deletion.md` (SC-305).
4. Delete the GHCR image package (it holds code only).
5. Keep the bootstrap (state bucket and OIDC role) for the site deploys and next year.
- The `deploy.yml` workflow stays in the repo but isn't run off-season.
- Remove the `SERVER_IP` and `SSH_KNOWN_HOSTS` variables after the destroy.

## 7. Constitution

A MINOR amendment (v3.1.0):
- Event Scope adds the off-season static page (spec 004) and states that no server holding student
  data runs off-season.
- Principle IX's one-command deploy and documented deletion apply to the site as well.
No principle is weakened.
