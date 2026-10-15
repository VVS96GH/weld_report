import type { Metadata } from "next";

import type { FilterWidget } from "@/lib/page-model";
import { getFlangeManagementPage, getFlangePage, type FlangeFilters } from "@/lib/page-source";
import { EdgeFilters } from "@/components/EdgeFilters";
import { FlangeView } from "@/components/FlangeView";

// Filters travel as URL search params (ruling RF-08) and the data is loaded
// per request, so the route is dynamic; nothing to prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Flange Inspection Dashboard — Welding Statistics Dashboard" };

const FILTER_PARAMS = ["ha", "subco", "method"] as const;

function readFilters(params: Record<string, string | string[] | undefined>): FlangeFilters {
  const filters: FlangeFilters = {};
  for (const key of FILTER_PARAMS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && value.trim() !== "") filters[key] = value.trim();
  }
  return filters;
}

export default async function FlangePage(props: PageProps<"/flange">) {
  const params = await props.searchParams;
  const filters = readFilters(params);
  const [model, management] = await Promise.all([getFlangePage(filters), getFlangeManagementPage(filters)]);
  const filterWidgets = model.widgets.filter((w): w is FilterWidget => w.kind === "filter");
  const subtitle =
    model.meta?.source === "database"
      ? `Data as of ${model.meta.as_of ?? "unknown"}`
      : `Mockup snapshot ${model.meta?.as_of ?? ""}`.trim();

  return (
    <>
      <EdgeFilters widgets={filterWidgets} />
      <FlangeView model={model} subtitle={subtitle} management={management} />
    </>
  );
}
