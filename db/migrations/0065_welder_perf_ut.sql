-- 0065 — the UT Rej.Summary page (owner, 2026-11-02): the "UT CUM FILE Welders Performance … 2 Weeks
-- Since UT Date" workbook joins ref_welder_perf_cum, and its notes welder_perf_note, as kind 'ut2w'.
ALTER TABLE ref_welder_perf_cum DROP CONSTRAINT IF EXISTS ref_welder_perf_cum_kind_check;
ALTER TABLE ref_welder_perf_cum ADD CONSTRAINT ref_welder_perf_cum_kind_check CHECK (kind IN ('2w', '1m', 'ut2w'));
ALTER TABLE welder_perf_note DROP CONSTRAINT IF EXISTS welder_perf_note_kind_check;
ALTER TABLE welder_perf_note ADD CONSTRAINT welder_perf_note_kind_check CHECK (kind IN ('2w', '1m', 'ut2w'));
