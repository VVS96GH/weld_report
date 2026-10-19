-- 0055 — more of the Data page's pbix calculated columns (owner, 2026-10-19):
-- Inco length ratios per welder and the testpack columns. Same rules as 0054.

-- Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS / LAST 1 Month: per Welder ID,
-- SUM(Repair Length (mm)) / SUM(Rej Length) over the welder's Inco rows (RT Acc/Rej
-- not RS / U/Review) whose Days Since Last RT is 0..15 / 0..30 days before the
-- report's Cur_Date (the cut-off Friday, as mv_welder_status). Days Since Last RT is
-- BLANK on a row without a Last_RT Date, and BLANK IN {0, …} is true in DAX: such
-- rows count too (as the welder pages found).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_inco AS
WITH c AS (SELECT max(cur) AS cur FROM mv_welder_status),
r AS (
  SELECT coalesce(w.welder, '') || '-' || coalesce(w.sub_contractor, '') AS k,
         w.repair_length_mm AS rl, w.rej_length AS wl,
         c.cur - CASE WHEN w.manual_ut_date_all IS NULL THEN w.rt_date END AS days
    FROM weld w CROSS JOIN c
   WHERE NOT w.is_cancelled
     AND upper(coalesce(w.sub_contractor, '')) = 'INCO'
     AND upper(coalesce(w.rt_acc_rej, '')) NOT IN ('RS', 'U/REVIEW')
)
SELECT k,
       sum(rl) FILTER (WHERE days IS NULL OR days BETWEEN 0 AND 15)
         / nullif(sum(wl) FILTER (WHERE days IS NULL OR days BETWEEN 0 AND 15), 0) AS ratio_15,
       sum(rl) FILTER (WHERE days IS NULL OR days BETWEEN 0 AND 30)
         / nullif(sum(wl) FILTER (WHERE days IS NULL OR days BETWEEN 0 AND 30), 0) AS ratio_30
  FROM r
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_inco_k ON mv_grid_inco (k);

-- TESTPACK No "PR All", per joint: for CCC the Joint Record's Test Package No (by
-- Joint ID "JR"), for the others the largest Testpack No on the joint's rows.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_joint_tp AS
SELECT w.joint_id AS k,
       (SELECT jr.test_package_no FROM ccc_joint_pwht jr WHERE jr.joint_id_jr = w.joint_id) AS tp_ccc,
       max(w.testpack_no) AS tp_other
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_joint_tp_k ON mv_grid_joint_tp (k);

-- per TESTPACK No "PR All": TP Ratio % Complete "PR all" (joints welded / joints)
-- and TP Complete % (the same over joints whose Repair & Reweld "PR all" is blank).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_tp AS
WITH r AS (
  SELECT coalesce(CASE WHEN upper(coalesce(w.sub_contractor, '')) = 'CCC' THEN j.tp_ccc ELSE j.tp_other END, '') AS k,
         w.joint_id, w.weld_date IS NOT NULL AS welded,
         upper(coalesce(w.sub_contractor, '')) = 'INCO'
           OR NOT (upper(right(w.joint_id, 2)) IN ('R1', 'R2', 'RW')
                   OR upper(coalesce(w.repair_suffix, '')) IN ('RW1', 'RS1')) AS plain
    FROM weld w JOIN mv_grid_joint_tp j ON j.k = w.joint_id
   WHERE NOT w.is_cancelled
)
SELECT k,
       nullif(count(DISTINCT joint_id) FILTER (WHERE welded), 0)::numeric / nullif(count(DISTINCT joint_id), 0) AS ratio,
       nullif(count(DISTINCT joint_id) FILTER (WHERE welded AND plain), 0)::numeric
         / nullif(count(DISTINCT joint_id) FILTER (WHERE plain), 0) AS complete
  FROM r
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_tp_k ON mv_grid_tp (k);
