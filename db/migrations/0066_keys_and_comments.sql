-- 0066 — keys and table descriptions (owner, 2026-11-03, after NFE1_DATABASE_DOCUMENTATION):
-- every table says what one row is; docs/database.md is generated from these (npm run db:docs).
-- No row changes.

-- one row per tracker line (165 rows, (tracker, sl) unique — checked 2026-11-03)
ALTER TABLE ut_tracker_ctjv ADD CONSTRAINT ut_tracker_ctjv_pkey PRIMARY KEY (tracker, sl);

COMMENT ON TABLE weld IS 'One row per source row of a weld (Weld Dump, CCC Welder Record, CCC Joint Record, Inco, Acciona): the fact table every page reads. Columns keep the dump header names (Data page).';
COMMENT ON TABLE stg_weld_dump IS 'The Weld Dump file as loaded, before it is merged into weld (load-weld-dump.ts).';
COMMENT ON TABLE load IS 'One load of a source file: source, file name, size, sha256, rows read / written / rejected, start and end. The refresh skips a file whose sha256 is unchanged.';
COMMENT ON TABLE calendar IS 'One row per day: the week (Friday cut-off) and month it belongs to, for the weekly and monthly charts.';
COMMENT ON TABLE ccc_joint_pwht IS 'CCC joints with PWHT required / done, from the AllTrain Joint Record.';
COMMENT ON TABLE col_pref IS 'A user''s or the shared column widths / titles of a table.';
COMMENT ON TABLE flange_breakdown IS 'The weekly flange break-down rate (CUM Trend Flange Progress Break Down Rate %).';
COMMENT ON TABLE ref_qualified_welders IS 'Qualified / active welders by week (the WPQ register''s counts).';
COMMENT ON TABLE ref_welder_qualification IS 'One welder qualification of the WPQ register (welder no, name, code-sub).';
COMMENT ON TABLE ref_welder_perf_cum IS 'The CUM FILE Welders Performance workbooks row by row (kind 2w / 1m / ut2w): the Rej.Summary trends.';
COMMENT ON TABLE welder_perf_note IS 'The Notes box of a Rej.Summary page: per kind, cut-off and sub-contractor.';
COMMENT ON TABLE ut_tracker_ctjv IS 'One line of the GAC / TEKFEN UT (MUT) trackers.';
COMMENT ON TABLE weld_weekly_snapshot IS 'The weekly snapshot of the backlog / progress figures per scope (Friday cut-offs), for the trend charts.';
COMMENT ON TABLE app_user IS 'One user: e-mail, name, role (admin / user), password hash, status.';
COMMENT ON TABLE user_session IS 'One signed-in session.';
COMMENT ON TABLE audit_event IS 'One action in the activity log: who, when, from where, what.';
COMMENT ON TABLE saved_view IS 'One saved view of a page (its filters).';
COMMENT ON TABLE schema_migrations IS 'The migrations applied (scripts/migrate.ts).';

COMMENT ON MATERIALIZED VIEW mv_weekly_progress IS 'Joints welded and tested per week and scope: the weekly progress charts.';
COMMENT ON MATERIALIZED VIEW mv_joint_attr IS 'One row per joint: the row-grain attributes the Project NDE & PWHT page slices or counts on (NDT Remarks, thickness, PAUT flags).';
COMMENT ON MATERIALIZED VIEW mv_joint_extra_type IS 'Every (joint, weld type) besides the joint''s own type: a joint whose rows carry two types counts in both columns.';
COMMENT ON MATERIALIZED VIEW mv_joint_material IS 'Joint -> Material Type (row grain on weld), for the Material Type slicer.';
COMMENT ON MATERIALIZED VIEW mv_joint_pairs IS 'One row per distinct (joint, WPS, material, welder): the WPS / Material page.';
COMMENT ON MATERIALIZED VIEW mv_row_slicer IS 'The values of the row-grain slicers (reports, ISOs, joints), narrow and indexed for search.';
COMMENT ON MATERIALIZED VIEW mv_welder_perf IS 'One row per welder x joint x RT report: films (the welder''s rows), UT lengths, dates — the Welder Performance pages.';
COMMENT ON MATERIALIZED VIEW mv_welder_status IS 'One row per welder: the RT film / UT length ratios of the windows and the cover, at the cut-off Friday.';
COMMENT ON MATERIALIZED VIEW mv_welder_sub_status IS 'One row per sub-contractor: the same ratios over its welders.';
COMMENT ON MATERIALIZED VIEW mv_grid_batch IS 'Data page: per RT Batch No, BATCH QTY Joints.';
COMMENT ON MATERIALIZED VIEW mv_grid_inco IS 'Data page: Inco Length Ratio % per welder, last 2 weeks / 1 month.';
COMMENT ON MATERIALIZED VIEW mv_grid_joint IS 'Data page: per Joint ID, the duplicate weld date / RT date / RT report counts.';
COMMENT ON MATERIALIZED VIEW mv_grid_joint_tp IS 'Data page: TESTPACK No "PR All" per joint.';
COMMENT ON MATERIALIZED VIEW mv_grid_material IS 'Data page: RT Ratio % per Material Type.';
COMMENT ON MATERIALIZED VIEW mv_grid_rt_report IS 'Data page: per RT report, the joints it covers.';
COMMENT ON MATERIALIZED VIEW mv_grid_sc IS 'Data page: per service class, RT film ratio, welders, no-RT counts.';
COMMENT ON MATERIALIZED VIEW mv_grid_sc_sub IS 'Data page: the same per service class and sub-contractor.';
COMMENT ON MATERIALIZED VIEW mv_grid_total IS 'Data page: whole-table totals (% of Total Reject).';
COMMENT ON MATERIALIZED VIEW mv_grid_tp IS 'Data page: per test pack, TP Ratio % Complete.';
COMMENT ON MATERIALIZED VIEW mv_grid_welder IS 'Data page: per Welder ID, RT film and UT ratios.';
COMMENT ON MATERIALIZED VIEW mv_grid_welder_sc IS 'Data page: per Welder ID and service class, Has_RT_Report.';
COMMENT ON MATERIALIZED VIEW mv_grid_wps IS 'Data page: RT Ratio % per WPS No.';
