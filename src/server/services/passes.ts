import { and, eq, ilike, max, or, sql } from "drizzle-orm";
import { db, withTx, type DbOrTx } from "../db/client";
import { entryPasses, passes } from "../db/schema";
import { AppError } from "../middleware/errors";
import { newPassToken } from "../middleware/auth";
import { pickNickname } from "./nicknamePicker";
import { record } from "./audit";
import type { Realm } from "@/shared/types";

export type PassRow = typeof passes.$inferSelect;

/**
 * Issues a new pass with a unique nickname (FR-002) and the next per-realm number.
 * Returns the raw cookie token for self passes; crew passes have no token (FR-016).
 */
export async function issuePass(
  realm: Realm,
  origin: "self" | "crew",
  crewSessionId?: string,
): Promise<{ pass: PassRow; token: string | null }> {
  // A crowd scanning the poster at once must not race on nickname or number, so issuance is
  // serialized per realm with a transaction-scoped advisory lock. Each issue takes ~1 ms.
  return withTx(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`passes:${realm}`}))`);
    const usedRows = await tx.select({ n: passes.nickname }).from(passes).where(eq(passes.realm, realm));
    const nickname = pickNickname(new Set(usedRows.map((r) => r.n)));
    if (!nickname) {
      throw new AppError("nickname_exhausted", 503, "All Night Pass nicknames are in use. Find a crew member.");
    }
    const [{ m } = { m: 0 }] = await tx
      .select({ m: max(passes.number) })
      .from(passes)
      .where(eq(passes.realm, realm));
    const { token, hash } = newPassToken();
    const [row] = await tx
      .insert(passes)
      .values({
        realm,
        nickname,
        number: (m ?? 0) + 1,
        origin,
        tokenHash: origin === "self" ? hash : null,
        createdByCrewSessionId: crewSessionId ?? null,
      })
      .returning();
    await record(tx, {
      realm,
      actorType: origin === "self" ? "pass" : "crew",
      actorId: origin === "self" ? row!.id : crewSessionId,
      action: "pass.issue",
      details: { passId: row!.id, number: row!.number, origin },
    });
    return { pass: row!, token: origin === "self" ? token : null };
  });
}

export async function getPass(tx: DbOrTx, realm: Realm, id: string): Promise<PassRow | undefined> {
  const [row] = await tx.select().from(passes).where(and(eq(passes.id, id), eq(passes.realm, realm)));
  return row;
}

/** Crew lookup by nickname fragment or exact number (FR-015). */
export async function searchPasses(realm: Realm, q: string) {
  const trimmed = q.trim().replace(/^#/, "");
  const asNumber = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
  const pattern = `%${trimmed.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = and(
    eq(passes.realm, realm),
    asNumber !== null ? or(eq(passes.number, asNumber), ilike(passes.nickname, pattern)) : ilike(passes.nickname, pattern),
  );
  return db()
    .select({
      id: passes.id,
      number: passes.number,
      nickname: passes.nickname,
      origin: passes.origin,
      entryId: entryPasses.entryId,
    })
    .from(passes)
    .leftJoin(entryPasses, eq(entryPasses.passId, passes.id))
    .where(where)
    .orderBy(asNumber !== null ? sql`(${passes.number} = ${asNumber}) desc` : passes.number, passes.number)
    .limit(20);
}

export function publicPass(p: Pick<PassRow, "number" | "nickname" | "origin">) {
  return { number: p.number, nickname: p.nickname, origin: p.origin };
}
