import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import type { FilterWidget } from "@/lib/page-model";
import { FORECAST_FILTER_IDS, getForecastPage, getPage, type ForecastFilters, type WeldingFilters } from "@/lib/page-source";
import { ForecastView } from "@/components/ForecastView";
import { FilterBar } from "@/components/FilterBar";
import { reportEntry, WELDING_PAGE_TITLES, WELDING_REPORT_SUBTITLE, WELDING_TOTAL_PAGES } from "@/lib/welding-pages";
import { PageView } from "@/components/PageView";

// Data is loaded per-request (fixture file today, a live DB once METRICS-LANE lands),
// and there's no fixed set of params to prerender for it — so this route is dynamic
// rather than statically generated. No `generateStaticParams` on purpose.
export const dynamic = "force-dynamic";

// Page-1 slicers travel as URL search params (same mechanism as the flange
// dashboard, ruling RF-08): the server re-renders the PageModel with them applied.
// `sclass` / `pwht` are the NDE / PWHT pages' own slicers; page 1 ignores them.
const FILTER_PARAMS = ["ha", "area", "subco", "wtype", "wcat", "sclass", "pwht"] as const;

function readForecastFilters(params: Record<string, string | string[] | undefined>): ForecastFilters {
  const filters: ForecastFilters = {};
  for (const key of FORECAST_FILTER_IDS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && value.trim() !== "") filters[key] = value.trim();
  }
  return filters;
}

function readFilters(params: Record<string, string | string[] | undefined>): WeldingFilters {
  const filters: WeldingFilters = {};
  for (const key of FILTER_PARAMS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && value.trim() !== "") filters[key] = value.trim();
  }
  return filters;
}

function parsePageNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > WELDING_TOTAL_PAGES) return null;
  return n;
}

export async function generateMetadata(props: PageProps<"/welding/[page]">): Promise<Metadata> {
  const { page } = await props.params;
  const n = parsePageNumber(page);
  if (n === null) return { title: "Welding Statistics Dashboard" };
  // Titles come from the static list, not from getPage(): the page body already
  // loads the model, and a second getPage() here would double every DB query.
  return { title: `${WELDING_PAGE_TITLES[n - 1]} — Welding Statistics Dashboard` };
}

export default async function WeldingReportPage(props: PageProps<"/welding/[page]">) {
  const { page } = await props.params;
  const n = parsePageNumber(page);
  if (n === null) {
    notFound();
  }

  const params = await props.searchParams;
  const entry = reportEntry(n)!;
  // Pages 3..8 are other reports placed in the reading order (Flange, Welder
  // Performance, Errors): the number sends there.
  if (entry.kind === "link") redirect(entry.href);

  // Display page 2 is the RT Backlog Forecast (pbix page 20), inserted into the
  // report's reading order; every other display page maps to its mockup data page.
  if (entry.kind === "forecast") {
    const model = await getForecastPage(readForecastFilters(params));
    const filterWidgets = model.widgets.filter((w): w is FilterWidget => w.kind === "filter");
    const subtitle = model.meta?.source === "database" ? `Data as of ${model.meta.as_of ?? "unknown"}` : WELDING_REPORT_SUBTITLE;
    return (
      <>
        <FilterBar widgets={filterWidgets} />
        <ForecastView model={model} subtitle={subtitle} />
      </>
    );
  }

  const model = await getPage(entry.data, undefined, { filters: readFilters(params) });
  const filterWidgets = model.widgets.filter((w): w is FilterWidget => w.kind === "filter");
  const subtitle =
    model.meta?.source === "database"
      ? `Data as of ${model.meta.as_of ?? "unknown"}`
      : WELDING_REPORT_SUBTITLE;

  return (
    <>
      <FilterBar widgets={filterWidgets} />
      <PageView model={model} subtitle={subtitle} />
    </>
  );
}
