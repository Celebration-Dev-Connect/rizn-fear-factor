import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, withTx, type DbOrTx } from "../db/client";
import { contest } from "../db/schema";
import { AppError } from "../middleware/errors";
import { record } from "./audit";
import { nextState } from "./contest-machine";
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

/**
 * Places that exist: min(3, number of distinct non-zero counted-vote totals across live entries).
 * Shared by the state machine and the public results so they always agree.
 */
export async function countPlaces(tx: DbOrTx, realm: Realm): Promise<{ hasCountedVotes: boolean; placesCount: number }> {
  const r = await tx.execute(sql`
    select count(distinct n)::int as places
    from (
      select count(*) as n
      from votes v join entries e on e.id = v.entry_id
      where v.realm = ${realm} and v.status = 'counted' and e.removed_at is null
      group by v.entry_id
    ) t
  `);
  const places = (r.rows[0] as { places: number }).places;
  return { hasCountedVotes: places > 0, placesCount: Math.min(3, places) };
}

/**
 * The only way contest state changes (FR-022): an explicit crew request carrying the stage the
 * crew device last saw. A mismatch means someone else acted first → stage_conflict.
 */
export async function transition(
  realm: Realm,
  crewSessionId: string,
  action: "advance" | "undo",
  from: { stage: ContestRow["stage"]; revealStep: number },
): Promise<PublicState> {
  await withTx(async (tx) => {
    const [row] = await tx.select().from(contest).where(eq(contest.realm, realm)).for("update");
    if (!row) throw new Error("contest row missing");
    if (row.stage !== from.stage || row.revealStep !== from.revealStep) {
      invalidate(realm);
      throw new AppError("stage_conflict", 409, "Someone else changed the stage", await getPublicState(realm));
    }
    const result = nextState(row, action, await countPlaces(tx, realm));
    if ("error" in result) {
      const msg =
        result.error === "no_votes"
          ? "No votes have been counted yet"
          : action === "undo"
            ? "Nothing to undo"
            : "Every place has already been revealed";
      throw new AppError(result.error, 409, msg);
    }
    await tx
      .update(contest)
      .set({ stage: result.stage, revealStep: result.revealStep, version: row.version + 1, updatedAt: new Date() })
      .where(eq(contest.realm, realm));
    await record(tx, {
      realm,
      actorType: "crew",
      actorId: crewSessionId,
      action: row.stage === result.stage ? "reveal.step" : "stage.change",
      details: { action, from: { stage: row.stage, revealStep: row.revealStep }, to: result },
    });
  });
  invalidate(realm);
  return getPublicState(realm);
}
