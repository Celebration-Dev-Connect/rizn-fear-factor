import { Router } from "express";
import { requireCrew } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { transition } from "../../services/contest-state";
import { stageBody } from "@/shared/schemas";

export const crewStageRouter = Router();

crewStageRouter.post("/crew/stage", requireCrew, idempotency, async (req, res, next) => {
  try {
    const { action, from } = stageBody.parse(req.body);
    res.json(await transition(req.realm, req.crew!.id, action, from));
  } catch (err) {
    next(err);
  }
});
