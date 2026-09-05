-- 0013 — mv_joint: the joint-grain rollup every page pivot reads.
--
-- AUTHORED BY METRICS-LANE (exception to file ownership, by orchestrator
-- ruling). DB-LANE does not edit this file; the loaders only REFRESH it.
--
-- WHY -----------------------------------------------------------------------
-- `weld` is weld-pass grain: 6.5 M rows over 2,370,428 joints (CCC alone is
-- 5,432,993 rows over 1,339,099 joints — ~4.06 rows per joint, ruling R2-01).
-- Every headline measure is `DISTINCTCOUNT(Joint ID)` with row-level filters,
-- so each page pivot ran a dozen `count(DISTINCT joint_id)` aggregates over
-- millions of rows and Postgres sorted the joint ids once per aggregate per
-- group. Measured at 6.5 M rows: page 1 = 20.8 s, page 2 = 30.8 s,
-- page 3 = 22.0 s. `analysis/calculation-logic.md` §6.5 predicted exactly this
-- and prescribed materialisation for the project pages.
--
-- HOW IT PRESERVES THE NUMBERS ----------------------------------------------
-- DAX evaluates each filter at ROW level and then counts distinct joints. So a
-- joint is counted iff ANY of its rows satisfies the filter — which is exactly
-- `bool_or(<row predicate>)`. Every boolean below is that translation, one per
-- measure predicate in `lib/metrics/*`, and every `count(DISTINCT joint_id)
-- FILTER (WHERE p)` becomes `count(*) FILTER (WHERE flag)`.
-- Additive values (films, lengths, dia inch) stay sums: summing per joint and
-- then across joints is the same number.
--
-- The proof that the flags are right is that all 358 assertions of
-- `tests/metrics.test.ts` against `analysis/reconcile_results.json` still pass
-- bit-for-bit after the switch. Do not change a predicate here without running
-- that suite.
--
-- GRAIN CAVEAT, measured ----------------------------------------------------
-- One row per (source, joint_id) means each dimension must be single-valued
-- per joint. Measured on the live 6.5 M-row load: of 2,370,428 joints,
--   weld_cat 0 · service_cat 0 · service_class_cat_wd 0 · tmcp_pipe 0 ·
--   temporary_lines 0 · area_classification_label 0 · pds_area 0 · ha 0 ·
--   weld_type 1 · wps_no 1 · dia_inch_factor 1 · rt_pct 11 ·
--   service_class_cat_ndt 11
-- carry more than one value. `max()` picks one deterministically; the affected
-- joint appears in one pivot cell instead of two, against a 2.37 M population.
-- The per-RT% and per-weld-type pins in tests/metrics.test.ts are what police
-- this — if one moves, the fix is to keep that single widget on `weld`.
--
-- REFRESH -------------------------------------------------------------------
-- `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_joint;` after every load and
-- after any `spool` reload (the FABRICATED flags embed the spool join). The
-- UNIQUE index below is what CONCURRENTLY requires.

DROP MATERIALIZED VIEW IF EXISTS mv_joint;

