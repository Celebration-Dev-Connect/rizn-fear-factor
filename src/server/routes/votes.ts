import { Router } from "express";
import { requirePass } from "../middleware/auth";
import { idempotency } from "../middleware/idempotency";
import { castVote } from "../services/voting";
import { castVoteBody } from "@/shared/schemas";

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
