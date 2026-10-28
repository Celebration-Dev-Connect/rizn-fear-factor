import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { isUniqueViolation } from "../db/errors";
import { db, withTx, type DbOrTx } from "../db/client";
import { entries, entryPasses, passes, votes } from "../db/schema";
import { AppError } from "../middleware/errors";
import { record } from "./audit";
import { bumpEntriesVersion, getContest, invalidate } from "./contest-state";
import { deletePhoto, photoUrls, processUpload } from "./photos";
import type { EntryCard, Realm } from "@/shared/types";

/** Display name = the linked passes' nicknames joined with " & " (data-model.md). */
export async function displayNames(tx: DbOrTx, entryIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (entryIds.length === 0) return out;
  const rows = await tx
    .select({ entryId: entryPasses.entryId, nickname: passes.nickname })
    .from(entryPasses)
    .innerJoin(passes, eq(passes.id, entryPasses.passId))
    .where(inArray(entryPasses.entryId, entryIds))
    .orderBy(asc(passes.number));
  for (const r of rows) {
    const prev = out.get(r.entryId);
    out.set(r.entryId, prev ? `${prev} & ${r.nickname}` : r.nickname);
  }
  return out;
}

export function toCard(
  e: { id: string; photoId: string; costumeTitle: string | null },
  displayName: string,
): EntryCard {
  const alt = e.costumeTitle
    ? `Costume photo: ${displayName} as ${e.costumeTitle}`
    : `Costume photo of ${displayName}`;
  return { id: e.id, displayName, costumeTitle: e.costumeTitle, photo: photoUrls(e.photoId), alt };
}

export async function listEntries(realm: Realm): Promise<{ entriesVersion: number; entries: EntryCard[] }> {
  const rows = await db()
    .select({ id: entries.id, photoId: entries.photoId, costumeTitle: entries.costumeTitle })
    .from(entries)
    .where(and(eq(entries.realm, realm), isNull(entries.removedAt)))
    .orderBy(asc(entries.createdAt));
  const names = await displayNames(db(), rows.map((r) => r.id));
  const { entriesVersion } = await getContest(realm);
  return { entriesVersion, entries: rows.map((r) => toCard(r, names.get(r.id) ?? "Mystery Guest")) };
}

export async function getEntryCard(tx: DbOrTx, realm: Realm, id: string): Promise<EntryCard> {
  const [e] = await tx
    .select({ id: entries.id, photoId: entries.photoId, costumeTitle: entries.costumeTitle })
    .from(entries)
    .where(and(eq(entries.id, id), eq(entries.realm, realm), isNull(entries.removedAt)));
  if (!e) throw new AppError("not_found", 404, "Entry not found");
  const names = await displayNames(tx, [id]);
  return toCard(e, names.get(id) ?? "Mystery Guest");
}

async function assertLinkablePasses(tx: DbOrTx, realm: Realm, passIds: string[], entryId?: string) {
  if (passIds.length === 0) throw new AppError("invalid_request", 400, "Pick at least one pass");
  const found = await tx
    .select({ id: passes.id, entryId: entryPasses.entryId })
    .from(passes)
    .leftJoin(entryPasses, eq(entryPasses.passId, passes.id))
    .where(and(eq(passes.realm, realm), inArray(passes.id, passIds)));
  if (found.length !== new Set(passIds).size) throw new AppError("not_found", 404, "Pass not found");
  if (found.some((f) => f.entryId && f.entryId !== entryId)) {
    throw new AppError("pass_already_entered", 409, "That pass is already in another costume entry");
  }
}

