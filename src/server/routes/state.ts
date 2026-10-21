import { Router } from "express";
import { etag, getPublicState } from "../services/contest-state";

export const stateRouter = Router();

// Polled by every phone (research §3): tiny body, ETag/304, mostly served from memory.
stateRouter.get("/state", async (req, res, next) => {
  try {
    const state = await getPublicState(req.realm);
    const tag = etag(state);
    res.setHeader("ETag", tag);
    if (req.get("If-None-Match") === tag) {
      res.status(304).end();
      return;
    }
    res.json(state);
  } catch (err) {
    next(err);
  }
});
