import fs from "node:fs";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { config } from "../config";
import { db } from "../db/client";
import { entries } from "../db/schema";
import { requireAny } from "../middleware/auth";
import { AppError } from "../middleware/errors";
import { photoPath, type PhotoSize } from "../services/photos";
import { uuidSchema } from "@/shared/schemas";

export const photosRouter = Router();

// Private photos (FR-039): only pass/crew/screen cookies, only the active realm, never a public URL.
photosRouter.get("/photos/:photoId/:size", requireAny(["pass", "crew", "screen"]), async (req, res, next) => {
  try {
    if (new Date() >= config().PHOTO_DELETE_AT) {
      throw new AppError("photos_deleted", 410, "Photos from this event have been deleted");
    }
    const id = uuidSchema.safeParse(req.params.photoId);
    const size = req.params.size;
    if (!id.success || (size !== "thumb" && size !== "full")) throw new AppError("not_found", 404, "Not found");
    const [row] = await db()
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.photoId, id.data), eq(entries.realm, req.realm)));
    if (!row) throw new AppError("not_found", 404, "Not found");
    const file = photoPath(id.data, size as PhotoSize);
    const stream = fs.createReadStream(file);
    stream.on("error", () => next(new AppError("not_found", 404, "Not found")));
    stream.on("open", () => {
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "private, max-age=86400, immutable");
      stream.pipe(res);
    });
  } catch (err) {
    next(err);
  }
});
