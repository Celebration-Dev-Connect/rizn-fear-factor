import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { createApp } from "@/server/app";
import { config } from "@/server/config";
import { db } from "@/server/db/client";
import { resetRateLimitsForTests } from "@/server/middleware/rateLimit";
import { invalidateAll } from "@/server/services/contest-state";

export type Agent = TestAgent;

let server: http.Server | undefined;
/** One listening server for the whole run, shared by every supertest agent. */
export function testApp(): http.Server {
  server ??= http.createServer(createApp()).listen(0);
  return server;
}

/** Clears all rows and photos and puts both contests back at setup. */
export async function resetDb(): Promise<void> {
  await db().execute(
    sql`truncate votes, entry_passes, entries, passes, audit_events, idempotency_keys, crew_sessions restart identity cascade`,
  );
  await db().execute(
    sql`update contest set stage = 'setup', reveal_step = 0, version = 0, entries_version = 0`,
  );
  await db().execute(
    sql`update settings set rehearsal_mode = false, event_start = ${config().EVENT_START}, event_end = ${config().EVENT_END}`,
  );
  await fs.rm(config().PHOTO_DIR, { recursive: true, force: true });
  await fs.mkdir(config().PHOTO_DIR, { recursive: true });
  invalidateAll();
  resetRateLimitsForTests();
}

export const idem = () => ({ "Idempotency-Key": randomUUID() });

export async function newPassAgent(): Promise<{ agent: Agent; pass: { number: number; nickname: string } }> {
  const agent = request.agent(testApp());
  const res = await agent.post("/api/pass").expect(200);
  return { agent, pass: res.body.pass };
}

export async function newCrewAgent(deviceLabel = "Crew phone 1"): Promise<Agent> {
  const agent = request.agent(testApp());
  await agent
    .post("/api/crew/session")
    .send({ passcode: config().CREW_PASSCODE, deviceLabel })
    .expect(204);
  return agent;
}

export async function newScreenAgent(): Promise<Agent> {
  const agent = request.agent(testApp());
  await agent.get(`/screen?t=${config().SCREEN_TOKEN}`).expect(302);
  return agent;
}

/** A small JPEG; with `gps` it carries EXIF including GPS tags so stripping can be verified. */
export async function testJpeg(opts: { gps?: boolean; width?: number } = {}): Promise<Buffer> {
  let img = sharp({
    create: { width: opts.width ?? 800, height: 600, channels: 3, background: { r: 255, g: 122, b: 26 } },
  }).jpeg();
  if (opts.gps) {
    img = img.withExif({
      IFD0: { Make: "TestCam", Model: "Phone" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "53/1 32/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "113/1 29/1 0/1" },
    });
  }
  return img.toBuffer();
}

export async function passIdByNumber(crew: Agent, number: number): Promise<string> {
  const res = await crew.get(`/api/crew/passes?q=${number}`).expect(200);
  const hit = res.body.passes.find((p: { number: number }) => p.number === number);
  if (!hit) throw new Error(`pass #${number} not found`);
  return hit.id;
}

export async function createEntry(crew: Agent, passIds: string[]): Promise<{ id: string; photo: { thumb: string; full: string } }> {
  const req = crew.post("/api/crew/entries").set(idem()).field("consent", "true");
  for (const id of passIds) req.field("passIds[]", id);
  const res = await req.attach("photo", await testJpeg(), { filename: "c.jpg", contentType: "image/jpeg" });
  if (res.status !== 201) throw new Error(`createEntry ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.entry;
}

export async function stage(crew: Agent, action: "advance" | "undo"): Promise<request.Response> {
  const state = (await crew.get("/api/state").expect(200)).body;
  return crew
    .post("/api/crew/stage")
    .set(idem())
    .send({ action, from: { stage: state.stage, revealStep: state.revealStep } });
}

export async function goToStage(crew: Agent, target: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const s = (await crew.get("/api/state").expect(200)).body;
    if (s.stage === target) return;
    const res = await stage(crew, "advance");
    if (res.status !== 200) throw new Error(`advance failed: ${JSON.stringify(res.body)}`);
  }
  throw new Error(`never reached ${target}`);
}
