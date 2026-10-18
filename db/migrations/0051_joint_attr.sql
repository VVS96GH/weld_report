-- 0051 — joint attributes the Project NDE & PWHT Status page slices or counts on
-- (owner, 2026-10-18; pbix "Internal. PROJECT RT% NDE AND PWHT STATUS S.Class
-- PR all") that are at row grain on `weld` and on no joint view: NDT Remarks,
-- Thickness, `nrows` (the card that averages a column over rows), `ut_len_rows`, `norepair` (for `Joint Uniq "PR all" Total`), and the PAUT measures (`PAUT Progress All "PR all"` = welded with an
-- RT Report containing "PAUT"; its "R" twin = and RT Acc/Rej = "R"). One row per
-- joint; refreshed with the joint views.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_joint_attr AS
SELECT w.source,
       w.joint_id,
       max(w.ndt_remarks)                                                         AS ndt_remarks,
       max(w.thickness)                                                           AS thickness,
       bool_or(coalesce(w.repair_reweld, '') = '')                                AS norepair,
       count(*)                                                                   AS nrows,
       -- UT Weld Length by Welder "PR all": row-grain sums (every pass row counts)
       coalesce(sum(w.weld_length_m) FILTER (WHERE w.ut_report IS NOT NULL), 0)
         + coalesce(sum(w.weld_length_m) FILTER (WHERE w.rt_ut = 'UT'), 0)        AS ut_len_rows,
       bool_or(w.weld_date IS NOT NULL AND w.rt_report ILIKE '%PAUT%')            AS paut,
       bool_or(w.weld_date IS NOT NULL AND w.rt_report ILIKE '%PAUT%' AND w.rt_acc_rej = 'R') AS paut_r
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS mv_joint_attr_key ON mv_joint_attr (source, joint_id);
