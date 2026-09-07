-- 0029 — `ref_talisman_joint`: the Talisman joint export behind page 20's
-- "RT B.Log Talisman" card.
--
-- WHY ------------------------------------------------------------------------
-- `[RT BACKLOG RT100% Talisman]` is the one measure on the forecast page that
-- reads a table of its own:
--
--   CALCULATE(
--       DISTINCTCOUNT('TALISMAN DATA'[Joint ID]),
--       'TALISMAN DATA'[WELD DATE] > 0,
--       'TALISMAN DATA'[RT% from Project WD+WR] = 100,
--       'TALISMAN DATA'[RT1 REP NO] = "")
--
-- `TALISMAN DATA` is `sources/Joint.csv` (62 columns, 1,548,056 data rows),
-- which no loader has ever read. Without it the card cannot be computed at all.
--
-- SHAPE ----------------------------------------------------------------------
-- One row per joint, only the columns the measure and its provenance need. The
-- file is 322 MB and carries 62 columns; storing all of them would cost ~2 GB
-- for one card, so this is deliberately narrow. Widen it when a measure needs
-- more, not before.
--
-- `RT% from Project WD+WR` is NOT stored: it is a pbix CALCULATED column, a
-- lookup of the union's RT% by Joint ID. Storing a copy would let the two drift;
-- the metric joins `mv_joint.rt_pct` at read time instead.
--
-- GRAIN ----------------------------------------------------------------------
-- `joint_id` is the primary key, built as `QCISO NO`-`SPOOL NO`-`JOINT NO`, the
-- same shape `load-ccc-joint-record.ts` uses, so the join to `mv_joint` needs no
-- translation. Rows whose `ORIGINAL REPAIR DELETE FLAG` = 'D' are dropped by the
-- loader, exactly as the pbix M does. `source_rows` records how many file rows
-- collapsed into each joint, so a duplicate is countable rather than invisible.

CREATE TABLE IF NOT EXISTS ref_talisman_joint (
  joint_id                 text PRIMARY KEY,
  load_id                  bigint,
  subcon_code              text,
  weld_date                date,
  rt1_date                 date,
  rt1_rep_no               text,
  rt1_result               text,
  orig_repair_delete_flag  text,
  source_rows              integer NOT NULL DEFAULT 1
);

COMMENT ON TABLE ref_talisman_joint IS
  'sources/Joint.csv — the pbix ''TALISMAN DATA'' table. One row per joint (QCISO-SPOOL-JOINT), rows with ORIGINAL REPAIR DELETE FLAG = ''D'' dropped as the M does. Deliberately narrow: only what [RT BACKLOG RT100% Talisman] and its provenance need. RT% is NOT stored — it is a lookup of the union''s RT% by Joint ID, joined from mv_joint at read time so the two cannot drift.';

COMMENT ON COLUMN ref_talisman_joint.source_rows IS
  'File rows that collapsed into this joint. > 1 means the export carried duplicates; the loader reports the count rather than hiding it.';

CREATE INDEX IF NOT EXISTS ref_talisman_joint_backlog
  ON ref_talisman_joint (joint_id)
  WHERE weld_date IS NOT NULL AND rt1_rep_no IS NULL;
