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
  FilterWidget,
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
  coverageGapByServiceClass,
  fabricatedAggs,
  fabricatedStatsFromRow,
  type FabricatedStats,
  hasHaValues,
  rtAggs,
  rtAggsPrAll,
  rtBacklogAggs,
  rtBacklogAggsPrAll,
  rtBacklogStatsFromRow,
  RT_BACKLOG_EP,
  RT_BACKLOG_PRALL,
  rtPrAllStatsFromRow,
  rtStatsFromRow,
  spoolMasterLoaded,
  type RtBacklogStats,
  type RtStats,
} from "@/lib/metrics/rt";
import {
  pwhtAggs,
  pwhtAggsPrAll,
  pwhtStatsFromRow,
  PWHT_BACKLOG_EP,
  PWHT_BACKLOG_PRALL,
  type PwhtStats,
} from "@/lib/metrics/pwht";
import {
  utAggs,
  utAggsPrAll,
  utCoverage,
  utStatsFromRow,
  weldLengthDimensionLoaded,
  type UtCoverage,
  type UtStats,
} from "@/lib/metrics/ut";
import {
  loadedSources,
  SOURCE_LABELS,
  sourceHasRows,
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
  PROVISIONAL_METRICS,
  SNAPSHOT_METRICS,
  SNAPSHOT_SCOPES,
  weeklyProgress,
  weeklySnapshot,
  chartCutoff,
  rtBacklogCurrent,
  pwhtBacklogCurrent,
  type RtBacklogCurrent,
  type PwhtBacklogCurrent,
} from "@/lib/metrics/trend";
import {
  buildGroupedSelect,
  type GroupSpec,
  JOINT_FROM,
  Params,
  measureScope,
  filterOptions,
  normaliseFilters,
  withFilters,
  FILTER_ALL,
  FILTER_BLANK,
  FILTER_SEP,
  filterValues,
  haAreaPicks,
  PAIR_SEP,
  areaOptionsByHa,
  type WeldingFilters,
  PROJECT_EXCLUDED_SUBCONTRACTORS,
  PWHT_AMBIGUOUS_TOKEN,
  pwhtYnExpr,
  projectScope,
  type Scope,
  scopeWhere,
  SOURCES_CCC,
  SOURCES_EP,
  SOURCES_PR_ALL_LOADED,
  RT_WELD_TYPES,
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

/**
 * Whole-number formatter. Films are `numeric(10,4)` since ruling R2-04 — CCC's
 * `RT Film Total` is a per-weld-point share — so a total can be 481,319.25.
 * The mockup prints film counts as integers, so display rounds; the underlying
 * value is never rounded.
 */
const NF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

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

function kpiNum(v: number | null | undefined, dp: number): string {
  return v === null || v === undefined ? HONEST_EMPTY : fixed(dp).format(v);
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
  /**
   * M44/M48/M49. `null` when the `spool` masters are not loaded — the
   * difference between "no fabricated spools" and "we cannot know".
   */
  fabricated: FabricatedStats | null;
  /** M52 coverage gap for this row's group; `null` where the page has no M52. */
  coverageGap: number | null;
};

/** Which metric family a bundle was computed with (§0.3). */
export type Variant = "EP" | "PR_ALL";

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
      ut_inspected_length_m: 0,
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
    fabricated: null,
    coverageGap: null,
  };
}

function bundleFromRow(raw: unknown, variant: Variant, withFabricated: boolean): Bundle {
  return {
    present: true,
    welding: weldingStatsFromRow(raw),
    rt: variant === "EP" ? rtStatsFromRow(raw) : rtPrAllStatsFromRow(raw),
    ut: utStatsFromRow(raw),
    pwht: pwhtStatsFromRow(raw),
    backlog: rtBacklogStatsFromRow(raw),
    rtAging: null,
    pwhtAging: null,
    fabricated: withFabricated ? fabricatedStatsFromRow(raw) : null,
    coverageGap: null,
  };
}

function allAggs(p: Params, variant: Variant, withFabricated: boolean) {
  return [
    ...weldingAggs(p, "w", variant),
    ...(variant === "EP" ? rtAggs(p) : rtAggsPrAll(p)),
    ...(variant === "EP" ? utAggs(p) : utAggsPrAll(p)),
    ...(variant === "EP" ? rtBacklogAggs(p) : rtBacklogAggsPrAll(p)),
    ...(variant === "EP" ? pwhtAggs(p) : pwhtAggsPrAll(p)),
    ...(withFabricated ? fabricatedAggs(p, "w", variant) : []),
  ];
}

/** Per-page facts that decide which measures can be answered at all. */
export type Availability = {
  variant: Variant;
  /** `spool` has rows → M44/M48/M49 are computable. */
  spool: boolean;
/**
   * Per-source UT coverage inside this scope. `utTracker` is derived from it —
   * an existence check twice produced a fabricated 0, most recently when INCO's
   * 441 overlay rows made "some row has it" true while INCO is excluded from
   * project scope, so the KPIs computed over nothing.
   */
  ut: UtCoverage;
  /** `ut.covered.length > 0` — at least one in-scope source feeds the UT measures. */
  utTracker: boolean;
  /** `weld` holds rows for this page's sources. */
  sourceLoaded: boolean;
  /** At least one in-scope source has a resolvable weld length → M33/M35/M36. */
  weldLength: boolean;
  /** `weld_length_by_dia` itself — provenance for the note, never the gate. */
  weldLengthDimension: boolean;
};

/**
 * One round-trip for every non-aging metric a widget group needs, at the
 * scope's grand total. This is the "batch per widget group" the brief asks
 * for: a 14-column table costs one query, not fourteen.
 */
async function bundleTotal(scope: Scope, av: Availability): Promise<Bundle> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: allAggs(p, av.variant, av.spool),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return rows[0] ? bundleFromRow(rows[0], av.variant, av.spool) : emptyBundle();
}

/** The same bundle grouped by one dimension. */
async function bundleBy(
  scope: Scope,
  group: GroupSpec,
  av: Availability,
): Promise<Map<string | null, Bundle>> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [group],
    aggs: allAggs(p, av.variant, av.spool),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  const out = new Map<string | null, Bundle>();
  for (const raw of rows) {
    const rec = raw as Record<string, unknown>;
    const key = rec[group.key] === null || rec[group.key] === undefined
      ? null
      : String(rec[group.key]);
    out.set(key, bundleFromRow(raw, av.variant, av.spool));
  }
  return out;
}

/**
 * `bundleBy` and `bundleTotal` in ONE round-trip, via `GROUPING SETS`.
 *
 * Every table needs both the per-group rows and the grand total, and the total
 * is not the sum of the groups (distinct counts are not additive). Asking for
 * them separately doubled the scans on the project pages; the rollup row of a
 * grouping set is the same grand total for one scan.
 */
async function bundleByWithTotal(
  scope: Scope,
  group: GroupSpec,
  av: Availability,
): Promise<{ byGroup: Map<string | null, Bundle>; total: Bundle }> {
  const p = new Params();
  const aggs = allAggs(p, av.variant, av.spool);
  const cols = [
    `${group.sql} AS ${group.key}`,
    `GROUPING(${group.sql}) AS g_rollup`,
    ...aggs.map((a) => `${a.sql} AS ${a.key}`),
  ].join(",\n       ");
  const sql =
    `SELECT ${cols}\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${scopeWhere(scope, p)}\n` +
    ` GROUP BY GROUPING SETS ((${group.sql}), ())`;
  const rows = await query(sql, p.list());
  const byGroup = new Map<string | null, Bundle>();
  let total = emptyBundle();
  for (const raw of rows) {
    const rec = raw as Record<string, unknown>;
    if (Number(rec.g_rollup) === 1) {
      total = bundleFromRow(raw, av.variant, av.spool);
      continue;
    }
    const key =
      rec[group.key] === null || rec[group.key] === undefined
        ? null
        : String(rec[group.key]);
    byGroup.set(key, bundleFromRow(raw, av.variant, av.spool));
  }
  return { byGroup, total };
}

/** Probe the batch-2 tables once per page rather than once per widget. */
async function availability(
  variant: Variant,
  sources: readonly string[],
  scope: Scope = { sources },
): Promise<Availability> {
  const [spool, ut, sourceLoaded, weldLengthDimension] = await Promise.all([
    spoolMasterLoaded(),
    utCoverage(scope),
    sourceHasRows(sources),
    weldLengthDimensionLoaded(),
  ]);
  return {
    variant,
    spool,
    ut,
    utTracker: ut.covered.length > 0,
    sourceLoaded,
    weldLength: ut.lengthCovered.length > 0,
    weldLengthDimension,
  };
}

const GROUP_WELD_CAT: GroupSpec = { key: "weld_cat", sql: "w.weld_cat" };
const GROUP_SERVICE_CLASS: GroupSpec = {
  key: "service_class_cat_wd",
  sql: "w.service_class_cat_wd",
};
const GROUP_SERVICE_CLASS_NDT: GroupSpec = {
  key: "service_class_cat_ndt",
  sql: "w.service_class_cat_ndt",
};
const GROUP_RT_PCT: GroupSpec = { key: "rt_pct", sql: "w.rt_pct::text" };

/**
 * `Weld Cat` → `Service Class` as ONE grouping key (`F|1C3AS ABDF`), so a class
 * that recurs under F and S (shop vs field welds of the same line) is counted
 * once per cat. A joint with no weld cat has no parent row and is left out, as
 * it is from the cat rows themselves; the grand total still counts it.
 */
const CAT_CLASS_SEP = "|";
function weldCatClassGroup(classGroup: GroupSpec): GroupSpec {
  return {
    key: "cat_class",
    sql: `(w.weld_cat || '${CAT_CLASS_SEP}' || coalesce(${classGroup.sql}, ''))`,
  };
}
function splitCatClass(key: string): { cat: string; cls: string } {
  const at = key.indexOf(CAT_CLASS_SEP);
  return at < 0 ? { cat: key, cls: "" } : { cat: key.slice(0, at), cls: key.slice(at + 1) };
}
/** Em spaces survive HTML white-space collapsing, so the child rows read indented. */
const CHILD_INDENT = "\u2003\u2003";

