import { sql } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { passes } from "@/server/db/schema";
import { invalidateAll } from "@/server/services/contest-state";
import { createEntry, idem, newCrewAgent, newPassAgent, newScreenAgent, passIdByNumber, resetDb, testApp } from "./helpers";

async function setWindow(start: string, end: string) {
  await db().execute(sql`update settings set event_start = ${start}, event_end = ${end}`);
  invalidateAll();
}

describe("Night Pass (US1)", () => {
  beforeEach(resetDb);

  it("issues a pass on first visit and sets a cookie", async () => {
    const res = await request(testApp()).post("/api/pass").expect(200);
    expect(res.body.pass.nickname).toMatch(/\w+ \w+/);
    expect(res.body.pass.number).toBe(1);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^np_live=.+HttpOnly/);
  });

  it("returns the same pass for the same cookie and creates no row", async () => {
    const { agent, pass } = await newPassAgent();
    const again = await agent.post("/api/pass").expect(200);
    expect(again.body.pass).toEqual(pass);
    const [{ n }] = (await db().execute(sql`select count(*)::int as n from passes`)).rows as [{ n: number }];
    expect(n).toBe(1);
  });

  it("refuses live passes before the window opens and after it ends", async () => {
    await setWindow("2099-01-01T00:00:00Z", "2099-01-02T00:00:00Z");
    const before = await request(testApp()).post("/api/pass").expect(403);
    expect(before.body.error).toBe("outside_window");
    await setWindow("2000-01-01T00:00:00Z", "2000-01-02T00:00:00Z");
    const after = await request(testApp()).post("/api/pass").expect(403);
    expect(after.body.error).toBe("outside_window");
  });

  it("issues rehearsal passes outside the window", async () => {
    await setWindow("2099-01-01T00:00:00Z", "2099-01-02T00:00:00Z");
    const crew = await newCrewAgent();
    await crew.post("/api/crew/rehearsal").set(idem()).send({ on: true }).expect(200);
    const res = await request(testApp()).post("/api/pass").expect(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^np_rehearsal=/);
  });

  it("blocks every pass request after the window ends but still serves crew and screen", async () => {
    const { agent, pass } = await newPassAgent();
    const crew = await newCrewAgent();
    const screen = await newScreenAgent();
    const entry = await createEntry(crew, [await passIdByNumber(crew, pass.number)]);

    await setWindow("2000-01-01T00:00:00Z", "2000-01-02T00:00:00Z");

    for (const res of [
      await agent.get("/api/me"),
      await agent.get("/api/entries"),
      await agent.get(entry.photo.thumb),
      await agent.post("/api/votes").set(idem()).send({ entryId: entry.id }),
      await agent.get("/api/results"),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("outside_window");
    }
    await crew.get(entry.photo.thumb).expect(200);
    await screen.get(entry.photo.thumb).expect(200);
  });

  it("issues 30 simultaneous passes with unique nicknames and numbers", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => request(testApp()).post("/api/pass")));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const numbers = results.map((r) => r.body.pass.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(new Set(results.map((r) => r.body.pass.nickname)).size).toBe(30);
  });

  it("stores only a token hash, never the raw token", async () => {
    const res = await request(testApp()).post("/api/pass").expect(200);
    const token = /np_live=([^;]+)/.exec(res.headers["set-cookie"]![0]!)![1]!;
    const [row] = await db().select().from(passes);
    expect(row!.tokenHash).toBeInstanceOf(Buffer);
    expect(row!.tokenHash!.length).toBe(32);
    expect(row!.tokenHash!.toString("base64url")).not.toBe(token);
    const dump = JSON.stringify((await db().execute(sql`select * from passes`)).rows);
    expect(dump).not.toContain(decodeURIComponent(token));
  });
});

