import type { Metadata } from "next";

import type { FilterWidget } from "@/lib/page-model";
import { FORECAST_FILTER_IDS, getForecastPage, type ForecastFilters } from "@/lib/page-source";
import { FilterBar } from "@/components/FilterBar";
import { ForecastView } from "@/components/ForecastView";

// pbix page 20 "RT Backlog Forecast" as a filter-driven page (owner request
// 2026-09-07). Filters travel as URL search params; data is per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "RT Backlog Forecast — Welding Statistics Dashboard" };

function readFilters(params: Record<string, string | string[] | undefined>): ForecastFilters {
  const filters: ForecastFilters = {};
  for (const key of FORECAST_FILTER_IDS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && value.trim() !== "") filters[key] = value.trim();
  }
  return filters;
}

export default async function ForecastPage(props: PageProps<"/forecast">) {
  const params = await props.searchParams;
  const model = await getForecastPage(readFilters(params));
  const filterWidgets = model.widgets.filter((w): w is FilterWidget => w.kind === "filter");
  const subtitle = model.meta?.source === "database" ? `Data as of ${model.meta.as_of ?? "unknown"}` : "RT Backlog Forecast";

  return (
    <>
      <FilterBar widgets={filterWidgets} />
      <ForecastView model={model} subtitle={subtitle} />
    </>
  );
}
