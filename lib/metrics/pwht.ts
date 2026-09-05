/**
 * PWHT metrics — M60, M62–M66.
 *
 * Both scopes. The `"EP"`/`"WD"` family reads `pwht_weld_status` / `pwht_report`
 * off the dump; the `"PR all"` family adds the CCC branch, which reads
 * `pwht_y_n_ccc` / `pwht_report_no_ccc` — the materialised overlay of
 * `ccc_joint_pwht` (from `AllTrain_CSVExport_Joint Record.csv`) onto CCC's
 * welder-pass rows.
 *
 * §7 C-4: CCC's PWHT is a clean `Y`/`N` (202,786 / 1,357,487). The `'25.01'`
 * ambiguous token of ruling R-04 is a `Weld Dump` artefact and is deliberately
 * NOT tested on the CCC branch — writing it there would be dead code.
 *
 * Reality check from the dump: `PWHT Weld Status` only ever holds
 * `NR` (152,412), `HS` (873) and `H` (11), so M60 can never exceed 884 over
 * the whole file (calculation-logic §M60).
 */

import { z } from "zod";
import { query } from "@/lib/db";
import {
  type AggSpec,
  type GroupSpec,
  Params,
  PWHT_BACKLOG_STATUS,
  PWHT_BACKLOG_STATUS_PRALL,
  RT_BACKLOG_STATUS,
  RT_BACKLOG_STATUS_100,
  RT_WELD_TYPES,
  type Scope,
  and,
  buildGroupedSelect,
  filterWhere,
  inList,
  inListOrBlank,
  scopeWhere,
  zCount,
  zText,
} from "./scope";
import { type AgingBuckets, type BacklogFamily, backlogAging } from "./rt";

/** M60 `[PWHT Backlog Weld Status All Weld Types "EP"]`. */
export function pwhtBacklogCond(p: Params, a = "w"): string {
  return and([
    inList(`${a}.pwht_weld_status`, PWHT_BACKLOG_STATUS, p),
    `${a}.pwht_report IS NULL`,
  ]);
}

/** M62 `[PWHT Backlog Weld Status "BW" "GW" "EP"]` = M60 + RT weld types. */
export function pwhtBacklogRtTypesCond(p: Params, a = "w"): string {
  return and([pwhtBacklogCond(p, a), inList(`${a}.weld_type`, RT_WELD_TYPES, p)]);
}

/** M63 `[PWHT BACKLOG RT100% "EP"]` = M62 + `RT% = 100`. */
export function pwhtBacklogRt100Cond(p: Params, a = "w"): string {
  return and([pwhtBacklogRtTypesCond(p, a), `${a}.rt_pct = 100`]);
}

/** M65 `[PWHT Done All Weld Types "EP"]`. */
export function pwhtDoneCond(a = "w"): string {
  return `${a}.pwht_report IS NOT NULL`;
}

/**
 * M64 `[PWHT Backlog Weld Status All Weld Types RT NOT Done "EP"]` —
 * PWHT still on hold AND the RT is also outstanding.
 */
export function pwhtBacklogRtNotDoneCond(p: Params, a = "w"): string {
  return and([
    `${a}.weld_date IS NOT NULL`,
    `${a}.rt_report IS NULL`,
    `(${inList(`${a}.rt_weld_status`, RT_BACKLOG_STATUS, p)} OR ${and([
      `${a}.rt_pct = 100`,
      inListOrBlank(`${a}.rt_weld_status`, RT_BACKLOG_STATUS_100, p),
    ])})`,
    pwhtBacklogCond(p, a),
  ]);
}

export function pwhtAggs(p: Params, a = "w"): AggSpec[] {
  void p;
  const count = (flag: string) => `count(*) ${filterWhere([`${a}.${flag}`])}`;
  return [
    { key: "pwht_backlog_all_types", sql: count("pwht_backlog") },       // M60
    { key: "pwht_backlog_rt_types", sql: count("pwht_backlog_rt_types") }, // M62
    { key: "pwht_backlog_rt100", sql: count("pwht_backlog_rt100") },     // M63
    { key: "pwht_backlog_rt_not_done", sql: count("pwht_backlog_rt_not_done") }, // M64
    { key: "pwht_done", sql: count("pwht_done") },                       // M65
    { key: "pwht_required", sql: count("pwht_required") },
  ];
}

const PwhtRow = z.object({
  pwht_backlog_all_types: zCount,
  pwht_backlog_rt_types: zCount,
  pwht_backlog_rt100: zCount,
  pwht_backlog_rt_not_done: zCount,
  pwht_done: zCount,
  pwht_required: zCount,
});

export type PwhtStats = z.infer<typeof PwhtRow>;

const EMPTY: PwhtStats = {
  pwht_backlog_all_types: 0,
  pwht_backlog_rt_types: 0,
  pwht_backlog_rt100: 0,
  pwht_backlog_rt_not_done: 0,
  pwht_done: 0,
  pwht_required: 0,
};

