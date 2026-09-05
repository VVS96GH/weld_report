-- 0006 — the per-method long view and the weekly materialised view (§6.4, §6.5).

-- ------------------------------------------------------------- nde_result ---
-- The dump repeats an identical 10-14 column block per inspection/treatment
-- method.  This unpivots them so the generic "method progress" widgets
-- (MT/PT Done, MPI Done — M70/M71) do not need ten wide column groups.
--
-- Deviation from the §6.4 sketch, deliberate: the sketch passes NULL for the
-- PWHT/MT/PT acc_rej and pct columns; the dump actually carries `<M> Acc/Rej`
-- and `<M>%` for every method, so they are selected rather than nulled.  FN is
-- absent because all ten FN columns are empty in every record (profile §8.3) and
-- therefore do not exist in `weld`.
--
-- Keep the RT and PWHT page queries on the WIDE table: M45-M49 mix RT and PWHT
-- predicates within a single row, which a long view would force into a self-join.
CREATE OR REPLACE VIEW nde_result AS
SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no,
       'RT'::text AS method, rt_pct AS pct, rt_weld_status AS weld_status,
       rt_date AS done_date, rt_report AS report, rt_acc_rej AS acc_rej
FROM weld
UNION ALL SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no, 'UT',   ut_pct,   ut_weld_status,   ut_date,   ut_report,   ut_acc_rej   FROM weld
UNION ALL SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no, 'PWHT', NULL,     pwht_weld_status, pwht_date, pwht_report, pwht_acc_rej FROM weld
UNION ALL SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no, 'HT',   ht_pct,   ht_weld_status,   ht_date,   ht_report,   ht_acc_rej   FROM weld
UNION ALL SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no, 'MT',   mt_pct,   mt_weld_status,   mt_date,   mt_report,   mt_acc_rej   FROM weld
UNION ALL SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no, 'PMI',  pmi_pct,  pmi_weld_status,  pmi_date,  pmi_report,  pmi_acc_rej  FROM weld
UNION ALL SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no, 'PT',   pt_pct,   pt_weld_status,   pt_date,   pt_report,   pt_acc_rej   FROM weld
UNION ALL SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no, 'PADLT', NULL,    padlt_weld_status, padlt_date, padlt_report, padlt_acc_rej FROM weld
UNION ALL SELECT id, source, load_id, joint_id, spool_id, sub_contractor, weld_cat, weld_type,
       weld_date, weldpoint_no, 'ORIF', NULL,     orif_weld_status, orif_date, orif_report, orif_acc_rej FROM weld;

-- ------------------------------------------------------ mv_weekly_progress ---
-- Ruling: §6.5 says the only workload that must be materialised is the weekly
-- trend (M06 and every CUM… line), because each of the 14 weeks would otherwise
-- rescan the fact table.  Everything else stays live.
--
-- The FILTER predicates below are the metric definitions from §2 VERBATIM, not
-- the §6.5 sketch.  Each flag names its measure.
--
-- SHAPE, and why it is not the obvious one: the sketch writes eleven
-- `count(DISTINCT joint_id) FILTER (…)` aggregates side by side.  Postgres
-- executes multiple DISTINCT aggregates with one tuplesort PER AGGREGATE PER
-- GROUP, so that form sorts ~958k joint ids eleven times and the refresh
-- dominates the load.  Collapsing to one row per (group, joint) first with
-- bool_or(), then counting those rows, is exactly equivalent — a joint is in the
-- bucket iff ANY of its rows satisfies the predicate — and runs as two hash
-- aggregates.
--
-- TWO THINGS THE CONSUMER MUST KNOW:
--  1. The joint counts are NOT additive across rows.  A joint that appears in two
--     weeks (a repair welded later) is counted in both.  Sum them across weeks and
--     you get a wrong total; re-aggregate from `weld` instead.
--  2. The JOIN to calendar drops rows with no weld_date.  That matches M01/M05/M06,
--     but M12 (rejected joints) has no weld-date predicate in the DAX, so
--     `rejected` here is "rejected AND welded" and is a lower bound on the live M12.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_progress AS
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
                      AND (w.rt_weld_status IS NULL OR w.rt_weld_status = 'S')) ))
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

-- NULLS NOT DISTINCT: weld_cat / weld_type are nullable and week_end_date is NULL
-- for the tail week, and REFRESH … CONCURRENTLY needs the key to actually be unique.
CREATE UNIQUE INDEX IF NOT EXISTS mv_weekly_progress_key
  ON mv_weekly_progress (week_end_date, source, sub_contractor, weld_cat, weld_type)
  NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS mv_weekly_progress_week ON mv_weekly_progress (week_end_date);
