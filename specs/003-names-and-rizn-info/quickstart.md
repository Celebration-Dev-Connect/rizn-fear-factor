# Quickstart: First Names and RIZN Youth Info

```bash
npm run db:migrate            # applies drizzle/0002_first_names.sql
npm run brand:assets          # after adding the van photo to media-bundle/ (see below)
npm run dev
npm test && npm run test:integration && npm run test:e2e
```

**Van photo**: save it as `media-bundle/van.jpg` (or `.png`/`.jpeg`/`.heic` → convert to jpg first),
then run `npm run brand:assets`. It writes `public/brand/van.webp` and flips `src/content/van.json`
to `{ "photo": true }`. Commit both and deploy.

**Editing the page wording**: `src/content/rizn.ts`.

## Manual checks (in rehearsal mode)
1. Add an entry with the first name "Ben" and the costume "Superman". The gallery, big screen,
   vote dialog, and the contestant's pass read "Ben as SUPERMAN".
2. Try "Ben Smith", "B3n", and 21 letters. Each is refused with "First name only".
3. Remove the entry, then search the pass by "Ben". There's no match: the name is gone.
4. Open `/rizn` in a private window. It loads without a pass.
5. Tap "More about RIZN Youth" on the pass. After revealing 1st place, the big screen shows the
   VANAGEDDON panel, and its QR code opens `/rizn`.
