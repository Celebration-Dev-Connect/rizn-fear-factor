import next from "next";
import { createApp } from "./app";
import { config } from "./config";
import { runMigrations } from "./db/migrate";
import { purgeOldIdempotencyKeys } from "./middleware/idempotency";

const HOUR = 60 * 60 * 1000;

async function main(): Promise<void> {
  const c = config();
  await runMigrations();

  const dev = c.NODE_ENV === "development";
  const nextApp = next({ dev, dir: process.cwd() });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();

  const app = createApp({ pageHandler: (req, res) => handle(req, res) });

  // Housekeeping only. Nothing here ever changes contest state (Constitution VI).
  void purgeOldIdempotencyKeys();
  setInterval(() => void purgeOldIdempotencyKeys().catch(console.error), HOUR).unref();

  app.listen(c.PORT, () => console.log(`RIZN Fear Factor listening on :${c.PORT}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
