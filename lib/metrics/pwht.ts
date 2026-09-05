/**
 * PWHT metrics — M60, M62–M66.
 *
 * `"EP"`/`"WD"` scope. The `"PR all"` twins (M61, and the CCC branch of
 * M63/M66) read `PWHT Y/N CCC` / `PWHT Report No CCC`, which come from
 * `AllTrain_CSVExport_Joint Record.csv` — not in `sources/` and not in the
 * §8.1 column contract, so they are not implemented (ruling R-01).
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
  PWHT_YES_TOKENS,
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
import { type AgingBuckets, backlogAging } from "./rt";

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
  return [
    {
      key: "pwht_backlog_all_types",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([pwhtBacklogCond(p, a)])}`,
    },
    {
      key: "pwht_backlog_rt_types",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([pwhtBacklogRtTypesCond(p, a)])}`,
    },
    {
      key: "pwht_backlog_rt100",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([pwhtBacklogRt100Cond(p, a)])}`,
    },
    {
      key: "pwht_backlog_rt_not_done",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([pwhtBacklogRtNotDoneCond(p, a)])}`,
    },
    { key: "pwht_done", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([pwhtDoneCond(a)])}` },
    {
      key: "pwht_required",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([inList(`${a}.pwht_y_n`, PWHT_YES_TOKENS, p)])}`,
    },
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
  return backlogAging(scope, asOf, (p) => pwhtBacklogCond(p));
}

/** Map one row of a combined `pwhtAggs()` select into {@link PwhtStats}. */
export function pwhtStatsFromRow(raw: unknown): PwhtStats {
  return PwhtRow.parse(raw);
}
