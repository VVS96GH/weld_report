import type { PageModel } from "@/lib/page-model";
import { getFixturePage } from "@/lib/fixture/welding-spec";

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
  getWeldingPage: (n: number) => Promise<PageModel>;
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

async function getDatabasePage(n: number): Promise<PageModel> {
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
  return mod.getWeldingPage(n);
}

/** Load page `n` (1-based) as a PageModel from the selected (or given) source. */
export async function getPage(n: number, source: PageSource = resolvePageSource()): Promise<PageModel> {
  if (source === "database") {
    return getDatabasePage(n);
  }
  return getFixturePage(n);
}
