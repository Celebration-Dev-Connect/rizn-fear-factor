/**
 * Whether a scheduled event is over (spec 004 FR-306). An unparseable date counts as not over, so a
 * typo keeps the section visible instead of breaking the page.
 */
export function isEventOver(endsAt: string, nowMs: number): boolean {
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return false;
  return nowMs >= end;
}
