---

description: "Task list for Off-Season Static Site"
---

# Tasks: Off-Season Static Site

**Input**: `specs/004-off-season-static-site/` ([plan](./plan.md), [spec](./spec.md), [research](./research.md), [data model](./data-model.md), [contract](./contracts/hosting.md), [quickstart](./quickstart.md))

**Tests**: tests are included for the VANAGEDDON cut-off, the published output (no student data,
no "next week" wording), and the hosting contract, because these are what could embarrass us
(constitution VII) and they're cheap.

**User steps**: some tasks need the user: DNS records at the riznyouth.com host, the local bootstrap
apply, and approving production actions. These are marked **(user)**.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Amend .specify/memory/constitution.md to v3.1.0 (MINOR):
  - Event Scope adds the off-season static page (spec 004), with no student data, and says no
    server holding student data runs off-season.
  - Principle IX's deploy and deletion rules cover the static site.
  - Add a dated note to the Governance record.
- [X] T002 [P] Create site/next.config.ts with `output: "export"`, `images: { unoptimized: true }`,
  `trailingSlash: false`, `poweredByHeader: false`, and `turbopack: { root: path.resolve(__dirname, "..") }`.
  Create site/tsconfig.json extending ../tsconfig.json, with `"paths": { "@/*": ["../src/*"] }` and
  `include` covering `app/**` and `../src/content/**`, `../src/components/BrandMark*`, and
  `../src/styles/**`.
- [X] T003 [P] Add package.json scripts:
  - `"site:assets": "tsx scripts/site-assets.ts"`
  - `"site:build": "npm run site:assets && next build site && tsx scripts/check-site.ts"`
  - `"site:preview": "npx --yes serve site/out -l 4100"`

  Add `site/out/`, `site/.next/`, and `site/public/` to .gitignore, and `site/out/` to the ESLint
  ignores in eslint.config.*.

## Phase 2: Foundational (blocks all stories)

- [X] T004 Create src/content/offseason.ts per data-model.md, exporting `OFFSEASON`:
  - `title: "RIZN Youth"` and a description;
  - `thanks` in the past tense ("Thanks for coming to Fear Factor 2026!");
  - `weekly` and `instagram` imported from `RIZN_INFO` in src/content/rizn.ts (single source);
  - `backNextYear: { heading: "Fear Factor will be back", body: "See you next October." }`;
  - `nextEvent: { kicker: "Friday, November 6", heading: "VANAGEDDON", body: [...dateless wording], photoAlt, endsAt: "2026-11-06T21:30:00-07:00" } | null`.

  Constraint: no text may say "next week", "next Friday", or "tonight" (FR-307).
- [X] T005 [P] Create src/lib/nextEvent.ts exporting `isEventOver(endsAt: string, nowMs: number): boolean`,
  and tests/unit/nextEvent.test.ts covering:
  - before → false;
  - exactly at → true;
  - after → true;
  - a bad date → false (keep showing rather than crash).
- [X] T006 [P] Create scripts/site-assets.ts. It copies into site/public/:
  - public/brand/fear-factor-logo.webp and @2x, rizn-youth-white.webp, van.webp, og-image.jpg;
  - src/app/favicon.ico, icon.png, apple-icon.png (to site/public root).

  It fails clearly if any source is missing.
- [X] T007 Create site/app/layout.tsx:
  - the same fonts as src/app/layout.tsx (Lilita One, Barlow Condensed, Nunito via next/font/google);
  - import `@/styles/globals.css`;
  - static `metadata` with `metadataBase: new URL(process.env.SITE_URL ?? "https://fearfactor.riznyouth.com")`;
  - title/description from `OFFSEASON`;
  - openGraph/twitter with `/brand/og-image.jpg` (1200×630);
  - `robots: { index: false, follow: false }`;
  - icons pointing at `/favicon.ico`, `/icon.png`, `/apple-icon.png`.

  No StateProvider and no RehearsalBanner.

**Checkpoint**: `npm run site:build` produces site/out/index.html with the brand styles.

## Phase 3: User Story 1 - Anyone opening the old link sees RIZN Youth info (P1) 🎯 MVP

**Goal**: one static page at the address, with every old path landing on it, over HTTPS, with no
data.

**Independent Test**: on the CloudFront domain, `/`, `/contest`, `/crew`, `/screen?t=x`,
`/api/state`, and `/api/photos/x/full` all return 200 with the RIZN Youth page and the required
headers, and no `Set-Cookie`.

- [X] T008 [US1] Create site/app/page.tsx (+ page.module.css, adapted from src/app/rizn/page.module.css).
  It renders, in this order:
  - BrandMark;
  - the thank-you;
  - `<NextEventGate>` wrapping the VANAGEDDON section with the van photo (US2 adds the gate; render
    it plainly for now);
  - "Every Friday at RIZN";
  - Instagram (a plain link with `rel="noopener noreferrer"`);
  - "Fear Factor will be back";
  - the RIZN Youth sign-off.

  No links to the contest, crew, or pass. Create site/app/not-found.tsx rendering the same page
  component, so 404.html matches.
