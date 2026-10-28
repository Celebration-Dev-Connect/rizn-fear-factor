import { describe, expect, it } from "vitest";
import { estimateOffset, formatCountdown } from "@/lib/countdown";

describe("formatCountdown (spec 002 FR-112, FR-114)", () => {
  it.each([
    [7_265_000, { kind: "hm", text: "2h 02m" }],
    [3_601_000, { kind: "hm", text: "1h 01m" }],
    [3_600_000, { kind: "hm", text: "1h 00m" }],
    [3_599_000, { kind: "ms", text: "59:59" }],
    [3_599_400, { kind: "hm", text: "1h 00m" }], // rounds up to a full hour, never "60:00"
    [61_000, { kind: "ms", text: "1:01" }],
    [1_000, { kind: "ms", text: "0:01" }],
    [1, { kind: "ms", text: "0:01" }],
    [0, { kind: "closing" }],
    [-5_000, { kind: "closing" }],
  ] as const)("%d ms → %o", (ms, expected) => {
    expect(formatCountdown(ms)).toEqual(expected);
  });
});

describe("estimateOffset (FR-113, SC-104)", () => {
  it("recovers a +300 s device clock error to within a second", () => {
    const skew = -300_000; // device clock is 5 minutes ahead of the server
    const samples = [0, 3000, 6000, 9000, 12000].map((t, i) => {
      const realSent = 1_700_000_000_000 + t;
      const rtt = 80 + i * 10;
      const serverAt = realSent + rtt / 2;
      return {
        serverDateMs: Math.floor(serverAt / 1000) * 1000,
        sentAtMs: realSent - skew,
        receivedAtMs: realSent + rtt - skew,
      };
    });
    const offset = estimateOffset(samples);
    expect(Math.abs(offset - skew)).toBeLessThan(1000);
  });

  it("ignores one very slow response", () => {
    const base = 1_700_000_000_000;
    const fast = (t: number) => ({ serverDateMs: base + t, sentAtMs: base + t - 50, receivedAtMs: base + t + 50 });
    const slow = { serverDateMs: base + 9000, sentAtMs: base + 2000, receivedAtMs: base + 12000 };
    expect(Math.abs(estimateOffset([fast(0), fast(3000), slow, fast(6000), fast(9000)]) - 500)).toBeLessThan(100);
  });

  it("is zero with no samples", () => {
    expect(estimateOffset([])).toBe(0);
  });
});

describe("nextEdmontonOccurrence (FR-111)", () => {
  const at = (iso: string) => new Date(iso).getTime();

  it("uses today when the time is still ahead, whatever the event window says", async () => {
    const { nextEdmontonOccurrence } = await import("@/lib/time");
    // 10:52 am MDT on Oct 28 → 3:00 pm the same day.
    expect(nextEdmontonOccurrence("15:00", at("2026-10-28T16:52:00Z"))).toBe("2026-10-28T21:00:00.000Z");
    // Event night: 7:10 pm MDT → 8:45 pm.
    expect(nextEdmontonOccurrence("20:45", at("2026-10-31T01:10:00Z"))).toBe("2026-10-31T02:45:00.000Z");
  });

  it("rolls to tomorrow when the time has already passed today", async () => {
    const { nextEdmontonOccurrence } = await import("@/lib/time");
    expect(nextEdmontonOccurrence("09:00", at("2026-10-28T16:52:00Z"))).toBe("2026-10-29T15:00:00.000Z");
  });

  it("handles a time after midnight UTC but the same Edmonton evening", async () => {
    const { nextEdmontonOccurrence } = await import("@/lib/time");
    // 11:30 pm MDT Oct 30 is 05:30Z Oct 31; 11:45 pm is still "today" in Edmonton.
    expect(nextEdmontonOccurrence("23:45", at("2026-10-31T05:30:00Z"))).toBe("2026-10-31T05:45:00.000Z");
  });
});