/** PWHT Y/N slicer options inside a scope, in the reading order Y, N, then the dump's raw token. */
const PWHT_YN_ORDER = ["Y", "N", PWHT_AMBIGUOUS_TOKEN];
async function pwhtYnOptions(scope: Scope): Promise<string[]> {
  const p = new Params();
  const sql =
    `SELECT DISTINCT ${pwhtYnExpr()} AS v\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${scopeWhere(scope, p)} AND ${pwhtYnExpr()} IS NOT NULL`;
  const rows = await query<{ v: string | null }>(sql, p.list());
  return rows
    .map((r) => r.v)
    .filter((v): v is string => typeof v === "string" && v !== "")
    .sort((a, b) => {
      const ia = PWHT_YN_ORDER.indexOf(a), ib = PWHT_YN_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
}
const PWHT_CCC_NEW_NOTE =
  "PWHT Y/N for CCC joints is the owner's calculated column [PWHT Y/N CCC (NEW)] (16 rules over " +
  "Joint ID, Weld Type, WPS No., Service class, Material Type and Thickness; migration 0034), not the raw PWHT Y/N CCC.";
const PWHT_TOKEN_NOTE =
  `PWHT Y/N "${PWHT_AMBIGUOUS_TOKEN}" is a raw token of the weld dump (ruling R-04: the backlog measures ` +
  "count it as both Y and N, as the DAX does). The slicer offers it as its own value rather than folding it into either.";

/** The distinct Service Class labels inside a scope — the NDE / PWHT slicer's options. */
async function serviceClassOptions(scope: Scope, classGroup: GroupSpec): Promise<string[]> {
  const p = new Params();
  // Trimmed labels: the slicer value travels through a URL, which drops the trailing
  // space of a class with no Service Cat; the predicate trims the column the same way.
  const sql =
    `SELECT DISTINCT btrim(${classGroup.sql}) AS cls\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${scopeWhere(scope, p)} AND btrim(${classGroup.sql}) <> ''\n` +
    ` ORDER BY 1`;
  const rows = await query<{ cls: string | null }>(sql, p.list());
  return rows.map((r) => r.cls).filter((c): c is string => typeof c === "string" && c !== "");
}
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
  ["UT Def Len m", "the UT tracker workbooks are not loaded (M34)"],
  ["UT Def Len.m", "the UT tracker workbooks are not loaded (M34)"],
  ["UT Def. Len.m", "the UT tracker workbooks are not loaded (M34)"],
  ["UT Insp Len m", "the UT tracker workbooks are not loaded (M35)"],
  ["% Rej UT Len", "the UT tracker workbooks are not loaded (M36)"],
  ["UT Rej% Len", "the UT tracker workbooks are not loaded (M36)"],
  ["% of Rej UT by Length", "the UT tracker workbooks are not loaded (M36)"],
]);

/** Column headers whose metric is M44/M48/M49 — gated on the `spool` masters. */
const FABRICATED_HEADERS = new Map<string, keyof FabricatedStats>([
  ["RT Backlog FABRICATED", "rt_backlog_fabricated"],
  ["RT B.log & FAB-D", "rt_backlog_fabricated"],
  [
    'RT B.log & PWHT "Y" Done + PWHT "N" FAB-D',
    "rt_backlog_pwht_y_done_or_n_fabricated",
  ],
  ['RT B.LOG & PWHT"Y" NOT Done FAB-D', "rt_backlog_pwht_y_not_done_fabricated"],
  ['RT B.Log & PWHT"Y" NOT Done FAB-D', "rt_backlog_pwht_y_not_done_fabricated"],
]);

