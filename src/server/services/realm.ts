import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client";
import { settings } from "../db/schema";
import type { EventStatus, Realm } from "@/shared/types";

export type Settings = typeof settings.$inferSelect;

let cache: Settings | undefined;

export async function getSettings(tx?: DbOrTx): Promise<Settings> {
  if (cache && !tx) return cache;
  const [row] = await (tx ?? db()).select().from(settings).where(eq(settings.id, 1));
  if (!row) throw new Error("settings row missing; run migrations");
  if (!tx) cache = row;
  return row;
}

export function invalidateSettings(): void {
  cache = undefined;
}

export async function activeRealm(): Promise<Realm> {
  return (await getSettings()).rehearsalMode ? "rehearsal" : "live";
}

/** FR-006 / FR-036: the event window gates live passes only; rehearsal is always open. */
export function eventStatus(now: Date, s: Settings, realm: Realm): EventStatus {
  if (realm === "rehearsal") return "open";
  if (now < s.eventStart) return "before";
  if (now >= s.eventEnd) return "ended";
  return "open";
}
