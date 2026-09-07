/**
 * Page 20 "RT Backlog Forecast" — a filter-driven single page, same shape as
 * the flange dashboard: `page: 0`, `id: "forecast"`, FilterWidgets first.
 *
 * SLICE 1 of 3. Everything the owner's screenshot values already reproduce is
 * live; every other card is present but honest-empty, and its note carries the
 * owner's target so the page is complete in SHAPE from the first slice and the
 * gap is visible rather than implied. Slice 2 adds the two monthly charts,
 * slice 3 the dia family, the averages, months-to-keep and PWHT (New PBI Rule).
 *
 * PAGE-LEVEL FILTERS, both from the pbix page: `Sub-Contractor <> Inco` and
 * `Temporary Lines IS NULL`. The sub-contractor SLICER is a plain filter on top
 * of that — picking Inco is impossible because Inco is not in scope at all.
 */
import { withAsOf } from "@/lib/db";
import type {
  ChartWidget,
  FilterWidget,
  KpiWidget,
  PageModel,
  TextWidget,
  Widget,
} from "@/lib/page-model";
import {
  areaOptionsByHa,
  FILTER_ALL,
  FILTER_BLANK,
  filterOptions,
  PROJECT_EXCLUDED_SUBCONTRACTORS,
  type Scope,
  SOURCES_PR_ALL_LOADED,
} from "@/lib/metrics/scope";
import {
  forecastBacklog,
  forecastBacklogBySubcon,
  forecastOptions,
  diaMonthlyProgress,
  jointMonthlyProgress,
  monthLabel,
  type MonthlyPoint,
  rtBacklogTotal,
  talismanRt100Backlog,
} from "@/lib/metrics/forecast";
import { rtStatsPrAll } from "@/lib/metrics/rt";

export type ForecastFilters = {
  ha?: string;
  area?: string;
  subco?: string;
  byut?: string;
  wcat?: string;
  rt?: string;
  dia?: string;
};

export type ForecastPageOpts = { as_of?: string };

const HONEST_EMPTY = "\u2014";

const FILTER_SPECS = [
  { id: "ha", label: "HA" },
  { id: "area", label: "Area Classification" },
  { id: "subco", label: "Sub-Contractor" },
  { id: "byut", label: "By UT" },
  { id: "wcat", label: "Weld Cat" },
  { id: "rt", label: "RT%" },
  { id: "dia", label: "Dia Inch" },
] as const;

/** The page's own filters, before any slicer. */
function pageScope(): Scope {
  return {
    sources: SOURCES_PR_ALL_LOADED,
    excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS,
    temporaryLines: false,
  };
}

function withForecastFilters(scope: Scope, f: ForecastFilters): Scope {
  const out: Scope = { ...scope };
  if (f.ha === FILTER_BLANK) out.haIsNull = true;
  else if (f.ha) out.ha = f.ha;
  if (f.area) out.areaClassificationLabel = f.area;
  if (f.subco) out.subContractor = f.subco;
  if (f.wcat) out.weldCats = [f.wcat];
  if (f.rt) out.rtPct = Number(f.rt);
  // `byut` and `dia` are pbix calculated columns with no stored equivalent.
  // They are Scope fields so their values are BOUND as parameters like every
  // other filter — never interpolated, since they arrive from a query string.
  if (f.byut) out.byUtAll = f.byut;
  if (f.dia) out.diaBand = f.dia;
  return out;
}

const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function kpi(label: string, value: string, sub?: string): KpiWidget {
  return { kind: "kpi", label, value, ...(sub ? { sub } : {}) };
}

/**
 * A card slice 1 does not compute yet. It carries the OWNER'S TARGET in its
 * `sub`, so the page shows what it will show and the gap is explicit — far
 * better than an empty box that looks like a bug, and impossible to mistake
 * for a computed value because the value itself is an em dash.
 */
function pending(label: string, target: string): KpiWidget {
  return kpi(label, HONEST_EMPTY, `slice 3 — owner target ${target}`);
}