/** Column headers whose metric is M52 (the RT-coverage gap). */
const COVERAGE_GAP_HEADERS = new Set([
  "RT5% B.log Joints",
  "RT10% B.log Joints",
  "RT20% B.log Joints",
  "RT20% Backlog",
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
  const fab = FABRICATED_HEADERS.get(header);
  if (fab) return b.fabricated ? cellInt(b.fabricated[fab]) : "";
  if (COVERAGE_GAP_HEADERS.has(header)) {
    return b.coverageGap === null ? "" : fixed(2).format(b.coverageGap);
  }
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
      return cellPct(b.rt.rejection_rate_joint);
    // Page 2's sub-contractor column. Despite the name it is the FILM ratio
    // `RT FILM Ratio % by Joint "PR all"` (films "R" / films), not the joint
    // rejection rate: the owner's cells are 0.39 / 0.12 / 0.42 / 0.23 / 0.98 /
    // 0.27, which is the film ratio; the joint rate gives 0.83 / 0.39 / 1.67 /
    // 0.53 / 2.78 / 0.91. The label is the pbix's; the measure behind it is
    // what it is.
    case "% Rej by Joint":
      return cellPct(b.rt.film_rejection_rate);
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

/**
 * The "Cumulative Welding Status" / "Welding Status for this Week" pivots carry
 * a `Weld Cat IN {F, S}` visual filter in the pbix — verbatim from
 * `analysis/pbix/report-inventory.md`:
 *   page 22 pivots `7feb0e7f3d3a4a556bd0` and `3d74883e1b2d5d486000`,
 *   page 23 pivots `eb6ba97e72540102c21e` and `da743b15d5328d39855b`.
 *
 * It matters now that CCC is loaded: Talisman's `Work Category` has a third
 * value, `J` (92,240 welder-record rows + 22,442 joint-record rows;
 * `analysis/sources2/profile.md:86,285`), which no other source uses and which
 * the mockup's F/S-only tables therefore never showed. The mockup does NOT
 * predate the data — the visual filters it out.
 *
 * What `J` means is NOT documented in any source we hold: the profiles give the
 * vocabulary and the counts, nothing more. It is left unfiltered wherever the
 * pbix leaves it unfiltered (the page-2 "Project RT/UT Tested" pivot restricts
 * `Weld Type`, not `Weld Cat`), so it is reported where the report reports it.
 */
const WELD_STATUS_CATS = ["F", "S"] as const;

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
  /** Page-1 slicer; `{}` everywhere else. */
  filters: WeldingFilters;
};

function note(ctx: Ctx, msg: string): void {
  ctx.notes.add(msg);
}

/** Add a note only when there is one — the note builders return null when the
 * situation they describe no longer applies. */
function noteIf(ctx: Ctx, msg: string | null): void {
  if (msg) ctx.notes.add(msg);
}

const CCC_NOTE =
  "CCC is not loaded yet: weld holds no CCC_WELDER_RECORD / CCC_JOINT_RECORD " +
  "rows, so every figure on this page is unavailable — not zero. The page is " +
  "built and will fill in as soon as the Talisman loaders have run.";

const TREND_NOTE =
  "Weekly backlog and cumulative rejection-rate charts read " +
  "weld_weekly_snapshot; the history cannot be recomputed from a single dump " +
  "(the DAX ages on TODAY()). The table is empty, so the charts are empty.";

/**
 * The UT provenance note, built from measured per-source coverage.
 *
 * `null` when every in-scope source is covered — a note that keeps naming
 * absent trackers after they arrive is as misleading as a fabricated zero.
 */
function utCoverageNote(ut: UtCoverage): string | null {
  const label = (s: string) => SOURCE_LABELS[s] ?? s;
  void label;
  if (ut.covered.length === 0) {
    return (
      "UT metrics (Numb UT/PAUT, UT \"A\"/\"R\", UT Def.Length) are unavailable: " +
      "no sub-contractor in this scope resolves [Manual UT Report No.]. " +
      "The cards show \u2014, never 0."
    );
  }
  if (ut.uncovered.length === 0) return null;
  // Verbatim per the orchestrator's ruling. The earlier wording blamed the
  // missing GAC/TEKFEN tracker workbooks, which is the wrong premise for this
  // measure: the DAX's GAC and TEKFEN branches never read a tracker.
  return (
    `UT coverage: covered ${ut.covered.join(", ")} \u2014 GAC and TEKFEN through ` +
    `their own columns, CCC through the tracker, INCO through its own; ` +
    `not covered: ${ut.uncovered.join(", ")} (no DAX branch).`
  );
}

/** The same policy for the UT length family (M33/M35/M36). */
function utLengthNote(ut: UtCoverage, dimensionLoaded: boolean): string | null {
  const label = (s: string) => SOURCE_LABELS[s] ?? s;
  if (ut.lengthCovered.length === 0) {
    return (
      "UT length metrics (M33/M35/M36) are unavailable: [Weld Length \"PR all\"] " +
      "cannot resolve for any source in this scope" +
      (dimensionLoaded ? "." : ", and the weld_length_by_dia reference dimension is empty.")
    );
  }
  if (ut.lengthUncovered.length === 0) return null;
  return (
    `UT length is a PARTIAL total. Covered: ${ut.lengthCovered.map(label).join(", ")}. ` +
    `Not covered: ${ut.lengthUncovered.map(label).join(", ")}.`
  );
}

const FABRICATED_NOTE =
  "FABRICATED columns need Spool Dump.txt, which is not in sources/.";

const MT_PT_SERIES_NOTE =
  "The 'MT+PT Qty' series on the weekly progress chart is empty: " +
  "mv_weekly_progress does not carry MT/PT counts, so there is nothing to " +
  "plot per week (the page-total MT/PT Done KPI is computed).";

const PROVISIONAL_NOTE =
  "Provisional series (ruling R2-09): the RT Backlog column of the trend " +
  "workbook is 0 for every sub-contractor in every week since 2024-06-28, so " +
  "this line is seeded honest history, not a live backlog. It will step when " +
  "the first ETL-computed week lands.";

const CCC_AGING_NOTE =
  "CCC aging buckets are blank on purpose (ruling R2-05): RT Selected Date is " +
  "empty on all 5,430,732 rows of the CCC export, so M51 has no clock. No " +
  "substitute date is used.";

const HA_NOTE =
  "M52's coverage ratio is computed one grain coarser than the DAX: weld.ha is " +
  "empty for this scope, because the HA l0_abs_guide lookup file is not in " +
  "sources/ and Subsystem Code / System no did not yield a handover area.";

const BACKLOG_PROVENANCE_NOTE =
  "Backlog charts: the history is the weekly trend workbook, summed over every " +
  "sub-contractor and every scope (SG/TMCP included) \u2014 the pbix chart is that " +
  "workbook. The CURRENT week of both charts is recomputed from the live data " +
  "using the report owner\u2019s formulas, so it always agrees with page 2: " +
  "RT/UT+PWHT = RT BACKLOG Total Project & PWHT \"Y\" NOT Done; RT/UT Only = " +
  "RT Backlog+PWHT \"N\" plus RT Backlog+PWHT Progress \"Y\"; PWHT+RT/UT = PWHT " +
  "Backlog All Weld Types RT NOT Done (Service Cat \"SG\" and TMCP Pipe only); " +
  "PWHT Only = PWHT All BACKLOG All Weld Types minus that.";

const PROJECT_EXCLUDED_FILTER_NOTE =
  "This page\u2019s MT/PT Done card and its two project charts (Welding " +
  "Progress Trend, Weld Type Distribution) are measured with Inco excluded " +
  "(ruling R3-01 \u2014 every pbix visual on this page carries SC <> Inco). " +
  "Filtering to Inco therefore leaves them nothing to measure, so they render " +
  "empty rather than 0. Every other card on this page includes Inco and does " +
  "follow the filter.";

const REGISTER_NOTE =
  "Project_Welder (M90) reads ref_qualified_welders and WPS Approved (M91) " +
  "reads ref_wps_register. One of them is unseeded, so its card renders " +
  "\u2014, never 0. Both counts state the source file's own date.";

// R3-06 is retired: Inco's weld length is `Length (MM)` / 1000 on the rows
// where it has a UT report, and the owner's with-Inco cards (27,856.97 /
// 18.736) match our literal implementation exactly. There is nothing to
// disclose, so this note is no longer emitted -- kept only as the record of a
// ruling that was wrong in both its reason and its outcome. See migration 0021
// and lib/metrics/README.md.



/**
 * The project-scope disclosure, COMPUTED from what `weld` actually holds.
 * Hard-coding it meant page 1 kept saying CCC was missing after CCC loaded —
 * a stale note is as dishonest as a fabricated zero.
 */
function projectScopeNote(sources: {
  loaded: string[];
  absent: string[];
}): string | null {
  if (sources.absent.length === 0) return null;
  const label = (s: string) => SOURCE_LABELS[s] ?? s;
  return (
    `Project totals cover the loaded sources only: ` +
    `${sources.loaded.map(label).join(", ") || "none"}. ` +
    `${sources.absent.map(label).join(", ")} ` +
    `${sources.absent.length === 1 ? "is" : "are"} not loaded, so these numbers ` +
    `are not the full project scope the mockup showed.`
  );
}

// ── page families ───────────────────────────────────────────────────────────

/** Pages whose every widget is unavailable, with the reason. */
const UNAVAILABLE_PAGES = new Map<number, string>();

type SubconConf = {
  sub: string;
  serviceCat?: "SG" | "NONSG";
  tmcpPipe?: boolean;
  /** `Weld Type NOT IN {…}` — the per-WPS pivots drop `DMY` (§3.4). */
  excludeWeldTypes?: readonly string[];
  /**
   * Screens multi-select (2026-10-14): with `sub = ALL`, only these parties —
   * the ALL structure over their union. Absent = the whole project scope.
   */
  subs?: readonly string[];
};

/**
 * The "ALL" sub-contractor (owner request 2026-09-15: "добавить ALL во вкладке
 * Sub-contractor" on the four per-party screens). A per-party page rendered with
 * this value keeps its structure but reads the PROJECT scope: the loaded
 * `"PR all"` union minus INCO, exactly what page 1 / page 2 read — never a sum of
 * the four party pages, because a joint welded under two parties would then be
 * counted twice.
 */
export const SUBCO_ALL = "ALL";
const isAll = (sub: string) => sub === SUBCO_ALL;

/** CCC binds `Project WD+WR+INCO+Acciona`; everyone else binds `Weld Dump` (§1.2). */
function variantFor(sub: string): Variant {
  return sub === "CCC" || isAll(sub) ? "PR_ALL" : "EP";
}

/** CCC's fact rows live in its own two files (R2-03); ALL reads the loaded union. */
function sourcesFor(sub: string): readonly string[] {
  return isAll(sub) ? SOURCES_PR_ALL_LOADED : sub === "CCC" ? SOURCES_CCC : SOURCES_EP;
}

/**
 * §3.3 row grouping: CCC pages key on
 * `Service Class + Service Cat+NDT Remarks` (label style `6R1B P 100` — CCC has
 * no `Service Cat`, hence the double space); GAC/TEKFEN/MEDGULF key on
 * `Service Class+Service Cat "WD"` (`1C3AS ABDF`). Do not merge the two.
 */
function serviceClassGroup(sub: string): GroupSpec {
  // ALL keys on the `Weld Dump` style; CCC rows (no `Service Cat`) then land under
  // their own `Service Class` label — disclosed by ALL_CLASS_NOTE, never merged.
  return sub === "CCC" ? GROUP_SERVICE_CLASS_NDT : GROUP_SERVICE_CLASS;
}

/** mockup page → subcontractor scope for the NDE/PWHT pages 19–40. */
const NDE_PAGES = new Map<
  number,
  { sub: string; rtPct: number; kind: "nde" | "pwht" }
>([
  // CCC (§3.3 mk 12-18). There is deliberately no CCC RT-30 % page: CCC's
  // `RT/UT(%)` vocabulary is {0, 5, 10, 20, 100} — no 30 — and the 0 bucket
  // (3.42 M of 5.43 M rows) has no page either (§7 C-7).
  [12, { sub: "CCC", rtPct: 100, kind: "nde" }],
  [13, { sub: "CCC", rtPct: 100, kind: "pwht" }],
  [14, { sub: "CCC", rtPct: 5, kind: "nde" }],
  [15, { sub: "CCC", rtPct: 5, kind: "pwht" }],
  [16, { sub: "CCC", rtPct: 10, kind: "nde" }],
  [17, { sub: "CCC", rtPct: 10, kind: "pwht" }],
  [18, { sub: "CCC", rtPct: 20, kind: "nde" }],
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
  [3, [{ sub: "CCC" }]],
  [7, [{ sub: "CCC" }]],
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
  // §3.4 mk 41: rows `wps_no`; `WT<>THD`, `wps_no IS NOT NULL`.
  [41, [{ sub: "CCC", excludeWeldTypes: ["THD"] }]],
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
    sources: sourcesFor(conf.sub),
    // ALL: no party predicate, INCO excluded — the project scope of pages 1/2.
    subContractor: isAll(conf.sub) ? undefined : conf.sub,
    subContractors: isAll(conf.sub) ? conf.subs : undefined,
    excludeSubContractors: isAll(conf.sub) ? PROJECT_EXCLUDED_SUBCONTRACTORS : undefined,
    serviceCat: conf.serviceCat,
    tmcpPipe: conf.tmcpPipe,
    // Every pbix page in this family carries `Temporary Lines "WD" IN {null}`.
    temporaryLines: false,
  };
}

/** Sub-contractor arguments for the trend helpers (`weeklyProgress`, backlog current). */
function partyArgs(
  sub: string,
  subs?: readonly string[],
): { subContractor?: string; subContractors?: readonly string[]; excludeSubContractors?: readonly string[] } {
  return isAll(sub)
    ? { subContractor: undefined, subContractors: subs, excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS }
    : { subContractor: sub };
}

/**
 * Rewrite a per-party page's own labels for the ALL rendering: the page title
 * ("CCC WELDING STATUS" → "ALL SUB-CONTRACTORS WELDING STATUS") and the widget
 * titles ("Weld Type - CCC" → "Weld Type - ALL"). The structure is the party
 * page's; only the party name changes.
 */
const PARTY_IN_TITLE = /\b(CCC|GAC|TEKFEN|MEDGULF)\b/g;
function allTitle(title: string, subs?: readonly string[]): string {
  return title.replace(PARTY_IN_TITLE, subs ? subs.join(" + ") : "ALL SUB-CONTRACTORS");
}
function allWidgetTitle(title: string, subs?: readonly string[]): string {
  return title.replace(PARTY_IN_TITLE, subs ? subs.join(" + ") : "ALL");
}
function allConf(conf: SubconConf, subs?: readonly string[]): SubconConf {
  // The party's own service-cat / TMCP split has no meaning across parties.
  return { sub: SUBCO_ALL, excludeWeldTypes: conf.excludeWeldTypes, ...(subs ? { subs } : {}) };
}

/** "CCC NDE RT 100% STATUS" → "CCC NDE ALL RT % STATUS"; "… by RT 100%" → "… by ALL RT %". */
function allRtTitle(title: string, on: boolean, pcts?: readonly number[]): string {
  return on ? title.replace(/RT ?100 ?%/g, pcts ? `RT ${pcts.join(" + ")} %` : "ALL RT %") : title;
}
const SUBSET_SCOPE_NOTE = (subs: readonly string[]) =>
  `Selected sub-contractors: ${subs.join(", ")}. Every figure is computed over their union ` +
  "(the ALL rendering restricted to them), not summed from the party pages, so a joint is never counted twice.";
const SUBSET_RT_NOTE = (pcts: readonly number[]) =>
  `Selected RT %: ${pcts.join(", ")}. The rows span those RT % values; columns named RT100% keep their meaning.`;
const SUBSET_RATE_NOTE =
  "Rejection-rate lines: the weekly trend workbook records one rate per sub-contractor, and rates of " +
  "several parties cannot be added up, so these lines are not drawn for a multi-party selection.";
const ALL_RT_NOTE =
  "ALL RT %: the rows span every RT % (no RT % predicate). Columns named RT100% / RT 100% keep their " +
  "meaning — those measures carry RT % = 100 in their own definition — so they count the RT 100 % share of each row.";
const ALL_SCOPE_NOTE =
  "ALL sub-contractors: every figure is computed over the project scope (the loaded " +
  "WELD_DUMP + CCC + ACCIONA union, INCO excluded), not summed from the four party pages, " +
  "so a joint is never counted twice. The party split of the page (Slug Catcher, TMCP) does not apply.";
const ALL_CLASS_NOTE =
  "Service-class rows: CCC joints carry no Service Cat, so under ALL they group by " +
  "their own Service Class label alongside the Weld Dump `Service Class+Service Cat` keys.";
const ALL_PWHT_NOTE =
  "PWHT by RT %: the party pages' `PWHT Weld Status not blank` filter is not applied under ALL " +
  "because CCC rows carry no PWHT Weld Status and would be dropped entirely.";
const ALL_WPS_NOTE =
  "Per-WPS pivot under ALL drops both `THD` (as the CCC page does) and `DMY` (as the other pages do).";

// ── the assembler ───────────────────────────────────────────────────────────

export type { WeldingFilters } from "@/lib/metrics/scope";

export type WeldingPageOpts = {
  as_of?: string;
  /** Page-1 slicer bar. Ignored on every other page. */
  filters?: WeldingFilters;
  /**
   * Render a per-party page (3–11, 12–40, 41–44) with the ALL sub-contractor —
   * see {@link SUBCO_ALL}. Ignored on pages 1 and 2, which are project-wide already.
   */
  allSubcos?: boolean;
  /**
   * Render an NDE / PWHT page (12–40) with NO RT % predicate — the "ALL" option of
   * the screens' RT % axis (owner request 2026-09-15). The page's RT-100 columns
   * keep their meaning (their flags carry `rt_pct = 100` themselves); the rows
   * span every RT %. Ignored on every other page.
   */
  allRtPct?: boolean;
  /** Screens multi-select (2026-10-14): 2+ parties → the ALL structure over just them. */
  subcoSet?: readonly string[];
  /** Screens multi-select: 2+ RT % values → the ALL-RT structure over just them. */
  rtSet?: readonly number[];
};

/**
 * The page-1 filter bar.
 *
 * A pbix slicer on the fact table: one extra `WHERE` AND-ed onto every widget's
 * own scope. Per-card rules survive it — `MT/PT Done` still excludes Inco, so
 * `subco=INCO` renders honest-empty with the note that already says why, never
 * a fabricated 0.
 *
 * The workbook-sourced charts cannot follow a weld-type or weld-cat slicer:
 * `weld_weekly_snapshot` is keyed per party only. With either of those set the
 * history is genuinely unavailable, so only the computed current week is shown
 * and {@link FILTER_NO_HISTORY_NOTE} says so — the alternative would be a line
 * that silently ignores the filter the reader just set.
 */
const FILTER_SPECS = [
  { id: "ha", label: "HA" },
  { id: "area", label: "Area Classification" },
  { id: "subco", label: "Sub-Contractor" },
  { id: "wtype", label: "Weld Type" },
  { id: "wcat", label: "Weld Cat" },
] as const;

const FILTER_NO_HISTORY_NOTE =
  "HA / Area / Weld Type / Weld Cat filter: the weekly trend workbook is " +
  "recorded per sub-contractor only, so no history can be filtered by any of " +
  "them. The backlog and rejection-rate charts therefore show only the current " +
  "week, computed from the live data under the filters you set. The Welding " +
  "Progress Trend is unaffected \u2014 it is computed, and follows every filter.";

const FILTER_UNKNOWN_NOTE =
  "One or more filter values are not present in the data and were ignored " +
  "(treated as \u201cAll\u201d).";

/** Inco & co.: parties the project-scope cards leave out (R3-01). */
const isProjectExcluded = (sub: string) =>
  PROJECT_EXCLUDED_SUBCONTRACTORS.some((x) => x.toUpperCase() === sub.toUpperCase());

/** The sub-contractor slicer as metric options: one value, a list, or nothing. */
function subcoArgs(f: WeldingFilters): { subContractor?: string; subContractors?: readonly string[] } {
  const v = filterValues(f.subco);
  if (!v) return {};
  return v.length === 1 ? { subContractor: v[0] } : { subContractors: v };
}

async function filterWidgets(
  applied: WeldingFilters,
): Promise<{ widgets: FilterWidget[]; unknown: boolean }> {
  const [options, areaByHa] = await Promise.all([
    filterOptions(),
    areaOptionsByHa(),
  ]);
  let unknown = false;
  const widgets = FILTER_SPECS.map((f) => {
    // `ha` additionally offers the pbix slicer's own "(Blank)" group, which is
    // `ha IS NULL` — 45,206 joints that resolve to no handover area.
    const opts =
      f.id === "ha"
        ? [...(options.ha ?? []), FILTER_BLANK]
        : (options[f.id] ?? []);
    // Multi-select (2026-10-14): keep every picked value that exists, drop
    // the rest. An `area` pick may be an `HA>Area` pair from the tree; both
    // halves must exist.
    const picked = filterValues(applied[f.id as keyof WeldingFilters]) ?? [];
    const haOpts = [...(options.ha ?? []), FILTER_BLANK];
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
    // The pbix renders "HA, Area Classification" as one two-field slicer, so
    // `area` declares `ha` as its parent and carries the per-HA option lists.
    // The flat `options` stays the full list, for a UI that ignores hierarchy.
    if (f.id === "area") {
      w.parent = "ha";
      w.options_by_parent = areaByHa;
    }
    return w;
  });
  return { widgets, unknown };
}

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
  // Page 1 owns the slicer; every other page ignores it, so its output is
  // untouched no matter what a caller passes.
  const requested = n === 1 ? normaliseFilters(opts.filters) : {};
  const bar = n === 1 ? await filterWidgets(requested) : null;
  // The NDE / PWHT pages own one slicer of their own: Service Class (2026-09-15).
  const ndeSlicers = NDE_PAGES.has(n) ? normaliseFilters(opts.filters) : {};
  const sclass = ndeSlicers.sclass;
  const pwht = ndeSlicers.pwht;
  // Only values that actually exist are applied — an unknown one is reported
  // as "All" in the widget AND dropped from the query, so the page can never
  // show a filter it did not honour.
  const applied = (i: number) =>
    bar && bar.widgets[i]!.value !== FILTER_ALL ? bar.widgets[i]!.value : undefined;
  const filters: WeldingFilters = bar
    ? {
        ha: applied(0),
        area: applied(1),
        subco: applied(2),
        wtype: applied(3),
        wcat: applied(4),
      }
    : { sclass, pwht };
  const ctx: Ctx = { asOf: as_of, asOfOrigin: origin, notes: new Set(), filters };
  if (bar?.unknown) note(ctx, FILTER_UNKNOWN_NOTE);
  // ALL applies to the per-party families only; pages 1/2 are project-wide already.
  // Screens multi-select: 2+ parties / RT % values render the ALL structure over
  // just those (a single pick is that party's or RT %'s own page, as before).
  const subs = opts.subcoSet && opts.subcoSet.length > 1 ? [...opts.subcoSet] : undefined;
  const rts = opts.rtSet && opts.rtSet.length > 1 ? [...opts.rtSet] : undefined;
  const all = (Boolean(opts.allSubcos) || subs !== undefined) && (SUBCON_PAGES.has(n) || NDE_PAGES.has(n) || WPS_PAGES.has(n));
  if (all) note(ctx, subs ? SUBSET_SCOPE_NOTE(subs) : ALL_SCOPE_NOTE);
  const allRt = (Boolean(opts.allRtPct) || rts !== undefined) && NDE_PAGES.has(n);
  if (allRt) note(ctx, rts ? SUBSET_RT_NOTE(rts) : ALL_RT_NOTE);

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
    const confs = SUBCON_PAGES.get(n)!;
    widgets = await buildSubconPage(spec, all ? [allConf(confs[0]!, subs)] : confs, ctx);
  } else if (NDE_PAGES.has(n)) {
    const conf = NDE_PAGES.get(n)!;
    widgets = await buildNdePage(
      spec,
      {
        ...conf,
        sub: all ? SUBCO_ALL : conf.sub,
        rtPct: allRt ? undefined : conf.rtPct,
        subs: all ? subs : undefined,
        rtPcts: allRt ? rts : undefined,
      },
      ctx,
    );
  } else if (WPS_PAGES.has(n)) {
    const confs = WPS_PAGES.get(n)!;
    widgets = await buildWpsPage(spec, all ? [allConf(confs[0]!, subs)] : confs, ctx);
  } else {
    widgets = spec.widgets.map(emptyWidget);
    note(ctx, `page ${n} has no build rule yet`);
  }

  for (const msg of ctx.notes) widgets.push(textWidget(msg));
  // The bar goes FIRST, ahead of every data widget.
  if (bar) widgets = [...bar.widgets, ...widgets];
  if (all || allRt) {
    const retitle = (t: string) => allRtTitle(all ? allWidgetTitle(t, subs) : t, allRt, rts);
    widgets = widgets.map((w) => (w.kind === "table" || w.kind === "chart" ? { ...w, title: retitle(w.title) } : w));
  }

  return {
    page: spec.page,
    id: `${spec.id}${all ? "-all" : ""}${allRt ? "-allrt" : ""}`,
    title: allRtTitle(all ? allTitle(spec.title, subs) : spec.title, allRt, rts),
    subtitle: spec.subtitle ?? undefined,
    widgets,
    ...(bar
      ? {
          filters: {
            ha: bar.widgets[0]!.value,
            area: bar.widgets[1]!.value,
            subco: bar.widgets[2]!.value,
            wtype: bar.widgets[3]!.value,
            wcat: bar.widgets[4]!.value,
          },
        }
      : {}),
    meta: {
      source: "database",
      as_of: ctx.asOf,
    },
  };
}

