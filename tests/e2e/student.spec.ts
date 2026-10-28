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
