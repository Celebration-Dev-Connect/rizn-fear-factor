// In-memory limiter for crew passcode attempts (single process, research §5).
// After 5 failures from one IP, each further attempt must wait 2 s, doubling up to 60 s.
const FREE_FAILURES = 5;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 60_000;

type Entry = { failures: number; blockedUntil: number };
const byIp = new Map<string, Entry>();

export function retryAfterSeconds(ip: string, now = Date.now()): number {
  const e = byIp.get(ip);
  if (!e || e.blockedUntil <= now) return 0;
  return Math.ceil((e.blockedUntil - now) / 1000);
}

export function recordFailure(ip: string, now = Date.now()): void {
  const e = byIp.get(ip) ?? { failures: 0, blockedUntil: 0 };
  e.failures += 1;
  if (e.failures >= FREE_FAILURES) {
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (e.failures - FREE_FAILURES));
    e.blockedUntil = now + delay;
  }
  byIp.set(ip, e);
}

export function recordSuccess(ip: string): void {
  byIp.delete(ip);
}

export function resetRateLimitsForTests(): void {
  byIp.clear();
}