- [X] T009 [P] [US1] Create scripts/check-site.ts. It asserts:
  - site/out contains index.html, 404.html, favicon.ico, icon.png, apple-icon.png,
    brand/og-image.jpg, and brand/van.webp;
  - index.html contains `og:image` with `https://fearfactor.riznyouth.com/brand/og-image.jpg`, and
    `noindex`;
  - the HTML contains none of: "next week", "next Friday", "tonight", "/api/", "Night Pass";
  - no `<script src=` or `<link href=` points at another origin.

  It exits non-zero on failure.
- [X] T010 [P] [US1] Create infra/static-site/ (main.tf, variables.tf, outputs.tf, providers with a
  `us_east_1` alias, an S3 backend like infra/lightsail, and `default_tags { app = "rizn-fear-factor" }`):
  - **Bucket**: `aws_s3_bucket` named `${name}-site-${account}`, with versioning, AES256, all
    public access blocked, and `aws_s3_bucket_policy` allowing `s3:GetObject` only to
    `cloudfront.amazonaws.com` with `AWS:SourceArn` = the distribution.
  - **Certificate**: `aws_acm_certificate` (provider us_east_1, DNS validation) for `var.domain`.
  - **Validation**: `aws_acm_certificate_validation`, created only when `var.cert_validated = true`.
  - **OAC**: `aws_cloudfront_origin_access_control` (sigv4, always).
  - **Headers**: `aws_cloudfront_response_headers_policy` with the CSP and headers from
    contracts/hosting.md.
  - **Distribution**: `aws_cloudfront_distribution`, created only when `var.cert_validated = true`,
    with:
    - aliases `[var.domain]`, `default_root_object = "index.html"`, `price_class = "PriceClass_100"`,
      `http_version = "http2and3"`;
    - viewer protocol `redirect-to-https`;
    - the managed CachingOptimized cache policy;
    - `custom_error_response` for 403 and 404 → `/index.html` with response code 200 and TTL 60;
    - viewer certificate from the validation, `sni-only`, `TLSv1.2_2021`.
  - **Outputs**: `validation_records` (name/type/value), `bucket`, `distribution_id`,
    `distribution_domain`.
- [X] T011 [US1] Extend infra/bootstrap/main.tf permissions for the GitHub role:
  - `s3:*` on `arn:aws:s3:::rizn-fear-factor-site-*` and `/*`;
  - `cloudfront:*` and `acm:*` (CloudFront and ACM have limited resource-level IAM; matches the
    Lightsail approach);
  - keep the existing statements.

  Note in infra/README.md that this needs a local `terraform apply` by an admin **(user or admin
  credentials)**.
- [X] T012 [P] [US1] Create .github/workflows/site-infra.yml, modelled on infra.yml:
  - manual trigger with inputs `action` (plan/apply/destroy), `confirm`, and `cert_validated`
    (boolean);
  - OIDC in the production environment, then `terraform -chdir=infra/static-site` init (state key
    `static-site/terraform.tfstate`) / plan / apply;
  - the job summary prints the validation CNAME and the distribution domain.
- [X] T013 [US1] Create .github/workflows/site.yml:
  - manual trigger, plus pushes to main touching `site/**`, `src/content/**`, `public/brand/**`,
    `src/styles/**`, or `src/components/BrandMark*`;
  - steps: `npm ci`, `npm run typecheck`, `npm run site:build` (with `SITE_URL` from the `PUBLIC_URL`
    variable), then OIDC;
  - upload: `aws s3 sync site/out s3://$SITE_BUCKET --delete` with cache headers per research §5
    (two passes: `_next/static/*` immutable; HTML/txt `max-age=60`; the rest one day);
  - then `aws cloudfront create-invalidation --paths "/*"`;
  - it runs only when the `SITE_BUCKET` and `SITE_DISTRIBUTION_ID` variables are set.
- [ ] T014 [US1] Run the site infrastructure, part 1 **(user approval)**: apply with
  `cert_validated=false`, then give the user the validation CNAME to add at the riznyouth.com DNS
  host **(user)**.
