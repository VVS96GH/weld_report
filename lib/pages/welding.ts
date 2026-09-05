/**
 * The 44 welding-report page assemblers.
 *
 * `getWeldingPage(n)` returns a `PageModel` (lib/page-model.ts, FROZEN) whose
 * widget order, titles, KPI labels and table column headers are taken from
 * `analysis/mockups/welding-spec.json` — the extraction of the mockup that the
 * UI renders against — and whose *values* come from SQL in `lib/metrics/*`
 * built to `analysis/calculation-logic.md` §3's build sheet.
 *
 * ── Honest-empty policy ─────────────────────────────────────────────────────
 * Nothing here ever fabricates a zero. A cell whose metric cannot be computed
 * from the loaded sources renders **blank** in a table and `"—"` in a KPI, and
 * the page carries a trailing `text` widget naming the missing source. The
 * cases, all traced to `analysis/calculation-logic.md` §5:
 *
 *   • CCC pages 3, 7, 12–18, 41 and the CCC/ACCIONA/INCO slice of pages 1–2 —
 *     `Weld Dump.txt` holds **zero** CCC rows and (after the load filters)
 *     zero ACCIONA rows; the Talisman exports are not in `sources/` (R-01).
 *   • project-scope UT KPIs (M32/M34/M35/M36/M39) — the three UT tracker
 *     workbooks behind `[Manual UT Report No.]` are missing (R-05).
 *   • every `FABRICATED` metric (M44/M48/M49) — needs `Spool Dump.txt` (R-01).
 *   • the RT/PWHT backlog bars and cumulative rejection lines (M80/M92) — the
 *     history is unrecoverable from one dump; they read `weld_weekly_snapshot`
 *     and stay empty until the ETL has appended weeks (R-08).
 *   • `Project_Welder` (M90) and `WPS Approved` (M91) — manual registers
 *     `ref_qualified_welders` / `ref_wps_register` (R-12).
 *   • M52 coverage-gap columns (`RT5%/10%/20% B.log Joints`) — CCC pages only.
 *
 * ── Scope note ──────────────────────────────────────────────────────────────
 * All figures are the `"EP"`/`"WD"` family (source `WELD_DUMP`). The `"PR all"`
 * twins the mockup mostly rendered need the four-source union; with only the
 * weld dump loaded the two families differ by the repair/reweld handling and
 * by the missing subcontractors. The `"PR"` scope is not implemented at all
 * (ruling R-06: it is a one-row dead table in the shipped pbix).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { withAsOf } from "@/lib/db";
import type {
  ChartWidget,
  KpiWidget,
  PageModel,
  TableWidget,
  TextWidget,
  Widget,
} from "@/lib/page-model";
import {
  type AgingBuckets,
  backlogAging,
  backlogAgingBy,
  rtAggs,
  rtBacklogAggs,
  rtBacklogCond,
  rtBacklogStatsFromRow,
  rtStatsFromRow,
  type RtBacklogStats,
  type RtStats,
} from "@/lib/metrics/rt";
import {
  pwhtAggs,
  pwhtBacklogCond,
  pwhtStatsFromRow,
  type PwhtStats,
} from "@/lib/metrics/pwht";
import { utAggs, utStatsFromRow, type UtStats } from "@/lib/metrics/ut";
import {
  weldingAggs,
  weldingStatsFromRow,
  weldTypeDistribution,
  weldTypePivot,
  type WeldingStats,
  type WeldTypePivot,
} from "@/lib/metrics/welding";
import { wpsRejectionTable } from "@/lib/metrics/wps";
import { approvedWpsCount, qualifiedWelders } from "@/lib/metrics/refs";
import {
  latestWeekEnd,
  SNAPSHOT_METRICS,
  weeklyProgress,
  weeklySnapshot,
} from "@/lib/metrics/trend";
import {
  buildGroupedSelect,
  type GroupSpec,
  Params,
  type Scope,
  scopeWhere,
} from "@/lib/metrics/scope";
import { query } from "@/lib/db";

// ── the mockup spec ─────────────────────────────────────────────────────────

type SpecKpi = { kind: "kpi"; label: string; value: string; sub: string | null };
type SpecTable = {
  kind: "table";
  title: string | null;
  columns: string[];
  rows: string[][];
  total_row: string[] | null;
};
type SpecChart = {
  kind: "chart";
  canvas_id: string;
  title: string;
  chart_type: string;
  labels: string[];
  datasets: Array<{ label?: string | null; data: unknown[]; stack?: string | null }>;
  options_notes: string[];
};
type SpecText = { kind: "text"; text: string };
export type SpecWidget = SpecKpi | SpecTable | SpecChart | SpecText;
export type SpecPage = {
  page: number;
  id: string;
  title: string;
  subtitle: string | null;
  widgets: SpecWidget[];
};

let specCache: SpecPage[] | null = null;

/**
 * Load `analysis/mockups/welding-spec.json`. Read from disk rather than
 * `import`ed so a 400 KB literal never lands in the TypeScript type checker or
 * the client bundle. Resolved against the repo root (`process.cwd()`), with
 * a module-relative fallback for test runners started elsewhere.
 */
export function specPages(): SpecPage[] {
  if (specCache) return specCache;
  const rel = "analysis/mockups/welding-spec.json";
  const candidates = [
    path.join(process.cwd(), rel),
    path.join(process.cwd(), "..", rel),
  ];
  let text: string | null = null;
  for (const c of candidates) {
    try {
      text = readFileSync(c, "utf8");
      break;
    } catch {
      /* try the next candidate */
    }
  }
  if (text === null) {
    throw new Error(
      `welding-spec.json not found; looked in ${candidates.join(", ")}`,
    );
  }
  const parsed = JSON.parse(text) as { pages: SpecPage[] };
  specCache = parsed.pages;
  return specCache;
}

export function specPage(n: number): SpecPage {
  const p = specPages().find((x) => x.page === n);
  if (!p) throw new Error(`no mockup spec for page ${n}`);
  return p;
}

/** Page number → title, for `GET /api/welding`. */
export function weldingPageIndex(): Array<{ page: number; title: string }> {
  return specPages().map((p) => ({ page: p.page, title: p.title }));
}

export const TOTAL_PAGES = 44;

// ── formatting ──────────────────────────────────────────────────────────────

/** KPI placeholder for a metric the loaded sources cannot produce. */
export const HONEST_EMPTY = "—";

const NF = new Intl.NumberFormat("en-US");

