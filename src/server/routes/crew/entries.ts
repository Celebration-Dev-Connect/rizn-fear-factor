import { Router, type Request } from "express";
import multer from "multer";
import { requireCrew } from "../../middleware/auth";
import { AppError } from "../../middleware/errors";
import { idempotency } from "../../middleware/idempotency";
import { createEntry, entryPassList, listEntries, removeEntry, updateEntry } from "../../services/entries";
import { costumeTitleField, firstNamesField, uuidSchema } from "@/shared/schemas";

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

/** Spec 002 FR-107: undefined = not sent (leave as is), null = clear, string = set. */
function costumeTitleFrom(req: Request): string | null | undefined {
  const raw = req.body?.costumeTitle;
  if (raw === undefined) return undefined;
  return costumeTitleField.parse(String(raw));
}

/** Spec 003 FR-201: optional `firstNames` JSON, { passId: "Ben" | "" }. */
function firstNamesFrom(req: Request): Record<string, string | null> | undefined {
  const raw = req.body?.firstNames;
  if (raw === undefined || raw === "") return undefined;
  return firstNamesField.parse(String(raw));
}

crewEntriesRouter.get("/crew/entries", requireCrew, async (req, res, next) => {
  try {
    // Crew also get each entry's passes (with first names) so the edit form can show them.
    const list = await listEntries(req.realm);
    const linked = await entryPassList(list.entries.map((e) => e.id));
    res.json({ ...list, entries: list.entries.map((e) => ({ ...e, passes: linked.get(e.id) ?? [] })) });
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
      costumeTitleFrom(req) ?? null,
      firstNamesFrom(req),
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
      costumeTitle: costumeTitleFrom(req),
      firstNames: firstNamesFrom(req),
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
