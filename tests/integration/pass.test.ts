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
