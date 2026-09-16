/**
 * Consolidation option A ("filters instead of pages", proposal 2026-09-07, owner:
 * "сделай вариант A — посмотрим как это будет выглядеть"): the 44 mockup pages
 * regrouped into 7 screens whose sub-contractor / RT% / weld-cat axes are FILTERS in
 * the URL rather than separate pages. Nothing is recomputed — every screen is one or
 * more of the existing PageModels (lib/pages/welding.ts, pinned by tests) merged
 * verbatim, so the numbers are exactly the 44-page report's. The 44-page route stays
 * as the print form.
 *
 * Pure data + pure functions: imported by both the server route and the client
 * shell, so nothing here may touch the DB or React.
 */

export type ScreenFilterOption = { value: string; label: string };
export type ScreenFilterDef = { id: string; label: string; options: ScreenFilterOption[]; default: string };

export type ScreenDef = {
  id: string;
  title: string;
  /** Short chip label in the screen nav. */
  nav: string;
  filters: ScreenFilterDef[];
  /**
   * Mockup page numbers (1..44) this screen shows for the given filter values, in
   * render order; `null` when the report has no page for that combination (the
   * screen then says so instead of showing another combination's numbers).
   */
  pages: (values: Record<string, string>) => number[] | null;
  /** The screen forwards these search params to page 1's own slicers. */
  passthrough?: readonly string[];
};

/**
 * "ALL" (owner request 2026-09-15): the page is rendered with the project scope
 * instead of one party — lib/pages/welding.ts `allSubcos`. It is the FIRST option
 * and the default, as a pbix slicer with nothing selected is. The structure comes
 * from a representative party page (`ALL_PAGES` below); the numbers do not.
 */
export const SUBCO_ALL = "ALL";
const SUBCOS = ["CCC", "GAC", "TEKFEN", "MEDGULF"] as const;
const ALL_OPTION: ScreenFilterOption = { value: SUBCO_ALL, label: SUBCO_ALL };
const subcoFilter = (options: ScreenFilterOption[] = SUBCOS.map((s) => ({ value: s, label: s }))): ScreenFilterDef => ({
  id: "subco",
  label: "Sub-Contractor",
  options: [ALL_OPTION, ...options],
  default: SUBCO_ALL,
});

/** Whether the applied values ask for the ALL sub-contractor rendering. */
export function isAllSubcos(values: Record<string, string>): boolean {
  return values.subco === SUBCO_ALL;
}
/**
 * "ALL" on the RT % axis (owner request 2026-09-15): the RT 100 % page's structure
 * rendered with no RT % predicate — lib/pages/welding.ts `allRtPct`. First option
 * and the default, like the sub-contractor axis.
 */
export const RT_ALL = "ALL";
const rtFilter = (pcts: readonly number[]): ScreenFilterDef => ({
  id: "rt",
  label: "RT %",
  options: [{ value: RT_ALL, label: RT_ALL }, ...pcts.map((p) => ({ value: String(p), label: `${p} %` }))],
  default: RT_ALL,
});

/** Whether the applied values ask for every RT % at once. */
export function isAllRt(values: Record<string, string>): boolean {
  return values.rt === RT_ALL;
}

/** Sub-contractor status: the "PR all" table page (3-6) followed by the chart page (7-11). */
const STATUS_PAGES: Record<string, number[]> = {
  // ALL borrows the CCC pages' structure (rendered project-wide, see SUBCO_ALL)
  [SUBCO_ALL]: [7, 3],
  CCC: [7, 3],
  GAC: [8, 4],
  "GAC-SLG": [9],
  TEKFEN: [10, 5],
  MEDGULF: [11, 6],
};

/** NDE status by RT coverage: sub-contractor → RT% → mockup page. */
// RT "ALL" borrows each party's RT 100 % page (its columns are the RT-100 flags, which
// stay truthful over every RT %; the 5/10/20 % pages carry a coverage-gap table that
// needs one RT % to exist).
const NDE_PAGES: Record<string, Record<string, number>> = {
  // ALL: the CCC pages' structure; RT 30 % exists for GAC only, so that one is GAC's.
  [SUBCO_ALL]: { [RT_ALL]: 12, "100": 12, "5": 14, "10": 16, "20": 18, "30": 26 },
  CCC: { [RT_ALL]: 12, "100": 12, "5": 14, "10": 16, "20": 18 },
  GAC: { [RT_ALL]: 19, "100": 19, "5": 21, "10": 23, "20": 25, "30": 26 },
  TEKFEN: { [RT_ALL]: 27, "100": 27, "5": 29, "10": 31, "20": 33 },
  MEDGULF: { [RT_ALL]: 34, "100": 34, "5": 36, "10": 38, "20": 40 },
};

