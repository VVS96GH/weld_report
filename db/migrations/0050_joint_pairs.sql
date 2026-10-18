-- 0050 — the WPS / Material page (owner, 2026-10-18; pbix "WPS / Material for
-- Managment"): its matrices drill WPS → Material Type → Welder ID → Service
-- Class, and WPS / material / welder sit at ROW grain on `weld` (a CCC joint has
-- one row per welder pass). One row per distinct (joint, WPS, material, welder);
-- `welder_id` is the pbix calculated column `[Welder] & "-" & [Sub-Contractor]`;
-- `norepair` = the pair has a row with `Repair & Reweld "PR all" = ""` (for
-- `Joint Uniq "PR all" Total`). The joint's own flags and slicer columns are
-- copied from mv_joint so the page aggregates one table (7 s → ~1 s).
-- Refreshed right after mv_joint (scripts/load-common.ts POST_LOAD_MATVIEWS).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_joint_pairs AS
WITH p AS (
  SELECT w.source,
         w.joint_id,
         w.wps_no,
         w.material_type,
         coalesce(w.welder, '') || '-' || coalesce(w.sub_contractor, '') AS welder_id,
         bool_or(coalesce(w.repair_reweld, '') = '')                     AS norepair
    FROM weld w
   WHERE NOT w.is_cancelled
   GROUP BY 1, 2, 3, 4, 5
)
SELECT p.*,
       j.sub_contractor, j.weld_type, j.weld_cat, j.rt_pct, j.ha, j.area_classification_label,
       j.service_class_cat_ndt, j.temporary_lines,
       j.is_welded_norepair, j.is_tested_prall, j.is_rejected,
       j.films_taken_prall, j.films_rej_prall
  FROM p
  JOIN mv_joint j ON j.source = p.source AND j.joint_id = p.joint_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_joint_pairs_key
  ON mv_joint_pairs (source, joint_id, wps_no, material_type, welder_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS mv_joint_pairs_wps ON mv_joint_pairs (wps_no);
CREATE INDEX IF NOT EXISTS mv_joint_pairs_mat ON mv_joint_pairs (material_type);
