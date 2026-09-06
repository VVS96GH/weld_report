import fs from "node:fs";
import path from "node:path";

import type { ChartWidget, FilterWidget, KpiWidget, PageModel, TableWidget, Widget } from "@/lib/page-model";

/**
 * Maps `analysis/mockups/flange-spec.json` (extracted from the static flange mockup
 * by analysis/mockups/extract_flange.py) to the PageModel contract, as the
 * fixture behind /flange until lib/pages/flange.ts (metrics lane) serves it from
 * Postgres. Server-only (node:fs) — go through lib/page-source.ts.
 *
 * The mockup's numbers are its filters=All snapshot; the fixture cannot
 * re-aggregate, so when a filter other than "All" is requested it still returns
 * the All snapshot and says so in a text widget (never a fabricated number).
 */

export type FlangeFilters = Record<string, string>;

/** Mockup select id → URL search-param name (RF-08). */
const FILTER_IDS: Record<string, string> = { filterSubco: "subco", filterHA: "ha", filterMethod: "method" };
// Labels match lib/pages/flange.ts (the live source) so fixture and database agree.
const FILTER_LABELS: Record<string, string> = { subco: "Subcontractor", ha: "Handover Area", method: "Joint Method" };

type RawFilter = { kind: "filter"; id: string; options: { value: string; label: string }[]; default: string };
type RawKpi = { kind: "kpi"; label: string; value: string; sub: string | null };
type SubcoRow = { name: string; total: number; constn: number; pcc: number; inspected: number; leaked: number; pct: string };
type Totals = { total: number; constn: number; pcc: number; inspected: number; leaked: number; pct: string };
type MethodRow = { method: string; total: number; constn: number; pcc: number; inspected: number; pct: string; leaked: number };
type HaRow = { name: string; total: number; constn: number; pcc: number; inspected: number; leaked: number; pct: string; details: MethodRow[] };
type RawTable = {
  kind: "table";
  id: string;
  title: string;
  columns: string[];
  rows: { subcontractors?: SubcoRow[]; total?: Totals; ha_rows_with_method_detail?: HaRow[] };
};
type RawChart = {
  kind: "chart";
  canvas_id: string;
  title: string;
  chart_type: string;
  labels: string[];
  datasets: { label?: string; data: (number | string | null)[] }[];
};
type RawText = { kind: "text"; text: string; role?: string };
type RawWidget = RawFilter | RawKpi | RawTable | RawChart | RawText;
type RawSection = { id: string; title: string; widgets: RawWidget[] };
type RawSpec = { sections: RawSection[] };

/** The mockup is a January-2026 snapshot (its timeline ends 09-Jan-26). */
export const FLANGE_FIXTURE_AS_OF = "2026-01-09";

let cached: RawSpec | null = null;
function loadSpec(): RawSpec {
  if (cached) return cached;
  const file = path.join(process.cwd(), "analysis", "mockups", "flange-spec.json");
  cached = JSON.parse(fs.readFileSync(file, "utf-8")) as RawSpec;
  return cached;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (p: string) => `${p}%`;

function statusRow(r: { name: string; total: number; constn: number; pcc: number; inspected: number; pct: string; leaked: number }): string[] {
  return [r.name, fmt(r.total), fmt(r.constn), fmt(r.pcc), fmt(r.inspected), pct(r.pct), fmt(r.leaked)];
}

function mapTable(w: RawTable): TableWidget {
  const rows: string[][] = [];
  let total_row: string[] | undefined;
  if (w.rows.subcontractors) {
    for (const r of w.rows.subcontractors) rows.push(statusRow(r));
    if (w.rows.total) {
      total_row = statusRow({ name: "Total", ...w.rows.total });
      rows.push(total_row);
    }
  } else if (w.rows.ha_rows_with_method_detail) {
    for (const ha of w.rows.ha_rows_with_method_detail) {
      rows.push(statusRow(ha));
      // the mockup's method detail sub-rows under each HA
      for (const d of ha.details) rows.push(statusRow({ ...d, name: `${ha.name} · ${d.method}` }));
    }
  }
  return { kind: "table", title: w.title, columns: w.columns, rows, total_row };
}

function mapChart(w: RawChart): ChartWidget {
  return {
    kind: "chart",
    canvas_id: w.canvas_id,
    title: w.title,
    chart_type: w.chart_type,
    labels: w.labels,
    datasets: w.datasets.map((ds) => ({ label: ds.label ?? w.title, data: ds.data })),
  };
}

function mapFilter(w: RawFilter, applied: FlangeFilters): FilterWidget {
  const id = FILTER_IDS[w.id] ?? w.id;
  const options = w.options.map((o) => o.value);
  const requested = applied[id];
  return {
    kind: "filter",
    id,
    label: FILTER_LABELS[id] ?? id,
    options,
    value: requested && options.includes(requested) ? requested : w.default,
  };
}

/** Build the single flange PageModel (page 0) from the fixture, echoing the requested filters. */
export function getFlangeFixturePage(applied: FlangeFilters = {}): PageModel {
  const spec = loadSpec();
  const widgets: Widget[] = [];
  const filters: FlangeFilters = {};
  for (const section of spec.sections) {
    for (const w of section.widgets) {
      switch (w.kind) {
        case "filter": {
          const f = mapFilter(w, applied);
          filters[f.id] = f.value;
          widgets.push(f);
          break;
        }
        case "kpi": {
          const kpi: KpiWidget = { kind: "kpi", label: w.label, value: w.value, sub: w.sub ?? undefined };
          widgets.push(kpi);
          break;
        }
        case "table":
          widgets.push(mapTable(w));
          break;
        case "chart":
          widgets.push(mapChart(w));
          break;
        case "text":
          // the mockup's Reset / Export buttons — the filter bar provides Reset; Export is not in scope
          break;
      }
    }
  }
  const nonDefault = Object.entries(filters).filter(([, v]) => v !== "All");
  if (nonDefault.length > 0) {
    widgets.push({
      kind: "text",
      text: `Fixture data: the mockup snapshot only carries the "All" aggregate, so the figures above are NOT filtered by ${nonDefault
        .map(([k, v]) => `${FILTER_LABELS[k] ?? k} = ${v}`)
        .join(", ")}. Set PAGE_SOURCE=database for filtered results.`,
    });
  }
  return {
    page: 0,
    id: "flange",
    title: "Flange Inspection Dashboard",
    widgets,
    filters,
    meta: { source: "fixture", as_of: FLANGE_FIXTURE_AS_OF },
  };
}
