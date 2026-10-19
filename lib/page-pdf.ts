/**
 * The header's PDF button (owner, 2026-10-19): the server opens the page the user
 * is on — same path, filters, theme, mood and density — in a headless Chromium
 * at 1920 px wide and prints it as ONE tall PDF page, exactly as on screen.
 * The screen chrome (zoom bar, filter tab, header buttons) is hidden.
 */
import { randomUUID } from "node:crypto";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { chromium, type Browser } from "playwright";

import { DENSITY_KEY, MOOD_KEY, THEME_KEY } from "@/lib/theme/axes";

let browser: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = chromium.launch().catch((e) => {
      browser = null;
      throw e;
    });
  }
  return browser;
}

export type PdfOpts = { path: string; theme?: string; mood?: string; density?: string };

const HIDE = `
  .zoom-bar, .fdrawer-tab, .fdrawer, .fdrawer-scrim, .header-right, .page-nav,
  .section-actions, .rs-cum-actions, .dg-fields-tab, .fviews, .card-header--actions .section-actions { display: none !important; }
  .main-content { zoom: 1 !important; }
`;

export async function pagePdf(o: PdfOpts): Promise<{ pdf: Buffer; title: string }> {
  const port = process.env.PORT ?? "3000";
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  try {
    await ctx.addInitScript(
      ([tk, mk, dk, t, m, d]) => {
        try {
          if (t) localStorage.setItem(tk, t);
          if (m) localStorage.setItem(mk, m);
          if (d) localStorage.setItem(dk, d);
          localStorage.setItem("page-zoom", "100");
        } catch {
          /* no storage */
        }
      },
      [THEME_KEY, MOOD_KEY, DENSITY_KEY, o.theme ?? "", o.mood ?? "", o.density ?? ""],
    );
    const page = await ctx.newPage();
    // "load", then a short wait for the data requests to settle: a page that keeps
    // polling (Screens) never reaches network-idle and must not hang the print
    await page.goto(`http://127.0.0.1:${port}${o.path}`, { waitUntil: "load", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.evaluate(
      ([t, m, d]) => {
        const h = document.documentElement;
        if (t) h.setAttribute("data-theme", t);
        if (m) h.setAttribute("data-mood", m);
        if (d) h.setAttribute("data-density", d);
      },
      [o.theme ?? "", o.mood ?? "", o.density ?? ""],
    );
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(1500); // the charts finish their entry animation
    await page.emulateMedia({ media: "screen" });
    const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    const title = (await page.title()).replace(/\s+—\s+Welding Statistics Dashboard$/, "");
    const pdf = await page.pdf({
      width: "1920px",
      height: `${height + 2}px`,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      pageRanges: "1",
    });
    return { pdf: Buffer.from(pdf), title };
  } finally {
    await ctx.close();
  }
}

// ── the whole report: chosen pages, one PDF page each, merged in order ──────

type Job = { total: number; done: number; error: string | null; pdf: Buffer | null; started: number; name: string };
const jobs = new Map<string, Job>();
const JOB_TTL = 30 * 60_000;

/** Start printing `paths` in order; poll with reportJob(id). */
export function startReport(paths: string[], o: Omit<PdfOpts, "path">): string {
  for (const [k, j] of jobs) if (Date.now() - j.started > JOB_TTL) jobs.delete(k);
  const id = randomUUID();
  const job: Job = { total: paths.length, done: 0, error: null, pdf: null, started: Date.now(), name: "" };
  jobs.set(id, job);
  void (async () => {
    try {
      const parts: Buffer[] = new Array(paths.length);
      let next = 0;
      // three pages at a time: the site stays responsive for everyone else
      const worker = async () => {
        while (next < paths.length) {
          const i = next++;
          // one retry; a page that still fails gets a notice sheet, the report goes on
          let pdf: Buffer | null = null;
          for (let attempt = 0; attempt < 2 && !pdf; attempt++) {
            try {
              pdf = (await pagePdf({ ...o, path: paths[i]! })).pdf;
            } catch (e) {
              if (attempt === 1) pdf = await noticePage(paths[i]!, e instanceof Error ? e.message : String(e));
            }
          }
          parts[i] = pdf!;
          job.done += 1;
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      const out = await PDFDocument.create();
      for (const b of parts) {
        const src = await PDFDocument.load(b);
        for (const pg of await out.copyPages(src, src.getPageIndices())) out.addPage(pg);
      }
      out.setTitle("Welding Statistics Dashboard");
      job.pdf = Buffer.from(await out.save());
      job.name = `Welding Statistics report - ${new Date().toISOString().slice(0, 10)}.pdf`;
    } catch (e) {
      job.error = e instanceof Error ? e.message : String(e);
    }
  })();
  return id;
}

export function reportJob(id: string): Job | undefined {
  return jobs.get(id);
}

/** A sheet saying a page could not be printed (Latin text: the standard PDF font). */
async function noticePage(path: string, err: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const pg = doc.addPage([1920, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  pg.drawText(`Page ${path} could not be printed.`, { x: 60, y: 300, size: 32, font, color: rgb(0.7, 0.1, 0.1) });
  pg.drawText(err.replace(/[^\x20-\x7e]/g, " ").slice(0, 160), { x: 60, y: 240, size: 16, font, color: rgb(0.3, 0.3, 0.3) });
  return Buffer.from(await doc.save());
}