// ── page 1 — project KPIs and charts ────────────────────────────────────────

async function buildProjectKpiPage(spec: SpecPage, ctx: Ctx): Promise<Widget[]> {
  // §3.1 / R3-01: every visual on pbix page 21 carries `SC <> Inco`, one of the
  // 69 filters that keep INCO out of project scope. ACCIONA is inside it.
  // Amended R3-01, per card. Most page-1 cards are unfiltered measure values
  // (Inco INCLUDED) — that is what a pbix card is, and it is what reproduces
  // the user's readings to the unit. MT/PT is the documented exception. The
  // CHARTS keep the visual filter the pbix records (`SC <> Inco`).
  // The slicer is AND-ed onto every scope below; with no filters set,
  // `withFilters` is the identity and the page is byte-identical to before.
  const f = ctx.filters;
  const cardScope: Scope = withFilters(measureScope(), f);
  const scope: Scope = withFilters(projectScope(), f);
  const av = await availability("PR_ALL", SOURCES_PR_ALL_LOADED, cardScope);
  const [b, bNoInco, welders, wpsApproved, weekly, dist] = await Promise.all([
    bundleTotal(cardScope, av),
    bundleTotal(withFilters(projectScope(), f), av),
    qualifiedWelders(),
    approvedWpsCount(),
    weeklyProgress({
      // Owner: page 1's Welding Progress Trend shows the LAST 10 WEEKS. The
      // mockup snapshot declares 14 labels; pages 7-11 keep their own window.
      weeks: 10,
      upTo: chartCutoff(ctx.asOf),
      excludeWeldCats: ["J"],
      excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS,
      sources: SOURCES_PR_ALL_LOADED,
      // mv_weekly_progress carries all three columns, so the trend follows the
      // slicer exactly rather than being dropped.
      // Multi-select lists (2026-10-14); one value is a one-element list.
      subContractors: filterValues(f.subco),
      weldTypes: filterValues(f.wtype),
      weldCats: filterValues(f.wcat),
      // 0030 put HA and Area into mv_weekly_progress precisely so the trend
      // cannot show unfiltered weeks beside filtered cards.
      haArea: haAreaPicks(f),
    }),
    weldTypeDistribution({ ...scope, excludeWeldTypes: ["THD"] }),
  ]);
  if (filterValues(f.subco)?.some(isProjectExcluded)) {
    note(ctx, PROJECT_EXCLUDED_FILTER_NOTE);
  }
  const sources = await loadedSources();
  const scopeNote = projectScopeNote(sources);
  if (scopeNote) note(ctx, scopeNote);
  noteIf(ctx, utCoverageNote(av.ut));
  if (!av.spool) note(ctx, FABRICATED_NOTE);
  noteIf(ctx, utLengthNote(av.ut, av.weldLengthDimension));
  if (!(await sourceHasRows(SOURCES_CCC))) note(ctx, CCC_NOTE);
  if (welders === null || wpsApproved === null) note(ctx, REGISTER_NOTE);
  if (welders?.source_note) note(ctx, `Project_Welder: ${welders.source_note}`);

  /**
   * Which scope each page-1 card is measured in.
   *
   * Not one global flag: the pbix does not treat them uniformly, and the report
   * owner's readings settle each one individually. `measure` = the unfiltered
   * "PR all" value, Inco included; `project` = Inco excluded (R3-01).
   *
   * | card | measure | Inco | source of the ruling |
   * |---|---|---|---|
   * | Joints Welded | `Joint Uniq "PR all" Welded` | in | user reading 2,209,156 |
   * | RT Acc.Joints | `Numb RT/UT "PR all"` (TESTED, not accepted) | in | user reading 207,682 |
   * | Numb UT/PAUT, UT/PAUT "A"/"R" | `Numb UT "PR All"` | in | user reading 14,214 |
   * | **MT/PT Done** | `MT + PT "PR all"` | **out** | user ruling: Inco is not counted here |
   * | everything else | — | in | default |
   */
  const CARD_SCOPE: Record<string, "measure" | "project"> = {
    "MT/PT Done": "project",
  };
  const cardBundle = (label: string): Bundle =>
    CARD_SCOPE[label] === "project" ? bNoInco : b;

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
        case "MT/PT Done": {
          // R3-01 keeps Inco out of this card. Filtering TO Inco therefore
          // leaves it measuring nothing — and "nothing" must render as `—`,
          // not as a 0 that reads like "Inco did no MT/PT".
          // Several parties picked: the card measures the ones it covers, and
          // only a pick made ENTIRELY of excluded parties leaves nothing.
          const excluded =
            CARD_SCOPE[w.label] === "project" &&
            (filterValues(f.subco)?.every(isProjectExcluded) ?? false);
          if (excluded) {
            out.push(emptyKpi(w));
            note(ctx, PROJECT_EXCLUDED_FILTER_NOTE);
            break;
          }
          out.push(
            kpi(w.label, kpiInt(cardBundle(w.label).welding.mt_pt_done)),
          );
          break;
        }
        case "RT Acc.Joints":
          // Rebound to M10/M11 `Numb RT/UT "PR all"` (tested joints), NOT M13
          // (accepted), on the report owner's instruction: the pbix card shows
          // 207,682 and M13 gives 202,698. The LABEL says "Acc." and the
          // measure behind it does not — that mismatch is the pbix's, and it is
          // recorded in lib/metrics/README.md rather than silently "corrected".
          out.push(kpi(w.label, kpiInt(b.rt.tested)));
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
          // 0.28% = 2,152 / 768,101, Inco INCLUDED — measure scope, like every
          // other page-1 card (R3-01). Page 2's table shows 0.27%
          // (2,074 / 761,198.61) because that page is project scope, Inco
          // excluded. Both are correct; the `sub` says which this one is.
          out.push({
            kind: "kpi",
            label: w.label,
            value: b.present ? kpiPct(b.rt.film_rejection_rate) : HONEST_EMPTY,
            sub: "all parties incl. Inco",
          });
          break;
        case "Project_Welder":
          // R3-10: the register carries no date of its own, so the provenance
          // says whose date it is.
          out.push({
            kind: "kpi",
            label: w.label,
            value: welders ? kpiInt(welders.total) : HONEST_EMPTY,
            sub: welders?.as_of
              ? `as of ${welders.as_of} (file date)`
              : undefined,
          });
          break;
        case "WPS Approved":
          // R4-02. Provenance is the register file's own date, the same
          // treatment M90 gets: a count off a dated file states its date.
          out.push({
            kind: "kpi",
            label: w.label,
            value: wpsApproved ? kpiInt(wpsApproved.total) : HONEST_EMPTY,
            sub: wpsApproved?.as_of
              ? `as of ${wpsApproved.as_of} (file date)`
              : undefined,
          });
          break;
        // M39 / M32 — the UT-tracker overlay columns. Computable only where a
        // tracker was loaded; UT TRACKER (GAC) and (TEK) are still missing, so
        // GAC/TEKFEN contribute nothing and the card says so (R-05).
        case "Numb UT/PAUT":
          out.push(av.utTracker ? kpi(w.label, kpiInt(b.ut.ut_done)) : emptyKpi(w));
          break;
        case 'UT/PAUT "A"':
          out.push(av.utTracker ? kpi(w.label, kpiInt(b.ut.ut_accepted)) : emptyKpi(w));
          break;
        case 'UT/PAUT "R"':
          out.push(av.utTracker ? kpi(w.label, kpiInt(b.ut.ut_rejected)) : emptyKpi(w));
          break;
        // M35 `[UT Inspected Length by Joint "PR all"]` resolves through
        // [Weld Length "PR all"], and M36 is M34/M35.
        case "UT Insp Len":
          out.push(
            av.weldLength && av.utTracker
              ? kpi(w.label, kpiNum(b.ut.ut_weld_length_m, 2))
              : emptyKpi(w),
          );
          break;
        case "UT Rej% Len":
          out.push(
            av.weldLength && av.utTracker
              ? kpi(
                  w.label,
                  kpiPct(
                    b.ut.ut_weld_length_m === 0
                      ? null
                      : b.ut.ut_rej_length_m / b.ut.ut_weld_length_m,
                  ),
                )
              : emptyKpi(w),
          );
          break;
        // M34 — the CCC term needs ref_ut_tracker_ccc.
        case "UT Def.Length":
          out.push(
            av.utTracker ? kpi(w.label, kpiNum(b.ut.ut_rej_length_m, 3)) : emptyKpi(w),
          );
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
      if (isBacklogChart(w.canvas_id)) {
        // The pbix chart IS the trend workbook, summed over every party AND
        // every scope (SG/TMCP included), with only the PROJECT sentinel
        // dropped. Verified week for week against the owner's 31-Jul..28-Aug
        // chart. RT = M47 vs M48; PWHT = M60 vs M64.
        const isRt = !/pwht/i.test(w.canvas_id);
        const src = {
          sources: SOURCES_PR_ALL_LOADED,
          ...subcoArgs(f),
          // Without history the chart is this one computed week, so it must
          // honour every slicer, not just the party.
          weldTypes: filterValues(f.wtype),
          weldCats: filterValues(f.wcat),
          haArea: haAreaPicks(f),
          cutoff: chartCutoff(ctx.asOf),
        };
        // The workbook is keyed per PARTY only. A sub-contractor filter picks
        // that party's rows, exactly as pages 7-11 do; a weld-type or weld-cat
        // filter has no counterpart there, so the history is genuinely
        // unavailable and only the computed current week is shown.
        const historyOk = historyAvailable(f);
        const [points, rtCur, pwhtCur] = await Promise.all([
          historyOk
            ? weeklySnapshot({
                metrics: snapshotMetricsFor(w),
                ...subcoArgs(f),
                aggregate: true,
                excludeProject: true,
                weeks: w.labels.length,
            upTo: chartCutoff(ctx.asOf),
              })
            : Promise.resolve([]),
          isRt ? rtBacklogCurrent(src) : Promise.resolve(null),
          isRt ? Promise.resolve(null) : pwhtBacklogCurrent(src),
        ]);
        if (!historyOk) {
          out.push(currentWeekOnlyChart(w, chartCutoff(ctx.asOf), rtCur, pwhtCur));
          note(ctx, FILTER_NO_HISTORY_NOTE);
          continue;
        }
        out.push(withCurrentWeek(snapshotChart(w, points), rtCur, pwhtCur));
        if (points.length === 0) note(ctx, TREND_NOTE);
        else note(ctx, BACKLOG_PROVENANCE_NOTE);
        continue;
      }
      const metrics = snapshotMetricsFor(w, { project: true });
      const isRate = metrics.some(
        (m) =>
          m === SNAPSHOT_METRICS.RT_FILM_REJECTION_RATE_PROJECT ||
          m === SNAPSHOT_METRICS.UT_LENGTH_REJECTION_RATE_PROJECT,
      );
      // The page-1 backlog bars are `Sum(TREND Report[…])` with no
      // sub-contractor in the visual — a project total, so sum the parties.
      // `scope: ALL` keeps a `GAC SG` row from being added on top of `GAC`.
      // The two rejection-rate lines are already project-wide values repeated
      // on every party row, so they are deduplicated, never summed.
      if (!historyAvailable(f)) {
        out.push(emptyWidget(w));
        note(ctx, FILTER_NO_HISTORY_NOTE);
        continue;
      }
      const points = await weeklySnapshot({
        metrics,
        ...subcoArgs(f),
        // The project rate lines (M25P/M36P) are written once per PARTY with
        // the same project-wide value — the seeder has no PROJECT row for them
        // (that sentinel carries only the MPI metrics) — so they are
        // deduplicated per week, never summed and never filtered to PROJECT.
        scope: SNAPSHOT_SCOPES.ALL,
        aggregate: !isRate,
        weeks: w.labels.length,
            upTo: chartCutoff(ctx.asOf),
      });
      out.push(snapshotChart(w, points, { project: true }));
      if (points.length === 0) note(ctx, TREND_NOTE);
      if (metrics.some((m) => PROVISIONAL_METRICS.has(m))) note(ctx, PROVISIONAL_NOTE);
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
  ["RT/UT Only", SNAPSHOT_METRICS.RT_BACKLOG_PWHT_Y_DONE_PLUS_N],
  // M64 `PWHT BACKLOG RT NOT Done`, NOT M62 `PWHT Backlog For RT`. The pbix
  // chart is the trend workbook, and its "+" series is the SG/TMCP-scoped
  // measure: 3 every week, where M62 is 354. Verified against the owner's
  // 31-Jul..28-Aug chart.
  ["PWHT+RT/UT", SNAPSHOT_METRICS.PWHT_BACKLOG_RT_NOT_DONE],
  ["PWHT+RT", SNAPSHOT_METRICS.PWHT_BACKLOG_RT_NOT_DONE],
  ["PWHT Only", SNAPSHOT_METRICS.PWHT_BACKLOG_ALL_TYPES],
  ["% RT Rej Film", SNAPSHOT_METRICS.RT_FILM_REJECTION_RATE],
  ["% UT Rej Length", SNAPSHOT_METRICS.UT_LENGTH_REJECTION_RATE],
]);