async function filterWidgets(
  applied: ForecastFilters,
  scope: Scope,
): Promise<{ widgets: FilterWidget[]; unknown: boolean }> {
  const [shared, own, areaByHa] = await Promise.all([
    filterOptions(),
    forecastOptions(scope),
    areaOptionsByHa(),
  ]);
  let unknown = false;
  const widgets = FILTER_SPECS.map((f) => {
    const opts =
      f.id === "ha"
        ? [...(shared.ha ?? []), FILTER_BLANK]
        : f.id === "area"
          ? (shared.area ?? [])
          : (own[f.id] ?? []);
    const raw = applied[f.id as keyof ForecastFilters];
    const ok = raw !== undefined && opts.includes(raw);
    if (raw !== undefined && !ok) unknown = true;
    const w: FilterWidget = {
      kind: "filter",
      id: f.id,
      label: f.label,
      options: [FILTER_ALL, ...opts],
      value: ok ? raw! : FILTER_ALL,
    };
    if (f.id === "area") {
      w.parent = "ha";
      w.options_by_parent = areaByHa;
    }
    return w;
  });
  return { widgets, unknown };
}

const SLICE_NOTE =
  "Slices 1-2 of 3. The forecast backlog, the RT/UT totals and the Talisman " +
  "backlog are computed; the remaining cards are present in shape and carry " +
  "their target value in the subtitle until slices 2 and 3 land. A card " +
  "showing \u2014 has not been computed \u2014 it is never a zero.";

const FORECAST_NOTE =
  "The forecast backlog counts joints that are NOT YET WELDED, weighted by RT " +
  "coverage: RT100% at 1.0, RT5% at 0.05, RT10% at 0.1, RT20% at 0.2, RT30% " +
  "at 0.3. It is a different measure from the RT backlog, which counts welded " +
  "joints awaiting a report.";

const TALISMAN_NOTE =
  "RT B.Log Talisman reads sources/Joint.csv (1,548,056 rows, DELETE-flagged " +
  "rows dropped as the pbix does). Its RT% is looked up from the union by " +
  "Joint ID rather than stored, so the two cannot drift.";

const MONTHLY_NOTE =
  "The two monthly charts group by RT DATE, from January 2024, stacked by Weld " +
  "Cat F and S (J excluded). Every month is shown; the owner\u2019s screenshot " +
  "labels alternate months, and our values match the labelled ones to within " +
  "4 joints and 0.05 % of dia \u2014 see lib/metrics/README.md for the " +
  "point-by-point alignment.";

const DONUT_TOTAL_NOTE =
  "The \u201cTotal Forecast Backlog\u201d doughnut includes the TOTAL as a slice " +
  "alongside its own five components, so its slices sum to twice the total. " +
  "That is what the pbix visual does; reproduced verbatim rather than corrected.";

