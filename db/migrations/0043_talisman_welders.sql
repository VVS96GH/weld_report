-- 0043 — `ref_talisman_welder`: the Talisman "Joint ID+Welder ID" keys, for the
-- Errors page check "Different Welder ID Date Status Talisman and Welder Record"
-- (pbix page "Err 6 CCC").
--
-- The pbix M splits WELDER ID 1..4 on "/" (trimmed) and expands them into rows;
-- `WELDER ID ALL` = WELDER ID 4 when it is not blank, else WELDER ID 1, and the
-- key is `Joint ID & "-" & WELDER ID ALL`. One row here per distinct key. A blank
-- WELDER ID ALL ("No Welder" in the pbix) is not stored.
CREATE TABLE IF NOT EXISTS ref_talisman_welder (
  joint_id   text NOT NULL,
  welder_id  text NOT NULL,
  load_id    bigint,
  PRIMARY KEY (joint_id, welder_id)
);
COMMENT ON TABLE ref_talisman_welder IS
  'Joint.csv (TALISMAN DATA) Joint ID + WELDER ID ALL keys, D-flag rows dropped, one row per distinct key. WELDER ID ALL = W4 if not blank else W1, after the M''s split of WELDER ID 1..4 on "/".';
