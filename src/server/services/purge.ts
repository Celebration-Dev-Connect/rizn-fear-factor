import fs from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { config } from "../config";
import { db } from "../db/client";
import { record } from "./audit";
import { invalidateAll } from "./contest-state";

/** Deletes every photo file (FR-040). Deletion only — never touches contest state. */
export async function purgePhotos(): Promise<number> {
  const dir = config().PHOTO_DIR;
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const photos = files.filter((f) => f.endsWith(".webp"));
  await Promise.all(photos.map((f) => fs.rm(path.join(dir, f), { force: true })));
  if (photos.length > 0) {
    await record(db(), { realm: "live", actorType: "system", action: "purge.photos", details: { files: photos.length } });
  }
  return photos.length;
}

/** The documented post-event deletion: photos plus every pass, entry, vote, and log row. */
export async function purgeAll(): Promise<{ photos: number }> {
  const photos = await purgePhotos();
  await db().execute(
    sql`truncate votes, entry_passes, entries, passes, audit_events, idempotency_keys, crew_sessions restart identity cascade`,
  );
  await db().execute(sql`update contest set stage = 'setup', reveal_step = 0, version = version + 1, entries_version = entries_version + 1`);
  await db().execute(sql`update settings set rehearsal_mode = false`);
  invalidateAll();
  return { photos };
}

/** Hourly check started by the server: purges photos once PHOTO_DELETE_AT has passed. */
export async function purgePhotosIfDue(now = new Date()): Promise<void> {
  if (now >= config().PHOTO_DELETE_AT) await purgePhotos();
}
