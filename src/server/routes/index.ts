import { Router } from "express";
import { crewDashboardRouter } from "./crew/dashboard";
import { crewEntriesRouter } from "./crew/entries";
import { crewPassesRouter } from "./crew/passes";
import { crewRankingRouter } from "./crew/ranking";
import { crewRehearsalRouter } from "./crew/rehearsal";
import { crewSessionRouter } from "./crew/session";
import { crewStageRouter } from "./crew/stage";
import { crewVotesRouter } from "./crew/votes";
import { entriesRouter } from "./entries";
import { passRouter } from "./pass";
import { photosRouter } from "./photos";
import { qrRouter } from "./qr";
import { resultsRouter } from "./results";
import { screenApiRouter } from "./screen";
import { stateRouter } from "./state";
import { votesRouter } from "./votes";

export function apiRouter(): Router {
  const r = Router();
  for (const sub of [
    stateRouter,
    passRouter,
    qrRouter,
    entriesRouter,
    votesRouter,
    photosRouter,
    resultsRouter,
    screenApiRouter,
    crewSessionRouter,
    crewDashboardRouter,
    crewPassesRouter,
    crewEntriesRouter,
    crewStageRouter,
    crewRankingRouter,
    crewVotesRouter,
    crewRehearsalRouter,
  ]) {
    r.use(sub);
  }
  return r;
}
