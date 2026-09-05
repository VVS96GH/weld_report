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

export type Widget = KpiWidget | TableWidget | ChartWidget | TextWidget;

export type PageModel = {
  /** 1-based page number in the welding report (1..44). */
  page: number;
  id: string;
  title: string;
  subtitle?: string;
  widgets: Widget[];
  /** Data provenance: which snapshot/load produced the numbers. */
  meta?: {
    source: "fixture" | "database";
    as_of?: string;
    load_id?: string;
  };
};