/**
 * Page 1's two rejection-rate lines are the PROJECT columns of the same
 * workbook (`Project RT % Rej Rate` / `Project UT % Rej Rate`), a flat value
 * repeated on every sub-contractor row of a week — not the per-party rate.
 */
const SNAPSHOT_SERIES_PROJECT = new Map<string, string>([
  ["% RT Rej Film", SNAPSHOT_METRICS.RT_FILM_REJECTION_RATE_PROJECT],
  ["% UT Rej Length", SNAPSHOT_METRICS.UT_LENGTH_REJECTION_RATE_PROJECT],
]);

/**
 * Rate metrics are stored as fractions (`0.0027` = 0.27 %, exactly as the
 * workbook holds them) but the mockup's chart data are percent numbers
 * (`"0.27"`), and the axes are labelled `percent-axis`. Scale on the way out so
 * the stored value stays the source of truth.
 */
const RATE_METRICS: ReadonlySet<string> = new Set([
  SNAPSHOT_METRICS.RT_FILM_REJECTION_RATE,
  SNAPSHOT_METRICS.UT_LENGTH_REJECTION_RATE,
  SNAPSHOT_METRICS.RT_FILM_REJECTION_RATE_PROJECT,
  SNAPSHOT_METRICS.UT_LENGTH_REJECTION_RATE_PROJECT,
]);


