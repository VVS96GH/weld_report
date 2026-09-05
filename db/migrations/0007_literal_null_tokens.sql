-- 0007 — literal "null-looking" tokens are KEPT, not nulled.
--
-- SUPERSEDES two things from earlier migrations; both are re-created here rather
-- than edited in place so an already-migrated database converges with a plain
-- `npm run db:migrate` and no checksum warning:
--   * 0001_bookkeeping.sql  -> weld_text()
--   * 0006_views.sql        -> mv_weekly_progress (its M40 branch)
--
-- WHY.  weld_text() used to null 'NA', 'N/A', '?' and '#N/A' as well as ''.  The
-- pbix does not do that.  Its M code replaces "NA" with "" in exactly six columns
-- — Preheat Date, Weld Date, Cutting Date, Beveling Date, Fitup Date, MIR Date
-- (analysis/pbix/model.md lines 3661-3666) — and nowhere else, and the DAX then
-- relies on the literals surviving everywhere else:
--
--   [RT Report] <> ""                counts a literal 'NA' as TESTED
--   [RT Weld Status] IN {"?","","S"} matches a literal '?'
--
-- Measured cost of the old behaviour on the live load: M10 (Numb RT/UT) came out
-- at GAC 38,759 / TEKFEN 23,128 against the reference 38,761 / 23,130 — exactly the
-- 2 + 2 rows where `rt_report IN ('NA','N/A')`.
--
-- Those six date columns are unaffected either way: weld_to_date() already returns
-- NULL for anything that is not dd-MMM-yyyy.  The loader emits the M's
-- replace(x,'NA','') on them regardless, so the step list is traceable in the SQL.

-- Only '' is absent.  btrim() stays: profile.md §8.3 shows 20 columns with
-- leading/trailing whitespace, and §6.2 explicitly wants 'No ' and 'No' in
-- hold_status to be one state.
CREATE OR REPLACE FUNCTION weld_text(v text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT nullif(btrim(v), '')
$$;

-- Re-create the matview: its M40 second branch must now match a literal '?'.
-- analysis/calculation-logic.md §0.2:  [X] IN {"?","","S"}  ->  (x IS NULL OR x IN ('?','S'))
DROP MATERIALIZED VIEW IF EXISTS mv_weekly_progress;

CREATE MATERIALIZED VIEW mv_weekly_progress AS
WITH per_joint AS (
  SELECT
    c.week_end_date,
    w.source,
    w.sub_contractor,
    w.weld_cat,
    w.weld_type,
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
  WHERE NOT w.is_cancelled          -- belt and braces: ruling R-02 already excluded them
  GROUP BY c.week_end_date, w.source, w.sub_contractor, w.weld_cat, w.weld_type, w.joint_id
)
SELECT
  week_end_date,
  source,
  sub_contractor,
  weld_cat,
  weld_type,
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
GROUP BY week_end_date, source, sub_contractor, weld_cat, weld_type
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_weekly_progress_key
  ON mv_weekly_progress (week_end_date, source, sub_contractor, weld_cat, weld_type)
  NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS mv_weekly_progress_week ON mv_weekly_progress (week_end_date);
