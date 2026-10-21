"use client";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import styles from "./StageControls.module.css";
import { api, ApiRequestError } from "@/lib/api";
import { STAGE_LABELS, type PublicState, type Stage } from "@/shared/types";

const ORDER: Stage[] = ["setup", "voting_open", "voting_closed", "results_revealed"];

const NEXT_TEXT: Record<Stage, string> = {
  setup: "Open voting",
  voting_open: "Close voting",
  voting_closed: "Start results reveal",
  results_revealed: "",
};

const NEXT_EXPLAIN: Record<Stage, string> = {
  setup: "Every phone can vote once. The big screen switches to voting mode.",
  voting_open: "No more votes will be accepted. You can undo this.",
  voting_closed: "The big screen switches to the reveal. Nothing is shown until you reveal each place.",
  results_revealed: "",
};

export function StageControls({ state, onChanged, showReveal = false }: { state: PublicState; onChanged: () => void; showReveal?: boolean }) {
  const [pending, setPending] = useState<"advance" | "undo" | null>(null);
  const [message, setMessage] = useState<string>();
  const current = ORDER.indexOf(state.stage);

  async function run(action: "advance" | "undo") {
    setMessage(undefined);
    try {
      await api("/api/crew/stage", { method: "POST", json: { action, from: { stage: state.stage, revealStep: state.revealStep } } });
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "stage_conflict") setMessage("Someone else changed the stage — showing the latest.");
      else setMessage(e instanceof Error ? e.message : "Failed");
    }
    setPending(null);
    onChanged();
  }

  const inReveal = state.stage === "results_revealed";
  const advanceLabel = inReveal ? "Reveal next place" : NEXT_TEXT[state.stage];
  const undoLabel = inReveal && state.revealStep > 0 ? "Hide last revealed place" : current > 0 ? `Undo: back to ${STAGE_LABELS[ORDER[current - 1]!]}` : null;

  return (
    <section aria-label="Contest stage">
      <ol className={styles.stepper}>
        {ORDER.map((s, i) => (
          <li key={s} className={i === current ? styles.current : i < current ? styles.done : ""} aria-current={i === current ? "step" : undefined}>
            <span aria-hidden="true">{i < current ? "✔" : i === current ? "●" : "○"}</span> {STAGE_LABELS[s]}
          </li>
        ))}
      </ol>
      {inReveal && (
        <p>Revealed so far: <strong>{state.revealStep === 0 ? "nothing yet" : `${state.revealStep} place${state.revealStep > 1 ? "s" : ""}`}</strong></p>
      )}
      <div className={styles.buttons}>
        {advanceLabel && (!inReveal || showReveal) && (
          <button type="button" onClick={() => setPending("advance")}>{advanceLabel}</button>
        )}
        {undoLabel && (
          <button type="button" className="secondary" onClick={() => setPending("undo")}>{undoLabel}</button>
        )}
      </div>
      {message && <p className="notice error" role="alert">{message}</p>}
      {pending && (
        <ConfirmDialog
          title={pending === "advance" ? `${advanceLabel}?` : `${undoLabel}?`}
          body={
            <p>
              {pending === "advance"
                ? inReveal
                  ? "The next place (lowest first) appears on the big screen and every phone."
                  : NEXT_EXPLAIN[state.stage]
                : "Entries and votes are kept. Only what's allowed and shown changes."}
            </p>
          }
          confirmLabel={pending === "advance" ? advanceLabel : "Undo"}
          onConfirm={() => run(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  );
}
