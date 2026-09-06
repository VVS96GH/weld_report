-- 0022 — the WPQ RECORD REGISTER delivery: four reference tables.
--
-- NUMBERING: 0021 is the metrics lane's in-flight UT-length migration.
--
-- Evidence: analysis/sources4/{rulings,plan,mapping,workbooks}.md. Rulings
-- R4-01 … R4-08 are binding. 745 rows in total; nothing lands in `weld`, so no
-- matview refresh is needed.
--
-- THE ONE NUMBER THAT MOVES: M91 `WPS Approved` = 318 (R4-02) — a DISTINCT count
-- of `WPS NO.` over `CONSOLIDATED` where `DOCUMENT STATUS = 'WPS APPROVED BY
-- CTJV/ CPY'`. The mockup's 294 is the same series' 2025-10 → 2026-03 plateau,
-- corroborated by `CUM WPS Status` whose 2026-08-28 week also reads 318: the pbix
-- snapshot is older, not wrong.

-- ===========================================================================
-- 1. ref_wps_register — widened, never replaced (R4-03)
-- ===========================================================================
-- Created empty by 0004. `wps_no` is unique in the file (318 distinct over 318
-- rows), so the existing PK holds and only the extra columns are new.
ALTER TABLE ref_wps_register
  ADD COLUMN IF NOT EXISTS sctr                 text,   -- CCC 83 / TEKFEN 79 / GAC 61 / INCO 32 / MED GULF 29 / …
  ADD COLUMN IF NOT EXISTS wps_rev_no           text,   -- '0'…'5','A','B','N/A' — TEXT, not an integer
  ADD COLUMN IF NOT EXISTS pqr_no_rev           text,
  ADD COLUMN IF NOT EXISTS welding_process_es   text,
  ADD COLUMN IF NOT EXISTS welding_process_mode text,   -- the sheet's blank-headed `Column8`
  ADD COLUMN IF NOT EXISTS pqr_material_1       text,
  ADD COLUMN IF NOT EXISTS pqr_material_2       text,   -- the sheet's blank-headed `Column10`
  ADD COLUMN IF NOT EXISTS pwht                 text,   -- raw token: 'NO' 224 / 'YES' 84 / 'No' 9 / 1 blank
  ADD COLUMN IF NOT EXISTS application          text,
  ADD COLUMN IF NOT EXISTS sn                   integer, -- provenance only, NEVER a join key (R4-05)
  ADD COLUMN IF NOT EXISTS load_id              bigint REFERENCES load(id) ON DELETE SET NULL;

COMMENT ON TABLE ref_wps_register IS
  'The WPQ CONSOLIDATED register, 318 rows. **NEVER JOIN ref_wps_register.wps_no TO weld.wps_no** (ruling R4-03): this table holds DOCUMENT numbers (383-TEK-…, WPS-638-…) and `weld` holds SITE numbers (TEK-…, MED-WPS-638-…). They match on only ~61% and the pbix does not join them either. `ref_wps_process` is the WPS-to-fact join table.';
COMMENT ON COLUMN ref_wps_register.document_status IS
  'M91 counts DISTINCT wps_no WHERE this = ''WPS APPROVED BY CTJV/ CPY'' -> 318. The filter is a no-op today (one distinct value) and is kept anyway, as the DAX has it.';
COMMENT ON COLUMN ref_wps_register.as_of IS
  'The SOURCE FILE mtime (2026-08-04) — the sheet carries no date. State it as such in any widget, as with ref_qualified_welders (R3-10).';
COMMENT ON COLUMN ref_wps_register.sn IS
  'The sheet''s own row number. Provenance only. The pbix''s three 1:1 edges from Sn./S.N into Flg CCC_Flange Repair[SN] are row-number auto-detections and are NEVER reproduced (R4-05).';