function fixed(dp: number): Intl.NumberFormat {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** Table cell: integers, blank for zero (the mockup leaves empty cells blank). */
function cellInt(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return "";
  return NF.format(v);
}

/** Table cell: `1.58%`, blank when the denominator was 0 (DAX `DIVIDE`). */
function cellPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return `${fixed(2).format(v * 100)}%`;
}

/** Table cell: `3,269.79`, blank for zero. */
function cellNum(v: number | null | undefined, dp: number): string {
  if (v === null || v === undefined || v === 0) return "";
  return fixed(dp).format(v);
}

function kpiInt(v: number | null | undefined): string {
  return v === null || v === undefined ? HONEST_EMPTY : NF.format(v);
}

function kpiPct(v: number | null | undefined): string {
  return v === null || v === undefined ? HONEST_EMPTY : `${fixed(2).format(v * 100)}%`;
}

// ── metric bundle ───────────────────────────────────────────────────────────

export type Bundle = {
  /**
   * `false` when the query returned no row at all — the metric is *unknown*,
   * not zero. Callers render blank / "—" rather than a fabricated 0.
   */
  present: boolean;
  welding: WeldingStats;
  rt: RtStats;
  ut: UtStats;
  pwht: PwhtStats;
  backlog: RtBacklogStats;
  rtAging: AgingBuckets | null;
  pwhtAging: AgingBuckets | null;
};

const EMPTY_AGING: AgingBuckets = {
  within_3: 0,
  "3_to_7": 0,
  "7_to_15": 0,
  "15_to_30": 0,
  above_30: 0,
  no_weld_date: 0,
};

function emptyBundle(): Bundle {
  return {
    present: false,
    welding: {
      joints_welded: 0,
      joints_welded_incl_repair_reweld: 0,
      mt_pt_done: 0,
      mt_done: 0,
      dia_inch: null,
    },
    rt: {
      tested: 0,
      accepted: 0,
      rejected: 0,
      rejection_rate_joint: null,
      films: 0,
      films_accepted: 0,
      films_acc_sum: 0,
      films_rejected: 0,
      film_rejection_rate: null,
      films_all: 0,
      films_all_accepted: 0,
      films_all_rejected: 0,
    },
    ut: {
      ut_done: 0,
      ut_accepted: 0,
      ut_rejected: 0,
      ut_rejection_rate_joint: null,
      ut_weld_length_m: 0,
      ut_rej_length_m: 0,
    },
    pwht: {
      pwht_backlog_all_types: 0,
      pwht_backlog_rt_types: 0,
      pwht_backlog_rt100: 0,
      pwht_backlog_rt_not_done: 0,
      pwht_done: 0,
      pwht_required: 0,
    },
    backlog: {
      rt_backlog: 0,
      rt100_backlog: 0,
      rt_backlog_pwht_y_done: 0,
      rt_backlog_pwht_n: 0,
      rt_backlog_pwht_y_not_done: 0,
    },
    rtAging: null,
    pwhtAging: null,
  };
}

function bundleFromRow(raw: unknown): Bundle {
  return {
    present: true,
    welding: weldingStatsFromRow(raw),
    rt: rtStatsFromRow(raw),
    ut: utStatsFromRow(raw),
    pwht: pwhtStatsFromRow(raw),
    backlog: rtBacklogStatsFromRow(raw),
    rtAging: null,
    pwhtAging: null,
  };
}

function allAggs(p: Params) {
  return [
    ...weldingAggs(p),
    ...rtAggs(p),
    ...utAggs(p),
    ...rtBacklogAggs(p),
    ...pwhtAggs(p),
  ];
}

/**
 * One round-trip for every non-aging metric a widget group needs, at the
 * scope's grand total. This is the "batch per widget group" the brief asks
 * for: a 14-column table costs one query, not fourteen.
 */
async function bundleTotal(scope: Scope): Promise<Bundle> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: allAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return rows[0] ? bundleFromRow(rows[0]) : emptyBundle();
}

/** The same bundle grouped by one dimension. */
async function bundleBy(
  scope: Scope,
  group: GroupSpec,
): Promise<Map<string | null, Bundle>> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [group],
    aggs: allAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  const out = new Map<string | null, Bundle>();
  for (const raw of rows) {
    const rec = raw as Record<string, unknown>;
    const key = rec[group.key] === null || rec[group.key] === undefined
      ? null
      : String(rec[group.key]);
    out.set(key, bundleFromRow(raw));
  }
  return out;
}

const GROUP_WELD_CAT: GroupSpec = { key: "weld_cat", sql: "w.weld_cat" };
const GROUP_SERVICE_CLASS: GroupSpec = {
  key: "service_class_cat_wd",
  sql: "w.service_class_cat_wd",
};
const GROUP_RT_PCT: GroupSpec = { key: "rt_pct", sql: "w.rt_pct::text" };
const GROUP_SUBCON: GroupSpec = {
  key: "sub_contractor",
  sql: "w.sub_contractor",
};

// ── header → value ──────────────────────────────────────────────────────────

/**
 * Table column headers that name a metric this layer cannot compute from the
 * loaded sources. They render blank, and the page discloses why.
 */
const UNAVAILABLE_HEADERS = new Map<string, string>([
  ["RT Backlog FABRICATED", "Spool Dump.txt (FABRICATED status) is not loaded"],
  ["RT B.log & FAB-D", "Spool Dump.txt (FABRICATED status) is not loaded"],
  [
    'RT B.log & PWHT "Y" Done + PWHT "N" FAB-D',
    "Spool Dump.txt (FABRICATED status) is not loaded",
  ],
  [
    'RT B.LOG & PWHT"Y" NOT Done FAB-D',
    "Spool Dump.txt (FABRICATED status) is not loaded",
  ],
  [
    'RT B.Log & PWHT"Y" NOT Done FAB-D',
    "Spool Dump.txt (FABRICATED status) is not loaded",
  ],
  ["UT Def Len m", "the UT tracker workbooks are not loaded (M34)"],
  ["UT Def Len.m", "the UT tracker workbooks are not loaded (M34)"],
  ["UT Def. Len.m", "the UT tracker workbooks are not loaded (M34)"],
  ["UT Insp Len m", "the UT tracker workbooks are not loaded (M35)"],
  ["% Rej UT Len", "the UT tracker workbooks are not loaded (M36)"],
  ["UT Rej% Len", "the UT tracker workbooks are not loaded (M36)"],
  ["% of Rej UT by Length", "the UT tracker workbooks are not loaded (M36)"],
  ["RT5% B.log Joints", "M52 needs the CCC service-class grain (HA / NDT Remarks)"],
  ["RT10% B.log Joints", "M52 needs the CCC service-class grain (HA / NDT Remarks)"],
  ["RT20% B.log Joints", "M52 needs the CCC service-class grain (HA / NDT Remarks)"],
  ["RT20% Backlog", "M52 needs the CCC service-class grain (HA / NDT Remarks)"],
]);

