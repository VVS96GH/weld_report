/**
 * Flange-dashboard metrics — the nine measures the mockup uses.
 *
 * A different fact from `weld`: one row per **register line**, not per flange
 * and not per weld. `Flange Progress.xlsx` contributes 136,741 rows over
 * 131,283 distinct Joint IDs (5,458 repeats — the same flange re-jointed,
 * visible as `Joint Point` `1FR`, `1FR2`, `2FR`…); `ovAssets_1619` contributes
 * 226,504 rows over 226,504 Joint IDs. The two namespaces are **disjoint**
 * (intersection 0, union 357,787), so the pbix `Table.Combine` is a plain
 * `UNION ALL`.
 *
 * Ruling RF-06: every measure is `count(DISTINCT joint_id)`, never `count(*)`.
 * A `count(*)` here over-reports by 5,458 on the `Flange Progress` side.
 *
 * DAX verbatim: `analysis/flange/pbix-flange.md` §5 "The nine the mockup uses".
 * Numbers pinned by `tests/metrics-flange.test.ts` from
 * `analysis/flange/metrics.json`.
 */

import { z } from "zod";
import { query } from "@/lib/db";
import { Params, and, divide, zCount, zText } from "./scope";

/**
 * Physical column names, in one place.
 *
 * Reconciled against the shipped `db/migrations/0015_flange.sql` (83 columns).
 * The one name that differed from `analysis/flange/plan.md`'s proposal is the
 * sub-contractor: the migration calls it `sub_contractor`, matching `weld`,
 * not `flange_subcontractor`. Keeping them in one object means
 * reconciling with the shipped migration is a single edit rather than a hunt
 * through predicates — and `tests/metrics-flange.test.ts` checks every one of
 * them against the live catalogue, so a rename fails loudly instead of
 * silently returning zero.
 */
export const FLANGE_COLUMNS = {
  jointId: "joint_id",
  jointDate: "joint_date",
  pccTighteningDate: "pcc_tightening_date",
  subcontractor: "sub_contractor",
  cat: "cat",
  reason: "reason_for_de_tightening",
  ha: "ha",
  method: "joint_method",
  source: "source",
} as const;

const C = FLANGE_COLUMNS;
const T = "flange f";

/** The filter-bar sentinel for "no predicate". */
export const FLANGE_ALL = "All";
/**
 * The visible bucket for rows with no handover area (RF-03): 6,593 Joint IDs,
 * 1.84 %, whose `[System]` is empty or `System-NA` and which the absent
 * `HA l0_abs_guide` would have resolved. It gets its own row and its own filter
 * option — never folded into HA1.
 */
export const FLANGE_BLANK = "(blank)";

export type FlangeFilters = {
  ha?: string;
  subco?: string;
  method?: string;
};

/** Filter triple → SQL conditions. `All`/undefined contributes no predicate. */
export function flangeWhere(filters: FlangeFilters, p: Params, a = "f"): string {
  const c: string[] = [];
  const eq = (col: string, value: string | undefined) => {
    if (!value || value === FLANGE_ALL) return;
    if (value === FLANGE_BLANK) {
      c.push(`${a}.${col} IS NULL`);
      return;
    }
    c.push(`${a}.${col} = ${p.add(value)}`);
  };
  eq(C.ha, filters.ha);
  eq(C.subcontractor, filters.subco);
  eq(C.method, filters.method);
  return and(c);
}

// ── the nine measures ───────────────────────────────────────────────────────

/**
 * `Total Flanges ID Jointed` — the mockup's "Inspected".
 * DAX: `CALCULATE(DISTINCTCOUNT([Joint ID]), [Joint Date] > 0)`.
 */
const INSPECTED = `f.${C.jointDate} IS NOT NULL`;

/** `Total Flanges ID Remainder` — `ISBLANK([Joint Date])`. */
const REMAINS = `f.${C.jointDate} IS NULL`;

