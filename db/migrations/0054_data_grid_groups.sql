-- 0054 — the Data page's group calculated columns (owner, 2026-10-19): the pbix
-- "Project WD+WR+INCO+Acciona" columns that read a whole group of rows —
-- CALCULATE(…, ALLEXCEPT(T, <key>)) — computed once per load into one small
-- table per grouping and joined to each row by its key (lib/data-grid-columns.ts).
--
-- DAX rules kept: ALLEXCEPT keeps a blank key as a group of its own (keys are
-- coalesced to ''); DISTINCTCOUNT / COUNTROWS of nothing is BLANK, not 0
-- (nullif(…, 0)); DISTINCTCOUNT counts a blank value as one more value; text
-- tests are case-blind and `<> ""` is true of blank. Welder ID is the pbix's
-- own column, Welder & "-" & Sub-Contractor; "Service Class + Service Cat+NDT
-- Remarks" is Service class & " " & Service Cat & " " & NDT Remarks & " " & RT%.

-- per Welder ID: RT Film Ratio % "PR all" For Welder, UT Ratio % For Welder (<5% ; >5%)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_welder AS
SELECT coalesce(w.welder, '') || '-' || coalesce(w.sub_contractor, '') AS k,
       sum(w.total_no_of_films_rej)
         / nullif(sum(w.rt_film_total) FILTER (WHERE upper(coalesce(w.rt_acc_rej, '')) <> 'RS'), 0) AS rt_film,
       nullif(count(DISTINCT w.joint_id) FILTER (WHERE coalesce(w.manual_ut_report_no_all, '') <> ''
                  AND upper(coalesce(w.weld_type, '')) IN ('BW', 'GW', 'CLET', 'MW')), 0)::numeric
         / nullif(count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL
                  AND upper(coalesce(w.weld_type, '')) IN ('BW', 'GW', 'CLET', 'MW')), 0) AS ut_ratio
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_welder_k ON mv_grid_welder (k);

-- per class + sub-contractor: RT Film Ratio % "PR" For SERVICE Class BY SUBCON,
-- QTY Welder ID & No RT by Service Class + Service Cat+NDT Remarks
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_sc_sub AS
SELECT coalesce(w.service_class, '') || ' ' || coalesce(w.service_cat, '') || ' ' || coalesce(w.ndt_remarks, '')
         || ' ' || coalesce(w.rt_pct::text, '') AS sc,
       coalesce(w.sub_contractor, '') AS sub,
       sum(w.total_no_of_films_rej) / nullif(sum(w.rt_film_total), 0) AS rt_film,
       nullif(count(DISTINCT coalesce(w.welder, '') || '-' || coalesce(w.sub_contractor, ''))
                FILTER (WHERE w.weld_date IS NOT NULL AND coalesce(w.rt_report, '') = ''
                  AND upper(coalesce(w.rt_acc_rej, '')) <> 'RS'
                  AND upper(coalesce(w.weld_type, '')) IN ('BW', 'GW', 'CLET', 'MW')), 0) AS welders_no_rt
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1, 2;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_sc_sub_k ON mv_grid_sc_sub (sc, sub);

-- per class: RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover (COALESCE(…, 0))
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_sc AS
SELECT coalesce(w.service_class, '') || ' ' || coalesce(w.service_cat, '') || ' ' || coalesce(w.ndt_remarks, '')
         || ' ' || coalesce(w.rt_pct::text, '') AS sc,
       coalesce(
         count(DISTINCT w.joint_id) FILTER (WHERE coalesce(w.rt_report, '') <> ''
             AND upper(coalesce(w.rt_acc_rej, '')) <> 'RS'
             AND upper(coalesce(w.weld_type, '')) IN ('BW', 'GW', 'CLET', 'MW'))::numeric
         / nullif(count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL
             AND upper(coalesce(w.weld_type, '')) IN ('BW', 'GW', 'CLET', 'MW')), 0),
         0) AS cover
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_sc_k ON mv_grid_sc (sc);

-- per WPS No. and per Material Type: RT Ratio % For WPS / For Material Type "PR all"
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_wps AS
SELECT coalesce(w.wps_no, '') AS k,
       sum(w.total_no_of_films_rej)
         / nullif(sum(w.rt_film_total) FILTER (WHERE upper(coalesce(w.rt_acc_rej, '')) <> 'RS'), 0) AS rt_ratio
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_wps_k ON mv_grid_wps (k);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_material AS
SELECT coalesce(w.material_type, '') AS k,
       sum(w.total_no_of_films_rej)
         / nullif(sum(w.rt_film_total) FILTER (WHERE upper(coalesce(w.rt_acc_rej, '')) <> 'RS'), 0) AS rt_ratio
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_material_k ON mv_grid_material (k);

-- per Welder ID + class: Has_RT_Report (COUNTROWS with an RT Report)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_welder_sc AS
SELECT coalesce(w.welder, '') || '-' || coalesce(w.sub_contractor, '') AS k,
       coalesce(w.service_class, '') || ' ' || coalesce(w.service_cat, '') || ' ' || coalesce(w.ndt_remarks, '')
         || ' ' || coalesce(w.rt_pct::text, '') AS sc,
       nullif(count(*) FILTER (WHERE coalesce(w.rt_report, '') <> ''), 0) AS has_rt
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1, 2;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_welder_sc_k ON mv_grid_welder_sc (k, sc);

-- per Joint ID: Duplicate Weld Date / RT Date / RT Report (DISTINCTCOUNT, blank counted)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_joint AS
SELECT w.joint_id AS k,
       count(DISTINCT w.weld_date) + (bool_or(w.weld_date IS NULL))::int AS dup_weld_date,
       count(DISTINCT w.rt_date) + (bool_or(w.rt_date IS NULL))::int AS dup_rt_date,
       count(DISTINCT w.rt_report) + (bool_or(w.rt_report IS NULL))::int AS dup_rt_report
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_joint_k ON mv_grid_joint (k);

-- per RT Report: Duplicate RT Report by Joint (DISTINCTCOUNT of Joint ID)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_rt_report AS
SELECT coalesce(w.rt_report, '') AS k, count(DISTINCT w.joint_id) AS joints
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_rt_report_k ON mv_grid_rt_report (k);

-- per RT Batch No: BATCH QTY Joints (welded, Repair & Reweld "PR all" blank)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_batch AS
SELECT coalesce(w.rt_batch_no::text, '') AS k,
       nullif(count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL AND (
         upper(coalesce(w.sub_contractor, '')) = 'INCO'
         OR NOT (upper(right(w.joint_id, 2)) IN ('R1', 'R2', 'RW')
                 OR upper(coalesce(w.repair_suffix, '')) IN ('RW1', 'RS1')))), 0) AS joints
  FROM weld w
 WHERE NOT w.is_cancelled
 GROUP BY 1;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_batch_k ON mv_grid_batch (k);

-- the whole table: % of Total Reject (SUM / SUM with no CALCULATE = every row)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grid_total AS
SELECT 1 AS k, sum(w.total_no_of_films_rej) / nullif(sum(w.rt_film_total), 0) AS pct_reject
  FROM weld w
 WHERE NOT w.is_cancelled;
CREATE UNIQUE INDEX IF NOT EXISTS mv_grid_total_k ON mv_grid_total (k);
