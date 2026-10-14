-- 0040 — `ref_talisman_joint.size_sum`: the `Dia` column of the Errors page check
-- "Different Weld Date Status Talisman and Welder Record and Joint Record"
-- (pbix page "Err 3 CCC", visual tableEx, value `Sum(TALISMAN DATA[SIZE])`).
--
-- WHY A SUM, NOT THE SIZE. `TALISMAN DATA` is not one row per joint in the pbix:
-- its M splits WELDER ID 1..4 on "/" and EXPANDS each into rows, so a joint
-- welded by "W-017/W-019" in all four columns becomes 2^4 = 16 rows, and the
-- visual's Sum(SIZE) counts its size 16 times. SIZE is typed Int64 in the M
-- (banker's rounding: 0.75 -> 1, 0.5 -> 0). The loader reproduces both, so
-- `size_sum` = Σ over file rows of round_half_even(SIZE) × Π parts(WELDER ID k).
ALTER TABLE ref_talisman_joint ADD COLUMN IF NOT EXISTS size_sum numeric;

COMMENT ON COLUMN ref_talisman_joint.size_sum IS
  'Sum(TALISMAN DATA[SIZE]) as the pbix computes it: SIZE as Int64 (half-to-even), times the rows the M creates by splitting WELDER ID 1..4 on "/". Errors page, check "Different Weld Date Status", column Dia.';