/**
 * `Total Flanges ID Tightening Constraction "CCC no cat"` — the mockup's
 * "Const-n". Two added `CALCULATE`s over the same date filter:
 *
 *   A: `[Flange Subcontractor] = "CCC"`
 *   B: `[Flange Subcontractor] <> "CCC" AND [Cat.] IN {"X","Y"}`
 *
 * The branches are disjoint by construction (a row is CCC or it is not), so the
 * DAX's `+` and this `OR` are the same set.
 *
 * RF-07: this is the `"CCC no cat"` pair, NOT the plain
 * `Total Flanges ID Tightening Constraction` trio. `ovAssets_1619[Cat.]` is
 * only 75.3 % filled (`X` 87,948 · `Y` 65,460 · `Z` 17,052 · `A` 158, 55,886
 * blank → `TBN`), so applying the `Cat.` test to CCC drives CCC's const-n to
 * ~0. Proof the mockup uses this pair: only it produces a non-zero CCC `pcc`
 * (773) together with a CCC `constn` (59,126) that ignores `Cat.`.
 */
const CONSTN = and([
  INSPECTED,
  `f.${C.pccTighteningDate} IS NULL`,
  `(f.${C.subcontractor} = 'CCC' OR f.${C.cat} IN ('X','Y'))`,
]);

/**
 * `Total Flanges ID Tightening PCC "CCC no cat"` — the mockup's "PCC".
 *
 * DAX adds two distinct counts:
 *   `[PCC Tightening Date] > 0`  +  `[Joint Date] > 0 AND subco <> "CCC" AND [Cat.] IN {"Z","A","B"}`
 *
 * Unlike const-n these two are NOT disjoint in principle — a non-CCC row with
 * both a PCC date and `Cat. IN {Z,A,B}` would be counted twice by the literal
 * `+`. This uses `OR`, i.e. counts such a joint once.
 *
 * RESOLVED (owner DAX, verified): the intersection is EMPTY, so `OR` and `+`
 * both give 16,880 and the choice cannot be observed on this data. A test pins
 * the disjointness, so if the register ever produces such a row the ambiguity
 * resurfaces loudly instead of silently moving a number.
 */
const PCC = `(f.${C.pccTighteningDate} IS NOT NULL OR ${and([
  INSPECTED,
  `f.${C.subcontractor} <> 'CCC'`,
  `f.${C.cat} IN ('Z','A','B')`,
])})`;

/**
 * `Flanges ID BreakDown` — "Leaked Flange Break".
 * DAX: `[Reason for De-Tightening] = "FLANGE LEAKAGE"`. Upper-cased here
 * because the CCC side reaches the value through two M replacements
 * (`Flange leaking` / `Flange leakage` → `FLANGE LEAKAGE`) and the register
 * side stores it already upper-case.
 */
const LEAKED = `upper(f.${C.reason}) = 'FLANGE LEAKAGE'`;

/** The six counts every table row and KPI is built from. */
const MEASURES = [
  { key: "total", cond: null },
  { key: "inspected", cond: INSPECTED },
  { key: "constn", cond: CONSTN },
  { key: "pcc", cond: PCC },
  { key: "leaked", cond: LEAKED },
  { key: "remains", cond: REMAINS },
] as const;

function measureSelect(a = "f"): string {
  return MEASURES.map((m) =>
    m.cond === null
      ? `count(DISTINCT ${a}.${C.jointId}) AS total`
      : `count(DISTINCT ${a}.${C.jointId}) FILTER (WHERE ${m.cond}) AS ${m.key}`,
  ).join(",\n       ");
}

const StatsRow = z.object({
  total: zCount,
  inspected: zCount,
  constn: zCount,
  pcc: zCount,
  leaked: zCount,
  remains: zCount,
});

export type FlangeStats = z.infer<typeof StatsRow> & {
  /** `Flanges ID Jointed %` = inspected / total. */
  pct: number | null;
  /** `Flange Break Down Rate %` = leaked / inspected. */
  leakedPct: number | null;
};

const EMPTY_ROW = {
  total: 0,
  inspected: 0,
  constn: 0,
  pcc: 0,
  leaked: 0,
  remains: 0,
};

