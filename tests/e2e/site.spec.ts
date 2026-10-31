import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Off-season static site (spec 004), served from site/out. Run `npm run site:build` first.

test("VANAGEDDON shows before it happens (FR-306)", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-06T20:00:00-07:00"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "VANAGEDDON" })).toBeVisible();
  await expect(page.getByRole("img", { name: /minivan/ })).toBeVisible();
});

test("VANAGEDDON hides itself afterwards, and the rest of the page stays (FR-306, SC-304)", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-07T08:00:00-07:00"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Every Friday at RIZN" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "VANAGEDDON" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Follow @riznyouth on Instagram" })).toHaveAttribute("href", "https://www.instagram.com/riznyouth/");
  await expect(page.getByRole("heading", { name: "Fear Factor will be back" })).toBeVisible();
});

test("meets WCAG AA, loads only same-origin resources, and sets no cookies (FR-304, FR-305)", async ({ page, context }) => {
  const origins = new Set<string>();
  page.on("request", (r) => origins.add(new URL(r.url()).origin));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  expect([...origins].filter((o) => o !== new URL(page.url()).origin)).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://fearfactor.riznyouth.com/brand/og-image.jpg");
});
