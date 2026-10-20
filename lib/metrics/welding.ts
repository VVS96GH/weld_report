/**
 * Welding-progress metrics — M01–M07, M70/M71, and the weekly progress
 * material (M05/M06) read from `mv_weekly_progress`.
 *
 * `"EP"`/`"WD"` scope only. The `"PR all"` twins (M02, M04) need the CCC
 * Talisman export, ACCIONA and INCO, none of which is in `sources/`
 * (calculation-logic §1.2, ruling R-01) — callers get honest-empty for those.
 */

import { z } from "zod";
import { query } from "@/lib/db";
import {
  type AggSpec,
  type GroupSpec,
  Params,
  type Scope,
  and,
  buildGroupedSelect,
  filterWhere,
  JOINT_FROM,
  scopeWhere,
  SOURCES_PR_ALL,
  zCount,
  zSum,
  zText,
} from "./scope";

/** DAX `[Repair & Reweld] = ""` — §6.2 stores it NOT NULL DEFAULT ''. */
export const NOT_REPAIR = `coalesce(w.repair_reweld,'') = ''`;

/** M01 `[Welded Joint ID Uniq "EP"]` predicate. */
export function weldedCond(a = "w"): string {
  return and([
    `coalesce(${a}.repair_reweld,'') = ''`,
    `${a}.weld_date IS NOT NULL`,
  ]);
}

/** M03 `[Joint Uniq "PR all" Welded & R/RW]` predicate — repairs included. */
export function weldedInclRepairCond(a = "w"): string {
  return `${a}.weld_date IS NOT NULL`;
}

/** The welding aggregate bundle. */
/**
 * The welding bundle, read from `mv_joint`. Each flag there is `bool_or()` of
 * the row-level predicate above, so `count(*) FILTER (WHERE flag)` is exactly
 * the DAX's `DISTINCTCOUNT(Joint ID)` with that filter.
 */
export function weldingAggs(
  p: Params,
  a = "w",
  variant: "EP" | "PR_ALL" = "EP",
): AggSpec[] {
  void p;
  // M70/M71 read `MT Report "PR All"` / `PT Report "PR All"`, which are
  // CALCULATED columns — `IF([X Report] <> "", [X Report], IF([X Report CCC]
  // <> "", [X Report CCC], BLANK()))` — not the imported ones. Reading only the
  // imported column reported 197,723 where the pbix reports 589,065.
  const mt = variant === "EP" ? "mt_done" : "mt_done_prall";
  const pt = variant === "EP" ? "pt_done" : "pt_done_prall";
  return [
    // M01 Joints Welded
    { key: "joints_welded", sql: `count(*) ${filterWhere([`${a}.is_welded_norepair`])}` },
    // M03 Joints Welded incl. repairs & rewelds (denominator of the WPS ratio)
    {
      key: "joints_welded_incl_repair_reweld",
      sql: `count(*) ${filterWhere([`${a}.is_welded`])}`,
    },
    // M70 MT/PT Done — the DAX adds two independent distinct counts.
    {
      key: "mt_pt_done",
      sql:
        `count(*) ${filterWhere([`${a}.${mt}`])}` +
        ` + count(*) ${filterWhere([`${a}.${pt}`])}`,
    },
    // M71 MT Qty / MPI Done
    { key: "mt_done", sql: `count(*) ${filterWhere([`${a}.${mt}`])}` },
    { key: "dia_inch", sql: `sum(${a}.dia_inch_welded)` },
  ];
}

const WeldingRow = z.object({
  joints_welded: zCount,
  joints_welded_incl_repair_reweld: zCount,
  mt_pt_done: zCount,
  mt_done: zCount,
  dia_inch: zSum,
});

export type WeldingStats = z.infer<typeof WeldingRow>;

/**
 * M01, M03, M70, M71 for one scope.
 *
 * `variant` picks the MT/PT family: `"EP"` reads the imported `mt_report` /
 * `pt_report`, `"PR_ALL"` reads the calculated `* Report "PR All"` coalesce
 * with the CCC joint record. Defaults to `"EP"` so every existing pin is
 * untouched; project-scope callers must ask for `"PR_ALL"`.
 */
export async function weldingStats(
  scope: Scope,
  variant: "EP" | "PR_ALL" = "EP",
): Promise<WeldingStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: weldingAggs(p, "w", variant),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return WeldingRow.parse(
    rows[0] ?? {
      joints_welded: 0,
      joints_welded_incl_repair_reweld: 0,
      mt_pt_done: 0,
      mt_done: 0,
      dia_inch: null,
    },
  );
}

