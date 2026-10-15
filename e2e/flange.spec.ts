import { test, expect, type Page } from "@playwright/test";

import { WELDING_TOTAL_PAGES } from "@/lib/welding-pages";

import { setStoredTheme, type Scheme } from "./support/theme";
import { gotoWeldingPage } from "./support/wait";

/**
 * /flange — the single-page, filter-driven flange dashboard (ruling RF-08).
 * Layout assertions run on every project; interaction tests on one desktop and
 * one mobile project (behaviour does not vary by width).
 */
const INTERACTION_PROJECTS = ["desktop-1280", "mobile-360", "mobile-375"];
const OVERFLOW_TOLERANCE_PX = 1;

async function gotoFlange(page: Page, query = ""): Promise<void> {
  await page.goto(`/flange${query}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#page-heading")).toHaveText(/Flange/, { timeout: 15_000 });
  await expect(page.locator(".stat-box, .pbi-card").first()).toBeVisible({ timeout: 15_000 });
}

async function documentOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const scheme of ["dark", "light"] as Scheme[]) {
  test.describe(`flange layout — ${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await setStoredTheme(page, scheme);
      await gotoFlange(page);
    });

    test("renders the filters, KPI tiles, tables and charts without horizontal overflow", async ({ page }) => {
      await expect(page.getByRole("group", { name: "Report filters" })).toBeVisible();
      // the three slicers; the saved-views button (2026-10-15) is not one
      await expect(page.locator(".filter-select:not(.fviews-btn)")).toHaveCount(3);
      expect(await page.locator(".stat-box, .pbi-card").count()).toBeGreaterThanOrEqual(7);
      expect(await page.locator(".data-table").count()).toBeGreaterThanOrEqual(3);
      expect(await documentOverflow(page)).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      expect(await documentOverflow(page)).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
    });

    // Flange is page 3 of the reading order (owner request 2026-10-15), so the
    // shared page nav shows it there.
    test("the flange report is page 3 of the page nav", async ({ page }) => {
      await expect(page.locator(".page-indicator")).toHaveText(`Page 3 / ${WELDING_TOTAL_PAGES}`);
      await expect(page.locator("#page-select")).toHaveAttribute("data-value", "3");
      await expect(page.getByRole("link", { name: "Flange" })).toHaveAttribute("aria-current", "page");
    });
  });
}

test.describe("flange interaction", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!INTERACTION_PROJECTS.includes(testInfo.project.name), "interaction spec runs on desktop-1280 and the mobile projects");
  });

  test("changing a filter updates the URL and re-renders with the applied value", async ({ page }) => {
    await gotoFlange(page);
    const ha = page.locator("select[name='ha']");
    await ha.selectOption("HA1");
    await expect(page).toHaveURL(/\/flange\?ha=HA1$/);
    await expect(page.locator("select[name='ha']")).toHaveValue("HA1");
    await expect(page.locator("[aria-live='polite']")).toContainText("HA1");
    await expect(page.locator("#page-heading")).toHaveText(/Flange/);
    expect(await page.locator(".stat-box, .pbi-card").count()).toBeGreaterThanOrEqual(7);

    await page.locator("select[name='subco']").selectOption("GAC");
    await expect(page).toHaveURL(/\/flange\?ha=HA1&subco=GAC$/);
    await expect(page.locator("[aria-live='polite']")).toContainText("GAC");

    await page.getByRole("link", { name: "Reset all filters" }).click();
    await expect(page).toHaveURL(/\/flange$/);
    await expect(page.locator("select[name='ha']")).toHaveValue("All");
  });

  test("filter controls clear the 44 px touch target", async ({ page }) => {
    await gotoFlange(page);
    for (const box of await page.locator(".filter-select").all()) {
      const rect = await box.boundingBox();
      expect(rect?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("the report switcher navigates both ways", async ({ page }) => {
    await gotoWeldingPage(page, 1);
    await expect(page.getByRole("link", { name: "Welding" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Flange" }).click();
    await expect(page).toHaveURL(/\/flange$/);
    await expect(page.locator("#page-heading")).toHaveText(/Flange/);
    await expect(page.getByRole("link", { name: "Flange" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Welding" }).click();
    await expect(page).toHaveURL(/\/welding\/1$/);
    await expect(page.locator(".page-indicator")).toHaveText(/Page 1 \//);
  });
});
