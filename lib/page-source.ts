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
export type WeldingFilters = { ha?: string; area?: string; subco?: string; wtype?: string; wcat?: string };
export type WeldingPageOpts = { as_of?: string; filters?: WeldingFilters };

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
  return getFixturePage(n);
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
