/**
 * Export the whole report to one PDF: the welding pages in display order
 * (page 2 = RT Backlog Forecast) followed by the flange dashboard (with the
 * management matrix), one PDF page per report page, light theme, header nav
 * and chart scrollbars hidden.
 *
 *   npm run export:pdf                      # against http://localhost:3000
 *   BASE_URL=http://host:3000 OUT=out.pdf npm run export:pdf
 *
 * Needs the dev or production server running and Playwright's Chromium
 * (PLAYWRIGHT_BROWSERS_PATH as for the e2e suite). Chromium occasionally
 * paginates a tall page despite the explicit height, so each page is rendered
 * again 35 % taller until it fits on one sheet. Merged with pdf-lib; bookmarks
 * are not written (pdf-lib has no outline API) — page N of the PDF is report
 * page N, and page 46 is the flange dashboard.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "Weld Progress Report.pdf";
const WELDING_PAGES = Number(process.env.WELDING_PAGES ?? 45);

const HIDE_CSS =
  ".header{position:static!important}.page-nav{position:static!important}" +
  ".nav-controls,.report-switcher,.header-right,.chart-window-bar{display:none!important}";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "weld-pdf-"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("weld-report-theme", "light");
  } catch {
    /* private mode */
  }
});
const page = await ctx.newPage();

const targets = [];
for (let n = 1; n <= WELDING_PAGES; n++) targets.push(`/welding/${n}`);
targets.push("/flange");

const merged = await PDFDocument.create();
for (const [i, url] of targets.entries()) {
  await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 180_000 });
  await page.waitForTimeout(1800);
  await page.addStyleTag({ content: HIDE_CSS });
  await page.waitForTimeout(200);
  let height = (await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))) + 80;
  const file = path.join(tmp, `${String(i + 1).padStart(2, "0")}.pdf`);
  let doc;
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.pdf({ path: file, width: "1400px", height: `${height}px`, printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    doc = await PDFDocument.load(fs.readFileSync(file));
    if (doc.getPageCount() === 1) break;
    height = Math.round(height * 1.35);
  }
  const [copied] = await merged.copyPages(doc, [0]);
  merged.addPage(copied);
  process.stdout.write(`${url} `);
}
merged.setTitle("Weld Progress Report");
fs.writeFileSync(OUT, await merged.save());
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${merged.getPageCount()} pages -> ${OUT}`);
