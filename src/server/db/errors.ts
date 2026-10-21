/** True for a PostgreSQL unique violation (23505), including when wrapped by Drizzle. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | undefined;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
