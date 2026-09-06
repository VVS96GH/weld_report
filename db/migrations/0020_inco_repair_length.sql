-- 0020 — `weld.repair_length_mm`: the last input the "PR all" UT defect length needs.
--
-- NUMBERING: the orchestrator's brief said 0018, but 0018 and 0019 were taken by
-- the metrics lane (`0018_ut_lengths_prall.sql`, `0019_ut_weld_length_no_inco.sql`)
-- between the brief and this migration. 0020 is the next free number.
--
-- WHY ------------------------------------------------------------------------
-- `[UT Defect Length by Joint "PR all"]` (M34) sums `[Defect Length(MM).]`, whose
-- four branches are:
--
--   Inco && [Manual UT Report No.] <> ""  ->  [Repair Length (mm)] / 1000
--   [Manual UT Report No.] <> "" && [By UT] = "Y"  ->  [Rej Length]
--   [Manual UT Status.] = "R" && Sub = "CCC"       ->  the CCC tracker lookup
--   else                                            ->  0
--
-- The first branch has been BLOCKED since batch 3: `Repair Length (mm)` is
-- column 27 of the Inco sheet and `analysis/sources3/inco-column-map.md` records
-- it as having "no `weld` column". `0019_ut_weld_length_no_inco.sql` therefore
-- leaves that branch NULL — never 0, which would silently understate the measure —
-- and counts the affected rows in `ut_defect_length_prall_inco_gap` so the page
-- can say so. This column unblocks it.
--
-- UNITS AND SCOPE ------------------------------------------------------------
-- MILLIMETRES, as the source column's own name says, and as `weld.weld_length`
-- already is for Inco. The DAX divides by 1000 at read time; the loader does NOT
-- pre-divide, so the stored value stays the source's.
--
-- NULL for every other source: no other register carries a repair length. That is
-- absence, not zero — `0` on this column means "a repair of zero length was
-- recorded", which is what 10,219 of the 10,327 Inco rows actually say.
--
-- Distinct from `weld.defect_length_mm` (0012), which is the MATERIALISED DAX
-- result across all four branches. This one is a raw source column feeding it.
--
-- Nullable with no default, so this does not rewrite the 6.5 M-row table.

ALTER TABLE weld ADD COLUMN IF NOT EXISTS repair_length_mm numeric(12,3);

COMMENT ON COLUMN weld.repair_length_mm IS
  'Inco `Repair Length (mm)`, in MILLIMETRES. NULL for every other source (none carries it) — absence, not zero. Feeds the Inco branch of [Defect Length(MM).], which divides by 1000 at read time. Not to be confused with defect_length_mm, the materialised DAX result.';
