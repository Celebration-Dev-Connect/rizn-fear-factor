import { defineConfig, devices } from "@playwright/test";

const SITE = "http://localhost:4100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // Every test drives the one shared server and rehearsal contest, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" },
  // The off-season static site (spec 004) is served from its build output; run `npm run site:build` first.
  webServer: {
    command: "npx --yes serve site/out -l 4100 --no-clipboard",
    url: SITE,
    reuseExistingServer: true,
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] }, testIgnore: /site\.spec\.ts/ },
    { name: "pixel", use: { ...devices["Pixel 7"] }, testIgnore: /site\.spec\.ts/ },
    { name: "site", use: { ...devices["iPhone 15"], baseURL: SITE }, testMatch: /site\.spec\.ts/ },
  ],
});
