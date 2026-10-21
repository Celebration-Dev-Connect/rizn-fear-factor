import fs from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { config, resetConfigForTests } from "@/server/config";
import { db } from "@/server/db/client";
import { purgeAll, purgePhotosIfDue } from "@/server/services/purge";
import { createEntry, goToStage, idem, newCrewAgent, newPassAgent, newScreenAgent, passIdByNumber, resetDb, testApp, testJpeg } from "./helpers";

const photoFiles = async () => (await fs.readdir(config().PHOTO_DIR)).filter((f) => f.endsWith(".webp"));

describe("photo handling (US3, Constitution VII)", () => {
  beforeEach(resetDb);

  it("strips EXIF and GPS metadata from stored photos", async () => {
    const crew = await newCrewAgent();
    const { pass } = await newPassAgent();
    const input = await testJpeg({ gps: true, width: 2000 });
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const passId = await passIdByNumber(crew, pass.number);

    const res = await crew
      .post("/api/crew/entries")
      .set(idem())
      .field("consent", "true")
      .field("passIds[]", passId)
      .attach("photo", input, { filename: "gps.jpg", contentType: "image/jpeg" })
      .expect(201);

    const files = await photoFiles();
    expect(files).toHaveLength(2);
    for (const f of files) {
      const m = await sharp(path.join(config().PHOTO_DIR, f)).metadata();
      expect(m.format).toBe("webp");
      expect(m.exif).toBeUndefined();
      expect(m.xmp).toBeUndefined();
      expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(1200);
    }
    const full = await crew.get(res.body.entry.photo.full).expect(200);
    expect(full.headers["cache-control"]).toBe("private, max-age=86400, immutable");
    expect((await sharp(full.body).metadata()).exif).toBeUndefined();
  });

  it("rejects oversize, non-image, unconsented, and already-entered uploads", async () => {
    const crew = await newCrewAgent();
    const { pass } = await newPassAgent();
    const passId = await passIdByNumber(crew, pass.number);
    const post = () => crew.post("/api/crew/entries").set(idem()).field("passIds[]", passId);

    const big = Buffer.alloc(3 * 1024 * 1024 + 10, 1);
    expect((await post().field("consent", "true").attach("photo", big, { filename: "a.jpg", contentType: "image/jpeg" })).status).toBe(413);

    const text = Buffer.from("not an image");
    const r415 = await post().field("consent", "true").attach("photo", text, { filename: "a.txt", contentType: "text/plain" });
    expect(r415.status).toBe(415);
    const fake = await post().field("consent", "true").attach("photo", text, { filename: "a.jpg", contentType: "image/jpeg" });
    expect(fake.status).toBe(415);

    const noConsent = await post().attach("photo", await testJpeg(), { filename: "a.jpg", contentType: "image/jpeg" });
    expect(noConsent.status).toBe(422);
    expect(noConsent.body.error).toBe("consent_required");

    await createEntry(crew, [passId]);
    const dup = await post().field("consent", "true").attach("photo", await testJpeg(), { filename: "a.jpg", contentType: "image/jpeg" });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("pass_already_entered");
    expect(await photoFiles()).toHaveLength(2); // only the one real entry
  });

  it("serves photos only to pass, crew, and screen cookies in the active realm", async () => {
    const crew = await newCrewAgent();
    const { agent, pass } = await newPassAgent();
    const entry = await createEntry(crew, [await passIdByNumber(crew, pass.number)]);
    await request(testApp()).get(entry.photo.thumb).expect(401);
    await agent.get(entry.photo.thumb).expect(200);
    await crew.get(entry.photo.thumb).expect(200);
    await (await newScreenAgent()).get(entry.photo.thumb).expect(200);

    // Switch to rehearsal: the live photo is not visible to a rehearsal pass.
    await crew.post("/api/crew/rehearsal").set(idem()).send({ on: true }).expect(200);
    const rehearsalPass = await newPassAgent();
    await rehearsalPass.agent.get(entry.photo.thumb).expect(404);
  });

  it("returns 410 after PHOTO_DELETE_AT", async () => {
    const crew = await newCrewAgent();
    const { pass } = await newPassAgent();
    const entry = await createEntry(crew, [await passIdByNumber(crew, pass.number)]);
    const original = process.env.PHOTO_DELETE_AT;
    process.env.PHOTO_DELETE_AT = "2000-01-01T00:00:00Z";
    resetConfigForTests();
    try {
      const res = await crew.get(entry.photo.thumb).expect(410);
      expect(res.body.error).toBe("photos_deleted");
    } finally {
      process.env.PHOTO_DELETE_AT = original;
      resetConfigForTests();
    }
  });

  it("deletes both files and releases votes when an entry is removed", async () => {
    const crew = await newCrewAgent();
    const a = await newPassAgent();
    const voter = await newPassAgent();
    const entry = await createEntry(crew, [await passIdByNumber(crew, a.pass.number)]);
    await goToStage(crew, "voting_open");
    await voter.agent.post("/api/votes").set(idem()).send({ entryId: entry.id }).expect(201);
    expect(await photoFiles()).toHaveLength(2);
    const res = await crew.delete(`/api/crew/entries/${entry.id}`).set(idem()).expect(200);
    expect(res.body.releasedVotes).toBe(1);
    expect(await photoFiles()).toHaveLength(0);
    const r = await db().execute(sql`select status from votes`);
    expect(r.rows).toEqual([{ status: "released" }]);
  });

  it("creates one entry when a save is retried with the same key", async () => {
    const crew = await newCrewAgent();
    const { pass } = await newPassAgent();
    const passId = await passIdByNumber(crew, pass.number);
    const key = idem();
    const photo = await testJpeg();
    const send = () =>
      crew.post("/api/crew/entries").set(key).field("consent", "true").field("passIds[]", passId)
        .attach("photo", photo, { filename: "a.jpg", contentType: "image/jpeg" });
    const first = await send().expect(201);
    const retry = await send().expect(201);
    expect(retry.body.entry.id).toBe(first.body.entry.id);
    const r = await db().execute(sql`select count(*)::int as n from entries`);
    expect(r.rows[0]).toEqual({ n: 1 });
  });

  it("purges photo files once PHOTO_DELETE_AT passes, and purge --all clears every row", async () => {
    const crew = await newCrewAgent();
    const { pass } = await newPassAgent();
    await createEntry(crew, [await passIdByNumber(crew, pass.number)]);
    await purgePhotosIfDue(new Date("2099-12-31T00:00:00Z"));
    expect(await photoFiles()).toHaveLength(2); // not due yet
    await purgePhotosIfDue(new Date("2100-01-02T00:00:00Z"));
    expect(await photoFiles()).toHaveLength(0);
    await purgeAll();
    const r = await db().execute(sql`select (select count(*)::int from passes) + (select count(*)::int from entries) + (select count(*)::int from votes) as n`);
    expect(r.rows[0]).toEqual({ n: 0 });
  });
});
