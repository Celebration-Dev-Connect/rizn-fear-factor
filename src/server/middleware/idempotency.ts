import type { RequestHandler } from "express";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/client";
import { idempotencyKeys } from "../db/schema";
import { uuidSchema } from "@/shared/schemas";
import { AppError } from "./errors";

const KEY_TTL_MS = 24 * 60 * 60 * 1000;
const WAIT_FOR_INFLIGHT_MS = 5000;

/**
 * Makes every mutation safe to retry (Constitution III). Must run after auth so the key is
 * scoped to the pass or crew session. A repeated key replays the first stored response.
 */
export const idempotency: RequestHandler = async (req, res, next) => {
  try {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
    const parsed = uuidSchema.safeParse(req.get("Idempotency-Key"));
    if (!parsed.success) {
      throw new AppError("idempotency_key_required", 400, "Idempotency-Key header (uuid) required");
    }
    const key = parsed.data;
    const scope = req.actorScope ?? "anonymous";

    const inserted = await db()
      .insert(idempotencyKeys)
      .values({ key, scope })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });

    if (inserted.length === 0) {
      const deadline = Date.now() + WAIT_FOR_INFLIGHT_MS;
      for (;;) {
        const [row] = await db()
          .select()
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)));
        if (row?.responseStatus != null) {
          res.setHeader("Idempotent-Replay", "true");
          res.status(row.responseStatus).json(row.responseBody);
          return;
        }
        if (!row) break; // the first attempt failed with a 5xx and was cleared; run again
        if (Date.now() > deadline) {
          res.status(409).json({ error: "invalid_request", message: "Still processing; retry shortly" });
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      await db().insert(idempotencyKeys).values({ key, scope }).onConflictDoNothing();
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const status = res.statusCode;
      const write =
        status >= 500
          ? db()
              .delete(idempotencyKeys)
              .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)))
          : db()
              .update(idempotencyKeys)
              .set({ responseStatus: status, responseBody: body ?? null })
              .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)));
      write.then(
        () => originalJson(body),
        (err) => {
          console.error("idempotency store failed", err);
          originalJson(body);
        },
      );
      return res;
    };
    next();
  } catch (err) {
    next(err);
  }
};

export async function purgeOldIdempotencyKeys(): Promise<void> {
  await db()
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, new Date(Date.now() - KEY_TTL_MS)));
}