/** The same bundle, grouped by one dimension. */
export async function weldingStatsBy(
  scope: Scope,
  group: GroupSpec,
): Promise<Map<string | null, WeldingStats>> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [group],
    aggs: weldingAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  const out = new Map<string | null, WeldingStats>();
  for (const raw of rows) {
    const key = zText.parse((raw as Record<string, unknown>)[group.key] ?? null);
    out.set(key, WeldingRow.parse(raw));
  }
  return out;
}

const PivotRow = z.object({
  weld_cat: zText,
  weld_type: zText,
  joints_welded: zCount,
  g_cat: zCount,
  g_type: zCount,
});

export type WeldTypePivot = {
  /** `weld_cat` → `weld_type` → M01. */
  cells: Map<string | null, Map<string | null, number>>;
  /** `weld_cat` → true distinct-joint total across ALL weld types. */
  catTotals: Map<string | null, number>;
  /** True distinct-joint total for the whole scope. */
  total: number;
  /** Every `weld_type` seen in the data, for disclosure of extra codes. */
  weldTypes: string[];
};

/**
 * The "Cumulative Welding Status" pivot: M01 by `weld_cat` × `weld_type`.
 *
 * `count(DISTINCT joint_id)` is not additive, so the `Total` column is a
 * separate rollup rather than a sum of the cells — that is what the pbix
 * matrix does too.
 */
export async function weldTypePivot(
  scope: Scope,
  opts: { thisWeekEnding?: string } = {},
): Promise<WeldTypePivot> {
  const p = new Params();
  const conds = [scopeWhere(scope, p), "w.is_welded_norepair"];
  if (opts.thisWeekEnding) {
    // M05 — Welding Status for this Week. Weeks run Saturday→Friday and the
    // label is the Friday (`Calendar[Week_End_Date]`, §M05). The clock is the
    // joint's latest NON-REPAIR weld date, because M01 excludes repairs.
    const we = p.add(opts.thisWeekEnding);
    conds.push(
      `w.weld_date_norepair > ${we}::date - 7 AND w.weld_date_norepair <= ${we}::date`,
    );
  }
  const where = and(conds);
  const sql =
    `SELECT w.weld_cat, w.weld_type, count(*) AS joints_welded,\n` +
    `       GROUPING(w.weld_cat) AS g_cat, GROUPING(w.weld_type) AS g_type\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${where}\n` +
    ` GROUP BY GROUPING SETS ((w.weld_cat, w.weld_type), (w.weld_cat), ())`;
  const rows = await query(sql, p.list());
  const cells = new Map<string | null, Map<string | null, number>>();
  const catTotals = new Map<string | null, number>();
  const weldTypes = new Set<string>();
  let total = 0;
  for (const raw of rows) {
    const r = PivotRow.parse(raw);
    // GROUPING() distinguishes a rollup NULL from a genuinely blank value.
    const catNull = r.g_cat === 1;
    const typeNull = r.g_type === 1;
    if (catNull && typeNull) {
      total = r.joints_welded;
    } else if (typeNull) {
      catTotals.set(r.weld_cat, r.joints_welded);
    } else {
      if (r.weld_type !== null) weldTypes.add(r.weld_type);
      let row = cells.get(r.weld_cat);
      if (!row) {
        row = new Map();
        cells.set(r.weld_cat, row);
      }
      row.set(r.weld_type, r.joints_welded);
    }
  }
  // a joint whose rows carry a second weld type counts in that column too (0061)
  for (const x of await extraTypeCounts(scope, conds, p, true)) {
    weldTypes.add(x.weld_type);
    let row = cells.get(x.weld_cat);
    if (!row) {
      row = new Map();
      cells.set(x.weld_cat, row);
    }
    row.set(x.weld_type, (row.get(x.weld_type) ?? 0) + x.n);
  }
  return { cells, catTotals, total, weldTypes: [...weldTypes].sort() };
}

/**
 * The extra (cat, type) counts of joints whose rows carry more than one weld
 * type (mv_joint_extra_type, migration 0061), under the same conditions; the
 * extra type itself must pass the scope's type filters. Only with
 * `scope.rowWeldTypes`.
 */
