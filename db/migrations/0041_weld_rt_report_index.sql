-- 0041 — index on weld.rt_report for the Errors page.
--
-- The "one joint in several reports" check counts joints per report for the
-- handful of reports its offending joints carry; without an index each of those
-- lookups is a 6.5 M-row scan (the page's first render took 24 s). Partial: blank
-- reports are never looked up by value.
CREATE INDEX IF NOT EXISTS weld_rt_report ON weld (rt_report) WHERE rt_report IS NOT NULL;
ANALYZE weld;
