"use client";
import { useState } from "react";
import { Gallery } from "@/components/Gallery";
import { VoteConfirm } from "@/components/VoteConfirm";
import { api, ApiRequestError } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { formatPassNumber, type EntryCard } from "@/shared/types";
import { useCrew } from "../CrewContext";
import { PassPicker, type PassHit } from "../PassPicker";

/** FR-020: a student without a phone votes on a crew device with their crew-created pass. */
export default function AssistPage() {
  const { dashboard } = useCrew();
  const [pass, setPass] = useState<PassHit>();
  const [selected, setSelected] = useState<EntryCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
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
        <h1>Thanks for voting!</h1>
        <p>Your vote for <strong>{done}</strong> is in.</p>
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
      <p>Voting as <strong>{pass.nickname}</strong> {formatPassNumber(pass.number)}.</p>
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
              await api("/api/crew/assisted-votes", { method: "POST", json: { passId: pass.id, entryId: selected.id } });
              setDone(selected.displayName);
            } catch (e) {
              setError(e instanceof ApiRequestError ? (e.code === "already_voted" ? "This pass has already voted." : e.message) : "Failed");
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
