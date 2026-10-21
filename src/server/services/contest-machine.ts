// Pure contest state machine (data-model.md, "Stage transitions"). No I/O, no timers.
import type { Stage } from "@/shared/types";

export type MachineState = { stage: Stage; revealStep: number };
export type MachineError = "no_votes" | "not_available";
export type MachineContext = { hasCountedVotes: boolean; placesCount: number };

const ORDER: Stage[] = ["setup", "voting_open", "voting_closed", "results_revealed"];

export function nextState(
  current: MachineState,
  action: "advance" | "undo",
  ctx: MachineContext,
): MachineState | { error: MachineError } {
  const i = ORDER.indexOf(current.stage);
  const places = Math.max(0, Math.min(3, ctx.placesCount));

  if (action === "advance") {
    if (current.stage === "results_revealed") {
      // Reveal steps only cover places that exist (U1 fix): never an empty reveal press.
      if (current.revealStep >= places) return { error: "not_available" };
      return { stage: "results_revealed", revealStep: current.revealStep + 1 };
    }
    if (current.stage === "voting_closed" && (!ctx.hasCountedVotes || places === 0)) {
      return { error: "no_votes" };
    }
    return { stage: ORDER[i + 1]!, revealStep: 0 };
  }

  if (current.stage === "results_revealed" && current.revealStep > 0) {
    return { stage: "results_revealed", revealStep: current.revealStep - 1 };
  }
  if (current.stage === "setup") return { error: "not_available" };
  return { stage: ORDER[i - 1]!, revealStep: 0 };
}
