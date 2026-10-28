"use client";
import { useEffect, useState } from "react";
import { estimateOffset, type ClockSample } from "./countdown";

// Server time from the HTTP Date header of our own polls (spec 002 FR-113, research §3), so a
// wrong clock on the big-screen device doesn't change the countdown. Module-level so every poll on
// the page feeds one estimate.
const MAX_SAMPLES = 5;
const samples: ClockSample[] = [];
let offsetMs = 0;

/** Called by usePoll for every response, 200 or 304. */
export function recordServerDate(dateHeader: string | null, sentAtMs: number, receivedAtMs: number): void {
  const serverDateMs = dateHeader ? Date.parse(dateHeader) : NaN;
  if (!Number.isFinite(serverDateMs)) return;
  samples.push({ serverDateMs, sentAtMs, receivedAtMs });
  if (samples.length > MAX_SAMPLES) samples.shift();
  offsetMs = estimateOffset(samples);
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Re-renders every `tickMs` with the current server time. */
export function useServerNow(tickMs = 250): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}
