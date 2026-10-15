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
  FILTER_SEP,
  filterValues,
  haAreaPicks,
  PAIR_SEP,
  filterOptions,
  PROJECT_EXCLUDED_SUBCONTRACTORS,
  type Scope,
  SOURCES_PR_ALL_LOADED,
} from "@/lib/metrics/scope";
import {
  forecastBacklog,
  forecastBacklogBySubcon,
  forecastOptions,
  forecastTotals,
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
  // Multi-select (2026-10-14): every slicer is a comma-joined list; HA ▸ Area
  // picks are OR-ed exactly as on page 1.
  const picks = haAreaPicks(f);
  if (picks.length) out.haArea = picks;
  const subcos = filterValues(f.subco);
  if (subcos?.length === 1) out.subContractor = subcos[0];
  else if (subcos) out.subContractors = subcos;
  const wcats = filterValues(f.wcat);
  if (wcats) out.weldCats = wcats;
  const rts = filterValues(f.rt)?.map(Number).filter((n) => Number.isFinite(n));
  if (rts?.length) out.rtPcts = rts;
  // `byut` and `dia` are pbix calculated columns with no stored equivalent.
  // They are Scope fields so their values are BOUND as parameters like every
  // other filter — never interpolated, since they arrive from a query string.
  const byut = filterValues(f.byut);
  if (byut) out.byUtAlls = byut;
  const dia = filterValues(f.dia);
  if (dia) out.diaBands = dia;
  return out;
}

const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function kpi(label: string, value: string, sub?: string): KpiWidget {
  return { kind: "kpi", label, value, ...(sub ? { sub } : {}) };
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
    // Multi-select: keep the picks that exist; an `area` pick may be HA>Area.
    const picked = filterValues(applied[f.id as keyof ForecastFilters]) ?? [];
    const haOpts = [...(shared.ha ?? []), FILTER_BLANK];
    const exists = (v: string) => {
      if (f.id !== "area" || !v.includes(PAIR_SEP)) return opts.includes(v);
      const i = v.indexOf(PAIR_SEP);
      return haOpts.includes(v.slice(0, i)) && opts.includes(v.slice(i + 1));
    };
    const kept = picked.filter(exists);
    if (kept.length < picked.length) unknown = true;
    const w: FilterWidget = {
      kind: "filter",
      id: f.id,
      label: f.label,
      options: [FILTER_ALL, ...opts],
      value: kept.length ? kept.join(FILTER_SEP) : FILTER_ALL,
      multi: true,
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
  "Every card and chart on this page is computed. Three cards differ from the " +
  "report owner\u2019s screenshot and say so on the card; none has been tuned to " +
  "match. A card showing \u2014 is one this data cannot support, never a zero.";

const FORECAST_NOTE =
  "The forecast backlog counts joints that are NOT YET WELDED, weighted by RT " +
  "coverage: RT100% at 1.0, RT5% at 0.05, RT10% at 0.1, RT20% at 0.2, RT30% " +
  "at 0.3. It is a different measure from the RT backlog, which counts welded " +
  "joints awaiting a report.";

const TALISMAN_NOTE =
  "RT B.Log Talisman reads sources/Joint.csv (1,548,056 rows, DELETE-flagged " +
  "rows dropped as the pbix does). Its RT% is looked up from the union by " +
  "Joint ID rather than stored, so the two cannot drift.";

// Cards whose value differs from the owner's screenshot. Each says so on the
// card itself rather than only in a report, so nobody reads a near-miss as
// agreement. None of them is tuned; see lib/metrics/README.md for the branch
// split behind each.
const NEAR_MISS_2024 = "owner reads 172,520 (\u0394 +1) \u2014 see README";
const NEAR_MISS_WELDED_DIA =
  "owner reads 1,712,883 (\u0394 \u2212420, 0.02 %) \u2014 see README";
// The owner's own two dia cards are inconsistent with each other under the
// DAX's formula: 1,712,883 / 970 days x 30 = 52,976, not the 50,954 their
// average card shows. Both cannot be reproduced at once, so neither is chased.
const NEAR_MISS_DIA_AVG =
  "owner reads 50,954 (\u0394 \u221213, 0.03 %) \u2014 see README";

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
    weldCats: filterValues(applied.wcat) ?? ["F", "S"],
  };
  const [fc, bySub, talisman, rt, backlogTotal, jointMonths, diaMonths] =
    await Promise.all([
      forecastBacklog(scope),
      forecastBacklogBySubcon(scope),
      talismanRt100Backlog(scope, {
        sliced: Object.values(applied).some((v) => v !== undefined),
      }),
      rtStatsPrAll(rtScope),
      rtBacklogTotal(rtScope),
      jointMonthlyProgress(scope),
      diaMonthlyProgress(scope),
    ]);
  const totals = await forecastTotals(scope);

  /** `x / y`, rendered to 2 dp, honest-empty when the denominator is absent. */
  const ratio = (a: number, b: number | null, dp = 2) =>
    b === null || b === 0 ? HONEST_EMPTY : (a / b).toFixed(dp);

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
    // ChartCard draws grouped bars without this: the pbix column charts stack
    // F and S with the total on top.
    options_notes: "stacked (x), stacked (y)",
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
    kpi("RT Dia Total Forecast B.log", num(totals.dia_forecast)),
    kpi("Numb RT/UT 2024", num(totals.numb_rt_2024), NEAR_MISS_2024),
    // The pbix shows this measure on TWO cards with different visual filters:
    // 322a takes none, f28b filters the weld-date week end. Both are rendered.
    kpi(
      "RT Avrg Prod-on 2024-26 per Month",
      totals.avg_prod_month === null ? HONEST_EMPTY : num(totals.avg_prod_month),
    ),
    kpi(
      "RT Avrg Prod-on (week-end filtered)",
      totals.avg_prod_month_weld === null
        ? HONEST_EMPTY
        : num(totals.avg_prod_month_weld),
    ),
    // [QTY Years for RT Backlog Forecast] = forecast / avg per month / 12.
    kpi("QTY Years", ratio(fc.total, (totals.avg_prod_month ?? 0) * 12)),
    kpi("RT B.Log", num(backlogTotal)),
    // The pbix shows the same measure twice, once per Calendar relationship.
    kpi("Numb RT/UT_", num(totals.numb_rt_2024), NEAR_MISS_2024),
    kpi("Months to keep RT B.log", ratio(backlogTotal, totals.avg_prod_month)),
    kpi("PWHT B.Log PBI Rule", num(totals.pwht_backlog_pbi)),
    kpi("RT Dia B.Log", num(totals.dia_backlog)),
    kpi("Total Welded RT Dia", num(totals.welded_dia), NEAR_MISS_WELDED_DIA),
    kpi(
      "RT Dia Avrg Prod-on",
      totals.dia_avg_prod_month === null
        ? HONEST_EMPTY
        : num(totals.dia_avg_prod_month),
      NEAR_MISS_DIA_AVG,
    ),
    kpi(
      "Months to keep Dia RT B.log",
      ratio(totals.dia_backlog, totals.dia_avg_prod_month),
    ),
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
    ...notes.map((text): TextWidget => ({ kind: "text", text, note: true })),
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
