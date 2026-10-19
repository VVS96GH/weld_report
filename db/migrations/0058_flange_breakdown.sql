-- 0058 — "CUM Trend Flange Progress Break Down Rate %.xlsx", sheet Fl.BreakDown:
-- the pbix table `Flange BreakDown` (owner, 2026-10-19). One row per week and
-- sub-contractor; the project rate repeats on each of the week's rows, and the
-- pbix line "Leaked Flange Break %" plots its average per Date. Loaded by
-- scripts/load-flange-breakdown.ts; fractions as in the workbook (0.0025 = 0.25 %).
CREATE TABLE IF NOT EXISTS flange_breakdown (
  week_date      date    NOT NULL,
  sub_contractor text    NOT NULL,
  rate           numeric,
  project_rate   numeric,
  PRIMARY KEY (week_date, sub_contractor)
);
