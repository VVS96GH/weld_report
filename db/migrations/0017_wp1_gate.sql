-- 0017_wp1_gate.sql — the WP1 gate is `weldpoint_no = 1` for EVERY source.
--
-- Supersedes the film block of 0016 (and 0013 before it). Re-creates `mv_joint`
-- and `mv_joint_wps`; everything outside the `"PR all"` film family is byte-for
-- byte what 0016 shipped (this file is generated from 0016's text so the shared
-- ~400 lines cannot drift).
--
-- WHY ─────────────────────────────────────────────────────────────────────────
-- 0013/0016 gated the `"PR all"` film sums with a per-source CASE:
--
--   CASE source WHEN 'WELD_DUMP' THEN weldpoint_no = 1 ELSE weldpoint_seq = 1 END
--
-- on the belief that `weldpoint_no` was dump-only. It is not. CCC's
-- `WeldPoint No.` is the M-mapped column and is populated (1,342,473 of
-- 5,432,993 CCC_WELDER_RECORD rows carry `weldpoint_no = 1`), so the DAX's own
-- column works unchanged across the union. Verified against the pbix:
--
--   [RT Total Films by Joint "PR all"] = A + B - C
--     A  sum(RT Film Total) WHERE weldpoint_no = 1 AND rt_acc_rej NOT IN (RS,
--        U/Review) AND NOT exclude_ut_films AND NOT exclude_debris_films
--     B  sum(RT Film Total) WHERE weld_point_code IN (R,H,F,C)
--        AND rt_acc_rej NOT IN (RS, U/Review)
--     C  their intersection
--
--   weldpoint_no = 1 : 365,490.2136 + 512,327.6100 - 109,717.2150 = 768,100.61
--                      -> 768,101, EXACTLY the pbix card.
--   the old CASE     : 363,250.0712 + 512,327.6100 - 109,290.4050 = 766,287.28
--                      -> 766,287, WRONG by 1,813.
--
-- This partially reverses the phase-2 mid-flight ruling "the film sums at
-- 'PR all' scope must gate per source": the gate stays, but it is the DAX's
-- column for all sources, and three of the five film measures turn out to carry
-- no WeldPoint filter at all (audited verbatim against analysis/pbix/measures.md).
--
-- `weldpoint_seq` survives in exactly two places, both deliberate and neither a
-- stand-in for `[WeldPoint No.] = 1`:
--   * `ut_weld_length_m_prall` — its DAX ([UT Weld Length by Joint "PR all"])
--     filters the DIFFERENT pbix column `[WeldPoint No.1 WP1]`;
--   * the CCC branch of the M34 defect-length CASE — a joint-level LOOKUPVALUE
--     de-duplicated to one row per joint (ruling R2-01), no DAX WeldPoint filter.
--
-- Refresh cost is unchanged (~45 s for mv_joint, ~7 s for mv_joint_wps).

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
  -- NEW in 0016 — the `"PR all"` twins. `MT Report "PR All"` is a CALCULATED
  -- column, not the imported one:
  --   IF([MT Report] <> "", [MT Report],
  --      IF([MT Report CCC] <> "", [MT Report CCC], BLANK()))
  -- and the same for PT. `mt_report_ccc` / `pt_report_ccc` are the CCC joint
  -- record's values, already materialised onto the fact rows. Reading only the
  -- imported column made M70 report 197,723 where the pbix reports 589,065.
  bool_or(w.weld_date IS NOT NULL
          AND coalesce(w.mt_report, w.mt_report_ccc) IS NOT NULL)        AS mt_done_prall,
  bool_or(w.weld_date IS NOT NULL
          AND coalesce(w.pt_report, w.pt_report_ccc) IS NOT NULL)        AS pt_done_prall,
  -- The other two members of the same M-generated family. No mockup widget
  -- binds them today; they are here so the family is complete and a future
  -- HT/PMI widget does not repeat the M70 mistake.
  bool_or(w.weld_date IS NOT NULL
          AND coalesce(w.ht_report, w.ht_report_ccc) IS NOT NULL)        AS ht_done_prall,
  bool_or(w.weld_date IS NOT NULL
          AND coalesce(w.pmi_report, w.pmi_report_ccc) IS NOT NULL)      AS pmi_done_prall,
  -- NEW in 0016 — `Manual UT Report No.` / `Manual UT Status.`, the CALCULATED
  -- overlays (note the trailing dot) that M32/M34 key on. Read verbatim from
  -- `analysis/pbix/raw/prall-columns.json`; the branches are per sub-contractor
  -- and they are NOT all the tracker:
  --
  --   GAC, TEKFEN : IF(ISBLANK([UT Report "PR All"]), [Manual UT Report No],
  --                    [UT Report "PR All"])          <- the dump's OWN columns
  --   Inco        : IF(ISBLANK([UT Report "PR All"]), [UT Report], …)
  --   CCC         : the UT TRACKER (CCC) lookup, already materialised as
  --                 manual_ut_report_no_all
  --   MEDGULF, ACCIONA : no branch at all -> BLANK by construction
  --
  -- This corrects a wrong premise: ruling R-05's "UT TRACKER (GAC)/(TEK) are
  -- missing, so the dump is not covered" is true of the trackers but FALSE of
  -- this measure — GAC and TEKFEN are covered through their own columns. The
  -- measure was reporting 9,412 (CCC only) where the pbix reports 14,214.
  bool_or(
    CASE upper(w.sub_contractor)
      WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
      WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
      WHEN 'INCO'   THEN w.ut_report
      WHEN 'CCC'    THEN w.manual_ut_report_no_all
      ELSE NULL
    END IS NOT NULL
  )                                                                      AS ut_report_prall,
  -- `Manual UT Status.` — same branch shape, and note Inco's is DEGENERATE in
  -- the source (`IF(ISBLANK([UT Acc/Rej]), [UT Acc/Rej], [UT Acc/Rej])`), so it
  -- collapses to the column itself. Reproduced as written, not "tidied".
  bool_or(
    CASE upper(w.sub_contractor)
      WHEN 'GAC'    THEN coalesce(w.ut_acc_rej, w.manual_ut_status)
      WHEN 'TEKFEN' THEN coalesce(w.ut_acc_rej, w.manual_ut_status)
      WHEN 'INCO'   THEN w.ut_acc_rej
      WHEN 'CCC'    THEN w.manual_ut_status_all
      ELSE NULL
    END = 'R'
    AND CASE upper(w.sub_contractor)
      WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
      WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
      WHEN 'INCO'   THEN w.ut_report
      WHEN 'CCC'    THEN w.manual_ut_report_no_all
      ELSE NULL
    END IS NOT NULL
  )                                                                      AS ut_rejected_prall_v2,
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

  -- ── films, "PR all" family (M23, M24, M26) ──────────────────────────────
  -- WP1 gate = `weldpoint_no = 1` for EVERY source, which is literally the
  -- DAX's own column `'Project WD+WR+INCO+Acciona'[WeldPoint No.]`. The
  -- per-source CASE that 0013/0016 used (`weldpoint_seq` off the dump) was a
  -- guess and is retired here: CCC's `WeldPoint No.` is M-mapped and populated
  -- (1,342,473 rows = 1), so no fallback is needed. See migration header.
  --
  -- Only the two measures whose DAX actually carries `[WeldPoint No.] = 1` are
  -- gated. The other three are ungated in the pbix and are now ungated here.
  ( coalesce(sum(w.rt_film_total) FILTER (
      WHERE w.weldpoint_no = 1
        AND w.rt_acc_rej IS DISTINCT FROM 'RS'
        AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'
        AND NOT w.exclude_ut_films AND NOT w.exclude_debris_films), 0)
  + coalesce(sum(w.rt_film_total) FILTER (
      WHERE w.weld_point_code IN ('R','H','F','C')
        AND w.rt_acc_rej IS DISTINCT FROM 'RS'
        AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'), 0)
  - coalesce(sum(w.rt_film_total) FILTER (
      WHERE w.weldpoint_no = 1
        AND w.weld_point_code IN ('R','H','F','C')
        AND w.rt_acc_rej IS DISTINCT FROM 'RS'
        AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'), 0)
  )                                                                      AS films_taken_prall,
  -- M24 [RT Total Films by Joint "PR all" "R"] — NO WeldPoint filter in the
  -- DAX. Four filters only: Exclude UT Films, <> RS, <> U/Review, <> Debris.
  coalesce(sum(w.total_no_of_films_rej) FILTER (
    WHERE NOT w.exclude_ut_films
      AND w.rt_acc_rej IS DISTINCT FROM 'RS'
      AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'
      AND NOT w.exclude_debris_films), 0)                                AS films_rej_prall,
  -- M26 [RT Total Films "PR all"] — ungated; <> RS, <> Debris, <> U/Review.
  coalesce(sum(w.rt_film_total) FILTER (
    WHERE w.rt_acc_rej IS DISTINCT FROM 'RS'
      AND NOT w.exclude_debris_films
      AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'), 0)                  AS films_all_prall,
  -- M26 [RT Total Films "PR all" "R"] — ungated; the ONLY filter is <> Debris
  -- (no RS / U/Review exclusion in the DAX).
  coalesce(sum(w.total_no_of_films_rej) FILTER (
    WHERE NOT w.exclude_debris_films), 0)                                AS films_all_rej_prall,

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
  'One row per (source, joint_id). Every DAX DISTINCTCOUNT(Joint ID) becomes count(*) over a bool_or flag here. Defined by 0013, extended by 0016 with the "PR all" NDE report flags. REFRESH CONCURRENTLY after every weld or spool load.';
