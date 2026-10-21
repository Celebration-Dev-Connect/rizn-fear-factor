import { Router } from "express";
import { requireCrew } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { invalidate } from "../../services/contest-state";
import { issuePass, publicPass, searchPasses } from "../../services/passes";

export const crewPassesRouter = Router();

crewPassesRouter.get("/crew/passes", requireCrew, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.slice(0, 60) : "";
    if (q.trim() === "") {
      res.json({ passes: [] });
      return;
    }
    const rows = await searchPasses(req.realm, q);
    res.json({ passes: rows.map((r) => ({ id: r.id, ...publicPass(r), entryId: r.entryId })) });
  } catch (err) {
    next(err);
  }
});

// FR-016: a pass for a student without a phone. No cookie; the event window doesn't apply.
crewPassesRouter.post("/crew/passes", requireCrew, idempotency, async (req, res, next) => {
  try {
    const { pass } = await issuePass(req.realm, "crew", req.crew!.id);
    invalidate(req.realm);
    res.status(201).json({ pass: { id: pass.id, ...publicPass(pass) } });
  } catch (err) {
    next(err);
  }
});
