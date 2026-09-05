/**
 * Per-WPS weld-rejection detail — mockup pages 41–44 (pbix pages 65–68).
 *
 * Columns, in the mockup's order:
 *   WPS No. | Joints Welded | Tested Joints | RT/UT Ratio % | Accepted RT/UT |
 *   Rejected RT/UT | RT Total Films | RT Films "A" | RT Films "R" |
 *   RT FILM Ratio % | Rejection Rate Joint
 *
 * Metrics: M01/M03 (welded), M10 (tested), M15 (ratio), M13, M12,
 * M26 (all-weld-point film totals — this is why page 42 shows 171,021 films
 * for GAC while page 8 shows 123,887: two different measures, both correct),
 * M25, M14.
 *
 * Pinned row-by-row against `analysis/reconcile_results.json → wps_gac_nonsg`
 * (scope: GAC, `service_cat <> 'SG'`, `weld_type <> 'DMY'`, `wps_no` present).
 *
 * ── Why this one reads a different view ─────────────────────────────────────
 * Every other pivot reads the joint-grain `mv_joint`. This one cannot:
 * `wps_no` is the single dimension that is genuinely multi-valued per joint
 * (1 joint of 2,370,428 — measured). At row grain that joint counts in BOTH
 * WPS cells, which is what the DAX does and what the pin expects; at joint
 * grain `max(wps_no)` puts it in one and `GAC-WPS-P-CS/LTC-002` came out at
 * 223,301 instead of 223,302. So the pivot reads `mv_joint_wps`, the same
 * rollup at `(source, joint_id, wps_no)` grain — correct AND fast.
 */

import { z } from "zod";
import { query } from "@/lib/db";
import {
  Params,
  type Scope,
  and,
  divide,
  scopeWhere,
  WPS_FROM,
  zCount,
  zSum,
} from "./scope";

const Row = z.object({
  wps_no: z.string(),
  joints_welded: zCount,
  joints_welded_incl_repair_reweld: zCount,
  tested_joints: zCount,
  rejected: zCount,
  rt_total_films: zSum,
  rt_films_rejected: zSum,
});

export type WpsRejectionRow = {
  wps_no: string;
  /** M01 `[Welded Joint ID Uniq "EP"]`. */
  joints_welded: number;
  /** M03 — welded including repairs/rewelds (the `& R/RW` ratio denominator). */
  joints_welded_incl_repair_reweld: number;
  /** M10 `[Numb RT/UT]`. */
  tested_joints: number;
  /** M15 `[RT/UT Ratio % …]` = tested / welded. Can exceed 100 % (see §M15). */
  rt_ut_ratio: number | null;
  /** M13 = M10 − M12. */
  accepted: number;
  /** M12 `[Numb RT/UT "R"]`. */
  rejected: number;
  /** M26 `[RT Total Films]` — every weld point, `RT Acc/Rej <> "RS"`. */
  rt_total_films: number;
  /** M26 `[RT Total Films "A"]` = total − rejected. */
  rt_films_accepted: number;
  /** M26 `[RT Total Films "R"]` — unfiltered `sum([Total No of films Rej])`. */
  rt_films_rejected: number;
  /** M25 `[RT FILM Ratio %]` = R / total. */
  rt_film_ratio: number | null;
  /** M14 `[Rejection Rate Joint …]` = M12 / M10. */
  rejection_rate_joint: number | null;
};

/**
 * One `GROUP BY wps_no` round-trip for a whole page pivot.
 * Rows come back ordered by `wps_no`; the caller sorts for display.
 */
export async function wpsRejectionTable(
  scope: Scope,
): Promise<WpsRejectionRow[]> {
  const p = new Params();
  const where = and([scopeWhere(scope, p), "w.wps_no IS NOT NULL"]);
  const sql =
    `SELECT w.wps_no,\n` +
    `       count(*) FILTER (WHERE w.is_welded_norepair) AS joints_welded,\n` +
    `       count(*) FILTER (WHERE w.is_welded) AS joints_welded_incl_repair_reweld,\n` +
    `       count(*) FILTER (WHERE w.is_tested_ep) AS tested_joints,\n` +
    `       count(*) FILTER (WHERE w.is_rejected) AS rejected,\n` +
    `       sum(w.films_all) AS rt_total_films,\n` +
    `       sum(w.films_all_rej) AS rt_films_rejected\n` +
    `  FROM ${WPS_FROM}\n` +
    ` WHERE ${where}\n` +
    ` GROUP BY 1\n` +
    ` ORDER BY 1`;
  const rows = await query(sql, p.list());
  return z
    .array(Row)
    .parse(rows)
    .map((r) => {
      const films = r.rt_total_films ?? 0;
      const filmsRej = r.rt_films_rejected ?? 0;
      return {
        wps_no: r.wps_no,
        joints_welded: r.joints_welded,
        joints_welded_incl_repair_reweld: r.joints_welded_incl_repair_reweld,
        tested_joints: r.tested_joints,
        rt_ut_ratio: divide(r.tested_joints, r.joints_welded),
        accepted: r.tested_joints - r.rejected,
        rejected: r.rejected,
        rt_total_films: films,
        rt_films_accepted: films - filmsRej,
        rt_films_rejected: filmsRej,
        rt_film_ratio: divide(filmsRej, films),
        rejection_rate_joint: divide(r.rejected, r.tested_joints),
      };
    });
}
