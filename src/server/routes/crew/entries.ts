import { Router, type Request } from "express";
import multer from "multer";
import { requireCrew } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { idempotency } from "../../middleware/idempotency";
import { createEntry, listEntries, removeEntry, updateEntry } from "../../services/entries";
import { uuidSchema } from "@/shared/schemas";

export const crewEntriesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 30 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new AppError("unsupported_media", 415, "Only photos can be uploaded"));
  },
});

function passIdsFrom(req: Request): string[] | undefined {
  const raw = req.body?.passIds ?? req.body?.["passIds[]"];
  if (raw === undefined) return undefined;
  const list = (Array.isArray(raw) ? raw : [raw]).map(String);
  return list.map((id) => {
    const p = uuidSchema.safeParse(id);
    if (!p.success) throw new AppError("invalid_request", 400, "Invalid pass id");
    return p.data;
  });
}

crewEntriesRouter.get("/crew/entries", requireCrew, async (req, res, next) => {
  try {
    res.json(await listEntries(req.realm));
  } catch (err) {
    next(err);
  }
});

crewEntriesRouter.post("/crew/entries", requireCrew, idempotency, upload.single("photo"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError("invalid_request", 400, "Take a photo first");
    const { entry, addedDuringVoting } = await createEntry(
      req.realm,
      req.crew!.id,
      passIdsFrom(req) ?? [],
      req.file.buffer,
      req.body?.consent === "true",
    );
    res.status(201).json({ entry, ...(addedDuringVoting ? { warning: "added_during_voting" } : {}) });
  } catch (err) {
    next(err);
  }
});

crewEntriesRouter.patch("/crew/entries/:id", requireCrew, idempotency, upload.single("photo"), async (req, res, next) => {
  try {
    const id = uuidSchema.parse(req.params.id);
    const entry = await updateEntry(req.realm, req.crew!.id, id, {
      photo: req.file?.buffer,
      passIds: passIdsFrom(req),
    });
    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

crewEntriesRouter.delete("/crew/entries/:id", requireCrew, idempotency, async (req, res, next) => {
  try {
    const id = uuidSchema.parse(req.params.id);
    res.json({ releasedVotes: await removeEntry(req.realm, req.crew!.id, id) });
  } catch (err) {
    next(err);
  }
});
