import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { createEntry, goToStage, idem, newCrewAgent, newPassAgent, passIdByNumber, resetDb, stage, type Agent } from "./helpers";

async function countedVotes(): Promise<number> {
  const r = await db().execute(sql`select count(*)::int as n from votes where status = 'counted'`);
  return (r.rows[0] as { n: number }).n;
}

/** Two contestants (A, B) and one voter; returns agents and entry ids. */
async function setup() {
  const crew = await newCrewAgent();
  const a = await newPassAgent();
  const b = await newPassAgent();
  const voter = await newPassAgent();
  const entryA = await createEntry(crew, [await passIdByNumber(crew, a.pass.number)]);
  const entryB = await createEntry(crew, [await passIdByNumber(crew, b.pass.number)]);
  return { crew, a, b, voter, entryA, entryB };
}

const vote = (agent: Agent, entryId: string, key = idem()) =>
  agent.post("/api/votes").set(key).send({ entryId });

describe("vote enforcement (US2, Constitution VII)", () => {
  beforeEach(resetDb);

  it("records exactly one vote under 10 concurrent requests with different keys", async () => {
    const { crew, voter, entryA } = await setup();
    await goToStage(crew, "voting_open");
    const results = await Promise.all(Array.from({ length: 10 }, () => vote(voter.agent, entryA.id)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    for (const r of results.filter((r) => r.status !== 201)) {
      expect(r.status).toBe(409);
      expect(r.body.error).toBe("already_voted");
    }
    expect(await countedVotes()).toBe(1);
  });

  it("replays the original response for a retried idempotency key", async () => {
    const { crew, voter, entryA } = await setup();
    await goToStage(crew, "voting_open");
    const key = idem();
    const first = await vote(voter.agent, entryA.id, key).expect(201);
    const retry = await vote(voter.agent, entryA.id, key).expect(201);
    expect(retry.headers["idempotent-replay"]).toBe("true");
    expect(retry.body).toEqual(first.body);
    expect(await countedVotes()).toBe(1);
  });

  it("requires an idempotency key", async () => {
    const { crew, voter, entryA } = await setup();
    await goToStage(crew, "voting_open");
    const res = await voter.agent.post("/api/votes").send({ entryId: entryA.id }).expect(400);
    expect(res.body.error).toBe("idempotency_key_required");
  });

  it("rejects a vote for your own costume", async () => {
    const { crew, a, entryA } = await setup();
    await goToStage(crew, "voting_open");
    const res = await vote(a.agent, entryA.id).expect(409);
    expect(res.body.error).toBe("self_vote");
  });

  it("rejects votes in every stage except voting_open", async () => {
    const { crew, a, voter, entryA, entryB } = await setup();
    const expectClosed = async () => {
      const res = await vote(voter.agent, entryA.id).expect(409);
      expect(res.body.error).toBe("voting_not_open");
    };
    await expectClosed(); // setup
    await goToStage(crew, "voting_open");
    await vote(a.agent, entryB.id).expect(201); // the reveal needs at least one counted vote
    await goToStage(crew, "voting_closed");
    await expectClosed();
    await goToStage(crew, "results_revealed");
    await expectClosed();
    expect(await countedVotes()).toBe(1);
  });

  it("returns 404 for a removed entry", async () => {
    const { crew, voter, entryA } = await setup();
    await crew.delete(`/api/crew/entries/${entryA.id}`).set(idem()).expect(200);
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(404);
  });

  it("keeps a voided vote blocking a new vote", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    const cast = await vote(voter.agent, entryA.id).expect(201);
    const list = await crew.get("/api/crew/votes").expect(200);
    await crew.post(`/api/crew/votes/${list.body.votes[0].id}/void`).set(idem()).expect(200);
    expect(cast.body.vote.entryId).toBe(entryA.id);
    const res = await vote(voter.agent, entryB.id).expect(409);
    expect(res.body.error).toBe("already_voted");
  });

  it("lets a released vote be recast only while voting is open", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    const removed = await crew.delete(`/api/crew/entries/${entryA.id}`).set(idem()).expect(200);
    expect(removed.body.releasedVotes).toBe(1);
    expect((await voter.agent.get("/api/me").expect(200)).body.vote).toBeNull();
    await stage(crew, "advance"); // voting_closed
    await vote(voter.agent, entryB.id).expect(409);
    await stage(crew, "undo"); // voting_open again
    await vote(voter.agent, entryB.id).expect(201);
  });

  it("never exposes vote counts to students", async () => {
    const { crew, voter, entryA } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    const entries = await voter.agent.get("/api/entries").expect(200);
    const me = await voter.agent.get("/api/me").expect(200);
    const state = await voter.agent.get("/api/state").expect(200);
    for (const body of [entries.body, me.body, state.body]) {
      expect(JSON.stringify(body)).not.toMatch(/"(votes|count|votesCounted)"/);
    }
  });

  describe("void and restore (US7)", () => {
    it("drops and restores the counted total, with audit entries", async () => {
      const { crew, voter, entryA } = await setup();
      await goToStage(crew, "voting_open");
      await vote(voter.agent, entryA.id).expect(201);
      const id = (await crew.get("/api/crew/votes").expect(200)).body.votes[0].id;
      await crew.post(`/api/crew/votes/${id}/void`).set(idem()).expect(200);
      expect((await crew.get("/api/crew/dashboard").expect(200)).body.totals.votesCounted).toBe(0);
      await crew.post(`/api/crew/votes/${id}/restore`).set(idem()).expect(200);
      expect((await crew.get("/api/crew/dashboard").expect(200)).body.totals.votesCounted).toBe(1);
      const audit = await db().execute(
        sql`select action, actor_type from audit_events where action in ('vote.void','vote.restore') order by id`,
      );
      expect(audit.rows).toEqual([
        { action: "vote.void", actor_type: "crew" },
        { action: "vote.restore", actor_type: "crew" },
      ]);
    });

    it("sorts the log by pass creation time", async () => {
      const { crew, voter, entryA } = await setup();
      const late = await newPassAgent();
      await goToStage(crew, "voting_open");
      await vote(late.agent, entryA.id).expect(201);
      await vote(voter.agent, entryA.id).expect(201);
      const res = await crew.get("/api/crew/votes?sort=pass_created_at&order=asc").expect(200);
      const numbers = res.body.votes.map((v: { pass: { number: number } }) => v.pass.number);
      expect(numbers).toEqual([voter.pass.number, late.pass.number]);
    });
  });

  describe("crew-assisted votes (US8)", () => {
    it("follows the same rules and is marked assisted", async () => {
      const { crew, entryA, entryB } = await setup();
      const created = await crew.post("/api/crew/passes").set(idem()).expect(201);
      const passId = created.body.pass.id;
      await goToStage(crew, "voting_open");
      await crew.post("/api/crew/assisted-votes").set(idem()).send({ passId, entryId: entryA.id }).expect(201);
      const again = await crew
        .post("/api/crew/assisted-votes")
        .set(idem())
        .send({ passId, entryId: entryB.id })
        .expect(409);
      expect(again.body.error).toBe("already_voted");
      const log = await crew.get("/api/crew/votes").expect(200);
      expect(log.body.votes[0].assisted).toBe(true);
    });

    it("blocks an assisted self-vote", async () => {
      const { crew } = await setup();
      const created = await crew.post("/api/crew/passes").set(idem()).expect(201);
      const own = await createEntry(crew, [created.body.pass.id]);
      await goToStage(crew, "voting_open");
      const res = await crew
        .post("/api/crew/assisted-votes")
        .set(idem())
        .send({ passId: created.body.pass.id, entryId: own.id })
        .expect(409);
      expect(res.body.error).toBe("self_vote");
    });
  });
});

