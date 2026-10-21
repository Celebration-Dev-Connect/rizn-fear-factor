"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./VoteConfirm.module.css";

type Props = {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** When set, the user must type this word to enable the confirm button. */
  typeToConfirm?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

export function ConfirmDialog({ title, body, confirmLabel, danger, typeToConfirm, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  const ready = !typeToConfirm || typed === typeToConfirm;
  return (
    <dialog ref={ref} className={styles.dialog} onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }} aria-labelledby="confirm-title">
      <h2 id="confirm-title">{title}</h2>
      <div style={{ marginBottom: 16 }}>{body}</div>
      {typeToConfirm && (
        <label style={{ display: "grid", gap: 6, marginBottom: 16 }}>
          Type {typeToConfirm} to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
        </label>
      )}
      <div className={styles.actions}>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button
          type="button"
          className={danger ? "danger" : undefined}
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
