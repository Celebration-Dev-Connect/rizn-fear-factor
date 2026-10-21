import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { config } from "../config";
import { cookieOptions, requireScreen, SCREEN_COOKIE_MS } from "../middleware/auth";
import { countTotals } from "../services/voting";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Page-level route, mounted before Next: /screen?t=<SCREEN_TOKEN> sets the screen cookie. */
export const screenLinkRouter = Router();
screenLinkRouter.get("/screen", (req, res, next) => {
  const t = typeof req.query.t === "string" ? req.query.t : undefined;
  if (!t) return next();
  if (timingSafeEqual(digest(t), digest(config().SCREEN_TOKEN))) {
    res.cookie("screen", "screen", { ...cookieOptions(SCREEN_COOKIE_MS), signed: true });
  }
  res.redirect(302, "/screen");
});

export const screenApiRouter = Router();
screenApiRouter.get("/screen/totals", requireScreen, async (req, res, next) => {
  try {
    res.json(await countTotals(req.realm));
  } catch (err) {
    next(err);
  }
});