/**
 * Render one metric cell. Returns `null` when the header is not a metric this
 * function knows (weld-type pivot columns, row keys), so callers can fall
 * through to their own handling.
 */
function metricCell(header: string, b: Bundle): string | null {
  if (UNAVAILABLE_HEADERS.has(header)) return "";
  // No result row for this group: unknown, not zero.
  if (!b.present) return "";
  switch (header) {
    // ── welding ──
    case "Joints Welded":
      return cellInt(b.welding.joints_welded);
    case '"F"+"S" Weld Qty':
      return cellInt(b.welding.joints_welded);
    case "MT+PT Qty":
    case "MT/PT Done":
      return cellInt(b.welding.mt_pt_done);
    // ── RT joints ──
    case "Numb RT/UT":
    case "Tested Joints":
      return cellInt(b.rt.tested);
    case 'Numb RT/UT "A"':
    case 'RT/UT "A"':
    case "RT/UT Acc":
    case "Accepted RT/UT":
    case "RT Acc.Joints":
      return cellInt(b.rt.accepted);
    case 'Numb RT/UT "R"':
    case 'RT/UT "R"':
    case "RT/UT Rej":
    case "Rejected RT/UT":
      return cellInt(b.rt.rejected);
    case "RT/UT Ratio %":
      return cellPct(
        b.welding.joints_welded === 0
          ? null
          : b.rt.tested / b.welding.joints_welded,
      );
    case "Rejection Rate Joint":
    case "% Rej by Joint":
      return cellPct(b.rt.rejection_rate_joint);
    // ── films by joint (M20/M22/M25) ──
    case "Films Taken":
      return cellInt(b.rt.films);
    case "Films Acc":
      return cellInt(b.rt.films_accepted);
    case "Films Rej":
      return cellInt(b.rt.films_rejected);
    case "RT% Film Rej":
    case "% of Total Rej":
    case "% Total Rej":
    case "RT% of Total Rej":
      return cellPct(b.rt.film_rejection_rate);
    // ── films, all weld points (M26) ──
    case "RT Total Films":
      return cellInt(b.rt.films_all);
    case 'RT Films "A"':
      return cellInt(b.rt.films_all_accepted);
    case 'RT Films "R"':
      return cellInt(b.rt.films_all_rejected);
    case "RT FILM Ratio %":
      return cellPct(
        b.rt.films_all === 0 ? null : b.rt.films_all_rejected / b.rt.films_all,
      );
    // ── UT ──
    case "Numb UT":
    case "UT Done":
      return cellInt(b.ut.ut_done);
    case 'UT "A"':
      return cellInt(b.ut.ut_accepted);
    case 'UT "R"':
      return cellInt(b.ut.ut_rejected);
    case "UT Ratio %":
      return cellPct(
        b.welding.joints_welded === 0
          ? null
          : b.ut.ut_done / b.welding.joints_welded,
      );
    case "UT Weld Len.m":
      return cellNum(b.ut.ut_weld_length_m, 2);
    case "% Rej UT Joint":
    case "% of Rej UT by Joint (EP)":
      return cellPct(b.ut.ut_rejection_rate_joint);
    // ── RT backlog ──
    case "RT Backlog":
    case "Total RT Backlog":
    case "Total RT B.log":
    case "RT B.LOG Total":
    case "RT Backlog Total":
    case "RT B.Log Total Project":
      return cellInt(b.backlog.rt_backlog);
    case "RT100% Backlog":
    case "RT100% B.log":
    case "RT 100% Backlog":
      return cellInt(b.backlog.rt100_backlog);
    case 'RT+PWHT "Y" Done':
    case 'RT Backlog+ PWHT "Y" Done':
    case 'RT B.log & PWHT "Y" Done':
      return cellInt(b.backlog.rt_backlog_pwht_y_done);
    case 'RT+PWHT "N"':
    case 'RT Backlog +PWHT "N"':
    case 'RT Backlog+ PWHT"N"':
    case 'RT B.log & PWHT "N"':
      return cellInt(b.backlog.rt_backlog_pwht_n);
    case "RT B.LOG & PWHT NOT Done":
    case "RT B.log & PWHT NOT Done":
    case 'RT B.LOG & PWHT "Y" NOT Done':
    case 'RT Backlog & PWHT "Y" NOT Done':
      return cellInt(b.backlog.rt_backlog_pwht_y_not_done);
    // ── PWHT ──
    case "PWHT Backlog":
    case "PWHT Backlog All":
    case "PWHT Backlog All Types":
      return cellInt(b.pwht.pwht_backlog_all_types);
    case "PWHT Backlog Total for RT":
    case "PWHT B.log for RT":
    case "PWHT Backlog for RT":
      return cellInt(b.pwht.pwht_backlog_rt_types);
    case "PWHT BACKLOG by RT100%":
    case "PWHT Backlog by RT100%":
    case "PWHT B.log RT100%":
    case "PWHT Backlog RT100%":
      return cellInt(b.pwht.pwht_backlog_rt100);
    case "PWHT B.Log RT NOT Done":
    case "PWHT B.log+RT NOT Done":
      return cellInt(b.pwht.pwht_backlog_rt_not_done);
    case "PWHT Done":
      return cellInt(b.pwht.pwht_done);
    // ── aging (M51 for NDE pages, M66 for PWHT pages) ──
    case "within 3 Days":
      return agingCell(b, "within_3");
    case "3 to 7 Days":
      return agingCell(b, "3_to_7");
    case "7 to 15 Days":
      return agingCell(b, "7_to_15");
    case "15 to 30 Days":
      return agingCell(b, "15_to_30");
    case "above 30 Days":
    case "above 30":
      return agingCell(b, "above_30");
    default:
      return null;
  }
}

function agingCell(b: Bundle, key: keyof AgingBuckets): string {
  const src = b.pwhtAging ?? b.rtAging;
  if (!src) return "";
  return cellInt(src[key]);
}

// ── generic table builders ──────────────────────────────────────────────────

type RowSpec = { label: string; bundle: Bundle };

function metricTable(
  spec: SpecTable,
  rows: RowSpec[],
  totalBundle: Bundle,
): TableWidget {
  const render = (label: string, b: Bundle): string[] =>
    spec.columns.map((c, i) => {
      if (i === 0) return label;
      const v = metricCell(c, b);
      return v ?? "";
    });
  const body = rows.map((r) => render(r.label, r.bundle));
  const total = render("Total", totalBundle);
  return {
    kind: "table",
    title: spec.title ?? "",
    columns: spec.columns,
    rows: [...body, total],
    total_row: total,
  };
}

