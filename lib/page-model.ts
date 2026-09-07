/**
 * Shared page-model contract between the data layer (lib/pages/*) and the UI
 * (components/*). Mirrors the widget shapes extracted from the mockups in
 * analysis/mockups/welding-spec.json so a static fixture and a live database
 * page render through the same components.
 */

export type KpiWidget = {
  kind: "kpi";
  label: string;
  /** Display string, already formatted ("375,152", "1.58%"). */
  value: string;
  sub?: string;
};

export type TableWidget = {
  kind: "table";
  title: string;
  columns: string[];
  /** Cell text, one array per row, in display order. */
  rows: string[][];
  /** Optional totals row rendered with the row-header style. */
  total_row?: string[];
};

export type ChartDataset = {
  label: string;
  data: (number | string | null)[];
  stack?: string;
};

export type ChartWidget = {
  kind: "chart";
  /** Stable id (mockup canvas id, e.g. "chart1_progress"). */
  canvas_id: string;
  title: string;
  chart_type: "bar" | "line" | "doughnut" | "pie" | string;
  labels: string[];
  datasets: ChartDataset[];
  /** Free-form hints from the mockup: stacked, indexAxis, percent axis… */
  options_notes?: string;
};

export type TextWidget = {
  kind: "text";
  text: string;
};

/**
 * A server-driven filter control (flange dashboard: HA / sub-contractor /
 * joint method). The page is re-rendered with the chosen values as URL search
 * params; `value` is the currently applied option ("All" when none).
 */
export type FilterWidget = {
  kind: "filter";
  /** Search-param name, e.g. "ha", "subco", "method". */
  id: string;
  label: string;
  options: string[];
  value: string;
  /**
   * Hierarchy (pbix two-field slicer "HA, Area Classification", owner request
   * 2026-09-07): this filter is the CHILD of the filter whose id is `parent`, and
   * `options_by_parent` lists, per parent value, the child options that actually
   * occur under it in the data (key "" = rows whose parent value is blank). The filter
   * bar renders the pair as ONE grouped control; both ids still travel as their own
   * search params.
   */
  parent?: string;
  options_by_parent?: Record<string, string[]>;
};

export type Widget = KpiWidget | TableWidget | ChartWidget | TextWidget | FilterWidget;

export type PageModel = {
  /** 1-based page number in the welding report (1..44); 0 for single-page reports. */
  page: number;
  id: string;
  title: string;
  subtitle?: string;
  widgets: Widget[];
  /** Applied filter values (filter id → value) for filter-driven pages. */
  filters?: Record<string, string>;
  /** Data provenance: which snapshot/load produced the numbers. */
  meta?: {
    source: "fixture" | "database";
    as_of?: string;
    load_id?: string;
  };
};
