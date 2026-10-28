# Implementation Plan: First Names and RIZN Youth Info

**Branch**: `main` (spec directory `specs/003-names-and-rizn-info`) | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

## Summary

There are two changes, and both extend the existing app without adding new services:

- **First names**: a nullable, validated `passes.first_name`, set only by crew. Each pass then
  displays as its first name instead of its nickname everywhere an entry label is built, because
  `displayNames()` already feeds every label.
- **RIZN Youth page**: a static, public `/rizn` page whose wording lives in `src/content/rizn.ts`.
  It is linked from the Night Pass and the "event has ended" screen, and the big screen shows a
  VANAGEDDON panel with a QR code to it once 1st place is revealed.

## Technical Context

**Language/Version**: TypeScript 5, Node 24 (unchanged)
**Primary Dependencies**: unchanged (Express 5, Next.js 16, Drizzle, zod, sharp, qrcode)
**Storage**: PostgreSQL 17, one additive migration (`0002_first_names`)
**Testing**: Vitest unit and integration, Playwright e2e and axe
**Target Platform**: the existing Lightsail Compose stack at https://fearfactor.riznyouth.com
**Project Type**: web application (single Express + Next.js process)
**Performance Goals**: no new polling. `/api/state` is untouched. `/rizn` is a light page served
by the app, with no API calls.
**Constraints**: same-origin only, and the 44 px, AA, and reduced-motion rules apply. The event
is 2026-10-30.
**Scale/Scope**: one column, three endpoints extended, one page, and three link points.

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I (v2.0.0) | A first name only, optional, crew-entered, consent wording updated, and cleared when the entry is removed. It is deleted with the passes (purge and rehearsal wipe). Audit events log only that a name was set or cleared. `/rizn` holds no student data. | ✅ |
| II | `/rizn` works in default browsers without a pass. | ✅ |
| III | No new polling. Names come back in the existing entries payload. | ✅ |
| IV | Both items were requested by leaders. The page is static content. | ✅ |
| V–VI | No change to voting or stages. | ✅ |
| VII | Integration tests cover name validation, display, clearing, the wipe, and audit privacy. E2E covers `/rizn` and the links. | ✅ |
| VIII | The page and the panel go through the axe suite. The van image has alt text and stickers are aria-hidden. | ✅ |
| IX | The deletion procedure already removes passes, and the README notes that this includes names. | ✅ |

## Design

- **Validation** (`src/shared/schemas.ts`): `firstNameField` trims the input and accepts
  `/^\p{L}(?:[\p{L}]|['’-](?=\p{L})){0,19}$/u` with a maximum of 20 characters. An empty string
  means "clear".
- **API**: `POST` and `PATCH /api/crew/entries` accept a `firstNames` multipart field holding JSON
  `{ [passId]: string }`. Only passes linked to that entry may be named. The names are written in
  the same transaction as the entry, so they share its consent.
- **Display**: `displayNames()` uses `coalesce(first_name, nickname)`. The cards, ranking, vote
  log entry labels, alt text, and the "Your costume" card all inherit it.
- **Removal**: `removeEntry` sets `first_name = null` on its passes inside the transaction.
- **Search**: `searchPasses` also uses `ilike` on `first_name`. Hits carry `firstName` so the form
  can prefill the field.
- **Audit**: `entry.create` and `entry.update` add `firstNamesSet: passId[]` and
  `firstNamesCleared: passId[]`.
- **`/rizn`**: a server component reading `src/content/rizn.ts`. `VAN_PHOTO` is
  `"/brand/van.webp"` when the file exists (detected by `brand:assets`, which writes
  `src/content/van.json`), otherwise `null`. It has page-level metadata.
- **QR for `/rizn`**: `/api/qr.svg?to=rizn` encodes `PUBLIC_URL + "/rizn"`. Only that one target
  is allowed.
- **Big screen**: when `revealedPlaces` includes place 1, it shows the `NextWeekPanel`.

## Project Structure

```text
drizzle/0002_first_names.sql
src/server/db/schema.ts              # passes.firstName + check
src/shared/schemas.ts                # firstNameField, firstNamesField
src/server/services/entries.ts       # names in create/update/remove, displayNames coalesce
src/server/services/passes.ts        # search by first name; hits carry firstName
src/server/routes/crew/entries.ts    # parse firstNames
src/server/routes/qr.ts              # ?to=rizn
src/content/rizn.ts                  # editable page copy
src/content/van.json                 # { "photo": boolean }, written by brand:assets
src/app/rizn/page.tsx (+ .module.css)
src/components/NextWeekPanel.tsx     # big-screen panel
src/app/crew/entries/page.tsx        # first-name inputs, consent wording
src/app/crew/PassPicker.tsx          # PassHit.firstName
src/app/page.tsx                     # link on pass + ended screen
src/app/screen/page.tsx              # panel after 1st place
scripts/brand-assets.ts              # optional van photo → public/brand/van.webp
tests/integration/entries.test.ts    # first-name block
tests/e2e/a11y.spec.ts, student.spec.ts
```

## Complexity Tracking

None.
