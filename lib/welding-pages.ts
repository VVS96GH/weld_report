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
export const WELDING_PAGE_TITLES: readonly string[] = [
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

export const WELDING_TOTAL_PAGES = WELDING_PAGE_TITLES.length;

/** Static subtitle shown under the report title when rendering from the fixture. */
export const WELDING_REPORT_SUBTITLE = "Weekly Progress Report - Week Ending 16-Jan-26";
