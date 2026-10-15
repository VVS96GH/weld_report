-- 0045 — `mv_welder_perf`: the "WELDER PERFORMANCE" tab (pbix pages "WEEKLY
-- WELDER PERFORMANCE LAST 2 Weeks "PR all"" and "Month WELDER PERFORMANCE LAST
-- Month "PR all"").
--
-- Those matrices group `Project WD+WR+INCO+Acciona` by Sub-Contractor ▸ Welder ID
-- ▸ Joint ID and read a dozen CALCULATED columns of that table. This view
-- materialises them per weld row and collapses the rows to one per
-- (welder, joint, report, dates, …) so the page sums and distinct-counts a
-- compact table instead of 6.6 M weld rows.
--
-- The "last N days" windows are NOT baked in: the pbix's `Days Since Last RT/UT/
-- Weld` = Cur_Date − the row's date, with Cur_Date the latest weld date, and the
-- page applies `0 <= days <= 15` (2 weeks) or `<= 30` (1 month) at read time
-- against the report's as_of — so one view serves every page of the tab.
--
-- Inco is left out (owner, 2026-10-14). Calculated columns, verbatim from the
-- pbix (analysis/pbix/raw/model/calculated-columns.json):
--
--   UT Report "PR All"    = [UT Report] <> "" ? [UT Report]   (CCC: the tracker lookup,
--                           materialised as manual_ut_report_no_all / _date_all)
--                           : else [RT/UT] = "UT" ? [RT Report] : BLANK
--   UT Date "PR All"      — the same shape over the dates (CCC: manual_ut_date_all)
--   Manual UT Report No.  = per joint: GAC/TEKFEN MAXX(coalesce(UT Report "PR All",
--                           Manual UT Report No)), CCC MAXX(UT Report "PR All")
--   Manual UT Date.       — the same, over the dates
--   Manual UT Status.     = GAC/TEKFEN coalesce(UT Acc/Rej, Manual UT Status)
--                           (a LOOKUPVALUE by joint+welder), CCC tracker UT1 RESULT
--   Inspected Length(MM). = [Weld Length "PR all"] when Manual UT Report No. <> ""
--   Defect Length(MM).    = MURN <> "" && By UT = "Y" -> [Rej Length]
--                           MUS = "R" && CCC         -> tracker WELDDEFECTLENGTH
--                           else 0
--   Last_RT Date          = [RT Date] when Manual UT Date. is blank
--   Last_UT Date          = Manual UT Date.

-- `Manual UT Date` is typed by hand in the dump (13/Jul/24, 27-Jul-24,
-- 1-Jul-2024); NULL when it does not parse rather than failing the refresh.
CREATE OR REPLACE FUNCTION weld_parse_dmy(t text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text := replace(btrim(t), '/', '-');
BEGIN
  IF s IS NULL OR s = '' THEN RETURN NULL; END IF;
  IF s ~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN s::date; END IF;
  IF s ~ '^\d{1,2}-[A-Za-z]{3}-\d{4}$' THEN RETURN to_date(s, 'DD-Mon-YYYY'); END IF;
  IF s ~ '^\d{1,2}-[A-Za-z]{3}-\d{2}$' THEN RETURN to_date(s, 'DD-Mon-YY'); END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_welder_perf;

CREATE MATERIALIZED VIEW mv_welder_perf AS
WITH b AS (
  SELECT w.*,
         coalesce(w.ut_report,
                  CASE WHEN w.sub_contractor = 'CCC' THEN w.manual_ut_report_no_all
                       WHEN w.rt_ut = 'UT' THEN w.rt_report END)            AS utr_all,
         coalesce(w.ut_date,
                  CASE WHEN w.sub_contractor = 'CCC' THEN w.manual_ut_date_all
                       WHEN w.rt_ut = 'UT' THEN w.rt_date END)              AS utd_all
    FROM weld w
   WHERE upper(w.sub_contractor) <> 'INCO'
), m AS (
  SELECT b.*,
         CASE
           WHEN b.sub_contractor = 'CCC' THEN max(b.utr_all) OVER j
           WHEN upper(b.sub_contractor) IN ('GAC', 'TEKFEN')
             THEN max(coalesce(b.utr_all, b.manual_ut_report_no)) OVER j
         END                                                                AS murn,
         CASE
           WHEN b.sub_contractor = 'CCC' THEN b.manual_ut_status_all
           WHEN upper(b.sub_contractor) IN ('GAC', 'TEKFEN')
             THEN coalesce(b.ut_acc_rej, b.manual_ut_status)
         END                                                                AS mus,
         CASE
           WHEN b.sub_contractor = 'CCC' THEN max(b.utd_all) OVER j
           WHEN upper(b.sub_contractor) IN ('GAC', 'TEKFEN')
             THEN max(coalesce(b.utd_all, weld_parse_dmy(b.manual_ut_date))) OVER j
         END                                                                AS mudate
    FROM b
  WINDOW j AS (PARTITION BY b.joint_id)
), r AS (
  SELECT m.*,
         CASE WHEN m.murn IS NOT NULL THEN m.weld_length_m END             AS insp,
         CASE
           WHEN m.murn IS NOT NULL AND m.by_ut THEN coalesce(m.rej_length, 0)
           WHEN m.mus = 'R' AND m.sub_contractor = 'CCC'
             THEN coalesce((SELECT max(t.weld_defect_length) FROM ref_ut_tracker_ccc t
                             WHERE t.joint_id = m.joint_id), 0)
           ELSE 0
         END                                                                AS defect,
         m.rt_acc_rej IS DISTINCT FROM 'RS'
           AND m.rt_acc_rej IS DISTINCT FROM 'U/Review'                     AS not_rs,
         coalesce(m.exclude_debris_films, false)                            AS debris
    FROM m
)
SELECT
  r.sub_contractor,
  -- `Welder ID` = [Welder] & "-" & [Sub-Contractor]; the Weld Dump rows carry no
  -- materialised welder_id, so build it the pbix way
  coalesce(r.welder_id, coalesce(r.welder, '') || '-' || r.sub_contractor) AS welder_id,
  r.joint_id,
  r.rt_report,
  max(r.utr_all)                                                            AS ut_report_prall,
  max(coalesce(r.ut_operator_id_all, r.ut_operator_id))                     AS ut_operator,
  r.weld_type,
  r.rt_pct,
  r.weld_date,
  -- Last_RT Date: the RT date only where the joint has no Manual UT Date.
  CASE WHEN r.mudate IS NULL THEN r.rt_date END                            AS last_rt_date,
  r.mudate                                                                  AS last_ut_date,
  r.murn IS NOT NULL                                                        AS has_ut,
  coalesce(r.repair_reweld, '') <> ''                                       AS is_repair,
  count(*)                                                                  AS n_rows,
  -- distinct-joint flags (the joint is in the key, so bool_or is per joint here)
  bool_or(r.rt_report IS NOT NULL AND r.not_rs)                             AS f_rt,
  bool_or(r.rt_acc_rej = 'R')                                               AS f_rt_r,
  bool_or(r.not_rs)                                                         AS f_not_rs,
  bool_or(r.rt_report IS NOT NULL AND r.rt_acc_rej IS DISTINCT FROM 'RS')   AS f_rt_cover,
  bool_or(r.mus = 'R')                                                      AS f_ut_r,
  -- films
  coalesce(sum(r.rt_film_total) FILTER (WHERE r.not_rs AND NOT r.debris), 0)          AS films,
  coalesce(sum(r.total_no_of_films_acc) FILTER (WHERE r.not_rs AND NOT r.debris), 0)  AS films_a,
  coalesce(sum(r.total_no_of_films_rej) FILTER (WHERE NOT r.debris), 0)               AS films_r,
  -- `RT Film Ratio % "PR all" For Welder LAST N` reads films without the debris rule
  coalesce(sum(r.rt_film_total) FILTER (WHERE r.not_rs), 0)                           AS films_w,
  coalesce(sum(r.total_no_of_films_rej) FILTER (WHERE r.not_rs), 0)                   AS films_r_w,
  -- `RT Total Films by Joint "PR all"` (+ its "R"), for `RT FILM Rej Ratio %`
  coalesce(sum(r.rt_film_total) FILTER (WHERE r.weldpoint_no = 1 AND r.not_rs
             AND NOT coalesce(r.exclude_ut_films, false) AND NOT r.debris), 0)
  + coalesce(sum(r.rt_film_total) FILTER (WHERE r.weld_point_code IN ('R','H','F','C')
             AND r.not_rs), 0)
  - coalesce(sum(r.rt_film_total) FILTER (WHERE r.weldpoint_no = 1
             AND r.weld_point_code IN ('R','H','F','C') AND r.not_rs), 0)              AS films_j,
  coalesce(sum(r.total_no_of_films_rej) FILTER (WHERE r.not_rs
             AND NOT coalesce(r.exclude_ut_films, false) AND NOT r.debris), 0)         AS films_j_r,
  -- UT lengths (metres)
  coalesce(sum(r.insp), 0)                                                  AS insp,
  coalesce(sum(r.insp) FILTER (WHERE r.weldpoint_no = 1), 0)                AS insp_wp,
  coalesce(sum(r.defect), 0)                                                AS defect,
  coalesce(sum(r.defect) FILTER (WHERE r.murn IS NOT NULL AND r.mus = 'R'), 0) AS defect_r,
  coalesce(sum(r.weld_length_m) FILTER (WHERE r.weldpoint_seq = 1 AND r.ut_report IS NOT NULL), 0)
  + coalesce(sum(r.weld_length_m) FILTER (WHERE r.weldpoint_seq = 1 AND r.rt_ut = 'UT'), 0) AS ut_len_joint,
  coalesce(sum(r.weld_length_m) FILTER (WHERE r.ut_report IS NOT NULL), 0)
  + coalesce(sum(r.weld_length_m) FILTER (WHERE r.rt_ut = 'UT'), 0)        AS ut_len_welder
FROM r
GROUP BY r.sub_contractor, coalesce(r.welder_id, coalesce(r.welder, '') || '-' || r.sub_contractor), r.joint_id, r.rt_report, r.weld_type, r.rt_pct,
         r.weld_date, CASE WHEN r.mudate IS NULL THEN r.rt_date END, r.mudate,
         r.murn IS NOT NULL, coalesce(r.repair_reweld, '') <> ''
WITH NO DATA;

CREATE INDEX mv_welder_perf_welder ON mv_welder_perf (sub_contractor, welder_id);
CREATE INDEX mv_welder_perf_joint ON mv_welder_perf (joint_id);

-- ── per-welder / per-sub-contractor calculated columns ──────────────────────
-- `RT Film Ratio % "PR all" For Welder LAST 2 WEEKS / 1 MONTH`, `RT Ratio % For
-- Welder (<5% ; >5%)`, `UT Rej Length Rate % "PR all" For Welder` (+ LAST 2
-- WEEKS), `UT Rej Rate % "PR all" For Welder by Joint`, and the two "For
-- Sub-Con" ones. Each is ALLEXCEPT(table, Welder ID / Sub-Contractor) over the
-- whole table, so they do not depend on any slicer: computed once per refresh,
-- against the same Cur_Date the report uses (the latest weld date, capped at
-- the day of the latest load — lib/db.ts withAsOf). These columns filter with
-- `Days Since Last RT/UT IN {0..N}`, and IN does NOT admit a BLANK Days Since
-- (the owner's 1-month export: GAC-PW-238 4.55% leaves out the films of its UT
-- joints, which have no Last_RT Date) — unlike the measures' `>= 0 && <= N`.
-- The report's cut-off is the LAST FRIDAY on or before that date (owner,
-- 2026-10-14: "cut off 9 October"; lib/metrics/trend.ts chartCutoff), and welds
-- dated after it are left out, as in the owner's pbix (its extract ends there).
CREATE MATERIALIZED VIEW mv_welder_status AS
WITH m AS (
  SELECT max(weld_date) FILTER (
           WHERE weld_date <= coalesce((SELECT max(started_at)::date FROM load), current_date)) AS d
    FROM weld
), c AS (
  SELECT (d - ((extract(isodow FROM d)::int - 5 + 7) % 7))::date AS cur FROM m
)
SELECT p.welder_id,
       c.cur,
       sum(p.films_r_w) FILTER (WHERE c.cur - p.last_rt_date BETWEEN 0 AND 15)
         / nullif(sum(p.films_w) FILTER (WHERE c.cur - p.last_rt_date BETWEEN 0 AND 15), 0) AS rt_w_15,
       sum(p.films_r_w) FILTER (WHERE c.cur - p.last_rt_date BETWEEN 0 AND 30)
         / nullif(sum(p.films_w) FILTER (WHERE c.cur - p.last_rt_date BETWEEN 0 AND 30), 0) AS rt_w_30,
       count(DISTINCT p.joint_id) FILTER (WHERE p.f_rt_cover AND p.weld_type IN ('BW','GW','CLET','MW'))::numeric
         / nullif(count(DISTINCT p.joint_id) FILTER (
             WHERE p.weld_date IS NOT NULL AND p.weld_type IN ('BW','GW','CLET','MW')), 0)  AS cover_w,
       sum(p.defect) / nullif(sum(p.insp), 0)                                             AS ut_len_w,
       sum(p.defect) FILTER (WHERE c.cur - p.last_ut_date BETWEEN 0 AND 15)
         / nullif(sum(p.insp) FILTER (WHERE p.has_ut AND c.cur - p.last_ut_date BETWEEN 0 AND 15), 0) AS ut_len_w_15,
       count(DISTINCT p.joint_id) FILTER (WHERE p.has_ut AND p.f_ut_r)::numeric
         / nullif(count(DISTINCT p.joint_id) FILTER (WHERE p.has_ut), 0)                AS ut_joint_w
  FROM mv_welder_perf p CROSS JOIN c
 WHERE p.weld_date IS NULL OR p.weld_date <= c.cur
 GROUP BY p.welder_id, c.cur
WITH NO DATA;

CREATE UNIQUE INDEX mv_welder_status_key ON mv_welder_status (welder_id);

CREATE MATERIALIZED VIEW mv_welder_sub_status AS
SELECT sub_contractor,
       count(DISTINCT joint_id) FILTER (WHERE has_ut AND f_ut_r)::numeric
         / nullif(count(DISTINCT joint_id) FILTER (WHERE has_ut), 0) AS ut_joint_s,
       sum(defect) / nullif(sum(insp), 0)                         AS ut_len_s
  FROM mv_welder_perf
 WHERE weld_date IS NULL OR weld_date <= (SELECT max(cur) FROM mv_welder_status)
 GROUP BY sub_contractor
WITH NO DATA;

CREATE UNIQUE INDEX mv_welder_sub_status_key ON mv_welder_sub_status (sub_contractor);
