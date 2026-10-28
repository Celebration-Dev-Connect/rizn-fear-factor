import { Router } from "express";
import { config } from "../../config";
import { AppError } from "../../middleware/errors";
import { requireCrew } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { invalidate } from "../../services/contest-state";
import { issuePass, passByNumber, publicPass, searchPasses } from "../../services/passes";
import { parseScanCode, verifyScanCode } from "../../services/scanCode";
import { scanQuery } from "@/shared/schemas";

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

// Spec 002 FR-126: a crew device scanned a Night Pass QR code. Same result shape as a search hit,
// so the picker applies the same checks (already entered, crew pass, mode). Read-only.
crewPassesRouter.get("/crew/passes/scan", requireCrew, async (req, res, next) => {
  try {
    const q = scanQuery.safeParse(req.query);
    const parsed = q.success ? parseScanCode(q.data.code) : null;
    if (!parsed) throw new AppError("bad_scan_code", 400, "Not a Night Pass code");
    if (parsed.realm !== req.realm) {
      throw new AppError(
        "wrong_realm",
        409,
        parsed.realm === "rehearsal" ? "That code is from rehearsal mode" : "That code is from the live event",
      );
    }
    const hit = await passByNumber(req.realm, parsed.number);
    if (!hit || !verifyScanCode(hit.id, parsed.mac, config().SESSION_SECRET)) {
      throw new AppError("bad_scan_code", 400, "Not a Night Pass code");
    }
    res.json({ pass: { id: hit.id, ...publicPass(hit), entryId: hit.entryId } });
  } catch (err) {
    next(err);
  }
});
