# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RIZN Fear Factor Night Pass: a small mobile web app for one youth event (RIZN Youth, Celebration
Church, Edmonton, grades 7–12) on **Friday, October 30, 2026**. The first release is a costume
contest only: students get an anonymous Night Pass and vote once; crew add costume photos, run
the contest stages, and reveal winners on a big screen.

## Stack (planned; no application code yet)

TypeScript on Node 24, as a single process: Express 5 serves `/api` and mounts Next.js 16 for
the pages. Data lives in PostgreSQL 17 through Drizzle, and photos are WebP files on a private
volume. Deployment is Docker Compose (`app`, `db`, `caddy`) on one server. Redis is deliberately
not used. Rationale is in `specs/001-costume-contest/research.md`, and the layout is in `plan.md`.

Planned commands, per `specs/001-costume-contest/quickstart.md`. Confirm them against
`package.json` once it exists:

- `npm run dev`: local server (needs `docker compose -f compose.dev.yml up -d db`)
- `npm run typecheck`, `npm run lint`
- `npm test`: unit tests; `npm run test:integration`: real PostgreSQL via `compose.test.yml`
- Single test: `npx vitest run tests/integration/votes.test.ts -t "self-vote"`
- `npm run test:e2e` (Playwright), `npm run test:load` (autocannon)
- `./scripts/deploy.sh`: production deploy

Rules the code has to keep:

- One-vote enforcement lives in a PostgreSQL partial unique index plus transactions, not only
  in app code.
- Every table carries a `realm` column (`live` or `rehearsal`), and requests act on the active
  realm.
- Every mutation must carry an `Idempotency-Key` header.

## Where things live

- `.specify/memory/constitution.md`: the project's binding rules. Read it before planning or
  writing code; specs, plans, and PRs must comply.
- `specs/NNN-feature-name/`: one directory per feature, holding `spec.md` and later `plan.md`
  and `tasks.md`. The current feature is `specs/001-costume-contest/`.
- `.specify/feature.json`: gitignored pointer to the active feature directory, used by the
  Spec Kit scripts.

## Workflow

Work goes through Spec Kit skills in order: `/speckit-specify` → `/speckit-clarify` (optional)
→ `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Use `/speckit-analyze` to check
spec, plan, and tasks for consistency.

Rules from the constitution that are easy to break while coding:

- Never store student names, contact details, or free text; crew can't type contestant names
  either. Students are identified only by a generated nickname and a first-party cookie.
- Photos must stay private (no public URLs), served only to a valid pass, crew session, or
  big-screen link.
- No third-party analytics, trackers, embeds, or other-origin scripts.
- Contest stage changes come only from crew actions, never timers.
- Vote enforcement, the stage state machine, and photo handling must have automated tests.

## Commit early and often

1. Commit after each completed unit of work, such as a finished task from `tasks.md`, a passing
   test, or an updated spec or plan. Don't batch unrelated changes.
2. Run the tests touched by the change before committing, once a test suite exists.
3. Stage specific paths (`git add <paths>`), check `git status` and the diff, and confirm no
   secrets or `.env` files are included.
4. Use conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) that name the task
   or requirement, for example `feat: enforce one vote per pass (FR-009)`.
5. Do feature work on a feature branch named after its spec directory (for example
   `001-costume-contest`), not on `main`.
