import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testApp } from "./helpers";

describe("crew sign-in (US3)", () => {
  beforeEach(resetDb);

  it("sets a signed crew cookie for the right passcode", async () => {
    const res = await request(testApp())
      .post("/api/crew/session")
      .send({ passcode: "boo-crew-2026", deviceLabel: "Tablet A" })
      .expect(204);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^crew=s%3A.+HttpOnly/);
  });

  it("rejects free-text device labels", async () => {
    await request(testApp())
      .post("/api/crew/session")
      .send({ passcode: "boo-crew-2026", deviceLabel: "Jenny's phone" })
      .expect(400);
  });

  it("returns 401 for a wrong passcode and 429 after 5 failures", async () => {
    const attempt = () =>
      request(testApp()).post("/api/crew/session").send({ passcode: "nope", deviceLabel: "Tablet A" });
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("too_many_attempts");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("rejects crew endpoints without the cookie", async () => {
    for (const path of ["/api/crew/dashboard", "/api/crew/votes", "/api/crew/passes?q=1"]) {
      const res = await request(testApp()).get(path).expect(401);
      expect(res.body.error).toBe("not_crew");
    }
  });
});
