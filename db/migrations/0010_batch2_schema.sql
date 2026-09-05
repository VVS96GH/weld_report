-- 0010 — schema for the batch-2 sources (CCC, the two spool masters, the four
--        trend workbooks, the UT tracker, the exclusion list).
--
-- Evidence: analysis/sources2/{rulings,plan,ccc-column-map,trend-seed-plan,
-- workbooks,profile}.md.  Rulings R2-01 … R2-16 are binding.
--
-- ORDERING NOTE: this file DROPS mv_weekly_progress (it depends on two columns
-- whose type changes below) and 0011_mv_weekly_progress_v3.sql re-creates it.
-- If a migrate run stops between the two, re-run `npm run db:migrate`.
--
-- COST NOTE: the ALTERs rewrite `weld` (958,615 rows today) and the backfill
-- UPDATE touches every WELD_DUMP row.  Run `VACUUM (ANALYZE) weld;` afterwards —
-- the loaders do it too, but the page timings depend on the visibility map
-- (see db/README.md, "Indexes on weld").

-- ===========================================================================
-- 1. weld_to_date v3 — CCC dates are yyyy/mm/dd (ruling R2-11)
-- ===========================================================================
-- The dump is dd-MMM-yyyy; `CSVExport_Welder Record.csv` and
-- `AllTrain_CSVExport_Joint Record.csv` are yyyy/mm/dd; the workbooks hand us
-- ISO yyyy-mm-dd.  Still non-raising: the month names are enumerated so to_date()
-- can never see an unknown MON, and anything unmatched returns NULL rather than
-- aborting a multi-million-row INSERT.
CREATE OR REPLACE FUNCTION weld_to_date(v text) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN btrim(v) ~* '^[0-9]{1,2}-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-[0-9]{4}$'
      THEN to_date(btrim(v), 'DD-MON-YYYY')
    WHEN btrim(v) ~* '^[0-9]{1,2}-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-[0-9]{2}$'
      THEN to_date(btrim(v), 'DD-MON-YY')
    WHEN btrim(v) ~ '^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}$'
      THEN to_date(btrim(v), 'YYYY/MM/DD')
    WHEN btrim(v) ~ '^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$'
      THEN to_date(btrim(v), 'YYYY-MM-DD')
    ELSE NULL
  END
$$;

-- ===========================================================================
-- 2. weld — fractional films (R2-04) and the CCC Area Classification vocabulary
-- ===========================================================================
-- R2-04: CCC's `RT Film Total` is a weld-point SHARE, not a film count — 145
-- distinct values, `0.75` on 296,274 rows — and the DAX SUMs it.  Rounding would
-- change every headline film number on pages 1-2.  The dump's values are whole
-- numbers and are unaffected by the widening.
--
-- The generated column has to be dropped and re-added: Postgres refuses to alter
-- the type of a column a generated column reads.  Same reason mv_weekly_progress
-- is dropped first.
DROP MATERIALIZED VIEW IF EXISTS mv_weekly_progress;
ALTER TABLE weld DROP COLUMN IF EXISTS rt_film_total;

ALTER TABLE weld
  ALTER COLUMN total_no_of_films_acc TYPE numeric(10,4),
  ALTER COLUMN total_no_of_films_rej TYPE numeric(10,4),
  -- CCC's `Area Group-2` renames to `Area Classification` in the M, but its values
  -- are TEXT ('Train-8 Process' ×1,493,903 …) while the dump's are 7-digit codes
  -- (3000000 ×343,207 …).  The pbix's PR-all table shows 22 distinct classes = the
  -- union of both vocabularies, so the unioned column is text.  Rather than retype
  -- weld.area_classification (an integer the metrics lane already queries), the
  -- text vocabulary gets its own column, populated for EVERY source.  Group and
  -- slice on this one; keep the integer for dump-only numeric predicates.
  ADD COLUMN IF NOT EXISTS area_classification_label text;