/**
 * The backlog charts (page 1 and 7-11). They read the trend workbook — which
 * is what the pbix chart is — summed over every party AND every scope, with
 * only the PROJECT sentinel dropped, rather than the per-party/ALL-scope
 * aggregation the other snapshot charts use.
 */
const isBacklogChart = (canvasId: string) => /backlog/i.test(canvasId);

/**
 * Overwrite a backlog chart's LAST week with values computed from `mv_joint`.
 *
 * History stays the trend workbook — the pbix chart is the workbook — but the
 * current week is recomputed from the owner's DAX so the chart can never drift
 * from the measures page 2 renders. Both agree today; if they ever stop, the
 * computed value is the truthful one and a test fails.
 *
 * | series | measure | today |
 * |---|---|---|
 * | `RT/UT+PWHT` | `RT BACKLOG … & PWHT "Y" NOT Done "PR all"` | 76 |
 * | `RT/UT Only` | `RT Backlog+PWHT "N"` + `RT Backlog+PWHT Progress "Y"` | 596 |
 * | `PWHT+RT/UT` | `PWHT Backlog … RT NOT Done "PR all"` (SG/TMCP) | 3 |
 * | `PWHT Only` | `PWHT All BACKLOG All WELD TYPE` − the above | 1,039 |
 *
 * A page-7/10 PWHT chart carries only `PWHT Only`; it still gets the
 * `total − M64` value, which for those parties is the whole total (M64 is GAC's
 * alone today).
 */
function withCurrentWeek(
  chart: ChartWidget,
  rt: RtBacklogCurrent | null,
  pwht: PwhtBacklogCurrent | null,
): ChartWidget {
  if (chart.labels.length === 0) return chart;
  const last = chart.labels.length - 1;
  const value = (label: string): number | null => {
    if (/^RT\/UT Only/i.test(label)) return rt?.rt_only ?? null;
    if (/^PWHT Only/i.test(label)) return pwht?.pwht_only ?? null;
    // The two `+` series, told apart by which chart they are on.
    if (/\+/.test(label)) {
      return /^PWHT/i.test(label) ? (pwht?.plus_rt ?? null) : (rt?.plus_pwht ?? null);
    }
    return null;
  };
  return {
    ...chart,
    datasets: chart.datasets.map((d) => {
      const v = value(d.label ?? "");
      if (v === null) return d;
      const data = [...d.data];
      data[last] = v;
      return { ...d, data };
    }),
  };
}

/**
 * The workbook is keyed per PARTY only: it has no weld-type, weld-cat, HA or
 * area dimension. Under any of those four the history cannot honour the filter,
 * so it is not drawn — a line that ignored the filter just set would be worse
 * than none.
 */
const historyAvailable = (f: WeldingFilters) =>
  !f.wtype && !f.wcat && !f.ha && !f.area;

/**
 * A backlog chart reduced to its current week, for when a weld-type or
 * weld-cat filter makes the workbook history inapplicable.
 *
 * One labelled point rather than a blank widget: the number is still true and
 * still answers "what is the backlog under this filter", and the accompanying
 * note explains why there is no line behind it.
 */
function currentWeekOnlyChart(
  spec: SpecChart,
  asOf: string,
  rt: RtBacklogCurrent | null,
  pwht: PwhtBacklogCurrent | null,
): ChartWidget {
  const value = (label: string): number | null => {
    if (/^RT\/UT Only/i.test(label)) return rt?.rt_only ?? null;
    if (/^PWHT Only/i.test(label)) return pwht?.pwht_only ?? null;
    if (/\+/.test(label)) {
      return /^PWHT/i.test(label) ? (pwht?.plus_rt ?? null) : (rt?.plus_pwht ?? null);
    }
    return null;
  };
  return {
    kind: "chart",
    canvas_id: spec.canvas_id,
    title: spec.title,
    chart_type: spec.chart_type,
    labels: [asOf],
    datasets: spec.datasets.map((d) => ({
      label: d.label ?? "",
      data: [value(d.label ?? "")],
    })),
    options_notes: spec.options_notes.join(", ") || undefined,
  };
}

function snapshotMetricsFor(
  spec: SpecChart,
  opts: { project?: boolean } = {},
): string[] {
  const map = opts.project ? SNAPSHOT_SERIES_PROJECT : SNAPSHOT_SERIES;
  return spec.datasets
    .map((d) => map.get(d.label ?? "") ?? SNAPSHOT_SERIES.get(d.label ?? ""))
    .filter((m): m is string => Boolean(m));
}

