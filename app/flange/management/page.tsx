import type { Metadata } from "next";

import type { FilterWidget, TableWidget } from "@/lib/page-model";
import { getFlangeManagementPage, type FlangeFilters } from "@/lib/page-source";
import { FilterBar } from "@/components/FilterBar";
import { MatrixTable } from "@/components/MatrixTable";
import { PageView } from "@/components/PageView";

// pbix flange page 2 "FLANGE MANAGEMENT / Repartition and Progress" (owner request
// 2026-09-08): one HA × sub-contractor matrix per tightening method.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Flange Management / Repartition and Progress — Welding Statistics Dashboard" };

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

export default async function FlangeManagementPage(props: PageProps<"/flange/management">) {
  const params = await props.searchParams;
  const model = await getFlangeManagementPage(readFilters(params));
  const filterWidgets = model.widgets.filter((w): w is FilterWidget => w.kind === "filter");
  const matrix = model.widgets.find((w): w is TableWidget => w.kind === "table");
  const subtitle = model.meta?.source === "database" ? `Data as of ${model.meta.as_of ?? "unknown"}` : "Flange Management";
  const others = { ...model, widgets: model.widgets.filter((w) => w.kind !== "table" && w.kind !== "filter") };

  return (
    <>
      <FilterBar widgets={filterWidgets} />
      <section className="pbi-page pbi-management">
        <div className="pbi-visual-title pbi-management-title">{model.title}</div>
        {matrix ? <MatrixTable widget={matrix} /> : null}
      </section>
      <PageView model={{ ...others, title: "" }} subtitle={subtitle} />
    </>
  );
}
