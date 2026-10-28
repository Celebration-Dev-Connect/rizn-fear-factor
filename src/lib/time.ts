export function formatEdmontonTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    timeZone: "America/Edmonton",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatEdmontonDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** datetime-local value ("YYYY-MM-DDTHH:mm") in Edmonton time for an ISO instant. */
export function toEdmontonLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Interprets a datetime-local value as Edmonton wall time and returns an ISO instant. */
export function fromEdmontonLocal(local: string): string {
  const guess = new Date(`${local}:00Z`);
  const shown = new Date(toEdmontonLocal(guess.toISOString()) + ":00Z");
  return new Date(guess.getTime() + (guess.getTime() - shown.getTime())).toISOString();
}

/**
 * The next time the Edmonton clock reads `hhmm` ("20:45"), from `nowMs` (spec 002 FR-111): today if
 * that time is still ahead, otherwise tomorrow. Crew pick only a time, so the date must never come
 * from settings that might be days off (a bug when it used the event-window start).
 */
export function nextEdmontonOccurrence(hhmm: string, nowMs: number): string {
  const today = toEdmontonLocal(new Date(nowMs).toISOString()).slice(0, 10);
  const candidate = fromEdmontonLocal(`${today}T${hhmm}`);
  if (new Date(candidate).getTime() > nowMs) return candidate;
  const tomorrow = toEdmontonLocal(new Date(nowMs + 24 * 60 * 60 * 1000).toISOString()).slice(0, 10);
  return fromEdmontonLocal(`${tomorrow}T${hhmm}`);
}

/** "Wed, Oct 28, 8:45 p.m." in Edmonton time, so crew can see the date as well as the time. */
export function formatEdmontonDayTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