async function extraTypeCounts(
  scope: Scope,
  conds: string[],
  p: Params,
  byCat: boolean,
): Promise<Array<{ weld_cat: string | null; weld_type: string; n: number }>> {
  if (!scope.rowWeldTypes) return [];
  const q = new Params();
  // re-number: the caller's params are reused as they are, the new ones follow
  for (const v of p.list()) q.add(v);
  const more: string[] = [];
  if (scope.weldTypes?.length) more.push(`xt.weld_type = ANY(${q.any(scope.weldTypes)})`);
  if (scope.excludeWeldTypes?.length) more.push(`NOT (xt.weld_type = ANY(${q.any(scope.excludeWeldTypes)}))`);
  const sql =
    `SELECT ${byCat ? "w.weld_cat" : "NULL::text AS weld_cat"}, xt.weld_type, count(*) AS n\n` +
    `  FROM ${JOINT_FROM}\n` +
    `  JOIN mv_joint_extra_type xt ON xt.source = w.source AND xt.joint_id = w.joint_id\n` +
    ` WHERE ${and([...conds, ...more])}\n` +
    ` GROUP BY 1, 2`;
  const rows = await query(sql, q.list());
  return z.array(z.object({ weld_cat: zText, weld_type: z.string(), n: zCount })).parse(rows);
}

/**
 * M07 — Weld Type Distribution (the donut). M01 grouped by `weld_type`,
 * ordered descending, with the mockup's `Weld Type NOT IN {THD}` filter left
 * to the caller's scope.
 */
export async function weldTypeDistribution(
  scope: Scope,
): Promise<Array<{ weld_type: string | null; joints_welded: number }>> {
  const p = new Params();
  const conds = [scopeWhere(scope, p), "w.is_welded_norepair"];
  const sql =
    `SELECT w.weld_type, count(*) AS joints_welded\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${and(conds)}\n` +
    ` GROUP BY 1\n` +
    ` ORDER BY 2 DESC NULLS LAST`;
  const rows = z
    .array(z.object({ weld_type: zText, joints_welded: zCount }))
    .parse(await query(sql, p.list()));
  const extra = await extraTypeCounts(scope, conds, p, false);
  if (extra.length === 0) return rows;
  for (const x of extra) {
    const r = rows.find((y) => y.weld_type === x.weld_type);
    if (r) r.joints_welded += x.n;
    else rows.push({ weld_type: x.weld_type, joints_welded: x.n });
  }
  return rows.sort((a, b) => b.joints_welded - a.joints_welded);
}

/** Map one row of a combined `weldingAggs()` select into {@link WeldingStats}. */
export function weldingStatsFromRow(raw: unknown): WeldingStats {
  return WeldingRow.parse(raw);
}

/**
 * `true` when `weld` holds at least one row for the given sources.
 *
 * Used to tell "this subcontractor has no welds" from "this subcontractor's
 * export is not loaded yet" — the difference between a legitimate 0 and an
 * honest-empty. Cheap: an `EXISTS`, not a `count(*)`.
 */
export async function sourceHasRows(sources: readonly string[]): Promise<boolean> {
  const p = new Params();
  const sql = `SELECT EXISTS (SELECT 1 FROM ${JOINT_FROM} WHERE w.source::text = ANY(${p.any(sources)}::text[])) AS present`;
  try {
    const rows = await query<{ present: boolean }>(sql, p.list());
    return Boolean(rows[0]?.present);
  } catch {
    return false;
  }
}

/**
 * Which fact sources actually have rows in `weld`, and which of the pbix's
 * five do not.
 *
 * Every "X is not loaded" note on a page is derived from this, never
 * hard-coded: a note that keeps claiming CCC is missing after CCC loads is
 * exactly as dishonest as a fabricated zero, just in the other direction.
 */
export async function loadedSources(): Promise<{
  loaded: string[];
  absent: string[];
}> {
  const all = [...SOURCES_PR_ALL];
  try {
    const rows = await query<{ source: string }>(
      "SELECT DISTINCT source::text AS source FROM mv_joint ORDER BY 1",
    );
    const loaded = rows.map((r) => r.source);
    return { loaded, absent: all.filter((s) => !loaded.includes(s)) };
  } catch {
    return { loaded: [], absent: all };
  }
}

/** Human-readable party names for the `weld_source` enum values. */
export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  WELD_DUMP: "Weld Dump (GAC, TEKFEN, MEDGULF)",
  CCC_WELDER_RECORD: "CCC welder record",
  CCC_JOINT_RECORD: "CCC joint record",
  ACCIONA: "ACCIONA",
  INCO: "INCO",
};
