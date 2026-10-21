import fs from "node:fs/promises";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { config } from "@/server/config";
import { db } from "@/server/db/client";
import { createEntry, goToStage, idem, newCrewAgent, newPassAgent, passIdByNumber, resetDb } from "./helpers";

const rowCounts = async (realm: string) =>
  (
    await db().execute(sql`select
      (select count(*)::int from passes where realm = ${realm}) as passes,
      (select count(*)::int from entries where realm = ${realm}) as entries,
      (select count(*)::int from votes where realm = ${realm}) as votes`)
  ).rows[0];

describe("rehearsal mode (US9, Constitution VII)", () => {
  beforeEach(resetDb);

  it("isolates rehearsal data and wipes it without touching live data", async () => {
    const crew = await newCrewAgent();
    // Live data first.
    const liveA = await newPassAgent();
    const liveEntry = await createEntry(crew, [await passIdByNumber(crew, liveA.pass.number)]);
    const liveBefore = await rowCounts("live");
    const liveFiles = (await fs.readdir(config().PHOTO_DIR)).sort();

    await crew.post("/api/crew/rehearsal").set(idem()).send({ on: true }).expect(200);
    const r = await newPassAgent();
    const rv = await newPassAgent();
    expect(r.pass.number).toBe(1); // separate numbering per realm
    const rEntry = await createEntry(crew, [await passIdByNumber(crew, r.pass.number)]);
    await goToStage(crew, "voting_open");
    await rv.agent.post("/api/votes").set(idem()).send({ entryId: rEntry.id }).expect(201);
    expect((await crew.get("/api/state")).body.rehearsal).toBe(true);

    const wipe = await crew.post("/api/crew/rehearsal/wipe").set(idem()).send({ confirm: "WIPE" }).expect(200);
    expect(wipe.body.deleted).toEqual({ passes: 2, entries: 1, votes: 1, photos: 1 });
    expect(await rowCounts("rehearsal")).toEqual({ passes: 0, entries: 0, votes: 0 });
    expect((await crew.get("/api/state")).body.stage).toBe("setup");
    const audit = await db().execute(sql`select count(*)::int as n from audit_events where realm = 'rehearsal'`);
    expect(audit.rows[0]).toEqual({ n: 0 });

    expect(await rowCounts("live")).toEqual(liveBefore);
    expect((await fs.readdir(config().PHOTO_DIR)).sort()).toEqual(liveFiles);

    // Turning rehearsal off brings back the phone's live pass.
    await crew.post("/api/crew/rehearsal").set(idem()).send({ on: false }).expect(200);
    const back = await liveA.agent.post("/api/pass").expect(200);
    expect(back.body.pass).toEqual(liveA.pass);
    await liveA.agent.get(liveEntry.photo.thumb).expect(200);
  });

  it("requires typing WIPE", async () => {
    const crew = await newCrewAgent();
    await crew.post("/api/crew/rehearsal/wipe").set(idem()).send({ confirm: "wipe" }).expect(400);
  });

  it("locks rehearsal once the live contest has left setup", async () => {
    const crew = await newCrewAgent();
    await goToStage(crew, "voting_open");
    const res = await crew.post("/api/crew/rehearsal").set(idem()).send({ on: true }).expect(409);
    expect(res.body.error).toBe("rehearsal_locked");
  });
});
