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
 * "20:45" on the event's date in Edmonton (spec 002 FR-111), so crew pick a time without a date.
 * The date comes from the event window start.
 */
export function edmontonTimeOnEventDate(hhmm: string, eventStartIso: string): string {
  return fromEdmontonLocal(`${toEdmontonLocal(eventStartIso).slice(0, 10)}T${hhmm}`);
}
