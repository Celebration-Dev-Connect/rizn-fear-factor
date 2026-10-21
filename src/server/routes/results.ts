import { Router } from "express";
import { requireAny } from "../middleware/auth";
import { publicResults } from "../services/ranking";

export const resultsRouter = Router();

resultsRouter.get("/results", requireAny(["pass", "screen", "crew"]), async (req, res, next) => {
  try {
    res.json({ places: await publicResults(req.realm) });
  } catch (err) {
    next(err);
  }
});
