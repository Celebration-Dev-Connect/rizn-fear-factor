import { allNicknames } from "../nicknames";

/** Picks a random nickname not in `used`, or null when the curated space is exhausted. */
export function pickNickname(used: Set<string>, rand: () => number = Math.random): string | null {
  const free = allNicknames().filter((n) => !used.has(n));
  if (free.length === 0) return null;
  return free[Math.floor(rand() * free.length)]!;
}
