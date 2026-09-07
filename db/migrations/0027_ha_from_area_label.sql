-- 0027_ha_from_area_label.sql — the `HA l0_abs_guide` stand-in.
--
-- Re-creates `mv_joint` / `mv_joint_wps`; everything outside the `ha`
-- expression is byte-for-byte 0026 (generated from its text).
--
-- 0026 implemented branches 1 and 2 of the pbix `HA` column (second character
-- of Subsystem Code, else of System No) and left branch 3 — the LOOKUPVALUE
-- into `HA l0_abs_guide` by PDS Area — as NULL, because that workbook is not in
-- `sources/`. The consequence was that every CCC, ACCIONA and INCO joint had a
-- blank HA, 1,514,661 of 2,390,978.
--
-- The owner's slicer screenshot shows the pbix does resolve those: its
-- "HA, Area Classification" hierarchy puts `Train-9 Process` and
-- `Intercon PR HA-2` under HA2, alongside the numeric codes 3000000 / 5000000 /
-- 7000000 that our Subsystem-derived HA2 already contains — which is how we
-- know branches 1-2 agree with the pbix and only branch 3 was missing.
--
-- This adds a STAND-IN for branch 3, derived from `area_classification_label`:
--
--   Train-8/9/10/11 Process        -> HA1/HA2/HA3/HA4
--   any label ending `HA-<1..4>`   -> HA<n>   (Intercon PR, Utilities, Offsites)
--   anything else                  -> blank
--
-- It is INFERRED FROM A SCREENSHOT, not from the guide, and is flagged for the
-- owner to confirm. Deliberately narrow: only labels that name their own
-- handover area are mapped. Retention Ponds, the bare numeric codes on dump
-- rows whose Subsystem/System yielded nothing, and every ACCIONA/INCO row keep
-- a blank HA, because inventing one would be worse than admitting we cannot
-- resolve it.

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
  -- `HA`, computed per the pbix calculated column (migration 0026). `weld.ha`
  -- is NULL on all 6.5 M rows, so taking max() of it produced a slicer with no
  -- values; the DAX derives it instead:
  --
  --   1. second character of [Subsystem Code], when that code is valid and the
  --      character is 1-4                                        -> "HA<d>"
  --   2. else the same test on [System No]                        -> "HA<d>"
  --   3. else LOOKUPVALUE('HA l0_abs_guide'[Handover Area]) by [PDS Area]
  --
  -- "Valid" = not blank, not 'System-NA - Not Applicable', and not containing
  -- 'NON' — all three verbatim from the DAX.
  --
  -- Branch 3 is NOT implemented: `HA l0_abs_guide` is not in `sources/` (the
  -- same gap the M52 coverage note already records). Those joints get NULL,
  -- never a substituted area, and the slicer simply has no value for them.
  -- Subsystem Code / System No exist ONLY on WELD_DUMP rows, so CCC, ACCIONA
  -- and INCO are entirely NULL here — that is the data, not a bug.
  max(
    CASE
      WHEN w.subsystem_code IS NOT NULL
       AND w.subsystem_code <> 'System-NA - Not Applicable'
       AND position('NON' in w.subsystem_code) = 0
       AND substr(w.subsystem_code, 2, 1) IN ('1','2','3','4')
        THEN 'HA' || substr(w.subsystem_code, 2, 1)
      WHEN w.system_no IS NOT NULL
       AND w.system_no <> 'System-NA - Not Applicable'
       AND position('NON' in w.system_no) = 0
       AND substr(w.system_no, 2, 1) IN ('1','2','3','4')
        THEN 'HA' || substr(w.system_no, 2, 1)
      -- Branch 3, the `HA l0_abs_guide` lookup by PDS Area. That workbook is
      -- not in `sources/`, so this is a STAND-IN inferred from the owner's own
      -- slicer screenshot (Train-9 Process and Intercon PR HA-2 both sit under
      -- HA2) and is to be confirmed by them. It is deliberately narrow: only
      -- labels that name their handover area are mapped.
      WHEN w.area_classification_label = 'Train-8 Process'  THEN 'HA1'
      WHEN w.area_classification_label = 'Train-9 Process'  THEN 'HA2'
      WHEN w.area_classification_label = 'Train-10 Process' THEN 'HA3'
      WHEN w.area_classification_label = 'Train-11 Process' THEN 'HA4'
      -- `Intercon PR HA-2`, `Utilities HA-1`, `Offsites W2/w3 HA-3`, … — any
      -- label whose last characters are `HA-<1..4>`.
      WHEN right(w.area_classification_label, 4) IN ('HA-1','HA-2','HA-3','HA-4')
        THEN 'HA' || right(w.area_classification_label, 1)
      -- Everything else stays blank: Retention Ponds (+ UG), the bare numeric
      -- codes on dump rows whose Subsystem/System gave nothing, and every
      -- ACCIONA / INCO row. A guessed handover area is worse than none.
      ELSE NULL
    END
  )                                AS ha,
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
  -- M47 [RT BACKLOG Total Project & PWHT "Y" NOT Done "PR all"] — THREE added
  -- CALCULATEs, not two. Terms 1 and 2 are the dump/PWHT-Y branches (the "PR
  -- all" twin adds 'NR' to the PWHT hold list); term 3 is the CCC branch, which
  -- 0013-0023 omitted entirely. That omission is why this read 58 where the
  -- live pbix reads 76.
  --
  --   1  weld type RT, PWHT Y/N IN {Y,25.01}, PWHT status IN {H,HS,NR},
  --      no PWHT report, RT status in the 17-code hold list, no RT report
  --   2  as 1 but the RT%=100 catch: weld date > 0, RT% = 100,
  --      RT status IN {?,'',S}
  --   3  weld type RT, RT status in the hold list, PWHT Y/N CCC = 'Y',
  --      no PWHT Report No CCC, no RT report      <-- was MISSING
  --
  -- The DAX ADDS the three, so a joint matching more than one is counted more
  -- than once. Terms 1/2 need `pwht_y_n` (dump-only) and term 3 needs
  -- `pwht_y_n_ccc` (CCC-only), so they cannot both fire on one joint; 1 and 2
  -- are kept as a single OR because their RT halves are mutually exclusive
  -- (a hold status vs a blank/?/S status).
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
    AND w.pwht_y_n IN ('Y','25.01') AND w.pwht_weld_status IN ('H','HS','NR')
    AND w.pwht_report IS NULL
  )                                                                      AS rt_backlog_pwht_y_not_done_prall,
  -- Term 3, the CCC branch. Note it carries NO weld-date filter and no RT%
  -- branch — the DAX gates it on the hold list alone.
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.rt_report IS NULL
    AND w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
    AND w.pwht_y_n_ccc = 'Y' AND w.pwht_report_no_ccc IS NULL
  )                                                                      AS rt_backlog_pwht_y_not_done_ccc,

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

  -- M64 [PWHT Backlog Weld Status All Weld Types RT NOT Done "PR all"] — FOUR
  -- added CALCULATEs: a CCC branch and a status branch, each restricted to a
  -- SCOPE, once for `Service Cat = "SG"` and once for `TMCP Pipe = "TMCP Pipe"`.
  -- The scope restriction is the whole measure — without it this counted the
  -- unscoped population and read 0 against the live pbix's 3.
  -- Kept as four flags because the DAX ADDS them: a joint that is both SG and
  -- TMCP, or that matches both branches, is counted once per term.
  bool_or(
    w.weld_date IS NOT NULL AND w.pwht_y_n_ccc = 'Y' AND w.pwht_report_no_ccc IS NULL
    AND w.rt_report IS NULL AND w.service_cat = 'SG'
  )                                                                      AS pwht_bl_rt_nd_sg_ccc,
  bool_or(
    w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
    AND w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
    AND w.pwht_report IS NULL AND w.rt_report IS NULL AND w.service_cat = 'SG'
  )                                                                      AS pwht_bl_rt_nd_sg_status,
  bool_or(
    w.weld_date IS NOT NULL AND w.pwht_y_n_ccc = 'Y' AND w.pwht_report_no_ccc IS NULL
    AND w.rt_report IS NULL AND w.tmcp_pipe
  )                                                                      AS pwht_bl_rt_nd_tmcp_ccc,
  bool_or(
    w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
    AND w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
    AND w.pwht_report IS NULL AND w.rt_report IS NULL AND w.tmcp_pipe
  )                                                                      AS pwht_bl_rt_nd_tmcp_status,
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

  -- ── UT lengths, "PR all" — verbatim per measure (migration 0018) ────────
  -- `[Weld Length "PR all"]`, verbatim and complete:
  --   IF(Sub = "Inco" && [Manual UT Report No.] <> "", [Weld Length]/1000,
  --      LOOKUPVALUE('Weld Length'[Weld Length] BY [Dia inch]))
  -- `[Manual UT Report No.]` is the CALCULATED column (C-20), so for Inco it is
  -- Inco's own `UT Report`. The branch fires on 441 PAUT rows and contributes
  -- 490.50 m. `weld_length_m` from the loader carries the IMPORTED column in
  -- that guard and so is NULL for Inco — corrected inline here.
  --
  -- M33 `[UT Weld Length by Joint "PR all"]` — the two CALCULATEs are simply
  -- ADDED, so a row with both a UT Report and RT/UT = 'UT' is counted TWICE.
  -- Reproduced literally. Term 1 reads the RAW `[UT Report]`, not the "PR All"
  -- one, so CCC (whose `ut_report` is empty) contributes only through term 2.
  ( coalesce(sum(CASE
        WHEN upper(w.sub_contractor) = 'INCO' AND (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'INCO'   THEN w.ut_report
        WHEN 'CCC'    THEN w.manual_ut_report_no_all
        ELSE NULL END) IS NOT NULL
          THEN w.weld_length / 1000.0
        ELSE w.weld_length_m
      END) FILTER (
      WHERE w.weldpoint_seq = 1 AND w.ut_report IS NOT NULL), 0)
  + coalesce(sum(CASE
        WHEN upper(w.sub_contractor) = 'INCO' AND (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'INCO'   THEN w.ut_report
        WHEN 'CCC'    THEN w.manual_ut_report_no_all
        ELSE NULL END) IS NOT NULL
          THEN w.weld_length / 1000.0
        ELSE w.weld_length_m
      END) FILTER (
      WHERE w.weldpoint_seq = 1 AND w.rt_ut = 'UT'), 0)
  )                                                                      AS ut_weld_length_prall,

  -- `[UT Inspected Length by Joint "PR all"]` — note this one gates on
  -- `[WeldPoint No.]` (= weldpoint_no), NOT `[WeldPoint No.1 WP1]`. The pbix
  -- really does use both columns, one per measure.
  coalesce(sum(CASE
        WHEN upper(w.sub_contractor) = 'INCO' AND (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'INCO'   THEN w.ut_report
        WHEN 'CCC'    THEN w.manual_ut_report_no_all
        ELSE NULL END) IS NOT NULL
          THEN w.weld_length / 1000.0
        ELSE w.weld_length_m
      END) FILTER (
    WHERE w.weldpoint_no = 1 AND (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'INCO'   THEN w.ut_report
        WHEN 'CCC'    THEN w.manual_ut_report_no_all
        ELSE NULL END) IS NOT NULL), 0)               AS ut_inspected_length_prall,

  -- M34 `[UT Defect Length by Joint "PR all"]` = SUM([Defect Length(MM).])
  -- filtered to [Manual UT Report No.] <> "" AND [Manual UT Status.] = "R".
  -- `[Defect Length(MM).]`, per row:
  --   Inco && MURN<>""            -> [Repair Length (mm)]/1000   <-- BLOCKED
  --   MURN<>"" && [By UT]="Y"     -> [Rej Length]
  --   MUS="R" && Sub="CCC"        -> LOOKUPVALUE(tracker BY Joint ID)
  --   else                        -> 0
  -- All four branches are live. `repair_length_mm` arrived with migration 0020
  -- (74 in-scope Inco rows, 2.4970 m). The CCC term is ROW-level, not
  -- de-duplicated: the DAX sums a LOOKUPVALUE over "PR all" ROWS, so a joint
  -- with several UT rows contributes once per row.
  sum(
    CASE
      WHEN upper(w.sub_contractor) = 'INCO' AND (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'INCO'   THEN w.ut_report
        WHEN 'CCC'    THEN w.manual_ut_report_no_all
        ELSE NULL END) IS NOT NULL
        THEN w.repair_length_mm / 1000.0      -- [Repair Length (mm)]/1000 (0020)
      WHEN (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'INCO'   THEN w.ut_report
        WHEN 'CCC'    THEN w.manual_ut_report_no_all
        ELSE NULL END) IS NOT NULL AND w.by_ut THEN w.rej_length
      WHEN (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_acc_rej, w.manual_ut_status)
        WHEN 'TEKFEN' THEN coalesce(w.ut_acc_rej, w.manual_ut_status)
        WHEN 'INCO'   THEN w.ut_acc_rej
        WHEN 'CCC'    THEN w.manual_ut_status_all
        ELSE NULL END) = 'R' AND upper(w.sub_contractor) = 'CCC'
        THEN (SELECT max(t.weld_defect_length) FROM ref_ut_tracker_ccc t
               WHERE t.joint_id = w.joint_id)
      ELSE 0
    END
  ) FILTER (
    WHERE (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'TEKFEN' THEN coalesce(w.ut_report, w.manual_ut_report_no)
        WHEN 'INCO'   THEN w.ut_report
        WHEN 'CCC'    THEN w.manual_ut_report_no_all
        ELSE NULL END) IS NOT NULL AND (CASE upper(w.sub_contractor)
        WHEN 'GAC'    THEN coalesce(w.ut_acc_rej, w.manual_ut_status)
        WHEN 'TEKFEN' THEN coalesce(w.ut_acc_rej, w.manual_ut_status)
        WHEN 'INCO'   THEN w.ut_acc_rej
        WHEN 'CCC'    THEN w.manual_ut_status_all
        ELSE NULL END) = 'R')                        AS ut_defect_length_prall,


  -- ── backlog HISTORY, "PR all" (migration 0023) ───────────────────────────
  -- The page-1 / 7-11 backlog charts used to read `weld_weekly_snapshot` (the
  -- hand-typed trend workbook). They now recompute the owner's DAX at each
  -- week end, so the last point equals what page 2 shows.
  --
  -- APPROXIMATION, disclosed on the chart: the STATUS columns
  -- (`rt_weld_status`, `pwht_weld_status`, `rt_pct`) are the CURRENT snapshot.
  -- History is reconstructed from REPORT DATES only — a joint is in the
  -- backlog from its weld date until its report date. A joint whose status
  -- changed in the past is therefore counted under today's status for the
  -- whole window. There is no status history in the export to do better.
  --
  -- `*_cand` is the backlog condition WITHOUT `report IS NULL`; the report
  -- date supplies that condition per week instead.
  bool_or(
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
  )                                                                      AS rt_bl_cand_prall,
  min(w.weld_date) FILTER (
    WHERE
    w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL
    AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2')
          OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) )
  )                                                                      AS rt_bl_start,
  -- When the RT report first existed. Every row carrying an `rt_report` also
  -- carries an `rt_date` (0 exceptions in the load), so this is never a guess.
  min(w.rt_date) FILTER (WHERE w.rt_report IS NOT NULL)                  AS rt_bl_end,
  -- M47's PWHT half, minus its `pwht_report IS NULL` clause (the date does it).
  bool_or(w.pwht_y_n IN ('Y','25.01') AND w.pwht_weld_status IN ('H','HS','NR'))
                                                                         AS rt_bl_pwht_required,
  -- When PWHT was reported, either side of the CCC split.
  min(coalesce(w.pwht_date, w.pwht_date_no_ccc)) FILTER (
    WHERE coalesce(w.pwht_report, w.pwht_report_no_ccc) IS NOT NULL)     AS pwht_bl_end,
  bool_or(w.weld_date IS NOT NULL AND w.pwht_y_n_ccc = 'Y')              AS pwht_bl_cand_ccc,
  bool_or(w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2'))
                                                                         AS pwht_bl_cand_rest,
  -- The PWHT rest branch has NO weld-date filter in the DAX; a chart over time
  -- still needs an entry point, so the weld date is used and the note says so.
  min(w.weld_date) FILTER (
    WHERE w.pwht_y_n_ccc = 'Y'
       OR w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                               'T2','T3','T2-1','T2-1S','T2-2S','T2S','T1-2'))
                                                                         AS pwht_bl_start,

  -- ── FABRICATED, "PR all" (migration 0025) ───────────────────────────────
  -- `[RT Backlog+PWHT Progress "Y" Done + PWHT "N" FABRICATED "PR all"]`, six
  -- added DISTINCTCOUNTs. Every branch carries
  -- `Spool ID Status = "Fabricated"`, `Weld Type IN {BW,GW,CLET,MW}` and
  -- `RT Report = ""`.
  --
  --   1  PWHT Y/N IN {Y,25.01}, PWHT Report <> "", RT status in hold16   56
  --   2  as 1 + Weld Date > 0, RT% = 100, RT status IN {?,"",S}           8
  --   3  PWHT Y/N CCC = "Y", PWHT Report No CCC <> "", RT% = 100         18
  --   4  PWHT Y/N IN {N,25.01}, PWHT Weld Status = "", hold16           163
  --   5  as 4 + Weld Date > 0, RT% = 100, RT status IN {?,""}             0
  --   6  Weld Date > 0, PWHT Y/N CCC = "N", RT% = 100                   276
  --                                                              total  521
  --
  -- NOTE the hold list here is the SIXTEEN-code one, WITHOUT 'T1-2', and
  -- branch 5 admits {?,""} but NOT 'S' where branch 2 does. Both are the
  -- owner's text, verbatim; neither is a transcription slip.
  --
  -- The dump branches (1,2,4,5) collapse into one `bool_or` and the CCC
  -- branches (3,6) into another. The DAX ADDS all six, so merging would
  -- undercount any joint matching two branches within a group — verified it
  -- does not: the six-branch sum and the merged pair agree for every party
  -- (the only possible overlap is `pwht_y_n = '25.01'`, which satisfies both
  -- the Y and the N branch, and no such joint is fabricated + in backlog
  -- today). A test pins the two forms equal so the day that changes is loud.
  --
  -- `fabricated` is evaluated per ROW, exactly as `is_fabricated` above does
  -- and as the DAX adds it as one more row filter.
  bool_or(
    EXISTS (SELECT 1 FROM spool sp
                    WHERE sp.spool_id = w.spool_id AND sp.fabricated IS NOT NULL)
    AND w.weld_type IN ('BW','GW','CLET','MW') AND w.rt_report IS NULL
    AND (
      ( w.pwht_y_n IN ('Y','25.01') AND w.pwht_report IS NOT NULL
        AND w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                'T2','T3','T2-1','T2-1S','T2-2S','T2S') )
      OR
      ( w.pwht_y_n IN ('Y','25.01') AND w.pwht_report IS NOT NULL
        AND w.weld_date IS NOT NULL AND w.rt_pct = 100
        AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S')) )
      OR
      ( w.pwht_y_n IN ('N','25.01') AND w.pwht_weld_status IS NULL
        AND w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                                'T2','T3','T2-1','T2-1S','T2-2S','T2S') )
      OR
      ( w.pwht_y_n IN ('N','25.01') AND w.pwht_weld_status IS NULL
        AND w.weld_date IS NOT NULL AND w.rt_pct = 100
        AND (w.rt_weld_status IS NULL OR w.rt_weld_status = '?') )
    )
  )                                                                      AS rt_bl_ydone_n_fab_prall_dump,
  bool_or(
    EXISTS (SELECT 1 FROM spool sp
                    WHERE sp.spool_id = w.spool_id AND sp.fabricated IS NOT NULL)
    AND w.weld_type IN ('BW','GW','CLET','MW') AND w.rt_report IS NULL
    AND w.rt_pct = 100
    AND (
      ( w.pwht_y_n_ccc = 'Y' AND w.pwht_report_no_ccc IS NOT NULL )
      OR
      ( w.pwht_y_n_ccc = 'N' AND w.weld_date IS NOT NULL )
    )
  )                                                                      AS rt_bl_ydone_n_fab_prall_ccc,

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