const CAT_ORDER = ["F", "S"];

function orderedCats(keys: Iterable<string | null>): string[] {
  const seen = [...keys].filter((k): k is string => k !== null && k !== "");
  seen.sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a);
    const ib = CAT_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
  return seen;
}

/** The `Cumulative Welding Status` / `Welding Status for this Week` pivot. */
function weldTypeTable(spec: SpecTable, pivot: WeldTypePivot): TableWidget {
  const typeCols = spec.columns.slice(1, -1);
  const render = (
    label: string,
    row: Map<string | null, number> | null,
    total: number,
  ): string[] => [
    label,
    ...typeCols.map((t) => cellInt(row?.get(t) ?? 0)),
    cellInt(total),
  ];
  const cats = orderedCats(pivot.cells.keys());
  const body = cats.map((c) =>
    render(c, pivot.cells.get(c) ?? null, pivot.catTotals.get(c) ?? 0),
  );
  const totalRow = render(
    "Total",
    // Column totals are per weld type across every cat — a distinct-count
    // rollup, so they come from the (weld_cat) grouping set, not a sum.
    mergeTypeTotals(pivot),
    pivot.total,
  );
  return {
    kind: "table",
    title: spec.title ?? "",
    columns: spec.columns,
    rows: [...body, totalRow],
    total_row: totalRow,
  };
}

function mergeTypeTotals(pivot: WeldTypePivot): Map<string | null, number> {
  // `count(DISTINCT joint_id)` is not additive across weld cats, but a joint
  // has exactly one weld type per row and the pbix matrix sums the cat rows,
  // so the column total is the sum of the cat cells.
  const out = new Map<string | null, number>();
  for (const row of pivot.cells.values()) {
    for (const [t, v] of row) out.set(t, (out.get(t) ?? 0) + v);
  }
  return out;
}

function textWidget(text: string): TextWidget {
  return { kind: "text", text };
}

function emptyKpi(spec: SpecKpi): KpiWidget {
  return { kind: "kpi", label: spec.label, value: HONEST_EMPTY };
}

function emptyTable(spec: SpecTable): TableWidget {
  return {
    kind: "table",
    title: spec.title ?? "",
    columns: spec.columns,
    rows: [],
  };
}

function emptyChart(spec: SpecChart): ChartWidget {
  return {
    kind: "chart",
    canvas_id: spec.canvas_id,
    title: spec.title,
    chart_type: spec.chart_type,
    labels: [],
    datasets: spec.datasets.map((d) => ({ label: d.label ?? "", data: [] })),
    options_notes: spec.options_notes.join(", ") || undefined,
  };
}

function emptyWidget(spec: SpecWidget): Widget {
  switch (spec.kind) {
    case "kpi":
      return emptyKpi(spec);
    case "table":
      return emptyTable(spec);
    case "chart":
      return emptyChart(spec);
    case "text":
      return textWidget(spec.text);
  }
}

// ── page context ────────────────────────────────────────────────────────────

type Ctx = {
  asOf: string;
  asOfOrigin: string;
  notes: Set<string>;
};

function note(ctx: Ctx, msg: string): void {
  ctx.notes.add(msg);
}

const CCC_NOTE =
  "CCC is not loaded: sources/ holds no CCC rows and the Talisman exports " +
  "(CSVExport_Welder Record.csv, AllTrain_CSVExport_Joint Record.csv) are " +
  "missing, so every figure on this page is unavailable — not zero.";

const TREND_NOTE =
  "Weekly backlog and cumulative rejection-rate charts read " +
  "weld_weekly_snapshot; the history cannot be recomputed from a single dump " +
  "(the DAX ages on TODAY()). The table is empty, so the charts are empty.";

const UT_TRACKER_NOTE =
  "Project-scope UT metrics (UT Insp Len, UT Def.Length, % Rej UT Len, " +
  "Numb UT/PAUT) need UT TRACKER (CCC/GAC/TEK); those workbooks are not in " +
  "sources/, so those KPIs render blank rather than 0.";

const FABRICATED_NOTE =
  "FABRICATED columns need Spool Dump.txt, which is not in sources/.";

const MT_PT_SERIES_NOTE =
  "The 'MT+PT Qty' series on the weekly progress chart is empty: " +
  "mv_weekly_progress does not carry MT/PT counts, so there is nothing to " +
  "plot per week (the page-total MT/PT Done KPI is computed).";

const REGISTER_NOTE =
  "Project_Welder and WPS Approved come from the manual registers " +
  "ref_qualified_welders / ref_wps_register; both are empty.";

const PROJECT_SCOPE_NOTE =
  "Project totals cover the loaded sources only (Weld Dump: GAC, TEKFEN, " +
  "MEDGULF). CCC, ACCIONA and INCO are not loaded, so these numbers are not " +
  "the full project scope the mockup showed.";

// ── page families ───────────────────────────────────────────────────────────

/** Pages whose every widget is unavailable, with the reason. */
const UNAVAILABLE_PAGES = new Map<number, string>([
  [3, CCC_NOTE],
  [7, CCC_NOTE],
  [12, CCC_NOTE],
  [13, CCC_NOTE],
  [14, CCC_NOTE],
  [15, CCC_NOTE],
  [16, CCC_NOTE],
  [17, CCC_NOTE],
  [18, CCC_NOTE],
  [41, CCC_NOTE],
]);

type SubconConf = {
  sub: string;
  serviceCat?: "SG" | "NONSG";
  tmcpPipe?: boolean;
  /** `Weld Type NOT IN {…}` — the per-WPS pivots drop `DMY` (§3.4). */
  excludeWeldTypes?: readonly string[];
};

/** mockup page → subcontractor scope for the NDE/PWHT pages 19–40. */
const NDE_PAGES = new Map<
  number,
  { sub: string; rtPct: number; kind: "nde" | "pwht" }
