import { expect, type Page } from "@playwright/test";

import { WELDING_TOTAL_PAGES } from "@/lib/welding-pages";

/**
 * Navigate to /welding/[n] and wait for a stable, meaningful signal that the
 * page has actually rendered its data — not just "the document loaded".
 *
 * `waitUntil: 'networkidle'` is unreliable against `next dev` (HMR keeps a
 * websocket open, so the network is never idle), and pages 1 and 4 come from
 * Postgres and can take 1-3s. So: navigate with `domcontentloaded`, then wait
 * for the shell's page indicator ("Page N / 44") and a non-empty page heading.
 *
 * The heading text is deliberately NOT compared to lib/welding-pages.ts: the
 * mockup's nav titles and its on-page h2 differ on pages 41-44 ("Weld Rejection
 * Detail - GAC" vs "Weld Rejection Detail as per WPS - GAC"), and both are
 * reproduced faithfully by the app.
 */
export async function gotoWeldingPage(page: Page, n: number): Promise<void> {
  await page.goto(`/welding/${n}`, { waitUntil: "domcontentloaded" });
  await waitForPage(page, n);
}

/** Wait for the shell to show page `n` after an in-page navigation (no goto). */
export async function waitForPage(page: Page, n: number): Promise<void> {
  await expect(page.locator(".page-indicator")).toHaveText(`Page ${n} / ${WELDING_TOTAL_PAGES}`, {
    timeout: 15_000,
  });
  await expect(page.locator("#page-heading")).not.toHaveText("", { timeout: 15_000 });
}
