// Seeds the rehearsal realm with passes and photo entries so stories can be tried without
// crew setup (T025). Usage: npm run seed:dev [-- --stage voting_open]
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { config } from "../src/server/config";
import { closeDb, db } from "../src/server/db/client";
import { crewSessions, settings } from "../src/server/db/schema";
import { runMigrations } from "../src/server/db/migrate";
import { createEntry } from "../src/server/services/entries";
import { issuePass } from "../src/server/services/passes";
import { invalidateAll } from "../src/server/services/contest-state";
import type { Stage } from "../src/shared/types";

const COLORS = ["#ff7a1a", "#8f5bd6", "#2fbf71", "#e04a6a", "#3a8dde"];

async function main() {
  if (config().NODE_ENV === "production") throw new Error("seed:dev refuses to run in production");
  const stageArg = process.argv.indexOf("--stage");
  const stage = (stageArg > -1 ? process.argv[stageArg + 1] : "setup") as Stage;

  await runMigrations();
  await db().update(settings).set({ rehearsalMode: true }).where(sql`id = 1`);
  invalidateAll();
  const [crew] = await db().insert(crewSessions).values({ deviceLabel: "Tablet A" }).returning();

  const passes = [];
  for (let i = 0; i < 5; i++) passes.push((await issuePass("rehearsal", "crew", crew!.id)).pass);
  for (let i = 0; i < 3; i++) {
    const photo = await sharp({ create: { width: 900, height: 900, channels: 3, background: COLORS[i]! } })
      .composite([{ input: Buffer.from(`<svg width="900" height="900"><text x="450" y="480" font-size="140" text-anchor="middle" fill="white">Costume ${i + 1}</text></svg>`) }])
      .jpeg()
      .toBuffer();
    await createEntry("rehearsal", crew!.id, [passes[i]!.id], photo, true);
  }
  await db().execute(sql`update contest set stage = ${stage}, reveal_step = 0, version = version + 1 where realm = 'rehearsal'`);
  console.log(`Seeded rehearsal: 5 passes, 3 entries, stage=${stage}`);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
