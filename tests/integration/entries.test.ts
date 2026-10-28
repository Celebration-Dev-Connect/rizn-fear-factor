import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { idem, newCrewAgent, newPassAgent, passIdByNumber, resetDb, testJpeg, type Agent } from "./helpers";

let jpeg: Buffer;
beforeAll(async () => {
  jpeg = await testJpeg();
});

function addWithTitle(crew: Agent, passId: string, costumeTitle?: string) {
  const req = crew.post("/api/crew/entries").set(idem()).field("consent", "true").field("passIds[]", passId);
  if (costumeTitle !== undefined) req.field("costumeTitle", costumeTitle);
  return req.attach("photo", jpeg, { filename: "c.jpg", contentType: "image/jpeg" });
}

async function auditDetails(action: string): Promise<Record<string, unknown>[]> {
  const r = await db().execute(sql`select details from audit_events where action = ${action} order by id`);
  return r.rows.map((x) => (x as { details: Record<string, unknown> }).details);
}

describe("costume titles (spec 002 US2, FR-107–FR-110)", () => {
  beforeEach(resetDb);

  async function contestant() {
    const crew = await newCrewAgent();
    const student = await newPassAgent();
    return { crew, student, passId: await passIdByNumber(crew, student.pass.number) };
  }

  it("stores a normalized title and shows it on cards and in the alt text", async () => {
    const { crew, student, passId } = await contestant();
    const res = await addWithTitle(crew, passId, "  Super   man ").expect(201);
    expect(res.body.entry.costumeTitle).toBe("Super man");
    const list = await student.agent.get("/api/entries").expect(200);
    const card = list.body.entries[0];
    expect(card.costumeTitle).toBe("Super man");
    expect(card.alt).toBe(`Costume photo: ${student.pass.nickname} as Super man`);
    const [create] = await auditDetails("entry.create");
    expect(create).toMatchObject({ costumeTitle: "Super man" });
  });

  it("is optional: no field means no title", async () => {
    const { crew, passId } = await contestant();
    const res = await addWithTitle(crew, passId).expect(201);
    expect(res.body.entry.costumeTitle).toBeNull();
    expect(res.body.entry.alt).toMatch(/^Costume photo of /);
  });

  it("rejects 41 characters and control characters", async () => {
    const { crew, passId } = await contestant();
    const long = await addWithTitle(crew, passId, "x".repeat(41)).expect(400);
    expect(long.body.error).toBe("invalid_request");
    const ctrl = await addWithTitle(crew, passId, "Super\u0007man").expect(400);
    expect(ctrl.body.error).toBe("invalid_request");
    await addWithTitle(crew, passId, "x".repeat(40)).expect(201);
  });

  it("edits and clears a title, with an audit trail and a gallery refresh", async () => {
    const { crew, passId } = await contestant();
    const created = await addWithTitle(crew, passId, "Superman").expect(201);
    const id = created.body.entry.id;
    const v0 = (await crew.get("/api/state").expect(200)).body.entriesVersion;

    const edited = await crew.patch(`/api/crew/entries/${id}`).set(idem()).field("costumeTitle", "Batman").expect(200);
    expect(edited.body.entry.costumeTitle).toBe("Batman");
    expect((await crew.get("/api/state").expect(200)).body.entriesVersion).toBeGreaterThan(v0);

    const cleared = await crew.patch(`/api/crew/entries/${id}`).set(idem()).field("costumeTitle", "").expect(200);
    expect(cleared.body.entry.costumeTitle).toBeNull();

    const updates = await auditDetails("entry.update");
    expect(updates.map((d) => d.costumeTitle)).toEqual([
      { from: "Superman", to: "Batman" },
      { from: "Batman", to: null },
    ]);
  });

  it("leaves the title alone when a patch doesn't send it", async () => {
    const { crew, passId } = await contestant();
    const created = await addWithTitle(crew, passId, "Superman").expect(201);
    const patched = await crew
      .patch(`/api/crew/entries/${created.body.entry.id}`)
      .set(idem())
      .attach("photo", await testJpeg(), { filename: "c.jpg", contentType: "image/jpeg" })
      .expect(200);
    expect(patched.body.entry.costumeTitle).toBe("Superman");
    const [update] = await auditDetails("entry.update");
    expect(update).not.toHaveProperty("costumeTitle");
  });

  it("is crew-only", async () => {
    const { student, passId } = await contestant();
    const res = await student.agent
      .post("/api/crew/entries")
      .set(idem())
      .field("consent", "true")
      .field("passIds[]", passId)
      .field("costumeTitle", "Superman")
      .attach("photo", await testJpeg(), { filename: "c.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("not_crew");
  });

  it("is wiped with rehearsal entries", async () => {
    const crew = await newCrewAgent();
    await crew.post("/api/crew/rehearsal").set(idem()).send({ on: true }).expect(200);
    const student = await newPassAgent();
    await addWithTitle(crew, await passIdByNumber(crew, student.pass.number), "Ghost").expect(201);
    await crew.post("/api/crew/rehearsal/wipe").set(idem()).send({ confirm: "WIPE" }).expect(200);
    const r = await db().execute(sql`select count(*)::int as n from entries where costume_title is not null`);
    expect((r.rows[0] as { n: number }).n).toBe(0);
  });
});

describe("first names (spec 003 US1, FR-201–FR-208)", () => {
  beforeEach(resetDb);

  function add(crew: Agent, passIds: string[], opts: { title?: string; names?: Record<string, string> } = {}) {
    const req = crew.post("/api/crew/entries").set(idem()).field("consent", "true");
    for (const id of passIds) req.field("passIds[]", id);
    if (opts.title) req.field("costumeTitle", opts.title);
    if (opts.names) req.field("firstNames", JSON.stringify(opts.names));
    return req.attach("photo", jpeg, { filename: "c.jpg", contentType: "image/jpeg" });
  }

  async function two() {
    const crew = await newCrewAgent();
    const a = await newPassAgent();
    const b = await newPassAgent();
    return {
      crew,
      a,
      b,
      aId: await passIdByNumber(crew, a.pass.number),
      bId: await passIdByNumber(crew, b.pass.number),
    };
  }

  it("shows the first name instead of the nickname, mixed with nicknames in a group", async () => {
    const { crew, a, b, aId, bId } = await two();
    const res = await add(crew, [aId, bId], { title: "The Ghostbusters", names: { [aId]: "Ben" } }).expect(201);
    expect(res.body.entry.displayName).toBe(`Ben & ${b.pass.nickname}`);
    expect(res.body.entry.alt).toBe(`Costume photo: Ben & ${b.pass.nickname} as The Ghostbusters`);
    const me = await a.agent.get("/api/me").expect(200);
    expect(me.body.ownEntry.displayName).toBe(`Ben & ${b.pass.nickname}`);
    expect(me.body.pass.nickname).toBe(a.pass.nickname); // the student's own pass keeps its nickname
  });

  it("accepts single given names and refuses anything else (SC-202)", async () => {
    const { crew, aId } = await two();
    for (const bad of ["Ben Smith", "B3n", "B.", "x".repeat(21), "Ben!", "-Ben", "Ben-", "555-1234"]) {
      const res = await add(crew, [aId], { names: { [aId]: bad } }).expect(400);
      expect(res.body.error).toBe("invalid_request");
      expect(res.body.message).toMatch(/First name only/);
    }
    for (const good of ["Mary-Kate", "D'Andre", "Zoë", "Ben"]) {
      const created = await add(crew, [aId], { names: { [aId]: good } }).expect(201);
      expect(created.body.entry.displayName).toBe(good);
      await crew.delete(`/api/crew/entries/${created.body.entry.id}`).set(idem()).expect(200);
    }
  });

  it("refuses a name for a pass that isn't in the entry", async () => {
    const { crew, aId, bId } = await two();
    const res = await add(crew, [aId], { names: { [bId]: "Ben" } }).expect(400);
    expect(res.body.error).toBe("invalid_request");
  });

  it("edits and clears names; passes left out keep theirs", async () => {
    const { crew, b, aId, bId } = await two();
    const created = await add(crew, [aId, bId], { names: { [aId]: "Ben", [bId]: "Ava" } }).expect(201);
    const id = created.body.entry.id;
    const cleared = await crew.patch(`/api/crew/entries/${id}`).set(idem()).field("firstNames", JSON.stringify({ [bId]: "" })).expect(200);
    expect(cleared.body.entry.displayName).toBe(`Ben & ${b.pass.nickname}`);
    const renamed = await crew.patch(`/api/crew/entries/${id}`).set(idem()).field("firstNames", JSON.stringify({ [aId]: "Benji" })).expect(200);
    expect(renamed.body.entry.displayName).toBe(`Benji & ${b.pass.nickname}`);
  });

  it("clears names when the entry is removed, and finds passes by first name while set", async () => {
    const { crew, a, aId } = await two();
    const created = await add(crew, [aId], { names: { [aId]: "Ben" } }).expect(201);
    const hits = await crew.get("/api/crew/passes?q=ben").expect(200);
    expect(hits.body.passes).toEqual([expect.objectContaining({ id: aId, firstName: "Ben", number: a.pass.number })]);
    await crew.delete(`/api/crew/entries/${created.body.entry.id}`).set(idem()).expect(200);
    expect((await crew.get("/api/crew/passes?q=ben").expect(200)).body.passes).toEqual([]);
    const r = await db().execute(sql`select count(*)::int as n from passes where first_name is not null`);
    expect((r.rows[0] as { n: number }).n).toBe(0);
  });

  it("never writes the name into the audit log (FR-207)", async () => {
    const { crew, aId } = await two();
    const created = await add(crew, [aId], { names: { [aId]: "Zebediah" } }).expect(201);
    await crew.patch(`/api/crew/entries/${created.body.entry.id}`).set(idem()).field("firstNames", JSON.stringify({ [aId]: "" })).expect(200);
    const r = await db().execute(sql`select count(*)::int as n from audit_events where details::text ilike '%Zebediah%'`);
    expect((r.rows[0] as { n: number }).n).toBe(0);
    const [create] = await auditDetails("entry.create");
    expect(create).toMatchObject({ firstNamesSet: [aId] });
    const [update] = await auditDetails("entry.update");
    expect(update).toMatchObject({ firstNamesCleared: [aId] });
  });

  it("is wiped with rehearsal data (SC-203)", async () => {
    const crew = await newCrewAgent();
    await crew.post("/api/crew/rehearsal").set(idem()).send({ on: true }).expect(200);
    const s = await newPassAgent();
    const id = await passIdByNumber(crew, s.pass.number);
    await add(crew, [id], { names: { [id]: "Ben" } }).expect(201);
    await crew.post("/api/crew/rehearsal/wipe").set(idem()).send({ confirm: "WIPE" }).expect(200);
    const r = await db().execute(sql`select count(*)::int as n from passes where first_name is not null`);
    expect((r.rows[0] as { n: number }).n).toBe(0);
  });
});