>([
  [19, { sub: "GAC", rtPct: 100, kind: "nde" }],
  [20, { sub: "GAC", rtPct: 100, kind: "pwht" }],
  [21, { sub: "GAC", rtPct: 5, kind: "nde" }],
  [22, { sub: "GAC", rtPct: 5, kind: "pwht" }],
  [23, { sub: "GAC", rtPct: 10, kind: "nde" }],
  [24, { sub: "GAC", rtPct: 10, kind: "pwht" }],
  [25, { sub: "GAC", rtPct: 20, kind: "nde" }],
  [26, { sub: "GAC", rtPct: 30, kind: "nde" }],
  [27, { sub: "TEKFEN", rtPct: 100, kind: "nde" }],
  [28, { sub: "TEKFEN", rtPct: 100, kind: "pwht" }],
  [29, { sub: "TEKFEN", rtPct: 5, kind: "nde" }],
  [30, { sub: "TEKFEN", rtPct: 5, kind: "pwht" }],
  [31, { sub: "TEKFEN", rtPct: 10, kind: "nde" }],
  [32, { sub: "TEKFEN", rtPct: 10, kind: "pwht" }],
  [33, { sub: "TEKFEN", rtPct: 20, kind: "nde" }],
  [34, { sub: "MEDGULF", rtPct: 100, kind: "nde" }],
  [35, { sub: "MEDGULF", rtPct: 100, kind: "pwht" }],
  [36, { sub: "MEDGULF", rtPct: 5, kind: "nde" }],
  [37, { sub: "MEDGULF", rtPct: 5, kind: "pwht" }],
  [38, { sub: "MEDGULF", rtPct: 10, kind: "nde" }],
  [39, { sub: "MEDGULF", rtPct: 10, kind: "pwht" }],
  [40, { sub: "MEDGULF", rtPct: 20, kind: "nde" }],
]);

/** mockup page → subcontractor scope for the status pages 4–6 and 8–11. */
const SUBCON_PAGES = new Map<number, SubconConf[]>([
  // page 4 renders GAC twice: "Except SLG Service" then "SLG Service Only".
  [4, [{ sub: "GAC", serviceCat: "NONSG" }, { sub: "GAC", serviceCat: "SG" }]],
  [5, [{ sub: "TEKFEN", tmcpPipe: false }]],
  [6, [{ sub: "MEDGULF" }]],
  [8, [{ sub: "GAC", serviceCat: "NONSG" }]],
  [9, [{ sub: "GAC", serviceCat: "SG" }]],
  [10, [{ sub: "TEKFEN", tmcpPipe: false }]],
  [11, [{ sub: "MEDGULF" }]],
]);

/** mockup page → the per-WPS pivots on pages 42–44 (page 41 is CCC). */
const WPS_PAGES = new Map<number, SubconConf[]>([
  // §3.4: the GAC "Except Slug Catcher" pivot drops `DMY`; the Slug-Catcher
  // pivot (the `Weld Dump` visual) does not.
  [
    42,
    [
      { sub: "GAC", serviceCat: "NONSG", excludeWeldTypes: ["DMY"] },
      { sub: "GAC", serviceCat: "SG" },
    ],
  ],
  [
    43,
    [
      { sub: "TEKFEN", tmcpPipe: false, excludeWeldTypes: ["DMY"] },
      { sub: "TEKFEN", tmcpPipe: true, excludeWeldTypes: ["DMY"] },
    ],
  ],
  [44, [{ sub: "MEDGULF", tmcpPipe: false, excludeWeldTypes: ["DMY"] }]],
]);

function baseScope(conf: SubconConf): Scope {
  return {
    subContractor: conf.sub,
    serviceCat: conf.serviceCat,
    tmcpPipe: conf.tmcpPipe,
    // Every pbix page in this family carries `Temporary Lines "WD" IN {null}`.
    temporaryLines: false,
  };
}

// ── the assembler ───────────────────────────────────────────────────────────

export type WeldingPageOpts = { as_of?: string };

/**
 * Build one of the 44 welding pages.
 *
 * @param n 1..44 — the mockup page number (`analysis/calculation-logic.md` §3).
 */
export async function getWeldingPage(
  n: number,
  opts: WeldingPageOpts = {},
): Promise<PageModel> {
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_PAGES) {
    throw new RangeError(`welding page must be 1..${TOTAL_PAGES}, got ${n}`);
  }
  const spec = specPage(n);
  const { as_of, origin } = await withAsOf(opts.as_of ?? null);
  const ctx: Ctx = { asOf: as_of, asOfOrigin: origin, notes: new Set() };

  let widgets: Widget[];
  const unavailable = UNAVAILABLE_PAGES.get(n);
  if (unavailable) {
    widgets = spec.widgets.map(emptyWidget);
    note(ctx, unavailable);
  } else if (n === 1) {
    widgets = await buildProjectKpiPage(spec, ctx);
  } else if (n === 2) {
    widgets = await buildProjectStatusPage(spec, ctx);
  } else if (SUBCON_PAGES.has(n)) {
    widgets = await buildSubconPage(spec, SUBCON_PAGES.get(n)!, ctx);
  } else if (NDE_PAGES.has(n)) {
    widgets = await buildNdePage(spec, NDE_PAGES.get(n)!, ctx);
  } else if (WPS_PAGES.has(n)) {
    widgets = await buildWpsPage(spec, WPS_PAGES.get(n)!, ctx);
  } else {
    widgets = spec.widgets.map(emptyWidget);
    note(ctx, `page ${n} has no build rule yet`);
  }

  for (const msg of ctx.notes) widgets.push(textWidget(msg));

  return {
    page: spec.page,
    id: spec.id,
    title: spec.title,
    subtitle: spec.subtitle ?? undefined,
    widgets,
    meta: {
      source: "database",
      as_of: ctx.asOf,
    },
  };
}

// ── page 1 — project KPIs and charts ────────────────────────────────────────

