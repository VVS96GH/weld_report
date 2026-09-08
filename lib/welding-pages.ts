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
export const WELDING_DATA_PAGE_TITLES: readonly string[] = [
  "Welding Progress (Project)",
  "Project Welding & NDE Status",
  "CCC WELDING STATUS",
  "GAC WELDING STATUS (Except SLG Service)",
  "TEKFEN WELDING STATUS",
  "MEDGULF WELDING STATUS",
  "CCC WELDING STATUS",
  "GAC WELDING STATUS (Other than Slug Catcher)",
  "GAC WELDING STATUS (Slug Catcher Area)",
  "TEKFEN WELDING STATUS",
  "MEDGULF WELDING STATUS (Other than Slug Catcher)",
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
  | { kind: "data"; data: number; title: string }
  | { kind: "forecast"; title: string };

export const FORECAST_TITLE = "RT Backlog Forecast";
export const FORECAST_DISPLAY_PAGE = 2;

export const REPORT_ORDER: readonly ReportEntry[] = (() => {
  const entries: ReportEntry[] = WELDING_DATA_PAGE_TITLES.map((title, i) => ({ kind: "data", data: i + 1, title }));
  entries.splice(FORECAST_DISPLAY_PAGE - 1, 0, { kind: "forecast", title: FORECAST_TITLE });
  return entries;
})();

/** Display titles, one per display page (the nav select, the page indicator, e2e). */
export const WELDING_PAGE_TITLES: readonly string[] = REPORT_ORDER.map((e) => e.title);

export const WELDING_TOTAL_PAGES = REPORT_ORDER.length;

/** Display page → report entry (undefined outside 1..WELDING_TOTAL_PAGES). */
export function reportEntry(display: number): ReportEntry | undefined {
  return Number.isInteger(display) ? REPORT_ORDER[display - 1] : undefined;
}

/** Data page (1..44) → display page. */
export function dataToDisplay(data: number): number {
  return REPORT_ORDER.findIndex((e) => e.kind === "data" && e.data === data) + 1;
}

/** Static subtitle shown under the report title when rendering from the fixture. */
export const WELDING_REPORT_SUBTITLE = "Weekly Progress Report - Week Ending 16-Jan-26";
