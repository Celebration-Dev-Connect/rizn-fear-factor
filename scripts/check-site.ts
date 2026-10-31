// Guards every off-season publish (spec 004 T009). Fails the build, so nothing is uploaded, if the
// export is incomplete, leaks contest wiring, goes stale, or points at another origin.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("site/out");
const SITE_URL = process.env.SITE_URL ?? "https://fearfactor.riznyouth.com";
const problems: string[] = [];

for (const f of ["index.html", "404.html", "favicon.ico", "icon.png", "apple-icon.png", "brand/og-image.jpg", "brand/van.webp", "brand/fear-factor-logo.webp"]) {
  if (!existsSync(path.join(OUT, f))) problems.push(`missing ${f}`);
}

for (const page of ["index.html", "404.html"]) {
  const file = path.join(OUT, page);
  if (!existsSync(file)) continue;
  const html = readFileSync(file, "utf8");
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "").toLowerCase();
  if (!html.includes(`${SITE_URL}/brand/og-image.jpg`)) problems.push(`${page}: og:image is not ${SITE_URL}/brand/og-image.jpg`);
  if (!/noindex/.test(html)) problems.push(`${page}: missing noindex`);
  for (const stale of ["next week", "next friday", "tonight"]) {
    if (text.includes(stale)) problems.push(`${page}: stale wording "${stale}"`);
  }
  for (const contest of ["/api/", "night pass", "/crew", "/contest"]) {
    if (text.includes(contest)) problems.push(`${page}: contest wiring "${contest}"`);
  }
  // Only same-origin scripts, styles, and images; the one allowed outside link is Instagram.
  for (const m of html.matchAll(/<(script|link|img)[^>]+(?:src|href)="(https?:\/\/[^"]+)"/g)) {
    if (!m[2]!.startsWith(SITE_URL)) problems.push(`${page}: <${m[1]}> loads ${m[2]}`);
  }
}

if (problems.length) {
  console.error(`check-site: ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("check-site: OK");