async function buildProjectKpiPage(spec: SpecPage, ctx: Ctx): Promise<Widget[]> {
  const scope: Scope = { excludeSubContractors: ["Inco"] };
  const [b, welders, wpsApproved, weekly, dist] = await Promise.all([
    bundleTotal(scope),
    qualifiedWelders(),
    approvedWpsCount(),
    weeklyProgress({ weeks: 14, excludeWeldCats: ["J"], excludeSubContractors: ["Inco"] }),
    weldTypeDistribution({ ...scope, excludeWeldTypes: ["THD"] }),
  ]);
  note(ctx, PROJECT_SCOPE_NOTE);
  note(ctx, UT_TRACKER_NOTE);
  if (welders === null || wpsApproved === null) note(ctx, REGISTER_NOTE);

  const kpi = (label: string, value: string): KpiWidget => ({
    kind: "kpi",
    label,
    value: b.present ? value : HONEST_EMPTY,
  });

  const out: Widget[] = [];
  for (const w of spec.widgets) {
    if (w.kind === "kpi") {
      switch (w.label) {
        case "Joints Welded":
          out.push(kpi(w.label, kpiInt(b.welding.joints_welded)));
          break;
        case "MT/PT Done":
          out.push(kpi(w.label, kpiInt(b.welding.mt_pt_done)));
          break;
        case "RT Acc.Joints":
          out.push(kpi(w.label, kpiInt(b.rt.accepted)));
          break;
        case "RT/UT Rej.Jts":
          out.push(kpi(w.label, kpiInt(b.rt.rejected)));
          break;
        case "RT Films Taken":
          out.push(kpi(w.label, kpiInt(b.rt.films)));
          break;
        case "Rej Films":
          out.push(kpi(w.label, kpiInt(b.rt.films_rejected)));
          break;
        case "%RT FILM Rej":
          out.push(kpi(w.label, kpiPct(b.rt.film_rejection_rate)));
          break;
        case "Project_Welder":
          out.push(kpi(w.label, kpiInt(welders)));
          break;
        case "WPS Approved":
          out.push(kpi(w.label, kpiInt(wpsApproved)));
          break;
        // M32/M34/M35/M36/M39 — need the UT trackers (R-05).
        case "Numb UT/PAUT":
        case 'UT/PAUT "A"':
        case 'UT/PAUT "R"':
        case "UT Rej% Len":
        case "UT Insp Len":
        case "UT Def.Length":
          out.push(emptyKpi(w));
          break;
        default:
          out.push(emptyKpi(w));
          break;
      }
    } else if (w.kind === "chart" && w.canvas_id === "chart1_progress") {
      out.push(weeklyCatChart(w, weekly));
      if (weekly.length === 0) note(ctx, TREND_NOTE);
    } else if (w.kind === "chart" && w.canvas_id === "chart1_weldtype") {
      out.push(donutChart(w, dist));
    } else if (w.kind === "chart") {
      const points = await weeklySnapshot({
        metrics: snapshotMetricsFor(w),
        subContractor: undefined,
        weeks: w.labels.length,
      });
      out.push(snapshotChart(w, points));
      if (points.length === 0) note(ctx, TREND_NOTE);
    } else {
      out.push(emptyWidget(w));
    }
  }
  return out;
}

function weeklyCatChart(
  spec: SpecChart,
  points: Awaited<ReturnType<typeof weeklyProgress>>,
): ChartWidget {
  const weeks = [...new Set(points.map((p) => p.week_end_date))].sort();
  const cats = spec.datasets.map((d) => (d.label ?? "").replace(/\s*Weld$/, ""));
  const datasets = spec.datasets.map((d, i) => {
    const cat = cats[i];
    return {
      label: d.label ?? "",
      data: weeks.map(
        (wk) =>
          points.find((p) => p.week_end_date === wk && p.weld_cat === cat)
            ?.joints_welded ?? null,
      ),
    };
  });
  return {
    kind: "chart",
    canvas_id: spec.canvas_id,
    title: spec.title,
    chart_type: spec.chart_type,
    labels: weeks,
    datasets,
    options_notes: spec.options_notes.join(", ") || undefined,
  };
}

/**
 * M92 / M80 — the weekly backlog bars and cumulative rejection-rate lines.
 * Dataset label → `weld_weekly_snapshot.metric`. Ruling R-08: this history is
 * not recomputable from a single dump, so an empty table means an empty chart,
 * never a zero series.
 */
const SNAPSHOT_SERIES = new Map<string, string>([
  ["RT/UT+PWHT", SNAPSHOT_METRICS.RT_BACKLOG_PWHT_NOT_DONE],
  ["RT/UT Only", SNAPSHOT_METRICS.RT_BACKLOG],
  ["PWHT+RT/UT", SNAPSHOT_METRICS.PWHT_BACKLOG_FOR_RT],
  ["PWHT+RT", SNAPSHOT_METRICS.PWHT_BACKLOG_FOR_RT],
  ["PWHT Only", SNAPSHOT_METRICS.PWHT_BACKLOG_ALL_TYPES],
  ["% RT Rej Film", SNAPSHOT_METRICS.RT_FILM_REJECTION_RATE],
  ["% UT Rej Length", SNAPSHOT_METRICS.UT_LENGTH_REJECTION_RATE],
]);

function snapshotMetricsFor(spec: SpecChart): string[] {
  return spec.datasets
    .map((d) => SNAPSHOT_SERIES.get(d.label ?? ""))
    .filter((m): m is string => Boolean(m));
}

function snapshotChart(
  spec: SpecChart,
  points: Awaited<ReturnType<typeof weeklySnapshot>>,
): ChartWidget {
  const weeks = [...new Set(points.map((p) => p.week_end_date))].sort();
  const datasets = spec.datasets.map((d) => {
    const metric = SNAPSHOT_SERIES.get(d.label ?? "");
    return {
      label: d.label ?? "",
      data: weeks.map(
        (wk) =>
          points.find((p) => p.week_end_date === wk && p.metric === metric)
            ?.value ?? null,
      ),
    };
  });
  return {
    kind: "chart",
    canvas_id: spec.canvas_id,
    title: spec.title,
    chart_type: spec.chart_type,
    labels: weeks,
    datasets,
    options_notes: spec.options_notes.join(", ") || undefined,
  };
}

function donutChart(
  spec: SpecChart,
  dist: Array<{ weld_type: string | null; joints_welded: number }>,
): ChartWidget {
  const top = dist.slice(0, Math.max(spec.labels.length, 1));
  return {
    kind: "chart",
    canvas_id: spec.canvas_id,
    title: spec.title,
    chart_type: spec.chart_type,
    labels: top.map((d) => d.weld_type ?? ""),
    datasets: [{ label: spec.datasets[0]?.label ?? "", data: top.map((d) => d.joints_welded) }],
    options_notes: spec.options_notes.join(", ") || undefined,
  };
}

// ── page 2 — project welding & NDE status ───────────────────────────────────

