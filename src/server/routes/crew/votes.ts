import { Router } from "express";
import { desc, eq, lt, and } from "drizzle-orm";
import { db } from "../../db/client";
import { auditEvents } from "../../db/schema";
import { requireCrew } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { castVote, listVotes, restoreVote, voidVote } from "../../services/voting";
import { assistedVoteBody, uuidSchema, voteListQuery } from "@/shared/schemas";

export const crewVotesRouter = Router();

crewVotesRouter.get("/crew/votes", requireCrew, async (req, res, next) => {
  try {
    const q = voteListQuery.parse(req.query);
    res.json({ votes: await listVotes(req.realm, q.sort, q.order, q.status) });
  } catch (err) {
    next(err);
  }
});

crewVotesRouter.post("/crew/votes/:id/void", requireCrew, idempotency, async (req, res, next) => {
  try {
    res.json({ vote: await voidVote(req.realm, uuidSchema.parse(req.params.id), req.crew!.id) });
  } catch (err) {
    next(err);
  }
});

crewVotesRouter.post("/crew/votes/:id/restore", requireCrew, idempotency, async (req, res, next) => {
  try {
    res.json({ vote: await restoreVote(req.realm, uuidSchema.parse(req.params.id), req.crew!.id) });
  } catch (err) {
    next(err);
  }
});

// FR-020: same rules as a student vote; marked crew-assisted.
crewVotesRouter.post("/crew/assisted-votes", requireCrew, idempotency, async (req, res, next) => {
  try {
    const { passId, entryId } = assistedVoteBody.parse(req.body);
    res.status(201).json({ vote: await castVote(req.realm, passId, entryId, req.crew!.id) });
  } catch (err) {
    next(err);
  }
});

crewVotesRouter.get("/crew/audit", requireCrew, async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const before = Number(req.query.before) || undefined;
    const events = await db()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.realm, req.realm), before ? lt(auditEvents.id, before) : undefined))
      .orderBy(desc(auditEvents.id))
      .limit(limit);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});
