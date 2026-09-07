-- 0030 — `mv_weekly_progress` gains the HA and Area Classification dimensions.
--
-- Re-creates the view from 0011's text; every measure expression is unchanged.
-- ALWAYS READ THE HIGHEST-NUMBERED DEFINITION: 0006, 0007, 0011 and this one.
--
-- WHY ------------------------------------------------------------------------
-- Page 1's slicer bar filters five dimensions, but the Welding Progress Trend
-- reads this view, which carried only three of them. With `ha` or `area` set the
-- KPIs moved and the trend did not — it silently showed unfiltered weeks beside
-- filtered cards, which is the fabricated-consistency failure this project rules
-- out everywhere else.
--
-- WHY THIS AND NOT A SECOND QUERY PATH ---------------------------------------
-- The alternative was to compute the filtered trend straight from `mv_joint`
-- with its own week bucketing. That means two implementations of one chart,
-- diverging the first time either is touched. This view is 10,771 rows; adding
-- two grouping columns is cheap and keeps `weeklyProgress` a single function
-- that filters whatever columns it is given.
--
-- `ha` / `area_classification_label` are JOINED FROM `mv_joint`, not re-derived.
-- HA is itself a computed column (0026 + 0027's l0_abs_guide stand-in) and a
-- second copy of that rule would drift — the one thing that must not happen
-- between a page's cards and its chart.
--
-- TOTALS ARE UNCHANGED: grouping more finely cannot alter a SUM or a COUNT over
-- the same rows, and the LEFT JOIN cannot drop any (mv_joint has a row per
-- (source, joint_id) that `weld` has). Verified by comparing the unfiltered
-- 10-week series before and after.

DROP MATERIALIZED VIEW IF EXISTS mv_weekly_progress;

CREATE MATERIALIZED VIEW mv_weekly_progress AS
WITH per_joint AS (
  SELECT
    c.week_end_date,
    w.source,
    w.sub_contractor,
    w.weld_cat,
    w.weld_type,
    -- The page-1 HA / Area slicers. Taken from `mv_joint`, NOT re-derived here:
    -- HA is a computed column (migrations 0026/0027) and a second copy of that
    -- rule could drift, which would make the filtered trend silently disagree
    -- with the KPIs above it.
    j.ha,
    j.area_classification_label,
    w.joint_id,

    -- M01/M02 [Welded Joint ID Uniq "EP"]: Repair & Reweld = "" and Weld Date > 0
    bool_or(w.repair_reweld = '' AND w.weld_date IS NOT NULL)             AS f_welded,

    -- M03 [Joint Uniq "PR all" Welded & R/RW]: Weld Date > 0 only
    bool_or(w.weld_date IS NOT NULL)                                      AS f_welded_incl_repairs,

    -- M10 [Numb RT/UT]: Weld Date > 0, RT Report <> "", RT Acc/Rej <> "RS".
    -- `<> "RS"` is TRUE when blank (§0.2) -> IS DISTINCT FROM, never <>.
    -- A literal 'NA' in rt_report IS a report as far as this measure is concerned.
    bool_or(w.weld_date IS NOT NULL AND w.rt_report IS NOT NULL
            AND w.rt_acc_rej IS DISTINCT FROM 'RS')                       AS f_tested,

    -- M12 [Numb RT/UT "R"]: RT Acc/Rej = "R".  No weld-date, no RT-report predicate.
    bool_or(w.rt_acc_rej = 'R')                                           AS f_rejected,

    -- M40 [RT 5 10 20 100% B.log Joints Weld Status "EP"], written as the OR form
    -- its "PR all" twin uses.  Status list verbatim from §0.6; 'T1-2S'/'T1-2' can
    -- never occur because the load applies the M's replace(RT Weld Status,'T1-2','T1'),
    -- and they stay in the list only so it remains diffable against the DAX.
    bool_or(w.weld_type IN ('BW','GW','CLET','MW')
            AND w.weld_date IS NOT NULL
            AND w.rt_report IS NULL
            AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S',
                                       'T1-2S','T2','T3','T2-1','T2-1S','T2-2S','T2S')
                  OR (w.rt_pct = 100
                      AND (w.rt_weld_status IS NULL
                           OR w.rt_weld_status IN ('?','S'))) ))
                                                                          AS f_rt_backlog,

    -- M42 [RT 100% Backlog Joints Weld Status "EP"]
    bool_or(w.weld_type IN ('BW','GW','CLET','MW') AND w.rt_pct = 100
            AND w.weld_date IS NOT NULL AND w.rt_report IS NULL)          AS f_rt100_backlog,

    -- M60 [PWHT Backlog Weld Status All Weld Types "EP"] — the "EP" list omits 'HS CCC'
    bool_or(w.pwht_weld_status IN ('H','HS','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                   'T2','T3','T2-1','T2-1S','T2-2S','T2S')
            AND w.pwht_report IS NULL)                                    AS f_pwht_backlog,

    -- M65 [PWHT Done All Weld Types "EP"] (coalesced with the CCC report column)
    bool_or(coalesce(w.pwht_report, w.pwht_report_no_ccc) IS NOT NULL)    AS f_pwht_done,

    -- Sums are additive, so they aggregate straight through.
    -- M20 [RT Total Films by Joint "EP"]: WeldPoint No. = 1 and RT Acc/Rej <> "RS"
    sum(w.rt_film_total) FILTER (
      WHERE w.weldpoint_no = 1 AND w.rt_acc_rej IS DISTINCT FROM 'RS')    AS films_taken,
    -- M21 [RT Total Films by Joint "A" "EP"]: same two filters, Acc column
    sum(w.total_no_of_films_acc) FILTER (
      WHERE w.weldpoint_no = 1 AND w.rt_acc_rej IS DISTINCT FROM 'RS')    AS films_accepted,
    -- M22 [RT Total Films by Joint "R" "EP"]: WeldPoint No. = 1 ONLY — no <> "RS"
    sum(w.total_no_of_films_rej) FILTER (
      WHERE w.weldpoint_no = 1)                                           AS films_rejected,
    -- M33/M34 backing sums, in metres
    sum(w.weld_length)                                                    AS weld_length_m,
    sum(w.rej_length)                                                     AS rej_length_m,
    count(*)                                                              AS rows_in_joint
  FROM weld w
  JOIN calendar c ON c.date = w.weld_date
  LEFT JOIN mv_joint j ON j.source = w.source AND j.joint_id = w.joint_id
  WHERE NOT w.is_cancelled          -- belt and braces: ruling R-02 already excluded them
  GROUP BY c.week_end_date, w.source, w.sub_contractor, w.weld_cat, w.weld_type,
           j.ha, j.area_classification_label, w.joint_id
)
SELECT
  week_end_date,
  source,
  sub_contractor,
  weld_cat,
  weld_type,
  ha,
  area_classification_label,
  count(*) FILTER (WHERE f_welded)                AS joints_welded,              -- M01/M02
  count(*) FILTER (WHERE f_welded_incl_repairs)   AS joints_welded_incl_repairs, -- M03
  count(*) FILTER (WHERE f_tested)                AS tested,                     -- M10
  count(*) FILTER (WHERE f_rejected)              AS rejected,                   -- M12
  count(*) FILTER (WHERE f_rt_backlog)            AS rt_backlog,                 -- M40
  count(*) FILTER (WHERE f_rt100_backlog)         AS rt100_backlog,              -- M42
  count(*) FILTER (WHERE f_pwht_backlog)          AS pwht_backlog,               -- M60
  count(*) FILTER (WHERE f_pwht_done)             AS pwht_done,                  -- M65
  sum(films_taken)                                AS films_taken,                -- M20
  sum(films_accepted)                             AS films_accepted,             -- M21
  sum(films_rejected)                             AS films_rejected,             -- M22
  sum(weld_length_m)                              AS weld_length_m,
  sum(rej_length_m)                               AS rej_length_m,
  count(*)                                        AS joints_in_group,
  sum(rows_in_joint)                              AS rows_in_group
FROM per_joint
GROUP BY week_end_date, source, sub_contractor, weld_cat, weld_type,
         ha, area_classification_label
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_weekly_progress_key
  ON mv_weekly_progress (week_end_date, source, sub_contractor, weld_cat, weld_type,
                         ha, area_classification_label)
  NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS mv_weekly_progress_week ON mv_weekly_progress (week_end_date);
