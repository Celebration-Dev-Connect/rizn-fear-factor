"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark, RiznYouthMark } from "@/components/BrandMark";
import { PassBadge } from "@/components/PassBadge";
import { Stickers } from "@/components/Stickers";
import { YourCostume } from "@/components/YourCostume";
import { usePublicState } from "@/components/StateProvider";
import { api, ApiRequestError } from "@/lib/api";
import { formatEdmontonTime } from "@/lib/time";
import { RIZN_INFO } from "@/content/rizn";
import type { Me, Pass } from "@/shared/types";

export default function NightPassPage() {
  const { state } = usePublicState();
  const [issued, setIssued] = useState<{ rehearsal: boolean; pass: Pass }>();
  const [problem, setProblem] = useState<string>();
  const status = state?.event.status;
  const rehearsal = state?.rehearsal ?? false;
  // Rehearsal and live use different passes, so a pass only counts for the mode it came from.
  const pass = issued?.rehearsal === rehearsal ? issued.pass : undefined;
  const [me, setMe] = useState<Me>();

  // Spec 002 FR-121: refetch the contestant card whenever entries or the stage change. No new poll:
  // the shared /api/state poll moves these versions.
  const meKey = pass && state ? `${rehearsal}-${state.entriesVersion}-${state.version}` : null;
  useEffect(() => {
    if (!meKey) return;
    api<Me>("/api/me", { retries: 1 }).then(setMe).catch(() => {});
  }, [meKey]);

  useEffect(() => {
    if (status !== "open" || pass) return;
    api<{ pass: Pass }>("/api/pass", { method: "POST" })
      .then((r) => setIssued({ rehearsal, pass: r.pass }))
      .catch((e: unknown) => {
        if (e instanceof ApiRequestError && e.code === "outside_window") return; // state will catch up
        setProblem(e instanceof Error ? e.message : "Something went wrong");
      });
  }, [status, pass, rehearsal]);

  if (status === "before") {
    return (
      <main className="page" style={{ textAlign: "center" }}>
        <Stickers layout="pass" />
        <BrandMark size="lg" />
        <h1 style={{ marginTop: 32 }}>Doors open soon</h1>
        <p>Night Passes unlock at <strong>{formatEdmontonTime(state!.event.start)}</strong>.</p>
        <p>Come back then and reload this page.</p>
        <footer style={{ marginTop: 40 }}><RiznYouthMark /></footer>
      </main>
    );
  }
  if (status === "ended") {
    return (
      <main className="page" style={{ textAlign: "center" }}>
        <Stickers layout="pass" />
        <BrandMark size="lg" />
        <h1 style={{ marginTop: 32 }}>Fear Factor has ended</h1>
        <p>Thanks for coming! See you at RIZN.</p>
        <p className="kicker" style={{ marginTop: 32, color: "var(--accent-2-text)" }}>{RIZN_INFO.nextWeek.kicker}</p>
        <h2 style={{ fontSize: 44, margin: "4px 0 16px" }}>{RIZN_INFO.nextWeek.heading}</h2>
        <Link href="/rizn" className="button">More about RIZN Youth</Link>
        <footer style={{ marginTop: 40 }}><RiznYouthMark /></footer>
      </main>
    );
  }
  return (
    <main className="page">
      <Stickers layout="pass" />
      {pass ? (
        <>
          <PassBadge pass={pass} />
          {me?.ownEntry && <YourCostume entry={me.ownEntry} place={me.ownPlace} />}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Link href="/contest" className="button" style={{ minWidth: 260 }}>
              <span aria-hidden="true">🎃</span> Costume Contest
            </Link>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <Link href="/rizn" className="button secondary" style={{ minWidth: 260 }}>
              More about RIZN Youth
            </Link>
          </div>
        </>
      ) : problem ? (
        <p className="notice error" role="alert">{problem} — reload to try again.</p>
      ) : (
        <p style={{ textAlign: "center", marginTop: 80 }} role="status">Summoning your Night Pass…</p>
      )}
      <footer style={{ marginTop: 40 }}><RiznYouthMark /></footer>
    </main>
  );
}
