-- 0052 — the row-level slicers of the Project NDE & PWHT Status page (owner,
-- 2026-10-19; pbix "Internal. PROJECT RT% NDE AND PWHT STATUS S.Class PR all"):
-- RT Acc/Rej, RT Report, RT Batch No, Joint ID, Weld Date, ISO Number, RT Date,
-- UT Report "PR All". One row per distinct combination on a joint's weld rows,
-- narrow, so the slicer lists (hundreds of thousands of reports, ISOs, joints)
-- can be searched quickly and a pick finds its joints by index. Blank is stored
-- as '(Blank)', the pbix slicer label; dates as YYYY-MM-DD text.
--
-- UT Report "PR All" (calculated column): UT Report, else for CCC the UT tracker
-- report (manual_ut_report_no_all), else the RT Report when RT/UT = "UT".
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_row_slicer AS
SELECT DISTINCT
       w.source,
       w.joint_id,
       coalesce(w.rt_acc_rej, '(Blank)')                                  AS rt_acc_rej,
       coalesce(w.rt_report, '(Blank)')                                   AS rt_report,
       coalesce(w.rt_batch_no::text, '(Blank)')                           AS rt_batch,
       coalesce(w.iso_number, '(Blank)')                                  AS iso,
       coalesce(to_char(w.weld_date, 'YYYY-MM-DD'), '(Blank)')            AS weld_date,
       coalesce(to_char(w.rt_date, 'YYYY-MM-DD'), '(Blank)')              AS rt_date,
       coalesce(w.ut_report,
                CASE WHEN w.sub_contractor = 'CCC' THEN w.manual_ut_report_no_all
                     WHEN w.rt_ut = 'UT' THEN w.rt_report END,
                '(Blank)')                                                AS ut_report
  FROM weld w
 WHERE NOT w.is_cancelled;

CREATE INDEX IF NOT EXISTS mv_row_slicer_joint ON mv_row_slicer (source, joint_id);
CREATE INDEX IF NOT EXISTS mv_row_slicer_jid ON mv_row_slicer (joint_id);
CREATE INDEX IF NOT EXISTS mv_row_slicer_rt_report ON mv_row_slicer (rt_report);
CREATE INDEX IF NOT EXISTS mv_row_slicer_rt_batch ON mv_row_slicer (rt_batch);
CREATE INDEX IF NOT EXISTS mv_row_slicer_iso ON mv_row_slicer (iso);
CREATE INDEX IF NOT EXISTS mv_row_slicer_ut_report ON mv_row_slicer (ut_report);
CREATE INDEX IF NOT EXISTS mv_row_slicer_weld_date ON mv_row_slicer (weld_date);
CREATE INDEX IF NOT EXISTS mv_row_slicer_rt_date ON mv_row_slicer (rt_date);
