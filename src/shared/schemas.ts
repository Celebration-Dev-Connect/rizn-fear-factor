import { z } from "zod";
import { DEVICE_LABELS } from "./deviceLabels";

export const uuidSchema = z.uuid();

export const stageSchema = z.enum(["setup", "voting_open", "voting_closed", "results_revealed"]);

export const castVoteBody = z.object({ entryId: z.uuid() });

export const changeVoteBody = z.object({ entryId: z.uuid() });

/**
 * Crew-typed costume title (spec 002 FR-107): trimmed, inner whitespace collapsed, one line, no
 * control characters, at most 40 characters. "" means "clear", returned as null.
 */
export const costumeTitleField = z
  .string()
  .max(200)
  .refine((v) => !/[\u0000-\u001F\u007F]/.test(v), { message: "Use plain text on one line" })
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .refine((v) => v.length <= 40, { message: "Keep the costume to 40 characters or fewer" })
  .transform((v) => (v === "" ? null : v));

/**
 * A contestant's first name (spec 003 FR-202, constitution v2.0.0): one given name, 1–20 letters
 * with optional internal hyphens or apostrophes ("Mary-Kate", "D'Andre"). "" means "clear" (null).
 */
export const firstNameField = z
  .string()
  .max(100)
  .transform((v) => v.trim())
  .refine((v) => v === "" || (v.length <= 20 && /^\p{L}(?:\p{L}|['’-](?=\p{L}))*$/u.test(v)), {
    message: "First name only: one name, letters only",
  })
  .transform((v) => (v === "" ? null : v));

/** Multipart field `firstNames`: JSON `{ [passId]: firstName }`. */
export const firstNamesField = z
  .string()
  .max(4000)
  .transform((v, ctx) => {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "First name only: one name, letters only" });
      return z.NEVER;
    }
  })
  .pipe(z.record(z.uuid(), firstNameField));

export const votingCloseBody = z.object({ at: z.iso.datetime({ offset: true }).nullable() });

export const SCAN_CODE_PATTERN = /^NP1\.[LR]\.\d{1,6}\.[A-Z2-7]{12}$/;

export const scanQuery = z.object({ code: z.string().regex(SCAN_CODE_PATTERN) });

export const assistedVoteBody = z.object({ passId: z.uuid(), entryId: z.uuid() });

export const crewSessionBody = z.object({
  passcode: z.string().min(1).max(200),
  deviceLabel: z.enum(DEVICE_LABELS),
});

export const stageBody = z.object({
  action: z.enum(["advance", "undo"]),
  from: z.object({ stage: stageSchema, revealStep: z.number().int().min(0).max(3) }),
});

export const windowBody = z
  .object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) })
  .refine((b) => new Date(b.end) > new Date(b.start), { message: "end must be after start" });

export const rehearsalBody = z.object({ on: z.boolean() });

export const wipeBody = z.object({ confirm: z.literal("WIPE") });

export const voteListQuery = z.object({
  sort: z.enum(["cast_at", "pass_created_at"]).default("cast_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(["counted", "voided", "released", "replaced"]).optional(),
});