-- ---------------------------------------------------------------------------
-- 2b. The "PR all" columns weld does not have yet
--     (analysis/pbix/project-wd-wr-inco-acciona.md §5.3, orchestrator addendum)
-- ---------------------------------------------------------------------------
-- All nullable with no default, so each ADD COLUMN is a catalogue-only change:
-- Postgres 11+ does not rewrite the table for these, however many there are.
-- Every one is written by a LOADER, not by Postgres — they are materialised DAX
-- calculated columns. §5.4's "traffic light" and ALLEXCEPT columns are
-- deliberately NOT here: those are aggregates and belong in lib/metrics' GROUP BY,
-- not in the fact table.
ALTER TABLE weld
  -- §5.3 #1: the "WP1" flag. 14 `Total … Dia WP1 …` measures — the whole
  -- dia-inch welded volume — depend on picking exactly one row per joint.
  -- ROW_NUMBER() OVER (PARTITION BY joint_id ORDER BY id); WP1 is seq = 1.
  ADD COLUMN IF NOT EXISTS weldpoint_seq integer,
  -- §5.3 #2: welder || '-' || sub_contractor. 96 visuals and 19 measures group by
  -- THIS, not by welder: badge numbers collide across subcontractors
  -- (3,940 welder_id vs 3,896 welder).
  ADD COLUMN IF NOT EXISTS welder_id text,
  -- §5.3 #5: TESTPACK No "PR All" — CCC's from the joint record's
  -- `Test Package No`, otherwise max(testpack_no) over joint_id. Cardinality
  -- 17,875 -> 29,456; without it the TESTPACK page undercounts 40% of packages.
  ADD COLUMN IF NOT EXISTS testpack_no_all text,

  -- §5.3 #8 / addendum 2: the UT-tracker OVERLAYS. In the pbix these are SEPARATE
  -- columns from the imported ones — `Manual UT Report No` (imported) and
  -- `Manual UT Report No.` (calculated, with the dot) coexist, and the calculated
  -- one overwrites the imported values from the UT trackers. Merging the pair
  -- would silently destroy the raw value, so the overlay gets its own column and
  -- the raw stays untouched. Same for Date / Status / Operator ID.
  -- UT TRACKER (CCC)_Talisman.xlsx is in sources/; UT TRACKER (GAC) and
  -- UT TRACKER (TEK) are still missing (ruling R-05 stays open).
  ADD COLUMN IF NOT EXISTS manual_ut_report_no_all text,
  ADD COLUMN IF NOT EXISTS manual_ut_status_all    text,
  ADD COLUMN IF NOT EXISTS manual_ut_date_all      date,
  ADD COLUMN IF NOT EXISTS ut_operator_id_all      text,
  ADD COLUMN IF NOT EXISTS ut_report_all           text,
  ADD COLUMN IF NOT EXISTS ut_date_all             date,

  -- §5.3 #7 / addendum 3: the CCC NDE branches. Every one is a LEFT JOIN to
  -- ccc_joint_pwht on joint_id with MAX() over the group — the joint record is
  -- joint-grained, the CCC fact rows are welder-pass-grained (ruling R2-01).
  -- pwht_y_n_ccc / pwht_report_no_ccc / pwht_date_no_ccc already exist from 0003.
  ADD COLUMN IF NOT EXISTS mt_report_ccc     text,          -- JR `MT Root Report No` (272,307)
  ADD COLUMN IF NOT EXISTS mt_date_ccc       date,          -- JR `MT Root Date`
  ADD COLUMN IF NOT EXISTS mt_pct_ccc        integer,       -- JR `MT Root(%)` / `MT Cap(%)` (373,825)
  ADD COLUMN IF NOT EXISTS pt_report_ccc     text,          -- JR `PT Root Report No` (170,345)
  ADD COLUMN IF NOT EXISTS pt_date_ccc       date,          -- JR `PT Root Date`
  ADD COLUMN IF NOT EXISTS pt_pct_ccc        integer,       -- JR `PT Root(%)` / `PT Cap(%)` (373,260)
  ADD COLUMN IF NOT EXISTS pmi_report_ccc    text,          -- JR `PMI Report No` (255,301)
  ADD COLUMN IF NOT EXISTS pmi_date_ccc      date,          -- JR `PMI Date`
  ADD COLUMN IF NOT EXISTS ht_report_ccc     text,          -- JR `HT Report No` (199,534)
  ADD COLUMN IF NOT EXISTS ht_date_ccc       date,          -- JR `HT Date`
  -- `DWIR CCC From "JR"` = MAXX(JR by Joint ID, JR[Weld Report No]) for CCC only.
  -- `DWIR Report "PR All"` is then coalesce(dwir_no, dwir_ccc_from_jr) — an
  -- expression, not a stored column (§5.4).
  ADD COLUMN IF NOT EXISTS dwir_ccc_from_jr  text,          -- JR `Weld Report No` (1,431,579)
  ADD COLUMN IF NOT EXISTS thickness_from_jr numeric(8,2),  -- JR `Wall Thickness` (1,612,440)
  ADD COLUMN IF NOT EXISTS rework_code_all   text;          -- JR `Rework Code` (133,029), coalesced with weld.rework_code

