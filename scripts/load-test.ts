// SC-005 load check (T082): 400 phones polling /api/state for 60 s while 350 passes each cast
// one vote. Runs in the rehearsal contest and wipes it afterward, so live data is untouched.
//   LOAD_BASE_URL=https://fear.example.org CREW_PASSCODE=... npm run test:load
import { randomUUID } from "node:crypto";
import autocannon from "autocannon";
import sharp from "sharp";

const BASE = process.env.LOAD_BASE_URL ?? process.env.PUBLIC_URL ?? "http://localhost:3000";
const PASSCODE = process.env.CREW_PASSCODE!;
const DURATION_S = Number(process.env.LOAD_DURATION_S ?? 60);
const POLLERS = 400;
const VOTERS = 350;
const P95_LIMIT_MS = 300;

const idem = () => ({ "Idempotency-Key": randomUUID() });
const cookieOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

async function crewSession(): Promise<string> {
  const res = await fetch(`${BASE}/api/crew/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode: PASSCODE, deviceLabel: "Tablet B" }),
  });
  if (res.status !== 204) throw new Error(`crew sign-in failed: ${res.status}`);
  return cookieOf(res);
}

async function crewPost(cookie: string, path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json", ...idem() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const crew = await crewSession();
  await crewPost(crew, "/api/crew/rehearsal", { on: true });
  await crewPost(crew, "/api/crew/rehearsal/wipe", { confirm: "WIPE" });

  // Two costumes from crew passes.
  const entries: string[] = [];
  for (let i = 0; i < 2; i++) {
    const { pass } = await crewPost(crew, "/api/crew/passes", {});
    const form = new FormData();
    form.append("consent", "true");
    form.append("passIds[]", pass.id);
    const jpg = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#ff7a1a" } }).jpeg().toBuffer();
    form.append("photo", new Blob([new Uint8Array(jpg)], { type: "image/jpeg" }), "c.jpg");
    const res = await fetch(`${BASE}/api/crew/entries`, { method: "POST", headers: { cookie: crew, ...idem() }, body: form });
    entries.push((await res.json()).entry.id);
  }
  const state = await (await fetch(`${BASE}/api/state`, { headers: { cookie: crew } })).json();
  await crewPost(crew, "/api/crew/stage", { action: "advance", from: { stage: state.stage, revealStep: state.revealStep } });

  console.log(`Polling with ${POLLERS} connections for ${DURATION_S}s while ${VOTERS} passes vote…`);
  const polling = autocannon({
    url: `${BASE}/api/state`,
    connections: POLLERS,
    duration: DURATION_S,
    // Real peak: 400 phones every 3 s ≈ 135 req/s. Test at 2× for headroom.
    overallRate: Math.round((POLLERS / 3) * 2),
  });

  let voteErrors = 0;
  const errorStatuses = new Map<string, number>();
  const voteLatencies: number[] = [];
  const voting = (async () => {
    const queue = Array.from({ length: VOTERS }, (_, i) => i);
    await Promise.all(
      Array.from({ length: 25 }, async () => {
        while (queue.length) {
          const i = queue.shift()!;
          const passRes = await fetch(`${BASE}/api/pass`, { method: "POST" });
          const cookie = cookieOf(passRes);
          const t0 = performance.now();
          const res = await fetch(`${BASE}/api/votes`, {
            method: "POST",
            headers: { cookie, "Content-Type": "application/json", ...idem() },
            body: JSON.stringify({ entryId: entries[i % 2] }),
          });
          voteLatencies.push(performance.now() - t0);
          if (res.status !== 201) {
            voteErrors++;
            const key = `${passRes.status}/${res.status} ${(await res.text()).slice(0, 60)}`;
            errorStatuses.set(key, (errorStatuses.get(key) ?? 0) + 1);
          }
        }
      }),
    );
  })();

  const [result] = await Promise.all([polling, voting]);
  const totals = await (await fetch(`${BASE}/api/crew/dashboard`, { headers: { cookie: crew } })).json();

  await crewPost(crew, "/api/crew/rehearsal/wipe", { confirm: "WIPE" });
  await crewPost(crew, "/api/crew/rehearsal", { on: false });

  voteLatencies.sort((a, b) => a - b);
  const voteP95 = voteLatencies[Math.floor(voteLatencies.length * 0.95)] ?? 0;
  const pollP95 = result.latency.p97_5 ?? 0; // autocannon reports p97.5, stricter than p95
  const pollErrors = result.errors + result.non2xx;
  console.log(`poll: ${Math.round(result.requests.average)} req/s, p97.5 ${pollP95} ms, errors ${pollErrors}`);
  console.log(`votes: ${voteLatencies.length} cast, p95 ${voteP95.toFixed(0)} ms, errors ${voteErrors}, counted ${totals.totals.votesCounted}`);

  if (errorStatuses.size) console.log("vote error statuses (pass/vote):", Object.fromEntries(errorStatuses));
  const failures = [
    pollErrors > 0 && `poll errors: ${pollErrors}`,
    pollP95 > P95_LIMIT_MS && `poll latency ${pollP95} ms > ${P95_LIMIT_MS}`,
    voteP95 > P95_LIMIT_MS && `vote latency ${voteP95.toFixed(0)} ms > ${P95_LIMIT_MS}`,
    voteErrors > 0 && `vote errors: ${voteErrors}`,
    totals.totals.votesCounted !== VOTERS && `counted ${totals.totals.votesCounted}, expected ${VOTERS}`,
  ].filter(Boolean);
  if (failures.length) {
    console.error(`❌ Load test failed:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log("✅ Load test passed (SC-002, SC-005)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
