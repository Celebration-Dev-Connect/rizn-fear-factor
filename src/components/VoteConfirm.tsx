"use client";
import { useEffect, useRef } from "react";
import styles from "./VoteConfirm.module.css";
import type { EntryCard } from "@/shared/types";

type Props = {
  entry: EntryCard;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
};

/** Native <dialog>: focus is trapped and Escape closes it. */
export function VoteConfirm({ entry, busy, onConfirm, onCancel, confirmLabel = "Cast my vote" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className={styles.dialog} onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }} aria-labelledby="vote-confirm-title">
      <h2 id="vote-confirm-title">Vote for this costume?</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.photo.full} alt={entry.alt} className={styles.photo} />
      <p className={styles.name}>{entry.displayName}</p>
      <p className={styles.warn}>You get one vote, and it&apos;s final.</p>
      <div className={styles.actions}>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Go back</button>
        <button type="button" onClick={onConfirm} disabled={busy} autoFocus>
          {busy ? "Casting…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
