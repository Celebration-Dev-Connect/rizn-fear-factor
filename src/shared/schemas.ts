import { z } from "zod";
import { DEVICE_LABELS } from "./deviceLabels";

export const uuidSchema = z.uuid();

export const stageSchema = z.enum(["setup", "voting_open", "voting_closed", "results_revealed"]);

export const castVoteBody = z.object({ entryId: z.uuid() });

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
  status: z.enum(["counted", "voided", "released"]).optional(),
});
