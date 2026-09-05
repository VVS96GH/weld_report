import { defineConfig, devices } from "@playwright/test";

/**
 * E2E layout/navigation matrix for the welding report dashboard.
 *
 * Runs against a server that is ALREADY running by default (E2E_BASE_URL,
 * default http://localhost:3000 — typically `next dev`). Set E2E_START_SERVER=1
 * to have Playwright build+launch `next start` itself instead (useful in CI, or
 * any time nothing is already listening on the target port).
 *
 * Chromium browsers install to PLAYWRIGHT_BROWSERS_PATH when that env var is
 * set; if it's unset, Playwright falls back to its default cache location
 * (~/.cache/ms-playwright or %USERPROFILE%\AppData\Local\ms-playwright), which
 * works fine as long as `npx playwright install chromium` has been run there.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer:
    process.env.E2E_START_SERVER === "1"
      ? {
          command: "npm run start -- -p 3000",
          url: baseURL,
          reuseExistingServer: true,
        }
      : undefined,
  projects: [
    {
      name: "mobile-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 } },
    },
    {
      name: "mobile-375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "wide-1536",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1536, height: 960 } },
    },
  ],
});
