import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { isUniqueViolation } from "../db/errors";
import { db, withTx } from "../db/client";
import { contest, entries, entryPasses, passes, votes } from "../db/schema";
import { AppError } from "../middleware/errors";
import { record } from "./audit";
import { invalidate } from "./contest-state";
import { displayNames } from "./entries";
import type { Realm } from "@/shared/types";

type Tx = Parameters<Parameters<typeof withTx>[0]>[0];

/**
 * Checks shared by casting and changing (FR-008, FR-010): the contest row is locked so a vote
 * can't slip in after a stage change, the entry must still be in the contest, and no self-votes.
 */
async function assertVotable(tx: Tx, realm: Realm, passId: string, entryId: string): Promise<void> {
  const [c] = await tx.select().from(contest).where(eq(contest.realm, realm)).for("update");
  if (c?.stage !== "voting_open") throw new AppError("voting_not_open", 409, "Voting isn't open right now");

  const [entry] = await tx
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.realm, realm), isNull(entries.removedAt)));
  if (!entry) throw new AppError("not_found", 404, "That costume is no longer in the contest");

  const [own] = await tx
    .select()
    .from(entryPasses)
    .where(and(eq(entryPasses.entryId, entryId), eq(entryPasses.passId, passId)));
  if (own) throw new AppError("self_vote", 409, "You can't vote for your own costume");
}

async function insertVote(tx: Tx, realm: Realm, passId: string, entryId: string, assistedBy?: string) {
  const [v] = await tx
    .insert(votes)
    .values({ realm, passId, entryId, assistedByCrewSessionId: assistedBy ?? null })
    .returning();
  await record(tx, {
    realm,
    actorType: assistedBy ? "crew" : "pass",
    actorId: assistedBy ?? passId,
    action: "vote.cast",
    details: { voteId: v!.id, passId, entryId, assisted: Boolean(assistedBy) },
  });
  return v!;
}

function mapUniqueViolation(err: unknown): never {
  if (isUniqueViolation(err)) throw new AppError("already_voted", 409, "This pass has already voted");
  throw err;
}

/**
 * Casts one vote (FR-008–FR-011). The partial unique index guarantees one vote per pass even
 * under races.
 */
export async function castVote(
  realm: Realm,
  passId: string,
  entryId: string,
  assistedByCrewSessionId?: string,
): Promise<{ entryId: string }> {
  try {
    return await withTx(async (tx) => {
      await assertVotable(tx, realm, passId, entryId);
      await insertVote(tx, realm, passId, entryId, assistedByCrewSessionId);
      return { entryId };
    });
  } catch (err) {
    mapUniqueViolation(err);
  }
}

/**
 * Moves a pass's vote to another entry while voting is open (spec 002 FR-101–FR-106). The old row
 * is kept as `replaced` and a new `counted` row is inserted, so the log keeps every choice and the
 * one-vote index still holds. Locking the current vote row serializes racing changes: the last one
 * the server accepts wins. With no vote yet it is a first vote.
 */
export async function changeVote(
  realm: Realm,
  passId: string,
  entryId: string,
  assistedByCrewSessionId?: string,
): Promise<{ vote: { entryId: string }; changed: boolean }> {
  try {
    return await withTx(async (tx) => {
      await assertVotable(tx, realm, passId, entryId);
      const [current] = await tx
        .select()
        .from(votes)
        .where(and(eq(votes.passId, passId), inArray(votes.status, ["counted", "voided"])))
        .for("update");
      if (!current) {
        await insertVote(tx, realm, passId, entryId, assistedByCrewSessionId);
        return { vote: { entryId }, changed: false };
      }
      if (current.status === "voided") {
        throw new AppError("vote_voided", 409, "This vote was voided by the crew and can't be changed");
      }
      if (current.entryId === entryId) return { vote: { entryId }, changed: false };

      await tx
        .update(votes)
        .set({
          status: "replaced",
          statusChangedAt: new Date(),
          statusChangedByCrewSessionId: assistedByCrewSessionId ?? null,
        })
        .where(eq(votes.id, current.id));
      const [v] = await tx
        .insert(votes)
        .values({ realm, passId, entryId, assistedByCrewSessionId: assistedByCrewSessionId ?? null })
        .returning();
      await record(tx, {
        realm,
        actorType: assistedByCrewSessionId ? "crew" : "pass",
        actorId: assistedByCrewSessionId ?? passId,
        action: "vote.change",
        details: {
          fromVoteId: current.id,
          toVoteId: v!.id,
          passId,
          fromEntryId: current.entryId,
          toEntryId: entryId,
          assisted: Boolean(assistedByCrewSessionId),
        },
      });
      return { vote: { entryId }, changed: true };
    });
  } catch (err) {
    mapUniqueViolation(err);
  }
}

