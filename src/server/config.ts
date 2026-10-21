import { z } from "zod";

const isoWithOffset = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, {
    message: "must be ISO-8601 with a UTC offset, e.g. 2026-10-30T18:30:00-06:00",
  })
  .transform((s) => new Date(s));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    CREW_PASSCODE: z.string().min(4),
    SESSION_SECRET: z.string().min(32, { message: "must be at least 32 characters" }),
    SCREEN_TOKEN: z.string().min(16),
    PUBLIC_URL: z.url(),
    EVENT_START: isoWithOffset,
    EVENT_END: isoWithOffset,
    PHOTO_DELETE_AT: isoWithOffset,
    PHOTO_DIR: z.string().min(1),
  })
  .refine((c) => c.EVENT_END > c.EVENT_START, {
    message: "EVENT_END must be after EVENT_START",
    path: ["EVENT_END"],
  });

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;

/** Parses env once. Throws a readable error listing every missing or invalid variable. */
export function config(): Config {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  cached = result.data;
  return cached;
}

/** Test hook: forget the cached config so a changed process.env is re-read. */
export function resetConfigForTests(): void {
  cached = undefined;
}
