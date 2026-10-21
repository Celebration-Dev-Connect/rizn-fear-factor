import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

let pool: pg.Pool | undefined;
let instance: Db | undefined;

export function db(): Db {
  if (!instance) {
    pool = new pg.Pool({ connectionString: config().DATABASE_URL, max: 10 });
    instance = drizzle(pool, { schema });
  }
  return instance;
}

export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().transaction(fn);
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  instance = undefined;
}