export async function countTotals(realm: Realm): Promise<{ passes: number; votesCounted: number }> {
  const r = await db().execute(sql`
    select
      (select count(*)::int from passes where realm = ${realm}) as passes,
      (select count(*)::int from votes where realm = ${realm} and status = 'counted') as "votesCounted"
  `);
  return r.rows[0] as { passes: number; votesCounted: number };
}

/** Vote log for crew review (FR-028). No automatic flagging — crew judge for themselves. */
export async function listVotes(
  realm: Realm,
  sort: "cast_at" | "pass_created_at",
  order: "asc" | "desc",
  status?: "counted" | "voided" | "released" | "replaced",
) {
  const dir = order === "asc" ? asc : desc;
  const sortCol = sort === "cast_at" ? votes.castAt : passes.createdAt;
  const rows = await db()
    .select({
      id: votes.id,
      castAt: votes.castAt,
      status: votes.status,
      statusChangedAt: votes.statusChangedAt,
      assistedBy: votes.assistedByCrewSessionId,
      passNumber: passes.number,
      passNickname: passes.nickname,
      passCreatedAt: passes.createdAt,
      passOrigin: passes.origin,
      entryId: votes.entryId,
    })
    .from(votes)
    .innerJoin(passes, eq(passes.id, votes.passId))
    .where(and(eq(votes.realm, realm), status ? eq(votes.status, status) : undefined))
    .orderBy(dir(sortCol), dir(votes.castAt))
    .limit(2000);
  const entryIds = [...new Set(rows.map((r) => r.entryId))];
  const names = await displayNames(db(), entryIds);
  const titles = new Map(
    entryIds.length
      ? (
          await db()
            .select({ id: entries.id, costumeTitle: entries.costumeTitle })
            .from(entries)
            .where(inArray(entries.id, entryIds))
        ).map((e) => [e.id, e.costumeTitle])
      : [],
  );
  return rows.map((r) => ({
    id: r.id,
    castAt: r.castAt.toISOString(),
    status: r.status,
    statusChangedAt: r.statusChangedAt.toISOString(),
    assisted: r.assistedBy !== null,
    pass: {
      number: r.passNumber,
      nickname: r.passNickname,
      createdAt: r.passCreatedAt.toISOString(),
      origin: r.passOrigin,
    },
    entry: {
      id: r.entryId,
      displayName: names.get(r.entryId) ?? "Removed costume",
      costumeTitle: titles.get(r.entryId) ?? null,
    },
  }));
}

async function setVoteStatus(
  realm: Realm,
  voteId: string,
  crewSessionId: string,
  from: "counted" | "voided",
  to: "counted" | "voided",
  action: string,
) {
  return withTx(async (tx) => {
    const [v] = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.id, voteId), eq(votes.realm, realm)))
      .for("update");
    if (!v) throw new AppError("not_found", 404, "Vote not found");
    if (v.status === "released") {
      throw new AppError("not_available", 409, "This vote was released when its costume was removed");
    }
    if (v.status !== from) return { id: v.id, status: v.status };
    const [u] = await tx
      .update(votes)
      .set({ status: to, statusChangedAt: new Date(), statusChangedByCrewSessionId: crewSessionId })
      .where(eq(votes.id, voteId))
      .returning();
    await record(tx, { realm, actorType: "crew", actorId: crewSessionId, action, details: { voteId } });
    invalidate(realm);
    return { id: u!.id, status: u!.status };
  });
}

export const voidVote = (realm: Realm, id: string, crew: string) =>
  setVoteStatus(realm, id, crew, "counted", "voided", "vote.void");

export const restoreVote = (realm: Realm, id: string, crew: string) =>
  setVoteStatus(realm, id, crew, "voided", "counted", "vote.restore");
