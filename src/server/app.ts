import cookieParser from "cookie-parser";
import express, { type Express, type RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db/client";
import { loadIdentity } from "./middleware/auth";
import { errorHandler, noStore, notFound } from "./middleware/errors";
import { apiRouter } from "./routes";
import { screenLinkRouter } from "./routes/screen";

/** Builds the Express app. `pageHandler` (Next.js) serves every non-API route when given. */
export function createApp(opts: { pageHandler?: RequestHandler } = {}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cookieParser(config().SESSION_SECRET));

  app.get("/healthz", async (_req, res) => {
    try {
      await db().execute(sql`select 1`);
      res.type("text/plain").send("ok");
    } catch {
      res.status(503).type("text/plain").send("db unavailable");
    }
  });

  app.use("/api", noStore, express.json({ limit: "16kb" }), loadIdentity, apiRouter(), notFound);
  app.use("/api", errorHandler);

  app.use(screenLinkRouter);
  if (opts.pageHandler) app.use(opts.pageHandler);
  return app;
}
