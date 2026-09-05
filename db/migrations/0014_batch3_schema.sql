-- 0014 — schema for the batch-3 workbooks (Acciona, Inco, Weld Length, the two
--        welder registers, the rework-code legend).
--
-- Evidence: analysis/sources3/{rulings,plan,acciona-column-map,inco-column-map,
-- weld-length,welders,workbooks}.md. Rulings R3-01 … R3-15 are binding.
--
-- Every ALTER here is nullable-with-no-default or a widening, so none of them
-- rewrites `weld` (6.5 M rows).

-- ===========================================================================
-- 1. weld.sub_contractor_tier (R3-04)
-- ===========================================================================
-- Acciona's `Column12` — `FOURTH DIMENSION` ×8,593 / `DEBAJ` ×4,720 — is the
-- sub-contractor's own sub-tier. It reaches the pbix union (as `Custom14`) and
-- exists nowhere else in the model, so it needs a column of its own or it is
-- silently discarded. NULL for every other source, which is honest: no other
-- source has a tier, as opposed to having an unknown one.
ALTER TABLE weld ADD COLUMN IF NOT EXISTS sub_contractor_tier text;
COMMENT ON COLUMN weld.sub_contractor_tier IS
  'Sub-contractor sub-tier. ACCIONA only (FOURTH DIMENSION / DEBAJ, from Column12). NULL elsewhere — R3-04.';
CREATE INDEX IF NOT EXISTS weld_sub_tier ON weld (sub_contractor_tier)
  WHERE sub_contractor_tier IS NOT NULL;

-- ===========================================================================
-- 2. weld_length_by_dia precision (R3-07)
-- ===========================================================================
-- numeric(8,3) truncates the table it is meant to hold: 0.000797814 -> 0.001 and
-- 0.0669 -> 0.067. The 98 delivered values carry up to 18 decimal places (they are
-- floating-point residue of an inch->metre conversion); numeric(12,9) keeps nine,
-- which is more than the source's real precision and exact for every value that
-- matters. The table is empty today, so this cannot lose data.
ALTER TABLE weld_length_by_dia ALTER COLUMN weld_length TYPE numeric(12,9);
COMMENT ON TABLE weld_length_by_dia IS
  'dia inch -> metres, 98 rows. The workbook stores 728,550 exploded (Weld Type, Dia inch) rows; the DAX keys on Dia inch ALONE and ignores Weld Type, and no dia maps to two lengths, so 98 is the whole content. Exploded count kept in the load ledger notes (R3-07).';

-- ===========================================================================
-- 2b. weld.weld_length / weld.rej_length — numeric(5,4) cannot hold Inco
-- ===========================================================================
-- Found while writing the Inco loader, not predicted by the column map: both
-- columns are numeric(5,4), i.e. max 9.9999. That fits the dump, whose values are
-- METRES (0.1049 ...), but Inco's `Length (MM)` reaches 7,957 and its
-- `RT LENGTH (MM)` reaches 2,500 — MILLIMETRES — and every Inco row would abort
-- the load with a numeric field overflow.
--
-- The mixed unit is the pbix's, not ours: the M files Inco's millimetres into the
-- same `Weld Length` column the dump fills with metres, and the DAX's Inco branch
-- divides by 1000 to compensate. Widening is the only way to reproduce it.
--
-- Two materialised views read these columns — `mv_weekly_progress` (0011, this
-- lane) and `mv_joint` (0013, the METRICS lane) — and Postgres refuses to alter a
-- column a view reads. Rather than copy 0013's 400-line definition into this file,
-- which would fork a file this lane does not own, the dependants are captured from
-- the catalogue with pg_get_viewdef()/pg_get_indexdef(), dropped, and rebuilt
-- byte-for-byte from what the database itself holds. Nothing is retyped, so the
-- metrics lane stays the only author of mv_joint.
--
-- They come back WITH NO DATA; the next `refreshMatviews()` repopulates them (its
-- relispopulated branch makes that first refresh a plain one). Run any loader — or
-- REFRESH MATERIALIZED VIEW by hand — after this migration.
CREATE TEMP TABLE _mv_save (name text, def text, idx text[]) ON COMMIT DROP;

