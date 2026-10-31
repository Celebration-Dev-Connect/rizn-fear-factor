import { describe, expect, it } from "vitest";
import { OFFSEASON } from "@/content/offseason";
import { isEventOver } from "@/lib/nextEvent";

describe("isEventOver (spec 004 FR-306)", () => {
  const endsAt = "2026-11-06T21:30:00-07:00"; // 9:30pm MST = 04:30Z Nov 7
  it.each([
    ["2026-11-06T20:00:00-07:00", false],
    ["2026-11-07T04:29:59Z", false],
    ["2026-11-07T04:30:00Z", true],
    ["2026-11-07T08:00:00-07:00", true],
  ])("%s → %s", (now, over) => {
    expect(isEventOver(endsAt, Date.parse(now))).toBe(over);
  });

  it("keeps showing the section when the date is unreadable", () => {
    expect(isEventOver("Nov 6ish", Date.now())).toBe(false);
  });
});

describe("off-season copy (FR-307)", () => {
  it("never uses wording that goes stale while the page sits unchanged", () => {
    const text = JSON.stringify(OFFSEASON).toLowerCase();
    for (const stale of ["next week", "next friday", "tonight"]) expect(text).not.toContain(stale);
  });
});
