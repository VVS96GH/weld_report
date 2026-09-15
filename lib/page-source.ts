import type { PageModel } from "@/lib/page-model";
import { getFixturePage } from "@/lib/fixture/welding-spec";
import { getFlangeFixturePage, type FlangeFilters } from "@/lib/fixture/flange-spec";

export type { FlangeFilters };

/**
 * Page-1 slicers (owner request 2026-09-07): HA / Area Classification / Sub-Contractor /
 * Weld Type / Weld Cat as URL search params `ha` / `area` / `subco` / `wtype` / `wcat`. Raw column values; absent = "All".
 * The database source applies them as an extra WHERE on every page-1 measure
 * (lib/pages/welding.ts); the fixture source has no filterable data and ignores them.
 */
export type WeldingFilters = { ha?: string; area?: string; subco?: string; wtype?: string; wcat?: string; sclass?: string; pwht?: string };
export type WeldingPageOpts = {
  as_of?: string;
  filters?: WeldingFilters;
  /**
   * Render a per-party page with the ALL sub-contractor (project scope, INCO
   * excluded) — the "ALL" option of the option-A screens (owner request
   * 2026-09-15). The fixture has no such data and says so instead of showing
   * one party's numbers under an ALL title.
   */
  allSubcos?: boolean;
  /** Render an NDE / PWHT page (12–40) over every RT % — the "ALL" option of the RT % axis. */
  allRtPct?: boolean;
};

/**
 * Where a rendered PageModel's data comes from.
 * - "fixture": analysis/mockups/welding-spec.json, mapped by lib/fixture/welding-spec.ts.
 * - "database": lib/pages/welding.ts (METRICS-LANE), loaded dynamically so this module
 *   (and `next build`) never hard-depends on it existing or being valid.
 */
export type PageSource = "fixture" | "database";

/** `PAGE_SOURCE` env var selects the source; defaults to "fixture" until the DB lands. */
export function resolvePageSource(): PageSource {
  return process.env.PAGE_SOURCE === "database" ? "database" : "fixture";
}

type WeldingPagesModule = {
  getWeldingPage: (n: number, opts?: WeldingPageOpts) => Promise<PageModel>;
};

// lib/pages/welding.ts is METRICS-LANE's file and doesn't exist yet (or may be
// mid-edit when this runs concurrently with that lane). The specifier is built from a
// variable rather than written as a literal in the import() call, so TypeScript's
// module resolution doesn't try to type-check against it (a literal `import("@/lib/
// pages/welding")` fails `tsc` outright when the file is missing). Turbopack still
// traces the constant and prints a "Module not found" build *warning* pointing here —
// harmless, and expected until that file lands — but it's only actually resolved at
// request time, inside the try/catch below, which is what keeps `next build` green
// regardless of whether the file exists yet.
const WELDING_PAGES_MODULE = "@/lib/pages/welding";

async function getDatabasePage(n: number, opts: WeldingPageOpts): Promise<PageModel> {
  let mod: Partial<WeldingPagesModule>;
  try {
    mod = (await import(WELDING_PAGES_MODULE)) as Partial<WeldingPagesModule>;
  } catch (err) {
    throw new Error(
      `PAGE_SOURCE=database but lib/pages/welding.ts could not be loaded: ${(err as Error).message}`,
    );
  }
  if (typeof mod.getWeldingPage !== "function") {
    throw new Error("PAGE_SOURCE=database but lib/pages/welding.ts does not export getWeldingPage(n)");
  }
  return mod.getWeldingPage(n, opts);
}

/** Load page `n` (1-based) as a PageModel from the selected (or given) source. */
export async function getPage(
  n: number,
  source: PageSource = resolvePageSource(),
  opts: WeldingPageOpts = {},
): Promise<PageModel> {
  if (source === "database") {
    return getDatabasePage(n, opts);
  }
  const page = getFixturePage(n);
  if ((opts.allSubcos && n > 2) || (opts.allRtPct && n >= 12 && n <= 40)) {
    return {
      ...page,
      id: `${page.id}-all`,
      title: page.title.replace(/\b(CCC|GAC|TEKFEN|MEDGULF)\b/g, "ALL SUB-CONTRACTORS"),
      widgets: [
        {
          kind: "text",
          text: "ALL (sub-contractors or RT %) is computed from the database only; the mockup snapshot has no such version of this page.",
        },
      ],
    };
  }
  return page;
}

// ── Flange dashboard (single page, filter-driven; ruling RF-08) ──────────────

type FlangePagesModule = {
  getFlangePage: (filters: FlangeFilters) => Promise<PageModel>;
};

// Same dynamic-import arrangement as the welding pages: lib/pages/flange.ts is the
// metrics lane's file and may not exist yet.
const FLANGE_PAGES_MODULE = "@/lib/pages/flange";

