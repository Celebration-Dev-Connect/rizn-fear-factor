"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Gallery } from "@/components/Gallery";
import { Reveal } from "@/components/Reveal";
import { usePublicState } from "@/components/StateProvider";
import { VoteConfirm } from "@/components/VoteConfirm";
import { api, ApiRequestError } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import type { EntryCard, Me, RevealedPlace, Stage } from "@/shared/types";

const BANNERS: Record<Stage, { icon: string; text: string }> = {
  setup: { icon: "⏳", text: "Voting opens soon — check out the costumes!" },
  voting_open: { icon: "🗳️", text: "Vote now! Tap your favourite costume." },
  voting_closed: { icon: "🔒", text: "Voting is closed. Results coming up!" },
  results_revealed: { icon: "🎉", text: "Results are in!" },
};

export default function ContestPage() {
  const router = useRouter();
  const { state, refresh: refreshState } = usePublicState();
  const blocked = state?.event.status !== undefined && state.event.status !== "open";
  const entries = usePoll<{ entriesVersion: number; entries: EntryCard[] }>(
    state && !blocked ? `/api/entries?v=${state.entriesVersion}&r=${state.rehearsal ? 1 : 0}` : null,
    { intervalMs: 15000, jitterMs: 2000 },
  );
  const [me, setMe] = useState<Me>();
  const [results, setResults] = useState<RevealedPlace[]>([]);
  const [selected, setSelected] = useState<EntryCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const meKey = state ? `${state.rehearsal}-${state.entriesVersion}-${state.version}` : null;
  useEffect(() => {
    if (!meKey || blocked) return;
    api<Me>("/api/me", { retries: 1 })
      .then(setMe)
      .catch((e: unknown) => {
        if (e instanceof ApiRequestError && e.code === "no_pass") router.replace("/");
      });
  }, [meKey, blocked, router]);

  const revealKey = state?.stage === "results_revealed" ? `${state.version}` : null;
  useEffect(() => {
    if (!revealKey) return;
    api<{ places: RevealedPlace[] }>("/api/results", { retries: 1 })
      .then((r) => setResults(r.places))
      .catch(() => {});
  }, [revealKey]);

  if (!state) return <main className="page"><p role="status">Loading…</p></main>;
  if (blocked) {
    return (
      <main className="page">
        <h1>Costume Contest</h1>
        <p className="notice">The Night Pass only works during the event.</p>
        <Link href="/" className="button secondary">Back</Link>
      </main>
    );
  }

  const canVote = state.stage === "voting_open" && me && !me.vote;
  const votedEntry = me?.vote ? entries.data?.entries.find((e) => e.id === me.vote!.entryId) : undefined;
  const banner = BANNERS[state.stage];

  async function cast() {
    if (!selected) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await api("/api/votes", { method: "POST", json: { entryId: selected.id } });
      setMe((m) => (m ? { ...m, vote: { entryId: selected.id } } : m));
      setSelected(null);
    } catch (e) {
      setSelected(null);
      if (e instanceof ApiRequestError) {
        if (e.code === "already_voted") setMessage("Looks like this pass already voted.");
        else if (e.code === "voting_not_open") setMessage("Voting just closed — sorry!");
        else if (e.code === "self_vote") setMessage("You can't vote for your own costume.");
        else setMessage(e.message);
      } else setMessage("Something went wrong. Try again.");
      refreshState();
      api<Me>("/api/me").then(setMe).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <p><Link href="/">← My Night Pass</Link></p>
      <h1>Costume Contest</h1>
      <p className="notice" role="status">
        <span aria-hidden="true">{banner.icon}</span> {banner.text}
      </p>

      {state.stage === "results_revealed" && <div style={{ marginTop: 24 }}><Reveal places={results} /></div>}

      {me?.vote && (
        <section className="card" style={{ margin: "24px 0", textAlign: "center" }} aria-live="polite">
          <h2>Thanks for voting!</h2>
          <p>
            Your vote for <strong>{votedEntry?.displayName ?? "your pick"}</strong> is in. Stay tuned for the reveal.
          </p>
        </section>
      )}

      {message && <p className="notice error" role="alert">{message}</p>}

      <h2 style={{ marginTop: 24 }}>The costumes</h2>
      {entries.data ? (
        <Gallery
          entries={entries.data.entries}
          onSelect={canVote ? setSelected : undefined}
          ownEntryId={me?.ownEntryId}
          votedId={me?.vote?.entryId}
          selectedId={selected?.id}
        />
      ) : (
        <p role="status">Loading costumes…</p>
      )}

      {selected && (
        <VoteConfirm entry={selected} busy={busy} onConfirm={cast} onCancel={() => setSelected(null)} />
      )}
    </main>
  );
}
