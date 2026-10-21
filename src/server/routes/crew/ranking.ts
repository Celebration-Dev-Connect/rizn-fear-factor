import { Router } from "express";
import { requireCrew } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { getContest } from "../../services/contest-state";
import { crewRanking } from "../../services/ranking";

export const crewRankingRouter = Router();

crewRankingRouter.get("/crew/ranking", requireCrew, async (req, res, next) => {
  try {
    const c = await getContest(req.realm);
    if (c.stage !== "voting_closed" && c.stage !== "results_revealed") {
      throw new AppError("not_available", 409, "The ranking is available after voting closes");
    }
    res.json(await crewRanking(req.realm));
  } catch (err) {
    next(err);
  }
});
