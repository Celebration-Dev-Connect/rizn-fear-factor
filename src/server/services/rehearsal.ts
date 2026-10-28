import fs from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { db, withTx } from "../db/client";
import { contest, settings } from "../db/schema";
import { AppError } from "../middleware/errors";
import { record } from "./audit";
import { invalidateAll } from "./contest-state";
import { photoPath } from "./photos";

/** FR-036. Rehearsal can't be turned on once the live contest has left setup (protects live data). */
export async function setRehearsal(on: boolean, crewSessionId: string): Promise<void> {
  await withTx(async (tx) => {
    if (on) {
      const [live] = await tx.select().from(contest).where(eq(contest.realm, "live")).for("update");
      if (live?.stage !== "setup") {
        throw new AppError("rehearsal_locked", 409, "Rehearsal is locked once live voting has started");
      }
    }
    await tx.update(settings).set({ rehearsalMode: on, updatedAt: new Date() }).where(eq(settings.id, 1));
    await record(tx, {
      realm: "live",
      actorType: "crew",
      actorId: crewSessionId,
      action: on ? "rehearsal.on" : "rehearsal.off",
    });
  });
  invalidateAll();
}

/** FR-038: deletes every rehearsal row and photo; live data is untouched. */
export async function wipeRehearsal(crewSessionId: string) {
  const { photoIds, deleted } = await withTx(async (tx) => {
    const photos = await tx.execute(sql`select photo_id from entries where realm = 'rehearsal'`);
    const count = async (q: ReturnType<typeof sql>) => (await tx.execute(q)).rowCount ?? 0;
    const votesN = await count(sql`delete from votes where realm = 'rehearsal'`);
    await tx.execute(sql`delete from entry_passes where entry_id in (select id from entries where realm = 'rehearsal')`);
    const entriesN = await count(sql`delete from entries where realm = 'rehearsal'`);
    const passesN = await count(sql`delete from passes where realm = 'rehearsal'`);
    await tx.execute(sql`delete from audit_events where realm = 'rehearsal'`);
    await tx.execute(
      sql`update contest set stage = 'setup', reveal_step = 0, voting_closes_at = null, version = version + 1, entries_version = entries_version + 1 where realm = 'rehearsal'`,
    );
    const ids = (photos.rows as { photo_id: string }[]).map((r) => r.photo_id);
    const deleted = { passes: passesN, entries: entriesN, votes: votesN, photos: ids.length };
    await record(tx, { realm: "live", actorType: "crew", actorId: crewSessionId, action: "rehearsal.wipe", details: deleted });
    return { photoIds: ids, deleted };
  });
  await Promise.all(
    photoIds.flatMap((id) => (["full", "thumb"] as const).map((s) => fs.rm(photoPath(id, s), { force: true }))),
  );
  invalidateAll();
  return deleted;
}

export async function setEventWindow(start: Date, end: Date, crewSessionId: string): Promise<void> {
  await db().update(settings).set({ eventStart: start, eventEnd: end, updatedAt: new Date() }).where(eq(settings.id, 1));
  await record(db(), {
    realm: "live",
    actorType: "crew",
    actorId: crewSessionId,
    action: "settings.window",
    details: { start: start.toISOString(), end: end.toISOString() },
  });
  invalidateAll();
}
