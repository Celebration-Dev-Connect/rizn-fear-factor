"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "@/lib/api";
import { ScanError, startScan } from "@/lib/scanner";
import styles from "./VoteConfirm.module.css";
import type { Pass } from "@/shared/types";

export type ScannedPass = Pass & { id: string; entryId: string | null };

type Props = {
  onPick: (pass: ScannedPass) => void;
  /** Returns a reason to refuse this pass (for example "already entered"), or null to accept. */
  check?: (pass: ScannedPass) => string | null;
};

const DENIED_HELP =
  "Allow camera access in Settings → Safari → Camera (iPhone) or in Chrome's site settings (Android), or search by nickname instead.";

/** "Scan pass" for crew (spec 002 FR-126): reads a Night Pass QR code and selects that pass. */
export function ScanPassButton({ onPick, check }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">📷</span> Scan pass
      </button>
      {open && (
        <ScanDialog
          onClose={() => setOpen(false)}
          onPick={(p) => {
            setOpen(false);
            onPick(p);
          }}
          check={check}
        />
      )}
    </>
  );
}

function ScanDialog({ onClose, onPick, check }: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState<string>("Point the camera at the student's pass code");
  const [problem, setProblem] = useState<string>();
  const busy = useRef(false);
  const lastBad = useRef<string>("");

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    let stop: (() => void) | undefined;
    let cancelled = false;

    async function onCode(text: string) {
      if (busy.current || text === lastBad.current) return;
      busy.current = true;
      try {
        const r = await api<{ pass: ScannedPass }>(`/api/crew/passes/scan?code=${encodeURIComponent(text)}`, { retries: 1 });
        const refusal = check?.(r.pass) ?? null;
        if (refusal) {
          lastBad.current = text;
          setMessage(`${r.pass.nickname}: ${refusal}`);
        } else {
          stop?.();
          onPick(r.pass);
        }
      } catch (e) {
        lastBad.current = text;
        setMessage(e instanceof ApiRequestError ? e.message : "Couldn't check that code. Try again.");
      } finally {
        busy.current = false;
      }
    }

    startScan(video.current!, onCode)
      .then((s) => {
        if (cancelled) s();
        else stop = s;
      })
      .catch((e: unknown) => {
        setProblem(e instanceof ScanError && e.kind === "denied" ? `Camera blocked. ${DENIED_HELP}` : `No camera available. ${DENIED_HELP}`);
      });
    return () => {
      cancelled = true;
      stop?.();
      d?.close();
    };
    // The dialog runs one scan session for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog ref={dialog} className={styles.dialog} onCancel={(e) => { e.preventDefault(); onClose(); }} aria-labelledby="scan-title">
      <h2 id="scan-title">Scan a Night Pass</h2>
      {problem ? (
        <p className="notice error" role="alert">{problem}</p>
      ) : (
        <>
          <video ref={video} className={styles.photo} playsInline muted aria-label="Camera view" />
          <p role="status" aria-live="polite" style={{ marginTop: 12 }}>{message}</p>
        </>
      )}
      <div className={styles.actions}>
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
      </div>
    </dialog>
  );
}