COMMENT ON COLUMN weld.weldpoint_seq IS
  'ROW_NUMBER() over joint_id; seq=1 is the pbix "WP1" flag the dia-inch volume measures key on. Loader-materialised.';
COMMENT ON COLUMN weld.welder_id IS
  'welder || ''-'' || sub_contractor. Badge numbers collide across subcontractors; group by this, not by welder.';
COMMENT ON COLUMN weld.manual_ut_report_no_all IS
  'UT-tracker OVERLAY. The pbix keeps the imported `Manual UT Report No` and the calculated `Manual UT Report No.` as separate columns; so do we. The raw value stays in manual_ut_report_no.';

CREATE INDEX IF NOT EXISTS weld_welder_id    ON weld (welder_id);
CREATE INDEX IF NOT EXISTS weld_wp1          ON weld (joint_id) WHERE weldpoint_seq = 1;
CREATE INDEX IF NOT EXISTS weld_testpack_all ON weld (testpack_no_all);

ALTER TABLE weld
  ADD COLUMN IF NOT EXISTS rt_film_total numeric(10,4)
    GENERATED ALWAYS AS (coalesce(total_no_of_films_acc, 0) + coalesce(total_no_of_films_rej, 0)) STORED;

-- Backfill the already-loaded WELD_DUMP rows so the label column is complete for
-- both sources without waiting for a reload.
UPDATE weld
   SET area_classification_label = area_classification::text
 WHERE area_classification_label IS NULL
   AND area_classification IS NOT NULL;

COMMENT ON COLUMN weld.area_classification IS
  'Numeric zone code, WELD_DUMP only (2000000..9000000). NULL for CCC — see area_classification_label.';
COMMENT ON COLUMN weld.area_classification_label IS
  'The pbix PR-all `Area Classification` vocabulary (22 values): the dump code as text, or CCC''s Area Group-2 name.';
COMMENT ON COLUMN weld.rt_film_total IS
  'GENERATED acc+rej. numeric(10,4): CCC carries a fractional weld-point share (ruling R2-04).';

-- ===========================================================================
-- 3. load ledger — one row per file loaded, from any of the batch-1/2 sources
-- ===========================================================================
-- `load.source` was the `weld_source` enum, which only ever described rows that
-- land in the FACT table.  Batch 2 loads spool masters, workbooks and a tracker,
-- none of which are weld rows.  Decoupled to text + CHECK so the ledger can name
-- any file kind without forcing a fact-table enum value into existence.
-- `weld.source` stays the enum; the two vocabularies overlap but are not the same.
ALTER TABLE load ALTER COLUMN source TYPE text USING source::text;
ALTER TABLE load DROP CONSTRAINT IF EXISTS load_source_vocabulary;
ALTER TABLE load ADD CONSTRAINT load_source_vocabulary CHECK (source IN (
  -- fact sources (also weld_source enum values)
  'WELD_DUMP', 'CCC_WELDER_RECORD', 'CCC_JOINT_RECORD', 'ACCIONA', 'INCO',
  -- dimension / reference sources
  'SPOOL_DUMP', 'TALISMAN_SPOOL', 'WEEKLY_SNAPSHOT', 'UT_TRACKER_CCC',
  'EXCLUSION_LIST', 'MPI_DONE', 'ACTIVE_WELDERS',
  -- still-missing registers whose tables already exist (R-01, R-12)
  'WELD_LENGTH', 'WPS_REGISTER', 'QUALIFIED_WELDERS'
));

