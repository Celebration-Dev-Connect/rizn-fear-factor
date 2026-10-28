// Pure helpers for the big-screen countdown (spec 002 FR-112–FR-114, research §3).

export type Countdown =
  | { kind: "hm"; text: string } // one hour or more: "1h 05m"
  | { kind: "ms"; text: string } // under an hour: "14:09"
  | { kind: "closing" }; // at or past the close time

/**
 * At an hour or more, minutes are rounded up so 61 min reads "1h 01m" and the display never shows
 * "1h 00m" with seconds still to go before "59:59". Under an hour it is m:ss, rounded up to the
 * next whole second so the last value before "closing" is "0:01".
 */
export function formatCountdown(remainingMs: number): Countdown {
  if (remainingMs <= 0) return { kind: "closing" };
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds >= 3600) {
    const totalMinutes = Math.ceil(totalSeconds / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { kind: "hm", text: `${h}h ${String(m).padStart(2, "0")}m` };
  }
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return { kind: "ms", text: `${m}:${String(s).padStart(2, "0")}` };
}

/** One clock reading: the server's HTTP Date header and when the request left and returned. */
export type ClockSample = { serverDateMs: number; sentAtMs: number; receivedAtMs: number };

/**
 * Offset to add to the device clock to get server time. The Date header is truncated to the
 * second, so the server's time is taken as the middle of that second, at the midpoint of the
 * round trip. The median of recent samples ignores the odd slow response.
 */
export function estimateOffset(samples: ClockSample[]): number {
  if (samples.length === 0) return 0;
  const offsets = samples
    .map((s) => s.serverDateMs + 500 - (s.sentAtMs + s.receivedAtMs) / 2)
    .sort((a, b) => a - b);
  const mid = Math.floor(offsets.length / 2);
  return offsets.length % 2 ? offsets[mid]! : (offsets[mid - 1]! + offsets[mid]!) / 2;
}
