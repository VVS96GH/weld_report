import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { FilterWidget } from "@/lib/page-model";
import { getPage, type WeldingFilters } from "@/lib/page-source";
import { FilterBar } from "@/components/FilterBar";
import { WELDING_PAGE_TITLES, WELDING_REPORT_SUBTITLE, WELDING_TOTAL_PAGES } from "@/lib/welding-pages";
import { PageView } from "@/components/PageView";

// Data is loaded per-request (fixture file today, a live DB once METRICS-LANE lands),
// and there's no fixed set of params to prerender for it — so this route is dynamic
// rather than statically generated. No `generateStaticParams` on purpose.
export const dynamic = "force-dynamic";

// Page-1 slicers travel as URL search params (same mechanism as the flange
// dashboard, ruling RF-08): the server re-renders the PageModel with them applied.
const FILTER_PARAMS = ["ha", "area", "subco", "wtype", "wcat"] as const;

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

  const filters = readFilters(await props.searchParams);
  const model = await getPage(n, undefined, { filters });
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
