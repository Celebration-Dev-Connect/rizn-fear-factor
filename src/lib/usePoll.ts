"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export const STUDENT_POLL = { intervalMs: 3000, jitterMs: 500 };
export const CREW_POLL = { intervalMs: 2000, jitterMs: 250 };
const MAX_BACKOFF_MS = 20_000;

type PollResult<T> = {
  data: T | undefined;
  error: { status: number; body?: unknown } | undefined;
  refresh: () => void;
};

/**
 * Polls a JSON URL with ETag/If-None-Match, jitter, error backoff (≤20 s), and pauses while the
 * tab is hidden (research §3). Students: 3 s ± 0.5 s, so the worst case stays under 3.5 s.
 */
export function usePoll<T>(
  url: string | null,
  { intervalMs, jitterMs } = STUDENT_POLL,
): PollResult<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<PollResult<T>["error"]>();
  const etagRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const failures = useRef(0);
  const tick = useRef<() => void>(() => {});

  useEffect(() => {
    etagRef.current = null;
    failures.current = 0;
    if (!url) return;
    let stopped = false;

    const schedule = () => {
      if (stopped) return;
      const backoff = failures.current
        ? Math.min(MAX_BACKOFF_MS, intervalMs * 2 ** failures.current)
        : intervalMs;
      const delay = backoff + (Math.random() * 2 - 1) * jitterMs;
      timer.current = setTimeout(run, Math.max(250, delay));
    };

    const run = async () => {
      clearTimeout(timer.current);
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return; // resumes on visibility
      try {
        const headers: Record<string, string> = {};
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;
        const res = await fetch(url, { headers, credentials: "same-origin", cache: "no-store" });
        if (res.status === 304) {
          failures.current = 0;
        } else if (res.ok) {
          etagRef.current = res.headers.get("ETag");
          setData((await res.json()) as T);
          setError(undefined);
          failures.current = 0;
        } else {
          setError({ status: res.status, body: await res.json().catch(() => undefined) });
          failures.current = res.status >= 500 ? failures.current + 1 : 0;
        }
      } catch {
        failures.current += 1;
      }
      schedule();
    };

    tick.current = () => void run();
    const onVisible = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    void run();
    return () => {
      stopped = true;
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, intervalMs, jitterMs]);

  const refresh = useCallback(() => tick.current(), []);
  return { data, error, refresh };
}
