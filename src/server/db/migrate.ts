import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { config } from "../config";
import { closeDb, db } from "./client";
import { contest, settings } from "./schema";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

/** Applies migrations and seeds the singleton rows. Safe to run on every boot. */
export async function runMigrations(): Promise<void> {
  const c = config();
  await migrate(db(), { migrationsFolder });
  await db()
    .insert(settings)
    .values({ id: 1, eventStart: c.EVENT_START, eventEnd: c.EVENT_END })
    .onConflictDoNothing();
  await db()
    .insert(contest)
    .values([{ realm: "live" }, { realm: "rehearsal" }])
    .onConflictDoNothing();
  await db().execute(sql`select 1`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => {
      console.log("migrations applied");
      return closeDb();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
