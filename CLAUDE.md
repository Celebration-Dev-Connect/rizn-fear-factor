# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RIZN Fear Factor Night Pass: a small mobile web app for one youth event (RIZN Youth, Celebration
Church, Edmonton, grades 7–12) on **Friday, October 30, 2026**. The first release is a costume
contest only: students get an anonymous Night Pass and vote once; crew add costume photos, run
the contest stages, and reveal winners on a big screen.

## Stack

TypeScript on Node 24, as a single process: Express 5 serves `/api` and mounts Next.js 16 for
the pages. Data lives in PostgreSQL 17 through Drizzle, and photos are WebP files on a private
volume. Deployment is Docker Compose (`app`, `db`, `caddy`) on one server. Redis is deliberately
not used. Rationale is in `specs/001-costume-contest/research.md`, and the layout is in `plan.md`.

Commands (full list in `README.md`):

- `npm run dev`: local server (needs `docker compose -f compose.dev.yml up -d --wait` and `npm run db:migrate`)
- `npm run typecheck`, `npm run lint`
- `npm test`: unit tests; `npm run test:integration`: real PostgreSQL via `compose.test.yml`
- Single test: `npx vitest run tests/integration/votes.test.ts -t "self-vote"`
- `npm run test:e2e`: Playwright (runs against the dev server; uses and wipes the rehearsal contest)
- `npm run test:load`: autocannon (`LOAD_BASE_URL`, `CREW_PASSCODE`)
- `npm run brand:assets`: rebuild `public/brand/*.webp`, favicons, the share card, and the optional
  van photo from `media-bundle/` (gitignored RIZN artwork)
- Production deploy: GitHub Actions *Deploy* workflow (see `infra/README.md`); `./scripts/deploy.sh` is for other servers

Rules the code has to keep:

- One-vote enforcement lives in a PostgreSQL partial unique index plus transactions, not only
  in app code. A pass has at most one `counted` vote; changing a vote marks the old row `replaced`
  and inserts a new one (spec 002), so never update `entry_id` in place.
- Every table carries a `realm` column (`live` or `rehearsal`), and requests act on the active
  realm.
- Every mutation must carry an `Idempotency-Key` header.
- `/api/state` is the hot poll path and must not touch the database. It is mounted before
  `loadIdentity` in `src/server/app.ts`.
- Server code lives in `src/server` (Express) and pages in `src/app` (Next.js). Both use the
  `@/` alias, and production runs the TypeScript server with `tsx`.
- Drizzle wraps Postgres errors. Use `isUniqueViolation` from `src/server/db/errors.ts`.

## Where things live

- `.specify/memory/constitution.md`: the project's binding rules. Read it before planning or
  writing code; specs, plans, and PRs must comply.
- `specs/NNN-feature-name/`: one directory per feature, holding `spec.md` and later `plan.md`
  and `tasks.md`. The current feature is `specs/003-names-and-rizn-info/` (built on 001 and 002). The `/rizn`
  page copy lives in `src/content/rizn.ts`.
- `.specify/feature.json`: gitignored pointer to the active feature directory, used by the
  Spec Kit scripts.

## Workflow

Work goes through Spec Kit skills in order: `/speckit-specify` → `/speckit-clarify` (optional)
→ `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Use `/speckit-analyze` to check
spec, plan, and tasks for consistency.

Rules from the constitution that are easy to break while coding:

- Never store student last names, contact details, or any text a student types. Crew may type a
  short costume title ("Superman") and, optionally, a contestant's single first name (constitution
  v2.0.0, spec 003); names never go in the audit log and are cleared when the entry is removed.
  Students are identified by a generated nickname and a first-party cookie.
- Photos must stay private (no public URLs), served only to a valid pass, crew session, or
  big-screen link.
- No third-party analytics, trackers, embeds, or other-origin scripts.
- Contest stage changes come only from crew actions, never timers. The voting close time is
  display-only (the big-screen countdown).
- Vote enforcement, the stage state machine, and photo handling must have automated tests.

## Commit early and often

1. Commit after each completed unit of work, such as a finished task from `tasks.md`, a passing
   test, or an updated spec or plan. Don't batch unrelated changes.
2. Run the tests touched by the change before committing, once a test suite exists.
3. Stage specific paths (`git add <paths>`), check `git status` and the diff, and confirm no
   secrets or `.env` files are included.
4. Use conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) that name the task
   or requirement, for example `feat: enforce one vote per pass (FR-009)`.
5. Work directly on `main`.