-- ===========================================================================
-- 2. ref_wps_process — THE WPS join table (R4-03)
-- ===========================================================================
-- 266 rows, 266 distinct `WPS No.`. This is the only table that may be joined to
-- `weld.wps_no` / `mv_joint.wps_no`: measured 100.00% coverage of in-scope joints
-- that carry a WPS (2,208,057 of 2,208,067 — 10 joints across 3 WPS miss).
-- `wps_no` is stored btrim()+upper()-normalised so the join needs no function.
CREATE TABLE IF NOT EXISTS ref_wps_process (
  wps_no               text PRIMARY KEY,   -- btrim + upper normalised
  wps_no_raw           text,               -- exactly as the sheet has it
  sn                   integer,            -- provenance only, NOT a join key (R4-05)
  sctr                 text,               -- 24 rows blank -> NULL
  welding_process      text NOT NULL,      -- after the M's null -> 'TBN'; 17 distinct
  welding_machine_type text,               -- 12 distinct, including a literal 'TBN' on one row
  load_id              bigint REFERENCES load(id) ON DELETE SET NULL
);
COMMENT ON TABLE ref_wps_process IS
  'The WELDING PROCESS sheet, 266 rows — the ONLY WPS table that may be joined to weld.wps_no (R4-03), at 100.00% coverage of in-scope joints carrying a WPS. The near-identical WPS (Welding Process).csv is NOT loaded (R4-07): the sheet is canonical, and the csv carries an unnamed 6th column and two spelling variants.';

-- ===========================================================================
-- 3. ref_wps_status_cum — the weekly submitted/approved series (R4-06)
-- ===========================================================================
-- LONG shape `(week_end_date, metric, value)` per ruling R4-06, not the wide
-- sketch in mapping.md §4: 127 weeks x 2 metrics = 254 rows. UPSERT, never
-- cleared — this history is not recomputable, the same discipline
-- weld_weekly_snapshot has (R-08).
--
-- Deliberately its OWN table and NOT new weld_weekly_snapshot metric ids: R3-13
-- already ruled that weekly reference series get their own table, and
-- ref_mpi_done's double-write is the exception that predates it.
CREATE TABLE IF NOT EXISTS ref_wps_status_cum (
  week_end_date date    NOT NULL,
  metric        text    NOT NULL,   -- WPS_SUBMITTED | WPS_APPROVED
  value         numeric,
  load_id       bigint  REFERENCES load(id) ON DELETE SET NULL,
  PRIMARY KEY (week_end_date, metric)
);
COMMENT ON TABLE ref_wps_status_cum IS
  'CUM WPS Status, 127 weeks x 2 metrics, CUMULATIVE running totals (submitted 269->318, approved 194->318). Project-wide, no sub_contractor. UPSERTed, never truncated (R4-06). Its immediate value is as the independent check on M91: the 2026-08-28 WPS_APPROVED row reads 318.';

-- ===========================================================================
-- 4. ref_wps_pwht_status — a rule sheet, documentation only (R4-08)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS ref_wps_pwht_status (
  wps_no         text PRIMARY KEY,   -- 34 distinct / 34 rows
  wps_no_raw     text,
  pwht_yn        text NOT NULL,      -- 'Y' 17 / 'N' 17
  thickness_note text,               -- '25mm to 38.1' on 2 rows, else NULL
  load_id        bigint REFERENCES load(id) ON DELETE SET NULL
);
COMMENT ON TABLE ref_wps_pwht_status IS
  'DOCUMENTATION ONLY (R4-08). No measure reads it. It must NOT override weld.pwht_y_n or PWHT_AMBIGUOUS_TOKEN (ruling R-04) without a separate ruling. Three of its keys (CS/LTCS-AUT-003/-009/-010) have no ref_wps_process row, so the pbix''s "1:1" edge is aspirational — no FK here either.';

-- ===========================================================================
-- 5. load.source vocabulary
-- ===========================================================================
ALTER TABLE load DROP CONSTRAINT IF EXISTS load_source_vocabulary;
ALTER TABLE load ADD CONSTRAINT load_source_vocabulary CHECK (source IN (
  -- fact sources (also weld_source enum values)
  'WELD_DUMP', 'CCC_WELDER_RECORD', 'CCC_JOINT_RECORD', 'ACCIONA', 'INCO',
  -- dimension / reference sources
  'SPOOL_DUMP', 'TALISMAN_SPOOL', 'WEEKLY_SNAPSHOT', 'UT_TRACKER_CCC',
  'EXCLUSION_LIST', 'MPI_DONE', 'ACTIVE_WELDERS',
  'WELD_LENGTH', 'WPS_REGISTER', 'QUALIFIED_WELDERS',
  -- batch 3
  'WELDERS_SCTR', 'WELDERS_QUALIFICATION', 'WELDER_STATUS_WEEKLY', 'CODE_LABELS',
  -- flange
  'FLANGE_PROGRESS', 'OVASSETS_1619',
  -- batch 4 (WPS_REGISTER already present above)
  'WPS_PROCESS', 'WPS_STATUS_CUM', 'WPS_PWHT_STATUS'
));
