-- 0059 — UT TRACKER (GAC)_Master.xlsx and UT TRACKER (TEK).xlsx, sheet MUT (owner,
-- 2026-10-19). In the pbix they feed exactly three calculated columns of the
-- union — Cross Verification-by CTJV (TPI). / CTJV VERIFICATION Date. /
-- CTJV VERIFICATION BY. — looked up by Joint ID; no measure reads them.
-- Loaded by scripts/load-ut-trackers.ts, one row per tracker row.
CREATE TABLE IF NOT EXISTS ut_tracker_ctjv (
  tracker            text NOT NULL,          -- 'GAC' | 'TEK'
  sl                 integer,
  joint_id           text,                   -- DRAWING NUMBER-SPOOL-JOINT, as the pbix query builds it
  mut_report_no      text,
  result             text,
  date_of_exam       date,
  cross_verification text,                   -- "Cross Verification-by  CTJV (TPI) "
  verification_date  date,                   -- "CTJV VERIFICATION DATE"
  verification_by    text                    -- "CTJV VERIFICATION BY"
);
CREATE INDEX IF NOT EXISTS ut_tracker_ctjv_joint ON ut_tracker_ctjv (joint_id);