CREATE MATERIALIZED VIEW mv_joint AS
SELECT
  w.source,
  w.joint_id,

  -- ── dimensions (single-valued per joint; see the caveat above) ───────────
  max(w.spool_id)                  AS spool_id,
  max(w.sub_contractor)            AS sub_contractor,
  max(w.weld_cat)                  AS weld_cat,
  max(w.weld_type)                 AS weld_type,
  max(w.rt_pct)                    AS rt_pct,
  max(w.service_cat)               AS service_cat,
  max(w.service_class_cat_wd)      AS service_class_cat_wd,
  max(w.service_class_cat_ndt)     AS service_class_cat_ndt,
  bool_or(w.tmcp_pipe)             AS tmcp_pipe,
  bool_or(w.temporary_lines)       AS temporary_lines,
  max(w.dia_inch_factor::text)     AS dia_inch_factor,
  max(w.wps_no)                    AS wps_no,
  max(w.ha)                        AS ha,
  max(w.area_classification_label) AS area_classification_label,
  max(w.pds_area)                  AS pds_area,

  -- The aging clock. `analysis/reconcile_check.py` ages a backlog joint from
  -- its LATEST weld date, and that is the only reading under which the M51/M66
  -- buckets sum to the backlog total (calculation-logic §4.3).
  -- `weld_date` is the max over ALL of the joint's rows. The aging buckets must
  -- NOT use it: `analysis/reconcile_check.py` ages a backlog joint from the
  -- latest weld date among its BACKLOG rows, and a joint can carry a later
  -- non-backlog row. Each backlog family therefore gets its own clock.
  max(w.weld_date)                 AS weld_date,
  -- M05 "Welding Status for this Week" counts M01, which excludes repairs, so
  -- the week filter must age on the non-repair rows only.
  max(w.weld_date) FILTER (
    WHERE coalesce(w.repair_reweld,'') = '')                             AS weld_date_norepair,
  max(w.weld_date) FILTER (WHERE w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) ))                                AS rt_backlog_weld_date,
  max(w.weld_date) FILTER (WHERE w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) ))                                AS rt_backlog_prall_weld_date,
  max(w.weld_date) FILTER (
    WHERE w.pwht_weld_status IN ('H','HS','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                 'T2','T3','T2-1','T2-1S','T2-2S','T2S')
      AND w.pwht_report IS NULL)                                         AS pwht_backlog_weld_date,
  max(w.weld_date) FILTER (
    WHERE w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                 'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
      AND w.pwht_report IS NULL)                                         AS pwht_backlog_prall_weld_date,
  -- The PWHT-by-RT% pages carry the extra filter "PWHT Weld Status not blank".
  bool_or(w.pwht_weld_status IS NOT NULL)                                AS has_pwht_status,

  -- ── welding (M01, M03, M70, M71) ────────────────────────────────────────
  bool_or(coalesce(w.repair_reweld,'') = '' AND w.weld_date IS NOT NULL) AS is_welded_norepair,
  bool_or(w.weld_date IS NOT NULL)                                       AS is_welded,
  bool_or(w.weld_date IS NOT NULL AND w.mt_report IS NOT NULL)           AS mt_done,
  bool_or(w.weld_date IS NOT NULL AND w.pt_report IS NOT NULL)           AS pt_done,
  sum(w.dia_inch) FILTER (
    WHERE coalesce(w.repair_reweld,'') = '' AND w.weld_date IS NOT NULL) AS dia_inch_welded,

  -- ── RT joints (M10, M11, M12) ───────────────────────────────────────────
  bool_or(w.weld_date IS NOT NULL AND w.rt_report IS NOT NULL
          AND w.rt_acc_rej IS DISTINCT FROM 'RS')                        AS is_tested_ep,
  bool_or(w.weld_date IS NOT NULL AND w.rt_report IS NOT NULL
          AND w.rt_acc_rej IS DISTINCT FROM 'RS'
          AND w.rt_acc_rej IS DISTINCT FROM 'U/Review')                  AS is_tested_prall,
  bool_or(w.rt_acc_rej = 'R')                                            AS is_rejected,
  -- M52's numerator: joints with an RT report, excluding re-shoots/review.
  bool_or(w.rt_report IS NOT NULL AND w.rt_acc_rej IS DISTINCT FROM 'RS'
          AND w.rt_acc_rej IS DISTINCT FROM 'U/Review')                  AS is_rt_reported,

  -- ── films, "EP" family (M20, M21, M22, M26) ─────────────────────────────
  -- `weldpoint_no = 1` is the dump's repair-attempt sequence.
  sum(w.rt_film_total) FILTER (
    WHERE w.weldpoint_no = 1 AND w.rt_acc_rej IS DISTINCT FROM 'RS')     AS films_wp1,
  sum(w.total_no_of_films_acc) FILTER (
    WHERE w.weldpoint_no = 1 AND w.rt_acc_rej IS DISTINCT FROM 'RS')     AS films_acc_wp1,
  -- M22: WeldPoint 1 only — deliberately NO `<> 'RS'` filter.
  sum(w.total_no_of_films_rej) FILTER (WHERE w.weldpoint_no = 1)         AS films_rej_wp1,
  -- M26: every weld point, deliberately unfiltered. Pinned at 180,034 for
  -- GAC non-SG, so it must stay ungated at "EP" scope.
  sum(w.rt_film_total) FILTER (WHERE w.rt_acc_rej IS DISTINCT FROM 'RS') AS films_all,
  sum(w.total_no_of_films_acc) FILTER (
    WHERE w.rt_acc_rej IS DISTINCT FROM 'RS')                            AS films_all_acc,
  sum(w.total_no_of_films_rej)                                           AS films_all_rej,

  -- ── films, "PR all" family (M23, M24, M26 gated) ────────────────────────
  -- The WP1 gate is per source: `weldpoint_seq` is the pbix `WeldPoint No.1
  -- WP1` row number and is populated for CCC only (NULL on every dump row), so
  -- a single predicate would zero the dump's film totals.
  ( coalesce(sum(w.rt_film_total) FILTER (
      WHERE (CASE w.source::text WHEN 'WELD_DUMP' THEN w.weldpoint_no = 1 ELSE w.weldpoint_seq = 1 END)
        AND w.rt_acc_rej IS DISTINCT FROM 'RS'
        AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'
        AND NOT w.exclude_ut_films AND NOT w.exclude_debris_films), 0)
  + coalesce(sum(w.rt_film_total) FILTER (
      WHERE w.weld_point_code IN ('R','H','F','C')
        AND w.rt_acc_rej IS DISTINCT FROM 'RS'
        AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'), 0)
  - coalesce(sum(w.rt_film_total) FILTER (
      WHERE (CASE w.source::text WHEN 'WELD_DUMP' THEN w.weldpoint_no = 1 ELSE w.weldpoint_seq = 1 END)
        AND w.weld_point_code IN ('R','H','F','C')
        AND w.rt_acc_rej IS DISTINCT FROM 'RS'
        AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'), 0)
  )                                                                      AS films_taken_prall,
  coalesce(sum(w.total_no_of_films_rej) FILTER (
    WHERE (CASE w.source::text WHEN 'WELD_DUMP' THEN w.weldpoint_no = 1 ELSE w.weldpoint_seq = 1 END)
      AND NOT w.exclude_ut_films
      AND w.rt_acc_rej IS DISTINCT FROM 'RS'
      AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'
      AND NOT w.exclude_debris_films), 0)                                AS films_rej_prall,
  coalesce(sum(w.rt_film_total) FILTER (
    WHERE (CASE w.source::text WHEN 'WELD_DUMP' THEN w.weldpoint_no = 1 ELSE w.weldpoint_seq = 1 END)
      AND w.rt_acc_rej IS DISTINCT FROM 'RS'), 0)                        AS films_all_prall,
  coalesce(sum(w.total_no_of_films_rej) FILTER (
    WHERE (CASE w.source::text WHEN 'WELD_DUMP' THEN w.weldpoint_no = 1 ELSE w.weldpoint_seq = 1 END)), 0)
                                                                         AS films_all_rej_prall,

  -- ── RT backlog, "EP" (M40, M42, M45, M46, M47) ──────────────────────────
  -- Branch A is the 16-code hold list; branch B is the RT%=100 / blank-status
  -- catch. §M40 rules OR, not the DAX's literal addition.
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
  )                                                                      AS rt_backlog,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.rt_pct = 100
    AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
  )                                                                      AS rt100_backlog,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND w.pwht_y_n IN ('Y','25.01') AND w.pwht_report IS NOT NULL
  )                                                                      AS rt_backlog_pwht_y_done,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND w.pwht_y_n IN ('N','25.01') AND w.pwht_weld_status IS NULL
  )                                                                      AS rt_backlog_pwht_n,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND w.pwht_y_n IN ('Y','25.01') AND w.pwht_weld_status IN ('H','HS') AND w.pwht_report IS NULL
  )                                                                      AS rt_backlog_pwht_y_not_done,

  -- ── RT backlog, "PR all" (M41, M43, and the CCC-aware PWHT combinations) ─
  -- The "PR all" hold list adds 'T1-2'. 'HS CCC' was already in the 16-code
  -- list and is what CCC's synthesised RT Weld Status emits on RT%=100 rows.
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
  )                                                                      AS rt_backlog_prall,
  -- M43 keys on RT Date being blank, not RT Report, and admits ?/blank/S.
  bool_or(
    w.weld_date IS NOT NULL AND w.rt_date IS NULL AND w.rt_pct = 100
    AND w.weld_type IN ('BW','GW','CLET','MW')
    AND ( w.rt_weld_status IS NULL
          OR w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                  'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2','?','S') )
  )                                                                      AS rt100_backlog_prall,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND ( (w.pwht_y_n IN ('Y','25.01') AND w.pwht_report IS NOT NULL)
          OR (w.pwht_y_n_ccc = 'Y' AND w.pwht_report_no_ccc IS NOT NULL) )
  )                                                                      AS rt_backlog_pwht_y_done_prall,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND ( (w.pwht_y_n IN ('N','25.01') AND w.pwht_weld_status IS NULL)
          OR w.pwht_y_n_ccc = 'N' )
  )                                                                      AS rt_backlog_pwht_n_prall,
  -- The "PR all" twin adds 'NR' to the PWHT hold list (§M47).
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND w.pwht_y_n IN ('Y','25.01') AND w.pwht_weld_status IN ('H','HS','NR')
    AND w.pwht_report IS NULL
  )                                                                      AS rt_backlog_pwht_y_not_done_prall,

  -- ── FABRICATED (M44, M48, M49) ──────────────────────────────────────────
  -- R2-06 unions the two spool masters; `Spool Dump.txt` has zero CCC spools
  -- and `Spool.csv` covers CCC, so matching on spool_id alone is unambiguous
  -- (§7 C-13). The flag is computed at ROW level and AND-ed into the backlog
  -- predicates, exactly as the DAX adds it as one more filter.
  bool_or(EXISTS (SELECT 1 FROM spool sp
                   WHERE sp.spool_id = w.spool_id AND sp.fabricated IS NOT NULL))
                                                                         AS is_fabricated,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND EXISTS (SELECT 1 FROM spool sp
                 WHERE sp.spool_id = w.spool_id AND sp.fabricated IS NOT NULL)
  )                                                                      AS rt_backlog_fabricated,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND ( (w.pwht_y_n IN ('Y','25.01') AND w.pwht_report IS NOT NULL)
          OR (w.pwht_y_n IN ('N','25.01') AND w.pwht_weld_status IS NULL) )
    AND EXISTS (SELECT 1 FROM spool sp
                 WHERE sp.spool_id = w.spool_id AND sp.fabricated IS NOT NULL)
  )                                                                      AS rt_backlog_pwht_ydone_or_n_fabricated,
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND w.pwht_y_n IN ('Y','25.01') AND w.pwht_weld_status IN ('H','HS') AND w.pwht_report IS NULL
    AND EXISTS (SELECT 1 FROM spool sp
                 WHERE sp.spool_id = w.spool_id AND sp.fabricated IS NOT NULL)
  )                                                                      AS rt_backlog_pwht_ynotdone_fabricated,

  -- ── PWHT, "EP" (M60, M62, M63, M64, M65) ────────────────────────────────
  -- The "EP" hold list genuinely omits 'HS CCC' (§0.6).
  bool_or(w.pwht_weld_status IN ('H','HS','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                 'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          AND w.pwht_report IS NULL)                                     AS pwht_backlog,
  bool_or(w.pwht_weld_status IN ('H','HS','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                 'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          AND w.pwht_report IS NULL
          AND w.weld_type IN ('BW','GW','CLET','MW'))                    AS pwht_backlog_rt_types,
  bool_or(w.pwht_weld_status IN ('H','HS','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                 'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          AND w.pwht_report IS NULL
          AND w.weld_type IN ('BW','GW','CLET','MW') AND w.rt_pct = 100) AS pwht_backlog_rt100,
  bool_or(
    w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND w.pwht_weld_status IN ('H','HS','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S')
    AND w.pwht_report IS NULL
  )                                                                      AS pwht_backlog_rt_not_done,
  bool_or(w.pwht_report IS NOT NULL)                                     AS pwht_done,
  bool_or(w.pwht_y_n IN ('Y','25.01'))                                   AS pwht_required,

  -- ── PWHT, "PR all" (M61-M65) ────────────────────────────────────────────
  -- M61 is CCC + everyone-else as two ADDED distinct counts, so both branches
  -- get their own flag and the metric adds the two counts.
  -- §7 C-4: CCC's PWHT is a clean Y/N — no '25.01' branch on the CCC side.
  bool_or(w.weld_date IS NOT NULL AND w.pwht_y_n_ccc = 'Y'
          AND w.pwht_report_no_ccc IS NULL)                              AS pwht_backlog_ccc,
  bool_or(w.weld_date IS NOT NULL AND w.pwht_y_n_ccc = 'Y'
          AND w.pwht_report_no_ccc IS NULL
          AND w.weld_type IN ('BW','GW','CLET','MW'))                    AS pwht_backlog_ccc_rt,
  bool_or(w.weld_date IS NOT NULL AND w.pwht_y_n_ccc = 'Y'
          AND w.pwht_report_no_ccc IS NULL
          AND w.weld_type IN ('BW','GW','CLET','MW') AND w.rt_pct = 100) AS pwht_backlog_ccc_rt100,
  -- The "PR all" hold list = the 16-code RT list + 'T1-2' (so it keeps 'HS CCC').
  bool_or(w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                 'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          AND w.pwht_report IS NULL)                                     AS pwht_backlog_rest,
  bool_or(w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                 'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          AND w.pwht_report IS NULL
          AND w.weld_type IN ('BW','GW','CLET','MW'))                    AS pwht_backlog_rest_rt,
  bool_or(w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                 'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          AND w.pwht_report IS NULL
          AND w.weld_type IN ('BW','GW','CLET','MW') AND w.rt_pct = 100) AS pwht_backlog_rest_rt100,
  bool_or(coalesce(w.pwht_report, w.pwht_report_no_ccc) IS NOT NULL)     AS pwht_done_prall,
  bool_or(w.pwht_y_n_ccc = 'Y')                                          AS pwht_required_ccc,

  -- ── UT, "EP" (M30, M31, M33) ────────────────────────────────────────────
  bool_or(w.ut_weld_status = 'NR' AND w.ut_report IS NOT NULL)           AS ut_done,
  bool_or(w.ut_weld_status = 'NR' AND w.ut_report IS NOT NULL
          AND w.ut_acc_rej = 'A')                                        AS ut_accepted,
  bool_or(w.ut_weld_status = 'NR' AND w.ut_report IS NOT NULL
          AND w.ut_acc_rej = 'R')                                        AS ut_rejected,
  sum(w.weld_length) FILTER (
    WHERE w.weldpoint_no = 1 AND w.ut_report IS NOT NULL)                AS ut_weld_length_m,
  sum(w.rej_length) FILTER (
    WHERE w.ut_weld_status = 'NR' AND w.ut_report IS NOT NULL
      AND w.ut_acc_rej = 'R')                                            AS ut_rej_length_m,

  -- ── UT, "PR all" (M32, M33/M34 via the 0012 length columns) ─────────────
  -- These read the tracker OVERLAY (`*_all`), not the imported columns.
  bool_or(w.manual_ut_report_no_all IS NOT NULL)                         AS ut_done_prall,
  bool_or(w.manual_ut_report_no_all IS NOT NULL
          AND w.manual_ut_status_all = 'R')                              AS ut_rejected_prall,
  sum(w.weld_length_m) FILTER (
    WHERE w.manual_ut_report_no_all IS NOT NULL AND w.weldpoint_seq = 1) AS ut_weld_length_m_prall,
  -- M34. The CCC term is a joint-level LOOKUPVALUE into the UT tracker, so it
  -- is de-duplicated to WP1; `Rej Length` is a genuine per-row column.
  sum(
    CASE
      WHEN w.defect_length_mm IS NOT NULL THEN w.defect_length_mm
      WHEN w.manual_ut_report_no_all IS NOT NULL AND w.by_ut = 'Y' THEN w.rej_length
      WHEN w.manual_ut_status_all = 'R' AND w.sub_contractor = 'CCC' AND w.weldpoint_seq = 1
        THEN (SELECT max(t.weld_defect_length) FROM ref_ut_tracker_ccc t
               WHERE t.joint_id = w.joint_id)
      ELSE 0
    END
  ) FILTER (
    WHERE w.manual_ut_report_no_all IS NOT NULL AND w.manual_ut_status_all = 'R')
                                                                         AS ut_defect_length_prall,

  count(*)                                                               AS rows_in_joint
FROM weld w
GROUP BY w.source, w.joint_id
WITH NO DATA;

-- CONCURRENTLY needs a unique index; this is also the natural key.
CREATE UNIQUE INDEX IF NOT EXISTS mv_joint_key ON mv_joint (source, joint_id);

-- The page-scope predicates, in the order the pivots filter on them.
CREATE INDEX IF NOT EXISTS mv_joint_scope   ON mv_joint (sub_contractor, rt_pct, service_cat);
CREATE INDEX IF NOT EXISTS mv_joint_wps_no  ON mv_joint (wps_no);
CREATE INDEX IF NOT EXISTS mv_joint_date    ON mv_joint (weld_date);
CREATE INDEX IF NOT EXISTS mv_joint_source  ON mv_joint (source);
CREATE INDEX IF NOT EXISTS mv_joint_svcwd   ON mv_joint (service_class_cat_wd);
CREATE INDEX IF NOT EXISTS mv_joint_svcndt  ON mv_joint (service_class_cat_ndt);

COMMENT ON MATERIALIZED VIEW mv_joint IS
  'One row per (source, joint_id). Every DAX DISTINCTCOUNT(Joint ID) becomes count(*) over a bool_or flag here. Authored by METRICS-LANE; REFRESH MATERIALIZED VIEW CONCURRENTLY mv_joint after every weld or spool load.';


-- ===========================================================================
-- mv_joint_wps — the same rollup at (source, joint_id, wps_no) grain
-- ===========================================================================
-- The per-WPS pivots (mockup pages 41-44) are the one place joint grain is not
-- enough: `wps_no` is the single dimension that is genuinely multi-valued per
-- joint (1 joint of 2,370,428 — measured). At row grain that joint counts in
-- BOTH WPS cells, which is what the DAX does and what
-- `reconcile_results.json → wps_gac_nonsg` pins; collapsing it to one cell made
-- `GAC-WPS-P-CS/LTC-002` come out at 223,301 instead of 223,302.
--
-- So the WPS pivot gets its own grain. `bool_or` over the joint's rows FOR THAT
-- WPS is exactly the DAX's "filter to wps = X, then DISTINCTCOUNT(Joint ID)",
-- and the film sums are additive, so the pin passes while the pivot reads
-- ~2.4 M narrow rows instead of sorting joint ids over 6.5 M wide ones
-- (CCC page 41: 4.1 s -> see the checkpoint timing table).
DROP INDEX IF EXISTS mv_joint_wps;   -- an earlier revision used this name for an index
DROP MATERIALIZED VIEW IF EXISTS mv_joint_wps;

CREATE MATERIALIZED VIEW mv_joint_wps AS
SELECT
  w.source,
  w.joint_id,
  w.wps_no,
  max(w.sub_contractor)        AS sub_contractor,
  max(w.weld_type)             AS weld_type,
  max(w.weld_cat)              AS weld_cat,
  max(w.service_cat)           AS service_cat,
  max(w.rt_pct)                AS rt_pct,
  bool_or(w.tmcp_pipe)         AS tmcp_pipe,
  bool_or(w.temporary_lines)   AS temporary_lines,
  max(w.weld_date)             AS weld_date,

  bool_or(coalesce(w.repair_reweld,'') = '' AND w.weld_date IS NOT NULL) AS is_welded_norepair,
  bool_or(w.weld_date IS NOT NULL)                                       AS is_welded,
  bool_or(w.weld_date IS NOT NULL AND w.rt_report IS NOT NULL
          AND w.rt_acc_rej IS DISTINCT FROM 'RS')                        AS is_tested_ep,
  bool_or(w.rt_acc_rej = 'R')                                            AS is_rejected,
  -- M26, deliberately ungated at "EP" scope and pinned at 180,034 for GAC non-SG.
  sum(w.rt_film_total) FILTER (WHERE w.rt_acc_rej IS DISTINCT FROM 'RS') AS films_all,
  sum(w.total_no_of_films_rej)                                           AS films_all_rej
FROM weld w
WHERE w.wps_no IS NOT NULL
GROUP BY w.source, w.joint_id, w.wps_no
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_joint_wps_key
  ON mv_joint_wps (source, joint_id, wps_no);
CREATE INDEX IF NOT EXISTS mv_joint_wps_scope
  ON mv_joint_wps (sub_contractor, service_cat, wps_no);

COMMENT ON MATERIALIZED VIEW mv_joint_wps IS
  'The per-WPS pivot grain: one row per (source, joint_id, wps_no). REFRESH alongside mv_joint.';

-- The project pages pivot welded joints by (weld_cat, weld_type) over the whole
-- table; a partial index on the welded subset turns that into an index-only scan.
CREATE INDEX IF NOT EXISTS mv_joint_welded_types
  ON mv_joint (weld_cat, weld_type) WHERE is_welded_norepair;
CREATE INDEX IF NOT EXISTS mv_joint_welded_week
  ON mv_joint (weld_date_norepair) WHERE is_welded_norepair;
