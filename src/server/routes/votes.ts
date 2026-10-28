import { Router } from "express";
import { requirePass } from "../middleware/auth";
import { idempotency } from "../middleware/idempotency";
import { castVote, changeVote } from "../services/voting";
import { castVoteBody, changeVoteBody } from "@/shared/schemas";

export const votesRouter = Router();

votesRouter.post("/votes", requirePass, idempotency, async (req, res, next) => {
  try {
    const { entryId } = castVoteBody.parse(req.body);
    const vote = await castVote(req.realm, req.pass!.id, entryId);
    res.status(201).json({ vote });
  } catch (err) {
    next(err);
  }
});

// Spec 002 FR-101: move the pass's single vote to another entry while voting is open.
votesRouter.put("/votes/mine", requirePass, idempotency, async (req, res, next) => {
  try {
    const { entryId } = changeVoteBody.parse(req.body);
    res.json(await changeVote(req.realm, req.pass!.id, entryId));
  } catch (err) {
    next(err);
  }
});
