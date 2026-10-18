/**
 * Static page-title list for the welding report shell (nav select, page indicator).
 *
 * Copied from `analysis/mockups/welding-spec.json` -> `global.pageTitles` /
 * `global.report_subtitle`. Kept as a plain literal (no `fs` import) so it can be
 * imported from Client Components such as components/ReportShell.tsx.
 *
 * If the underlying report structure changes, regenerate this list from the spec:
 *   node -e "console.log(JSON.stringify(require('./analysis/mockups/welding-spec.json').global.pageTitles))"
 */
import { WP_NAV } from "@/lib/welder-perf-nav";

export const WELDING_DATA_PAGE_TITLES: readonly string[] = [
  "Welding Progress (Project)",
  "Project Welding & NDE Status",
  "CCC WELDING STATUS",
  "GAC WELDING STATUS (Except SLG Service)",
  "TEKFEN WELDING STATUS",
  "MEDGULF WELDING STATUS",
  // the chart pages say so (owner, 2026-10-15): the table pages above share the names
  "CCC WELDING STATUS Graph",
  "GAC WELDING STATUS Graph (Other than Slug Catcher)",
  "GAC WELDING STATUS Graph (Slug Catcher Area)",
  "TEKFEN WELDING STATUS Graph",
  "MEDGULF WELDING STATUS Graph",
  "CCC NDE RT 100% STATUS",
  "CCC PWHT STATUS by RT 100%",
  "CCC RT 5% STATUS",
  "CCC PWHT STATUS by RT 5%",
  "CCC RT 10% STATUS",
  "CCC PWHT STATUS by RT 10%",
  "CCC NDE RT 20% STATUS",
  "GAC NDE RT 100%",
  "GAC PWHT STATUS by RT 100%",
  "GAC NDE RT 5%",
  "GAC PWHT STATUS by RT 5%",
  "GAC NDE RT 10%",
  "GAC PWHT STATUS by RT 10%",
  "GAC NDE RT 20%",
  "GAC NDE RT 30%",
  "TEKFEN NDE RT 100%",
  "TEKFEN PWHT STATUS by RT 100%",
  "TEKFEN NDE RT 5%",
  "TEKFEN PWHT STATUS by RT 5%",
  "TEKFEN NDE RT 10%",
  "TEKFEN PWHT STATUS by RT 10%",
  "TEKFEN NDE RT 20%",
  "MEDGULF NDE RT 100%",
  "MEDGULF PWHT STATUS by RT 100%",
  "MEDGULF NDE RT 5%",
  "MEDGULF PWHT STATUS by RT 5%",
  "MEDGULF NDE RT 10%",
  "MEDGULF PWHT STATUS by RT 10%",
  "MEDGULF NDE RT 20%",
  "Weld Rejection Detail - CCC",
  "Weld Rejection Detail - GAC",
  "Weld Rejection Detail - TEKFEN",
  "Weld Rejection Detail - MEDGULF",
];

/** Number of mockup (data) pages — the lib/pages/welding.ts contract. */
export const WELDING_DATA_PAGES = WELDING_DATA_PAGE_TITLES.length;

/**
 * The report as READ: the 44 mockup pages plus "RT Backlog Forecast" (pbix page 20)
 * inserted as page 2, so the PDF export and the page nav carry it there (owner
 * request 2026-09-08). Display numbers are 1-based positions in this order; data
 * numbers are the mockup's 1..44. Everything that renders or navigates uses display
 * numbers; lib/pages/welding.ts and lib/screens.ts keep data numbers.
 */
export type ReportEntry =
  | { kind: "data"; data: number; title: string; tmcp?: boolean }
  | { kind: "forecast"; title: string }
  /** Another report placed in the reading order: /welding/<n> sends there. */
  | { kind: "link"; title: string; href: string };

export const FORECAST_TITLE = "RT Backlog Forecast";
export const WPS_MATERIAL_TITLE = "WPS No / Type of Material";
export const TEKFEN_TMCP_TITLE = "TEKFEN WELDING STATUS Graph TMCP Pipe (9C3AQN 46 Inch)";
export const FORECAST_DISPLAY_PAGE = 2;

/**
 * The other reports, read as pages 3..8 (owner request 2026-10-15): Flange, the
 * four Welder Performance pages, Errors. Their own URLs stay; the page nav and
 * Prev/Next walk through them in this order.
 */
export const LINKED_FIRST_DISPLAY_PAGE = 3;
export const LINKED_PAGES: readonly { title: string; href: string }[] = [
  { title: "Flange Inspection Dashboard", href: "/flange" },
  ...WP_NAV.flatMap((g) => g.pages.map((p) => ({ title: p.label, href: `/welder-performance/${p.slug}` }))),
  { title: "Errors", href: "/errors" },
];

export const REPORT_ORDER: readonly ReportEntry[] = (() => {
  const entries: ReportEntry[] = WELDING_DATA_PAGE_TITLES.map((title, i) => ({ kind: "data", data: i + 1, title }));
  entries.splice(FORECAST_DISPLAY_PAGE - 1, 0, { kind: "forecast", title: FORECAST_TITLE });
  entries.splice(LINKED_FIRST_DISPLAY_PAGE - 1, 0, ...LINKED_PAGES.map((l) => ({ kind: "link" as const, ...l })));
  // Appended so no existing page number moves; the menu shows it after the
  // TEKFEN graph page (lib/page-order.ts MENU_AFTER). Owner, 2026-10-18.
  entries.push({ kind: "data", data: 10, tmcp: true, title: TEKFEN_TMCP_TITLE });
  // the WPS / Material page (owner, 2026-10-18), its own route like Errors
  entries.push({ kind: "link", title: WPS_MATERIAL_TITLE, href: "/wps-material" });
  return entries;
})();

/** Display titles, one per display page (the nav select, the page indicator, e2e). */
export const WELDING_PAGE_TITLES: readonly string[] = REPORT_ORDER.map((e) => e.title);

export const WELDING_TOTAL_PAGES = REPORT_ORDER.length;

/** Display page → report entry (undefined outside 1..WELDING_TOTAL_PAGES). */
export function reportEntry(display: number): ReportEntry | undefined {
  return Number.isInteger(display) ? REPORT_ORDER[display - 1] : undefined;
}

/** The display page of a linked report's URL ("/flange", "/errors", …), or null. */
export function displayForPath(pathname: string | null): number | null {
  if (!pathname) return null;
  const welding = /^\/welding\/(\d+)$/.exec(pathname);
  if (welding) return Number(welding[1]);
  const i = REPORT_ORDER.findIndex((e) => e.kind === "link" && (pathname === e.href || pathname.startsWith(`${e.href}/`)));
  return i < 0 ? null : i + 1;
}

/** Where display page n lives: its own route for a linked report, else /welding/n. */
export function displayHref(n: number): string {
  const e = REPORT_ORDER[n - 1];
  return e?.kind === "link" ? e.href : `/welding/${n}`;
}

/** Data page (1..44) → display page. */
export function dataToDisplay(data: number): number {
  return REPORT_ORDER.findIndex((e) => e.kind === "data" && e.data === data) + 1;
}

/** Static subtitle shown under the report title when rendering from the fixture. */
export const WELDING_REPORT_SUBTITLE = "Weekly Progress Report - Week Ending 16-Jan-26";
