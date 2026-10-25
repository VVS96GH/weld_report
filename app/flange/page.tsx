import type { Metadata } from "next";

import type { FilterWidget } from "@/lib/page-model";
import {
  getFlangeManagementPage,
  getFlangePage,
  type FlangeFilters,
} from "@/lib/page-source";
import { EdgeFilters } from "@/components/EdgeFilters";
import { FlangeView } from "@/components/FlangeView";
import { lastFlangeWeek } from "@/lib/flange-breakdown-cum";

// Filters travel as URL search params (ruling RF-08) and the data is loaded
// per request, so the route is dynamic; nothing to prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flange Inspection Dashboard — Welding Statistics Dashboard",
};

const FILTER_PARAMS = ["ha", "subco", "method"] as const;

function readFilters(
  params: Record<string, string | string[] | undefined>,
): FlangeFilters {
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
  const [model, management, lastWeek] = await Promise.all([
    getFlangePage(filters),
    getFlangeManagementPage(filters),
    lastFlangeWeek(),
  ]);
  // the week the Insert into CUM file button writes: the Friday on or after the register's as-of
  const cutoff = (() => {
    const d = new Date(
      `${(model.meta?.as_of ?? new Date().toISOString()).slice(0, 10)}T00:00:00Z`,
    );
    d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const filterWidgets = model.widgets.filter(
    (w): w is FilterWidget => w.kind === "filter",
  );
  const subtitle =
    model.meta?.source === "database"
      ? `Data as of ${model.meta.as_of ?? "unknown"}`
      : `Mockup snapshot ${model.meta?.as_of ?? ""}`.trim();

  return (
    <>
      <EdgeFilters
        widgets={filterWidgets}
        actions={
          <a
            className="filter-select fchip-btn scdb-btn"
            href="/api/flange-scdb-export"
            download
            title="Download the SCDB import form (14_SCDB_Import_Form_Flange_Progress_Template): Flange Progress, GAC / MEDGULF / TEKFEN, one row per Joint ID (Joint ID Max Joint_Date); duplicates marked in Remarks"
          >
            SCDB
          </a>
        }
      />
      <FlangeView
        model={model}
        subtitle={subtitle}
        management={management}
        cum={
          model.meta?.source === "database" ? { lastWeek, cutoff } : undefined
        }
      />
    </>
  );
}
