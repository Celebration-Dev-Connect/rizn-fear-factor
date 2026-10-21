import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import type { ErrorCode, PublicState } from "@/shared/types";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly state?: PublicState,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError("not_found", 404, "Not found"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    for (const [k, v] of Object.entries(err.headers ?? {})) res.setHeader(k, v);
    res.status(err.status).json({ error: err.code, message: err.message, state: err.state });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "invalid_request", message: err.issues[0]?.message ?? "Invalid" });
    return;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "payload_too_large", message: "Photo is larger than 3 MB" });
      return;
    }
    res.status(400).json({ error: "invalid_request", message: err.message });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "payload_too_large", message: "Request too large" });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "invalid_request", message: "Malformed JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal", message: "Something went wrong" });
};
