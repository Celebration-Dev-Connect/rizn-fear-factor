import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, NextFunction, Request, RequestHandler, Response } from "express";
import { and, eq } from "drizzle-orm";
import { config } from "../config";
import { db } from "../db/client";
import { crewSessions, passes } from "../db/schema";
import { activeRealm, eventStatus, getSettings } from "../services/realm";
import { AppError } from "./errors";
import type { Realm } from "@/shared/types";

export const CREW_SESSION_MS = 12 * 60 * 60 * 1000;
export const SCREEN_COOKIE_MS = 30 * 24 * 60 * 60 * 1000;

export const passCookieName = (realm: Realm) => (realm === "live" ? "np_live" : "np_rehearsal");

export function cookieOptions(maxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: config().NODE_ENV === "production", // dev and test run over plain http
    sameSite: "lax",
    path: "/",
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

export function newPassToken(): { token: string; hash: Buffer } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** Resolves the active realm and, if present, the pass and crew/screen cookies. Never rejects. */
export const loadIdentity: RequestHandler = async (req, _res, next) => {
  try {
    req.realm = await activeRealm();
    const token = req.cookies?.[passCookieName(req.realm)];
    if (typeof token === "string" && token.length > 0) {
      const [row] = await db()
        .select()
        .from(passes)
        .where(and(eq(passes.tokenHash, hashToken(token)), eq(passes.realm, req.realm)));
      if (row) {
        req.pass = {
          id: row.id,
          realm: row.realm,
          nickname: row.nickname,
          number: row.number,
          origin: row.origin,
          createdAt: row.createdAt,
        };
      }
    }
    const crewId = req.signedCookies?.crew;
    if (typeof crewId === "string") {
      const [s] = await db().select().from(crewSessions).where(eq(crewSessions.id, crewId));
      if (s && Date.now() - s.createdAt.getTime() < CREW_SESSION_MS) {
        req.crew = { id: s.id, deviceLabel: s.deviceLabel };
        // Touch last_seen_at at most once a minute to keep polls cheap.
        if (Date.now() - s.lastSeenAt.getTime() > 60_000) {
          await db()
            .update(crewSessions)
            .set({ lastSeenAt: new Date() })
            .where(eq(crewSessions.id, s.id));
        }
      }
    }
    if (req.signedCookies?.screen === "screen") req.screen = true;
    next();
  } catch (err) {
    next(err);
  }
};

/** FR-006: a live pass only works while the event window is open. Rehearsal passes are exempt. */
async function assertPassUsable(req: Request): Promise<void> {
  const s = await getSettings();
  if (eventStatus(new Date(), s, req.realm) !== "open") {
    throw new AppError("outside_window", 403, "The Night Pass only works during the event");
  }
}

export const requirePass: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.pass) throw new AppError("no_pass", 401, "Get a Night Pass first");
    await assertPassUsable(req);
    req.actorScope = req.pass.id;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireCrew: RequestHandler = (req, _res, next) => {
  if (!req.crew) return next(new AppError("not_crew", 401, "Crew sign-in required"));
  req.actorScope = req.crew.id;
  next();
};

export const requireScreen: RequestHandler = (req, _res, next) => {
  if (!req.screen) return next(new AppError("not_screen", 401, "Ask a crew member for the screen link"));
  next();
};

type Kind = "pass" | "crew" | "screen";

/** Allows any of the listed identities. Crew and screen win over a pass, so they skip the window. */
export function requireAny(kinds: Kind[]): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (kinds.includes("crew") && req.crew) return next();
      if (kinds.includes("screen") && req.screen) return next();
      if (kinds.includes("pass") && req.pass) {
        await assertPassUsable(req);
        return next();
      }
      if (kinds.includes("pass")) throw new AppError("no_pass", 401, "Get a Night Pass first");
      throw new AppError("not_crew", 401, "Not allowed");
    } catch (err) {
      next(err);
    }
  };
}
