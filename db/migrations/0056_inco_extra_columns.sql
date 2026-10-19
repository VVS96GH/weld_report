-- 0056 — the Inco Weld Log columns the pbix carries in "Project WD+WR+INCO+Acciona"
-- that only Inco fills (owner, 2026-10-19: the Data page shows every column).
-- Loaded by scripts/load-inco.ts from sheet "Overall Weld Log Query", headers as
-- named below; NULL on every other source, as in the pbix. "Welding Report No."
-- is the pbix's DWIR No. for Inco and goes into the existing dwir_no column.
ALTER TABLE weld
  ADD COLUMN IF NOT EXISTS category_1            text,     -- Category 1
  ADD COLUMN IF NOT EXISTS category_2            text,     -- Category 2
  ADD COLUMN IF NOT EXISTS drg_no                text,     -- Drg No
  ADD COLUMN IF NOT EXISTS process               text,     -- process
  ADD COLUMN IF NOT EXISTS fitup_report_no       text,     -- Fitup Report No.
  ADD COLUMN IF NOT EXISTS first_prod_joint      text,     -- First Prod. Joint
  ADD COLUMN IF NOT EXISTS aditional_joint_no_rt text,     -- Aditional Joint No.RT
  ADD COLUMN IF NOT EXISTS rt_p1_rep             text,     -- RT P1 Rep.
  ADD COLUMN IF NOT EXISTS p1_date               date,     -- P1 Date
  ADD COLUMN IF NOT EXISTS rt_p2_rep             text,     -- RT P2 Rep.
  ADD COLUMN IF NOT EXISTS p2_date               date,     -- P2 Date
  ADD COLUMN IF NOT EXISTS vbt_report            text,     -- VBT Report
  ADD COLUMN IF NOT EXISTS vbt_date              date,     -- VBT Date
  ADD COLUMN IF NOT EXISTS opt_report            text,     -- OPT Report
  ADD COLUMN IF NOT EXISTS opt_date              date,     -- OPT Date
  ADD COLUMN IF NOT EXISTS count_delimiter       text,     -- CountDelimiter
  ADD COLUMN IF NOT EXISTS count_rows_count      text;     -- Count Rows.Count