DO $$
DECLARE r record; idxs text[];
BEGIN
  FOR r IN
    SELECT DISTINCT dep.oid AS oid, dep.relname AS relname
      FROM pg_depend d
      JOIN pg_rewrite rw ON rw.oid = d.objid
      JOIN pg_class dep ON dep.oid = rw.ev_class AND dep.relkind = 'm'
      JOIN pg_class src ON src.oid = d.refobjid
      JOIN pg_attribute a ON a.attrelid = src.oid AND a.attnum = d.refobjsubid
     WHERE src.relname = 'weld' AND a.attname IN ('weld_length', 'rej_length')
  LOOP
    SELECT array_agg(pg_get_indexdef(i.indexrelid)) INTO idxs
      FROM pg_index i WHERE i.indrelid = r.oid;
    INSERT INTO _mv_save VALUES (r.relname,
      rtrim(btrim(pg_get_viewdef(r.oid, true)), ';'), coalesce(idxs, '{}'::text[]));
    RAISE NOTICE 'capturing materialised view % (% indexes)', r.relname, coalesce(array_length(idxs, 1), 0);
  END LOOP;
  FOR r IN SELECT name FROM _mv_save LOOP
    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I', r.name);
  END LOOP;
END $$;

ALTER TABLE weld
  ALTER COLUMN weld_length TYPE numeric(12,4),
  ALTER COLUMN rej_length  TYPE numeric(12,4);

DO $$
DECLARE r record; s text;
BEGIN
  FOR r IN SELECT * FROM _mv_save LOOP
    EXECUTE format('CREATE MATERIALIZED VIEW %I AS %s WITH NO DATA', r.name, r.def);
    FOREACH s IN ARRAY r.idx LOOP EXECUTE s; END LOOP;
    RAISE NOTICE 'rebuilt materialised view % (unpopulated — refresh it)', r.name;
  END LOOP;
END $$;

COMMENT ON COLUMN weld.weld_length IS
  'UNIT VARIES BY SOURCE, as in the pbix: METRES for WELD_DUMP, MILLIMETRES for INCO, NULL for CCC/ACCIONA. Use weld_length_m, which normalises to metres.';

-- ===========================================================================
-- 3. ref_code_label (R3-08)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS ref_code_label (
  domain      text NOT NULL,   -- rework_code | defect_code | weld_type | nde_status
  code        text NOT NULL,
  description text,
  load_id     bigint REFERENCES load(id) ON DELETE SET NULL,
  PRIMARY KEY (domain, code)
);
COMMENT ON TABLE ref_code_label IS
  'NOT A PBIX REPRODUCTION. `Weld Length/Rework code.xlsx` is read by NO Power Query and feeds no measure; these are display labels for codes the UI otherwise shows raw. Display-only — never a join key, never a filter, and never a source of truth about which codes exist (the fact tables are). Ruling R3-08.';

