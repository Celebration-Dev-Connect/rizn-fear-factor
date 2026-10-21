// Seeds the rehearsal contest with a populated, realistic-looking contest (T025).
//   npm run seed:dev                                  → 60 passes, 18 costumes, voting open, 35 votes
//   npm run seed:dev -- --passes 120 --entries 30 --votes 80 --stage voting_closed
// Existing rehearsal data is wiped first. Live data is never touched.
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { config } from "../src/server/config";
import { closeDb, db } from "../src/server/db/client";
import { contest, crewSessions } from "../src/server/db/schema";
import { runMigrations } from "../src/server/db/migrate";
import { invalidateAll } from "../src/server/services/contest-state";
import { createEntry } from "../src/server/services/entries";
import { issuePass, type PassRow } from "../src/server/services/passes";
import { setRehearsal, wipeRehearsal } from "../src/server/services/rehearsal";
import { castVote } from "../src/server/services/voting";
import type { Stage } from "../src/shared/types";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]! : fallback;
};

const PALETTES = [
  ["#ff7a1a", "#7a2e00"], ["#8f5bd6", "#2a1160"], ["#2fbf71", "#0b3b24"], ["#e04a6a", "#4a0d1c"],
  ["#3a8dde", "#0c2a4d"], ["#f2c94c", "#5c4300"], ["#56ccf2", "#0b3a4a"], ["#bb6bd9", "#3b0f4f"],
];

/** Placeholder "costume" art: a spooky figure on a gradient, varied per index. */
function costumeSvg(i: number): string {
  const [a, b] = PALETTES[i % PALETTES.length]!;
  const figure = [
    // ghost
    `<path d="M300 170c-95 0-150 75-150 170v220l50-40 50 40 50-40 50 40 50-40 50 40V340c0-95-55-170-150-170z" fill="#f7f0ff"/>
     <circle cx="255" cy="320" r="22" fill="#1a0b2e"/><circle cx="345" cy="320" r="22" fill="#1a0b2e"/>
     <ellipse cx="300" cy="395" rx="26" ry="34" fill="#1a0b2e"/>`,
    // pumpkin
    `<rect x="285" y="150" width="30" height="60" rx="8" fill="#2f5d1e"/>
     <ellipse cx="300" cy="380" rx="190" ry="165" fill="#ff7a1a"/><ellipse cx="300" cy="380" rx="70" ry="165" fill="#ff9447"/>
     <path d="M220 330l40 40h-80zM380 330l40 40h-80z" fill="#1a0b2e"/>
     <path d="M190 430q110 90 220 0l-30 10-25-25-25 30-30-30-30 30-25-30-25 25z" fill="#1a0b2e"/>`,
    // bat
    `<path d="M300 300c-30-60-110-90-230-60 60 20 80 70 70 120 40-30 90-20 110 20 10-40 30-60 50-60s40 20 50 60c20-40 70-50 110-20-10-50 10-100 70-120-120-30-200 0-230 60z" fill="#1a0b2e"/>
     <circle cx="280" cy="320" r="8" fill="#ffe066"/><circle cx="320" cy="320" r="8" fill="#ffe066"/>`,
    // witch hat
    `<path d="M300 120l-110 330h220z" fill="#1a0b2e"/><ellipse cx="300" cy="455" rx="210" ry="38" fill="#1a0b2e"/>
     <rect x="200" y="395" width="200" height="30" fill="#8f5bd6"/><rect x="280" y="392" width="40" height="36" fill="#ffe066"/>`,
    // skull
    `<path d="M300 170c-110 0-170 80-160 180 5 50 40 80 60 95v65h200v-65c20-15 55-45 60-95 10-100-50-180-160-180z" fill="#f7f0ff"/>
     <ellipse cx="245" cy="350" rx="42" ry="48" fill="#1a0b2e"/><ellipse cx="355" cy="350" rx="42" ry="48" fill="#1a0b2e"/>
     <path d="M300 400l-22 40h44z" fill="#1a0b2e"/><path d="M230 480h140M260 470v30M300 470v30M340 470v30" stroke="#1a0b2e" stroke-width="10"/>`,
  ][i % 5];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <defs><radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <circle cx="${90 + ((i * 53) % 420)}" cy="90" r="45" fill="#fff5d6" opacity="0.85"/>
    ${figure}
  </svg>`;
}

async function main() {
  if (config().NODE_ENV === "production") throw new Error("seed:dev refuses to run in production");
  const nPasses = Number(arg("passes", "60"));
  const nEntries = Number(arg("entries", "18"));
  const nVotes = Number(arg("votes", "35"));
  const stage = arg("stage", "voting_open") as Stage;

  await runMigrations();
  const [crew] = await db().insert(crewSessions).values({ deviceLabel: "Tablet A" }).returning();
  const crewId = crew!.id;
  await setRehearsal(true, crewId);
  await wipeRehearsal(crewId);

  const passes: PassRow[] = [];
  for (let i = 0; i < nPasses; i++) {
    passes.push((await issuePass("rehearsal", i % 9 === 0 ? "crew" : "self", crewId)).pass);
  }

  // Entries: mostly solo, every 6th is a group costume of 2–3 passes.
  const entryIds: string[] = [];
  const contestantIds = new Set<string>();
  let p = 0;
  for (let i = 0; i < nEntries && p < passes.length; i++) {
    const size = i % 6 === 5 ? 2 + (i % 2) : 1;
    const group = passes.slice(p, p + size).map((x) => x.id);
    p += size;
    group.forEach((id) => contestantIds.add(id));
    const photo = await sharp(Buffer.from(costumeSvg(i))).jpeg({ quality: 85 }).toBuffer();
    const { entry } = await createEntry("rehearsal", crewId, group, photo, true);
    entryIds.push(entry.id);
  }

  // Votes need voting_open; skewed so a few costumes lead and there's a tie or two.
  await db().update(contest).set({ stage: "voting_open", revealStep: 0 }).where(eq(contest.realm, "rehearsal"));
  invalidateAll();
  const weights = entryIds.map((_, i) => Math.max(1, 10 - i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const voters = passes.filter((x) => !contestantIds.has(x.id) || Math.random() < 0.5);
  let cast = 0;
  for (const voter of voters) {
    if (cast >= nVotes) break;
    let r = Math.random() * totalWeight;
    let pick = 0;
    while (r > weights[pick]! && pick < weights.length - 1) r -= weights[pick++]!;
    try {
      await castVote("rehearsal", voter.id, entryIds[pick]!);
      cast++;
    } catch {
      // self-vote — skip this voter
    }
  }

  await db().execute(sql`update contest set stage = ${stage}, reveal_step = 0, version = version + 1 where realm = 'rehearsal'`);
  invalidateAll();
  console.log(`Seeded rehearsal: ${passes.length} passes, ${entryIds.length} costumes, ${cast} votes, stage=${stage}`);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