-- ===========================================================================
-- 4. spool — one table, two masters (ruling R2-06)
-- ===========================================================================
-- `Spool Dump.txt` has ZERO CCC spools (GAC 103,260 / TEKFEN 82,072 /
-- MEDGULF 17,020); CCC's live in `Spool.csv` (Talisman) under different column
-- names.  One table with a `source` discriminator, Talisman's milestones mapped
-- onto the shared names, unmapped columns dropped.  The full mapping table —
-- including what each master does NOT supply — is in db/README.md.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM spool) THEN
    RAISE EXCEPTION
      'spool is not empty; 0010 re-creates it and would lose data. Load it after this migration.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'spool_source') THEN
    CREATE TYPE spool_source AS ENUM ('SPOOL_DUMP', 'TALISMAN_SPOOL');
  END IF;
END $$;

DROP TABLE IF EXISTS spool;
CREATE TABLE spool (
  source                       spool_source NOT NULL,
  spool_id                     text         NOT NULL,   -- iso_number || '-' || spool_no
  load_id                      bigint       NOT NULL REFERENCES load(id) ON DELETE CASCADE,
  iso_number                   text         NOT NULL,
  spool_no                     text         NOT NULL,

  -- scope / identity (Spool Dump only; Talisman carries none of these)
  iso_rev_no                   text,
  spool_rev_no                 integer,
  sheet_no                     integer,
  barcode_number               bigint,
  spool_shop_sub_contractor    text,
  spool_field_sub_contractor   text,
  spool_paint_sub_contractor   text,
  shop_sub_contractor          text,
  field_sub_contractor         text,
  area_classification          integer,
  wbu                          integer,
  pds_area                     text,
  pds_area_type                text,
  line_no                      text,      -- carries the inch mark: 6"(1C1KL) — see R2-06/COPY TEXT
  system_no                    text,
  subsystem_code               text,
  testpack_no                  text,
  testpack_sub_contractor      text,
  service_class                text,
  service_cat                  text,
  piping_group                 text,
  matrl_type                   text,
  ag_ug_pkg                    text,
  lb_sb                        text,
  paint_system                 text,
  material_availability        text,

  -- geometry
  shop_dia                     numeric(12,4),
  shop_di_comp                 numeric(12,4),
  field_dia                    numeric(12,4),
  field_di_comp                numeric(12,4),
  spool_diameter               numeric(12,4),
  spool_weight                 numeric(14,4),   -- Talisman: WEIGHT
  spool_length                 numeric(12,4),
  spool_volume                 numeric(14,6),
  surface_area                 numeric(14,4),
  spool_inch_meter             numeric(14,4),

  -- milestones: the union of the two masters (mapping table in db/README.md)
  fabrication_order            date,   -- Talisman only
  material_issue               date,   -- dump: Material Check    | Talisman: MATERIAL ISSUE
  cut_fit                      date,   -- Talisman only
  mir_no                       text,   -- dump only
  mir_date                     date,   -- dump only
  start_fab                    date,   -- dump only
  fabricated                   date,   -- dump: FABRICATED        | Talisman: SHOP WELD COMPLETE
  qc_release                   date,   -- dump: QC RELEASE        | Talisman: QC SPOOL RELEASED TO NDT/PWHT
  qc_sign_off                  text,   -- dump only
  pwht_date                    date,   -- Talisman only
  shop_nde_done                date,   -- Talisman only
  sent_to_paint                date,   -- dump: SENT TO PAINT     | Talisman: PAINT RELEASE
  painted                      date,   -- dump: PAINTED           | Talisman: PAINT COMPLETE
  final_qc                     date,   -- dump: FINAL QC          | Talisman: QC RELEASE FROM PAINTING
  paint_report_date            date,   -- Talisman only
  paint_report_no              text,   -- Talisman only
  laydown                      date,   -- dump: LAYDOWN           | Talisman: SENT TO LAYDOWN
  laydown_move                 date,   -- Talisman only
  to_site                      date,   -- dump: TO SITE           | Talisman: SITE MOVE
  erected                      date,   -- dump: ERECTED           | Talisman: SPOOL ERECTION DONE
  welded_bolt                  date,   -- dump only
  supported                    date,   -- dump only
  rft                          date,   -- dump only
  field_weld_complete          date,   -- Talisman only
  field_nde_done               date,   -- Talisman only (a DATE)
  erec_mir_no                  text,   -- dump only
  erec_mir_date                date,   -- dump only
  testpack_test_done_date      date,   -- dump only

  -- status
  spool_nde_status             text,   -- dump only — feeds Weld Dump[Status Spool NDE]
  assembly_weld_nde_completed  text,   -- dump only
  field_weld_nde_completed     text,   -- dump only (TEXT, not the Talisman date)
  revision_status              text,   -- dump only — the load filter keeps '' (198,647 of 202,352)
  revision_comments            text,
  hold_status                  text,
  hold_comments                text,
  location_status              text,
  spool_tracking_date          date,

  PRIMARY KEY (source, spool_id)
);
CREATE INDEX IF NOT EXISTS spool_spool_id ON spool (spool_id);
CREATE INDEX IF NOT EXISTS spool_load     ON spool (load_id);
CREATE INDEX IF NOT EXISTS spool_iso      ON spool (iso_number);

