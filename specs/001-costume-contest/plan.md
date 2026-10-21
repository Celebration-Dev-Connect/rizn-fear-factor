# Implementation Plan: Costume Contest

**Branch**: `001-costume-contest` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-costume-contest/spec.md`

## Summary

This is an anonymous costume contest for RIZN Fear Factor on 2026-10-30:
- Students get a Night Pass (a generated nickname and a cookie) and cast one vote.
- Crew add costume photos, run four reversible stages, and reveal 3rd, 2nd, and 1st place on a
  big screen.
- A rehearsal realm lets the team practise, then wipe the practice data.

The technical approach is one TypeScript Node process: Express serves `/api` and mounts Next.js
for the pages. It is backed by PostgreSQL, with photos on a private disk volume, and runs on one
Docker host behind Caddy. Phones poll small, ETag'd JSON. One-vote enforcement lives in database
constraints and transactions. Redis is not needed at this scale
([research §2](./research.md#2-redis-not-used)).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 LTS

**Primary Dependencies**:
- Next.js 16 (App Router) and React 19
- Express 5
- drizzle-orm and `pg`, with drizzle-kit for migrations
- zod for request validation
- multer and sharp for photos
- qrcode
- cookie-signature for signed cookies

**Storage**: PostgreSQL 17 (all records). Photos are WebP files on a private Docker volume. No
Redis.

**Testing**:
- Vitest for unit tests
- Vitest + Supertest integration tests against a real PostgreSQL
- Playwright end-to-end tests (WebKit/iPhone and Chromium/Pixel profiles)
- autocannon load script

**Target Platform**: A Linux VPS running Docker Compose (`app`, `db`, `caddy`). Clients are iOS
Safari and Android Chrome (latest two versions), plus a projector browser.

**Project Type**: Web application (single full-stack Node service)

**Performance Goals**:
- 400 phones polling every 3 s (±0.5 s jitter), which is about 135 req/s.
- A burst of 350 votes in 60 s.
- p95 API latency under 300 ms.
- Crew actions visible on the big screen and student phones within 5 s, worst case (SC-004).

**Constraints**:
- No third-party requests at runtime.
- Student payloads are small: the `/api/state` poll body is under 1 KB, thumbnails are about
  25 KB, and the initial page JS is under 200 KB gzipped.
- Every mutation is idempotent.
- No timers change contest state.
- WCAG AA.

**Scale/Scope**: About 350 students and about 10 crew for one night, roughly 30–80 entries,
8 page routes, and about 25 API endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the design complies | Status |
|---|---|---|
| I. Protect minors first | No personal fields in any table, and contestant names can't be typed (FR-016). Photos are crew-only uploads, re-encoded with EXIF stripped, stored privately, and served only to pass, crew, or screen cookies with no public URLs. They are deleted at `PHOTO_DELETE_AT` and by the purge script. Fonts are self-hosted and QR codes are made on the server, so there are no third-party scripts, analytics, or embeds. | ✅ |
| II. Mobile-first, zero-install | Plain web pages with no install and no login. Identity is a first-party HttpOnly cookie. Tested on WebKit and Chromium mobile profiles. | ✅ |
| III. Built for a bad network | Images are resized on the client and re-encoded on the server. Polling uses ETag/304, jitter, and backoff, with no WebSockets or SSE. Every mutation uses an `Idempotency-Key`. | ✅ |
| IV. Simplicity | One process, no Redis, no cache service, no component library. `passes` is a stand-alone table that future features reference. | ✅ |
| V. Fair and auditable voting | A partial unique index plus transactional checks. Every vote and crew action is in `audit_events`. Void and restore are supported. Counts appear only in the crew ranking after voting closes. | ✅ |
| VI. Crew in control | Stages change only through `POST /api/crew/stage` with an expected `from`. Undo is supported at every step. The hourly purge deletes photos only and never touches `contest`. | ✅ |
| VII. Test what can embarrass us | The integration suite covers vote rules, the state machine, photo gating and deletion, and rehearsal wipe. Rehearsal realm plus one-action wipe. | ✅ |
| VIII. Accessible in a dim room | Contrast-checked tokens, 44 px minimum targets, generated alt text, icon and text labels on status (never color alone), and a static reveal under `prefers-reduced-motion`. Checked by an axe pass in Playwright. | ✅ |
| IX. Boring operations | One app image (the Compose stack adds only PostgreSQL and Caddy), configuration from `.env`, `.env.example` committed with no values, `./scripts/deploy.sh`, and the deletion procedure in quickstart. | ✅ |

**Gate result (pre-research)**: PASS.

**Gate result (post-design)**: PASS. The data model and contracts introduce no new services,
personal data, or timer-driven state. Two design choices go slightly beyond the spec, both in
support of the constitution:
1. Rehearsal mode cannot be turned on once the live contest has left setup. This protects live
   data on the night.
2. Crew device labels are picked from a fixed list rather than typed, which keeps free text out
   of the database.

## Project Structure

### Documentation (this feature)

```text
specs/001-costume-contest/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and rationale
├── data-model.md        # Phase 1: tables, constraints, state machine
├── quickstart.md        # Phase 1: run, test, rehearse, deploy, delete
├── contracts/
│   └── api.md           # Phase 1: HTTP API and page routes
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── server/                 # Express
│   ├── index.ts            # boots Express, mounts /api, hands the rest to Next
│   ├── config.ts           # env parsing (zod); fails fast on missing values
│   ├── db/
│   │   ├── schema.ts       # Drizzle tables (data-model.md)
│   │   └── client.ts
│   ├── middleware/         # pass/crew/screen auth, idempotency, rate limit, errors
│   ├── routes/             # state, pass, entries, votes, results, photos, crew/*
│   ├── services/           # contest state machine, voting, entries, ranking,
│   │                       #   photos, rehearsal, audit, purge
│   └── nicknames.ts        # curated adjective × noun lists
├── app/                    # Next.js App Router pages (contracts/api.md#page-routes)
│   ├── page.tsx            # Night Pass
│   ├── contest/
│   ├── crew/
│   └── screen/
├── components/             # PassBadge, Gallery, VoteConfirm, StageControls, Reveal, …
├── lib/                    # client polling hook, API client with idempotency keys,
│                           #   client image resize
├── shared/                 # types and zod schemas shared by server and client
└── styles/                 # tokens.css (palette, spacing, 44 px targets), globals

drizzle/                    # generated SQL migrations
scripts/                    # deploy.sh, purge.ts, load-test.ts
tests/
├── unit/                   # state machine, ranking, nicknames
├── integration/            # Supertest + PostgreSQL: votes, stages, photos, rehearsal
└── e2e/                    # Playwright mobile flows and axe checks

Dockerfile                  # multi-stage: build Next + server, slim runtime
compose.yml                 # app, db, caddy (production)
compose.dev.yml             # db only for local dev
compose.test.yml            # throwaway PostgreSQL for integration tests
Caddyfile
.env.example
```

**Structure Decision**: This is a single package, not separate `frontend/` and `backend/`
projects. Express and Next.js run in the same process and image (one deployable unit,
same-origin cookies). The split stays in the code: `src/server` is the Express backend and
`src/app` + `src/components` is the Next.js frontend, with types shared through `src/shared`.

## Complexity Tracking

No constitution violations to justify.
