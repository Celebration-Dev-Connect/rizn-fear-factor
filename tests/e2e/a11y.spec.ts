import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addEntry, advance, crewApi } from "./helpers";

test.describe.configure({ mode: "serial" });

async function checkPage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  // 44×44 minimum tap targets for every visible button and link.
  const small = await page.$$eval("button, a, [role=button], label.button", (els) =>
    els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        // Skip the Next.js dev-tools badge, which lives in a shadow root and only exists in dev.
        if (el.getRootNode() !== document) return false;
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && !el.closest(".visually-hidden") && !(el as HTMLElement).closest("p");
      })
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 40), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
      .filter((s) => s.w < 44 || s.h < 44),
  );
  expect(small).toEqual([]);
}

test("student, crew, and screen pages meet WCAG AA and 44 px targets", async ({ page, context }) => {
  const crew = await crewApi();
  try {
    await addEntry(crew);
    await checkPage(page, "/");
    await checkPage(page, "/contest");
    await checkPage(page, "/crew"); // sign-in screen
    const cookies = (await crew.storageState()).cookies;
    await context.addCookies(cookies);
    await checkPage(page, "/crew");
    await checkPage(page, "/crew/entries");
    await page.goto(`/screen?t=${process.env.SCREEN_TOKEN ?? "dev-screen-token-1234"}`);
    await checkPage(page, "/screen");
  } finally {
    await crew.cleanup();
  }
});

test("the reveal runs no animations under reduced motion", async ({ browser }) => {
  const crew = await crewApi();
  try {
    const entry = await addEntry(crew);
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByText("Your nickname tonight")).toBeVisible();
    await advance(crew); // voting_open
    await page.goto("/contest");
    await page.getByRole("button", { name: `Vote for ${entry.displayName}` }).click();
    await page.getByRole("button", { name: "Cast my vote" }).click();
    await advance(crew, 3); // closed → revealed → reveal 1st (only place)
    await expect(page.getByRole("heading", { name: /1st Place/ })).toBeVisible({ timeout: 10_000 });
    const running = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getTiming().duration as number) > 1).length,
    );
    expect(running).toBe(0);
    await ctx.close();
  } finally {
    await crew.cleanup();
  }
});

test("brand look: AA on the changeable vote and countdown screens, same-origin only, small images (spec 002 US4)", async ({ page, context }) => {
  const crew = await crewApi();
  try {
    const a = await addEntry(crew);
    await addEntry(crew);
    const origins = new Set<string>();
    const brandBytes = new Map<string, number>();
    page.on("request", (r) => origins.add(new URL(r.url()).origin));
    page.on("response", async (r) => {
      const url = new URL(r.url());
      if (url.pathname.startsWith("/brand/")) brandBytes.set(url.pathname, (await r.body().catch(() => Buffer.alloc(0))).length);
    });

    // SC-107: brand images on a fresh Night Pass stay within 250 KB.
    await page.goto("/");
    await expect(page.getByText("Your nickname tonight")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const passBytes = [...brandBytes.values()].reduce((s, n) => s + n, 0);
    expect(passBytes).toBeGreaterThan(0);
    expect(passBytes).toBeLessThanOrEqual(256_000);

    // Decorative stickers are hidden from assistive tech; logos have alt text.
    expect(await page.locator("[class*=sticker]").evaluateAll((els) => els.every((el) => el.closest("[aria-hidden=true]")))).toBe(true);
    await expect(page.getByRole("img", { name: "RIZN Fear Factor" }).first()).toBeVisible();

    await advance(crew); // voting_open
    await crew.put("/api/crew/voting-close", {
      headers: { "Idempotency-Key": crypto.randomUUID() },
      data: { at: new Date(Date.now() + 30 * 60_000).toISOString() },
    });
    await page.goto("/contest");
    await page.getByRole("button", { name: `Vote for ${a.displayName}` }).click();
    await page.getByRole("button", { name: "Cast my vote" }).click();
    await expect(page.getByRole("button", { name: "Change my vote" })).toBeVisible();
    await checkPage(page, "/contest"); // thank-you state with "Change my vote"

    await context.addCookies((await crew.storageState()).cookies);
    await page.goto(`/screen?t=${process.env.SCREEN_TOKEN ?? "dev-screen-token-1234"}`);
    await expect(page.getByText("Voting closes in")).toBeVisible({ timeout: 10_000 });
    await checkPage(page, "/screen");

    expect([...origins].filter((o) => o !== new URL(page.url()).origin)).toEqual([]);
  } finally {
    await crew.cleanup();
  }
});

test("stickers stay still under reduced motion (FR-119)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const crew = await crewApi();
  try {
    await page.goto("/");
    await expect(page.getByText("Your nickname tonight")).toBeVisible();
    const running = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getTiming().duration as number) > 1).length,
    );
    expect(running).toBe(0);
  } finally {
    await crew.cleanup();
    await ctx.close();
  }
});
