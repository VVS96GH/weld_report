-- 0037 — `flange.ha` gains the `HA l0_abs_guide` fallback.
--
-- WHY ------------------------------------------------------------------------
-- RF-03 left 6,593 flange joints (1.84 %) with a blank HA: their `[System]` is
-- empty or `System-NA`, and the DAX's fallback —
-- `LOOKUPVALUE('HA l0_abs_guide'[Handover Area], … , [PDS Area])` — could not be
-- implemented because that workbook was not in `sources/`. The blank got its own
-- row and its own filter option rather than being folded into HA1.
--
-- `sources/l0_abs_guide.csv` arrived and is loaded into `ref_ha_guide`
-- (migration 0031); migration 0032 already applied the same lookup to
-- `mv_joint.ha`. This applies it to `flange`, which carries `pds_area` too.
--
-- Effect, against the report owner's own HA × Sub-contractor matrix:
--
--   HA1 Required   145,839 -> 148,076   (owner 148,091)
--     CCC           42,075 ->  58,057   (owner  58,057) exact
--     MEDGULF        5,715 ->   7,522   (owner   7,522) exact
--     TEKFEN        30,309 ->  52,351   (owner  52,351) exact
--   blank            6,593 ->      65
--
-- 65 joints still resolve to nothing: they have no `pds_area` the guide knows.
-- They keep a NULL `ha` and their own row, exactly as RF-03 intends — a guessed
-- handover area would be worse than an admitted blank.
--
-- Written as an UPDATE rather than a loader-only change so an existing database
-- does not need a 363k-row reload; `scripts/load-flange.ts` applies the same
-- rule at load time, so the two agree after any reload.

UPDATE flange f
   SET ha = g.handover_area
  FROM ref_ha_guide g
 WHERE f.ha IS NULL
   AND g.location_number = f.pds_area
   AND g.handover_area ~ '^HA[1-4]$';

COMMENT ON COLUMN flange.ha IS
  'Handover area. Derived from [System] as RF-03 describes, then from PDS Area through ref_ha_guide (the pbix HA l0_abs_guide fallback, migrations 0031/0037). Still NULL for 65 joints the guide does not know; those keep their own row and filter option rather than being folded into HA1.';