/** M60, M62, M63, M64, M65 for one scope. */
export async function pwhtStats(scope: Scope): Promise<PwhtStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: pwhtAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return PwhtRow.parse(rows[0] ?? EMPTY);
}

/** The same bundle, grouped. */
export async function pwhtStatsBy(
  scope: Scope,
  group: GroupSpec,
): Promise<Map<string | null, PwhtStats>> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [group],
    aggs: pwhtAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  const out = new Map<string | null, PwhtStats>();
  for (const raw of rows) {
    const key = zText.parse((raw as Record<string, unknown>)[group.key] ?? null);
    out.set(key, PwhtRow.parse(raw));
  }
  return out;
}

/**
 * M66 — PWHT backlog aging on the same clock as M51
 * (`DATEDIFF([Weld Date], TODAY(), DAY)`, §0.5 `No of Days "WD"`).
 * Unlike the RT backlog, a PWHT-backlog row need not be welded, so joints with
 * no `weld_date` land in the `no_weld_date` bucket rather than being dropped —
 * matching `analysis/reconcile_check.py`.
 */
export async function pwhtBacklogAging(
  scope: Scope,
  asOf: string,
): Promise<AgingBuckets> {
  return backlogAging(scope, asOf, PWHT_BACKLOG_EP);
}

/** The M66 backlog families, for {@link backlogAging} / `backlogAgingBy`. */
export const PWHT_BACKLOG_EP: BacklogFamily = {
  flag: "pwht_backlog",
  dateCol: "pwht_backlog_weld_date",
};
export const PWHT_BACKLOG_PRALL: BacklogFamily = {
  flag: "pwht_backlog_rest",
  dateCol: "pwht_backlog_prall_weld_date",
};

/** Map one row of a combined `pwhtAggs()` select into {@link PwhtStats}. */
export function pwhtStatsFromRow(raw: unknown): PwhtStats {
  return PwhtRow.parse(raw);
}

// ── "PR all" variants ───────────────────────────────────────────────────────

/**
 * M61 `[PWHT All BACKLOG All WELD TYPE "PR all"]` — two added terms:
 *
 *   CCC:   Weld Date > 0 AND PWHT Y/N CCC = "Y" AND PWHT Report No CCC = ""
 *   rest:  PWHT Weld Status IN {…+'T1-2','HS CCC'} AND PWHT Report = ""
 *
 * The branches are disjoint by construction — dump rows have no
 * `pwht_y_n_ccc`, CCC rows have no `pwht_weld_status` — so the DAX's `+` and a
 * single OR give the same answer; the `+` is kept for literal parity.
 */
export function pwhtBacklogCccCond(p: Params, a = "w"): string {
  return and([
    `${a}.weld_date IS NOT NULL`,
    `${a}.pwht_y_n_ccc = ${p.add("Y")}`,
    `${a}.pwht_report_no_ccc IS NULL`,
  ]);
}

/** The non-CCC branch of M61 — the `"PR all"` status list (adds `'T1-2'`). */
export function pwhtBacklogCondPrAll(p: Params, a = "w"): string {
  return and([
    inList(`${a}.pwht_weld_status`, PWHT_BACKLOG_STATUS_PRALL, p),
    `${a}.pwht_report IS NULL`,
  ]);
}

/** M65 `[PWHT Done All Weld Types "PR all"]` — the coalesced report column. */
export function pwhtDoneCondPrAll(a = "w"): string {
  return `coalesce(${a}.pwht_report, ${a}.pwht_report_no_ccc) IS NOT NULL`;
}

export function pwhtAggsPrAll(p: Params, a = "w"): AggSpec[] {
  void p;
  const count = (flag: string) => `count(*) ${filterWhere([`${a}.${flag}`])}`;
  // M61-M63 are two ADDED distinct counts (CCC branch + everyone else), so the
  // view carries both flags and the metric adds the two counts.
  return [
    {
      key: "pwht_backlog_all_types",
      sql: `${count("pwht_backlog_ccc")} + ${count("pwht_backlog_rest")}`,
    },
    {
      key: "pwht_backlog_rt_types",
      sql: `${count("pwht_backlog_ccc_rt")} + ${count("pwht_backlog_rest_rt")}`,
    },
    {
      key: "pwht_backlog_rt100",
      sql: `${count("pwht_backlog_ccc_rt100")} + ${count("pwht_backlog_rest_rt100")}`,
    },
    { key: "pwht_backlog_rt_not_done", sql: count("pwht_backlog_rt_not_done") },
    { key: "pwht_done", sql: count("pwht_done_prall") },
    {
      key: "pwht_required",
      sql: `${count("pwht_required")} + ${count("pwht_required_ccc")}`,
    },
  ];
}

/** M61–M65 for one `"PR all"` scope. Same row shape as {@link pwhtStats}. */
export async function pwhtStatsPrAll(scope: Scope): Promise<PwhtStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: pwhtAggsPrAll(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return PwhtRow.parse(rows[0] ?? EMPTY);
}
