import { test, expect, type Page } from "@playwright/test";

import { setStoredTheme, type Scheme } from "./support/theme";
import { gotoWeldingPage } from "./support/wait";

const PAGES = [1, 4, 19, 42];
const SCHEMES: Scheme[] = ["dark", "light"];
const MOBILE_PROJECTS = ["mobile-360", "mobile-375"];
const OVERFLOW_TOLERANCE_PX = 1;
const MIN_TOUCH_TARGET_PX = 44;

async function getDocumentOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/**
 * Full-page scan for any visible element whose right edge extends past the
 * viewport's clientWidth. Elements clipped/scrolled by an ancestor (any
 * ancestor whose computed overflow-x isn't "visible" — e.g. .table-scroll's
 * overflow-x: auto) are skipped: their content legitimately extends past the
 * viewport, but the ancestor contains it, so it never causes page-level
 * horizontal scroll. Returns up to `max` human-readable offender descriptions.
 */
async function findOffscreenElements(page: Page, max = 10): Promise<string[]> {
  return page.evaluate((maxOffenders) => {
    function isVisible(el: Element): boolean {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    function isClippedByAncestor(el: Element): boolean {
      let node = el.parentElement;
      while (node && node !== document.documentElement) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === "hidden" || overflowX === "auto" || overflowX === "scroll" || overflowX === "clip") {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    }
    const clientWidth = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      if (offenders.length >= maxOffenders) break;
      if (!isVisible(el)) continue;
      if (isClippedByAncestor(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > clientWidth + 1) {
        const id = el.id ? `#${el.id}` : "";
        const className = typeof el.className === "string" ? el.className.trim() : "";
        const cls = className ? `.${className.split(/\s+/).join(".")}` : "";
        offenders.push(
          `${el.tagName.toLowerCase()}${id}${cls} (right=${Math.round(rect.right)}px, clientWidth=${clientWidth}px)`,
        );
      }
    }
    return offenders;
  }, max);
}

for (const pageNum of PAGES) {
  for (const scheme of SCHEMES) {
    test.describe(`page ${pageNum} — ${scheme}`, () => {
      test.beforeEach(async ({ page }) => {
        await setStoredTheme(page, scheme);
        await gotoWeldingPage(page, pageNum);
        await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      });

      test("no horizontal page overflow at load or after scrolling to bottom", async ({ page }) => {
        const afterLoad = await getDocumentOverflow(page);
        expect(
          afterLoad.scrollWidth - afterLoad.clientWidth,
          `overflow at load: scrollWidth=${afterLoad.scrollWidth} clientWidth=${afterLoad.clientWidth}`,
        ).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const afterScroll = await getDocumentOverflow(page);
        expect(
          afterScroll.scrollWidth - afterScroll.clientWidth,
          `overflow after scrolling to bottom: scrollWidth=${afterScroll.scrollWidth} clientWidth=${afterScroll.clientWidth}`,
        ).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
      });

      test("wide tables stay contained inside their .table-scroll wrapper", async ({ page }) => {
        const wrappers = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>(".table-scroll")).map((el, i) => ({
            index: i,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          })),
        );
        const wideWrappers = wrappers.filter((w) => w.scrollWidth > w.clientWidth);

        // Whether or not a table is actually wider than its wrapper on this
        // viewport, the page as a whole must never overflow because of it —
        // the wrapper's own overflow-x: auto should contain it.
        const overflow = await getDocumentOverflow(page);
        expect(
          overflow.scrollWidth - overflow.clientWidth,
          `page overflow with ${wideWrappers.length} wide .table-scroll wrapper(s): ${JSON.stringify(wideWrappers)}`,
        ).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
      });

      test("no element extends past the viewport width", async ({ page }) => {
        const offenders = await findOffscreenElements(page);
        expect(offenders, `elements extending past clientWidth:\n${offenders.join("\n")}`).toEqual([]);
      });

      test("header controls meet the 44x44 touch target minimum", async ({ page }, testInfo) => {
        test.skip(
          !MOBILE_PROJECTS.includes(testInfo.project.name),
          "touch target size is only asserted on mobile projects",
        );

        const header = page.locator("header.header");
        await expect(header).toBeVisible();

        // "Controls" = every interactive element in the sticky header and the
        // page-nav bar directly beneath it: theme/mood toggle buttons, and the
        // prev/next buttons + page-jump select.
        const controls = page.locator("header.header .header-btn, .nav-controls .nav-btn, #page-select");
        const count = await controls.count();
        expect(count, "expected header/nav controls to be present on the page").toBeGreaterThan(0);

        const failures: string[] = [];
        for (let i = 0; i < count; i++) {
          const control = controls.nth(i);
          const box = await control.boundingBox();
          const label =
            (await control.getAttribute("aria-label")) ?? (await control.getAttribute("id")) ?? `control #${i}`;
          if (!box) {
            failures.push(`${label}: no bounding box (not visible/rendered)`);
            continue;
          }
          if (box.width < MIN_TOUCH_TARGET_PX || box.height < MIN_TOUCH_TARGET_PX) {
            failures.push(
              `${label}: ${Math.round(box.width)}x${Math.round(box.height)}px (needs >= ${MIN_TOUCH_TARGET_PX}x${MIN_TOUCH_TARGET_PX})`,
            );
          }
        }
        expect(failures, failures.join("\n")).toEqual([]);
      });
    });
  }
}
