import { Router } from "express";
import { requireAny } from "../middleware/auth";
import { etag } from "../services/contest-state";
import { listEntries } from "../services/entries";

export const entriesRouter = Router();

entriesRouter.get("/entries", requireAny(["pass", "crew", "screen"]), async (req, res, next) => {
  try {
    const body = await listEntries(req.realm);
    const tag = etag(body);
    res.setHeader("ETag", tag);
    if (req.get("If-None-Match") === tag) {
      res.status(304).end();
      return;
    }
    res.json(body);
  } catch (err) {
    next(err);
  }
});
