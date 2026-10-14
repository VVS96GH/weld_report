-- 0044 — `TALISMAN DATA[WPS CODE]` for the Errors page check "Discrepancy WPS CCC
-- PIC & Talisman True/False Status" (pbix page "Err 9 WPS PIC & Tal.n Tr/Fl").
--
-- MAX per joint, as `WPS From "Talisman"` = MAXX(FILTER('TALISMAN DATA', Joint ID)).
-- An empty WPS CODE is stored '' (not NULL): the pbix reads Joint.csv with
-- Csv.Document, so an empty cell is the empty string, ISBLANK("") is FALSE and
-- the joint's status is FALSE against a filled WPS No. NULL = no Talisman row.
ALTER TABLE ref_talisman_joint ADD COLUMN IF NOT EXISTS wps_code text;
