import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { invalidateAll } from "@/server/services/contest-state";
import { createEntry, goToStage, idem, newCrewAgent, newPassAgent, passIdByNumber, resetDb } from "./helpers";

describe("voting close time (spec 002 US3, FR-111–FR-115)", () => {
  beforeEach(resetDb);

  const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

  it("sets, reports, and clears the close time, with audit events", async () => {
    const crew = await newCrewAgent();
    const t = at(61);
    const set = await crew.put("/api/crew/voting-close").set(idem()).send({ at: t }).expect(200);
    expect(set.body.votingClosesAt).toBe(t);
    expect((await crew.get("/api/state").expect(200)).body.votingClosesAt).toBe(t);
    const cleared = await crew.put("/api/crew/voting-close").set(idem()).send({ at: null }).expect(200);
    expect(cleared.body.votingClosesAt).toBeNull();
    const r = await db().execute(sql`select details from audit_events where action = 'voting_close.set' order by id`);
    expect(r.rows.map((x) => (x as { details: unknown }).details)).toEqual([
      { from: null, to: t },
      { from: t, to: null },
    ]);
  });

  it("changes the /api/state ETag and sends a Date header on 200 and 304", async () => {
    const crew = await newCrewAgent();
    const first = await crew.get("/api/state").expect(200);
    expect(first.headers.date).toBeTruthy();
    const etag = String(first.headers.etag);
    const notModified = await crew.get("/api/state").set("If-None-Match", etag).expect(304);
    expect(notModified.headers.date).toBeTruthy();
    await crew.put("/api/crew/voting-close").set(idem()).send({ at: at(30) }).expect(200);
    const after = await crew.get("/api/state").set("If-None-Match", etag).expect(200);
    expect(after.headers.etag).not.toBe(etag);
  });

  it("accepts a time in the past and never changes the stage (Constitution VI)", async () => {
    const crew = await newCrewAgent();
    const a = await newPassAgent();
    await createEntry(crew, [await passIdByNumber(crew, a.pass.number)]);
    await goToStage(crew, "voting_open");
    await crew.put("/api/crew/voting-close").set(idem()).send({ at: at(-5) }).expect(200);
    invalidateAll();
    const s = (await crew.get("/api/state").expect(200)).body;
    expect(s.stage).toBe("voting_open");
    expect(new Date(s.votingClosesAt).getTime()).toBeLessThan(Date.now());
  });

  it("keeps the rehearsal close time out of live and clears it on wipe", async () => {
    const crew = await newCrewAgent();
    await crew.post("/api/crew/rehearsal").set(idem()).send({ on: true }).expect(200);
    await crew.put("/api/crew/voting-close").set(idem()).send({ at: at(20) }).expect(200);
    await crew.post("/api/crew/rehearsal/wipe").set(idem()).send({ confirm: "WIPE" }).expect(200);
    expect((await crew.get("/api/state").expect(200)).body.votingClosesAt).toBeNull();
    await crew.put("/api/crew/voting-close").set(idem()).send({ at: at(20) }).expect(200);
    await crew.post("/api/crew/rehearsal").set(idem()).send({ on: false }).expect(200);
    expect((await crew.get("/api/state").expect(200)).body.votingClosesAt).toBeNull();
  });

  it("is crew-only and validates its input", async () => {
    const student = await newPassAgent();
    const res = await student.agent.put("/api/crew/voting-close").set(idem()).send({ at: at(10) });
    expect(res.status).toBe(401);
    const crew = await newCrewAgent();
    await crew.put("/api/crew/voting-close").set(idem()).send({ at: "8:45pm" }).expect(400);
    await crew.put("/api/crew/voting-close").set(idem()).send({}).expect(400);
  });
});
