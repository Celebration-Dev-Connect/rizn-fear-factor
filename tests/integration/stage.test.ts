import fs from "node:fs/promises";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { createEntry, goToStage, idem, newCrewAgent, newPassAgent, passIdByNumber, resetDb, stage } from "./helpers";

describe("contest stages (US4, Constitution VII)", () => {
  beforeEach(resetDb);

  it("rejects a stale `from` with stage_conflict and the current state", async () => {
    const crew = await newCrewAgent();
    const res = await crew
      .post("/api/crew/stage")
      .set(idem())
      .send({ action: "advance", from: { stage: "voting_open", revealStep: 0 } })
      .expect(409);
    expect(res.body.error).toBe("stage_conflict");
    expect(res.body.state.stage).toBe("setup");
  });

  it("lets exactly one of two concurrent advances win", async () => {
    const a = await newCrewAgent("Crew phone 1");
    const b = await newCrewAgent("Crew phone 2");
    const body = { action: "advance", from: { stage: "setup", revealStep: 0 } };
    const [ra, rb] = await Promise.all([
      a.post("/api/crew/stage").set(idem()).send(body),
      b.post("/api/crew/stage").set(idem()).send(body),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    expect((await a.get("/api/state")).body.stage).toBe("voting_open");
  });

  it("keeps entries and votes through undo, bumps version and ETag, and audits every change", async () => {
    const crew = await newCrewAgent();
    const a = await newPassAgent();
    const voter = await newPassAgent();
    const entry = await createEntry(crew, [await passIdByNumber(crew, a.pass.number)]);
    const before = await crew.get("/api/state").expect(200);
    await goToStage(crew, "voting_open");
    await voter.agent.post("/api/votes").set(idem()).send({ entryId: entry.id }).expect(201);
    await stage(crew, "undo").then((r) => expect(r.status).toBe(200));

    const after = await crew.get("/api/state").expect(200);
    expect(after.body.stage).toBe("setup");
    expect(after.body.version).toBe(before.body.version + 2);
    expect(after.headers.etag).not.toBe(before.headers.etag);
    await crew.get("/api/state").set("If-None-Match", after.headers.etag!).expect(304);

    const counts = await db().execute(
      sql`select (select count(*)::int from votes) as v, (select count(*)::int from entries where removed_at is null) as e`,
    );
    expect(counts.rows[0]).toEqual({ v: 1, e: 1 });
    const audit = await db().execute(sql`select count(*)::int as n from audit_events where action = 'stage.change'`);
    expect(audit.rows[0]).toEqual({ n: 2 });
  });

  it("refuses to reveal without counted votes", async () => {
    const crew = await newCrewAgent();
    await goToStage(crew, "voting_closed");
    const res = await stage(crew, "advance");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("no_votes");
  });

  it("reveals only as many places as exist, lowest first, without counts", async () => {
    const crew = await newCrewAgent();
    const a = await newPassAgent();
    const b = await newPassAgent();
    const voters = await Promise.all([newPassAgent(), newPassAgent(), newPassAgent()]);
    const ea = await createEntry(crew, [await passIdByNumber(crew, a.pass.number)]);
    const eb = await createEntry(crew, [await passIdByNumber(crew, b.pass.number)]);
    await goToStage(crew, "voting_open");
    await voters[0]!.agent.post("/api/votes").set(idem()).send({ entryId: ea.id }).expect(201);
    await voters[1]!.agent.post("/api/votes").set(idem()).send({ entryId: ea.id }).expect(201);
    await voters[2]!.agent.post("/api/votes").set(idem()).send({ entryId: eb.id }).expect(201);
    await goToStage(crew, "voting_closed");

    const ranking = await crew.get("/api/crew/ranking").expect(200);
    expect(ranking.body.places.map((p: { votes: number }) => p.votes)).toEqual([2, 1]);

    await stage(crew, "advance"); // results_revealed, step 0
    expect((await voters[0]!.agent.get("/api/results")).body.places).toEqual([]);
    await stage(crew, "advance"); // step 1 → reveals 2nd (lowest existing place)
    const r1 = await voters[0]!.agent.get("/api/results").expect(200);
    expect(r1.body.places.map((p: { place: number }) => p.place)).toEqual([2]);
    await stage(crew, "advance"); // step 2 → 1st
    const r2 = await voters[0]!.agent.get("/api/results").expect(200);
    expect(r2.body.places.map((p: { place: number }) => p.place)).toEqual([2, 1]);
    expect(JSON.stringify(r2.body)).not.toMatch(/"votes"/);
    const extra = await stage(crew, "advance");
    expect(extra.status).toBe(409);
  });

  it("has no timer that can change contest state", async () => {
    const src = await fs.readFile("src/server/services/contest-state.ts", "utf8");
    expect(src).not.toMatch(/setInterval|setTimeout/);
    const index = await fs.readFile("src/server/index.ts", "utf8");
    expect(index).not.toMatch(/transition\(/);
  });
});
