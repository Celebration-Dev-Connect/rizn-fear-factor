"use client";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Reveal } from "@/components/Reveal";
import { ScreenGallery } from "@/components/ScreenGallery";
import { usePublicState } from "@/components/StateProvider";
import { api } from "@/lib/api";
import { CREW_POLL, usePoll } from "@/lib/usePoll";
import type { EntryCard, RevealedPlace, Stage } from "@/shared/types";
import styles from "./screen.module.css";

const INSTRUCTIONS: Record<Stage, string> = {
  setup: "Get your Night Pass, then find a crew member to enter your costume!",
  voting_open: "Voting is OPEN — scan, tap your favourite costume, and vote!",
  voting_closed: "Voting is closed. The results are coming…",
  results_revealed: "And the winners are…",
};

/** Read-only projector view (US5). No controls; everything comes from polling. */
export default function ScreenPage() {
  const { state } = usePublicState();
  const totals = usePoll<{ passes: number; votesCounted: number }>("/api/screen/totals", CREW_POLL);
  const entries = usePoll<{ entries: EntryCard[] }>(
    state ? `/api/entries?v=${state.entriesVersion}&r=${state.rehearsal ? 1 : 0}` : null,
    { intervalMs: 10000, jitterMs: 500 },
  );
  const [places, setPlaces] = useState<RevealedPlace[]>([]);
  const revealKey = state?.stage === "results_revealed" ? `${state.version}` : null;

  useEffect(() => {
    if (!revealKey) return;
    api<{ places: RevealedPlace[] }>("/api/results", { retries: 2 }).then((r) => setPlaces(r.places)).catch(() => {});
  }, [revealKey]);

  if (totals.error?.status === 401) {
    return (
      <main className={styles.screen}>
        <div className={styles.center}><BrandMark size="lg" /><p className={styles.instructions}>Ask a crew member for the screen link</p></div>
      </main>
    );
  }
  if (!state) return <main className={styles.screen} />;

  const revealing = state.stage === "results_revealed";
  const shownPlaces = revealing ? places : [];

  return (
    <main className={styles.screen}>
      <header className={styles.top}>
        <BrandMark size="md" />
        <h1 className={styles.title}>Costume Contest</h1>
        {totals.data && (
          <p className={styles.totals}>
            <strong>{totals.data.votesCounted}</strong> {totals.data.votesCounted === 1 ? "vote" : "votes"} cast of{" "}
            <strong>{totals.data.passes}</strong> {totals.data.passes === 1 ? "pass" : "passes"}
          </p>
        )}
      </header>
      {revealing ? (
        <section className={styles.reveal}>
          {shownPlaces.length === 0 ? <p className={styles.instructions}>The winners are…</p> : <Reveal places={shownPlaces} big />}
        </section>
      ) : (
        <div className={styles.body}>
          <ScreenGallery entries={entries.data?.entries ?? []} />
          <aside className={styles.join}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/qr.svg" alt="QR code to get your Night Pass" className={styles.qr} />
            <p className={styles.scan}>Scan to get your Night Pass</p>
            <p className={styles.instructions}>{INSTRUCTIONS[state.stage]}</p>
          </aside>
        </div>
      )}
    </main>
  );
}