- [ ] T015 [US1] Once the certificate is issued, run apply with `cert_validated=true`. Set the GitHub
  variables `SITE_BUCKET` and `SITE_DISTRIBUTION_ID`, run *Publish site*, and verify per
  quickstart.md "Verify before switching DNS" (all contract paths return 200 with the page, the
  headers are present, and there's no Set-Cookie).

## Phase 4: User Story 2 - VANAGEDDON retires itself (P1)

**Goal**: the section shows until Nov 6, 9:30pm (Edmonton) and then disappears with no redeploy.

**Independent Test**: in the built site, with the browser clock mocked before and after `endsAt`,
the section is present before and gone after. With JavaScript disabled, it still reads sensibly.

- [X] T016 [US2] Create site/app/NextEventGate.tsx (a client component). It renders its children
  until `isEventOver(endsAt, Date.now())`, re-checks every 60 s, and renders nothing after that. On
  the server and in the export it renders the children, so the no-JS HTML keeps the dateless
  section. Wrap the VANAGEDDON section in site/app/page.tsx with it, and render nothing when
  `OFFSEASON.nextEvent` is null.
- [X] T017 [US2] Add tests/e2e/site.spec.ts in a separate Playwright project, `site`, in
  playwright.config.ts. Its `webServer` is `npx serve site/out -l 4100` and its baseURL
  `http://localhost:4100`. It checks:
  - with `page.clock.setFixedTime("2026-11-06T20:00:00-07:00")`, the VANAGEDDON heading and van
    image are visible;
  - with `2026-11-07T08:00:00-07:00` it is gone, while Fridays and Instagram are still visible;
  - axe WCAG AA has no violations;
  - no request goes to another origin;
  - no cookies are set.

## Phase 5: User Story 4 - Organizers can update the page without a developer (P2)

**Goal**: edit one file, push, and the change is live within 10 minutes. A broken edit never
publishes.

**Independent Test**: change the Friday time, push, and see it live. Push a syntax error and the
workflow fails before upload, leaving the page unchanged.

- [X] T018 [US4] Add a top-of-file guide to src/content/offseason.ts explaining what each field is,
  how to remove VANAGEDDON (`nextEvent: null`), how to add next year's date, and "push to main and
  the site updates in about 3 minutes". Add an "Updating the off-season page" section to README.md.

## Phase 6: User Story 3 - The event server is shut down and its data deleted (P1)

**Goal**: the address serves the static site, and Lightsail and all student data are gone.

**Independent Test**: `dig` shows CloudFront, the site works on a phone, the Lightsail instance no
longer exists, and the deletion is recorded.

- [ ] T019 [US3] **(user)** At the riznyouth.com DNS host, change `fearfactor` from
  `A 3.98.19.181` to `CNAME <distribution_domain>`. Then verify with
  `dig +short fearfactor.riznyouth.com` and run the hosting contract checks against the real
  domain.
- [ ] T020 [US3] **(user approval)** Run the deletion procedure on the server:
  `docker compose exec app npm run purge -- --all && docker compose down -v` in /opt/rizn. Then run
  Actions → *Infrastructure* → `destroy`, and confirm that
  `aws lightsail get-instances --region ca-central-1` no longer lists `rizn-fear-factor`.
- [ ] T021 [US3] Create specs/001-costume-contest/checklists/deletion.md recording the date, the
  operator, the steps run (purge, compose down -v, Terraform destroy), and the verification
  output. Note the offline photo archive (constitution v3.0.0) and its location as RIZN-controlled
  storage.
- [ ] T022 [P] [US3] Clean up: delete the GitHub variables `SERVER_IP` and `SSH_KNOWN_HOSTS`, and
  the GHCR package `rizn-fear-factor` **(user approval)**. Keep `deploy.yml` and `infra/lightsail`
  for next year, and add a header comment saying they're off-season.

## Phase 7: Polish

- [X] T023 [P] Update README.md (an off-season notice at the top: what's live, where the content
  lives, how to publish, how to bring the contest back), infra/README.md (the static-site stack,
  DNS records, and shutdown runbook), and CLAUDE.md (`site/` and its commands; the contest app is
  dormant).
- [ ] T024 Run `npm run typecheck && npm run lint && npm test && npm run site:build && npx playwright test --project=site`,
  then commit and push.

## Dependencies & Execution Order

- **Setup (T001–T003)** comes first, then **Foundational (T004–T007)**.
- **US1**:
  - the page (T008–T009) depends on Foundational;
  - the infrastructure tasks (T010–T012) can run in parallel with the page;
  - T013 depends on T010;
  - T014 and T015 depend on T010–T013 and the user's DNS record.
- **US2 (T016–T017)** depends on T008 and can run before T014.
- **US4 (T018)** depends on T004 and T013.
- **US3 (T019–T022)** depends on US1 being verified live. T020 must wait until T019 is confirmed:
  the server stays up until the DNS switch is done.

```text
Setup → Foundational → US1 page ─┬─ US2 ─┐
                       US1 infra ┘       ├─ US1 deploy/verify → (user DNS) → US3 shutdown → Polish
                                  US4 ───┘
```

## Parallel Opportunities

T002 and T003; T005 and T006; T009, T010, and T012; T022 and T023.

## Implementation Strategy

- **MVP**: Phases 1–3 (the static page live on CloudFront and verified), with US2 folded in before
  publishing so the cut-off works from the first publish.
- **Then**: the user switches DNS, and US3 shuts the server down. The Lightsail site keeps serving
  until the DNS changes, so there is no downtime.
- **Last**: docs.
