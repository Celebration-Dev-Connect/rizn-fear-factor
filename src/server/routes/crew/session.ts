import { timingSafeEqual, createHash } from "node:crypto";
import { Router } from "express";
import { config } from "../../config";
import { db } from "../../db/client";
import { crewSessions } from "../../db/schema";
import { cookieOptions, CREW_SESSION_MS } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { recordFailure, recordSuccess, retryAfterSeconds } from "../../middleware/rateLimit";
import { crewSessionBody } from "@/shared/schemas";

export const crewSessionRouter = Router();

const digest = (s: string) => createHash("sha256").update(s).digest();
const passcodeMatches = (given: string) => timingSafeEqual(digest(given), digest(config().CREW_PASSCODE));

crewSessionRouter.post("/crew/session", async (req, res, next) => {
  try {
    const ip = req.ip ?? "unknown";
    const wait = retryAfterSeconds(ip);
    if (wait > 0) {
      throw new AppError("too_many_attempts", 429, `Too many attempts. Try again in ${wait} s.`, undefined, {
        "Retry-After": String(wait),
      });
    }
    const body = crewSessionBody.parse(req.body);
    if (!passcodeMatches(body.passcode)) {
      recordFailure(ip);
      throw new AppError("not_crew", 401, "Wrong crew passcode");
    }
    recordSuccess(ip);
    const [s] = await db().insert(crewSessions).values({ deviceLabel: body.deviceLabel }).returning();
    res.cookie("crew", s!.id, { ...cookieOptions(CREW_SESSION_MS), signed: true });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

crewSessionRouter.delete("/crew/session", (_req, res) => {
  res.clearCookie("crew", { ...cookieOptions(), signed: true });
  res.status(204).end();
});
