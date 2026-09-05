/**
 * The CCC UT overlay: `ref_ut_tracker_ccc` -> the six `weld.*_all` columns.
 *
 * WHY IT IS A SEPARATE STEP. CCC's welder record has no UT columns at all
 * (`ut_report`, `ut_acc_rej`, `ut_date`, `ut_operator_id` are NULL on all
 * 5,432,993 rows — `analysis/sources2/ccc-column-map.md` §D). The pbix gets CCC's
 * UT from `UT TRACKER (CCC)_Talisman` through DAX **calculated columns**, not
 * through the union, so the overlay cannot be done at COPY time by the welder
 * loader — the tracker is a different file, loaded by a different lane. It is
 * therefore an UPDATE that either loader can run, and both do.
 *
 * THE DAX, distilled (project-wd-wr-inco-acciona.md §2.2, verbatim there):
 *
 *   UT Report "PR All" = IF( [UT Report] <> "", [UT Report],
 *                          IF( [Sub-Contractor] = "CCC",
 *                              LOOKUPVALUE(tracker[UT1 REP NO], tracker[Joint ID], [Joint ID]),
 *                              IF( [RT/UT] = "UT", [RT Report], BLANK() )))
 *   UT Date "PR All"   = the same shape on tracker[UT1 DATE]
 *   Manual UT Report No. = MAXX( rows of this Joint ID, [UT Report "PR All"] )
 *   Manual UT Date.      = MAXX( rows of this Joint ID,
 *                                IF(ISBLANK([UT Date "PR All"]), [Manual UT Date], [UT Date "PR All"]) )
 *   UT Operator ID.      = CALCULATE( LOOKUPVALUE(tracker[UT Operator ID.], tracker[Joint ID], [Joint ID]),
 *                                     [Sub-Contractor] = "CCC", [RT/UT] = "UT" )
 *
 * For CCC every one of those collapses to a plain lookup, because the row-level
 * fallbacks are all NULL for CCC: `UT Report`, `UT Date`, `Manual UT Date` and
 * `Manual UT Status` are never populated, so the first branch never fires and the
 * MAXX over a joint has exactly one distinct value to take.
 *
 * KEY: `ref_ut_tracker_ccc.joint_id` = `QCISO NO || '-' || SPOOL NO || '-' || JOINT NO`,
 * the same recipe CCC's own `joint_id` uses, so it is a plain equality join.
 * 9,412 of the tracker's 9,419 joints match a CCC row in `weld`.
 *
 * AMBIGUITY: `LOOKUPVALUE` returns BLANK when a key matches rows with different
 * values. `joint_id` is unique in the tracker today (9,419 distinct over 9,419
 * rows), so this never bites — but the function counts multi-row joints and
 * resolves them with `max()` rather than picking silently, and reports the count.
 *
 * SCOPE: `sub_contractor = 'CCC'` only, exactly as the DAX gates it. That covers
 * both CCC sources and leaves alone
 *   - INCO's 441 PAUT rows, which its own loader fills from the DAX's Inco branch;
 *   - every WELD_DUMP row: GAC's and TEKFEN's trackers are still absent (R-05),
 *     so their overlays stay honestly NULL rather than being filled from nothing.
 */

import type { Client } from "pg";

export interface UtOverlayResult {
  rowsUpdated: number;
  trackerJoints: number;
  matchedJoints: number;
  ambiguousJoints: number;
  seconds: number;
}

/**
 * `UT Operator ID.` is the one branch the DAX gates on `[RT/UT] = "UT"` as well as
 * on the sub-contractor, so it is applied conditionally while the other five are not.
 */
const SQL = `
WITH t AS (
  SELECT joint_id,
         max(ut1_rep_no)  AS ut1_rep_no,
         max(ut1_date)    AS ut1_date,
         max(ut1_result)  AS ut1_result,
         max(ut_ope1)     AS ut_ope1,
         count(*)         AS tracker_rows
    FROM ref_ut_tracker_ccc
   WHERE joint_id IS NOT NULL
   GROUP BY joint_id
)
UPDATE weld w SET
  ut_report_all           = t.ut1_rep_no,
  ut_date_all             = t.ut1_date,
  manual_ut_report_no_all = t.ut1_rep_no,
  manual_ut_date_all      = t.ut1_date,
  manual_ut_status_all    = t.ut1_result,
  ut_operator_id_all      = CASE WHEN w.rt_ut = 'UT' THEN t.ut_ope1 END
FROM t
WHERE w.sub_contractor = 'CCC'
  AND t.joint_id = w.joint_id
  AND (w.manual_ut_report_no_all IS DISTINCT FROM t.ut1_rep_no
       OR w.manual_ut_status_all IS DISTINCT FROM t.ut1_result
       OR w.ut_date_all IS DISTINCT FROM t.ut1_date)`;

export async function applyCccUtOverlay(client: Client): Promise<UtOverlayResult> {
  const t0 = Date.now();
  const pre = await client.query<{ n: string; d: string; amb: string }>(
    `SELECT count(*)::text AS n, count(DISTINCT joint_id)::text AS d,
            (SELECT count(*) FROM (SELECT joint_id FROM ref_ut_tracker_ccc
                                    WHERE joint_id IS NOT NULL
                                    GROUP BY joint_id HAVING count(*) > 1) x)::text AS amb
       FROM ref_ut_tracker_ccc`,
  );
  const trackerJoints = Number(pre.rows[0]?.d ?? 0);
  if (trackerJoints === 0) {
    // Honest-empty and loud: the load that just ran is fine, but every CCC UT
    // metric will read NULL until the tracker is loaded.
    console.warn(
      "  !! ref_ut_tracker_ccc is empty — the CCC UT overlay was skipped. " +
      "Run the UT tracker loader; M32/M34/M35 read NULL for CCC until you do.",
    );
    return { rowsUpdated: 0, trackerJoints: 0, matchedJoints: 0, ambiguousJoints: 0, seconds: 0 };
  }
  const matched = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM (
       SELECT DISTINCT t.joint_id FROM ref_ut_tracker_ccc t
         JOIN weld w ON w.joint_id = t.joint_id AND w.sub_contractor = 'CCC') x`,
  );
  const upd = await client.query(SQL);
  return {
    rowsUpdated: upd.rowCount ?? 0,
    trackerJoints,
    matchedJoints: Number(matched.rows[0]?.n ?? 0),
    ambiguousJoints: Number(pre.rows[0]?.amb ?? 0),
    seconds: Number(((Date.now() - t0) / 1000).toFixed(1)),
  };
}

export function formatUtOverlay(r: UtOverlayResult): string {
  return `CCC UT overlay: ${r.rowsUpdated.toLocaleString("en-US")} weld rows from `
    + `${r.matchedJoints.toLocaleString("en-US")}/${r.trackerJoints.toLocaleString("en-US")} tracker joints`
    + (r.ambiguousJoints > 0 ? `, ${r.ambiguousJoints} ambiguous (max() taken)` : "")
    + ` in ${r.seconds}s`;
}
