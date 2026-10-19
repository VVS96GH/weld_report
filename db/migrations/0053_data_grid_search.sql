-- 0053 — the Data page (owner, 2026-10-19): the detailed table, all 6.6 M weld
-- rows, filtered and searched column by column like the pbix data view.
--
-- "Contains" searches on the columns people look things up by would scan the
-- whole 6 GB table (an ISO search took 9 s). Trigram indexes answer them by
-- index instead (~0.1–0.3 s): Joint ID, Spool ID, ISO Number, RT Report,
-- Welder ID. Exact picks on ISO get a plain index too.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS weld_trgm_joint   ON weld USING gin (joint_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS weld_trgm_spool   ON weld USING gin (spool_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS weld_trgm_iso     ON weld USING gin (iso_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS weld_trgm_rt_rep  ON weld USING gin (rt_report gin_trgm_ops);
CREATE INDEX IF NOT EXISTS weld_trgm_welder  ON weld USING gin (welder_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS weld_iso          ON weld (iso_number);
