"use client";
import { useState } from "react";
import { Gallery } from "@/components/Gallery";
import { VoteConfirm } from "@/components/VoteConfirm";
import { api, ApiRequestError } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { entryLabelText, formatPassNumber, type EntryCard } from "@/shared/types";
import { useCrew } from "../CrewContext";
import { PassPicker, type PassHit } from "../PassPicker";

/**
 * FR-020: a student without a phone votes on a crew device with their crew-created pass. Uses the
 * change endpoint, so a pass that already voted moves its vote instead (spec 002 FR-106).
 */
export default function AssistPage() {
  const { dashboard } = useCrew();
  const [pass, setPass] = useState<PassHit>();
  const [selected, setSelected] = useState<EntryCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ label: string; changed: boolean }>();
  const [error, setError] = useState<string>();
  const entries = usePoll<{ entries: EntryCard[] }>(pass ? `/api/entries?v=${dashboard.state.entriesVersion}` : null, { intervalMs: 15000, jitterMs: 1000 });

  if (dashboard.state.stage !== "voting_open") {
    return (<><h1>Assisted voting</h1><p className="notice">Assisted voting is available while voting is open.</p></>);
  }

  function finish() {
    setPass(undefined);
    setSelected(null);
    setDone(undefined);
    setError(undefined);
  }

  if (done) {
    return (
      <section className="card" style={{ textAlign: "center" }}>
        <h1>{done.changed ? "Vote changed!" : "Thanks for voting!"}</h1>
        <p>Your vote {done.changed ? "is now" : "is in"} for <strong>{done.label}</strong>.</p>
        <button type="button" onClick={finish}>Done — back to crew</button>
      </section>
    );
  }

  if (!pass) {
    return (
      <>
        <h1>Assisted voting</h1>
        <p>Find the student&apos;s crew-created pass, or create one, then hand them the device.</p>
        <PassPicker allowEntered onPick={(p) => setPass(p)} />
      </>
    );
  }

  return (
    <>
      <h1>Pick your favourite costume</h1>
      <p>
        Voting as <strong>{pass.nickname}</strong> {formatPassNumber(pass.number)}. If this pass already voted, picking a
        costume changes its vote.
      </p>
      {error && <p className="notice error" role="alert">{error}</p>}
      {entries.data && <Gallery entries={entries.data.entries} onSelect={setSelected} ownEntryId={pass.entryId} selectedId={selected?.id} />}
      <button type="button" className="secondary" style={{ marginTop: 16 }} onClick={finish}>Cancel</button>
      {selected && (
        <VoteConfirm
          entry={selected}
          busy={busy}
          onCancel={() => setSelected(null)}
          onConfirm={async () => {
            setBusy(true);
            setError(undefined);
            try {
              const r = await api<{ changed: boolean }>(`/api/crew/assisted-votes/${pass.id}`, {
                method: "PUT",
                json: { entryId: selected.id },
              });
              setDone({ label: entryLabelText(selected), changed: r.changed });
            } catch (e) {
              setError(
                e instanceof ApiRequestError
                  ? e.code === "vote_voided"
                    ? "This pass's vote was voided, so it can't vote again."
                    : e.message
                  : "Failed",
              );
            } finally {
              setBusy(false);
              setSelected(null);
            }
          }}
        />
      )}
    </>
  );
}
