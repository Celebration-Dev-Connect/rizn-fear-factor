import { expect, test } from "@playwright/test";
import { addEntry, advance, crewApi, findPassId } from "./helpers";

test.describe.configure({ mode: "serial" });

test("scan → pass → vote in under 60 s, and no second vote after reload or back", async ({ page }) => {
  const crew = await crewApi();
  try {
    const other = await addEntry(crew);
    const started = Date.now();

    await page.goto("/");
    await expect(page.getByText("Your nickname tonight")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "REHEARSAL" })).toBeVisible();
    const passLabel = await page.getByRole("region", { name: /Night Pass/ }).getAttribute("aria-label");
    const number = Number(/#(\d+)/.exec(passLabel ?? "")![1]);

    // The student's own costume is entered too, so self-voting can be checked.
    const own = await addEntry(crew, await findPassId(crew, number));
    await advance(crew); // voting_open

    await page.getByRole("link", { name: /Costume Contest/ }).click();
    await expect(page.getByText("Vote now!")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: new RegExp(`${own.displayName} — your own costume`) })).toBeDisabled();

    await page.getByRole("button", { name: `Vote for ${other.displayName}` }).click();
    await page.getByRole("button", { name: "Cast my vote" }).click();
    await expect(page.getByRole("heading", { name: "Thanks for voting!" })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(60_000);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Thanks for voting!" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Vote for/ })).toHaveCount(0);

    await page.goBack();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Thanks for voting!" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Vote for/ })).toHaveCount(0);
  } finally {
    await crew.cleanup();
  }
});

test("a student can change their vote while voting is open, and not after it closes (spec 002 US1)", async ({ page }) => {
  const crew = await crewApi();
  try {
    const first = await addEntry(crew);
    const second = await addEntry(crew);
    await advance(crew); // voting_open

    await page.goto("/");
    await expect(page.getByText("Your nickname tonight")).toBeVisible();
    await page.getByRole("link", { name: /Costume Contest/ }).click();
    await expect(page.getByText("Vote now!")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: `Vote for ${first.displayName}` }).click();
    await page.getByRole("button", { name: "Cast my vote" }).click();
    await expect(page.getByRole("heading", { name: "Thanks for voting!" })).toBeVisible();

    const started = Date.now();
    await page.getByRole("button", { name: "Change my vote" }).click();
    await page.getByRole("button", { name: `Vote for ${second.displayName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Change your vote?" });
    await expect(dialog.getByText("From")).toBeVisible();
    await dialog.getByRole("button", { name: "Change my vote" }).click();
    await expect(page.getByRole("heading", { name: "Thanks for voting!" })).toBeVisible();
    await expect(page.locator("section.card").getByText(second.displayName)).toBeVisible();
    expect(Date.now() - started).toBeLessThan(15_000); // SC-101

    await advance(crew); // voting_closed
    await expect(page.getByRole("button", { name: "Change my vote" })).toHaveCount(0, { timeout: 5_000 });
  } finally {
    await crew.cleanup();
  }
});

test("the pass flips to a QR code that crew can scan, even offline, and stays bound to the device (spec 002 US6)", async ({ page, context }) => {
  const crew = await crewApi();
  try {
    await page.goto("/");
    await expect(page.getByText("Your nickname tonight")).toBeVisible();
    const region = page.getByRole("region", { name: /Night Pass/ });
    const label = await region.getAttribute("aria-label");
    const number = Number(/#(\d+)/.exec(label ?? "")![1]);

    // Before the flip the back face is aria-hidden, so find the image by its alt text directly.
    const qr = page.locator('img[alt="QR code for crew to scan"]');
    await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    await page.getByRole("button", { name: "Show my pass code" }).click();
    await expect(page.getByRole("button", { name: "Show my pass" })).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(600); // let the flip finish before the screenshot

    // Decode the code from the screen, as a crew phone camera would, and resolve it as crew.
    const { default: jsQR } = await import("jsqr");
    const sharp = (await import("sharp")).default;
    const shot = await qr.screenshot();
    const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    expect(decoded?.data).toMatch(/^NP1\.R\.\d+\.[A-Z2-7]{12}$/);
    const scan = await crew.get(`/api/crew/passes/scan?code=${encodeURIComponent(decoded!.data)}`);
    expect(scan.status()).toBe(200);
    expect((await scan.json()).pass.number).toBe(number);

    // Offline: the flip still works and the code is still there.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Show my pass" }).click();
    await page.getByRole("button", { name: "Show my pass code" }).click();
    await expect(qr).toBeVisible();
    expect(await qr.evaluate((img: HTMLImageElement) => img.naturalWidth > 0)).toBe(true);
    await context.setOffline(false);

    // Page storage can't change which pass is shown (FR-128).
    await page.evaluate(() => {
      localStorage.setItem("pass", JSON.stringify({ number: 9999, nickname: "Hacked" }));
      sessionStorage.setItem("pass", "9999");
    });
    await page.reload();
    await expect(page.getByRole("region", { name: /Night Pass/ })).toHaveAttribute("aria-label", label!);
  } finally {
    await crew.cleanup();
  }
});

test("the pass flip is a plain swap under reduced motion (FR-123)", async ({ browser }) => {
  const crew = await crewApi();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  try {
    await page.goto("/");
    await expect(page.getByText("Your nickname tonight")).toBeVisible();
    await page.getByRole("button", { name: "Show my pass code" }).click();
    const running = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getTiming().duration as number) > 1).length,
    );
    expect(running).toBe(0);
    await expect(page.getByRole("img", { name: "QR code for crew to scan" })).toBeVisible();
  } finally {
    await ctx.close();
    await crew.cleanup();
  }
});
