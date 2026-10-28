# RIZN Fear Factor Night Pass

Costume contest web app for RIZN Fear Factor at Celebration Church, Edmonton (grades 7–12),
**Friday, October 30, 2026, 7:00–10:00 pm**.

- **Students** scan a QR code and get an anonymous Night Pass: a generated spooky nickname and
  a pass number. There is no install, no account and no personal information. They browse the
  costumes and cast one vote, which they can change until voting closes. Tapping the pass flips
  it to a QR code for crew, and contestants see their own costume on their pass.
- **Crew** sign in with a shared passcode. They scan a student's pass, photograph the costume with
  consent, add what it is ("Superman"), run the contest stages, review votes, and reveal 3rd, 2nd
  and 1st place.
- **The big screen** shows a rotating gallery ("Midnight Gremlin *as* SUPERMAN"), the join QR
  code, live totals, a countdown to the crew-set voting close time, and the reveal.

Governing documents: [constitution](.specify/memory/constitution.md) ·
[spec](specs/001-costume-contest/spec.md) · [plan](specs/001-costume-contest/plan.md) ·
[API contract](specs/001-costume-contest/contracts/api.md) · contest polish (vote changes,
costume titles, countdown, brand, pass QR): [spec](specs/002-contest-polish/spec.md) ·
[plan](specs/002-contest-polish/plan.md) · [API changes](specs/002-contest-polish/contracts/api.md)

## Stack

One Node 24 process runs both parts: Express 5 serves `/api` and mounts Next.js 16 for the
pages. TypeScript throughout. Data lives in PostgreSQL 17 through Drizzle. Photos are WebP files
on a private volume, with metadata stripped. Production runs on Docker Compose (`app`, `db`,
`caddy`) on one server. There is no Redis and there are no third-party services.

## Local development

```bash
cp .env.example .env          # then fill in values (see below)
docker compose -f compose.dev.yml up -d --wait
npm install
npm run db:migrate
npm run dev                   # http://localhost:3000  (crew: /crew, screen link on the crew dashboard)
```

`npm run seed:dev` fills the rehearsal contest with 5 passes and 3 placeholder costumes
(add `-- --stage voting_open` to start with voting open).

| Command | What it does |
|---|---|
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm test` | Unit tests (state machine, ranking, nicknames) |
| `npm run test:integration` | API tests against a throwaway PostgreSQL (`compose.test.yml`) |
| `npx vitest run tests/integration/votes.test.ts -t "self-vote"` | Run a single test |
| `npm run test:e2e` | Playwright on iPhone (WebKit) and Pixel (Chromium); needs `npm run dev` running |
| `npm run test:load` | 400 polling phones plus 350 votes. Set `LOAD_BASE_URL` and `CREW_PASSCODE` |
| `npm run check:nicknames` | Prints all 1,600 nicknames for staff review |
| `npm run brand:assets` | Rebuilds `public/brand/*.webp` from the RIZN `media-bundle/` folder (not in git) |

The constitution requires `npm run test:integration` to pass before any change to voting,
stages, photos or rehearsal is merged.

## Configuration

Everything is set through `.env`. Nothing secret is committed.

| Variable | Example | Notes |
|---|---|---|
| `DOMAIN` | `fear.example.org` | Production only. Caddy gets the HTTPS certificate |
| `PUBLIC_URL` | `https://fear.example.org` | Encoded in the QR code |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` | Production database password |
| `DATABASE_URL` | `postgres://rizn:rizn@localhost:5432/rizn` | Local dev only. Compose builds it in production |
| `CREW_PASSCODE` | | Shared by all crew |
| `SESSION_SECRET` | `openssl rand -base64 48` | At least 32 characters. Signs crew and screen cookies |
| `SCREEN_TOKEN` | `openssl rand -hex 16` | Goes in the big-screen link |
| `EVENT_START` / `EVENT_END` | `2026-10-30T18:30:00-06:00` / `2026-10-30T22:30:00-06:00` | Night Pass window. Crew can adjust it on the dashboard |
| `PHOTO_DELETE_AT` | `2026-11-02T00:00:00-07:00` | Photos stop being served, then are purged |
| `PHOTO_DIR` | `./photos` | Local dev only. Production uses the private `photos` volume |

## Deploy

**AWS Lightsail (the event setup):** Terraform and GitHub Actions do everything. See
[infra/README.md](infra/README.md). The app lives in `/opt/rizn` on the server, and secrets come from the
GitHub `production` environment.

**Any other Linux server** with Docker and DNS for `DOMAIN` pointing at it:

```bash
git clone git@github.com:Celebration-Dev-Connect/rizn-fear-factor.git && cd rizn-fear-factor
cp .env.example .env   # fill in every value
./scripts/deploy.sh    # builds, starts app + db + caddy, waits for https://$DOMAIN/healthz
```

Re-run `./scripts/deploy.sh` to ship an update. Migrations run automatically when the app starts.

## Event-night runbook

1. **Before doors open (rehearsal).** On `/crew`, turn **Rehearsal** on. Run through
   [quickstart.md](specs/001-costume-contest/quickstart.md#manual-rehearsal-run-on-the-production-server-before-doors-open)
   on real phones, then **Wipe rehearsal data**, then turn Rehearsal **off**. Rehearsal can't be
   turned on again once live voting has started.
2. **Big screen.** Copy the screen link from the dashboard into the projector browser. Never
   share it with students.
3. **Entries.** Crew use `/crew/entries`: tap **Scan pass** and point at the student's flipped
   pass (or search by nickname), take the photo, type what the costume is (never a name), tick
   consent, and save. A student without a phone gets **create a pass**.
4. **Voting.** Optionally set **Voting closes at** on the dashboard so the big screen counts
   down. Press **Open voting**, and **Close voting** when the program moves on; the countdown
   never closes voting by itself. Students can change their vote until then. Every change can be
   undone.
5. **Reveal.** On `/crew/results`, check the private ranking (ties share a place), press
   **Start results reveal**, then **Reveal next place** for 3rd, 2nd and 1st.
6. **If the app fails**, fall back to a show of hands. The app has no offline mode.

## After the event: data deletion

Photos stop being served at `PHOTO_DELETE_AT` and are deleted automatically by an hourly check
while the server runs. To complete deletion of all event data:

```bash
docker compose exec app npm run purge -- --all   # deletes photo files and every pass, entry, vote, and log row
docker compose down -v                           # removes the database and photo volumes
```

No database backups are taken, so nothing else holds the data. Record the date and the operator
in the event notes. The constitution requires deletion to be verified and recorded.
