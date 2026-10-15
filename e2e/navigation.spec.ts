import { test, expect } from "@playwright/test";

import { WELDING_PAGE_TITLES, WELDING_TOTAL_PAGES } from "@/lib/welding-pages";
import { gotoWeldingPage, waitForPage } from "./support/wait";

// Interaction behavior doesn't vary by viewport width; one desktop and one
// mobile project is enough coverage without tripling the runtime.
const ALLOWED_PROJECTS = ["desktop-1280", "mobile-375"];

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !ALLOWED_PROJECTS.includes(testInfo.project.name),
    "navigation spec only runs on desktop-1280 and mobile-375",
  );
});

test.describe("page navigation", () => {
  // Pages 3..8 are other reports (Flange, Welder Performance, Errors); the welding
  // pages proper resume at 9.
  test("prev/next buttons change the URL and the page title", async ({ page }) => {
    await gotoWeldingPage(page, 10);

    await page.getByRole("link", { name: "Next page" }).click();
    await waitForPage(page, 11);
    await expect(page).toHaveURL(/\/welding\/11$/);
    await expect(page).toHaveTitle(new RegExp(escapeRegExp(WELDING_PAGE_TITLES[10])));

    await page.getByRole("link", { name: "Previous page" }).click();
    await waitForPage(page, 10);
    await page.getByRole("link", { name: "Previous page" }).click();
    await waitForPage(page, 9);
    await expect(page).toHaveURL(/\/welding\/9$/);
    await expect(page).toHaveTitle(new RegExp(escapeRegExp(WELDING_PAGE_TITLES[8])));
  });

  test("the linked reports sit in the reading order (2 -> Flange, Errors -> 9)", async ({ page }) => {
    await gotoWeldingPage(page, 2);
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/\/flange$/);
    await expect(page.locator(".page-indicator")).toHaveText(`Page 3 / ${WELDING_TOTAL_PAGES}`);
    await page.goto("/errors");
    await expect(page.locator(".page-indicator")).toHaveText(`Page 8 / ${WELDING_TOTAL_PAGES}`);
    await page.getByRole("link", { name: "Next page" }).click();
    await waitForPage(page, 9);
    await expect(page).toHaveURL(/\/welding\/9$/);
  });

  test("the page-jump select navigates to page 20", async ({ page }) => {
    await gotoWeldingPage(page, 1);
    await page.locator("#page-select").selectOption("20");
    await waitForPage(page, 20);
    await expect(page).toHaveURL(/\/welding\/20$/);
  });

  test("keyboard ArrowRight navigates to the next page", async ({ page }) => {
    await gotoWeldingPage(page, 10);
    // Move focus off the select/inputs first so the arrow key reaches the
    // document-level keydown handler in ReportShell rather than being
    // consumed by a focused form control.
    await page.locator("#page-heading").click();
    await page.keyboard.press("ArrowRight");
    await waitForPage(page, 11);
    await expect(page).toHaveURL(/\/welding\/11$/);
  });

  test("the page after the last renders the 404 page", async ({ page }) => {
    const response = await page.goto(`/welding/${WELDING_TOTAL_PAGES + 1}`);
    expect(response?.status()).toBe(404);
    await expect(page.locator("h2")).toHaveText("Page not found");
    await expect(page.getByRole("link", { name: "Go to page 1" })).toBeVisible();
  });
});

test.describe("theme + mood controls", () => {
  test("theme toggle flips data-theme and persists across reload", async ({ page }) => {
    await gotoWeldingPage(page, 1);
    const html = page.locator("html");
    const before = (await html.getAttribute("data-theme")) === "light" ? "light" : "dark";
    const expectedAfter = before === "dark" ? "light" : "dark";

    // Structural selector rather than an aria-label/name match: ThemeMoodControls
    // renders the theme toggle as the header-right's second direct child (a
    // .header-btn sibling of the .mood-toggle-wrapper), independent of whatever
    // its accessible name currently says ("Switch to light theme" vs "...scheme").
    await page.locator(".header-right > button.header-btn").click();
    await expect(html).toHaveAttribute("data-theme", expectedAfter);

    await page.reload();
    await waitForPage(page, 1);
    await expect(html).toHaveAttribute("data-theme", expectedAfter);
  });

  test("choosing a mood in the dropdown sets data-mood and persists", async ({ page }) => {
    await gotoWeldingPage(page, 1);
    const html = page.locator("html");
    const before = await html.getAttribute("data-mood");

    await page.locator(".mood-toggle-wrapper > button.header-btn").click();
    // The dropdown also lists density options under the same .mood-option class;
    // only mood options render a .mood-option-colors swatch, so scope to those.
    const nonActiveOption = page.locator(".mood-option:has(.mood-option-colors):not(.active)").first();
    await expect(nonActiveOption).toBeVisible();
    await nonActiveOption.click();

    await expect(html).not.toHaveAttribute("data-mood", before ?? "");
    const after = await html.getAttribute("data-mood");
    expect(after, "expected data-mood to be set after choosing an option").toBeTruthy();

    await page.reload();
    await waitForPage(page, 1);
    await expect(html).toHaveAttribute("data-mood", after as string);
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
