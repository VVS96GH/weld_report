import fs from "node:fs";
import path from "node:path";

import type {
  ChartDataset,
  ChartWidget,
  KpiWidget,
  PageModel,
  TableWidget,
  TextWidget,
  Widget,
} from "@/lib/page-model";

/**
 * Maps `analysis/mockups/welding-spec.json` (produced by
 * analysis/mockups/extract_welding.py from the static mockup) to the frozen
 * PageModel contract in lib/page-model.ts.
 *
 * Server-only: reads a file with `node:fs`. Never import this from a Client
 * Component — go through lib/page-source.ts instead.
 */

type RawKpiWidget = {
  kind: "kpi";
  label: string;
  value: string;
  sub: string | null;
};

type RawTableWidget = {
  kind: "table";
  title: string;
  columns: string[];
  rows: string[][];
  total_row: string[] | null;
};

type RawChartDataset = {
  label: string | null;
  data: (string | number | null)[];
  stack?: string;
};

type RawChartWidget = {
  kind: "chart";
  canvas_id: string;
  title: string;
  chart_type: string;
  labels: string[];
  datasets: RawChartDataset[];
  options_notes: string[] | null;
};

type RawTextWidget = {
  kind: "text";
  text: string;
};

type RawWidget = RawKpiWidget | RawTableWidget | RawChartWidget | RawTextWidget;

type RawPage = {
  page: number;
  id: string;
  title: string;
  subtitle: string | null;
  widgets: RawWidget[];
};

type RawMood = {
  colors: string[];
  primary: string;
  secondary: string;
  icon: string;
  label: string;
};

type RawGlobal = {
  pageTitles: string[];
  totalPages: number;
  moods: Record<string, RawMood>;
  theme_attr: { lang: string; "data-theme": string; "data-mood": string };
  css_vars: string[];
  external_scripts: string[];
  external_stylesheets: string[];
  report_subtitle: string;
};

type RawSpec = {
  pages: RawPage[];
  global: RawGlobal;
};

/** Snapshot date baked into the fixture (matches the mockup's report_subtitle week). */
export const FIXTURE_AS_OF = "2026-01-16";

let cachedSpec: RawSpec | null = null;

function loadSpec(): RawSpec {
  if (cachedSpec) return cachedSpec;
  const file = path.join(process.cwd(), "analysis", "mockups", "welding-spec.json");
  const raw = fs.readFileSync(file, "utf-8");
  cachedSpec = JSON.parse(raw) as RawSpec;
  return cachedSpec;
}

function mapDataset(ds: RawChartDataset): ChartDataset {
  return {
    label: ds.label ?? "",
    data: ds.data,
    stack: ds.stack,
  };
}

function mapWidget(w: RawWidget): Widget {
  switch (w.kind) {
    case "kpi": {
      const kpi: KpiWidget = {
        kind: "kpi",
        label: w.label,
        value: w.value,
        sub: w.sub ?? undefined,
      };
      return kpi;
    }
    case "table": {
      const table: TableWidget = {
        kind: "table",
        title: w.title,
        columns: w.columns,
        rows: w.rows,
        total_row: w.total_row ?? undefined,
      };
      return table;
    }
    case "chart": {
      const chart: ChartWidget = {
        kind: "chart",
        canvas_id: w.canvas_id,
        title: w.title,
        chart_type: w.chart_type,
        labels: w.labels,
        datasets: w.datasets.map(mapDataset),
        options_notes: w.options_notes && w.options_notes.length > 0 ? w.options_notes.join(", ") : undefined,
      };
      return chart;
    }
    case "text": {
      const text: TextWidget = { kind: "text", text: w.text };
      return text;
    }
    default: {
      const exhaustive: never = w;
      throw new Error(`Unknown widget kind in fixture: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Total number of pages the fixture defines (should match WELDING_TOTAL_PAGES). */
export function getFixturePageCount(): number {
  return loadSpec().pages.length;
}

export function getFixtureGlobal(): RawGlobal {
  return loadSpec().global;
}

export function getFixturePage(n: number): PageModel {
  const spec = loadSpec();
  const raw = spec.pages.find((p) => p.page === n);
  if (!raw) {
    throw new Error(`Fixture has no page ${n} (valid range 1..${spec.pages.length})`);
  }
  return {
    page: raw.page,
    id: raw.id,
    title: raw.title,
    subtitle: raw.subtitle ?? undefined,
    widgets: raw.widgets.map(mapWidget),
    meta: { source: "fixture", as_of: FIXTURE_AS_OF },
  };
}

export function getAllFixturePages(): PageModel[] {
  const spec = loadSpec();
  return spec.pages.map((raw) => getFixturePage(raw.page));
}