COMMENT ON TABLE spool IS
  'Two spool masters unioned (R2-06). Spool Dump.txt has no CCC spools; Spool.csv (Talisman) has them under other names. Join weld.spool_id -> spool.spool_id and pick a source.';

-- ===========================================================================
-- 5. ccc_joint_pwht — the CCC PWHT lookup (brief item e)
-- ===========================================================================
-- RULING TAKEN: a separate lookup table, NOT folded into `weld`.
-- Reason: `AllTrain_CSVExport_Joint Record.csv` is joint-grained (1,560,273 kept
-- rows) while CCC's fact rows are welder-pass-grained (5,430,732). Folding it in
-- would copy the same PWHT values onto ~4 rows each and invite a `count(*)`
-- double-count — exactly the hazard ruling R2-01 warns about. The pbix does the
-- same thing: `PWHT Y/N CCC`, `PWHT Report No CCC` and `PWHT Date No CCC` are
-- LOOKUPVALUE calculated columns keyed `Joint ID "JR"` -> `Joint ID`.
--
-- The three `weld.*_ccc` columns from 0003 stay: the CCC loader materialises the
-- lookup onto its fact rows so the M45/M46/M47/M61/M65 predicates stay single-table.
-- This table is the auditable source of that materialisation.
--
-- GRAIN WARNING for the loader: 1,560,273 kept rows collapse to 1,470,065 distinct
-- Joint IDs, so `joint_id_jr` is NOT unique in the file. The loader must collapse to
-- one row per joint, record how many source rows it merged in `source_rows`, and set
-- `is_ambiguous` when the merged rows disagree on any PWHT value. DAX LOOKUPVALUE
-- returns BLANK on a genuine conflict; we make the conflict visible instead.
CREATE TABLE IF NOT EXISTS ccc_joint_pwht (
  joint_id_jr      text    PRIMARY KEY,  -- QC ISO DWG No & '-' & Spool No & '-' & Joint No & Repair Suffix
  load_id          bigint  NOT NULL REFERENCES load(id) ON DELETE CASCADE,
  pwht_y_n         text,                 -- 'Y' 202,786 / 'N' 1,357,487 — NO '25.01' here (R-04 is dump-only)
  pwht_report_no   text,
  pwht_date        date,
  ht_report_no     text,                 -- JR `HT Report No` (199,534)
  ht_date          date,                 -- JR `HT Date` (199,534)
  -- The rest of the joint record that the "… CCC" measure branches read
  -- (§5.3 #5 and #7). The table name says PWHT for historical reasons; it is the
  -- WHOLE CCC joint lookup. Renaming it would break the contract the brief set
  -- with the seeding and metrics lanes, so the name stays and this comment warns.
  mt_root_report_no text,                -- 272,307 -> weld.mt_report_ccc
  mt_root_date      date,                --         -> weld.mt_date_ccc
  mt_root_pct       integer,             -- 373,825 -> weld.mt_pct_ccc
  mt_cap_pct        integer,             -- 373,825 (MT Cap Report No/Date are empty in all rows)
  pt_root_report_no text,                -- 170,345 -> weld.pt_report_ccc
  pt_root_date      date,                --         -> weld.pt_date_ccc
  pt_root_pct       integer,             -- 373,260 -> weld.pt_pct_ccc
  pt_cap_pct        integer,             -- 373,260 (PT Cap Report No/Date are empty in all rows)
  pmi_report_no     text,                -- 255,301 -> weld.pmi_report_ccc
  pmi_date          date,                --         -> weld.pmi_date_ccc
  weld_report_no    text,                -- 1,431,579 -> weld.dwir_ccc_from_jr
  test_package_no   text,                -- 1,612,440 -> weld.testpack_no_all
  sub_system_no     text,                -- 1,608,893
  wall_thickness    numeric(8,2),        -- 1,612,440 -> weld.thickness_from_jr
  rework_code       text,                -- 133,029   -> weld.rework_code_all
  sub_contractor   text,
  weld_date        date,
  repair_suffix    text,
  is_welded        boolean NOT NULL,     -- weld_date IS NOT NULL; false on the 130,994 NOT-WELDED joints
  source_rows      integer NOT NULL DEFAULT 1,
  is_ambiguous     boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS ccc_joint_pwht_load     ON ccc_joint_pwht (load_id);
CREATE INDEX IF NOT EXISTS ccc_joint_pwht_notweld  ON ccc_joint_pwht (is_welded) WHERE NOT is_welded;

-- ===========================================================================
-- 6. weld_weekly_snapshot — scope + raw label (ruling R2-08)
-- ===========================================================================
-- The workbooks use `GAC SG` and `TEKFEN TMCP` as sub-contractor values, and both
-- `Inco` and `INCO` for one party. Normalise at load: `sub_contractor` holds the
-- canonical upper-case party, `scope` holds the qualifier, `label_raw` keeps the
-- cell verbatim so the normalisation is auditable and reversible.
--   'GAC SG'       -> sub_contractor 'GAC',     scope 'SG',     label_raw 'GAC SG'
--   'TEKFEN TMCP'  -> sub_contractor 'TEKFEN',  scope 'TMCP',   label_raw 'TEKFEN TMCP'
--   'Inco'/'INCO'  -> sub_contractor 'INCO',    scope 'ALL',    label_raw as found
--   MPI rows       -> sub_contractor 'PROJECT', scope 'ALL'     (no sub-contractor column)
-- ALTER, never DROP: this history is the only copy outside the workbooks (R-08),
-- so the change works whether the table is empty or already seeded.
ALTER TABLE weld_weekly_snapshot
  ADD COLUMN IF NOT EXISTS scope     text NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS label_raw text;
ALTER TABLE weld_weekly_snapshot DROP CONSTRAINT IF EXISTS weld_weekly_snapshot_pkey;
ALTER TABLE weld_weekly_snapshot
  ADD CONSTRAINT weld_weekly_snapshot_pkey
  PRIMARY KEY (week_end_date, sub_contractor, scope, metric);

COMMENT ON COLUMN weld_weekly_snapshot.scope IS
  'Qualifier split off the workbook label: ALL | SG | TMCP | NONSG. Ruling R2-08.';
COMMENT ON COLUMN weld_weekly_snapshot.label_raw IS
  'The workbook cell verbatim (e.g. "GAC SG", "Inco"), so the normalisation is auditable.';

-- ===========================================================================
-- 7. Reference tables for the seeding lane
-- ===========================================================================

-- R2-02: `TO BE EXLUDE FROM DATA.xlsx` (596 rows, 161 RT-Report+Welder keys) is
-- referenced by NO Power Query. It is loaded UNAPPLIED — no loader may use it as a
-- filter — so that a later feature flag can, and so the numbers stay reproducible.
CREATE TABLE IF NOT EXISTS ref_exclusion_list (
  id          bigserial   PRIMARY KEY,
  rt_report   text,                    -- from `RT Report + Welder` / `RT/UT Report No.`
  welder      text,                    -- `Welder No.`
  joint_id    text,                    -- the workbook's own `Joint ID` column
  reason      text,
  load_id     bigint      REFERENCES load(id) ON DELETE SET NULL,
  loaded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ref_exclusion_list_key ON ref_exclusion_list (rt_report, welder);
CREATE INDEX IF NOT EXISTS ref_exclusion_list_joint ON ref_exclusion_list (joint_id);
COMMENT ON TABLE ref_exclusion_list IS
  'Ruling R2-02: stored UNAPPLIED. No loader or metric may filter on this table without an explicit ruling.';

-- R2-14: `UT TRACKER (CCC)_Talisman.xlsx`, sheet `TalismanUT_update`, 9,419 rows,
-- all 24 columns including `TPI Date` / `TPI Report No`, which the pbix M predates.
-- Feeds CCC's Manual-UT branch of M32/M34 by DAX LOOKUPVALUE, not by union.
CREATE TABLE IF NOT EXISTS ref_ut_tracker_ccc (
  id                 bigserial PRIMARY KEY,
  load_id            bigint    NOT NULL REFERENCES load(id) ON DELETE CASCADE,
  qciso_no           text,                  -- 2,222 distinct
  joint_no           text,                  -- kept text: 265 distinct, not all numeric
  spool_no           text,
  size_inch          numeric(8,2),          -- `SIZE`
  wall_thickness     numeric(8,2),
  service_class      text,
  weld_type          text,                  -- BW ×9,418, LET ×1
  area               text,
  weld_date          date,
  welder_id          text,                  -- 'W-276/W-442' — a PAIR on many rows, keep text
  welder_id_2        text,
  welder_id_3        text,
  welder_id_4        text,
  wps_code           text,
  ut1_date           date,
  ut1_rep_no         text,                  -- 9,419 distinct = the natural key
  ut1_result         text,                  -- A ×9,389 / R ×30
  ut_ope1            text,
  ut_ope2            text,                  -- empty in all 9,419 rows
  weld_defect_length numeric(18,12),        -- metres, values down to 0.00021124999999999998
  tpi_date           date,                  -- NEW vs the pbix M
  tpi_report_no      text,                  -- NEW vs the pbix M
  pwht_date          date,
  pwht_rep_no        text,
  -- derived by the loader so the CCC join is a plain equality
  joint_id           text                   -- qciso_no || '-' || spool_no || '-' || joint_no
);
CREATE INDEX IF NOT EXISTS ref_ut_tracker_ccc_joint  ON ref_ut_tracker_ccc (joint_id);
CREATE INDEX IF NOT EXISTS ref_ut_tracker_ccc_report ON ref_ut_tracker_ccc (ut1_rep_no);
COMMENT ON TABLE ref_ut_tracker_ccc IS
  'Ruling R2-14. Sheet TalismanUT_update only; the Reject sheet (30 rows) is a subset and is NOT loaded.';

-- `CUM MPI Done .xlsx`, sheet `MPI Done`, 124 rows. Project totals, no
-- sub-contractor column. Values are CUMULATIVE running totals, not weekly deltas.
-- The seeder ALSO writes these into weld_weekly_snapshot as metrics M71 / M71PT
-- with sub_contractor = 'PROJECT'; this table is the raw landing copy.
CREATE TABLE IF NOT EXISTS ref_mpi_done (
  week_end_date date    PRIMARY KEY,
  mpi_done      numeric,
  mpi_pt_done   numeric,
  load_id       bigint  REFERENCES load(id) ON DELETE SET NULL
);
COMMENT ON TABLE ref_mpi_done IS
  'Raw landing copy of CUM MPI Done .xlsx (124 rows). CUMULATIVE totals. Also seeded into weld_weekly_snapshot as M71/M71PT, sub_contractor=PROJECT.';

-- `CUM Trend Active Welders.xlsx`, 576 rows: weekly active welders per party.
-- NOT M90 (`Project_Welder`, the SCTR register, still missing) — its own metric
-- id M90W. Two of the 576 value cells are blank: store NULL, never 0.
CREATE TABLE IF NOT EXISTS ref_active_welders (
  week_end_date  date    NOT NULL,
  sub_contractor text    NOT NULL,   -- canonical: CCC/TEKFEN/GAC/MEDGULF/INCO/ACCIONA
  welders        integer,            -- NULL where the workbook cell is blank
  label_raw      text,
  load_id        bigint  REFERENCES load(id) ON DELETE SET NULL,
  PRIMARY KEY (week_end_date, sub_contractor)
);
COMMENT ON TABLE ref_active_welders IS
  'Raw landing copy of CUM Trend Active Welders.xlsx (576 rows). Also seeded into weld_weekly_snapshot as metric M90W.';
