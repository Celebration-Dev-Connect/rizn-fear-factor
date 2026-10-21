import { describe, expect, it } from "vitest";
import { allNicknames, NICKNAME_SPACE } from "@/server/nicknames";
import { pickNickname } from "@/server/services/nicknamePicker";

describe("nicknames", () => {
  it("has at least 1,600 unique combinations", () => {
    expect(NICKNAME_SPACE).toBeGreaterThanOrEqual(1600);
    expect(new Set(allNicknames()).size).toBe(NICKNAME_SPACE);
  });

  it("never returns a nickname that is already used", () => {
    const used = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const n = pickNickname(used);
      expect(n).not.toBeNull();
      expect(used.has(n!)).toBe(false);
      used.add(n!);
    }
  });

  it("returns null instead of reusing a nickname when exhausted", () => {
    const all = allNicknames();
    const used = new Set(all.slice(0, -1));
    expect(pickNickname(used)).toBe(all.at(-1));
    used.add(all.at(-1)!);
    expect(pickNickname(used)).toBeNull();
  });

  it("treats each realm's used set independently", () => {
    const live = new Set(allNicknames());
    const rehearsal = new Set<string>();
    expect(pickNickname(live)).toBeNull();
    expect(pickNickname(rehearsal)).not.toBeNull();
  });
});
