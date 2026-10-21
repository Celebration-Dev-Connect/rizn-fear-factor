import { describe, expect, it } from "vitest";
import { rank } from "@/server/services/ranking";

const c = (votes: number[]) => votes.map((v, i) => ({ entryId: `e${i}`, votes: v }));

describe("dense ranking with shared places", () => {
  it("ranks [10,7,7,5,2] as 1st, tied 2nd ×2, 3rd, and one unplaced", () => {
    const { places, unplaced } = rank(c([10, 7, 7, 5, 2]));
    expect(places).toEqual([
      { place: 1, tied: false, entryIds: ["e0"], votes: 10 },
      { place: 2, tied: true, entryIds: ["e1", "e2"], votes: 7 },
      { place: 3, tied: false, entryIds: ["e3"], votes: 5 },
    ]);
    expect(unplaced).toEqual([{ entryId: "e4", votes: 2 }]);
  });

  it("never places zero-vote entries", () => {
    const { places, unplaced } = rank(c([3, 0, 0]));
    expect(places.map((p) => p.entryIds)).toEqual([["e0"]]);
    expect(unplaced.map((u) => u.votes)).toEqual([0, 0]);
  });

  it("has only 1st place when every entry has the same total", () => {
    const { places } = rank(c([4, 4, 4]));
    expect(places).toEqual([{ place: 1, tied: true, entryIds: ["e0", "e1", "e2"], votes: 4 }]);
  });

  it("has no places when nobody voted", () => {
    expect(rank(c([0, 0])).places).toEqual([]);
  });

  it("handles a large tie for 3rd", () => {
    const { places } = rank(c([9, 6, 2, 2, 2, 2, 2]));
    expect(places[2]).toMatchObject({ place: 3, tied: true });
    expect(places[2]!.entryIds).toHaveLength(5);
  });
});
