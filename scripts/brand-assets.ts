// Turns the RIZN media bundle (media-bundle/, gitignored, ~74 MB) into small WebP files in
// public/brand/ (committed). Run with `npm run brand:assets` whenever the bundle changes.
// Size targets and choices: specs/002-contest-polish/research.md §9.
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp, { type Sharp } from "sharp";

const SRC = path.resolve("media-bundle");
const OUT = path.resolve("public/brand");

type Box = { left: number; top: number; width: number; height: number };
type Job = {
  out: string;
  src: string;
  width: number;
  maxKb: number;
  crop?: Box;
  white?: boolean;
  quality?: number;
};

const sheet = "Graphic elements/Untitled (Square Cards).png";

const JOBS: Job[] = [
  { out: "fear-factor-logo.webp", src: "Workfiles/RiznFearFactor_1080x1920_Logo.png", width: 360, maxKb: 60 },
  { out: "fear-factor-logo@2x.webp", src: "Workfiles/RiznFearFactor_1080x1920_Logo.png", width: 720, maxKb: 120 },
  { out: "fear-factor-banner.webp", src: "fearfactorlogos/Rizn Fear Factor WebsiteBanner_2026.png", width: 1080, maxKb: 90 },
  { out: "rizn-youth-black.webp", src: "fearfactorlogos/IMG_4716.PNG", width: 480, maxKb: 15 },
  { out: "rizn-youth-white.webp", src: "fearfactorlogos/IMG_4716.PNG", width: 480, maxKb: 15, white: true },
  { out: "sticker-stars.webp", src: "Graphic elements/Stars.png", width: 200, maxKb: 20 },
  { out: "sticker-horse.webp", src: "Graphic elements/Red horse.png", width: 200, maxKb: 20 },
  { out: "sticker-cube.webp", src: "Graphic elements/4.png", width: 180, maxKb: 20 },
  { out: "sticker-clock.webp", src: "Graphic elements/5.png", width: 180, maxKb: 20 },
  { out: "sticker-beetle.webp", src: sheet, width: 180, maxKb: 20, crop: { left: 40, top: 450, width: 250, height: 290 } },
  { out: "sticker-spiral.webp", src: sheet, width: 200, maxKb: 20, crop: { left: 895, top: 470, width: 275, height: 480 } },
  { out: "sticker-phone.webp", src: sheet, width: 180, maxKb: 20, crop: { left: 10, top: 10, width: 250, height: 330 } },
];

async function render(job: Job): Promise<Buffer> {
  let img: Sharp = sharp(path.join(SRC, job.src));
  if (job.crop) img = sharp(await img.extract(job.crop).png().toBuffer());
  // Trim the transparent margin so stickers and logos sit tight against their boxes.
  img = sharp(await img.trim().png().toBuffer());
  if (job.white) img = img.negate({ alpha: false });
  img = img.resize({ width: job.width, withoutEnlargement: true });
  // Step quality down until the file fits its budget.
  for (let q = job.quality ?? 82; q >= 40; q -= 6) {
    const buf = await img.clone().webp({ quality: q, alphaQuality: 90, effort: 6 }).toBuffer();
    if (buf.length <= job.maxKb * 1024) return buf;
  }
  throw new Error(`${job.out} is over ${job.maxKb} KB even at low quality`);
}

async function main() {
  if (!existsSync(SRC)) {
    console.error("media-bundle/ not found. Put the RIZN media bundle at the repo root first.");
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  for (const job of JOBS) {
    const buf = await render(job);
    const file = path.join(OUT, job.out);
    writeFileSync(file, buf);
    const { width, height } = await sharp(buf).metadata();
    console.log(`${job.out.padEnd(28)} ${width}x${height}  ${(statSync(file).size / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
