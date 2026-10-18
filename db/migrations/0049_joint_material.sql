-- 0049 — joint → Material Type (owner, 2026-10-18: a Material Type slicer on the
-- Weld Rejection Detail pages). `material_type` lives at row grain on `weld`
-- and is on neither joint view; this small side view lets a page filter
-- either view by `EXISTS` without re-creating the big ones. Refreshed with them
-- (scripts/load-common.ts POST_LOAD_MATVIEWS).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_joint_material AS
SELECT DISTINCT w.source, w.joint_id, w.material_type
  FROM weld w
 WHERE w.material_type IS NOT NULL
   AND NOT w.is_cancelled;

CREATE UNIQUE INDEX IF NOT EXISTS mv_joint_material_key ON mv_joint_material (source, joint_id, material_type);
CREATE INDEX IF NOT EXISTS mv_joint_material_type ON mv_joint_material (material_type);