function snapshotChart(
  spec: SpecChart,
  points: Awaited<ReturnType<typeof weeklySnapshot>>,
  opts: { project?: boolean } = {},
): ChartWidget {
  const weeks = [...new Set(points.map((p) => p.week_end_date))].sort();
  const map = opts.project ? SNAPSHOT_SERIES_PROJECT : SNAPSHOT_SERIES;
  const datasets = spec.datasets.map((d) => {
    const metric = map.get(d.label ?? "") ?? SNAPSHOT_SERIES.get(d.label ?? "");
    const scale = metric && RATE_METRICS.has(metric) ? 100 : 1;
    return {
      label: d.label ?? "",
      data: weeks.map((wk) => {
        const v =
          points.find((p) => p.week_end_date === wk && p.metric === metric)?.value ??
          null;
        if (v === null) return null;
        // Round after scaling: 0.0045 * 100 is 0.44999999999999996 in binary
        // floating point, and the mockup prints "0.45".
        return scale === 1 ? v : Number((v * scale).toFixed(2));
      }),
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
  // R3-01: project scope = the loaded union minus INCO; ACCIONA is included and
  // supplies the mockup's Acciona row in the sub-contractor table.
  const scope: Scope = projectScope({ temporaryLines: false });
  const av = await availability("PR_ALL", SOURCES_PR_ALL_LOADED, scope);
  const sources = await loadedSources();
  const scopeNote = projectScopeNote(sources);
  if (scopeNote) note(ctx, scopeNote);
  noteIf(ctx, utCoverageNote(av.ut));
  if (!(await sourceHasRows(SOURCES_CCC))) note(ctx, CCC_NOTE);
  const weekEnd = await latestWeekEnd(chartCutoff(ctx.asOf));
  const rtTypes = { ...scope, weldTypes: ["BW", "GW", "MW", "CLET"] };
  const noJ = { ...scope, excludeWeldCats: ["J"] };
  const statusScope = { ...scope, weldCats: WELD_STATUS_CATS };
  const [pivot, thisWeek, cat, sub] = await Promise.all([
    weldTypePivot(statusScope),
    weekEnd
      ? weldTypePivot(statusScope, { thisWeekEnding: weekEnd })
      : Promise.resolve(null),
    bundleByWithTotal(rtTypes, GROUP_WELD_CAT, av),
    bundleByWithTotal(noJ, GROUP_SUBCON, av),
  ]);
  const byCat = cat.byGroup;
  const total = cat.total;
  const bySub = sub.byGroup;
  const subTotal = sub.total;
  if (!thisWeek) note(ctx, TREND_NOTE);
  if (!av.spool) note(ctx, FABRICATED_NOTE);

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

/**
 * The pbix gives every sub-contractor page TWO similar tables:
 *
 *   "Cumulative RT Joints Tested and Accepted"     -> the `"EP"` family
 *   "Cumulative RT/UT Joints Tested and Accepted"  -> the `"PR all"` family
 *
 * Our mockup reproduces the second: its 14 columns map one-for-one onto that
 * visual's 14 Values. Every instance of it in report-inventory.md — GAC,
 * TEKFEN and MEDGULF alike — binds `"PR all"`, and not one binds `"EP"`. We
 * were rendering it from the page's own `"EP"` bundle, i.e. from the OTHER
 * table's measures.
 *
 * The visual also carries `Weld Type IN {BW, CLET, GW, MW}` (= RT_WELD_TYPES).
 * Verified against the report owner's screenshot, TEKFEN films:
 *
 * | binding | Taken | Acc | Rej |
 * |---|---|---|---|
 * | `"EP"`, as we rendered it | 82,339 | 81,566 | 773 |
 * | `"PR all"`, no type filter | 82,312 | 81,505 | 807 |
 * | **`"PR all"` + type filter** | **82,287** | **81,480** | **807** |
 *
 * Both changes are needed: switching family alone still misses by 25 films.
 */
const isPrAllNdeTable = (cols: readonly string[]) =>
  cols.includes("Tested Joints") && cols.includes("Films Taken");

async function buildSubconPage(
  spec: SpecPage,
  confs: SubconConf[],
  ctx: Ctx,
): Promise<Widget[]> {
  const weekEnd = await latestWeekEnd(chartCutoff(ctx.asOf));
  const av = await availability(
    variantFor(confs[0]!.sub),
    sourcesFor(confs[0]!.sub),
    baseScope(confs[0]!),
  );
  const prAv = await availability("PR_ALL", SOURCES_PR_ALL_LOADED, {
    ...baseScope(confs[0]!),
    sources: SOURCES_PR_ALL_LOADED,
    weldTypes: RT_WELD_TYPES,
    tmcpPipe: undefined,
  });
  const blocks = await Promise.all(
    confs.map(async (conf) => {
      const scope = baseScope(conf);
      const statusScope = { ...scope, weldCats: WELD_STATUS_CATS };
      // The "Cumulative RT/UT Joints Tested and Accepted" table reads the
      // "PR all" family with `Weld Type IN {BW, CLET, GW, MW}` — see
      // {@link isPrAllNdeTable}. Every other table keeps the page's family.
      const prScope: Scope = {
        ...scope,
        sources: SOURCES_PR_ALL_LOADED,
        weldTypes: RT_WELD_TYPES,
        // Owner ruling: this table must read the same as their
        // matrix-by-Sub-Contractor, which carries no TMCP filter. The pbix
        // visual DOES carry `TMCP Pipe IN {null}` — we follow the owner, not
        // the visual, and say so in lib/metrics/README.md. Only TEKFEN sets
        // `tmcpPipe` at all, so this is a no-op on the other pages; applied
        // uniformly so the rule lives in one place.
        tmcpPipe: undefined,
      };
      const [pivot, thisWeek, byCat, total, prByCat, prTotal, weekly, dist] =
        await Promise.all([
        weldTypePivot(statusScope),
        weekEnd
          ? weldTypePivot(statusScope, { thisWeekEnding: weekEnd })
          : Promise.resolve(null),
        bundleBy(scope, GROUP_WELD_CAT, av),
        bundleTotal(scope, av),
        bundleBy(prScope, GROUP_WELD_CAT, prAv),
        bundleTotal(prScope, prAv),
        weeklyProgress({
          ...partyArgs(conf.sub, conf.subs),
          weeks: 8,
          upTo: chartCutoff(ctx.asOf),
          excludeWeldCats: ["J"],
          sources: sourcesFor(conf.sub),
        }),
        weldTypeDistribution({ ...scope, excludeWeldTypes: ["THD"] }),
      ]);
      return { conf, pivot, thisWeek, byCat, total, prByCat, prTotal, weekly, dist };
    }),
  );
  if (!weekEnd) note(ctx, TREND_NOTE);
  noteIf(ctx, utCoverageNote(av.ut));
  if (!av.spool) note(ctx, FABRICATED_NOTE);
  if (!av.sourceLoaded) note(ctx, sourceNote(confs[0]!.sub));

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
      // The film cards exist TWICE in the pbix, once per family — page 30
      // carries `RT Total Films by Joint "A" "EP"` AND
      // `RT Total Films by Joint "PR all" "A"`, likewise for "R". We rendered
      // the "EP" pair while the table below rendered "PR all", so the page
      // contradicted itself. They now read the SAME bundle as that table, so
      // card and Total row cannot disagree — the report owner's ruling.
      //
      // `Joints Welded` is deliberately NOT switched. The pbix has both twins
      // for it too (`Welded Joint ID Uniq "EP"` and
      // `Joint Uniq "PR all" Welded`), so the binding is genuinely ambiguous,
      // and it is not part of the NDE table, so nothing on the page
      // contradicts it. Above all it must not inherit that table's
      // `Weld Type IN {BW, CLET, GW, MW}` filter, which belongs to the NDE
      // visual and would cut TEKFEN from 369,931 to 115,558.
      out.push(subconKpi(w, w.label === "Joints Welded" ? blk.total : blk.prTotal));
    } else if (w.kind === "chart") {
      if (/weldtype|weld_type/i.test(w.canvas_id)) {
        out.push(donutChart(w, blk.dist));
      } else if (/progress|welding/i.test(w.canvas_id)) {
        out.push(subconProgressChart(w, blk.weekly));
        if (blk.weekly.length === 0) note(ctx, TREND_NOTE);
        if (w.datasets.some((d) => d.label === "MT+PT Qty")) {
          note(ctx, MT_PT_SERIES_NOTE);
        }
      } else if (isBacklogChart(w.canvas_id)) {
        // Same series as page 1, filtered to this party -- every scope it has
        // (a GAC page sums GAC + GAC SG), the PROJECT sentinel dropped.
        const isRt = !/pwht/i.test(w.canvas_id);
        const src = {
          sources: SOURCES_PR_ALL_LOADED,
          ...partyArgs(blk.conf.sub, blk.conf.subs),
          cutoff: chartCutoff(ctx.asOf),
        };
        const [points, rtCur, pwhtCur] = await Promise.all([
          weeklySnapshot({
            metrics: snapshotMetricsFor(w),
            // ALL: every party summed, the PROJECT sentinel dropped — the page-1 bars.
            subContractor: isAll(blk.conf.sub) ? undefined : blk.conf.sub,
            subContractors: blk.conf.subs,
            aggregate: true,
            excludeProject: true,
            weeks: w.labels.length,
            upTo: chartCutoff(ctx.asOf),
          }),
          isRt ? rtBacklogCurrent(src) : Promise.resolve(null),
          isRt ? Promise.resolve(null) : pwhtBacklogCurrent(src),
        ]);
        out.push(withCurrentWeek(snapshotChart(w, points), rtCur, pwhtCur));
        if (points.length === 0) note(ctx, TREND_NOTE);
        else note(ctx, BACKLOG_PROVENANCE_NOTE);
      } else if (blk.conf.subs) {
        out.push(emptyWidget(w));
        note(ctx, SUBSET_RATE_NOTE);
      } else if (isAll(blk.conf.sub)) {
        // The party rejection-rate lines have project-wide twins (M25P/M36P):
        // read those exactly as page 1 does, deduplicated per week, never summed.
        const metrics = snapshotMetricsFor(w, { project: true });
        const points = await weeklySnapshot({
          metrics,
          scope: SNAPSHOT_SCOPES.ALL,
          aggregate: false,
          weeks: w.labels.length,
            upTo: chartCutoff(ctx.asOf),
        });
        out.push(snapshotChart(w, points, { project: true }));
        if (points.length === 0) note(ctx, TREND_NOTE);
        if (metrics.some((m) => PROVISIONAL_METRICS.has(m))) note(ctx, PROVISIONAL_NOTE);
      } else {
        const metrics = snapshotMetricsFor(w);
        const points = await weeklySnapshot({
          metrics,
          subContractor: blk.conf.sub,
          // R2-08: the workbook's `GAC SG` label is normalised to
          // (sub_contractor='GAC', scope='SG'); pick the matching qualifier.
          scope: snapshotScopeFor(blk.conf),
          weeks: w.labels.length,
            upTo: chartCutoff(ctx.asOf),
        });
        out.push(snapshotChart(w, points));
        if (points.length === 0) note(ctx, TREND_NOTE);
        if (metrics.some((m) => PROVISIONAL_METRICS.has(m))) note(ctx, PROVISIONAL_NOTE);
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
        const prAll = isPrAllNdeTable(w.columns);
        const src = prAll ? blk.prByCat : blk.byCat;
        out.push(
          metricTable(
            w,
            orderedCats(src.keys()).map((c) => ({
              label: c,
              bundle: src.get(c)!,
            })),
            prAll ? blk.prTotal : blk.total,
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

/**
 * The sub-contractor pages' KPI cards, bound to the `"PR all"` family.
 *
 * The pbix carries each of these cards twice, once per family (see the call
 * site). The film cards read the `"PR all"` twins, on the SAME bundle as the
 * NDE table below, so the card and the table's Total row can never disagree —
 * which is the whole point. `Joints Welded` stays on the page's own family;
 * see the call site for why.
 */
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
  conf: {
    sub: string;
    rtPct: number | undefined;
    kind: "nde" | "pwht";
    /** Screens multi-select: parties under ALL / RT % values under ALL RT. */
    subs?: readonly string[];
    rtPcts?: readonly number[];
  },
  ctx: Ctx,
): Promise<Widget[]> {
  const isCcc = conf.sub === "CCC";
  const all = isAll(conf.sub);
  const variant = variantFor(conf.sub);
  const classGroup = serviceClassGroup(conf.sub);
  const scope: Scope = {
    sources: sourcesFor(conf.sub),
    subContractor: all ? undefined : conf.sub,
    subContractors: all ? conf.subs : undefined,
    excludeSubContractors: all ? PROJECT_EXCLUDED_SUBCONTRACTORS : undefined,
    rtPct: conf.rtPct,
    rtPcts: conf.rtPcts,
    temporaryLines: false,
    weldedOnly: true,
    // §3.3: the PWHT-by-RT% pages carry the extra filter "PWHT Weld Status not
    // blank". It is a no-op for the backlog measures (their status list is
    // non-blank by construction) and restricts Joints Welded / PWHT Done.
    // CCC rows carry no `PWHT Weld Status` at all (its PWHT comes from the
    // joint record), so applying it there would empty the page.
    pwhtStatusPresent: conf.kind === "pwht" && !isCcc && !all ? true : undefined,
  };
  if (all) note(ctx, ALL_CLASS_NOTE);
  if (all && conf.kind === "pwht") note(ctx, ALL_PWHT_NOTE);
  // Service Class slicer: the options are the classes that occur under the page's
  // own scope (party + RT %), BEFORE the slicer is applied; a value that is not
  // among them is reported as "All" and dropped, like page 1's slicers.
  //
  // The two option lists are full scans of the scope (≈1 s each under ALL), so they
  // are STARTED here and awaited only where needed: at once when a slicer value has
  // to be validated, otherwise after the bundles — they then overlap the page's own
  // queries instead of delaying them (2026-09-21: ALL / ALL went 2.9 s → 1.6 s).
  const optionsScope: Scope = { ...scope };
  const optionsP = Promise.all([serviceClassOptions(optionsScope, classGroup), pwhtYnOptions(optionsScope)]);
  optionsP.catch(() => undefined); // surfaced by the await below; never an unhandled rejection
  // Multi-select (2026-10-14): both slicers take comma-joined lists, OR-ed.
  const requestedClass = filterValues(ctx.filters.sclass);
  // PWHT Y/N: the raw token (`Y` / `N` / `25.01`), see migration 0038 and R-04.
  const requestedPwht = filterValues(ctx.filters.pwht);
  let keptClass: string[] = [];
  let keptPwht: string[] = [];
  if (requestedClass || requestedPwht) {
    const [classOpts, pwhtOpts] = await optionsP;
    // Compared trimmed: a URL round-trip drops the trailing space of a class
    // with no Service Cat (see Scope.serviceClass).
    keptClass = (requestedClass ?? []).filter((v) => classOpts.some((o) => o.trim() === v.trim()));
    keptPwht = (requestedPwht ?? []).filter((v) => pwhtOpts.includes(v));
    if (keptClass.length < (requestedClass?.length ?? 0) || keptPwht.length < (requestedPwht?.length ?? 0)) {
      note(ctx, FILTER_UNKNOWN_NOTE);
    }
    if (keptClass.length) scope.serviceClasses = { sql: classGroup.sql, values: keptClass };
    if (keptPwht.length) scope.pwhtYns = keptPwht;
  }
  if (isCcc || all) note(ctx, PWHT_CCC_NEW_NOTE);
  const av = await availability(variant, sourcesFor(conf.sub), scope);
  const family =
    conf.kind === "pwht"
      ? variant === "EP"
        ? PWHT_BACKLOG_EP
        : PWHT_BACKLOG_PRALL
      : variant === "EP"
        ? RT_BACKLOG_EP
        : RT_BACKLOG_PRALL;

  // The details table is the pbix matrix `Weld Cat` → `Service Class`: a service
  // class recurs under F (shop) and S (field) because part of a line is welded in
  // the shop and part on site (owner, 2026-09-15). Group by the PAIR, never by
  // class alone, so a class's shop and field joints land under their own cat.
  const catClassGroup = weldCatClassGroup(classGroup);
  // R2-05: `RT Selected Date` is empty on every CCC row, so M51/M66 have no
  // clock for CCC. Honest-empty, never a substituted date.
  const wantAging = !isCcc;
  const [
    total,
    byCat,
    byCatClass,
    byRtPct,
    agingTotal,
    agingByCat,
    agingByCatClass,
  ] = await Promise.all([
    bundleTotal(scope, av),
    bundleBy(scope, GROUP_WELD_CAT, av),
    bundleBy(scope, catClassGroup, av),
    bundleBy(scope, GROUP_RT_PCT, av),
    wantAging ? backlogAging(scope, ctx.asOf, family) : Promise.resolve(null),
    wantAging
      ? backlogAgingBy(scope, ctx.asOf, family, GROUP_WELD_CAT)
      : Promise.resolve(new Map<string | null, AgingBuckets>()),
    wantAging
      ? backlogAgingBy(scope, ctx.asOf, family, catClassGroup)
      : Promise.resolve(new Map<string | null, AgingBuckets>()),
  ]);
  if (!av.spool) note(ctx, FABRICATED_NOTE);
  noteIf(ctx, utCoverageNote(av.ut));
  if (isCcc) note(ctx, CCC_AGING_NOTE);
  if (!av.sourceLoaded) note(ctx, sourceNote(conf.sub));

  // M52 appears BOTH as a column of the details table and as its own table on
  // the 5/10/20 % pages, so compute the per-group gap once and reuse it.
  const wantGap = spec.widgets.some(
    (w) =>
      w.kind === "table" &&
      w.columns.some((c) => COVERAGE_GAP_HEADERS.has(c)),
  );
  // The coverage gap (M52) is defined against ONE RT % target; over every RT % it has none.
  const gapByGroup = wantGap && conf.rtPct !== undefined
    ? new Map(
        (
          await coverageGapByServiceClass(scope, conf.rtPct / 100, catClassGroup, {
            byHa: await hasHaValues(scope),
          })
        ).map((r) => [r.group, r.backlog_joints] as const),
      )
    : new Map<string | null, number>();
  const gapTotal = wantGap
    ? [...gapByGroup.values()].reduce((a, v) => a + v, 0)
    : null;

  const attach = (
    b: Bundle,
    aging: AgingBuckets | undefined,
    gap: number | null = gapTotal,
  ): Bundle => {
    const withGap: Bundle = { ...b, coverageGap: wantGap ? gap : null };
    if (!wantAging) return withGap;
    return conf.kind === "pwht"
      ? { ...withGap, pwhtAging: aging ?? EMPTY_AGING }
      : { ...withGap, rtAging: aging ?? EMPTY_AGING };
  };

  const totalB = attach(total, agingTotal ?? undefined);

  const [classOptions, pwhtOptions] = await optionsP;
  if (pwhtOptions.includes(PWHT_AMBIGUOUS_TOKEN)) note(ctx, PWHT_TOKEN_NOTE);
  const classFilter: FilterWidget = {
    kind: "filter",
    id: "sclass",
    label: "Service Class",
    // Trimmed, so a ticked box round-trips through the URL (see keptClass).
    options: [FILTER_ALL, ...new Set(classOptions.map((o) => o.trim()))],
    value: keptClass.length ? keptClass.map((v) => v.trim()).join(FILTER_SEP) : FILTER_ALL,
    multi: true,
  };
  const pwhtFilter: FilterWidget = {
    kind: "filter",
    id: "pwht",
    label: "PWHT Y/N",
    options: [FILTER_ALL, ...pwhtOptions],
    value: keptPwht.length ? keptPwht.join(FILTER_SEP) : FILTER_ALL,
    multi: true,
  };
  // The slicers go FIRST, ahead of every data widget (as page 1's bar does).
  const out: Widget[] = [classFilter, pwhtFilter];
  for (const w of spec.widgets) {
    if (w.kind !== "table") {
      out.push(emptyWidget(w));
      continue;
    }
    const key = w.columns[0];
    if (key === "Service Class+Weld Cat" || key === "Weld Cat") {
      // Hierarchical detail table: each weld cat, then ITS service classes
      // (indented), the way the pbix matrix expands.
      const rows: RowSpec[] = [];
      for (const c of orderedCats(byCat.keys())) {
        rows.push({ label: c, bundle: attach(byCat.get(c)!, agingByCat.get(c)) });
        for (const k of [...byCatClass.keys()]
          .filter((k): k is string => k !== null && splitCatClass(k).cat === c)
          .sort((a, b) => splitCatClass(a).cls.localeCompare(splitCatClass(b).cls))) {
          rows.push({
            label: CHILD_INDENT + splitCatClass(k).cls.trim(),
            bundle: attach(byCatClass.get(k)!, agingByCatClass.get(k), gapByGroup.get(k) ?? 0),
          });
        }
      }
      out.push(metricTable(w, rows, totalB));
    } else if (key === "Service Class+NDT Remarks") {
      // §3.3 mk 14/16/18 second table: M52, the RT-coverage gap.
      if (conf.rtPct === undefined) {
        out.push(emptyTable(w));
        note(ctx, "The RT-coverage gap (M52) needs one RT % target; pick an RT % to see it.");
      } else {
        out.push(await coverageGapTable(w, scope, conf.rtPct, classGroup, ctx));
      }
    } else if (key === "RT%") {
      const rows: RowSpec[] = [];
      // One row per RT % on the page's own RT %; every RT % present, highest first, under ALL.
      const pctKeys =
        conf.rtPct === undefined
          ? [...byRtPct.keys()].filter((k): k is string => k !== null).sort((a, b) => Number(b) - Number(a))
          : [String(conf.rtPct)];
      for (const pctKey of pctKeys) {
        const pctBundle = byRtPct.get(pctKey);
        if (pctBundle) rows.push({ label: pctKey, bundle: attach(pctBundle, conf.rtPct === undefined ? undefined : agingTotal ?? undefined) });
      }
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
  const av = await availability(
    variantFor(confs[0]!.sub),
    sourcesFor(confs[0]!.sub),
    baseScope(confs[0]!),
  );
  const blocks = await Promise.all(
    confs.map(async (conf) => {
      const scope: Scope = {
        ...baseScope(conf),
        excludeWeldTypes: isAll(conf.sub) ? ["THD", "DMY"] : conf.excludeWeldTypes,
        wpsPresent: true,
      };
      const [rows, total] = await Promise.all([
        wpsRejectionTable(scope),
        // The mockup's Total row is the pivot grand total, NOT the sum of the
        // WPS rows: a joint welded under two WPSs would otherwise be counted
        // twice. Evidence (calculation-logic §3.2): mockup page 42 GAC total
        // 371,613 = page 4 GAC 375,152 − GAC DMY 3,539, i.e. a distinct count.
        bundleTotal(scope, av),
      ]);
      return { rows, total };
    }),
  );
  if (!av.sourceLoaded) note(ctx, sourceNote(confs[0]!.sub));
  if (isAll(confs[0]!.sub)) note(ctx, ALL_WPS_NOTE);
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

/**
 * R2-08: the trend workbooks label some rows `GAC SG` / `TEKFEN TMCP`; the
 * seeder splits those into `sub_contractor` + `scope`. Map a page block onto
 * the qualifier it needs.
 */
function snapshotScopeFor(conf: SubconConf): string | undefined {
  if (conf.serviceCat === "SG") return SNAPSHOT_SCOPES.SG;
  if (conf.tmcpPipe === true) return SNAPSHOT_SCOPES.TMCP;
  if (conf.serviceCat === "NONSG") return SNAPSHOT_SCOPES.ALL;
  return undefined;
}

/**
 * M52 — the "RT Backlog" second table on the CCC 5/10/20 % pages: how many more
 * joints must be shot to reach the contractual coverage for each service class.
 * Rows with a gap of 0 are dropped, exactly as the mockup does
 * (`>0`, §3.3 mk 14).
 */
async function coverageGapTable(
  spec: SpecTable,
  scope: Scope,
  rtPct: number,
  group: GroupSpec,
  ctx: Ctx,
): Promise<TableWidget> {
  const target = rtPct / 100;
  const byHa = await hasHaValues(scope);
  if (!byHa) note(ctx, HA_NOTE);
  const rows = await coverageGapByServiceClass(scope, target, group, { byHa });
  const body = rows
    .filter((r) => r.backlog_joints > 0)
    .sort((a, b) => b.backlog_joints - a.backlog_joints)
    .map((r) => [r.group ?? "", fixed(2).format(r.backlog_joints)]);
  const total = rows.reduce((a, r) => a + r.backlog_joints, 0);
  const totalRow = ["Total", total === 0 ? "" : fixed(2).format(total)];
  return {
    kind: "table",
    title: spec.title ?? "",
    columns: spec.columns,
    rows: [...body, totalRow],
    total_row: totalRow,
  };
}

/** Provenance note for a page whose fact source has not been loaded yet. */
function sourceNote(sub: string): string {
  if (isAll(sub)) return "No fact rows are loaded for any sub-contractor source, so every figure on this page is unavailable — not zero.";
  return sub === "CCC"
    ? CCC_NOTE
    : `${sub} is not loaded: weld holds no rows for this subcontractor's source, ` +
        `so every figure on this page is unavailable — not zero.`;
}
