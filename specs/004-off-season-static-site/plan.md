# Implementation Plan: Off-Season Static Site

**Branch**: `main` (spec directory `specs/004-off-season-static-site`) | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-off-season-static-site/spec.md`

## Summary

Replace the Lightsail contest server with a single static RIZN Youth page at the same address:

- **Build**: a minimal second Next.js app in `site/`, exported with `output: "export"`. It reuses
  the brand, fonts, and editable content from `src/`.
- **Hosting**: a private S3 bucket behind CloudFront, with an ACM certificate in us-east-1 and
  security headers. CloudFront sends every unknown path to the page, so old QR codes and links
  still land somewhere useful.
- **VANAGEDDON**: it hides itself in the browser after Nov 6, 9:30pm.
- **Publishing**: a GitHub Actions workflow builds, syncs, and invalidates.
- **Shutdown**: after the DNS cut-over, the documented deletion procedure runs and Lightsail is
  destroyed, so nothing dynamic and no student data stays online.
- **Cost**: falls from about $12/month to about $0.

Details: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5, Node 24 (build only)

**Primary Dependencies**: Next.js 16 static export (already installed), Terraform AWS provider ~> 6.0

**Storage**: none (static files in S3)

**Testing**:
- a build check that the expected files exist and that the HTML has no student data or "next week"
  wording;
- a unit test for the VANAGEDDON cut-off;
- a Playwright smoke test against the built `site/out`;
- curl checks against CloudFront.

**Target Platform**: S3 + CloudFront (+ ACM in us-east-1). DNS is changed by hand at the
riznyouth.com host.

**Project Type**: static website, alongside the dormant contest web app

**Performance Goals**: page in under 2 s on a phone (about 200 KB first load including the van
image); served from CloudFront's cache.

**Constraints**:
- no cookies, no third-party requests, `noindex`;
- the same address `fearfactor.riznyouth.com`;
- under $1/month;
- the contest app code stays intact for 2027.

**Scale/Scope**: one page, two Terraform resources groups, one workflow, one shutdown runbook.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Protect minors | No student data on the page: no photos, names, or passes. The server, database, and photos are deleted at shutdown. The offline archive is untouched. | ✅ |
| II. Mobile-first | A static page that works in default browsers with no login. | ✅ |
| III. Bad network | About 200 KB, served from CDN cache. | ✅ |
| IV. Simplicity | A static page replaces a server. No new runtime dependencies. | ✅ |
| V–VII | No voting, stages, or photos off-season. Tests cover the cut-off logic and the published output. | ✅ |
| VIII. Accessible | Same tokens and components. axe runs on the built page. | ✅ |
| IX. Boring operations | One publish workflow, Terraform for the hosting, and a documented shutdown and deletion with a record. | ✅ |
| Event Scope | Needs a MINOR amendment (v3.1.0) to list the off-season static page. | ⚠️ amendment task T001 |

**Post-design re-check**: ✅. No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/004-off-season-static-site/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/hosting.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
site/                              # new: the off-season static app
├── next.config.ts                 # output: "export", images.unoptimized, turbopack.root = repo root
├── tsconfig.json                  # extends ../tsconfig.json; "@/*" → "../src/*"
├── app/layout.tsx                 # fonts, tokens, globals, metadata (metadataBase from SITE_URL)
├── app/page.tsx                   # thank-you, VANAGEDDON (until endsAt), Fridays, Instagram, back next year
├── app/not-found.tsx              # same page, so 404.html is useful too
├── app/NextEventGate.tsx          # client: hides the section after endsAt
└── public/                        # filled by scripts/site-assets.ts (brand images, icons, og image)

src/content/offseason.ts           # new: editable off-season copy (imports weekly/instagram from rizn.ts)
src/lib/nextEvent.ts               # new: isEventOver(endsAt, now) (unit-tested)
scripts/site-assets.ts             # new: copies needed brand files and icons into site/public
scripts/check-site.ts              # new: asserts the out/ files exist, and no student data or "next week" in HTML

infra/static-site/                 # new Terraform stack
├── main.tf                        # S3 (private, versioned), OAC, CloudFront, headers policy, ACM (us-east-1)
├── variables.tf  outputs.tf       # domain, bucket name; outputs: validation CNAME, distribution domain/id
infra/bootstrap/main.tf            # GitHub role: s3 on the site bucket, cloudfront:CreateInvalidation, acm/cloudfront manage

.github/workflows/site-infra.yml   # manual Terraform plan/apply for infra/static-site
.github/workflows/site.yml         # build → check → s3 sync → invalidate

tests/unit/nextEvent.test.ts
tests/e2e/site.spec.ts             # runs against a static server on site/out (separate Playwright project)

.specify/memory/constitution.md    # v3.1.0 Event Scope
README.md, infra/README.md, CLAUDE.md   # off-season section, shutdown runbook
specs/001-costume-contest/checklists/deletion.md   # deletion record
```

**Structure Decision**: Keep the contest app (`src/`) as it is for 2027, and add `site/` as a
separate, export-only Next.js project that imports shared content and styling from `src/`. The
hosting gets its own Terraform stack (`infra/static-site`) with the same state bucket and OIDC role
as the Lightsail stack.

## Delivery Order

1. Constitution v3.1.0, then the content file, the `site/` app, and local build checks.
2. Bootstrap policy, then site infrastructure: apply 1 → add the validation CNAME → apply 2.
3. Publish, then verify on the CloudFront domain and with `--connect-to` on the real name.
4. The user changes DNS, then verifies on a phone.
5. Run the deletion procedure, destroy Lightsail, and record the deletion.

Until step 4, the Lightsail site stays up, so there's no gap.

## Complexity Tracking

None.
