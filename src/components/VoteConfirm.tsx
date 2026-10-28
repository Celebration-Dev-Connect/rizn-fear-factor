"use client";
import { useEffect, useRef } from "react";
import { EntryLabel } from "./EntryLabel";
import styles from "./VoteConfirm.module.css";
import type { EntryCard } from "@/shared/types";

type Props = {
  entry: EntryCard;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  /** Set when changing an existing vote: the dialog shows "from → to" (spec 002 FR-101). */
  current?: EntryCard;
};

/** Native <dialog>: focus is trapped and Escape closes it. */
export function VoteConfirm({ entry, busy, onConfirm, onCancel, confirmLabel, current }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  const changing = Boolean(current);
  return (
    <dialog ref={ref} className={styles.dialog} onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }} aria-labelledby="vote-confirm-title">
      <h2 id="vote-confirm-title">{changing ? "Change your vote?" : "Vote for this costume?"}</h2>
      {current && (
        <div className={styles.from}>
          <span className={styles.fromLabel}>From</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.photo.thumb} alt={current.alt} className={styles.thumb} />
          <EntryLabel entry={current} size="sm" />
        </div>
      )}
      {changing && <p className={styles.fromLabel}>To</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.photo.full} alt={entry.alt} className={styles.photo} />
      <EntryLabel entry={entry} size="md" className={styles.name} />
      <p className={styles.warn}>
        {changing ? "You still get just one vote. You can change it until voting closes." : "You get one vote. You can change it until voting closes."}
      </p>
      <div className={styles.actions}>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Go back</button>
        <button type="button" onClick={onConfirm} disabled={busy} autoFocus>
          {busy ? (changing ? "Changing…" : "Casting…") : (confirmLabel ?? (changing ? "Change my vote" : "Cast my vote"))}
        </button>
      </div>
    </dialog>
  );
}
