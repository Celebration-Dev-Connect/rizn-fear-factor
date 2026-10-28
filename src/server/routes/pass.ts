import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { entryPasses, votes } from "../db/schema";
import { cookieOptions, passCookieName, requirePass } from "../middleware/auth";
import { AppError } from "../middleware/errors";
import { getContest } from "../services/contest-state";
import { eventStatus, getSettings } from "../services/realm";
import { issuePass, publicPass } from "../services/passes";
import type { Me } from "@/shared/types";

export const passRouter = Router();

const PASS_COOKIE_MS = 7 * 24 * 60 * 60 * 1000;

// Returns the phone's existing pass or issues one. No input is accepted (FR-001, FR-003).
passRouter.post("/pass", async (req, res, next) => {
  try {
    if (eventStatus(new Date(), await getSettings(), req.realm) !== "open") {
      throw new AppError("outside_window", 403, "The Night Pass only works during the event");
    }
    if (req.pass) {
      res.json({ pass: publicPass(req.pass) });
      return;
    }
    const { pass, token } = await issuePass(req.realm, "self");
    res.cookie(passCookieName(req.realm), token!, cookieOptions(PASS_COOKIE_MS));
    res.json({ pass: publicPass(pass) });
  } catch (err) {
    next(err);
  }
});

passRouter.get("/me", requirePass, async (req, res, next) => {
  try {
    const p = req.pass!;
    const [own] = await db().select({ entryId: entryPasses.entryId }).from(entryPasses).where(eq(entryPasses.passId, p.id));
    const [vote] = await db()
      .select({ entryId: votes.entryId, status: votes.status })
      .from(votes)
      .where(and(eq(votes.passId, p.id), inArray(votes.status, ["counted", "voided"])));
    const me: Me = {
      pass: publicPass(p),
      ownEntryId: own?.entryId ?? null,
      ownEntry: null,
      ownPlace: null,
      vote: vote ? { entryId: vote.entryId } : null,
      // FR-105: only a counted vote, and only while voting is open.
      voteChangeable: vote?.status === "counted" && (await getContest(req.realm)).stage === "voting_open",
    };
    res.json(me);
  } catch (err) {
    next(err);
  }
});