function toStats(r: z.infer<typeof StatsRow>): FlangeStats {
  return {
    ...r,
    pct: divide(r.inspected, r.total),
    leakedPct: divide(r.leaked, r.inspected),
  };
}

/** All six measures for one filter selection. */
export async function flangeStats(filters: FlangeFilters): Promise<FlangeStats> {
  const p = new Params();
  const sql = `SELECT ${measureSelect()}\n  FROM ${T}\n WHERE ${flangeWhere(filters, p)}`;
  const rows = await query(sql, p.list());
  return toStats(StatsRow.parse(rows[0] ?? EMPTY_ROW));
}

export type FlangeGroupRow = FlangeStats & { group: string };

/**
 * All six measures grouped by one column. NULL group values surface as
 * {@link FLANGE_BLANK} rather than being dropped — the `(blank)` HA bucket is
 * 1.84 % of the register and must stay visible (RF-03).
 */
export async function flangeStatsBy(
  filters: FlangeFilters,
  column: string,
  opts: { orderBy?: "total" | "group" } = {},
): Promise<FlangeGroupRow[]> {
  const p = new Params();
  const order = opts.orderBy === "group" ? "1 ASC" : "2 DESC";
  const sql =
    `SELECT coalesce(f.${column}, '${FLANGE_BLANK}') AS "group",\n       ${measureSelect()}\n` +
    `  FROM ${T}\n WHERE ${flangeWhere(filters, p)}\n GROUP BY 1\n ORDER BY ${order}`;
  const rows = await query(sql, p.list());
  return z
    .array(StatsRow.extend({ group: z.string() }))
    .parse(rows)
    .map((r) => ({ ...toStats(r), group: r.group }));
}

/** The same, grouped by two columns — the HA table's per-method detail rows. */
export async function flangeStatsBy2(
  filters: FlangeFilters,
  columnA: string,
  columnB: string,
): Promise<Array<FlangeGroupRow & { group2: string }>> {
  const p = new Params();
  const sql =
    `SELECT coalesce(f.${columnA}, '${FLANGE_BLANK}') AS "group",\n` +
    `       coalesce(f.${columnB}, '${FLANGE_BLANK}') AS group2,\n       ${measureSelect()}\n` +
    `  FROM ${T}\n WHERE ${flangeWhere(filters, p)}\n GROUP BY 1, 2\n ORDER BY 1, 3 DESC`;
  const rows = await query(sql, p.list());
  return z
    .array(StatsRow.extend({ group: z.string(), group2: z.string() }))
    .parse(rows)
    .map((r) => ({ ...toStats(r), group: r.group, group2: r.group2 }));
}

/**
 * Every group-by the page needs, in ONE scan.
 *
 * The page used to run `flangeStats` + four `flangeStatsBy*` calls, each a
 * separate pass over 363k rows with six `count(DISTINCT joint_id)` aggregates —
 * ~1.5 s for the unfiltered page against RF-09's 500 ms budget. `GROUPING SETS`
 * gets the same five results from one pass; `GROUPING()` distinguishes a rollup
 * NULL from a genuinely blank value, which plain `coalesce` cannot.
 */
export type FlangeBreakdown = {
  overall: FlangeStats;
  bySubco: FlangeGroupRow[];
  byHa: FlangeGroupRow[];
  byMethod: FlangeGroupRow[];
  byHaMethod: Array<FlangeGroupRow & { group2: string }>;
};

const BreakdownRow = StatsRow.extend({
  ha: zText,
  method: zText,
  subco: zText,
  g_ha: zCount,
  g_method: zCount,
  g_subco: zCount,
});

