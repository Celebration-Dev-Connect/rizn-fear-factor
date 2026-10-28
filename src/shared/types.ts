// Shared between the Express API and the Next.js pages. Matches contracts/api.md.

export type Realm = "live" | "rehearsal";
export type Stage = "setup" | "voting_open" | "voting_closed" | "results_revealed";
export type EventStatus = "before" | "open" | "ended";

export type PublicState = {
  version: number;
  stage: Stage;
  revealStep: 0 | 1 | 2 | 3;
  rehearsal: boolean;
  event: { status: EventStatus; start: string; end: string };
  entriesVersion: number;
  /** Crew-set close time for the big-screen countdown. Display only (spec 002 FR-114). */
  votingClosesAt: string | null;
};

export type Pass = { number: number; nickname: string; origin: "self" | "crew" };

export type EntryCard = {
  id: string;
  displayName: string;
  /** Crew-typed costume, shown as "{displayName} as {costumeTitle}" (spec 002 FR-108). */
  costumeTitle: string | null;
  photo: { thumb: string; full: string };
  alt: string;
};

export type RevealedPlace = { place: 1 | 2 | 3; tied: boolean; entries: EntryCard[] };

export type Me = {
  pass: Pass;
  ownEntryId: string | null;
  /** The contestant's own entry, for the "Your costume" card (spec 002 FR-121). */
  ownEntry: EntryCard | null;
  /** Set only once the reveal has reached that entry's place (FR-122). Never a count. */
  ownPlace: { place: 1 | 2 | 3; tied: boolean } | null;
  /** The counted or voided vote; never a replaced one. */
  vote: { entryId: string } | null;
  /** True only while voting is open and the vote is counted (FR-105). */
  voteChangeable: boolean;
};

export const ERROR_CODES = [
  "outside_window",
  "no_pass",
  "not_crew",
  "not_screen",
  "voting_not_open",
  "already_voted",
  "self_vote",
  "stage_conflict",
  "pass_already_entered",
  "consent_required",
  "no_votes",
  "rehearsal_locked",
  "too_many_attempts",
  "photos_deleted",
  "nickname_exhausted",
  "idempotency_key_required",
  "not_found",
  "invalid_request",
  "unsupported_media",
  "payload_too_large",
  "not_available",
  "vote_voided",
  "bad_scan_code",
  "wrong_realm",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiError = { error: ErrorCode; message: string; state?: PublicState };

export function formatPassNumber(n: number): string {
  return `#${String(n).padStart(4, "0")}`;
}

export const STAGE_LABELS: Record<Stage, string> = {
  setup: "Entries open",
  voting_open: "Voting open",
  voting_closed: "Voting closed",
  results_revealed: "Results revealed",
};

export const PLACE_LABELS: Record<1 | 2 | 3, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

/** Plain-text entry label for aria labels and announcements: "Midnight Gremlin as Superman". */
export function entryLabelText(e: Pick<EntryCard, "displayName" | "costumeTitle">): string {
  return e.costumeTitle ? `${e.displayName} as ${e.costumeTitle}` : e.displayName;
}
