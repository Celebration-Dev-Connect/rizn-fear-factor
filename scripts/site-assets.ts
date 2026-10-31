// Copies the brand images, favicons, and share card the off-season site needs into site/public
// (spec 004). Nothing else from public/ is published: no student photos ever live there.
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("site/public");
const FILES: [from: string, to: string][] = [
  ["public/brand/fear-factor-logo.webp", "brand/fear-factor-logo.webp"],
  ["public/brand/fear-factor-logo@2x.webp", "brand/fear-factor-logo@2x.webp"],
  ["public/brand/rizn-youth-white.webp", "brand/rizn-youth-white.webp"],
  ["public/brand/van.webp", "brand/van.webp"],
  ["public/brand/og-image.jpg", "brand/og-image.jpg"],
  ["src/app/favicon.ico", "favicon.ico"],
  ["src/app/icon.png", "icon.png"],
  ["src/app/apple-icon.png", "apple-icon.png"],
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(path.join(OUT, "brand"), { recursive: true });
const missing = FILES.filter(([from]) => !existsSync(from)).map(([from]) => from);
if (missing.length) {
  console.error(`site:assets: missing ${missing.join(", ")}. Run npm run brand:assets first.`);
  process.exit(1);
}
for (const [from, to] of FILES) copyFileSync(from, path.join(OUT, to));
console.log(`site:assets: copied ${FILES.length} files to site/public`);
