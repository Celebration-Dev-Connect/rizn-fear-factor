import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { entries } from "../db/schema";
import { countPlaces, getContest } from "./contest-state";
import { displayNames, toCard } from "./entries";
import type { EntryCard, Realm, RevealedPlace } from "@/shared/types";

export type Counted = { entryId: string; votes: number };
export type RankedPlace = { place: 1 | 2 | 3; tied: boolean; entryIds: string[]; votes: number };

/**
 * Dense ranking on counted votes (FR-030): highest total is 1st, next distinct total 2nd, then
 * 3rd. Ties share a place. Zero-vote entries never place.
 */
export function rank(counts: Counted[]): { places: RankedPlace[]; unplaced: Counted[] } {
  const totals = [...new Set(counts.filter((c) => c.votes > 0).map((c) => c.votes))].sort((a, b) => b - a);
  const places: RankedPlace[] = totals.slice(0, 3).map((votes, i) => {
    const entryIds = counts.filter((c) => c.votes === votes).map((c) => c.entryId);
    return { place: (i + 1) as 1 | 2 | 3, tied: entryIds.length > 1, entryIds, votes };
  });
  const placedIds = new Set(places.flatMap((p) => p.entryIds));
  const unplaced = counts.filter((c) => !placedIds.has(c.entryId)).sort((a, b) => b.votes - a.votes);
  return { places, unplaced };
}

async function countsFor(realm: Realm): Promise<Counted[]> {
  const r = await db().execute(sql`
    select e.id as "entryId", count(v.id) filter (where v.status = 'counted')::int as votes
    from entries e left join votes v on v.entry_id = e.id
    where e.realm = ${realm} and e.removed_at is null
    group by e.id, e.created_at
    order by e.created_at
  `);
  return r.rows as Counted[];
}

async function cards(realm: Realm, ids: string[]): Promise<Map<string, EntryCard>> {
  const names = await displayNames(db(), ids);
  const rows = ids.length
    ? await db()
        .select({ id: entries.id, photoId: entries.photoId })
        .from(entries)
        .where(and(eq(entries.realm, realm), inArray(entries.id, ids)))
    : [];
  return new Map(rows.map((r) => [r.id, toCard(r, names.get(r.id) ?? "Mystery Guest")]));
}

/** Crew-only ranking with counts (FR-029). */
export async function crewRanking(realm: Realm) {
  const counts = await countsFor(realm);
  const { places, unplaced } = rank(counts);
  const byId = await cards(realm, counts.map((c) => c.entryId));
  return {
    places: places.map((p) => ({
      place: p.place,
      tied: p.tied,
      votes: p.votes,
      entries: p.entryIds.map((id) => byId.get(id)!),
    })),
    unplaced: unplaced.map((u) => ({ entry: byId.get(u.entryId)!, votes: u.votes })),
  };
}

/**
 * Public results (FR-031/FR-032): with P existing places, only places > P − revealStep, lowest
 * place first, never counts. P comes from countPlaces so it matches the state machine.
 */
export async function publicResults(realm: Realm): Promise<RevealedPlace[]> {
  const c = await getContest(realm);
  if (c.stage !== "results_revealed" || c.revealStep === 0) return [];
  const { placesCount } = await countPlaces(db(), realm);
  const { places } = rank(await countsFor(realm));
  const shown = places.filter((p) => p.place > placesCount - c.revealStep).sort((a, b) => b.place - a.place);
  const byId = await cards(realm, shown.flatMap((p) => p.entryIds));
  return shown.map((p) => ({ place: p.place, tied: p.tied, entries: p.entryIds.map((id) => byId.get(id)!) }));
}