/** PWHT status by RT coverage. */
const PWHT_PAGES: Record<string, Record<string, number>> = {
  [SUBCO_ALL]: { [RT_ALL]: 13, "100": 13, "5": 15, "10": 17 },
  CCC: { [RT_ALL]: 13, "100": 13, "5": 15, "10": 17 },
  GAC: { [RT_ALL]: 20, "100": 20, "5": 22, "10": 24 },
  TEKFEN: { [RT_ALL]: 28, "100": 28, "5": 30, "10": 32 },
  MEDGULF: { [RT_ALL]: 35, "100": 35, "5": 37, "10": 39 },
};

const WPS_PAGES: Record<string, number> = { [SUBCO_ALL]: 41, CCC: 41, GAC: 42, TEKFEN: 43, MEDGULF: 44 };

export const SCREENS: readonly ScreenDef[] = [
  {
    id: "overview",
    title: "Welding Progress (Project)",
    nav: "Overview",
    filters: [],
    pages: () => [1],
    passthrough: ["ha", "area", "subco", "wtype", "wcat"],
  },
  {
    id: "status",
    title: "Project Welding & NDE Status",
    nav: "Project status",
    filters: [],
    pages: () => [2],
  },
  {
    id: "subco",
    title: "Sub-Contractor Welding Status",
    nav: "Sub-contractor",
    filters: [
      subcoFilter([
        { value: "CCC", label: "CCC" },
        { value: "GAC", label: "GAC (other than Slug Catcher)" },
        { value: "GAC-SLG", label: "GAC (Slug Catcher Area)" },
        { value: "TEKFEN", label: "TEKFEN" },
        { value: "MEDGULF", label: "MEDGULF" },
      ]),
    ],
    pages: (v) => STATUS_PAGES[v.subco] ?? null,
  },
  {
    id: "nde",
    title: "NDE Status by RT %",
    nav: "NDE by RT %",
    filters: [subcoFilter(), rtFilter([100, 30, 20, 10, 5])],
    // the page's own Service Class and PWHT Y/N slicers (lib/pages/welding.ts buildNdePage)
    passthrough: ["sclass", "pwht"],
    pages: (v) => {
      const n = NDE_PAGES[v.subco]?.[v.rt];
      return n ? [n] : null;
    },
  },
  {
    id: "pwht",
    title: "PWHT Status by RT %",
    nav: "PWHT by RT %",
    filters: [subcoFilter(), rtFilter([100, 10, 5])],
    passthrough: ["sclass", "pwht"],
    pages: (v) => {
      const n = PWHT_PAGES[v.subco]?.[v.rt];
      return n ? [n] : null;
    },
  },
  {
    id: "wps",
    title: "Weld Rejection Detail as per WPS",
    nav: "Rejection by WPS",
    filters: [subcoFilter()],
    pages: (v) => {
      const n = WPS_PAGES[v.subco];
      return n ? [n] : null;
    },
  },
  {
    id: "demo",
    title: "Demo widgets",
    nav: "Demo",
    filters: [],
    pages: () => [],
  },
];

/** The "Demo" screen (2026-09-16): four advanced widget forms over the project scope
 *  (lib/pages/demo.ts + components/DemoView.tsx). It owns no mockup page, so the
 *  registry's page coverage is unchanged. */
export const DEMO_SCREEN_ID = "demo";

export const SCREEN_IDS = SCREENS.map((s) => s.id);

export function screenById(id: string): ScreenDef | undefined {
  return SCREENS.find((s) => s.id === id);
}

/** Applied filter values for a screen: the search param when it is a known option, else the default. */
export function screenValues(screen: ScreenDef, params: Record<string, string | undefined>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of screen.filters) {
    const raw = params[f.id];
    values[f.id] = raw !== undefined && f.options.some((o) => o.value === raw) ? raw : f.default;
  }
  return values;
}

/** Human title for the applied combination, e.g. "GAC · RT 100 %". */
export function screenVariantLabel(screen: ScreenDef, values: Record<string, string>): string {
  return screen.filters
    .map((f) => f.options.find((o) => o.value === values[f.id])?.label ?? values[f.id])
    .join(" · ");
}
