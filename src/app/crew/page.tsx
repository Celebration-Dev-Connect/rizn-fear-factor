"use client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StageControls } from "@/components/StageControls";
import { api } from "@/lib/api";
import { edmontonTimeOnEventDate, formatEdmontonTime, fromEdmontonLocal, toEdmontonLocal } from "@/lib/time";
import { useCrew } from "./CrewContext";

export default function CrewDashboard() {
  const { dashboard, refresh } = useCrew();
  const { state, totals, screenUrl } = dashboard;
  const [dialog, setDialog] = useState<"rehearsal" | "wipe" | null>(null);
  const [note, setNote] = useState<string>();
  const [start, setStart] = useState(() => toEdmontonLocal(state.event.start));
  const [end, setEnd] = useState(() => toEdmontonLocal(state.event.end));
  const [closeAt, setCloseAt] = useState(() => (state.votingClosesAt ? toEdmontonLocal(state.votingClosesAt).slice(11) : ""));

  async function saveClose(at: string | null) {
    setNote(undefined);
    try {
      await api("/api/crew/voting-close", { method: "PUT", json: { at } });
      setNote(at ? `Countdown set: voting closes at ${formatEdmontonTime(at)}` : "Countdown cleared");
      if (!at) setCloseAt("");
      refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <h1>Dashboard</h1>
      <section className="card" style={{ marginBottom: 24 }} aria-label="Totals">
        <p style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
          {totals.votesCounted} {totals.votesCounted === 1 ? "vote" : "votes"}{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>of {totals.passes} {totals.passes === 1 ? "pass" : "passes"}</span>
        </p>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>Per-costume counts stay hidden until voting closes.</p>
      </section>

      <StageControls state={state} onChanged={refresh} />

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Voting countdown</h2>
        <p>
          While voting is open, the big screen counts down to this time. It&apos;s only a display: voting stays open until
          you press <strong>Close voting</strong>.
        </p>
        <p>
          {state.votingClosesAt ? (
            <>Currently: <strong>{formatEdmontonTime(state.votingClosesAt)}</strong></>
          ) : (
            "No countdown set."
          )}
        </p>
        <form
          style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (closeAt) void saveClose(edmontonTimeOnEventDate(closeAt, state.event.start));
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            Voting closes at (Edmonton time)
            <input type="time" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} required />
          </label>
          <button type="submit" className="secondary">Save</button>
          {state.votingClosesAt && (
            <button type="button" className="secondary" onClick={() => void saveClose(null)}>Clear</button>
          )}
        </form>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Big screen</h2>
        <p>Open this link on the projector computer. Don&apos;t share it with students.</p>
        <p><code style={{ overflowWrap: "anywhere" }}>{screenUrl}</code></p>
        <button type="button" className="secondary" onClick={() => navigator.clipboard?.writeText(screenUrl).then(() => setNote("Screen link copied"))}>
          Copy screen link
        </button>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Rehearsal</h2>
        <p>
          Rehearsal mode is <strong>{state.rehearsal ? "ON" : "off"}</strong>. While it&apos;s on, everything goes into a separate
          practice contest that ignores the event window.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button type="button" className="secondary" onClick={() => setDialog("rehearsal")}>
            {state.rehearsal ? "Turn rehearsal off" : "Turn rehearsal on"}
          </button>
          {state.rehearsal && (
            <button type="button" className="danger" onClick={() => setDialog("wipe")}>Wipe rehearsal data</button>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Event window</h2>
        <p>Night Passes only work between these times (Edmonton time).</p>
        <form
          style={{ display: "grid", gap: 12 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setNote(undefined);
            try {
              await api("/api/crew/settings/window", { method: "PUT", json: { start: fromEdmontonLocal(start), end: fromEdmontonLocal(end) } });
              setNote("Event window saved");
              refresh();
            } catch (err) {
              setNote(err instanceof Error ? err.message : "Failed");
            }
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>Opens <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
          <label style={{ display: "grid", gap: 6 }}>Closes <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
          <button type="submit" className="secondary">Save window</button>
        </form>
      </section>

      {note && <p className="notice" role="status" style={{ marginTop: 16 }}>{note}</p>}

      {dialog === "rehearsal" && (
        <ConfirmDialog
          title={state.rehearsal ? "Turn rehearsal off?" : "Turn rehearsal on?"}
          body={<p>{state.rehearsal ? "Phones go back to the live contest. Wipe rehearsal data first if you're done practising." : "Every screen shows a REHEARSAL banner and uses practice data."}</p>}
          confirmLabel={state.rehearsal ? "Turn off" : "Turn on"}
          onConfirm={async () => {
            try {
              await api("/api/crew/rehearsal", { method: "POST", json: { on: !state.rehearsal } });
            } catch (err) {
              setNote(err instanceof Error ? err.message : "Failed");
            }
            setDialog(null);
            refresh();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "wipe" && (
        <ConfirmDialog
          title="Wipe all rehearsal data?"
          body={<p>Deletes every rehearsal pass, entry, vote and photo. Live data is not touched. This can&apos;t be undone.</p>}
          confirmLabel="Wipe"
          danger
          typeToConfirm="WIPE"
          onConfirm={async () => {
            try {
              const r = await api<{ deleted: Record<string, number> }>("/api/crew/rehearsal/wipe", { method: "POST", json: { confirm: "WIPE" } });
              const d = r.deleted;
              setNote(`Wiped ${d.passes} passes, ${d.entries} entries, ${d.votes} votes, ${d.photos} photos.`);
            } catch (err) {
              setNote(err instanceof Error ? err.message : "Failed");
            }
            setDialog(null);
            refresh();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </>
  );
}
