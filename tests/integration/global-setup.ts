import pg from "pg";

// Recreates the test schema once per run, then the app's own migrator applies migrations.
export default async function setup(): Promise<void> {
  await import("./env");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await client.end();
  const { runMigrations } = await import("@/server/db/migrate");
  const { closeDb } = await import("@/server/db/client");
  await runMigrations();
  await closeDb();
}
