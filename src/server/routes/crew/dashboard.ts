import { Router } from "express";
import { config } from "../../config";
import { requireCrew } from "../../middleware/auth";
import { getPublicState } from "../../services/contest-state";
import { countTotals } from "../../services/voting";

export const crewDashboardRouter = Router();

// Totals only — never per-costume counts (FR-026).
crewDashboardRouter.get("/crew/dashboard", requireCrew, async (req, res, next) => {
  try {
    const [state, totals] = await Promise.all([getPublicState(req.realm), countTotals(req.realm)]);
    const c = config();
    res.json({
      state,
      totals,
      screenUrl: `${c.PUBLIC_URL}/screen?t=${encodeURIComponent(c.SCREEN_TOKEN)}`,
      deviceLabel: req.crew!.deviceLabel,
    });
  } catch (err) {
    next(err);
  }
});