/** FR-015: crew-only entry with a consented photo. Retries are deduplicated by idempotency keys. */
export async function createEntry(
  realm: Realm,
  crewSessionId: string,
  passIds: string[],
  photo: Buffer,
  consent: boolean,
): Promise<{ entry: EntryCard; addedDuringVoting: boolean }> {
  if (!consent) throw new AppError("consent_required", 422, "Confirm student and parent consent first");
  const unique = [...new Set(passIds)];
  await assertLinkablePasses(db(), realm, unique);
  const photoId = await processUpload(photo);
  try {
    return await withTx(async (tx) => {
      const [e] = await tx
        .insert(entries)
        .values({ realm, photoId, consentConfirmedAt: new Date() })
        .returning();
      await tx.insert(entryPasses).values(unique.map((passId) => ({ entryId: e!.id, passId })));
      await bumpEntriesVersion(tx, realm);
      const c = await getContest(realm, tx);
      await record(tx, {
        realm,
        actorType: "crew",
        actorId: crewSessionId,
        action: "entry.create",
        details: { entryId: e!.id, passIds: unique },
      });
      invalidate(realm);
      return { entry: await getEntryCard(tx, realm, e!.id), addedDuringVoting: c.stage === "voting_open" };
    });
  } catch (err) {
    await deletePhoto(photoId);
    if (isUniqueViolation(err)) {
      throw new AppError("pass_already_entered", 409, "That pass is already in another costume entry");
    }
    throw err;
  }
}

export async function updateEntry(
  realm: Realm,
  crewSessionId: string,
  entryId: string,
  changes: { photo?: Buffer; passIds?: string[] },
): Promise<EntryCard> {
  const newPhotoId = changes.photo ? await processUpload(changes.photo) : undefined;
  let oldPhotoId: string | undefined;
  try {
    const card = await withTx(async (tx) => {
      const [e] = await tx
        .select()
        .from(entries)
        .where(and(eq(entries.id, entryId), eq(entries.realm, realm), isNull(entries.removedAt)))
        .for("update");
      if (!e) throw new AppError("not_found", 404, "Entry not found");
      if (changes.passIds) {
        const unique = [...new Set(changes.passIds)];
        await assertLinkablePasses(tx, realm, unique, entryId);
        await tx.delete(entryPasses).where(eq(entryPasses.entryId, entryId));
        await tx.insert(entryPasses).values(unique.map((passId) => ({ entryId, passId })));
      }
      if (newPhotoId) {
        oldPhotoId = e.photoId;
        await tx.update(entries).set({ photoId: newPhotoId, updatedAt: new Date() }).where(eq(entries.id, entryId));
      }
      await bumpEntriesVersion(tx, realm);
      await record(tx, {
        realm,
        actorType: "crew",
        actorId: crewSessionId,
        action: "entry.update",
        details: { entryId, photoReplaced: Boolean(newPhotoId), passIds: changes.passIds ?? null },
      });
      return getEntryCard(tx, realm, entryId);
    });
    if (oldPhotoId) await deletePhoto(oldPhotoId);
    invalidate(realm);
    return card;
  } catch (err) {
    if (newPhotoId) await deletePhoto(newPhotoId);
    if (isUniqueViolation(err)) {
      throw new AppError("pass_already_entered", 409, "That pass is already in another costume entry");
    }
    throw err;
  }
}

/** FR-018/FR-019: removing deletes the photo and releases the entry's votes. */
export async function removeEntry(realm: Realm, crewSessionId: string, entryId: string): Promise<number> {
  const { photoId, released } = await withTx(async (tx) => {
    const [e] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.realm, realm), isNull(entries.removedAt)))
      .for("update");
    if (!e) throw new AppError("not_found", 404, "Entry not found");
    await tx.update(entries).set({ removedAt: new Date() }).where(eq(entries.id, entryId));
    await tx.delete(entryPasses).where(eq(entryPasses.entryId, entryId));
    const rel = await tx
      .update(votes)
      .set({ status: "released", statusChangedAt: new Date(), statusChangedByCrewSessionId: crewSessionId })
      .where(and(eq(votes.entryId, entryId), inArray(votes.status, ["counted", "voided"])))
      .returning({ id: votes.id });
    await bumpEntriesVersion(tx, realm);
    await record(tx, {
      realm,
      actorType: "crew",
      actorId: crewSessionId,
      action: "entry.remove",
      details: { entryId, releasedVotes: rel.length },
    });
    return { photoId: e.photoId, released: rel.length };
  });
  await deletePhoto(photoId);
  invalidate(realm);
  return released;
}