export async function getForecastPage(
  filters: ForecastFilters = {},
  opts: ForecastPageOpts = {},
): Promise<PageModel> {
  const { as_of } = await withAsOf(opts.as_of ?? null);
  const base = pageScope();
  const bar = await filterWidgets(filters, base);
  const applied: ForecastFilters = Object.fromEntries(
    FILTER_SPECS.map((f, i) => [
      f.id,
      bar.widgets[i]!.value === FILTER_ALL ? undefined : bar.widgets[i]!.value,
    ]),
  );
  const scope = withForecastFilters(base, applied);

  const rtScope: Scope = {
    ...scope,
    weldCats: applied.wcat ? [applied.wcat] : ["F", "S"],
  };
  const [fc, bySub, talisman, rt, backlogTotal, jointMonths, diaMonths] =
    await Promise.all([
      forecastBacklog(scope),
      forecastBacklogBySubcon(scope),
      talismanRt100Backlog(),
      rtStatsPrAll(rtScope),
      rtBacklogTotal(rtScope),
      jointMonthlyProgress(scope),
      diaMonthlyProgress(scope),
    ]);

  const notes: string[] = [
    SLICE_NOTE, FORECAST_NOTE, TALISMAN_NOTE, DONUT_TOTAL_NOTE, MONTHLY_NOTE,
  ];
  if (bar.unknown) {
    notes.push(
      "One or more filter values are not present in the data and were ignored " +
        "(treated as \u201cAll\u201d).",
    );
  }

  const SERIES: ReadonlyArray<readonly [string, (b: typeof fc) => number]> = [
    ["RT Total Forecast B.log", (b) => b.total],
    ["RT 100%", (b) => b.weighted[100] ?? 0],
    ["RT 5%", (b) => b.weighted[5] ?? 0],
    ["RT 10%", (b) => b.weighted[10] ?? 0],
    ["RT 20%", (b) => b.weighted[20] ?? 0],
    ["RT 30%", (b) => b.weighted[30] ?? 0],
  ];

  const bar1: ChartWidget = {
    kind: "chart",
    canvas_id: "forecast_bar",
    title: "Total Forecast Backlog",
    chart_type: "bar",
    labels: bySub.map((r) => r.sub_contractor),
    datasets: SERIES.map(([label, pick]) => ({
      label,
      data: bySub.map((r) => Number(pick(r.backlog).toFixed(2))),
    })),
    options_notes: "indexAxis y",
  };

  const done = rt.tested;
  const donutDone: ChartWidget = {
    kind: "chart",
    canvas_id: "forecast_donut_done",
    title: "RT/UT Done / Backlog",
    chart_type: "doughnut",
    labels: ["Done", "RT Total Forecast Backlog"],
    datasets: [{ label: "", data: [done, Number(fc.total.toFixed(2))] }],
  };

  const donutForecast: ChartWidget = {
    kind: "chart",
    canvas_id: "forecast_donut_backlog",
    title: "Total Forecast Backlog",
    chart_type: "doughnut",
    labels: SERIES.map(([l]) => l),
    datasets: [
      { label: "", data: SERIES.map(([, pick]) => Number(pick(fc).toFixed(2))) },
    ],
  };

  /** Both monthly charts are the same shape: F and S stacked, by RT month. */
  const monthlyChart = (
    id: string,
    title: string,
    points: MonthlyPoint[],
    round: boolean,
  ): ChartWidget => ({
    kind: "chart",
    canvas_id: id,
    title,
    chart_type: "bar",
    labels: points.map((p) => monthLabel(p.month)),
    datasets: [
      { label: "F", data: points.map((p) => (round ? Math.round(p.f) : p.f)) },
      { label: "S", data: points.map((p) => (round ? Math.round(p.s) : p.s)) },
    ],
    options_notes: "stacked",
  });

  const widgets: Widget[] = [
    ...bar.widgets,
    bar1,
    kpi("Total RT/UT Done", num(done)),
    donutDone,
    donutForecast,
    kpi(
      "RT B.Log Talisman",
      talisman === null ? HONEST_EMPTY : num(talisman),
      talisman === null ? "sources/Joint.csv not loaded" : undefined,
    ),
    kpi("RT Total Forecast B.log", num(fc.total)),
    pending("RT Dia Total Forecast B.log", "124,613"),
    pending("Numb RT/UT 2024", "172,520"),
    pending("RT Avrg Prod-on 2024-26 per Month", "5,324"),
    pending("QTY Years", "0.21"),
    kpi("RT B.Log", num(backlogTotal)),
    pending("Numb RT/UT_", "172,520"),
    pending("Months to keep RT B.log", "0.13"),
    pending("PWHT B.Log PBI Rule", "1,038"),
    pending("RT Dia B.Log", "6,832"),
    pending("Total Welded RT Dia", "1,712,883"),
    pending("RT Dia Avrg Prod-on", "50,954"),
    pending("Months to keep Dia RT B.log", "0.13"),
    monthlyChart(
      "forecast_joint_monthly",
      "Joint RT/UT Monthly Progress (Project)",
      jointMonths,
      false,
    ),
    monthlyChart(
      "forecast_dia_monthly",
      "Dia RT/UT Monthly Progress (Project)",
      diaMonths,
      true,
    ),
    ...notes.map((text): TextWidget => ({ kind: "text", text })),
  ];

  return {
    page: 0,
    id: "forecast",
    title: "RT Backlog Forecast",
    widgets,
    filters: Object.fromEntries(
      FILTER_SPECS.map((f, i) => [f.id, bar.widgets[i]!.value]),
    ),
    meta: { source: "database", as_of },
  };
}
