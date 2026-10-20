-- 0061 — a joint's OTHER weld types (owner, 2026-10-20: CCC Graph page,
-- Tested Joints F 31,380 vs pbix 31,381, Films 106,502 vs 106,504, BW 119,178
-- vs 119,179).
--
-- mv_joint keeps one `weld_type` per joint (max over its rows). The pbix
-- filters and groups by the ROW's weld type, so a joint whose rows carry two
-- types passes `Weld Type IN {BW, CLET, GW, MW}` on its BW rows and is counted
-- under BOTH types in the Weld Cat × Weld Type matrix (DISTINCTCOUNT per cell,
-- once in the total). Today one joint has this:
--   12040P2-NG6304099-SP5-13 (CCC): BW rows (welder W-329, A, 4 × 0.75 films)
--   and LET rows (W-1622, W-329, no films); mv_joint says LET.
-- This view lists every (joint, type) besides mv_joint's own, so the metrics
-- layer can test "any row of the joint has the type" (lib/metrics/scope.ts
-- `rowWeldTypes`) and add the extra cells to the pivots.
-- Refreshed right after mv_joint (scripts/load-common.ts POST_LOAD_MATVIEWS).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_joint_extra_type AS
SELECT w.source, w.joint_id, w.weld_type
  FROM weld w
  JOIN mv_joint j ON j.source = w.source AND j.joint_id = w.joint_id
 WHERE NOT w.is_cancelled
   AND w.weld_type IS NOT NULL
   AND w.weld_type IS DISTINCT FROM j.weld_type
 GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS mv_joint_extra_type_key ON mv_joint_extra_type (source, joint_id, weld_type);
