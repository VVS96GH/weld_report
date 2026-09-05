-- 0001 — migration bookkeeping, the source enum, the load ledger, and the
--        text->typed cast helpers every later migration and the loader rely on.
--
-- Idempotent: safe to re-run (scripts/migrate.ts will not, but a hand-run must not hurt).

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    text        PRIMARY KEY,
  sha256      text        NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  duration_ms integer     NOT NULL DEFAULT 0
);

-- analysis/calculation-logic.md §0.3 — the three pbix fact tables are one table
-- plus this discriminator.  'PR' (WD+WR) is dead in the shipped pbix (ruling R-06)
-- and is deliberately NOT a value; use the two-element IN-list instead.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weld_source') THEN
    CREATE TYPE weld_source AS ENUM ('WELD_DUMP', 'CCC_WELDER_RECORD', 'ACCIONA', 'INCO');
  END IF;
END $$;

-- Every load is recorded.  `weld` and `stg_weld_dump` rows carry load_id, so
-- "where did these rows come from" is always answerable.
CREATE TABLE IF NOT EXISTS load (
  id                 bigserial   PRIMARY KEY,
  source             weld_source NOT NULL,
  file_name          text        NOT NULL,
  file_size          bigint      NOT NULL,
  file_sha256        text        NOT NULL,
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  records_read       bigint      NOT NULL DEFAULT 0,  -- logical records assembled from the file
  records_loaded     bigint      NOT NULL DEFAULT 0,  -- rows that survived the M filters -> weld
  records_cancelled  bigint      NOT NULL DEFAULT 0,  -- Revision Status = 'Cancelled' (ruling R-02)
  notes              jsonb       NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS load_source_started ON load (source, started_at DESC);

-- ---------------------------------------------------------------- casts ----
-- All four helpers are IMMUTABLE + LANGUAGE sql so the planner INLINES them;
-- a plpgsql equivalent would add ~36 M function calls to the typed INSERT.
-- Null tokens: profile.md §8.2 — '' (160,838,613 cells), NA, N/A, ?, #N/A.
-- Note that nulling '?' is what analysis/calculation-logic.md §0.2 already
-- assumes: `[X] IN {"?","","S"}` ports to `(x IS NULL OR x = 'S')`.

CREATE OR REPLACE FUNCTION weld_text(v text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT nullif(nullif(nullif(nullif(nullif(btrim(v), ''), 'NA'), 'N/A'), '?'), '#N/A')
$$;

-- Dates in the dump are dd-MMM-yyyy (all 38 date columns; profile.md §4).
-- dd-MMM-yy is accepted too because `Manual UT Date` / `Checked Date` mix the two
-- and a later CCC source may as well.  The month alternation in the regex is what
-- makes this SAFE: to_date() raises on an unknown month name, and one raise would
-- abort the whole 958k-row INSERT.  Anything that does not match returns NULL.
CREATE OR REPLACE FUNCTION weld_to_date(v text) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN btrim(v) ~* '^[0-9]{1,2}-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-[0-9]{4}$'
      THEN to_date(btrim(v), 'DD-MON-YYYY')
    WHEN btrim(v) ~* '^[0-9]{1,2}-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-[0-9]{2}$'
      THEN to_date(btrim(v), 'DD-MON-YY')
    ELSE NULL
  END
$$;

-- Thousands separators appear in 3 columns (profile.md §8.3); strip before casting.
CREATE OR REPLACE FUNCTION weld_to_numeric(v text) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN btrim(replace(v, ',', '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN btrim(replace(v, ',', ''))::numeric
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION weld_to_int(v text) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN btrim(replace(v, ',', '')) ~ '^-?[0-9]+$'
      THEN btrim(replace(v, ',', ''))::bigint
    WHEN btrim(replace(v, ',', '')) ~ '^-?[0-9]+\.[0-9]+$'
      THEN round(btrim(replace(v, ',', ''))::numeric)::bigint
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION weld_to_bool(v text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE upper(btrim(v))
    WHEN 'Y' THEN true  WHEN 'YES' THEN true  WHEN 'TRUE'  THEN true
    WHEN 'N' THEN false WHEN 'NO'  THEN false WHEN 'FALSE' THEN false
    ELSE NULL
  END
$$;
