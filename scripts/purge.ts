// Data deletion procedure (Constitution IX). See README "After the event".
//   npm run purge            → delete all photo files
//   npm run purge -- --all   → delete photo files and every pass, entry, vote, and log row
import { closeDb } from "../src/server/db/client";
import { purgeAll, purgePhotos } from "../src/server/services/purge";

async function main() {
  if (process.argv.includes("--all")) {
    const r = await purgeAll();
    console.log(`Deleted ${r.photos} photo files and all contest data. Record the date and operator in the event notes.`);
  } else {
    console.log(`Deleted ${await purgePhotos()} photo files.`);
  }
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