describe("vote change (spec 002 US1, FR-101–FR-106)", () => {
  beforeEach(resetDb);

  const change = (agent: Agent, entryId: string, key = idem()) =>
    agent.put("/api/votes/mine").set(key).send({ entryId });

  async function rows(passNumber: number) {
    const r = await db().execute(sql`
      select v.id, v.entry_id as "entryId", v.status, v.status_changed_at as "statusChangedAt",
             v.assisted_by_crew_session_id as "assistedBy",
             v.status_changed_by_crew_session_id as "changedBy"
      from votes v join passes p on p.id = v.pass_id
      where p.number = ${passNumber} order by v.cast_at
    `);
    return r.rows as { id: string; entryId: string; status: string; statusChangedAt: Date; assistedBy: string | null; changedBy: string | null }[];
  }

  async function auditCount(action: string): Promise<number> {
    const r = await db().execute(sql`select count(*)::int as n from audit_events where action = ${action}`);
    return (r.rows[0] as { n: number }).n;
  }

  async function threeEntries() {
    const s = await setup();
    const c = await newPassAgent();
    const entryC = await createEntry(s.crew, [await passIdByNumber(s.crew, c.pass.number)]);
    return { ...s, c, entryC };
  }

  it("moves the vote: one counted row for the new entry, the old one replaced", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    const res = await change(voter.agent, entryB.id).expect(200);
    expect(res.body).toEqual({ vote: { entryId: entryB.id }, changed: true });
    const r = await rows(voter.pass.number);
    expect(r.map((x) => [x.entryId, x.status])).toEqual([
      [entryA.id, "replaced"],
      [entryB.id, "counted"],
    ]);
    expect(r[0]!.statusChangedAt).toBeTruthy();
    expect(r[0]!.changedBy).toBeNull();
    const me = await voter.agent.get("/api/me").expect(200);
    expect(me.body.vote).toEqual({ entryId: entryB.id });
    expect(me.body.voteChangeable).toBe(true);
  });

  it("is a no-op when the new choice equals the current one", async () => {
    const { crew, voter, entryA } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    const before = await auditCount("vote.change");
    const res = await change(voter.agent, entryA.id).expect(200);
    expect(res.body.changed).toBe(false);
    expect(await rows(voter.pass.number)).toHaveLength(1);
    expect(await auditCount("vote.change")).toBe(before);
  });

  it("acts as a first vote when the pass has not voted", async () => {
    const { crew, voter, entryA } = await setup();
    await goToStage(crew, "voting_open");
    const res = await change(voter.agent, entryA.id).expect(200);
    expect(res.body).toEqual({ vote: { entryId: entryA.id }, changed: false });
    expect(await countedVotes()).toBe(1);
    expect(await auditCount("vote.cast")).toBe(1);
  });

  it("is refused in every stage except voting_open, and voteChangeable follows", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    const res0 = await change(voter.agent, entryA.id).expect(409);
    expect(res0.body.error).toBe("voting_not_open");
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    await goToStage(crew, "voting_closed");
    expect((await voter.agent.get("/api/me").expect(200)).body.voteChangeable).toBe(false);
    expect((await change(voter.agent, entryB.id).expect(409)).body.error).toBe("voting_not_open");
    await goToStage(crew, "results_revealed");
    expect((await change(voter.agent, entryB.id).expect(409)).body.error).toBe("voting_not_open");
    expect((await rows(voter.pass.number)).map((x) => x.status)).toEqual(["counted"]);
  });

  it("refuses to change a voided vote", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    const [v] = await rows(voter.pass.number);
    await crew.post(`/api/crew/votes/${v!.id}/void`).set(idem()).expect(200);
    const res = await change(voter.agent, entryB.id).expect(409);
    expect(res.body.error).toBe("vote_voided");
    expect((await voter.agent.get("/api/me").expect(200)).body.voteChangeable).toBe(false);
  });

  it("refuses a change to the pass's own entry", async () => {
    const { crew, a, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(a.agent, entryB.id).expect(201);
    const res = await change(a.agent, entryA.id).expect(409);
    expect(res.body.error).toBe("self_vote");
  });

  it("leaves exactly one counted vote under 20 concurrent changes (SC-102)", async () => {
    const { crew, voter, entryA, entryB, entryC } = await threeEntries();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    const targets = [entryB.id, entryC.id, entryA.id];
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => change(voter.agent, targets[i % 3]!)));
    for (const r of results) expect(r.status).toBe(200);
    const r = await rows(voter.pass.number);
    expect(r.filter((x) => x.status === "counted")).toHaveLength(1);
    expect(r.every((x) => x.status === "counted" || x.status === "replaced")).toBe(true);
    expect(await countedVotes()).toBe(1);
  });

  it("does not change the votes-cast total", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    const before = (await crew.get("/api/crew/dashboard").expect(200)).body.totals.votesCounted;
    await change(voter.agent, entryB.id).expect(200);
    await change(voter.agent, entryA.id).expect(200);
    const after = (await crew.get("/api/crew/dashboard").expect(200)).body.totals.votesCounted;
    expect(after).toBe(before);
  });

  it("keeps POST /api/votes as a first vote only, so a double-tap never becomes a change", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    expect((await vote(voter.agent, entryB.id).expect(409)).body.error).toBe("already_voted");
  });

  it("records a vote.change audit event with both choices", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    await change(voter.agent, entryB.id).expect(200);
    const [old, cur] = await rows(voter.pass.number);
    const r = await db().execute(sql`select actor_type as "actorType", details from audit_events where action = 'vote.change'`);
    expect(r.rows).toHaveLength(1);
    const ev = r.rows[0] as { actorType: string; details: Record<string, unknown> };
    expect(ev.actorType).toBe("pass");
    expect(ev.details).toMatchObject({
      fromVoteId: old!.id,
      toVoteId: cur!.id,
      fromEntryId: entryA.id,
      toEntryId: entryB.id,
      assisted: false,
    });
  });

  it("counts only the latest choice in the ranking", async () => {
    const { crew, voter, a, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    await vote(a.agent, entryB.id).expect(201);
    await change(voter.agent, entryB.id).expect(200);
    await goToStage(crew, "voting_closed");
    const ranking = await crew.get("/api/crew/ranking").expect(200);
    expect(ranking.body.places[0].entries[0].id).toBe(entryB.id);
    expect(ranking.body.places[0].votes).toBe(2);
    expect(ranking.body.places).toHaveLength(1);
  });

  it("lets crew change an assisted vote, marked crew-assisted (FR-106)", async () => {
    const { crew, entryA, entryB } = await setup();
    const created = await crew.post("/api/crew/passes").set(idem()).expect(201);
    const { id: passId, number } = created.body.pass;
    await goToStage(crew, "voting_open");
    await crew.post("/api/crew/assisted-votes").set(idem()).send({ passId, entryId: entryA.id }).expect(201);
    const res = await crew.put(`/api/crew/assisted-votes/${passId}`).set(idem()).send({ entryId: entryB.id }).expect(200);
    expect(res.body.changed).toBe(true);
    const [old, cur] = await rows(number);
    expect(old!.status).toBe("replaced");
    expect(old!.changedBy).toBeTruthy();
    expect(cur!.status).toBe("counted");
    expect(cur!.assistedBy).toBeTruthy();
    const log = await crew.get("/api/crew/votes?status=replaced").expect(200);
    expect(log.body.votes).toHaveLength(1);
    expect(log.body.votes[0].status).toBe("replaced");
  });

  it("restores a voided vote without reviving replaced ones", async () => {
    const { crew, voter, entryA, entryB } = await setup();
    await goToStage(crew, "voting_open");
    await vote(voter.agent, entryA.id).expect(201);
    await change(voter.agent, entryB.id).expect(200);
    const cur = (await rows(voter.pass.number))[1]!;
    await crew.post(`/api/crew/votes/${cur.id}/void`).set(idem()).expect(200);
    await crew.post(`/api/crew/votes/${cur.id}/restore`).set(idem()).expect(200);
    expect((await rows(voter.pass.number)).map((x) => [x.entryId, x.status])).toEqual([
      [entryA.id, "replaced"],
      [entryB.id, "counted"],
    ]);
  });
});
