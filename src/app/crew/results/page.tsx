"use client";
import { useEffect, useState } from "react";
import { StageControls } from "@/components/StageControls";
import { api } from "@/lib/api";
import { entryLabelText, PLACE_LABELS, type EntryCard } from "@/shared/types";
import { useCrew } from "../CrewContext";

type Ranking = {
  places: { place: 1 | 2 | 3; tied: boolean; votes: number; entries: EntryCard[] }[];
  unplaced: { entry: EntryCard; votes: number }[];
};

export default function CrewResultsPage() {
  const { dashboard, refresh } = useCrew();
  const { state } = dashboard;
  const [ranking, setRanking] = useState<Ranking>();
  const available = state.stage === "voting_closed" || state.stage === "results_revealed";

  useEffect(() => {
    if (!available) return;
    api<Ranking>("/api/crew/ranking", { retries: 1 }).then(setRanking).catch(() => setRanking(undefined));
  }, [available, state.version]);

  if (!available) {
    return (<><h1>Results</h1><p className="notice">The private ranking appears here once voting is closed.</p></>);
  }

  return (
    <>
      <h1>Results (crew only)</h1>
      <p>Only this screen shows vote counts. Phones and the big screen see each place only after you reveal it.</p>
      {ranking && ranking.places.length < 3 && (
        <p className="notice">Only {ranking.places.length} place{ranking.places.length === 1 ? "" : "s"} exist, so there are {ranking.places.length} reveal step{ranking.places.length === 1 ? "" : "s"}.</p>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0" }}>
        <thead><tr style={{ textAlign: "left" }}><th scope="col">Place</th><th scope="col">Costume</th><th scope="col">Votes</th></tr></thead>
        <tbody>
          {ranking?.places.map((p) =>
            p.entries.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td>{PLACE_LABELS[p.place]} {p.tied && <strong>· TIE</strong>}</td>
                <td>{entryLabelText(e)}</td>
                <td>{p.votes}</td>
              </tr>
            )),
          )}
          {ranking?.unplaced.map((u) => (
            <tr key={u.entry.id} style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <td>—</td><td>{entryLabelText(u.entry)}</td><td>{u.votes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <StageControls state={state} onChanged={refresh} showReveal />
    </>
  );
}