async function buildProjectStatusPage(
  spec: SpecPage,
  ctx: Ctx,
): Promise<Widget[]> {
  const scope: Scope = { excludeSubContractors: ["Inco"], temporaryLines: false };
  note(ctx, PROJECT_SCOPE_NOTE);
  note(ctx, UT_TRACKER_NOTE);
  const weekEnd = await latestWeekEnd();
  const [pivot, thisWeek, byCat, total, bySub, subTotal] = await Promise.all([
    weldTypePivot(scope),
    weekEnd
      ? weldTypePivot(scope, { thisWeekEnding: weekEnd })
      : Promise.resolve(null),
    bundleBy({ ...scope, weldTypes: ["BW", "GW", "MW", "CLET"] }, GROUP_WELD_CAT),
    bundleTotal({ ...scope, weldTypes: ["BW", "GW", "MW", "CLET"] }),
    bundleBy({ ...scope, excludeWeldCats: ["J"] }, GROUP_SUBCON),
    bundleTotal({ ...scope, excludeWeldCats: ["J"] }),
  ]);
  if (!thisWeek) note(ctx, TREND_NOTE);
  note(ctx, FABRICATED_NOTE);

  const out: Widget[] = [];
  let tableIdx = 0;
  for (const w of spec.widgets) {
    if (w.kind !== "table") {
      out.push(emptyWidget(w));
      continue;
    }
    switch (tableIdx++) {
      case 0:
        out.push(weldTypeTable(w, pivot));
        break;
      case 1:
        out.push(
          thisWeek
            ? weldTypeTable(w, thisWeek)
            : emptyTable(w),
        );
        break;
      case 2:
        out.push(
          metricTable(
            w,
            orderedCats(byCat.keys()).map((c) => ({
              label: c,
              bundle: byCat.get(c)!,
            })),
            total,
          ),
        );
        break;
      default:
        out.push(
          metricTable(
            w,
            [...bySub.keys()]
              .filter((k): k is string => k !== null)
              .sort()
              .map((s) => ({ label: s, bundle: bySub.get(s)! })),
            subTotal,
          ),
        );
        break;
    }
  }
  return out;
}

// ── pages 4–6, 8–11 — per-subcontractor status ──────────────────────────────

async function buildSubconPage(
  spec: SpecPage,
  confs: SubconConf[],
  ctx: Ctx,
): Promise<Widget[]> {
  const weekEnd = await latestWeekEnd();
  const blocks = await Promise.all(
    confs.map(async (conf) => {
      const scope = baseScope(conf);
      const [pivot, thisWeek, byCat, total, weekly, dist] = await Promise.all([
        weldTypePivot(scope),
        weekEnd
          ? weldTypePivot(scope, { thisWeekEnding: weekEnd })
          : Promise.resolve(null),
        bundleBy(scope, GROUP_WELD_CAT),
        bundleTotal(scope),
        weeklyProgress({ subContractor: conf.sub, weeks: 8, excludeWeldCats: ["J"] }),
        weldTypeDistribution({ ...scope, excludeWeldTypes: ["THD"] }),
      ]);
      return { conf, pivot, thisWeek, byCat, total, weekly, dist };
    }),
  );
  if (!weekEnd) note(ctx, TREND_NOTE);
  note(ctx, UT_TRACKER_NOTE);
  note(ctx, FABRICATED_NOTE);

  const out: Widget[] = [];
  let blockIdx = 0;
  let tableInBlock = 0;
  const tablesPerBlock = Math.max(
    1,
    Math.floor(
      spec.widgets.filter((w) => w.kind === "table").length / confs.length,
    ),
  );
  for (const w of spec.widgets) {
    const blk = blocks[Math.min(blockIdx, blocks.length - 1)];
    if (w.kind === "kpi") {
      out.push(subconKpi(w, blk.total));
    } else if (w.kind === "chart") {
      if (/weldtype|weld_type/i.test(w.canvas_id)) {
        out.push(donutChart(w, blk.dist));
      } else if (/progress|welding/i.test(w.canvas_id)) {
        out.push(subconProgressChart(w, blk.weekly));
        if (blk.weekly.length === 0) note(ctx, TREND_NOTE);
        if (w.datasets.some((d) => d.label === "MT+PT Qty")) {
          note(ctx, MT_PT_SERIES_NOTE);
        }
      } else {
        const points = await weeklySnapshot({
          metrics: snapshotMetricsFor(w),
          subContractor: blk.conf.sub,
          weeks: w.labels.length,
        });
        out.push(snapshotChart(w, points));
        if (points.length === 0) note(ctx, TREND_NOTE);
      }
    } else if (w.kind === "table") {
      const title = w.title ?? "";
      if (/Welding Status/i.test(title) && w.columns[0] === "Weld Cat") {
        out.push(
          /this Week/i.test(title)
            ? blk.thisWeek
              ? weldTypeTable(w, blk.thisWeek)
              : emptyTable(w)
            : weldTypeTable(w, blk.pivot),
        );
      } else {
        out.push(
          metricTable(
            w,
            orderedCats(blk.byCat.keys()).map((c) => ({
              label: c,
              bundle: blk.byCat.get(c)!,
            })),
            blk.total,
          ),
        );
      }
      if (++tableInBlock >= tablesPerBlock && blockIdx < blocks.length - 1) {
        blockIdx++;
        tableInBlock = 0;
      }
    } else {
      out.push(emptyWidget(w));
    }
  }
  return out;
}

function subconKpi(spec: SpecKpi, b: Bundle): KpiWidget {
  if (!b.present) return emptyKpi(spec);
  switch (spec.label) {
    case "Joints Welded":
      return { kind: "kpi", label: spec.label, value: kpiInt(b.welding.joints_welded) };
    case "RT Film Accepted":
    case "RT Film_Accepted":
      return { kind: "kpi", label: spec.label, value: kpiInt(b.rt.films_accepted) };
    case "No. Rej Films":
    case "No.Rej Film":
      return { kind: "kpi", label: spec.label, value: kpiInt(b.rt.films_rejected) };
    case "% RT Film Rej":
      return { kind: "kpi", label: spec.label, value: kpiPct(b.rt.film_rejection_rate) };
    default:
      return emptyKpi(spec);
  }
}

function subconProgressChart(
  spec: SpecChart,
  points: Awaited<ReturnType<typeof weeklyProgress>>,
): ChartWidget {
  const weeks = [...new Set(points.map((p) => p.week_end_date))].sort();
  const sum = (wk: string, field: "joints_welded" | "tested"): number =>
    points
      .filter((p) => p.week_end_date === wk)
      .reduce((a, p) => a + p[field], 0);
  const forCat = (wk: string, cat: string): number =>
    points.find((p) => p.week_end_date === wk && p.weld_cat === cat)
      ?.joints_welded ?? 0;
  const datasets = spec.datasets.map((d) => {
    const label = d.label ?? "";
    if (label === '"F" Weld only') {
      return { label, data: weeks.map((wk) => forCat(wk, "F")) };
    }
    if (label === '"F"+"S" Weld Qty') {
      return { label, data: weeks.map((wk) => sum(wk, "joints_welded")) };
    }
    if (label === "Tested Joints") {
      return { label, data: weeks.map((wk) => sum(wk, "tested")) };
    }
    // MT+PT Qty is not in mv_weekly_progress — honest-empty series.
    return { label, data: weeks.map(() => null) };
  });
  return {
    kind: "chart",
    canvas_id: spec.canvas_id,
    title: spec.title,
    chart_type: spec.chart_type,
    labels: weeks,
    datasets,
    options_notes: spec.options_notes.join(", ") || undefined,
  };
}

