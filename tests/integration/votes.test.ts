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