export async function flangeBreakdown(
  filters: FlangeFilters,
): Promise<FlangeBreakdown> {
  const p = new Params();
  // Collapse to joint grain FIRST, then count rows.
  //
  // Every measure is "a joint counts if ANY of its rows satisfies the filter",
  // which is `bool_or` — so the outer aggregates become `count(*)` and Postgres
  // stops sorting 363k joint ids once per aggregate per grouping set. Measured
  // on the unfiltered page: 6 x count(DISTINCT) over 5 GROUPING SETS took
  // 3.7 s; this shape is well inside RF-09's 500 ms budget.
  //
  // `remains` stays `bool_or(joint_date IS NULL)`, NOT `NOT inspected`: a
  // flange re-jointed once can have a dated and an undated row and the register
  // counts it in both, which is why total (357,787) is less than
  // inspected + remains (358,151) by 364 joints. That is the recon's behaviour
  // and the pinned numbers depend on it.
  const sql =
    `WITH j AS (\n` +
    `  SELECT f.${C.jointId} AS joint_id,\n` +
    `         max(f.${C.ha}) AS ha, max(f.${C.method}) AS method,\n` +
    `         max(f.${C.subcontractor}) AS subco,\n` +
    `         bool_or(${INSPECTED}) AS inspected,\n` +
    `         bool_or(${CONSTN}) AS constn,\n` +
    `         bool_or(${PCC}) AS pcc,\n` +
    `         bool_or(${LEAKED}) AS leaked,\n` +
    `         bool_or(${REMAINS}) AS remains\n` +
    `    FROM ${T}\n   WHERE ${flangeWhere(filters, p)}\n   GROUP BY 1\n` +
    `)\n` +
    `SELECT j.ha, j.method, j.subco,\n` +
    `       GROUPING(j.ha) AS g_ha, GROUPING(j.method) AS g_method,\n` +
    `       GROUPING(j.subco) AS g_subco,\n` +
    `       count(*) AS total,\n` +
    `       count(*) FILTER (WHERE j.inspected) AS inspected,\n` +
    `       count(*) FILTER (WHERE j.constn) AS constn,\n` +
    `       count(*) FILTER (WHERE j.pcc) AS pcc,\n` +
    `       count(*) FILTER (WHERE j.leaked) AS leaked,\n` +
    `       count(*) FILTER (WHERE j.remains) AS remains\n` +
    `  FROM j\n` +
    ` GROUP BY GROUPING SETS ((j.ha, j.method), (j.ha), (j.method), (j.subco), ())`;
  const rows = z.array(BreakdownRow).parse(await query(sql, p.list()));

  const out: FlangeBreakdown = {
    overall: toStats(EMPTY_ROW),
    bySubco: [],
    byHa: [],
    byMethod: [],
    byHaMethod: [],
  };
  const label = (v: string | null) => v ?? FLANGE_BLANK;
  for (const r of rows) {
    const stats = toStats(r);
    if (r.g_ha === 1 && r.g_method === 1 && r.g_subco === 1) out.overall = stats;
    else if (r.g_subco === 0) out.bySubco.push({ ...stats, group: label(r.subco) });
    else if (r.g_ha === 0 && r.g_method === 1) out.byHa.push({ ...stats, group: label(r.ha) });
    else if (r.g_method === 0 && r.g_ha === 1)
      out.byMethod.push({ ...stats, group: label(r.method) });
    else if (r.g_ha === 0 && r.g_method === 0)
      out.byHaMethod.push({
        ...stats,
        group: label(r.ha),
        group2: label(r.method),
      });
  }
  out.bySubco.sort((a, b) => b.total - a.total);
  out.byMethod.sort((a, b) => b.total - a.total);
  out.byHa.sort((a, b) => a.group.localeCompare(b.group));
  out.byHaMethod.sort(
    (a, b) => a.group.localeCompare(b.group) || b.total - a.total,
  );
  return out;
}

/**
 * The three filter option lists in one scan, memoised.
 *
 * These are DIMENSION lists, not measures: they do not depend on the selected
 * filters, so every request was paying the same 332 ms scan to rebuild an
 * identical five-item dropdown. The cache is per process with a short TTL, and
 * it holds no measure — a stale option list would show a filter value that
 * yields nothing, never a wrong number. `flangeOptionsCacheClear()` exists so
 * tests and a post-load hook can drop it.
 */
const OPTIONS_TTL_MS = 60_000;
let optionsCache: { at: number; value: Record<string, string[]> } | null = null;

export function flangeOptionsCacheClear(): void {
  optionsCache = null;
}

