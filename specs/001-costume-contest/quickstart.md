# Quickstart & Validation: Costume Contest

**Feature**: [spec.md](./spec.md) | **API**: [contracts/api.md](./contracts/api.md)

This guide proves the feature works end to end. Script names refer to `package.json` scripts
created during implementation.

## Prerequisites

- Docker with Compose v2, and Node.js 24 LTS for running tests outside containers.
- `.env` copied from `.env.example`. Required variables:
  - `DATABASE_URL`
  - `CREW_PASSCODE`
  - `SESSION_SECRET` (32+ random bytes)
  - `SCREEN_TOKEN`
  - `PUBLIC_URL`
  - `EVENT_START`, `EVENT_END` (ISO with `-06:00` offset; Edmonton is on MDT until Nov 1)
  - `PHOTO_DELETE_AT`
  - `PHOTO_DIR`
  - `DOMAIN` (production only, for Caddy)

## Local run

```bash
docker compose -f compose.dev.yml up -d db   # PostgreSQL only
npm install
npm run db:migrate
npm run dev                                  # Express + Next on http://localhost:3000
```

For phone testing on your LAN, camera access and `Secure` cookies need HTTPS:
`npm run dev:https` uses a local self-signed certificate.

## Automated checks

| Command | Proves |
|---|---|
| `npm run typecheck && npm run lint` | static checks |
| `npm test` | unit tests: state machine transitions and undo, dense ranking with ties, nickname uniqueness and exhaustion |
| `npm run test:integration` | against a real PostgreSQL (`compose.test.yml`): one vote per pass under duplicate and concurrent requests, no self-vote, no voting outside `voting_open`, release on entry removal, void/restore, photo gating by pass, crew, screen and realm, EXIF stripped, 410 after the delete date, idempotent replays, rehearsal wipe leaving live data untouched |
| `npx vitest run tests/integration/votes.test.ts -t "self-vote"` | example of running a single test |
| `npm run test:e2e` | Playwright on iPhone and Pixel profiles: scan to pass to vote in under 60 s, reload and back cannot re-vote, reduced-motion reveal |
| `npm run test:load` | 400 simulated phones polling `/api/state` plus 350 votes in 60 s. Pass: p95 under 300 ms, 0 errors, 0 duplicate votes (SC-002, SC-005) |

The constitution (Principle VII) requires the integration suite to pass before any merge that
touches voting, stages, or photos.

## Manual rehearsal (run on the production server before doors open)

1. Open `/crew` and sign in with `CREW_PASSCODE`, choosing the device label "Crew phone 1".
2. Turn on **Rehearsal**. Every screen now shows the REHEARSAL banner.
3. Open the screen link from the dashboard on the projector. It shows the QR code, an empty
   gallery, and "0 of 0 votes".
4. Scan the QR code with three phones. Each gets a different nickname and number, even though
   it is outside the event window.
5. On `/crew/entries`, add two entries from those passes and a third from a crew-created pass.
   Saving without ticking consent must be blocked. Each entry appears on the screen within 5 s.
6. Advance to **Voting open**.
   - Phone 1 votes and sees the thank-you screen. Reload and press back: it cannot vote again.
   - Phone 2 cannot select its own costume.
   - Use `/crew/assist` to cast a vote for the crew-created pass.
7. Remove one entry that has a vote. Its voter can vote again.
8. Sort `/crew/votes` by pass creation time. Void a vote, then restore it.
9. Advance to **Voting closed**, then open `/crew/results`. Arrange a tie and confirm it shows as
   a shared place.
10. Reveal 3rd, 2nd, and 1st one at a time. Undo one step and confirm it is hidden again.
11. **Wipe rehearsal data** (type `WIPE`) and turn rehearsal off. The dashboard shows 0 passes and
    0 votes, the stage is setup, and the photo directory has no rehearsal files.

## Deploy

```bash
./scripts/deploy.sh   # docker compose up -d --build, waits for /healthz
```

## Data deletion (after the event)

Photos stop being served at `PHOTO_DELETE_AT` and are purged hourly after that. To finish
deletion:

```bash
docker compose exec app npm run purge -- --all   # deletes photo files and all rows
docker compose down -v                           # removes the database and photo volumes
```

Record the date and the operator in the event notes (constitution, Event Scope: deletion
verified and recorded).
