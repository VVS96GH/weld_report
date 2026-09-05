-- 0012 — UT/RT length columns, the RT week bucket, and the M's four hard-coded
--        Joint ID exclusions.
--
-- All four weld columns are nullable with no default, so this migration is a
-- catalogue-only change: Postgres does not rewrite the 958,615-row table.

ALTER TABLE weld
  -- `Weld Length "PR all"`: Inco -> weld_length / 1000, otherwise a lookup on
  -- weld_length_by_dia[dia_inch].  M33-M36 (UT length metrics) cannot be computed
  -- for CCC without it — CCC's own weld_length is blank.
  ADD COLUMN IF NOT EXISTS weld_length_m      numeric(10,4),
  -- Derived from weld_length_m and the UT overlay; the DAX keeps them as columns
  -- because six UT rejection percentages depend on them.
  ADD COLUMN IF NOT EXISTS inspected_length_mm numeric(12,3),
  ADD COLUMN IF NOT EXISTS defect_length_mm    numeric(12,3),
  -- The Friday of rt_date's week. Trivial, but the RT trend groups on it and a
  -- per-row calendar join across 6.4M rows is not.
  ADD COLUMN IF NOT EXISTS week_end_date_rt    date;

CREATE INDEX IF NOT EXISTS weld_week_end_rt ON weld (week_end_date_rt);

COMMENT ON COLUMN weld.weld_length_m IS
  'Weld Length "PR all" in metres. Needs weld_length_by_dia, which is EMPTY: sources/Weld Length/Weld Length.xlsx is still absent (R-01 / gap-check.md). NULL until it arrives — never 0.';

-- ---------------------------------------------------------------------------
-- The M's own hard-coded exclusion, as data rather than as literals in code.
-- ---------------------------------------------------------------------------
-- `Project WD+WR+INCO+Acciona` ends with
--   #"EXLUDE 4 RT B.log CCC" = Table.SelectRows(#"Joint ID for Heat N", each
--       [Joint ID] <> "11040A1-DG6204061C-SP2-9"  and
--       [Joint ID] <> "11040A3-DB6204507-SP4-12"  and
--       [Joint ID] <> "11040A3-NG6204709-SP17-62" and
--       [Joint ID] <> "11060A4-PR6206008-SP3-11")
-- which removes 16 rows from the union (4 joints × their welder passes).
-- Reproduced as a table so the report owner can see and change it, per
-- project-wd-wr-inco-acciona.md §5.5 Q5. It is DIFFERENT from ref_exclusion_list:
-- this one the pbix really applies, that one it never references (R2-02).
CREATE TABLE IF NOT EXISTS weld_manual_exclusion (
  joint_id text        PRIMARY KEY,
  reason   text,
  added_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO weld_manual_exclusion (joint_id, reason) VALUES
  ('11040A1-DG6204061C-SP2-9',  'M step #"EXLUDE 4 RT B.log CCC" — hard-coded in the pbix, reason not recorded'),
  ('11040A3-DB6204507-SP4-12',  'M step #"EXLUDE 4 RT B.log CCC" — hard-coded in the pbix, reason not recorded'),
  ('11040A3-NG6204709-SP17-62', 'M step #"EXLUDE 4 RT B.log CCC" — hard-coded in the pbix, reason not recorded'),
  ('11060A4-PR6206008-SP3-11',  'M step #"EXLUDE 4 RT B.log CCC" — hard-coded in the pbix, reason not recorded')
ON CONFLICT (joint_id) DO NOTHING;

COMMENT ON TABLE weld_manual_exclusion IS
  'The 4 Joint IDs the pbix M really excludes from the union (16 rows). Applied by the CCC loaders. Not to be confused with ref_exclusion_list, which is stored UNAPPLIED (R2-02).';
