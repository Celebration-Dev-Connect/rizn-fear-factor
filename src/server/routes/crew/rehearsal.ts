import { Router } from "express";
import { requireCrew } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { getPublicState } from "../../services/contest-state";
import { activeRealm } from "../../services/realm";
import { setEventWindow, setRehearsal, wipeRehearsal } from "../../services/rehearsal";
import { rehearsalBody, windowBody, wipeBody } from "@/shared/schemas";

export const crewRehearsalRouter = Router();

crewRehearsalRouter.post("/crew/rehearsal", requireCrew, idempotency, async (req, res, next) => {
  try {
    const { on } = rehearsalBody.parse(req.body);
    await setRehearsal(on, req.crew!.id);
    res.json(await getPublicState(await activeRealm()));
  } catch (err) {
    next(err);
  }
});

crewRehearsalRouter.post("/crew/rehearsal/wipe", requireCrew, idempotency, async (req, res, next) => {
  try {
    wipeBody.parse(req.body);
    res.json({ deleted: await wipeRehearsal(req.crew!.id) });
  } catch (err) {
    next(err);
  }
});

crewRehearsalRouter.put("/crew/settings/window", requireCrew, idempotency, async (req, res, next) => {
  try {
    const { start, end } = windowBody.parse(req.body);
    await setEventWindow(new Date(start), new Date(end), req.crew!.id);
    res.json(await getPublicState(req.realm));
  } catch (err) {
    next(err);
  }
});
