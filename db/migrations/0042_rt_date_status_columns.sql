-- 0042 — columns for the Errors page check "Different RT Date Status Talisman
-- and Welder Record and Joint Record" (pbix page "Err 4 CCC").
--
-- ccc_joint_pwht: the joint record's `RT/UT Date` and `RT/UT Report No`, MAX per
-- joint, as `TALISMAN DATA[RT Date / RT Report from Joint Record]` read them
-- (MAXX over the joint record for the Joint ID).
-- ref_talisman_joint: `UT1 REP NO`, and `RT1 TOTAL FILM NO` of the joint's first
-- file row — the pbix measure sums it under `WeldPoint No.1 WP1 = 1`, i.e. once
-- per joint, not once per expanded welder row.
ALTER TABLE ccc_joint_pwht ADD COLUMN IF NOT EXISTS rt_ut_date date;
ALTER TABLE ccc_joint_pwht ADD COLUMN IF NOT EXISTS rt_ut_report_no text;
ALTER TABLE ref_talisman_joint ADD COLUMN IF NOT EXISTS ut1_rep_no text;
ALTER TABLE ref_talisman_joint ADD COLUMN IF NOT EXISTS rt1_films numeric;