// ── pages 19–40 — NDE / PWHT by RT% ─────────────────────────────────────────

async function buildNdePage(
  spec: SpecPage,
  conf: { sub: string; rtPct: number; kind: "nde" | "pwht" },
  ctx: Ctx,
): Promise<Widget[]> {
  const scope: Scope = {
    subContractor: conf.sub,
    rtPct: conf.rtPct,
    temporaryLines: false,
    weldedOnly: true,
    // §3.3: the PWHT-by-RT% pages carry the extra filter "PWHT Weld Status not
    // blank". It is a no-op for the backlog measures (their status list is
    // non-blank by construction) and restricts Joints Welded / PWHT Done.
    pwhtStatusPresent: conf.kind === "pwht" ? true : undefined,
  };
  const cond = conf.kind === "pwht" ? pwhtBacklogCond : rtBacklogCond;
  const [
    total,
    byCat,
    byClass,
    byRtPct,
    agingTotal,
    agingByCat,
    agingByClass,
  ] = await Promise.all([
    bundleTotal(scope),
    bundleBy(scope, GROUP_WELD_CAT),
    bundleBy(scope, GROUP_SERVICE_CLASS),
    bundleBy(scope, GROUP_RT_PCT),
    backlogAging(scope, ctx.asOf, cond),
    backlogAgingBy(scope, ctx.asOf, cond, GROUP_WELD_CAT),
    backlogAgingBy(scope, ctx.asOf, cond, GROUP_SERVICE_CLASS),
  ]);
  note(ctx, FABRICATED_NOTE);
  note(ctx, UT_TRACKER_NOTE);

  const attach = (b: Bundle, aging: AgingBuckets | undefined): Bundle =>
    conf.kind === "pwht"
      ? { ...b, pwhtAging: aging ?? EMPTY_AGING }
      : { ...b, rtAging: aging ?? EMPTY_AGING };

  const totalB = attach(total, agingTotal);

  const out: Widget[] = [];
  for (const w of spec.widgets) {
    if (w.kind !== "table") {
      out.push(emptyWidget(w));
      continue;
    }
    const key = w.columns[0];
    if (key === "Service Class+Weld Cat" || key === "Weld Cat") {
      // Hierarchical detail table: weld cat, then its service classes.
      const rows: RowSpec[] = [];
      for (const c of orderedCats(byCat.keys())) {
        rows.push({ label: c, bundle: attach(byCat.get(c)!, agingByCat.get(c)) });
      }
      for (const cls of [...byClass.keys()]
        .filter((k): k is string => k !== null)
        .sort()) {
        rows.push({
          label: cls,
          bundle: attach(byClass.get(cls)!, agingByClass.get(cls)),
        });
      }
      out.push(metricTable(w, rows, totalB));
    } else if (key === "RT%") {
      const rows: RowSpec[] = [];
      const pctKey = String(conf.rtPct);
      const pctBundle = byRtPct.get(pctKey);
      if (pctBundle) rows.push({ label: pctKey, bundle: attach(pctBundle, agingTotal) });
      for (const c of orderedCats(byCat.keys())) {
        rows.push({ label: c, bundle: attach(byCat.get(c)!, agingByCat.get(c)) });
      }
      out.push(metricTable(w, rows, totalB));
    } else {
      out.push(
        metricTable(
          w,
          orderedCats(byCat.keys()).map((c) => ({
            label: c,
            bundle: attach(byCat.get(c)!, agingByCat.get(c)),
          })),
          totalB,
        ),
      );
    }
  }
  return out;
}

// ── pages 42–44 — weld rejection detail per WPS ─────────────────────────────

async function buildWpsPage(
  spec: SpecPage,
  confs: SubconConf[],
  ctx: Ctx,
): Promise<Widget[]> {
  const blocks = await Promise.all(
    confs.map(async (conf) => {
      const scope: Scope = {
        ...baseScope(conf),
        excludeWeldTypes: conf.excludeWeldTypes,
        wpsPresent: true,
      };
      const [rows, total] = await Promise.all([
        wpsRejectionTable(scope),
        // The mockup's Total row is the pivot grand total, NOT the sum of the
        // WPS rows: a joint welded under two WPSs would otherwise be counted
        // twice. Evidence (calculation-logic §3.2): mockup page 42 GAC total
        // 371,613 = page 4 GAC 375,152 − GAC DMY 3,539, i.e. a distinct count.
        bundleTotal(scope),
      ]);
      return { rows, total };
    }),
  );
  void ctx;
  const out: Widget[] = [];
  let i = 0;
  for (const w of spec.widgets) {
    if (w.kind !== "table") {
      out.push(emptyWidget(w));
      continue;
    }
    const blk = blocks[Math.min(i, blocks.length - 1)];
    i++;
    const rows = blk?.rows ?? [];
    const body = [...rows]
      .sort(
        (a, b) => (b.rejection_rate_joint ?? -1) - (a.rejection_rate_joint ?? -1),
      )
      .map((r) => [
        r.wps_no,
        cellInt(r.joints_welded),
        cellInt(r.tested_joints),
        cellPct(r.rt_ut_ratio),
        cellInt(r.accepted),
        cellInt(r.rejected),
        cellInt(r.rt_total_films),
        cellInt(r.rt_films_accepted),
        cellInt(r.rt_films_rejected),
        cellPct(r.rt_film_ratio),
        cellPct(r.rejection_rate_joint),
      ]);
    const b = blk?.total;
    let total: string[];
    if (b?.present) {
      const welded = b.welding.joints_welded;
      const rt = b.rt;
      total = [
        "Total",
        cellInt(welded),
        cellInt(rt.tested),
        cellPct(welded ? rt.tested / welded : null),
        cellInt(rt.accepted),
        cellInt(rt.rejected),
        cellInt(rt.films_all),
        cellInt(rt.films_all_accepted),
        cellInt(rt.films_all_rejected),
        cellPct(rt.films_all ? rt.films_all_rejected / rt.films_all : null),
        cellPct(rt.rejection_rate_joint),
      ];
    } else {
      total = w.columns.map((_, j) => (j === 0 ? "Total" : ""));
    }
    out.push({
      kind: "table",
      title: w.title ?? "",
      columns: w.columns,
      rows: [...body, total],
      total_row: total,
    });
  }
  return out;
}