export async function flangeAllOptions(): Promise<Record<string, string[]>> {
  const now = Date.now();
  if (optionsCache && now - optionsCache.at < OPTIONS_TTL_MS) {
    return optionsCache.value;
  }
  const sql =
    `WITH j AS (\n` +
    `  SELECT f.${C.jointId} AS joint_id, max(f.${C.subcontractor}) AS subco,\n` +
    `         max(f.${C.ha}) AS ha, max(f.${C.method}) AS method\n` +
    `    FROM ${T} GROUP BY 1\n` +
    `)\n` +
    `SELECT j.subco, j.ha, j.method,\n` +
    `       GROUPING(j.subco) AS g_subco, GROUPING(j.ha) AS g_ha,\n` +
    `       GROUPING(j.method) AS g_method, count(*) AS n\n` +
    `  FROM j\n` +
    ` GROUP BY GROUPING SETS ((j.subco), (j.ha), (j.method))\n` +
    ` ORDER BY 7 DESC`;
  const rows = z
    .array(
      z.object({
        subco: zText,
        ha: zText,
        method: zText,
        g_subco: zCount,
        g_ha: zCount,
        g_method: zCount,
        n: zCount,
      }),
    )
    .parse(await query(sql, []));
  const out: Record<string, string[]> = { subco: [], ha: [], method: [] };
  for (const r of rows) {
    if (r.g_subco === 0) out.subco.push(r.subco ?? FLANGE_BLANK);
    else if (r.g_ha === 0) out.ha.push(r.ha ?? FLANGE_BLANK);
    else if (r.g_method === 0) out.method.push(r.method ?? FLANGE_BLANK);
  }
  for (const k of Object.keys(out)) out[k] = [FLANGE_ALL, ...out[k]];
  optionsCache = { at: now, value: out };
  return out;
}

// ── time series ─────────────────────────────────────────────────────────────

const MonthRow = z.object({ month: zText, inspected: zCount, leaked: zCount });
export type FlangeMonth = { month: string; inspected: number; leaked: number };

/**
 * `Total Flanges ID Jointed` and `Flanges ID BreakDown` bucketed by
 * `[Joint Date]` month — the Monthly Inspection bar and the input to the
 * recomputed leak timeline.
 *
 * The register runs `2022-09` … `2026-08` plus one `2027-02` row, a
 * data-entry typo of a single Joint ID that ruling RF-05 keeps rather than
 * silently dropping (the pbix does not filter it either).
 */
export async function flangeMonthly(filters: FlangeFilters): Promise<FlangeMonth[]> {
  const p = new Params();
  // Dedupe to (joint, month) first so the outer aggregates are plain counts.
  // A flange re-jointed in two months counts in both — the register's own
  // behaviour, which is why these buckets sum to more than the headline total.
  const sql =
    `WITH j AS (\n` +
    `  SELECT to_char(date_trunc('month', f.${C.jointDate}), 'YYYY-MM') AS month,\n` +
    `         f.${C.jointId} AS joint_id, bool_or(${LEAKED}) AS leaked\n` +
    `    FROM ${T}\n` +
    `   WHERE ${and([flangeWhere(filters, p), INSPECTED])}\n` +
    `   GROUP BY 1, 2\n` +
    `)\n` +
    `SELECT j.month, count(*) AS inspected,\n` +
    `       count(*) FILTER (WHERE j.leaked) AS leaked\n` +
    `  FROM j GROUP BY 1 ORDER BY 1`;
  const rows = await query(sql, p.list());
  return z.array(MonthRow).parse(rows).map((r) => ({
    month: r.month ?? "",
    inspected: r.inspected,
    leaked: r.leaked,
  }));
}

export type LeakPoint = { month: string; rate: number | null };

/**
 * RF-04 — the leak timeline, **recomputed** as a cumulative rate.
 *
 * The as-reported weekly series lives in
 * `CUM Trend Flange Progress Break Down Rate % .xlsx` (288 rows), which is not
 * in `sources/`. What the register can produce is the cumulative rate the pbix
 * measure `CUM Flange Rejection Rate Project` defines — leaked-to-date over
 * inspected-to-date — with each leak back-dated to its joint's own
 * `[Joint Date]`. That is a genuinely different number from the weekly
 * snapshot published at the time, so the widget label says so verbatim and it
 * is never presented as the reported series.
 */
