-- 0046 — the "Rejection Summary" pages of the Welder Performance tab (pbix pages
-- "Rep. Project Welders Performance. Cumulative Rejection Rate. Summary Report"
-- 2 Weeks / 1 Month).
--
-- ref_welder_perf_cum: the owner's two cumulative workbooks
--   sources/CUM FILE Welders Performance For Graphic/CUM FILE Welders Performance.
--     Rejection Rate. Summary Status  2 Weeks Since RT Date .xlsx   (kind '2w')
--     … 1 Month Since RT Date .xlsx                                     (kind '1m')
-- row for row: one row = one (RT date, sub-contractor, status, welder) of the
-- hidden pbix table "CUM - Welders Performance. for Table", appended period by
-- period. The workbooks stay the master (the owner edits them by hand); the
-- report appends a period to them from the page (lib/welder-perf-cum.ts) and
-- this table is reloaded from them. The trend charts read it.
--
-- welder_perf_note: the per-sub-contractor "Notes" boxes, typed on the page,
-- one per (kind, cut-off Friday, sub-contractor).

CREATE TABLE IF NOT EXISTS ref_welder_perf_cum (
  kind            text    NOT NULL CHECK (kind IN ('2w', '1m')),
  row_no          integer NOT NULL,            -- the workbook row (2 = first data row)
  load_id         bigint,
  week_start      date,
  weeknum         text,
  week_end        date,
  period          text,                        -- "73.  25-Sep-26 to 9-Oct-26", verbatim
  last_rt_date    date,
  sub_contractor  text,
  status          text,
  welder_id       text,
  ratio           numeric,
  welder_count    integer,
  PRIMARY KEY (kind, row_no)
);

CREATE INDEX IF NOT EXISTS ref_welder_perf_cum_period ON ref_welder_perf_cum (kind, period, sub_contractor);

CREATE TABLE IF NOT EXISTS welder_perf_note (
  kind            text NOT NULL CHECK (kind IN ('2w', '1m')),
  cutoff          date NOT NULL,
  sub_contractor  text NOT NULL,
  body            text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, cutoff, sub_contractor)
);

-- The `load` ledger vocabulary gains the cumulative workbooks. Re-stated in full
-- (a CHECK cannot be extended in place), as 0028 did.
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
  -- batch 4
  'WPS_PROCESS', 'WPS_STATUS_CUM', 'WPS_PWHT_STATUS',
  -- forecast page
  'HA_GUIDE', 'HA_L0_GUIDE', 'TALISMAN_JOINT',
  -- welder performance rejection summary
  'WELDER_PERF_CUM'
));
