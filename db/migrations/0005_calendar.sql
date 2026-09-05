-- 0005 — populate `calendar` for 2021-05-08 .. 2026-12-31 (1,999 days).
--
-- Reproduces the pbix `Calendar` table's calculated columns verbatim
-- (analysis/pbix/measures.md -> Table `Calendar`):
--
--   Weekday         = IF(WEEKDAY([Date])<=6, WEEKDAY([Date])+1, WEEKDAY([Date])-6)
--                     WEEKDAY() default is Sun=1..Sat=7, so this maps Sat->1 .. Fri->7:
--                     the report's weeks run Saturday -> Friday.
--   Weeknum         = COUNT of rows with Weekday=1 and Date <= this date
--                     The calendar starts on 2021-05-08, which IS a Saturday, so this
--                     is exactly floor((date - '2021-05-08')/7) + 1.
--   Week_Start_Date = MIN(Date) where Weekday=1 and same Weeknum   -> that Saturday
--   Week_End_Date   = MAX(Date) where Weekday=7 and same Weeknum   -> that Friday
--                     2026-12-31 is a Thursday, so the final week (from Sat 2026-12-26)
--                     contains NO Friday and its Week_End_Date is BLANK in DAX.  That is
--                     reproduced as NULL rather than silently rounded up to 2027-01-01.
--   Month           = FORMAT([Date],"MMM-yy")
--   YEAR            = FORMAT([Date],"yyyy")

INSERT INTO calendar (date, weekday, weeknum, week_start_date, week_end_date, month, year)
SELECT
  d::date                                                              AS date,
  wd                                                                   AS weekday,
  (((d::date - DATE '2021-05-08') / 7) + 1)::integer                   AS weeknum,
  (d::date - (wd - 1))                                                 AS week_start_date,
  CASE WHEN (d::date - (wd - 1) + 6) <= DATE '2026-12-31'
       THEN (d::date - (wd - 1) + 6) END                               AS week_end_date,
  to_char(d, 'Mon-YY')                                                 AS month,
  extract(year FROM d)::smallint                                       AS year
FROM generate_series(DATE '2021-05-08', DATE '2026-12-31', INTERVAL '1 day') AS g(d)
CROSS JOIN LATERAL (
  SELECT CASE WHEN extract(dow FROM g.d) = 6 THEN 1
              ELSE (extract(dow FROM g.d) + 2)::int END AS wd
) AS w
ON CONFLICT (date) DO NOTHING;
