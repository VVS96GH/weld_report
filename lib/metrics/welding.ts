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
  scopeWhere,
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
export function weldingAggs(p: Params, a = "w"): AggSpec[] {
  return [
    // M01 Joints Welded
    { key: "joints_welded", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([weldedCond(a)])}` },
    // M03 Joints Welded incl. repairs & rewelds (denominator of the WPS ratio)
    {
      key: "joints_welded_incl_repair_reweld",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([weldedInclRepairCond(a)])}`,
    },
    // M70 MT/PT Done, `"EP"` flavour (MT report + PT report, both welded)
    {
      key: "mt_pt_done",
      sql:
        `count(DISTINCT ${a}.joint_id) ${filterWhere([`${a}.weld_date IS NOT NULL`, `${a}.mt_report IS NOT NULL`])}` +
        ` + count(DISTINCT ${a}.joint_id) ${filterWhere([`${a}.weld_date IS NOT NULL`, `${a}.pt_report IS NOT NULL`])}`,
    },
    // M71 MT Qty / MPI Done
    {
      key: "mt_done",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([`${a}.weld_date IS NOT NULL`, `${a}.mt_report IS NOT NULL`])}`,
    },
    { key: "dia_inch", sql: `sum(${a}.dia_inch) ${filterWhere([weldedCond(a)])}` },
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

/** M01, M03, M70, M71 for one scope. */
export async function weldingStats(scope: Scope): Promise<WeldingStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: weldingAggs(p),
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
  const conds = [scopeWhere(scope, p), weldedCond()];
  if (opts.thisWeekEnding) {
    // M05 — Welding Status for this Week. Weeks run Saturday→Friday and the
    // label is the Friday (`Calendar[Week_End_Date]`, §M05).
    const we = p.add(opts.thisWeekEnding);
    conds.push(`w.weld_date > ${we}::date - 7 AND w.weld_date <= ${we}::date`);
  }
  const where = and(conds);
  const sql =
    `SELECT w.weld_cat, w.weld_type, count(DISTINCT w.joint_id) AS joints_welded,\n` +
    `       GROUPING(w.weld_cat) AS g_cat, GROUPING(w.weld_type) AS g_type\n` +
    `  FROM weld w\n` +
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
  return { cells, catTotals, total, weldTypes: [...weldTypes].sort() };
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
  const sql =
    `SELECT w.weld_type, count(DISTINCT w.joint_id) AS joints_welded\n` +
    `  FROM weld w\n` +
    ` WHERE ${and([scopeWhere(scope, p), weldedCond()])}\n` +
    ` GROUP BY 1\n` +
    ` ORDER BY 2 DESC NULLS LAST`;
  const rows = await query(sql, p.list());
  return z
    .array(z.object({ weld_type: zText, joints_welded: zCount }))
    .parse(rows);
}

/** Map one row of a combined `weldingAggs()` select into {@link WeldingStats}. */
export function weldingStatsFromRow(raw: unknown): WeldingStats {
  return WeldingRow.parse(raw);
}