export async function flangeLeakTimeline(
  filters: FlangeFilters,
): Promise<LeakPoint[]> {
  const months = await flangeMonthly(filters);
  let inspected = 0;
  let leaked = 0;
  return months.map((m) => {
    inspected += m.inspected;
    leaked += m.leaked;
    const rate = divide(leaked, inspected);
    return { month: m.month, rate: rate === null ? null : rate * 100 };
  });
}

// ── filter options and provenance ───────────────────────────────────────────

/**
 * The distinct values of one filter column, ordered by population.
 * Always prefixed with `All`; a NULL bucket becomes {@link FLANGE_BLANK}.
 */
export async function flangeOptions(column: string): Promise<string[]> {
  const sql =
    `SELECT coalesce(f.${column}, '${FLANGE_BLANK}') AS "group",\n` +
    `       count(DISTINCT f.${C.jointId}) AS n\n` +
    `  FROM ${T}\n GROUP BY 1\n ORDER BY 2 DESC`;
  const rows = await query(sql, []);
  const parsed = z.array(z.object({ group: z.string(), n: zCount })).parse(rows);
  return [FLANGE_ALL, ...parsed.map((r) => r.group)];
}

/**
 * The page's `as_of` (RF-01: the dashboard ships live) — the latest joint or
 * control-inspection date **that is not in the future**.
 *
 * The future guard is load-bearing, not defensive tidying. RF-05 keeps the
 * register's dirty rows, one of which carries a `2027-02-22` Joint Date; a
 * plain `max()` therefore labels the page "data as of Feb 2027", which is
 * false. A date after today is not an as-of date. The excluded row is still
 * counted everywhere else and is called out in the page note.
 */
export async function flangeAsOf(): Promise<{
  as_of: string | null;
  future_rows: number;
}> {
  try {
    const rows = await query<{ d: string | null; n: string }>(
      `SELECT greatest(max(${C.jointDate}) FILTER (WHERE ${C.jointDate} <= current_date),
` +
        `                max(control_inspection_date) FILTER (WHERE control_inspection_date <= current_date))::text AS d,
` +
        `       count(*) FILTER (WHERE ${C.jointDate} > current_date)::text AS n
` +
        `  FROM flange`,
    );
    return { as_of: rows[0]?.d ?? null, future_rows: Number(rows[0]?.n ?? 0) };
  } catch {
    return { as_of: null, future_rows: 0 };
  }
}

/** `true` when the `flange` table has rows. */
export async function flangeLoaded(): Promise<boolean> {
  try {
    const rows = await query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM flange) AS present",
    );
    return Boolean(rows[0]?.present);
  } catch {
    return false;
  }
}

/** Row counts per source, for the provenance note. */
export async function flangeSourceCounts(): Promise<Array<{ source: string; rows: number }>> {
  try {
    const rows = await query(
      `SELECT f.${C.source}::text AS source, count(*) AS rows FROM ${T} GROUP BY 1 ORDER BY 1`,
    );
    return z.array(z.object({ source: z.string(), rows: zCount })).parse(rows);
  } catch {
    return [];
  }
}

/** Unused today; kept so the repair trio has one obvious place to land (RF-02). */
export const FLANGE_REPAIR_SOURCES = [
  "CCC - Flange Repair Log - Consolidated.xlsx",
  "GAC - Flange Repair Log - Consolidated.xlsx",
  "TFN - Flange Repair Log - Consolidated.xlsx",
  "MEG - Flange Repair Log - Consolidated.xlsx",
  "Flange Face Re-Machining Log.xlsx",
] as const;

// ── FLANGE MANAGEMENT / Repartition and Progress ────────────────────────────

/**
 * The tightening methods the management matrix reports, in the pbix's order.
 * `Total` is the whole row, not a fifth method.
 */
export const FLANGE_METHODS = ["Manual", "TBN", "Tensioning", "Torquing"] as const;

