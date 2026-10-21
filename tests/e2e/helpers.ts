import { randomUUID } from "node:crypto";
import { request, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASSCODE = process.env.CREW_PASSCODE ?? "boo-crew-dev";

const idem = () => ({ "Idempotency-Key": randomUUID() });

/** A crew API session that puts the app in a fresh rehearsal contest (never touches live data). */
export async function crewApi(): Promise<APIRequestContext & { cleanup: () => Promise<void> }> {
  const ctx = await request.newContext({ baseURL: BASE });
  const r = await ctx.post("/api/crew/session", { data: { passcode: PASSCODE, deviceLabel: "Tablet B" } });
  if (r.status() !== 204) throw new Error(`crew sign-in failed: ${r.status()}`);
  await ctx.post("/api/crew/rehearsal", { headers: idem(), data: { on: true } });
  await ctx.post("/api/crew/rehearsal/wipe", { headers: idem(), data: { confirm: "WIPE" } });
  return Object.assign(ctx, {
    cleanup: async () => {
      await ctx.post("/api/crew/rehearsal/wipe", { headers: idem(), data: { confirm: "WIPE" } });
      await ctx.post("/api/crew/rehearsal", { headers: idem(), data: { on: false } });
      await ctx.dispose();
    },
  });
}

export async function addEntry(crew: APIRequestContext, passId?: string): Promise<{ id: string; displayName: string }> {
  const id = passId ?? (await (await crew.post("/api/crew/passes", { headers: idem() })).json()).pass.id;
  const photo = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#8f5bd6" } }).jpeg().toBuffer();
  const res = await crew.post("/api/crew/entries", {
    headers: idem(),
    multipart: { consent: "true", "passIds[]": id, photo: { name: "c.jpg", mimeType: "image/jpeg", buffer: photo } },
  });
  if (res.status() !== 201) throw new Error(`entry failed ${res.status()} ${await res.text()}`);
  return (await res.json()).entry;
}

export async function advance(crew: APIRequestContext, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    const s = await (await crew.get("/api/state")).json();
    const r = await crew.post("/api/crew/stage", { headers: idem(), data: { action: "advance", from: { stage: s.stage, revealStep: s.revealStep } } });
    if (r.status() !== 200) throw new Error(`advance failed ${await r.text()}`);
  }
}

export async function findPassId(crew: APIRequestContext, number: number): Promise<string> {
  const r = await (await crew.get(`/api/crew/passes?q=${number}`)).json();
  return r.passes.find((p: { number: number }) => p.number === number).id;
}