async function getDatabaseFlangePage(filters: FlangeFilters): Promise<PageModel> {
  let mod: Partial<FlangePagesModule>;
  try {
    mod = (await import(FLANGE_PAGES_MODULE)) as Partial<FlangePagesModule>;
  } catch (err) {
    // The flange data layer is being built concurrently. While the module is simply
    // ABSENT, serve the mockup fixture with an honest provenance note instead of a
    // 500 (the welding pages keep their strict behaviour). Any other failure —
    // the module exists but throws — still surfaces as an error.
    if (/Cannot find module/.test((err as Error).message)) {
      const page = getFlangeFixturePage(filters);
      page.widgets.push({
        kind: "text",
        text: "Database source not available yet: lib/pages/flange.ts is not present, so this page shows the mockup snapshot (fixture). It switches to live Postgres data automatically once that module lands.",
      });
      return page;
    }
    throw new Error(`PAGE_SOURCE=database but lib/pages/flange.ts could not be loaded: ${(err as Error).message}`);
  }
  if (typeof mod.getFlangePage !== "function") {
    throw new Error("PAGE_SOURCE=database but lib/pages/flange.ts does not export getFlangePage(filters)");
  }
  return mod.getFlangePage(filters);
}

/** Load the flange PageModel for the applied filters (ha / subco / method) from the selected source. */
export async function getFlangePage(
  filters: FlangeFilters = {},
  source: PageSource = resolvePageSource(),
): Promise<PageModel> {
  if (source === "database") {
    return getDatabaseFlangePage(filters);
  }
  return getFlangeFixturePage(filters);
}

// ── RT Backlog Forecast (single page, filter-driven; pbix page 20) ────────────

/** Forecast slicers as URL search params; absent = "All". */
export type ForecastFilters = Partial<
  Record<"ha" | "area" | "subco" | "byut" | "wcat" | "rt" | "dia" | "wy" | "wm" | "ry" | "rm", string>
>;
export const FORECAST_FILTER_IDS = ["ha", "area", "subco", "byut", "wcat", "rt", "dia", "wy", "wm", "ry", "rm"] as const;

type ForecastPagesModule = {
  getForecastPage: (filters: ForecastFilters, opts?: { as_of?: string }) => Promise<PageModel>;
};

const FORECAST_PAGES_MODULE = "@/lib/pages/forecast";

/** The forecast page has no mockup fixture: while the data layer is absent, say so. */
function forecastPlaceholder(reason: string): PageModel {
  return {
    page: 0,
    id: "forecast",
    title: "RT Backlog Forecast",
    widgets: [{ kind: "text", text: reason }],
    meta: { source: resolvePageSource() },
  };
}

/** Load the RT Backlog Forecast PageModel for the applied filters from the database source. */
export async function getForecastPage(filters: ForecastFilters = {}, opts: { as_of?: string } = {}): Promise<PageModel> {
  if (resolvePageSource() !== "database") {
    return forecastPlaceholder(
      "The RT Backlog Forecast page is computed from the database only (pbix page 20 has no mockup snapshot); PAGE_SOURCE=fixture shows this note instead.",
    );
  }
  let mod: Partial<ForecastPagesModule>;
  try {
    mod = (await import(FORECAST_PAGES_MODULE)) as Partial<ForecastPagesModule>;
  } catch (err) {
    if (/Cannot find module/.test((err as Error).message)) {
      return forecastPlaceholder("Database source not available yet: lib/pages/forecast.ts is not present. The page fills in automatically once that module lands.");
    }
    throw new Error(`PAGE_SOURCE=database but lib/pages/forecast.ts could not be loaded: ${(err as Error).message}`);
  }
  if (typeof mod.getForecastPage !== "function") {
    throw new Error("PAGE_SOURCE=database but lib/pages/forecast.ts does not export getForecastPage(filters)");
  }
  return mod.getForecastPage(filters, opts);
}

// ── Flange Management / Repartition and Progress (pbix flange page 2) ────────

type FlangeManagementModule = {
  getFlangeManagementPage: (filters: FlangeFilters) => Promise<PageModel>;
};

/** Load the flange management matrix page for the applied filters (database source only). */
export async function getFlangeManagementPage(filters: FlangeFilters = {}): Promise<PageModel> {
  const placeholder = (reason: string): PageModel => ({
    page: 0,
    id: "flange-management",
    title: "FLANGE MANAGEMENT / Repartition and Progress",
    widgets: [{ kind: "text", text: reason }],
    meta: { source: resolvePageSource() },
  });
  if (resolvePageSource() !== "database") {
    return placeholder("The flange management matrix is computed from the database only; PAGE_SOURCE=fixture shows this note instead.");
  }
  let mod: Partial<FlangeManagementModule>;
  try {
    mod = (await import(FLANGE_PAGES_MODULE)) as Partial<FlangeManagementModule>;
  } catch (err) {
    if (/Cannot find module/.test((err as Error).message)) return placeholder("Database source not available yet: lib/pages/flange.ts is not present.");
    throw new Error(`PAGE_SOURCE=database but lib/pages/flange.ts could not be loaded: ${(err as Error).message}`);
  }
  if (typeof mod.getFlangeManagementPage !== "function") {
    return placeholder("The data layer does not export getFlangeManagementPage(filters) yet; the matrix fills in automatically once it lands.");
  }
  return mod.getFlangeManagementPage(filters);
}