export type FlangeCell = { required: number; completed: number };
export type FlangeMatrixRow = {
  /** `HA1`…`HA4`, `(blank)`, or a sub-contractor when `child` is true. */
  group: string;
  child: boolean;
  /** Keyed by method plus `Total`. */
  cells: Record<string, FlangeCell>;
};

const MatrixRow = z.object({
  ha: zText,
  subco: zText,
  method: zText,
  required: zCount,
  completed: zCount,
});

/**
 * HA × Sub-contractor × tightening method, in one pass.
 *
 * `Required` is every flange in the register for the group; `Completed` is the
 * inspected total, Const-n plus PCC — the same two measures the HA Flange
 * Status table already shows, so no new DAX is involved.
 *
 * Returned flat and already ordered: each HA parent followed by its
 * sub-contractor children, then the grand total. The page turns that into rows;
 * the shape lives here so the ordering is testable without a page.
 */
export async function flangeManagementMatrix(
  filters: FlangeFilters,
): Promise<FlangeMatrixRow[]> {
  const p = new Params();
  // `Completed` is the page's own INSPECTED measure, not a hand-rolled
  // date test: the two differ (a raw `joint_date OR pcc_tightening_date`
  // over-counts by 2,671 project-wide), and this matrix must agree with the
  // HA Flange Status table cell for cell.
  const completed =
    `count(DISTINCT f.${C.jointId}) FILTER (WHERE ${INSPECTED})`;
  const sql =
    `SELECT coalesce(f.${C.ha}, '${FLANGE_BLANK}') AS ha,\n` +
    `       coalesce(f.${C.subcontractor}, '${FLANGE_BLANK}') AS subco,\n` +
    `       f.${C.method} AS method,\n` +
    `       count(DISTINCT f.${C.jointId}) AS required,\n` +
    `       ${completed} AS completed\n` +
    `  FROM ${T}\n WHERE ${flangeWhere(filters, p)}\n` +
    // A flange with no tightening method has no column to land in, so it is
    // outside the matrix. The pbix does the same: its grand total is 357,786
    // against a register of 357,787.
    `   AND f.${C.method} IS NOT NULL\n` +
    ` GROUP BY 1, 2, 3`;
  let rows: z.infer<typeof MatrixRow>[];
  try {
    rows = z.array(MatrixRow).parse(await query(sql, p.list()));
  } catch {
    return [];
  }

  const blank = (): Record<string, FlangeCell> =>
    Object.fromEntries(
      [...FLANGE_METHODS, "Total"].map((m) => [m, { required: 0, completed: 0 }]),
    );
  const add = (into: Record<string, FlangeCell>, m: string, r: number, c: number) => {
    for (const key of [m, "Total"]) {
      const cell = into[key];
      if (!cell) continue;
      cell.required += r;
      cell.completed += c;
    }
  };

  const byHa = new Map<string, Record<string, FlangeCell>>();
  const byHaSub = new Map<string, Map<string, Record<string, FlangeCell>>>();
  const grand = blank();
  for (const r of rows) {
    const ha = r.ha ?? FLANGE_BLANK;
    const sub = r.subco ?? FLANGE_BLANK;
    const method = r.method ?? "";
    if (!byHa.has(ha)) byHa.set(ha, blank());
    if (!byHaSub.has(ha)) byHaSub.set(ha, new Map());
    const subs = byHaSub.get(ha)!;
    if (!subs.has(sub)) subs.set(sub, blank());
    add(byHa.get(ha)!, method, r.required, r.completed);
    add(subs.get(sub)!, method, r.required, r.completed);
    add(grand, method, r.required, r.completed);
  }

  const out: FlangeMatrixRow[] = [];
  for (const ha of [...byHa.keys()].sort()) {
    out.push({ group: ha, child: false, cells: byHa.get(ha)! });
    const subs = byHaSub.get(ha)!;
    for (const sub of [...subs.keys()].sort()) {
      out.push({ group: sub, child: true, cells: subs.get(sub)! });
    }
  }
  out.push({ group: "Total", child: false, cells: grand });
  return out;
}