describe("pass QR code and crew scan (spec 002 US6, FR-123–FR-128)", () => {
  beforeEach(resetDb);

  async function codeFor(realm: "live" | "rehearsal", number: number, id: string) {
    const { encodeScanCode } = await import("@/server/services/scanCode");
    const { config } = await import("@/server/config");
    return encodeScanCode({ realm, number, id }, config().SESSION_SECRET);
  }

  it("serves the pass's QR code only to that pass, never cached", async () => {
    const { agent } = await newPassAgent();
    const res = await agent.get("/api/pass/code.svg").expect(200);
    expect(res.headers["content-type"]).toMatch(/^image\/svg\+xml/);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(String(res.body ?? res.text)).toContain("<svg");
    await request(testApp()).get("/api/pass/code.svg").expect(401);
  });

  it("lets crew resolve a scanned code to the pass, including its entry", async () => {
    const crew = await newCrewAgent();
    const { pass } = await newPassAgent();
    const id = await passIdByNumber(crew, pass.number);
    const entry = await createEntry(crew, [id]);
    const res = await crew.get(`/api/crew/passes/scan?code=${encodeURIComponent(await codeFor("live", pass.number, id))}`).expect(200);
    expect(res.body.pass).toEqual({ id, number: pass.number, nickname: pass.nickname, origin: "self", entryId: entry.id });
  });

  it("rejects forged, malformed, unknown, and wrong-mode codes", async () => {
    const crew = await newCrewAgent();
    const { pass } = await newPassAgent();
    const id = await passIdByNumber(crew, pass.number);
    const good = await codeFor("live", pass.number, id);
    const scan = (code: string) => crew.get(`/api/crew/passes/scan?code=${encodeURIComponent(code)}`);

    const forged = good.slice(0, -1) + (good.endsWith("A") ? "B" : "A");
    expect((await scan(forged).expect(400)).body.error).toBe("bad_scan_code");
    // Another pass's number with this pass's MAC: a forged code for someone else.
    const other = good.replace(`.${pass.number}.`, `.${pass.number + 1}.`);
    expect((await scan(other).expect(400)).body.error).toBe("bad_scan_code");
    expect((await scan("https://example.com").expect(400)).body.error).toBe("bad_scan_code");
    expect((await scan(await codeFor("rehearsal", pass.number, id)).expect(409)).body.error).toBe("wrong_realm");
  });

  it("is crew-only", async () => {
    const { agent, pass } = await newPassAgent();
    const res = await agent.get(`/api/crew/passes/scan?code=NP1.L.${pass.number}.ABCDEFGHIJKL`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("not_crew");
  });

  it("binds the pass to the device: an altered cookie is no pass, and the phone gets a new one (FR-128)", async () => {
    const first = await request(testApp()).post("/api/pass").expect(200);
    const cookie = String(first.headers["set-cookie"]?.[0]);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const token = /^np_live=([^;]+)/.exec(cookie)![1]!;
    const altered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    const me = await request(testApp()).get("/api/me").set("Cookie", `np_live=${altered}`).expect(401);
    expect(me.body.error).toBe("no_pass");
    const again = await request(testApp()).post("/api/pass").set("Cookie", `np_live=${altered}`).expect(200);
    expect(again.body.pass.number).not.toBe(first.body.pass.number);
  });
});

describe("own entry on the pass (spec 002 US5, FR-121–FR-122)", () => {
  beforeEach(resetDb);

  async function stageTo(crew: Awaited<ReturnType<typeof newCrewAgent>>, target: string) {
    for (let i = 0; i < 8; i++) {
      const s = (await crew.get("/api/state").expect(200)).body;
      if (`${s.stage}:${s.revealStep}` === target) return;
      await crew.post("/api/crew/stage").set(idem()).send({ action: "advance", from: { stage: s.stage, revealStep: s.revealStep } }).expect(200);
    }
    throw new Error(`never reached ${target}`);
  }

  it("shows the contestant's own entry with no counts, and their place only once revealed", async () => {
    const crew = await newCrewAgent();
    const winner = await newPassAgent();
    const runnerUp = await newPassAgent();
    const voters = await Promise.all([newPassAgent(), newPassAgent(), newPassAgent()]);
    const wEntry = await createEntry(crew, [await passIdByNumber(crew, winner.pass.number)]);
    const rEntry = await createEntry(crew, [await passIdByNumber(crew, runnerUp.pass.number)]);

    const before = (await runnerUp.agent.get("/api/me").expect(200)).body;
    expect(before.ownEntry.id).toBe(rEntry.id);
    expect(before.ownEntry).toHaveProperty("costumeTitle");
    expect(before.ownPlace).toBeNull();

    await stageTo(crew, "voting_open:0");
    for (const v of voters.slice(0, 2)) await v.agent.post("/api/votes").set(idem()).send({ entryId: wEntry.id }).expect(201);
    await voters[2]!.agent.post("/api/votes").set(idem()).send({ entryId: rEntry.id }).expect(201);
    await stageTo(crew, "results_revealed:1"); // 2nd place (the runner-up) is revealed first

    const winnerMe = (await winner.agent.get("/api/me").expect(200)).body;
    expect(winnerMe.ownPlace).toBeNull(); // 1st not revealed yet
    const runnerMe = (await runnerUp.agent.get("/api/me").expect(200)).body;
    expect(runnerMe.ownPlace).toEqual({ place: 2, tied: false });
    expect(JSON.stringify(runnerMe)).not.toMatch(/"votes"|"count"/);

    await stageTo(crew, "results_revealed:2");
    expect((await winner.agent.get("/api/me").expect(200)).body.ownPlace).toEqual({ place: 1, tied: false });
  });

  it("drops the card when the entry is removed, and shows none for a non-contestant", async () => {
    const crew = await newCrewAgent();
    const student = await newPassAgent();
    const other = await newPassAgent();
    const entry = await createEntry(crew, [await passIdByNumber(crew, student.pass.number)]);
    expect((await other.agent.get("/api/me").expect(200)).body).toMatchObject({ ownEntry: null, ownPlace: null });
    await crew.delete(`/api/crew/entries/${entry.id}`).set(idem()).expect(200);
    expect((await student.agent.get("/api/me").expect(200)).body).toMatchObject({ ownEntryId: null, ownEntry: null, ownPlace: null });
  });
});
