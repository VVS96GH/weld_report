/**
 * UT / PAUT metrics — M30, M31, M33, M37, M38.
 *
 * Only the `"EP"` family is implementable. M32/M34/M35/M36/M39 key off the
 * calculated columns `[Manual UT Report No.]` / `[Manual UT Status.]`, which
 * coalesce through `UT TRACKER (CCC)_Talisman`, `UT TRACKER (GAC)` and
 * `UT TRACKER (TEK)` — none of which is in `sources/` (ruling R-05). The dump
 * does carry raw `manual_ut_report_no` / `manual_ut_status` columns (§8.1 #198,
 * #199), but those are the *pre-coalesce* source values, not the calc columns,
 * so using them would silently under-count CCC and mis-state GAC/TEKFEN.
 * Callers get honest-empty for the project-scope UT KPIs instead.
 *
 * Reality check: MEDGULF has zero rows with a `UT Report` in this dump, which
 * matches the mockup's blank UT columns on pages 6 and 11 (§4.6 finding 5).
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
  divide,
  filterWhere,
  scopeWhere,
  zCount,
  zSum,
  zText,
} from "./scope";

/** M30 `[Numb UT "EP"]` — `UT Weld Status = 'NR'` and a UT report exists. */
export function utDoneCond(p: Params, a = "w"): string {
  return and([
    `${a}.ut_weld_status = ${p.add("NR")}`,
    `${a}.ut_report IS NOT NULL`,
  ]);
}

export function utAggs(p: Params, a = "w"): AggSpec[] {
  const done = utDoneCond(p, a);
  return [
    { key: "ut_done", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([done])}` },
    {
      key: "ut_accepted",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([done, `${a}.ut_acc_rej = ${p.add("A")}`])}`,
    },
    {
      key: "ut_rejected",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([done, `${a}.ut_acc_rej = ${p.add("R")}`])}`,
    },
    // M33 `[UT Weld Length by Joint "EP"]`
    {
      key: "ut_weld_length_m",
      sql: `sum(${a}.weld_length) ${filterWhere([`${a}.weldpoint_no = 1`, `${a}.ut_report IS NOT NULL`])}`,
    },
    // `Rej Length` — the raw column behind `[Defect Length(MM).]` for the
    // non-Inco, non-CCC branch. Exposed for disclosure; M34 itself is not
    // implementable at "EP" scope (there is no "EP" version — §M34).
    {
      key: "ut_rej_length_m",
      sql: `sum(${a}.rej_length) ${filterWhere([done, `${a}.ut_acc_rej = ${p.add("R")}`])}`,
    },
  ];
}

const UtRow = z.object({
  ut_done: zCount,
  ut_accepted: zCount,
  ut_rejected: zCount,
  ut_weld_length_m: zSum,
  ut_rej_length_m: zSum,
});

export type UtStats = {
  /** M30 `[Numb UT "EP"]`. */
  ut_done: number;
  /** M31 `[Numb UT "A" "EP"]`. */
  ut_accepted: number;
  /** M31 `[Numb UT "R" "EP"]`. */
  ut_rejected: number;
  /** M37 `[Rejection UT Rate Joint "EP"]` = M31r / M30. */
  ut_rejection_rate_joint: number | null;
  /** M33 `[UT Weld Length by Joint "EP"]`, metres. */
  ut_weld_length_m: number;
  /** `sum([Rej Length])` over rejected UT joints — see the note above. */
  ut_rej_length_m: number;
};

function toStats(r: z.infer<typeof UtRow>): UtStats {
  return {
    ut_done: r.ut_done,
    ut_accepted: r.ut_accepted,
    ut_rejected: r.ut_rejected,
    ut_rejection_rate_joint: divide(r.ut_rejected, r.ut_done),
    ut_weld_length_m: r.ut_weld_length_m ?? 0,
    ut_rej_length_m: r.ut_rej_length_m ?? 0,
  };
}

const EMPTY = {
  ut_done: 0,
  ut_accepted: 0,
  ut_rejected: 0,
  ut_weld_length_m: null,
  ut_rej_length_m: null,
};

/** M30, M31, M33, M37 for one scope. */
export async function utStats(scope: Scope): Promise<UtStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: utAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return toStats(UtRow.parse(rows[0] ?? EMPTY));
}

/** The same bundle, grouped. */
export async function utStatsBy(
  scope: Scope,
  group: GroupSpec,
): Promise<Map<string | null, UtStats>> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [group],
    aggs: utAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  const out = new Map<string | null, UtStats>();
  for (const raw of rows) {
    const key = zText.parse((raw as Record<string, unknown>)[group.key] ?? null);
    out.set(key, toStats(UtRow.parse(raw)));
  }
  return out;
}

/** Map one row of a combined `utAggs()` select into {@link UtStats}. */
export function utStatsFromRow(raw: unknown): UtStats {
  return toStats(UtRow.parse(raw));
}
