-- migrate: no-transaction
--
-- 0009 — add the fifth `weld_source` value (ruling R2-03).
--
-- `ALTER TYPE … ADD VALUE` is the one statement this project needs that Postgres
-- will not run inside a transaction block in the general case, so scripts/migrate.ts
-- honours the marker on line 1 and runs this file with autocommit.  Nothing here
-- rolls back, so the statement is written IF NOT EXISTS and is safe to re-run.
--
-- WHY a fifth value and not `CCC_WELDER_RECORD`: the 130,994 NOT-WELDED rows come
-- from `AllTrain_CSVExport_Joint Record.csv`, a different file with a different
-- grain (one row per joint, not per welder pass).  Labelling them with the welder
-- record's source would make provenance a lie and would break any per-source row
-- count.  See analysis/sources2/ccc-column-map.md §E.
--
-- The new value is NOT used by any later statement in this migration run, so the
-- "cannot use a new enum value in the same transaction" rule is not in play.

ALTER TYPE weld_source ADD VALUE IF NOT EXISTS 'CCC_JOINT_RECORD';
