import { Router } from "express";
import { passRouter } from "./pass";
import { qrRouter } from "./qr";
import { stateRouter } from "./state";

export function apiRouter(): Router {
  const r = Router();
  r.use(stateRouter);
  r.use(passRouter);
  r.use(qrRouter);
  return r;
}
