import { Router } from "express";
import { config } from "../../config";
import { requireCrew } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { getPublicState, setVotingClose } from "../../services/contest-state";
import { countTotals } from "../../services/voting";
import { votingCloseBody } from "@/shared/schemas";

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

// Spec 002 FR-111: the time shown by the big-screen countdown. It never closes voting itself.
crewDashboardRouter.put("/crew/voting-close", requireCrew, idempotency, async (req, res, next) => {
  try {
    const { at } = votingCloseBody.parse(req.body);
    res.json(await setVotingClose(req.realm, req.crew!.id, at ? new Date(at) : null));
  } catch (err) {
    next(err);
  }
});
