-- 0031 — `ref_ha_guide`: the pbix's `HA l0_abs_guide`, at last.
--
-- WHY ------------------------------------------------------------------------
-- Branch 3 of the pbix `HA` calculated column is
--
--   LOOKUPVALUE('HA l0_abs_guide'[Handover Area],
--               'HA l0_abs_guide'[Location Number], [PDS Area])
--
-- and that workbook was missing, so 0026 left branch 3 NULL and 0027 stood in
-- for it by mapping `area_classification_label` to an HA. The stand-in was
-- always documented as an approximation, and `sources/HA.csv` proved it had to
-- be one: the (HA, Area Classification) mapping is many-to-many, so a label
-- alone cannot choose between HA2 and HA3.
--
-- `sources/l0_abs_guide.csv` (912 data rows, 906 carrying HA1..HA4) is the real
-- thing. Migration 0032 replaces the label stand-in with this lookup.
--
-- PARSING ---------------------------------------------------------------------
-- The file is ASCII with MIXED quoting: most rows unquoted, some fields quoted
-- because they contain commas, and six rows near the end with UNBALANCED
-- quotes. The pbix reads it with `QuoteStyle.None`, and the loader does the
-- same. The two columns that matter — Handover Area and Location Number —
-- never contain a comma, so they are always the first two fields; the
-- remaining eleven are stored only when a row splits into exactly thirteen,
-- and `is_malformed` marks the rest rather than dropping them silently.

CREATE TABLE IF NOT EXISTS ref_ha_guide (
  location_number   text PRIMARY KEY,
  handover_area     text,
  location_name     text,
  location_summary  text,
  area_number       text,
  area_name         text,
  area_summary      text,
  facility_number   text,
  facility_name     text,
  facility_summary  text,
  project_number    text,
  project_name      text,
  project_summary   text,
  is_malformed      boolean NOT NULL DEFAULT false,
  load_id           bigint
);

COMMENT ON TABLE ref_ha_guide IS
  'sources/l0_abs_guide.csv — the pbix ''HA l0_abs_guide''. Keyed on Location Number, which joins to weld.pds_area. Supplies branch 3 of the HA calculated column, replacing migration 0027''s label-based stand-in. Read with QuoteStyle.None as the pbix does: the first two fields never contain commas, and rows that do not split into exactly 13 keep those two and set is_malformed.';

COMMENT ON COLUMN ref_ha_guide.is_malformed IS
  'The row did not split into 13 comma-separated fields (embedded or unbalanced quotes). Handover Area and Location Number are still correct; the descriptive columns are NULL. Marked rather than dropped, so the count is visible.';

CREATE INDEX IF NOT EXISTS ref_ha_guide_ha ON ref_ha_guide (handover_area);
