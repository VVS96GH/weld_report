-- 0004 — supporting tables (analysis/calculation-logic.md §6.3).
-- All of these are EMPTY for now; their sources are the 14 workbooks listed in
-- ruling R-01 that `sources/` does not hold.  They exist so the metrics lane can
-- LEFT JOIN them and render an honest-empty state instead of a fabricated zero.

-- CALENDAR("5/8/2021","31/12/2026") — populated by 0005.
CREATE TABLE IF NOT EXISTS calendar (
  date            date     PRIMARY KEY,
  weekday         smallint NOT NULL,  -- DAX: IF(WEEKDAY(d)<=6, WEEKDAY(d)+1, WEEKDAY(d)-6)  => Sat=1 .. Fri=7
  weeknum         integer  NOT NULL,  -- running count of Saturdays since the calendar start
  week_start_date date     NOT NULL,  -- the Saturday of that weeknum
  week_end_date   date,               -- the Friday   <- the report's week label; NULL for a partial tail week
  month           text     NOT NULL,  -- FORMAT(d,"MMM-yy")
  year            smallint NOT NULL
);
CREATE INDEX IF NOT EXISTS calendar_week ON calendar (week_end_date);

-- The pbix 'Weld Length' dimension: dia inch -> metres.  Needed by M33 at "PR all"
-- scope.  Source: `Weld Length\Weld Length.xlsx` (R-01, absent).
CREATE TABLE IF NOT EXISTS weld_length_by_dia (
  dia_inch    numeric(6,2) PRIMARY KEY,
  weld_length numeric(8,3) NOT NULL
);

-- From `Spool Dump.txt` (198,647 rows; R-01, absent).  Feeds every FABRICATED
-- metric (M44/M48/M49) and weld.spool_status.
CREATE TABLE IF NOT EXISTS spool (
  spool_id         text PRIMARY KEY,
  fabricated       date,
  qc_release       date,
  painted          date,
  to_site          date,
  erected          date,
  spool_nde_status text
);

-- The three manual registers (ruling R-12): not computable from any dump, and
-- never were.  Seed from the pbix extract or an admin screen.
CREATE TABLE IF NOT EXISTS ref_qualified_welders (
  sub_contractor    text    PRIMARY KEY,
  qualified_welders integer NOT NULL,
  as_of             date,
  notes             text
);

CREATE TABLE IF NOT EXISTS ref_wps_register (
  wps_no          text PRIMARY KEY,
  document_status text,
  as_of           date,
  notes           text
);

-- Ruling R-08: the weekly backlog trend charts read two hand-maintained workbooks
-- whose history cannot be recomputed from a single dump (the measures use TODAY()).
-- The ETL appends M40/M47/M60/M62/M25/M36 here after every load; until it is
-- seeded, the six trend charts render whatever history exists — never an empty axis
-- dressed up as zeros.
CREATE TABLE IF NOT EXISTS weld_weekly_snapshot (
  week_end_date  date    NOT NULL,
  sub_contractor text    NOT NULL,
  metric         text    NOT NULL,
  value          numeric,
  load_id        bigint  REFERENCES load(id) ON DELETE SET NULL,
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (week_end_date, sub_contractor, metric)
);
CREATE INDEX IF NOT EXISTS weld_weekly_snapshot_metric ON weld_weekly_snapshot (metric, week_end_date);
