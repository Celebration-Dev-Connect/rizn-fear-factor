import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client";
import { contest } from "../db/schema";
import { eventStatus, getSettings, invalidateSettings } from "./realm";
import type { PublicState, Realm } from "@/shared/types";

export type ContestRow = typeof contest.$inferSelect;

// In-memory cache of the contest rows. Only crew writes change them, and every write calls
// invalidate(). No timer ever modifies contest state (Constitution VI).
const cache = new Map<Realm, ContestRow>();

export async function getContest(realm: Realm, tx?: DbOrTx): Promise<ContestRow> {
  const hit = cache.get(realm);
  if (hit && !tx) return hit;
  const [row] = await (tx ?? db()).select().from(contest).where(eq(contest.realm, realm));
  if (!row) throw new Error(`contest row for ${realm} missing; run migrations`);
  if (!tx) cache.set(realm, row);
  return row;
}

export function invalidate(realm?: Realm): void {
  if (realm) cache.delete(realm);
  else cache.clear();
}

export function invalidateAll(): void {
  cache.clear();
  invalidateSettings();
}

export async function getPublicState(realm: Realm, now = new Date()): Promise<PublicState> {
  const [row, s] = await Promise.all([getContest(realm), getSettings()]);
  return {
    version: row.version,
    stage: row.stage,
    revealStep: row.revealStep as PublicState["revealStep"],
    rehearsal: s.rehearsalMode,
    event: {
      status: eventStatus(now, s, realm),
      start: s.eventStart.toISOString(),
      end: s.eventEnd.toISOString(),
    },
    entriesVersion: row.entriesVersion,
  };
}

export function etag(value: unknown): string {
  return `"${createHash("sha1").update(JSON.stringify(value)).digest("base64url")}"`;
}

/** Bumps entriesVersion so pollers refetch the gallery. Call inside the writing transaction. */
export async function bumpEntriesVersion(tx: DbOrTx, realm: Realm): Promise<void> {
  await tx
    .update(contest)
    .set({ entriesVersion: sql`${contest.entriesVersion} + 1`, updatedAt: new Date() })
    .where(eq(contest.realm, realm));
}
