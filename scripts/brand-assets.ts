// Turns the RIZN media bundle (media-bundle/, gitignored, ~74 MB) into small WebP files in
// public/brand/ (committed), plus the favicons (src/app/icon.png, apple-icon.png, favicon.ico) and
// the social share card (public/brand/og-image.jpg). Run with `npm run brand:assets` whenever the
// bundle changes. Size targets and choices: specs/002-contest-polish/research.md §9.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
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

const ORANGE = "#f94003";
const INK = "#0a0e1a";

/** The asterisk from the RIZN Youth logo, black on transparent. */
async function asterisk(): Promise<Buffer> {
  return sharp(path.join(SRC, "fearfactorlogos/IMG_4716.PNG"))
    .extract({ left: 0, top: 0, width: 625, height: 693 })
    .trim()
    .png()
    .toBuffer();
}

/** Black asterisk on a brand-orange tile, like the poster's orange panel. */
async function iconTile(size: number, radius: number): Promise<Buffer> {
  const mark = await sharp(await asterisk())
    .resize({ width: Math.round(size * 0.7), height: Math.round(size * 0.7), fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${ORANGE}"/></svg>`,
  );
  return sharp(tile).composite([{ input: mark, gravity: "center" }]).png({ compressionLevel: 9 }).toBuffer();
}

/** A .ico holding PNG images (valid in every current browser). */
function ico(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((p, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(p.size >= 256 ? 0 : p.size, e);
    header.writeUInt8(p.size >= 256 ? 0 : p.size, e + 1);
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(p.data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += p.data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

/** 1200×630 share card for link previews: the event banner, stickers, and the date. */
async function ogImage(): Promise<Buffer> {
  const W = 1200;
  const H = 630;
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <radialGradient id="o" cx="0.12" cy="0" r="0.8"><stop offset="0" stop-color="${ORANGE}" stop-opacity="0.35"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>
        <radialGradient id="b" cx="0.9" cy="1" r="0.8"><stop offset="0" stop-color="#0069fb" stop-opacity="0.45"/><stop offset="1" stop-color="#0069fb" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="${INK}"/>
      <rect width="${W}" height="${H}" fill="url(#o)"/>
      <rect width="${W}" height="${H}" fill="url(#b)"/>
      <text x="600" y="512" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-weight="900" font-size="54" fill="${ORANGE}">NIGHT PASS · COSTUME CONTEST</text>
      <text x="600" y="572" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="32" fill="#f5f7ff">Friday, October 30 · Celebration Church · Grades 7–12</text>
    </svg>`,
  );
  const banner = await sharp(path.join(SRC, "fearfactorlogos/Rizn Fear Factor WebsiteBanner_2026.png"))
    .resize({ width: 1000 })
    .png()
    .toBuffer();
  const sticker = async (src: string, width: number, rotate: number) =>
    sharp(await sharp(path.join(SRC, src)).trim().png().toBuffer())
      .resize({ width })
      .rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  return sharp(bg)
    .composite([
      { input: banner, top: 50, left: 100 },
      { input: await sticker("Graphic elements/Stars.png", 150, -14), top: 10, left: 10 },
      { input: await sticker("Graphic elements/Red horse.png", 110, 12), top: 8, left: 1078 },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/**
 * Makes a cut-out on a plain white background transparent: near-white pixels connected to the
 * image edge become transparent, so white areas inside the subject (like the cross on the van)
 * stay. Images that already have transparency are only trimmed and resized.
 */
async function removeEdgeBackground(file: string, width: number): Promise<Buffer> {
  const meta = await sharp(file).metadata();
  const resized = sharp(file).rotate().resize({ width, withoutEnlargement: true });
  if (meta.hasAlpha) return resized.trim().png().toBuffer();
  const { data, info } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const nearWhite = (i: number) => data[i]! > 232 && data[i + 1]! > 232 && data[i + 2]! > 232;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p] || !nearWhite(p * 4)) continue;
    seen[p] = 1;
    data[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  // Soften the cut edge: pixels next to removed background get partial alpha by how white they are.
  for (let p = 0; p < w * h; p++) {
    if (seen[p]) continue;
    const x = p % w;
    const nearBg = (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (p >= w && seen[p - w]) || (p < w * (h - 1) && seen[p + w]);
    if (!nearBg) continue;
    const i = p * 4;
    const whiteness = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
    if (whiteness > 200) data[i + 3] = Math.round(255 * (1 - (whiteness - 200) / 55));
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim().png().toBuffer();
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

  // Favicons use Next.js file conventions in src/app/, which add the <link> tags automatically.
  const outputs: [string, Buffer][] = [
    ["src/app/icon.png", await iconTile(512, 96)],
    ["src/app/apple-icon.png", await iconTile(180, 0)], // iOS rounds the corners itself
    [
      "src/app/favicon.ico",
      ico([
        { size: 16, data: await iconTile(16, 3) },
        { size: 32, data: await iconTile(32, 6) },
        { size: 48, data: await iconTile(48, 9) },
      ]),
    ],
    ["public/brand/og-image.jpg", await ogImage()],
  ];
  for (const [file, buf] of outputs) {
    writeFileSync(path.resolve(file), buf);
    console.log(`${file.padEnd(28)} ${(buf.length / 1024).toFixed(1)} KB`);
  }

  // Spec 003: the VANAGEDDON photo is optional. Drop media-bundle/van.(jpg|jpeg|png|webp) (or the
  // designer's Subject.png cut-out) in and rerun; the /rizn page shows it once src/content/van.json
  // says { "photo": true }.
  const van = readdirSync(SRC).find((f) => /^(van|subject)\.(jpe?g|png|webp)$/i.test(f));
  if (van) {
    const cutout = await removeEdgeBackground(path.join(SRC, van), 1200);
    let buf = Buffer.alloc(0);
    for (let q = 82; q >= 40; q -= 8) {
      buf = await sharp(cutout).webp({ quality: q, alphaQuality: 90, effort: 6 }).toBuffer();
      if (buf.length <= 150 * 1024) break;
    }
    writeFileSync(path.join(OUT, "van.webp"), buf);
    const { width, height } = await sharp(buf).metadata();
    console.log(`${"van.webp".padEnd(28)} ${width}x${height}  ${(buf.length / 1024).toFixed(1)} KB`);
  } else {
    console.log("van photo                    none (add media-bundle/van.jpg to show it on /rizn)");
  }
  writeFileSync(path.resolve("src/content/van.json"), `${JSON.stringify({ photo: Boolean(van) })}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
