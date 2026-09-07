-- 0028 — `ref_ha_area`: the pbix's own (HA, Area Classification) slicer pairs.
--
-- WHY ------------------------------------------------------------------------
-- Page 1's slicer is the pbix two-field hierarchy "HA, Area Classification".
-- Until now the child lists were derived from the OBSERVED cross-tab in
-- `mv_joint` — which can only ever show pairs our data happens to contain, and
-- silently omits any the report offers but we have no joints for.
--
-- `sources/HA.csv` (41 rows) is the hierarchy itself, and it is MANY-TO-MANY:
-- `Train-9 Process` sits under BOTH HA2 and HA3, `Train-10 Process` under HA3
-- and HA4, `Intercon PR HA-3` under HA3 and HA4, and so on. No single-valued
-- `ha` column can express that, which is why the pairs need a table of their
-- own rather than another derived column.
--
-- WHAT THIS DOES NOT FIX ------------------------------------------------------
-- It supplies the slicer's LISTS, not a joint's HA. In the pbix a joint's HA
-- comes from `PDS Area` through `HA l0_abs_guide`, which is still not in
-- `sources/`; migration 0027's label-based derivation remains a documented
-- approximation, and the many-to-many mapping proves it must be one — a label
-- alone cannot decide between HA2 and HA3. The PDS Area guide is still wanted.
--
-- CONSEQUENCE, deliberately accepted: a pair the file lists but our derived
-- `ha` yields no joints for (HA3 ▸ Train-9 Process, say) stays SELECTABLE and
-- renders honest-empty. That is the correct behaviour — the report offers the
-- combination, so the page must too, and "no joints under this pairing with the
-- HA we derived" is a true answer worth showing rather than an option we hide.

CREATE TABLE IF NOT EXISTS ref_ha_area (
  ha                   text NOT NULL,
  area_classification  text NOT NULL,
  load_id              bigint,
  PRIMARY KEY (ha, area_classification)
);

COMMENT ON TABLE ref_ha_area IS
  'sources/HA.csv — the pbix (HA, Area Classification) slicer hierarchy, 41 pairs. MANY-TO-MANY: one area can sit under two HAs (Train-9 Process is under HA2 and HA3). Supplies the slicer''s child lists ONLY; a joint''s own HA is still derived by migration 0027 from area labels, an approximation standing in for the absent HA l0_abs_guide PDS-Area lookup.';

CREATE INDEX IF NOT EXISTS ref_ha_area_ha ON ref_ha_area (ha);

-- The `load` ledger vocabulary gains this file's source and the Talisman
-- joint export's (migration 0029). Re-stated in full, as 0015 and 0022 do:
-- a CHECK cannot be extended in place.
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
  'HA_GUIDE', 'HA_L0_GUIDE', 'TALISMAN_JOINT'
));
