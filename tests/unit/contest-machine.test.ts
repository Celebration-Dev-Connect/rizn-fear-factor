import { describe, expect, it } from "vitest";
import { nextState, type MachineState } from "@/server/services/contest-machine";

const ctx = (placesCount = 3, hasCountedVotes = true) => ({ placesCount, hasCountedVotes });
const at = (stage: MachineState["stage"], revealStep = 0): MachineState => ({ stage, revealStep });

describe("contest state machine", () => {
  it("advances through every stage in order", () => {
    expect(nextState(at("setup"), "advance", ctx())).toEqual(at("voting_open"));
    expect(nextState(at("voting_open"), "advance", ctx())).toEqual(at("voting_closed"));
    expect(nextState(at("voting_closed"), "advance", ctx())).toEqual(at("results_revealed"));
  });

  it("undoes every stage back to the previous one", () => {
    expect(nextState(at("voting_open"), "undo", ctx())).toEqual(at("setup"));
    expect(nextState(at("voting_closed"), "undo", ctx())).toEqual(at("voting_open"));
    expect(nextState(at("results_revealed"), "undo", ctx())).toEqual(at("voting_closed"));
  });

  it("refuses undo at setup", () => {
    expect(nextState(at("setup"), "undo", ctx())).toEqual({ error: "not_available" });
  });

  it("steps reveals 0→1→2→3 with three places, then refuses", () => {
    let s = at("results_revealed");
    for (const step of [1, 2, 3]) {
      s = nextState(s, "advance", ctx(3)) as MachineState;
      expect(s).toEqual(at("results_revealed", step));
    }
    expect(nextState(s, "advance", ctx(3))).toEqual({ error: "not_available" });
  });

  it("undoes reveals 3→2→1→0 and then returns to voting_closed", () => {
    let s = at("results_revealed", 3);
    for (const step of [2, 1, 0]) {
      s = nextState(s, "undo", ctx(3)) as MachineState;
      expect(s).toEqual(at("results_revealed", step));
    }
    expect(nextState(s, "undo", ctx(3))).toEqual(at("voting_closed"));
  });

  it("stops reveal steps at the number of places that exist", () => {
    expect(nextState(at("results_revealed", 1), "advance", ctx(1))).toEqual({ error: "not_available" });
    expect(nextState(at("results_revealed", 1), "advance", ctx(2))).toEqual(at("results_revealed", 2));
    expect(nextState(at("results_revealed", 2), "advance", ctx(2))).toEqual({ error: "not_available" });
  });

  it("refuses to enter results without counted votes", () => {
    expect(nextState(at("voting_closed"), "advance", ctx(0, false))).toEqual({ error: "no_votes" });
  });
});