-- ===========================================================================
-- 4. ref_qualified_welders — widened (R3-10)
-- ===========================================================================
-- M90 `Project_Welder` = SUM(QUALIFIED WELDERS) = 3,816. The sheet also carries
-- ACTIVE WELDERS (2,855) and ACTIVE PIPING WELDERS (1,708), which are different
-- populations and worth keeping rather than discarding at load.
-- `as_of` is the FILE MTIME, not a reporting date: the sheet carries no date
-- anywhere. `source_note` says so, so a widget can show provenance honestly.
ALTER TABLE ref_qualified_welders
  ADD COLUMN IF NOT EXISTS active_welders        integer,
  ADD COLUMN IF NOT EXISTS active_piping_welders integer,
  ADD COLUMN IF NOT EXISTS load_id               bigint REFERENCES load(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_note           text;
COMMENT ON COLUMN ref_qualified_welders.as_of IS
  'The SOURCE FILE mtime, not a reporting date — SCTR NFE WELDERS APPLIED.xls carries no date. State it as such in any widget (R3-10).';

-- ===========================================================================
-- 5. ref_welder_qualification (R3-12)
-- ===========================================================================
-- The per-welder register, 5,484 rows, from the named Table `WELDERS_Qualification`.
-- `welder_id_code_sub` is `BADGE-SUBCON`, the same key shape as `weld.welder_id`
-- (welder || '-' || sub_contractor), so it can be joined when a welder page exists.
-- Loaded now, wired later — it is not a §2 metric source.
CREATE TABLE IF NOT EXISTS ref_welder_qualification (
  id                  bigserial PRIMARY KEY,
  load_id             bigint NOT NULL REFERENCES load(id) ON DELETE CASCADE,
  sl_no               text,
  discipline          text,      -- `PIP -PIPING … STR- STRUCTURAL WELDERS`: PIP / STR / PIPE / TANK / PIP+STR
  welder_name         text,
  wqt_no              text,
  welder_no           text,
  wps_no              text,
  date_of_test        date,
  welding_process     text,      -- embedded newlines in the source; kept verbatim
  filler_materials    text,
  base_material       text,
  type_of_joint       text,
  working_location    text,
  vt_result           text,
  rt_result           text,
  status              text,      -- 14 distinct
  remarks             text,
  sub_contractor      text,      -- canonical upper case (R2-08); label_raw keeps the workbook's
  sub_contractor_raw  text,
  welder_id_name      text,      -- `WELDER ID` = NAME-BADGE-SUBCON
  welder_id_code_sub  text       -- `Welder ID Code+Sub` = BADGE-SUBCON -> weld.welder_id
);
CREATE INDEX IF NOT EXISTS ref_welder_qual_key  ON ref_welder_qualification (welder_id_code_sub);
CREATE INDEX IF NOT EXISTS ref_welder_qual_sub  ON ref_welder_qualification (sub_contractor);
CREATE INDEX IF NOT EXISTS ref_welder_qual_load ON ref_welder_qualification (load_id);

-- ===========================================================================
-- 6. ref_welder_status_weekly (R3-13)
-- ===========================================================================
-- `CUM WEEK # Status`: 127 weeks × 8 categories × 6 parties = 1,016 source rows,
-- unpivoted to one row per (week, party, category).
-- Deliberately NOT eight new `weld_weekly_snapshot` metric ids: these are a
-- category BREAKDOWN of one population, not eight KPI series, and putting them in
-- the snapshot table would make `sum(value)` over metrics meaningless.
CREATE TABLE IF NOT EXISTS ref_welder_status_weekly (
  week_end_date  date   NOT NULL,
  sub_contractor text   NOT NULL,   -- canonical upper case
  category       text   NOT NULL,   -- the 8 categories, prefix stripped
  value          numeric,
  category_raw   text,              -- the workbook string, e.g. '1. Under Qualification '
  period_raw     text,              -- e.g. '1. 23-Feb-24 to 1-Mar-24'
  week_raw       text,              -- e.g. '147 week'
  load_id        bigint REFERENCES load(id) ON DELETE SET NULL,
  PRIMARY KEY (week_end_date, sub_contractor, category)
);
CREATE INDEX IF NOT EXISTS ref_welder_status_weekly_cat ON ref_welder_status_weekly (category, week_end_date);
COMMENT ON TABLE ref_welder_status_weekly IS
  'CUM WEEK # Status unpivoted. The current-week snapshot sheet (WEEK #   STATUS, 8 rows) uses DIFFERENT category strings (no numeric prefix), so the pbix relationship between the two matches on almost nothing — treat them as independent (R3-13).';

-- ===========================================================================
-- 7. load.source vocabulary
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
  'WELDERS_SCTR', 'WELDERS_QUALIFICATION', 'WELDER_STATUS_WEEKLY', 'CODE_LABELS'
));
