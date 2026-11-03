# Database documentation - Welding Statistics Dashboard (weld_report)

Generated from the live catalog on 2026-11-03 05:37 UTC by `npm run db:docs` (scripts/db-docs.ts). Do not edit by hand:
the meanings live in the database (COMMENT ON, migrations) and in the code that writes them.

## 1. Overview

- **Name and platform:** PostgreSQL 17.6 (Debian 17.6-2.pgdg12+1), Docker container `weld_report_db` on this machine. Connection values come from `.env`; none is written here.
- **Scale:** 37 tables and 24 materialized views, 35,445,399 rows, 22 GB on disk.
- **What it is:** the Welding Statistics Dashboard's store. It reproduces the owner's Power BI report: the export files in `sources/` are
  loaded into `weld` and the reference tables, the materialized views (`mv_*`) precompute what the pages read.
- **Who uses it:** the Next.js site (port 3000) only. The Welding Statistics Platform never reads it.
- **Companions:** `RULINGS.md` (the owner's rulings), `db/migrations/*.sql` (every definition, with its reason), `docs/`.

## 2. Tables and what one row means

| Table / view | Kind | Rows | Key | Meaning |
|---|---|---:|---|---|
| `app_user` | table | 2 | (id) | One user: e-mail, name, role (admin / user), password hash, status. |
| `audit_event` | table | 6 | (id) | One action in the activity log: who, when, from where, what. |
| `calendar` | table | 2,064 | (date) | One row per day: the week (Friday cut-off) and month it belongs to, for the weekly and monthly charts. |
| `ccc_joint_pwht` | table | 1,471,709 | (joint_id_jr) | CCC joints with PWHT required / done, from the AllTrain Joint Record. |
| `col_pref` | table | 412 | (table_key, col) | A user's or the shared column widths / titles of a table. |
| `flange` | table | 365,448 | (id) | The flange register: Flange Progress.xlsx (GAC/TEKFEN/MEDGULF) appended with ovAssets_1619.xlsx (CCC), exactly as the pbix Table.Combine does. Grain is one REGISTER LINE, 363,245 rows over 357,787 distinct joint_id — every joint metric must be count(DISTINCT joint_id). Never joins `weld`. |
| `flange_breakdown` | table | 324 | (week_date, sub_contractor) | The weekly flange break-down rate (CUM Trend Flange Progress Break Down Rate %). |
| `load` | table | 164 | (id) | One load of a source file: source, file name, size, sha256, rows read / written / rejected, start and end. The refresh skips a file whose sha256 is unchanged. |
| `ref_active_welders` | table | 612 | (week_end_date, sub_contractor) | Raw landing copy of CUM Trend Active Welders.xlsx (576 rows). Also seeded into weld_weekly_snapshot as metric M90W. |
| `ref_code_label` | table | 73 | (domain, code) | NOT A PBIX REPRODUCTION. `Weld Length/Rework code.xlsx` is read by NO Power Query and feeds no measure; these are display labels for codes the UI otherwise shows raw. Display-only — never a join key, never a filter, and never a source of truth about which codes exist (the fact tables are). Ruling R3-08. |
| `ref_exclusion_list` | table | 628 | (id) | Ruling R2-02: stored UNAPPLIED. No loader or metric may filter on this table without an explicit ruling. |
| `ref_ha` | table | 0 | (location_number) | EMPTY BY DESIGN until l0_abs_guide_202502191028.csv arrives (912 rows). The DAX HA fallback LOOKUPVALUEs it by Location Number = flange.pds_area. Absence is why some flange.ha are NULL; do not fill them from anything else. |
| `ref_ha_area` | table | 41 | (ha, area_classification) | sources/HA.csv — the pbix (HA, Area Classification) slicer hierarchy, 41 pairs. MANY-TO-MANY: one area can sit under two HAs (Train-9 Process is under HA2 and HA3). Supplies the slicer's child lists ONLY; a joint's own HA is still derived by migration 0027 from area labels, an approximation standing in for the absent HA l0_abs_guide PDS-Area lookup. |
| `ref_ha_guide` | table | 910 | (location_number) | sources/l0_abs_guide.csv — the pbix 'HA l0_abs_guide'. Keyed on Location Number, which joins to weld.pds_area. Supplies branch 3 of the HA calculated column, replacing migration 0027's label-based stand-in. Read with QuoteStyle.None as the pbix does: the first two fields never contain commas, and rows that do not split into exactly 13 keep those two and set is_malformed. |
| `ref_mpi_done` | table | 133 | (week_end_date) | Raw landing copy of CUM MPI Done .xlsx (124 rows). CUMULATIVE totals. Also seeded into weld_weekly_snapshot as M71/M71PT, sub_contractor=PROJECT. |
| `ref_qualified_welders` | table | 6 | (sub_contractor) | Qualified / active welders by week (the WPQ register's counts). |
| `ref_talisman_joint` | table | 1,508,080 | (joint_id) | sources/Joint.csv — the pbix 'TALISMAN DATA' table. One row per joint (QCISO-SPOOL-JOINT), rows with ORIGINAL REPAIR DELETE FLAG = 'D' dropped as the M does. Deliberately narrow: only what [RT BACKLOG RT100% Talisman] and its provenance need. RT% is NOT stored — it is a lookup of the union's RT% by Joint ID, joined from mv_joint at read time so the two cannot drift. |
| `ref_talisman_welder` | table | 1,490,168 | (joint_id, welder_id) | Joint.csv (TALISMAN DATA) Joint ID + WELDER ID ALL keys, D-flag rows dropped, one row per distinct key. WELDER ID ALL = W4 if not blank else W1, after the M's split of WELDER ID 1..4 on "/". |
| `ref_ut_tracker_ccc` | table | 10,043 | (id) | Ruling R2-14. Sheet TalismanUT_update only; the Reject sheet (30 rows) is a subset and is NOT loaded. |
| `ref_welder_perf_cum` | table | 230,126 | (kind, row_no) | The CUM FILE Welders Performance workbooks row by row (kind 2w / 1m / ut2w): the Rej.Summary trends. |
| `ref_welder_qualification` | table | 5,484 | (id) | One welder qualification of the WPQ register (welder no, name, code-sub). |
| `ref_welder_status_weekly` | table | 6,288 | (week_end_date, sub_contractor, category) | CUM WEEK # Status unpivoted. The current-week snapshot sheet (WEEK #   STATUS, 8 rows) uses DIFFERENT category strings (no numeric prefix), so the pbix relationship between the two matches on almost nothing — treat them as independent (R3-13). |
| `ref_wps_process` | table | 266 | (wps_no) | The WELDING PROCESS sheet, 266 rows — the ONLY WPS table that may be joined to weld.wps_no (R4-03), at 100.00% coverage of in-scope joints carrying a WPS. The near-identical WPS (Welding Process).csv is NOT loaded (R4-07): the sheet is canonical, and the csv carries an unnamed 6th column and two spelling variants. |
| `ref_wps_pwht_status` | table | 34 | (wps_no) | DOCUMENTATION ONLY (R4-08). No measure reads it. It must NOT override weld.pwht_y_n or PWHT_AMBIGUOUS_TOKEN (ruling R-04) without a separate ruling. Three of its keys (CS/LTCS-AUT-003/-009/-010) have no ref_wps_process row, so the pbix's "1:1" edge is aspirational — no FK here either. |
| `ref_wps_register` | table | 318 | (wps_no) | The WPQ CONSOLIDATED register, 318 rows. **NEVER JOIN ref_wps_register.wps_no TO weld.wps_no** (ruling R4-03): this table holds DOCUMENT numbers (383-TEK-…, WPS-638-…) and `weld` holds SITE numbers (TEK-…, MED-WPS-638-…). They match on only ~61% and the pbix does not join them either. `ref_wps_process` is the WPS-to-fact join table. |
| `ref_wps_status_cum` | table | 272 | (week_end_date, metric) | CUM WPS Status, 127 weeks x 2 metrics, CUMULATIVE running totals (submitted 269->318, approved 194->318). Project-wide, no sub_contractor. UPSERTed, never truncated (R4-06). Its immediate value is as the independent check on M91: the 2026-08-28 WPS_APPROVED row reads 318. |
| `saved_view` | table | 1 | (id) | One saved view of a page (its filters). |
| `schema_migrations` | table | 66 | (filename) | The migrations applied (scripts/migrate.ts). |
| `spool` | table | 530,943 | (source, spool_id) | Two spool masters unioned (R2-06). Spool Dump.txt has no CCC spools; Spool.csv (Talisman) has them under other names. Join weld.spool_id -> spool.spool_id and pick a source. |
| `stg_weld_dump` | table | 1,004,566 | - | The Weld Dump file as loaded, before it is merged into weld (load-weld-dump.ts). |
| `user_session` | table | 5 | (id) | One signed-in session. |
| `ut_tracker_ctjv` | table | 165 | (tracker, sl) | One line of the GAC / TEKFEN UT (MUT) trackers. |
| `weld` | table | 6,620,809 | (id) | One row per source row of a weld (Weld Dump, CCC Welder Record, CCC Joint Record, Inco, Acciona): the fact table every page reads. Columns keep the dump header names (Data page). |
| `weld_length_by_dia` | table | 100 | (dia_inch) | dia inch -> metres, 98 rows. The workbook stores 728,550 exploded (Weld Type, Dia inch) rows; the DAX keys on Dia inch ALONE and ignores Weld Type, and no dia maps to two lengths, so 98 is the whole content. Exploded count kept in the load ledger notes (R3-07). |
| `weld_manual_exclusion` | table | 4 | (joint_id) | The 4 Joint IDs the pbix M really excludes from the union (16 rows). Applied by the CCC loaders. Not to be confused with ref_exclusion_list, which is stored UNAPPLIED (R2-02). |
| `weld_weekly_snapshot` | table | 11,106 | (week_end_date, sub_contractor, scope, metric) | The weekly snapshot of the backlog / progress figures per scope (Friday cut-offs), for the trend charts. |
| `welder_perf_note` | table | 0 | (kind, cutoff, sub_contractor) | The Notes box of a Rej.Summary page: per kind, cut-off and sub-contractor. |
| `mv_grid_batch` | view | 14,681 | - | Data page: per RT Batch No, BATCH QTY Joints. |
| `mv_grid_inco` | view | 238 | - | Data page: Inco Length Ratio % per welder, last 2 weeks / 1 month. |
| `mv_grid_joint` | view | 2,394,979 | - | Data page: per Joint ID, the duplicate weld date / RT date / RT report counts. |
| `mv_grid_joint_tp` | view | 2,394,979 | - | Data page: TESTPACK No "PR All" per joint. |
| `mv_grid_material` | view | 93 | - | Data page: RT Ratio % per Material Type. |
| `mv_grid_rt_report` | view | 210,676 | - | Data page: per RT report, the joints it covers. |
| `mv_grid_sc` | view | 956 | - | Data page: per service class, RT film ratio, welders, no-RT counts. |
| `mv_grid_sc_sub` | view | 1,209 | - | Data page: the same per service class and sub-contractor. |
| `mv_grid_total` | view | 1 | - | Data page: whole-table totals (% of Total Reject). |
| `mv_grid_tp` | view | 29,095 | - | Data page: per test pack, TP Ratio % Complete. |
| `mv_grid_welder` | view | 3,943 | - | Data page: per Welder ID, RT film and UT ratios. |
| `mv_grid_welder_sc` | view | 134,822 | - | Data page: per Welder ID and service class, Has_RT_Report. |
| `mv_grid_wps` | view | 291 | - | Data page: RT Ratio % per WPS No. |
| `mv_joint` | view | 2,394,991 | - | One row per (source, joint_id). Every DAX DISTINCTCOUNT(Joint ID) becomes count(*) over a bool_or flag here. Defined by 0013, extended by 0016 with the "PR all" NDE report flags. REFRESH CONCURRENTLY after every weld or spool load. |
| `mv_joint_attr` | view | 2,394,979 | - | One row per joint: the row-grain attributes the Project NDE & PWHT page slices or counts on (NDT Remarks, thickness, PAUT flags). |
| `mv_joint_extra_type` | view | 1 | - | Every (joint, weld type) besides the joint's own type: a joint whose rows carry two types counts in both columns. |
| `mv_joint_material` | view | 2,394,980 | - | Joint -> Material Type (row grain on weld), for the Material Type slicer. |
| `mv_joint_pairs` | view | 2,561,182 | - | One row per distinct (joint, WPS, material, welder): the WPS / Material page. |
| `mv_joint_wps` | view | 2,261,654 | - | The per-WPS pivot grain: one row per (source, joint_id, wps_no). REFRESH alongside mv_joint. |
| `mv_row_slicer` | view | 2,413,896 | - | The values of the row-grain slicers (reports, ISOs, joints), narrow and indexed for search. |
| `mv_weekly_progress` | view | 21,676 | - | Joints welded and tested per week and scope: the weekly progress charts. |
| `mv_welder_perf` | view | 2,550,990 | - | One row per welder x joint x RT report: films (the welder's rows), UT lengths, dates — the Welder Performance pages. |
| `mv_welder_status` | view | 3,705 | - | One row per welder: the RT film / UT length ratios of the windows and the cover, at the cut-off Friday. |
| `mv_welder_sub_status` | view | 6 | - | One row per sub-contractor: the same ratios over its welders. |

## 3. Columns

Every column with its type and meaning (`weld`: the dump header it holds).

### `app_user` - 2 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `email` | text | yes |  |
| `name` | text | yes |  |
| `role` | text | yes |  |
| `password_hash` | text | yes |  |
| `active` | boolean | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `last_login_at` | timestamp with time zone |  |  |
| `must_change_password` | boolean | yes |  |

### `audit_event` - 6 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `at` | timestamp with time zone | yes |  |
| `email` | text | yes |  |
| `action` | text | yes |  |
| `status` | integer | yes |  |
| `ip` | text | yes |  |
| `detail` | jsonb | yes |  |

### `calendar` - 2,064 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `date` | date | yes |  |
| `weekday` | smallint | yes |  |
| `weeknum` | integer | yes |  |
| `week_start_date` | date | yes |  |
| `week_end_date` | date |  |  |
| `month` | text | yes |  |
| `year` | smallint | yes |  |

### `ccc_joint_pwht` - 1,471,709 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `joint_id_jr` | text | yes |  |
| `load_id` | bigint | yes |  |
| `pwht_y_n` | text |  |  |
| `pwht_report_no` | text |  |  |
| `pwht_date` | date |  |  |
| `ht_report_no` | text |  |  |
| `ht_date` | date |  |  |
| `mt_root_report_no` | text |  |  |
| `mt_root_date` | date |  |  |
| `mt_root_pct` | integer |  |  |
| `mt_cap_pct` | integer |  |  |
| `pt_root_report_no` | text |  |  |
| `pt_root_date` | date |  |  |
| `pt_root_pct` | integer |  |  |
| `pt_cap_pct` | integer |  |  |
| `pmi_report_no` | text |  |  |
| `pmi_date` | date |  |  |
| `weld_report_no` | text |  |  |
| `test_package_no` | text |  |  |
| `sub_system_no` | text |  |  |
| `wall_thickness` | numeric(8,2) |  |  |
| `rework_code` | text |  |  |
| `sub_contractor` | text |  |  |
| `weld_date` | date |  |  |
| `repair_suffix` | text |  |  |
| `is_welded` | boolean | yes |  |
| `source_rows` | integer | yes |  |
| `is_ambiguous` | boolean | yes |  |
| `rt_ut_date` | date |  |  |
| `rt_ut_report_no` | text |  |  |
| `pmi_pct` | integer |  |  |
| `ht_pct` | integer |  |  |

### `col_pref` - 412 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `table_key` | text | yes |  |
| `col` | text | yes |  |
| `label` | text |  |  |
| `width` | integer |  |  |
| `updated_at` | timestamp with time zone | yes |  |

### `flange` - 365,448 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `load_id` | bigint | yes |  |
| `source` | flange_source | yes |  |
| `joint_id` | text | yes |  |
| `iso_number` | text |  |  |
| `bt_no` | text |  |  |
| `rev_no` | text |  |  |
| `sheet_no` | text |  |  |
| `joint_point` | text |  |  |
| `test_pack` | text |  |  |
| `system` | text |  |  |
| `subsystem` | text |  |  |
| `pds_area` | text |  |  |
| `process_plant` | text |  |  |
| `process_area` | text |  |  |
| `ha` | text |  | Handover area. Derived from [System] as RF-03 describes, then from PDS Area through ref_ha_guide (the pbix HA l0_abs_guide fallback, migrations 0031/0037). Still NULL for 65 joints the guide does not know; those keep their own row and filter option rather than being folded into HA1. |
| `sub_contractor` | text |  | GAC / TEKFEN / MEDGULF / TBD from Flange Progress; hard-set to CCC for every ovAssets_1619 row, as the M does. ACCIONA rows are dropped at load, as the M does. |
| `commissioning_package` | text |  |  |
| `line_no` | text |  |  |
| `diam` | text |  |  |
| `rating` | text |  |  |
| `service_class` | text |  |  |
| `material_id_code` | text |  |  |
| `bolt_size` | text |  |  |
| `bolt_qty` | text |  |  |
| `bolt_length` | text |  |  |
| `bolt_ident` | text |  |  |
| `bolt_desc` | text |  |  |
| `gasket_desc` | text |  |  |
| `gasket_rating` | text |  |  |
| `lubricant_type` | text |  |  |
| `service_type` | text |  |  |
| `ut` | text |  |  |
| `joint_method` | text |  |  |
| `joint_method_original` | text |  |  |
| `joint_timing` | text |  |  |
| `cat` | text |  | Only 75.3% filled on the CCC side, which is why the mockup uses the "CCC no cat" measure pair that exempts CCC from the Cat. test (RF-07). Do not use the plain Cat.-for-everyone trio: it zeroes CCC. |
| `jointing_value` | text |  |  |
| `torque_eu` | text |  |  |
| `joint_date` | date |  |  |
| `report_nbr` | text |  |  |
| `jointer` | text |  |  |
| `tag_nbr` | text |  |  |
| `tightening_tool_id` | text |  |  |
| `control_pct` | integer |  |  |
| `flange_batch_no` | text |  |  |
| `selected_date` | date |  |  |
| `issued_date` | date |  |  |
| `issue_request_no` | text |  |  |
| `batch_status` | text |  |  |
| `flange_joint_status` | text |  |  |
| `control_inspection_report_no` | text |  |  |
| `control_inspection_date` | date |  |  |
| `status_ar` | text |  |  |
| `client_requested` | text |  |  |
| `witnessed_by` | text |  |  |
| `acc_rej` | text |  |  |
| `remarks` | text |  |  |
| `btc01` | text |  |  |
| `bt24` | text |  |  |
| `reason` | text |  |  |
| `reason_for_de_tightening` | text |  |  |
| `user_requested_for_de_tightening` | text |  |  |
| `de_tightening_requested_date` | date |  |  |
| `hold_status` | text |  |  |
| `hold_date` | date |  |  |
| `hold_comments` | text |  |  |
| `pcc_serial_no_field_tag` | text |  |  |
| `pcc_tightening_date` | date |  |  |
| `pcc_report_number` | text |  |  |
| `pcc_verified_date` | date |  |  |
| `pcc_re_tightening_date` | date |  |  |
| `pcc_re_tightening_report_number` | text |  |  |
| `pcc_crew_id` | text |  |  |
| `pcc_remarks` | text |  |  |
| `re_tightening_report_number` | text |  |  |
| `flange_repair_record` | text |  |  |
| `nut_material` | text |  |  |
| `parent_asset` | text |  |  |
| `record_modified_by` | text |  |  |
| `record_modified_date` | date |  |  |
| `construction_responsible_company` | text |  |  |
| `commissioning_responsible_company` | text |  |  |

### `flange_breakdown` - 324 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `week_date` | date | yes |  |
| `sub_contractor` | text | yes |  |
| `rate` | numeric |  |  |
| `project_rate` | numeric |  |  |

### `load` - 164 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `source` | text | yes |  |
| `file_name` | text | yes |  |
| `file_size` | bigint | yes |  |
| `file_sha256` | text | yes |  |
| `started_at` | timestamp with time zone | yes |  |
| `finished_at` | timestamp with time zone |  |  |
| `records_read` | bigint | yes |  |
| `records_loaded` | bigint | yes |  |
| `records_cancelled` | bigint | yes |  |
| `notes` | jsonb | yes |  |

### `ref_active_welders` - 612 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `week_end_date` | date | yes |  |
| `sub_contractor` | text | yes |  |
| `welders` | integer |  |  |
| `label_raw` | text |  |  |
| `load_id` | bigint |  |  |

### `ref_code_label` - 73 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `domain` | text | yes |  |
| `code` | text | yes |  |
| `description` | text |  |  |
| `load_id` | bigint |  |  |

### `ref_exclusion_list` - 628 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `rt_report` | text |  |  |
| `welder` | text |  |  |
| `joint_id` | text |  |  |
| `reason` | text |  |  |
| `load_id` | bigint |  |  |
| `loaded_at` | timestamp with time zone | yes |  |

### `ref_ha` - 0 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `location_number` | text | yes |  |
| `handover_area` | text |  |  |
| `notes` | text |  |  |
| `load_id` | bigint |  |  |

### `ref_ha_area` - 41 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `ha` | text | yes |  |
| `area_classification` | text | yes |  |
| `load_id` | bigint |  |  |

### `ref_ha_guide` - 910 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `location_number` | text | yes |  |
| `handover_area` | text |  |  |
| `location_name` | text |  |  |
| `location_summary` | text |  |  |
| `area_number` | text |  |  |
| `area_name` | text |  |  |
| `area_summary` | text |  |  |
| `facility_number` | text |  |  |
| `facility_name` | text |  |  |
| `facility_summary` | text |  |  |
| `project_number` | text |  |  |
| `project_name` | text |  |  |
| `project_summary` | text |  |  |
| `is_malformed` | boolean | yes | The row did not split into 13 comma-separated fields (embedded or unbalanced quotes). Handover Area and Location Number are still correct; the descriptive columns are NULL. Marked rather than dropped, so the count is visible. |
| `load_id` | bigint |  |  |

### `ref_mpi_done` - 133 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `week_end_date` | date | yes |  |
| `mpi_done` | numeric |  |  |
| `mpi_pt_done` | numeric |  |  |
| `load_id` | bigint |  |  |

### `ref_qualified_welders` - 6 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `sub_contractor` | text | yes |  |
| `qualified_welders` | integer | yes |  |
| `as_of` | date |  | The SOURCE FILE mtime, not a reporting date — SCTR NFE WELDERS APPLIED.xls carries no date. State it as such in any widget (R3-10). |
| `notes` | text |  |  |
| `active_welders` | integer |  |  |
| `active_piping_welders` | integer |  |  |
| `load_id` | bigint |  |  |
| `source_note` | text |  |  |

### `ref_talisman_joint` - 1,508,080 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `joint_id` | text | yes |  |
| `load_id` | bigint |  |  |
| `subcon_code` | text |  |  |
| `weld_date` | date |  |  |
| `rt1_date` | date |  |  |
| `rt1_rep_no` | text |  |  |
| `rt1_result` | text |  |  |
| `orig_repair_delete_flag` | text |  |  |
| `source_rows` | integer | yes | File rows that collapsed into this joint. > 1 means the export carried duplicates; the loader reports the count rather than hiding it. |
| `size_sum` | numeric |  | Sum(TALISMAN DATA[SIZE]) as the pbix computes it: SIZE as Int64 (half-to-even), times the rows the M creates by splitting WELDER ID 1..4 on "/". Errors page, check "Different Weld Date Status", column Dia. |
| `ut1_rep_no` | text |  |  |
| `rt1_films` | numeric |  |  |
| `wps_code` | text |  |  |

### `ref_talisman_welder` - 1,490,168 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `joint_id` | text | yes |  |
| `welder_id` | text | yes |  |
| `load_id` | bigint |  |  |

### `ref_ut_tracker_ccc` - 10,043 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `load_id` | bigint | yes |  |
| `qciso_no` | text |  |  |
| `joint_no` | text |  |  |
| `spool_no` | text |  |  |
| `size_inch` | numeric(8,2) |  |  |
| `wall_thickness` | numeric(8,2) |  |  |
| `service_class` | text |  |  |
| `weld_type` | text |  |  |
| `area` | text |  |  |
| `weld_date` | date |  |  |
| `welder_id` | text |  |  |
| `welder_id_2` | text |  |  |
| `welder_id_3` | text |  |  |
| `welder_id_4` | text |  |  |
| `wps_code` | text |  |  |
| `ut1_date` | date |  |  |
| `ut1_rep_no` | text |  |  |
| `ut1_result` | text |  |  |
| `ut_ope1` | text |  |  |
| `ut_ope2` | text |  |  |
| `weld_defect_length` | numeric(18,12) |  |  |
| `tpi_date` | date |  |  |
| `tpi_report_no` | text |  |  |
| `pwht_date` | date |  |  |
| `pwht_rep_no` | text |  |  |
| `joint_id` | text |  |  |

### `ref_welder_perf_cum` - 230,126 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `kind` | text | yes |  |
| `row_no` | integer | yes |  |
| `load_id` | bigint |  |  |
| `week_start` | date |  |  |
| `weeknum` | text |  |  |
| `week_end` | date |  |  |
| `period` | text |  |  |
| `last_rt_date` | date |  |  |
| `sub_contractor` | text |  |  |
| `status` | text |  |  |
| `welder_id` | text |  |  |
| `ratio` | numeric |  |  |
| `welder_count` | integer |  |  |

### `ref_welder_qualification` - 5,484 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `load_id` | bigint | yes |  |
| `sl_no` | text |  |  |
| `discipline` | text |  |  |
| `welder_name` | text |  |  |
| `wqt_no` | text |  |  |
| `welder_no` | text |  |  |
| `wps_no` | text |  |  |
| `date_of_test` | date |  |  |
| `welding_process` | text |  |  |
| `filler_materials` | text |  |  |
| `base_material` | text |  |  |
| `type_of_joint` | text |  |  |
| `working_location` | text |  |  |
| `vt_result` | text |  |  |
| `rt_result` | text |  |  |
| `status` | text |  |  |
| `remarks` | text |  |  |
| `sub_contractor` | text |  |  |
| `sub_contractor_raw` | text |  |  |
| `welder_id_name` | text |  |  |
| `welder_id_code_sub` | text |  |  |

### `ref_welder_status_weekly` - 6,288 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `week_end_date` | date | yes |  |
| `sub_contractor` | text | yes |  |
| `category` | text | yes |  |
| `value` | numeric |  |  |
| `category_raw` | text |  |  |
| `period_raw` | text |  |  |
| `week_raw` | text |  |  |
| `load_id` | bigint |  |  |

### `ref_wps_process` - 266 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `wps_no` | text | yes |  |
| `wps_no_raw` | text |  |  |
| `sn` | integer |  |  |
| `sctr` | text |  |  |
| `welding_process` | text | yes |  |
| `welding_machine_type` | text |  |  |
| `load_id` | bigint |  |  |

### `ref_wps_pwht_status` - 34 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `wps_no` | text | yes |  |
| `wps_no_raw` | text |  |  |
| `pwht_yn` | text | yes |  |
| `thickness_note` | text |  |  |
| `load_id` | bigint |  |  |

### `ref_wps_register` - 318 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `wps_no` | text | yes |  |
| `document_status` | text |  | M91 counts DISTINCT wps_no WHERE this = 'WPS APPROVED BY CTJV/ CPY' -> 318. The filter is a no-op today (one distinct value) and is kept anyway, as the DAX has it. |
| `as_of` | date |  | The SOURCE FILE mtime (2026-08-04) — the sheet carries no date. State it as such in any widget, as with ref_qualified_welders (R3-10). |
| `notes` | text |  |  |
| `sctr` | text |  |  |
| `wps_rev_no` | text |  |  |
| `pqr_no_rev` | text |  |  |
| `welding_process_es` | text |  |  |
| `welding_process_mode` | text |  |  |
| `pqr_material_1` | text |  |  |
| `pqr_material_2` | text |  |  |
| `pwht` | text |  |  |
| `application` | text |  |  |
| `sn` | integer |  | The sheet's own row number. Provenance only. The pbix's three 1:1 edges from Sn./S.N into Flg CCC_Flange Repair[SN] are row-number auto-detections and are NEVER reproduced (R4-05). |
| `load_id` | bigint |  |  |

### `ref_wps_status_cum` - 272 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `week_end_date` | date | yes |  |
| `metric` | text | yes |  |
| `value` | numeric |  |  |
| `load_id` | bigint |  |  |

### `saved_view` - 1 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `page` | text | yes |  |
| `name` | text | yes |  |
| `query` | text | yes |  |
| `created_at` | timestamp with time zone | yes |  |

### `schema_migrations` - 66 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `filename` | text | yes |  |
| `sha256` | text | yes |  |
| `applied_at` | timestamp with time zone | yes |  |
| `duration_ms` | integer | yes |  |

### `spool` - 530,943 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `source` | spool_source | yes |  |
| `spool_id` | text | yes |  |
| `load_id` | bigint | yes |  |
| `iso_number` | text | yes |  |
| `spool_no` | text | yes |  |
| `iso_rev_no` | text |  |  |
| `spool_rev_no` | integer |  |  |
| `sheet_no` | integer |  |  |
| `barcode_number` | bigint |  |  |
| `spool_shop_sub_contractor` | text |  |  |
| `spool_field_sub_contractor` | text |  |  |
| `spool_paint_sub_contractor` | text |  |  |
| `shop_sub_contractor` | text |  |  |
| `field_sub_contractor` | text |  |  |
| `area_classification` | integer |  |  |
| `wbu` | integer |  |  |
| `pds_area` | text |  |  |
| `pds_area_type` | text |  |  |
| `line_no` | text |  |  |
| `system_no` | text |  |  |
| `subsystem_code` | text |  |  |
| `testpack_no` | text |  |  |
| `testpack_sub_contractor` | text |  |  |
| `service_class` | text |  |  |
| `service_cat` | text |  |  |
| `piping_group` | text |  |  |
| `matrl_type` | text |  |  |
| `ag_ug_pkg` | text |  |  |
| `lb_sb` | text |  |  |
| `paint_system` | text |  |  |
| `material_availability` | text |  |  |
| `shop_dia` | numeric(12,4) |  |  |
| `shop_di_comp` | numeric(12,4) |  |  |
| `field_dia` | numeric(12,4) |  |  |
| `field_di_comp` | numeric(12,4) |  |  |
| `spool_diameter` | numeric(12,4) |  |  |
| `spool_weight` | numeric(14,4) |  |  |
| `spool_length` | numeric(12,4) |  |  |
| `spool_volume` | numeric(14,6) |  |  |
| `surface_area` | numeric(14,4) |  |  |
| `spool_inch_meter` | numeric(14,4) |  |  |
| `fabrication_order` | date |  |  |
| `material_issue` | date |  |  |
| `cut_fit` | date |  |  |
| `mir_no` | text |  |  |
| `mir_date` | date |  |  |
| `start_fab` | date |  |  |
| `fabricated` | date |  |  |
| `qc_release` | date |  |  |
| `qc_sign_off` | text |  |  |
| `pwht_date` | date |  |  |
| `shop_nde_done` | date |  |  |
| `sent_to_paint` | date |  |  |
| `painted` | date |  |  |
| `final_qc` | date |  |  |
| `paint_report_date` | date |  |  |
| `paint_report_no` | text |  |  |
| `laydown` | date |  |  |
| `laydown_move` | date |  |  |
| `to_site` | date |  |  |
| `erected` | date |  |  |
| `welded_bolt` | date |  |  |
| `supported` | date |  |  |
| `rft` | date |  |  |
| `field_weld_complete` | date |  |  |
| `field_nde_done` | date |  |  |
| `erec_mir_no` | text |  |  |
| `erec_mir_date` | date |  |  |
| `testpack_test_done_date` | date |  |  |
| `spool_nde_status` | text |  |  |
| `assembly_weld_nde_completed` | text |  |  |
| `field_weld_nde_completed` | text |  |  |
| `revision_status` | text |  |  |
| `revision_comments` | text |  |  |
| `hold_status` | text |  |  |
| `hold_comments` | text |  |  |
| `location_status` | text |  |  |
| `spool_tracking_date` | date |  |  |

### `stg_weld_dump` - 1,004,566 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `load_id` | bigint | yes |  |
| `line_no` | bigint | yes |  |
| `iso_number` | text |  |  |
| `iso_rev_no` | text |  |  |
| `spool_no` | text |  |  |
| `weld_no` | text |  |  |
| `spool_rev_no` | text |  |  |
| `weld_cat` | text |  |  |
| `weld_type` | text |  |  |
| `dia_inch_factor` | text |  |  |
| `dia_inch` | text |  |  |
| `thickness` | text |  |  |
| `pds_area` | text |  |  |
| `ag_ug_pkg` | text |  |  |
| `area_classification` | text |  |  |
| `wbu` | text |  |  |
| `system_no` | text |  |  |
| `testpack_no` | text |  |  |
| `service_class` | text |  |  |
| `service_cat` | text |  |  |
| `material_type` | text |  |  |
| `mir_no` | text |  |  |
| `mir_date` | text |  |  |
| `cutting_date` | text |  |  |
| `beveling_date` | text |  |  |
| `fitup_date` | text |  |  |
| `preheat_date` | text |  |  |
| `weld_date` | text |  |  |
| `dwir_no` | text |  |  |
| `sub_contractor` | text |  |  |
| `rework_code` | text |  |  |
| `weldpoint_no` | text |  |  |
| `wps_no` | text |  |  |
| `welder` | text |  |  |
| `pwht_y_n` | text |  |  |
| `pwht_weld_status` | text |  |  |
| `pwht_selected_date` | text |  |  |
| `pwht_selected_by` | text |  |  |
| `pwht_exam_req_date` | text |  |  |
| `pwht_exam_req_no` | text |  |  |
| `pwht_exam_req_by` | text |  |  |
| `pwht_date` | text |  |  |
| `pwht_report` | text |  |  |
| `pwht_acc_rej` | text |  |  |
| `pwht_client_exam_req_y_n` | text |  |  |
| `pwht_remarks` | text |  |  |
| `ht_pct` | text |  |  |
| `ht_batch_no` | text |  |  |
| `ht_batch_status` | text |  |  |
| `ht_weld_status` | text |  |  |
| `ht_selected_date` | text |  |  |
| `ht_selected_by` | text |  |  |
| `ht_exam_req_date` | text |  |  |
| `ht_exam_req_no` | text |  |  |
| `ht_exam_req_by` | text |  |  |
| `ht_date` | text |  |  |
| `ht_report` | text |  |  |
| `ht_acc_rej` | text |  |  |
| `ht_client_exam_req_y_n` | text |  |  |
| `ht_remarks` | text |  |  |
| `rt_pct` | text |  |  |
| `rt_batch_no` | text |  |  |
| `rt_batch_status` | text |  |  |
| `rt_weld_status` | text |  |  |
| `rt_selected_date` | text |  |  |
| `rt_selected_by` | text |  |  |
| `rt_exam_req_date` | text |  |  |
| `rt_exam_req_no` | text |  |  |
| `rt_exam_req_by` | text |  |  |
| `rt_date` | text |  |  |
| `rt_xray_no` | text |  |  |
| `rt_report` | text |  |  |
| `rt_acc_rej` | text |  |  |
| `total_no_of_films_acc` | text |  |  |
| `total_no_of_films_rej` | text |  |  |
| `defect_code` | text |  |  |
| `location_of_defect` | text |  |  |
| `rt_re_shoot_rep` | text |  |  |
| `rt_re_shoot_data` | text |  |  |
| `rt_re_shoot_status` | text |  |  |
| `rt_re_shoot_reason` | text |  |  |
| `rt_re_shoot_films` | text |  |  |
| `weld_length` | text |  |  |
| `rej_length` | text |  |  |
| `rt_client_exam_req_y_n` | text |  |  |
| `by_ut` | text |  |  |
| `rt_remarks` | text |  |  |
| `ut_pct` | text |  |  |
| `ut_batch_no` | text |  |  |
| `ut_batch_status` | text |  |  |
| `ut_weld_status` | text |  |  |
| `ut_selected_date` | text |  |  |
| `ut_selected_by` | text |  |  |
| `ut_exam_req_date` | text |  |  |
| `ut_exam_req_no` | text |  |  |
| `ut_exam_req_by` | text |  |  |
| `ut_date` | text |  |  |
| `ut_report` | text |  |  |
| `ut_acc_rej` | text |  |  |
| `ut_client_exam_req_y_n` | text |  |  |
| `ut_remarks` | text |  |  |
| `mt_pct` | text |  |  |
| `mt_batch_no` | text |  |  |
| `mt_batch_status` | text |  |  |
| `mt_weld_status` | text |  |  |
| `mt_selected_date` | text |  |  |
| `mt_selected_by` | text |  |  |
| `mt_exam_req_date` | text |  |  |
| `mt_exam_req_no` | text |  |  |
| `mt_exam_req_by` | text |  |  |
| `mt_date` | text |  |  |
| `mt_report` | text |  |  |
| `mt_acc_rej` | text |  |  |
| `mt_client_exam_req_y_n` | text |  |  |
| `mt_remarks` | text |  |  |
| `pmi_pct` | text |  |  |
| `pmi_batch_no` | text |  |  |
| `pmi_batch_status` | text |  |  |
| `pmi_weld_status` | text |  |  |
| `pmi_selected_date` | text |  |  |
| `pmi_selected_by` | text |  |  |
| `pmi_exam_req_date` | text |  |  |
| `pmi_exam_req_no` | text |  |  |
| `pmi_exam_req_by` | text |  |  |
| `pmi_date` | text |  |  |
| `pmi_report` | text |  |  |
| `pmi_acc_rej` | text |  |  |
| `pmi_client_exam_req_y_n` | text |  |  |
| `pmi_remarks` | text |  |  |
| `pt_pct` | text |  |  |
| `pt_batch_no` | text |  |  |
| `pt_batch_status` | text |  |  |
| `pt_weld_status` | text |  |  |
| `pt_selected_date` | text |  |  |
| `pt_selected_by` | text |  |  |
| `pt_exam_req_date` | text |  |  |
| `pt_exam_req_no` | text |  |  |
| `pt_exam_req_by` | text |  |  |
| `pt_date` | text |  |  |
| `pt_report` | text |  |  |
| `pt_acc_rej` | text |  |  |
| `pt_client_exam_req_y_n` | text |  |  |
| `pt_remarks` | text |  |  |
| `fn_pct` | text |  |  |
| `fn_batch_no` | text |  |  |
| `fn_batch_status` | text |  |  |
| `fn_weld_status` | text |  |  |
| `fn_selected_date` | text |  |  |
| `fn_selected_by` | text |  |  |
| `fn_exam_req_date` | text |  |  |
| `fn_exam_req_no` | text |  |  |
| `fn_exam_req_by` | text |  |  |
| `fn_date` | text |  |  |
| `fn_report` | text |  |  |
| `fn_acc_rej` | text |  |  |
| `fn_client_exam_req_y_n` | text |  |  |
| `fn_remarks` | text |  |  |
| `padlt_y_n` | text |  |  |
| `padlt_weld_status` | text |  |  |
| `padlt_selected_date` | text |  |  |
| `padlt_selected_by` | text |  |  |
| `padlt_exam_req_date` | text |  |  |
| `padlt_exam_req_no` | text |  |  |
| `padlt_exam_req_by` | text |  |  |
| `padlt_date` | text |  |  |
| `padlt_report` | text |  |  |
| `padlt_acc_rej` | text |  |  |
| `padlt_client_exam_req_y_n` | text |  |  |
| `padlt_remarks` | text |  |  |
| `orif_y_n` | text |  |  |
| `orif_weld_status` | text |  |  |
| `orif_selected_date` | text |  |  |
| `orif_selected_by` | text |  |  |
| `orif_exam_req_date` | text |  |  |
| `orif_exam_req_no` | text |  |  |
| `orif_exam_req_by` | text |  |  |
| `orif_date` | text |  |  |
| `orif_report` | text |  |  |
| `orif_acc_rej` | text |  |  |
| `orif_client_exam_req_y_n` | text |  |  |
| `matrl_traceability_y_n` | text |  |  |
| `group_1` | text |  |  |
| `ident_code_1` | text |  |  |
| `trac_no_1` | text |  |  |
| `part_1` | text |  |  |
| `group_2` | text |  |  |
| `ident_code_2` | text |  |  |
| `trac_no_2` | text |  |  |
| `part_2` | text |  |  |
| `revision_status` | text |  |  |
| `revision_comments` | text |  |  |
| `hold_status` | text |  |  |
| `hold_comments` | text |  |  |
| `piping_group` | text |  |  |
| `golden_weld_report_date` | text |  |  |
| `golden_weld_report_no` | text |  |  |
| `custom3` | text |  |  |
| `ut_operator_id` | text |  |  |
| `manual_ut_date` | text |  |  |
| `manual_ut_report_no` | text |  |  |
| `manual_ut_status` | text |  |  |
| `tpi_cross_checked` | text |  |  |
| `checked_date` | text |  |  |
| `result_a_r` | text |  |  |
| `custom11` | text |  |  |
| `custom12` | text |  |  |
| `custom13` | text |  |  |
| `golden_weld` | text |  |  |
| `subsystem_code` | text |  |  |
| `commissioning_package` | text |  |  |
| `ped` | text |  |  |
| `priority_no` | text |  |  |
| `gwbs` | text |  |  |
| `pds_area_type` | text |  |  |
| `shipment_date` | text |  |  |
| `packing_list_no` | text |  |  |
| `shipment_recv_date` | text |  |  |
| `erec_mir_date` | text |  |  |
| `erec_mir_no` | text |  |  |
| `sheet_no` | text |  |  |
| `testpack_sub_contractor` | text |  |  |
| `testpack_test_done_date` | text |  |  |
| `weldtypeparameter` | text |  |  |
| `pip_001_a` | text |  |  |
| `w24dwir` | text |  |  |

### `user_session` - 5 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `token_hash` | text | yes |  |
| `user_id` | bigint | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `expires_at` | timestamp with time zone | yes |  |

### `ut_tracker_ctjv` - 165 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `tracker` | text | yes |  |
| `sl` | integer | yes |  |
| `joint_id` | text |  |  |
| `mut_report_no` | text |  |  |
| `result` | text |  |  |
| `date_of_exam` | date |  |  |
| `cross_verification` | text |  |  |
| `verification_date` | date |  |  |
| `verification_by` | text |  |  |

### `weld` - 6,620,809 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `id` | bigint | yes |  |
| `source` | weld_source | yes | Dump header "Source" (text). |
| `load_id` | bigint | yes |  |
| `joint_id` | text | yes | Dump header "Joint ID" (text). |
| `spool_id` | text | yes | Dump header "Spool ID" (text). |
| `iso_number` | text |  | Dump header "ISO Number" (text). |
| `iso_rev_no` | text |  | Dump header "Iso Rev No." (text). |
| `spool_no` | text |  | Dump header "Spool No." (text). |
| `weld_no` | text |  | Dump header "Weld No." (text). |
| `spool_rev_no` | text |  | Dump header "Spool Rev No." (text). |
| `weld_cat` | text |  | Dump header "Weld Cat" (text). |
| `weld_type` | text |  | Dump header "Weld Type" (text). |
| `dia_inch_factor` | boolean |  | Dump header "Dia Inch Factor" (bool). |
| `dia_inch` | numeric(5,2) |  | Dump header "Dia inch" (num). |
| `thickness` | numeric(5,2) |  | Dump header "Thickness" (num). |
| `pds_area` | text |  | Dump header "PDS Area" (text). |
| `ag_ug_pkg` | text |  | Dump header "AG/UG/PKG" (text). |
| `area_classification` | integer |  | Dump header "Area Classification" (num). |
| `wbu` | integer |  | Dump header "WBU" (num). |
| `system_no` | text |  | Dump header "System no" (text). |
| `testpack_no` | text |  | Dump header "Testpack No" (text). |
| `service_class` | text |  | Dump header "Service class" (text). |
| `service_cat` | text |  | Dump header "Service Cat" (text). |
| `material_type` | text |  | Dump header "Material Type" (text). |
| `mir_no` | text |  | Dump header "MIR No" (text). |
| `mir_date` | date |  | Dump header "MIR Date" (date). |
| `cutting_date` | date |  | Dump header "Cutting Date" (date). |
| `beveling_date` | date |  | Dump header "Beveling Date" (date). |
| `fitup_date` | date |  | Dump header "Fitup Date" (date). |
| `preheat_date` | date |  | Dump header "Preheat Date" (date). |
| `weld_date` | date |  | Dump header "Weld Date" (date). |
| `dwir_no` | text |  | Dump header "DWIR No." (text). |
| `sub_contractor` | text |  | Dump header "Sub-Contractor" (text). |
| `rework_code` | text |  | Dump header "Rework Code" (text). |
| `weldpoint_no` | integer |  | Dump header "WeldPoint No." (num). |
| `wps_no` | text |  | Dump header "WPS No." (text). |
| `welder` | text |  | Dump header "Welder" (text). |
| `pwht_y_n` | text |  | Dump header "PWHT Y/N" (text). |
| `pwht_weld_status` | text |  | Dump header "PWHT Weld Status" (text). |
| `pwht_selected_date` | date |  | Dump header "PWHT Selected Date" (date). |
| `pwht_selected_by` | text |  | Dump header "PWHT Selected By" (text). |
| `pwht_exam_req_date` | date |  | Dump header "PWHT Exam Req date" (date). |
| `pwht_exam_req_no` | text |  | Dump header "PWHT Exam Req No" (text). |
| `pwht_exam_req_by` | text |  | Dump header "PWHT Exam Req By" (text). |
| `pwht_date` | date |  | Dump header "PWHT Date" (date). |
| `pwht_report` | text |  | Dump header "PWHT Report" (text). |
| `pwht_acc_rej` | text |  | Dump header "PWHT Acc/Rej" (text). |
| `pwht_client_exam_req_y_n` | boolean |  | Dump header "PWHT Client Exam Req Y/N" (bool). |
| `pwht_remarks` | text |  | Dump header "PWHT Remarks" (text). |
| `ht_pct` | integer |  | Dump header "HT%" (num). |
| `ht_weld_status` | text |  | Dump header "HT Weld Status" (text). |
| `ht_selected_date` | date |  | Dump header "HT Selected Date" (date). |
| `ht_selected_by` | text |  | Dump header "HT Selected By" (text). |
| `ht_exam_req_date` | date |  | Dump header "HT Exam Req date" (date). |
| `ht_exam_req_no` | text |  | Dump header "HT Exam Req No" (text). |
| `ht_exam_req_by` | text |  | Dump header "HT Exam Req By" (text). |
| `ht_date` | date |  | Dump header "HT Date" (date). |
| `ht_report` | text |  | Dump header "HT Report" (text). |
| `ht_acc_rej` | text |  | Dump header "HT Acc/Rej" (text). |
| `ht_client_exam_req_y_n` | boolean |  | Dump header "HT Client Exam Req Y/N" (bool). |
| `ht_remarks` | text |  | Dump header "HT Remarks" (text). |
| `rt_pct` | integer |  | Dump header "RT%" (num). |
| `rt_batch_no` | integer |  | Dump header "RT Batch No" (num). |
| `rt_batch_status` | text |  | Dump header "RT Batch Status" (text). |
| `rt_weld_status` | text |  | Dump header "RT Weld Status" (text). |
| `rt_selected_date` | date |  | Dump header "RT Selected Date" (date). |
| `rt_selected_by` | text |  | Dump header "RT Selected By" (text). |
| `rt_exam_req_date` | date |  | Dump header "RT Exam Req date" (date). |
| `rt_exam_req_no` | text |  | Dump header "RT Exam Req No" (text). |
| `rt_exam_req_by` | text |  | Dump header "RT Exam Req By" (text). |
| `rt_date` | date |  | Dump header "RT Date" (date). |
| `rt_xray_no` | text |  | Dump header "RT Xray No" (text). |
| `rt_report` | text |  | Dump header "RT Report" (text). |
| `rt_acc_rej` | text |  | Dump header "RT Acc/Rej" (text). |
| `total_no_of_films_acc` | numeric(10,4) |  | Dump header "Total No of films Acc" (num). |
| `total_no_of_films_rej` | numeric(10,4) |  | Dump header "Total No of films Rej" (num). |
| `defect_code` | text |  | Dump header "Defect Code" (text). |
| `location_of_defect` | text |  | Dump header "Location of Defect" (text). |
| `rt_re_shoot_rep` | text |  | Dump header "RT Re-Shoot Rep" (text). |
| `rt_re_shoot_data` | date |  | Dump header "RT Re-Shoot Data" (date). |
| `rt_re_shoot_status` | text |  | Dump header "RT Re-Shoot Status" (text). |
| `rt_re_shoot_reason` | text |  | Dump header "RT Re-Shoot Reason" (text). |
| `rt_re_shoot_films` | integer |  | Dump header "RT Re-Shoot Films" (num). |
| `weld_length` | numeric(12,4) |  | Dump header "Weld Length" (num). |
| `rej_length` | numeric(12,4) |  | Dump header "Rej Length" (num). |
| `rt_client_exam_req_y_n` | boolean |  | Dump header "RT Client Exam Req Y/N" (bool). |
| `by_ut` | boolean |  | Dump header "By UT" (bool). |
| `rt_remarks` | text |  | Dump header "RT Remarks" (text). |
| `ut_pct` | integer |  | Dump header "UT%" (num). |
| `ut_weld_status` | text |  | Dump header "UT Weld Status" (text). |
| `ut_selected_date` | date |  | Dump header "UT Selected Date" (date). |
| `ut_selected_by` | text |  | Dump header "UT Selected By" (text). |
| `ut_date` | date |  | Dump header "UT Date" (date). |
| `ut_report` | text |  | Dump header "UT Report" (text). |
| `ut_acc_rej` | text |  | Dump header "UT Acc/Rej" (text). |
| `ut_client_exam_req_y_n` | boolean |  | Dump header "UT Client Exam Req Y/N" (bool). |
| `ut_remarks` | text |  | Dump header "UT Remarks" (text). |
| `mt_pct` | integer |  | Dump header "MT%" (num). |
| `mt_batch_no` | integer |  | Dump header "MT Batch No" (num). |
| `mt_batch_status` | text |  | Dump header "MT Batch Status" (text). |
| `mt_weld_status` | text |  | Dump header "MT Weld Status" (text). |
| `mt_selected_date` | date |  | Dump header "MT Selected Date" (date). |
| `mt_selected_by` | text |  | Dump header "MT Selected By" (text). |
| `mt_exam_req_date` | date |  | Dump header "MT Exam Req date" (date). |
| `mt_exam_req_no` | text |  | Dump header "MT Exam Req No" (text). |
| `mt_exam_req_by` | text |  | Dump header "MT Exam Req By" (text). |
| `mt_date` | date |  | Dump header "MT Date" (date). |
| `mt_report` | text |  | Dump header "MT Report" (text). |
| `mt_acc_rej` | text |  | Dump header "MT Acc/Rej" (text). |
| `mt_client_exam_req_y_n` | boolean |  | Dump header "MT Client Exam Req Y/N" (bool). |
| `mt_remarks` | text |  | Dump header "MT Remarks" (text). |
| `pmi_pct` | integer |  | Dump header "PMI%" (num). |
| `pmi_batch_no` | integer |  | Dump header "PMI Batch No" (num). |
| `pmi_batch_status` | text |  | Dump header "PMI Batch Status" (text). |
| `pmi_weld_status` | text |  | Dump header "PMI Weld Status" (text). |
| `pmi_selected_date` | date |  | Dump header "PMI Selected Date" (date). |
| `pmi_selected_by` | text |  | Dump header "PMI Selected By" (text). |
| `pmi_exam_req_date` | date |  | Dump header "PMI Exam Req date" (date). |
| `pmi_exam_req_no` | text |  | Dump header "PMI Exam Req No" (text). |
| `pmi_exam_req_by` | text |  | Dump header "PMI Exam Req By" (text). |
| `pmi_date` | date |  | Dump header "PMI Date" (date). |
| `pmi_report` | text |  | Dump header "PMI Report" (text). |
| `pmi_acc_rej` | text |  | Dump header "PMI Acc/Rej" (text). |
| `pmi_client_exam_req_y_n` | boolean |  | Dump header "PMI Client Exam Req Y/N" (bool). |
| `pmi_remarks` | text |  | Dump header "PMI Remarks" (text). |
| `pt_pct` | integer |  | Dump header "PT%" (num). |
| `pt_batch_no` | integer |  | Dump header "PT Batch No" (num). |
| `pt_batch_status` | text |  | Dump header "PT Batch Status" (text). |
| `pt_weld_status` | text |  | Dump header "PT Weld Status" (text). |
| `pt_selected_date` | date |  | Dump header "PT Selected Date" (date). |
| `pt_selected_by` | text |  | Dump header "PT Selected By" (text). |
| `pt_exam_req_date` | date |  | Dump header "PT Exam Req date" (date). |
| `pt_exam_req_no` | text |  | Dump header "PT Exam Req No" (text). |
| `pt_exam_req_by` | text |  | Dump header "PT Exam Req By" (text). |
| `pt_date` | date |  | Dump header "PT Date" (date). |
| `pt_report` | text |  | Dump header "PT Report" (text). |
| `pt_acc_rej` | text |  | Dump header "PT Acc/Rej" (text). |
| `pt_client_exam_req_y_n` | boolean |  | Dump header "PT Client Exam Req Y/N" (bool). |
| `pt_remarks` | text |  | Dump header "PT Remarks" (text). |
| `fn_pct` | integer |  | Dump header "FN%" (num). |
| `padlt_y_n` | boolean |  | Dump header "PADLT Y/N" (bool). |
| `padlt_weld_status` | text |  | Dump header "PADLT Weld Status" (text). |
| `padlt_selected_date` | date |  | Dump header "PADLT Selected Date" (date). |
| `padlt_selected_by` | text |  | Dump header "PADLT Selected By" (text). |
| `padlt_exam_req_date` | date |  | Dump header "PADLT Exam Req date" (date). |
| `padlt_exam_req_no` | text |  | Dump header "PADLT Exam Req No" (text). |
| `padlt_exam_req_by` | text |  | Dump header "PADLT Exam Req By" (text). |
| `padlt_date` | date |  | Dump header "PADLT Date" (date). |
| `padlt_report` | text |  | Dump header "PADLT Report" (text). |
| `padlt_acc_rej` | text |  | Dump header "PADLT Acc/Rej" (text). |
| `padlt_client_exam_req_y_n` | boolean |  | Dump header "PADLT Client Exam Req Y/N" (bool). |
| `orif_y_n` | boolean |  | Dump header "ORIF Y/N" (bool). |
| `orif_weld_status` | text |  | Dump header "ORIF Weld Status" (text). |
| `orif_selected_date` | date |  | Dump header "ORIF Selected Date" (date). |
| `orif_selected_by` | text |  | Dump header "ORIF Selected By" (text). |
| `orif_exam_req_date` | date |  | Dump header "ORIF Exam Req date" (date). |
| `orif_exam_req_no` | text |  | Dump header "ORIF Exam Req No" (text). |
| `orif_exam_req_by` | text |  | Dump header "ORIF Exam Req By" (text). |
| `orif_date` | date |  | Dump header "ORIF Date" (date). |
| `orif_report` | text |  | Dump header "ORIF Report" (text). |
| `orif_acc_rej` | text |  | Dump header "ORIF Acc/Rej" (text). |
| `orif_client_exam_req_y_n` | boolean |  | Dump header "ORIF Client Exam Req Y/N" (bool). |
| `matrl_traceability_y_n` | boolean |  | Dump header "Matrl Traceability Y/N" (bool). |
| `group_1` | text |  | Dump header "GROUP-1" (text). |
| `ident_code_1` | text |  | Dump header "IDENT CODE-1" (text). |
| `trac_no_1` | text |  | Dump header "TRAC NO-1" (text). |
| `part_1` | text |  | Dump header "Part 1" (text). |
| `group_2` | text |  | Dump header "GROUP-2" (text). |
| `ident_code_2` | text |  | Dump header "IDENT CODE-2" (text). |
| `trac_no_2` | text |  | Dump header "TRAC NO-2" (text). |
| `part_2` | text |  | Dump header "Part 2" (text). |
| `revision_status` | text |  | Dump header "Revision Status" (text). |
| `revision_comments` | text |  | Dump header "Revision Comments" (text). |
| `hold_status` | text |  | Dump header "Hold Status" (text). |
| `hold_comments` | text |  | Dump header "Hold Comments" (text). |
| `piping_group` | text |  | Dump header "Piping Group" (text). |
| `golden_weld_report_date` | text |  | Dump header "Golden Weld Report Date" (text). |
| `golden_weld_report_no` | text |  | Dump header "Golden Weld Report No" (text). |
| `ut_operator_id` | text |  | Dump header "UT Operator ID" (text). |
| `manual_ut_date` | text |  | Dump header "Manual UT Date" (text). |
| `manual_ut_report_no` | text |  | Dump header "Manual UT Report No" (text). |
| `manual_ut_status` | text |  | Dump header "Manual UT Status" (text). |
| `tpi_cross_checked` | text |  | Dump header "TPI Cross Checked" (text). |
| `checked_date` | text |  | Dump header "Checked Date" (text). |
| `result_a_r` | text |  | Dump header "Result (A/R)" (text). |
| `golden_weld` | text |  | Dump header "Golden Weld" (text). |
| `subsystem_code` | text |  | Dump header "Subsystem Code" (text). |
| `priority_no` | text |  | Dump header "Priority No" (text). |
| `pds_area_type` | text |  | Dump header "PDS Area Type" (text). |
| `shipment_date` | date |  | Dump header "SHIPMENT DATE" (date). |
| `packing_list_no` | date |  | Dump header "PACKING LIST NO" (date). |
| `shipment_recv_date` | date |  | Dump header "SHIPMENT RECV DATE" (date). |
| `erec_mir_date` | date |  | Dump header "EREC MIR DATE" (date). |
| `erec_mir_no` | text |  | Dump header "EREC MIR NO" (text). |
| `sheet_no` | integer |  | Dump header "SHEET NO" (num). |
| `testpack_sub_contractor` | text |  | Dump header "TESTPACK SUB CONTRACTOR" (text). |
| `testpack_test_done_date` | date |  | Dump header "TESTPACK TEST DONE DATE" (date). |
| `pip_001_a` | text |  | Dump header "PIP-001-A" (text). |
| `w24dwir` | text |  | Dump header "W24DWIR" (text). |
| `rt_ut` | text |  | Dump header "RT/UT" (text). |
| `ndt_remarks` | text |  | Dump header "NDT Remarks" (text). |
| `tracer_shot` | text |  | Dump header "Tracer Shot" (text). |
| `weld_point_code` | text |  | Dump header "Weld Point Code" (text). |
| `original_joint` | text |  | Dump header "Original Joint" (text). |
| `repair_suffix` | text |  | Dump header "Repair Suffix" (text). |
| `pwht_y_n_ccc` | text |  | Dump header "PWHT Y/N CCC" (text). |
| `pwht_report_no_ccc` | text |  | Dump header "PWHT Report No CCC" (text). |
| `pwht_date_no_ccc` | date |  | Dump header "PWHT Date CCC" (date). |
| `spool_status` | text |  | Dump header "Spool Status" (text). |
| `ha` | text |  | Dump header "HA" (text). |
| `repair_reweld` | text | yes | Dump header "Repair/Reweld" (text). |
| `service_class_cat_wd` | text |  | Dump header "Service Class + Service Cat" (text). |
| `service_class_cat_ndt` | text |  | Dump header "Service Class + Service Cat+NDT Remarks" (text). |
| `temporary_lines` | boolean | yes | Dump header "Temporary Lines" (bool). |
| `tmcp_pipe` | boolean | yes | Dump header "TMCP Pipe" (bool). |
| `exclude_ut_films` | boolean | yes | Dump header "Exclude UT Films" (bool). |
| `exclude_debris_films` | boolean | yes | Dump header "Exclude Debris Films" (bool). |
| `is_cancelled` | boolean |  |  |
| `area_classification_label` | text |  | Dump header "Area Classification Label" (text). |
| `weldpoint_seq` | integer |  | Dump header "WeldPoint No.1 WP1" (num). |
| `welder_id` | text |  | welder // '-' // sub_contractor. Badge numbers collide across subcontractors; group by this, not by welder. |
| `testpack_no_all` | text |  | Dump header "Testpack No (All)" (text). |
| `manual_ut_report_no_all` | text |  | Dump header "Manual UT Report No." (text). |
| `manual_ut_status_all` | text |  | Dump header "Manual UT Status." (text). |
| `manual_ut_date_all` | date |  | Dump header "Manual UT Date." (date). |
| `ut_operator_id_all` | text |  | Dump header "UT Operator ID." (text). |
| `ut_report_all` | text |  | Dump header "UT Report (All)" (text). |
| `ut_date_all` | date |  | Dump header "UT Date (All)" (date). |
| `mt_report_ccc` | text |  | Dump header "MT Report CCC" (text). |
| `mt_date_ccc` | date |  | Dump header "MT Date CCC" (date). |
| `mt_pct_ccc` | integer |  | Dump header "MT% CCC" (num). |
| `pt_report_ccc` | text |  | Dump header "PT Report CCC" (text). |
| `pt_date_ccc` | date |  | Dump header "PT Date CCC" (date). |
| `pt_pct_ccc` | integer |  | Dump header "PT% CCC" (num). |
| `pmi_report_ccc` | text |  | Dump header "PMI Report CCC" (text). |
| `pmi_date_ccc` | date |  | Dump header "PMI Date CCC" (date). |
| `ht_report_ccc` | text |  | Dump header "HT Report CCC" (text). |
| `ht_date_ccc` | date |  | Dump header "HT Date CCC" (date). |
| `dwir_ccc_from_jr` | text |  | Dump header "DWIR CCC (Joint Record)" (text). |
| `thickness_from_jr` | numeric(8,2) |  | Dump header "Thickness (Joint Record)" (num). |
| `rework_code_all` | text |  | Dump header "Rework Code (All)" (text). |
| `rt_film_total` | numeric(10,4) |  | Dump header "RT Film Total" (num). |
| `weld_length_m` | numeric(10,4) |  | Dump header "Weld Length m" (num). |
| `inspected_length_mm` | numeric(12,3) |  | Dump header "Inspected Length(MM)." (num). |
| `defect_length_mm` | numeric(12,3) |  | Dump header "Defect Length(MM)." (num). |
| `week_end_date_rt` | date |  | Dump header "Week_End_Date RT" (date). |
| `sub_contractor_tier` | text |  | Dump header "Sub-Contractor Tier" (text). |
| `repair_length_mm` | numeric(12,3) |  | Dump header "Repair Length mm" (num). |
| `category_1` | text |  | Dump header "Category 1" (text). |
| `category_2` | text |  | Dump header "Category 2" (text). |
| `drg_no` | text |  | Dump header "Drg No" (text). |
| `process` | text |  | Dump header "process" (text). |
| `fitup_report_no` | text |  | Dump header "Fitup Report No." (text). |
| `first_prod_joint` | text |  | Dump header "First Prod. Joint" (text). |
| `aditional_joint_no_rt` | text |  | Dump header "Aditional Joint No.RT" (text). |
| `rt_p1_rep` | text |  | Dump header "RT P1 Rep." (text). |
| `p1_date` | date |  | Dump header "P1 Date" (date). |
| `rt_p2_rep` | text |  | Dump header "RT P2 Rep." (text). |
| `p2_date` | date |  | Dump header "P2 Date" (date). |
| `vbt_report` | text |  | Dump header "VBT Report" (text). |
| `vbt_date` | date |  | Dump header "VBT Date" (date). |
| `opt_report` | text |  | Dump header "OPT Report" (text). |
| `opt_date` | date |  | Dump header "OPT Date" (date). |
| `count_delimiter` | text |  | Dump header "CountDelimiter" (text). |
| `count_rows_count` | text |  | Dump header "Count Rows.Count" (text). |
| `pmi_pct_ccc` | integer |  | Dump header "PMI% CCC" (num). |
| `ht_pct_ccc` | integer |  | Dump header "HT% CCC" (num). |

### `weld_length_by_dia` - 100 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `dia_inch` | numeric(6,2) | yes |  |
| `weld_length` | numeric(12,9) | yes |  |

### `weld_manual_exclusion` - 4 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `joint_id` | text | yes |  |
| `reason` | text |  |  |
| `added_at` | timestamp with time zone | yes |  |
| `rt_pct` | integer |  | RT/UT(%) of this joint in the CCC welder record, captured at load time by scripts/load-exclusion-list.ts. Exists so [RT BACKLOG RT100% Talisman] can resolve `RT% from Project WD+WR` for joints the M step removed from the union — TALISMAN DATA is not subject to that step. Read by nothing else; it cannot move a union measure. |

### `weld_weekly_snapshot` - 11,106 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `week_end_date` | date | yes |  |
| `sub_contractor` | text | yes |  |
| `metric` | text | yes |  |
| `value` | numeric |  |  |
| `load_id` | bigint |  |  |
| `recorded_at` | timestamp with time zone | yes |  |
| `scope` | text | yes | Qualifier split off the workbook label: ALL / SG / TMCP / NONSG. Ruling R2-08. |
| `label_raw` | text |  | The workbook cell verbatim (e.g. "GAC SG", "Inco"), so the normalisation is auditable. |

### `welder_perf_note` - 0 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `kind` | text | yes |  |
| `cutoff` | date | yes |  |
| `sub_contractor` | text | yes |  |
| `body` | text | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

### `mv_grid_batch` - 14,681 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `joints` | bigint |  |  |

### `mv_grid_inco` - 238 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `ratio_15` | numeric |  |  |
| `ratio_30` | numeric |  |  |

### `mv_grid_joint` - 2,394,979 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `dup_weld_date` | bigint |  |  |
| `dup_rt_date` | bigint |  |  |
| `dup_rt_report` | bigint |  |  |

### `mv_grid_joint_tp` - 2,394,979 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `tp_ccc` | text |  |  |
| `tp_other` | text |  |  |

### `mv_grid_material` - 93 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `rt_ratio` | numeric |  |  |

### `mv_grid_rt_report` - 210,676 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `joints` | bigint |  |  |

### `mv_grid_sc` - 956 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `sc` | text |  |  |
| `cover` | numeric |  |  |

### `mv_grid_sc_sub` - 1,209 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `sc` | text |  |  |
| `sub` | text |  |  |
| `rt_film` | numeric |  |  |
| `welders_no_rt` | bigint |  |  |

### `mv_grid_total` - 1 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | integer |  |  |
| `pct_reject` | numeric |  |  |

### `mv_grid_tp` - 29,095 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `ratio` | numeric |  |  |
| `complete` | numeric |  |  |

### `mv_grid_welder` - 3,943 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `rt_film` | numeric |  |  |
| `ut_ratio` | numeric |  |  |

### `mv_grid_welder_sc` - 134,822 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `sc` | text |  |  |
| `has_rt` | bigint |  |  |

### `mv_grid_wps` - 291 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `k` | text |  |  |
| `rt_ratio` | numeric |  |  |

### `mv_joint` - 2,394,991 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `source` | weld_source |  |  |
| `joint_id` | text |  |  |
| `spool_id` | text |  |  |
| `sub_contractor` | text |  |  |
| `weld_cat` | text |  |  |
| `weld_type` | text |  |  |
| `rt_pct` | integer |  |  |
| `service_cat` | text |  |  |
| `service_class_cat_wd` | text |  |  |
| `service_class_cat_ndt` | text |  |  |
| `tmcp_pipe` | boolean |  |  |
| `temporary_lines` | boolean |  |  |
| `dia_inch_factor` | text |  |  |
| `wps_no` | text |  |  |
| `ha` | text |  |  |
| `area_classification_label` | text |  |  |
| `pds_area` | text |  |  |
| `weld_date` | date |  |  |
| `weld_date_norepair` | date |  |  |
| `rt_backlog_weld_date` | date |  |  |
| `rt_backlog_prall_weld_date` | date |  |  |
| `pwht_backlog_weld_date` | date |  |  |
| `pwht_backlog_prall_weld_date` | date |  |  |
| `has_pwht_status` | boolean |  |  |
| `is_welded_norepair` | boolean |  |  |
| `is_welded` | boolean |  |  |
| `mt_done` | boolean |  |  |
| `pt_done` | boolean |  |  |
| `mt_done_prall` | boolean |  |  |
| `pt_done_prall` | boolean |  |  |
| `ht_done_prall` | boolean |  |  |
| `pmi_done_prall` | boolean |  |  |
| `ut_report_prall` | boolean |  |  |
| `ut_rejected_prall_v2` | boolean |  |  |
| `dia_inch_welded` | numeric |  |  |
| `is_tested_ep` | boolean |  |  |
| `is_tested_prall` | boolean |  |  |
| `is_rejected` | boolean |  |  |
| `is_rt_reported` | boolean |  |  |
| `films_wp1` | numeric |  |  |
| `films_acc_wp1` | numeric |  |  |
| `films_rej_wp1` | numeric |  |  |
| `films_all` | numeric |  |  |
| `films_all_acc` | numeric |  |  |
| `films_all_rej` | numeric |  |  |
| `films_taken_prall` | numeric |  |  |
| `films_rej_prall` | numeric |  |  |
| `films_all_prall` | numeric |  |  |
| `films_all_rej_prall` | numeric |  |  |
| `rt_backlog` | boolean |  |  |
| `rt100_backlog` | boolean |  |  |
| `rt_backlog_pwht_y_done` | boolean |  |  |
| `rt_backlog_pwht_n` | boolean |  |  |
| `rt_backlog_pwht_y_not_done` | boolean |  |  |
| `rt_backlog_prall` | boolean |  |  |
| `rt100_backlog_prall` | boolean |  |  |
| `rt_backlog_pwht_y_done_prall` | boolean |  |  |
| `rt_backlog_pwht_n_prall` | boolean |  |  |
| `rt_backlog_pwht_y_not_done_prall` | boolean |  |  |
| `rt_backlog_pwht_y_not_done_ccc` | boolean |  |  |
| `is_fabricated` | boolean |  |  |
| `rt_backlog_fabricated` | boolean |  |  |
| `rt_backlog_pwht_ydone_or_n_fabricated` | boolean |  |  |
| `rt_backlog_pwht_ynotdone_fabricated` | boolean |  |  |
| `pwht_backlog` | boolean |  |  |
| `pwht_backlog_rt_types` | boolean |  |  |
| `pwht_backlog_rt100` | boolean |  |  |
| `pwht_backlog_rt_not_done` | boolean |  |  |
| `pwht_bl_rt_nd_sg_ccc` | boolean |  |  |
| `pwht_bl_rt_nd_sg_status` | boolean |  |  |
| `pwht_bl_rt_nd_tmcp_ccc` | boolean |  |  |
| `pwht_bl_rt_nd_tmcp_status` | boolean |  |  |
| `pwht_done` | boolean |  |  |
| `pwht_required` | boolean |  |  |
| `pwht_backlog_ccc` | boolean |  |  |
| `pwht_backlog_ccc_rt` | boolean |  |  |
| `pwht_backlog_ccc_rt100` | boolean |  |  |
| `pwht_backlog_rest` | boolean |  |  |
| `pwht_backlog_rest_rt` | boolean |  |  |
| `pwht_backlog_rest_rt100` | boolean |  |  |
| `pwht_done_prall` | boolean |  |  |
| `pwht_required_ccc` | boolean |  |  |
| `pwht_y_n` | text |  |  |
| `pwht_y_n_ccc` | text |  |  |
| `ut_done` | boolean |  |  |
| `ut_accepted` | boolean |  |  |
| `ut_rejected` | boolean |  |  |
| `ut_weld_length_m` | numeric |  |  |
| `ut_rej_length_m` | numeric |  |  |
| `ut_done_prall` | boolean |  |  |
| `ut_rejected_prall` | boolean |  |  |
| `ut_weld_length_prall` | numeric |  |  |
| `ut_inspected_length_prall` | numeric |  |  |
| `ut_defect_length_prall` | numeric |  |  |
| `rt_bl_cand_prall` | boolean |  |  |
| `rt_bl_start` | date |  |  |
| `rt_bl_end` | date |  |  |
| `rt_bl_pwht_required` | boolean |  |  |
| `pwht_bl_end` | date |  |  |
| `pwht_bl_cand_ccc` | boolean |  |  |
| `pwht_bl_cand_rest` | boolean |  |  |
| `pwht_bl_start` | date |  |  |
| `rt_bl_ydone_n_fab_prall_dump` | boolean |  |  |
| `rt_bl_ydone_n_fab_prall_ccc` | boolean |  |  |
| `rt_bl_ynotdone_fab_prall_dump` | boolean |  |  |
| `rt_bl_ynotdone_fab_prall_ccc` | boolean |  |  |
| `by_ut_all` | text |  |  |
| `dia_inch` | numeric |  |  |
| `dia_band` | text |  |  |
| `rt_year` | integer |  |  |
| `rt_month` | integer |  |  |
| `weld_year` | integer |  |  |
| `weld_month` | integer |  |  |
| `rt_week_end` | date |  |  |
| `weld_week_end` | date |  |  |
| `pwht_y_n_ccc_new_y` | boolean |  |  |
| `pwht_backlog_ccc_new` | boolean |  |  |
| `rows_in_joint` | bigint |  |  |

### `mv_joint_attr` - 2,394,979 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `source` | weld_source |  |  |
| `joint_id` | text |  |  |
| `ndt_remarks` | text |  |  |
| `thickness` | numeric |  |  |
| `norepair` | boolean |  |  |
| `nrows` | bigint |  |  |
| `ut_len_rows` | numeric |  |  |
| `paut` | boolean |  |  |
| `paut_r` | boolean |  |  |

### `mv_joint_extra_type` - 1 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `source` | weld_source |  |  |
| `joint_id` | text |  |  |
| `weld_type` | text |  |  |

### `mv_joint_material` - 2,394,980 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `source` | weld_source |  |  |
| `joint_id` | text |  |  |
| `material_type` | text |  |  |

### `mv_joint_pairs` - 2,561,182 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `source` | weld_source |  |  |
| `joint_id` | text |  |  |
| `wps_no` | text |  |  |
| `material_type` | text |  |  |
| `welder_id` | text |  |  |
| `norepair` | boolean |  |  |
| `sub_contractor` | text |  |  |
| `weld_type` | text |  |  |
| `weld_cat` | text |  |  |
| `rt_pct` | integer |  |  |
| `ha` | text |  |  |
| `area_classification_label` | text |  |  |
| `service_class_cat_ndt` | text |  |  |
| `temporary_lines` | boolean |  |  |
| `is_welded_norepair` | boolean |  |  |
| `is_tested_prall` | boolean |  |  |
| `is_rejected` | boolean |  |  |
| `films_taken_prall` | numeric |  |  |
| `films_rej_prall` | numeric |  |  |

### `mv_joint_wps` - 2,261,654 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `source` | weld_source |  |  |
| `joint_id` | text |  |  |
| `wps_no` | text |  |  |
| `sub_contractor` | text |  |  |
| `weld_type` | text |  |  |
| `weld_cat` | text |  |  |
| `service_cat` | text |  |  |
| `rt_pct` | integer |  |  |
| `tmcp_pipe` | boolean |  |  |
| `temporary_lines` | boolean |  |  |
| `weld_date` | date |  |  |
| `is_welded_norepair` | boolean |  |  |
| `is_welded` | boolean |  |  |
| `is_tested_ep` | boolean |  |  |
| `is_rejected` | boolean |  |  |
| `films_all` | numeric |  |  |
| `films_all_rej` | numeric |  |  |

### `mv_row_slicer` - 2,413,896 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `source` | weld_source |  |  |
| `joint_id` | text |  |  |
| `rt_acc_rej` | text |  |  |
| `rt_report` | text |  |  |
| `rt_batch` | text |  |  |
| `iso` | text |  |  |
| `weld_date` | text |  |  |
| `rt_date` | text |  |  |
| `ut_report` | text |  |  |

### `mv_weekly_progress` - 21,676 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `week_end_date` | date |  |  |
| `source` | weld_source |  |  |
| `sub_contractor` | text |  |  |
| `weld_cat` | text |  |  |
| `weld_type` | text |  |  |
| `ha` | text |  |  |
| `area_classification_label` | text |  |  |
| `joints_welded` | bigint |  |  |
| `joints_welded_incl_repairs` | bigint |  |  |
| `tested` | bigint |  |  |
| `rejected` | bigint |  |  |
| `rt_backlog` | bigint |  |  |
| `rt100_backlog` | bigint |  |  |
| `pwht_backlog` | bigint |  |  |
| `pwht_done` | bigint |  |  |
| `films_taken` | numeric |  |  |
| `films_accepted` | numeric |  |  |
| `films_rejected` | numeric |  |  |
| `weld_length_m` | numeric |  |  |
| `rej_length_m` | numeric |  |  |
| `joints_in_group` | bigint |  |  |
| `rows_in_group` | numeric |  |  |

### `mv_welder_perf` - 2,550,990 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `sub_contractor` | text |  |  |
| `welder_id` | text |  |  |
| `joint_id` | text |  |  |
| `rt_report` | text |  |  |
| `ut_report_prall` | text |  |  |
| `ut_operator` | text |  |  |
| `weld_type` | text |  |  |
| `rt_pct` | integer |  |  |
| `weld_date` | date |  |  |
| `last_rt_date` | date |  |  |
| `last_ut_date` | date |  |  |
| `has_ut` | boolean |  |  |
| `is_repair` | boolean |  |  |
| `n_rows` | bigint |  |  |
| `f_rt` | boolean |  |  |
| `f_rt_r` | boolean |  |  |
| `f_not_rs` | boolean |  |  |
| `f_rt_cover` | boolean |  |  |
| `f_ut_r` | boolean |  |  |
| `films` | numeric |  |  |
| `films_a` | numeric |  |  |
| `films_r` | numeric |  |  |
| `films_w` | numeric |  |  |
| `films_r_w` | numeric |  |  |
| `films_j` | numeric |  |  |
| `films_j_r` | numeric |  |  |
| `insp` | numeric |  |  |
| `insp_wp` | numeric |  |  |
| `defect` | numeric |  |  |
| `defect_r` | numeric |  |  |
| `ut_len_joint` | numeric |  |  |
| `ut_len_welder` | numeric |  |  |

### `mv_welder_status` - 3,705 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `welder_id` | text |  |  |
| `cur` | date |  |  |
| `rt_w_15` | numeric |  |  |
| `rt_w_30` | numeric |  |  |
| `cover_w` | numeric |  |  |
| `ut_len_w` | numeric |  |  |
| `ut_len_w_15` | numeric |  |  |
| `ut_joint_w` | numeric |  |  |

### `mv_welder_sub_status` - 6 rows

| Column | Type | Not null | Meaning |
|---|---|:-:|---|
| `sub_contractor` | text |  |  |
| `ut_joint_s` | numeric |  |  |
| `ut_len_s` | numeric |  |  |

## 4. Keys and constraints

| Table | Constraint | Definition |
|---|---|---|
| `app_user` | app_user_email_check | `CHECK ((email = lower(email)))` |
| `app_user` | app_user_email_key | `UNIQUE (email)` |
| `app_user` | app_user_pkey | `PRIMARY KEY (id)` |
| `app_user` | app_user_role_check | `CHECK ((role = ANY (ARRAY['admin'::text, 'user'::text])))` |
| `audit_event` | audit_event_pkey | `PRIMARY KEY (id)` |
| `calendar` | calendar_pkey | `PRIMARY KEY (date)` |
| `ccc_joint_pwht` | ccc_joint_pwht_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE CASCADE` |
| `ccc_joint_pwht` | ccc_joint_pwht_pkey | `PRIMARY KEY (joint_id_jr)` |
| `col_pref` | col_pref_col_check | `CHECK (((length(col) >= 1) AND (length(col) <= 300)))` |
| `col_pref` | col_pref_label_check | `CHECK (((label IS NULL) OR ((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 120))))` |
| `col_pref` | col_pref_pkey | `PRIMARY KEY (table_key, col)` |
| `col_pref` | col_pref_table_key_check | `CHECK (((length(table_key) >= 1) AND (length(table_key) <= 4000)))` |
| `col_pref` | col_pref_width_check | `CHECK (((width IS NULL) OR ((width >= 24) AND (width <= 1200))))` |
| `flange` | flange_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE CASCADE` |
| `flange` | flange_pkey | `PRIMARY KEY (id)` |
| `flange_breakdown` | flange_breakdown_pkey | `PRIMARY KEY (week_date, sub_contractor)` |
| `load` | load_pkey | `PRIMARY KEY (id)` |
| `load` | load_source_vocabulary | `CHECK ((source = ANY (ARRAY['WELD_DUMP'::text, 'CCC_WELDER_RECORD'::text, 'CCC_JOINT_RECORD'::text, 'ACCIONA'::text, 'INCO'::text, 'SPOOL_DUMP'::text, 'TALISMAN_SPOOL'::text, 'WEEKLY_SNAPSHOT'::text, 'UT_TRACKER_CCC'::text, 'EXCLUSION_LIST'::text, 'MPI_DONE'::text, 'ACTIVE_WELDERS'::text, 'WELD_LENGTH'::text, 'WPS_REGISTER'::text, 'QUALIFIED_WELDERS'::text, 'WELDERS_SCTR'::text, 'WELDERS_QUALIFICATION'::text, 'WELDER_STATUS_WEEKLY'::text, 'CODE_LABELS'::text, 'FLANGE_PROGRESS'::text, 'OVASSETS_1619'::text, 'WPS_PROCESS'::text, 'WPS_STATUS_CUM'::text, 'WPS_PWHT_STATUS'::text, 'HA_GUIDE'::text, 'HA_L0_GUIDE'::text, 'TALISMAN_JOINT'::text, 'WELDER_PERF_CUM'::text])))` |
| `ref_active_welders` | ref_active_welders_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_active_welders` | ref_active_welders_pkey | `PRIMARY KEY (week_end_date, sub_contractor)` |
| `ref_code_label` | ref_code_label_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_code_label` | ref_code_label_pkey | `PRIMARY KEY (domain, code)` |
| `ref_exclusion_list` | ref_exclusion_list_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_exclusion_list` | ref_exclusion_list_pkey | `PRIMARY KEY (id)` |
| `ref_ha` | ref_ha_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_ha` | ref_ha_pkey | `PRIMARY KEY (location_number)` |
| `ref_ha_area` | ref_ha_area_pkey | `PRIMARY KEY (ha, area_classification)` |
| `ref_ha_guide` | ref_ha_guide_pkey | `PRIMARY KEY (location_number)` |
| `ref_mpi_done` | ref_mpi_done_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_mpi_done` | ref_mpi_done_pkey | `PRIMARY KEY (week_end_date)` |
| `ref_qualified_welders` | ref_qualified_welders_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_qualified_welders` | ref_qualified_welders_pkey | `PRIMARY KEY (sub_contractor)` |
| `ref_talisman_joint` | ref_talisman_joint_pkey | `PRIMARY KEY (joint_id)` |
| `ref_talisman_welder` | ref_talisman_welder_pkey | `PRIMARY KEY (joint_id, welder_id)` |
| `ref_ut_tracker_ccc` | ref_ut_tracker_ccc_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE CASCADE` |
| `ref_ut_tracker_ccc` | ref_ut_tracker_ccc_pkey | `PRIMARY KEY (id)` |
| `ref_welder_perf_cum` | ref_welder_perf_cum_kind_check | `CHECK ((kind = ANY (ARRAY['2w'::text, '1m'::text, 'ut2w'::text])))` |
| `ref_welder_perf_cum` | ref_welder_perf_cum_pkey | `PRIMARY KEY (kind, row_no)` |
| `ref_welder_qualification` | ref_welder_qualification_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE CASCADE` |
| `ref_welder_qualification` | ref_welder_qualification_pkey | `PRIMARY KEY (id)` |
| `ref_welder_status_weekly` | ref_welder_status_weekly_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_welder_status_weekly` | ref_welder_status_weekly_pkey | `PRIMARY KEY (week_end_date, sub_contractor, category)` |
| `ref_wps_process` | ref_wps_process_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_wps_process` | ref_wps_process_pkey | `PRIMARY KEY (wps_no)` |
| `ref_wps_pwht_status` | ref_wps_pwht_status_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_wps_pwht_status` | ref_wps_pwht_status_pkey | `PRIMARY KEY (wps_no)` |
| `ref_wps_register` | ref_wps_register_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_wps_register` | ref_wps_register_pkey | `PRIMARY KEY (wps_no)` |
| `ref_wps_status_cum` | ref_wps_status_cum_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `ref_wps_status_cum` | ref_wps_status_cum_pkey | `PRIMARY KEY (week_end_date, metric)` |
| `saved_view` | saved_view_name_check | `CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60)))` |
| `saved_view` | saved_view_page_name_key | `UNIQUE (page, name)` |
| `saved_view` | saved_view_pkey | `PRIMARY KEY (id)` |
| `schema_migrations` | schema_migrations_pkey | `PRIMARY KEY (filename)` |
| `spool` | spool_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE CASCADE` |
| `spool` | spool_pkey | `PRIMARY KEY (source, spool_id)` |
| `user_session` | user_session_pkey | `PRIMARY KEY (id)` |
| `user_session` | user_session_token_hash_key | `UNIQUE (token_hash)` |
| `user_session` | user_session_user_id_fkey | `FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE` |
| `ut_tracker_ctjv` | ut_tracker_ctjv_pkey | `PRIMARY KEY (tracker, sl)` |
| `weld` | weld_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE CASCADE` |
| `weld` | weld_pkey | `PRIMARY KEY (id)` |
| `weld_length_by_dia` | weld_length_by_dia_pkey | `PRIMARY KEY (dia_inch)` |
| `weld_manual_exclusion` | weld_manual_exclusion_pkey | `PRIMARY KEY (joint_id)` |
| `weld_weekly_snapshot` | weld_weekly_snapshot_load_id_fkey | `FOREIGN KEY (load_id) REFERENCES load(id) ON DELETE SET NULL` |
| `weld_weekly_snapshot` | weld_weekly_snapshot_pkey | `PRIMARY KEY (week_end_date, sub_contractor, scope, metric)` |
| `welder_perf_note` | welder_perf_note_kind_check | `CHECK ((kind = ANY (ARRAY['2w'::text, '1m'::text, 'ut2w'::text])))` |
| `welder_perf_note` | welder_perf_note_pkey | `PRIMARY KEY (kind, cutoff, sub_contractor)` |

## 5. Indexes

| Table | Index |
|---|---|
| `app_user` | `btree (id)` (app_user_pkey) |
| `app_user` | `btree (email)` (app_user_email_key) |
| `audit_event` | `btree (id)` (audit_event_pkey) |
| `audit_event` | `btree (at DESC)` (audit_event_at_idx) |
| `calendar` | `btree (date)` (calendar_pkey) |
| `calendar` | `btree (week_end_date)` (calendar_week) |
| `ccc_joint_pwht` | `btree (joint_id_jr)` (ccc_joint_pwht_pkey) |
| `ccc_joint_pwht` | `btree (load_id)` (ccc_joint_pwht_load) |
| `ccc_joint_pwht` | `btree (is_welded) WHERE (NOT is_welded)` (ccc_joint_pwht_notweld) |
| `col_pref` | `btree (table_key, col)` (col_pref_pkey) |
| `flange` | `btree (id)` (flange_pkey) |
| `flange` | `btree (joint_id)` (flange_joint) |
| `flange` | `btree (sub_contractor)` (flange_subcon) |
| `flange` | `btree (ha)` (flange_ha) |
| `flange` | `btree (joint_method)` (flange_method) |
| `flange` | `btree (source)` (flange_source_idx) |
| `flange` | `btree (load_id)` (flange_load) |
| `flange` | `btree (joint_date)` (flange_joint_date) |
| `flange` | `btree (sub_contractor, ha, joint_method)` (flange_scope) |
| `flange` | `btree (pcc_tightening_date) WHERE (pcc_tightening_date IS NOT NULL)` (flange_pcc_date) |
| `flange` | `btree (reason_for_de_tightening) WHERE (reason_for_de_tightening IS NOT NULL)` (flange_detighten) |
| `flange_breakdown` | `btree (week_date, sub_contractor)` (flange_breakdown_pkey) |
| `load` | `btree (id)` (load_pkey) |
| `load` | `btree (source, started_at DESC)` (load_source_started) |
| `ref_active_welders` | `btree (week_end_date, sub_contractor)` (ref_active_welders_pkey) |
| `ref_code_label` | `btree (domain, code)` (ref_code_label_pkey) |
| `ref_exclusion_list` | `btree (id)` (ref_exclusion_list_pkey) |
| `ref_exclusion_list` | `btree (rt_report, welder)` (ref_exclusion_list_key) |
| `ref_exclusion_list` | `btree (joint_id)` (ref_exclusion_list_joint) |
| `ref_ha` | `btree (location_number)` (ref_ha_pkey) |
| `ref_ha_area` | `btree (ha, area_classification)` (ref_ha_area_pkey) |
| `ref_ha_area` | `btree (ha)` (ref_ha_area_ha) |
| `ref_ha_guide` | `btree (location_number)` (ref_ha_guide_pkey) |
| `ref_ha_guide` | `btree (handover_area)` (ref_ha_guide_ha) |
| `ref_mpi_done` | `btree (week_end_date)` (ref_mpi_done_pkey) |
| `ref_qualified_welders` | `btree (sub_contractor)` (ref_qualified_welders_pkey) |
| `ref_talisman_joint` | `btree (joint_id)` (ref_talisman_joint_pkey) |
| `ref_talisman_joint` | `btree (joint_id) WHERE ((weld_date IS NOT NULL) AND (rt1_rep_no IS NULL))` (ref_talisman_joint_backlog) |
| `ref_talisman_welder` | `btree (joint_id, welder_id)` (ref_talisman_welder_pkey) |
| `ref_ut_tracker_ccc` | `btree (id)` (ref_ut_tracker_ccc_pkey) |
| `ref_ut_tracker_ccc` | `btree (joint_id)` (ref_ut_tracker_ccc_joint) |
| `ref_ut_tracker_ccc` | `btree (ut1_rep_no)` (ref_ut_tracker_ccc_report) |
| `ref_welder_perf_cum` | `btree (kind, row_no)` (ref_welder_perf_cum_pkey) |
| `ref_welder_perf_cum` | `btree (kind, period, sub_contractor)` (ref_welder_perf_cum_period) |
| `ref_welder_qualification` | `btree (id)` (ref_welder_qualification_pkey) |
| `ref_welder_qualification` | `btree (welder_id_code_sub)` (ref_welder_qual_key) |
| `ref_welder_qualification` | `btree (sub_contractor)` (ref_welder_qual_sub) |
| `ref_welder_qualification` | `btree (load_id)` (ref_welder_qual_load) |
| `ref_welder_status_weekly` | `btree (week_end_date, sub_contractor, category)` (ref_welder_status_weekly_pkey) |
| `ref_welder_status_weekly` | `btree (category, week_end_date)` (ref_welder_status_weekly_cat) |
| `ref_wps_process` | `btree (wps_no)` (ref_wps_process_pkey) |
| `ref_wps_pwht_status` | `btree (wps_no)` (ref_wps_pwht_status_pkey) |
| `ref_wps_register` | `btree (wps_no)` (ref_wps_register_pkey) |
| `ref_wps_status_cum` | `btree (week_end_date, metric)` (ref_wps_status_cum_pkey) |
| `saved_view` | `btree (id)` (saved_view_pkey) |
| `saved_view` | `btree (page, name)` (saved_view_page_name_key) |
| `schema_migrations` | `btree (filename)` (schema_migrations_pkey) |
| `spool` | `btree (source, spool_id)` (spool_pkey) |
| `spool` | `btree (spool_id)` (spool_spool_id) |
| `spool` | `btree (load_id)` (spool_load) |
| `spool` | `btree (iso_number)` (spool_iso) |
| `user_session` | `btree (id)` (user_session_pkey) |
| `user_session` | `btree (token_hash)` (user_session_token_hash_key) |
| `user_session` | `btree (user_id)` (user_session_user_id_idx) |
| `ut_tracker_ctjv` | `btree (joint_id)` (ut_tracker_ctjv_joint) |
| `ut_tracker_ctjv` | `btree (tracker, sl)` (ut_tracker_ctjv_pkey) |
| `weld` | `btree (id)` (weld_pkey) |
| `weld` | `btree (load_id)` (weld_load) |
| `weld` | `btree (source)` (weld_source_idx) |
| `weld` | `btree (sub_contractor, weld_date)` (weld_sub_date) |
| `weld` | `btree (joint_id)` (weld_joint) |
| `weld` | `btree (spool_id)` (weld_spool) |
| `weld` | `btree (rt_pct, sub_contractor) INCLUDE (weld_cat, weld_type)` (weld_rtpct_sub) |
| `weld` | `btree (service_class_cat_ndt)` (weld_svcclass) |
| `weld` | `btree (wps_no)` (weld_wps) |
| `weld` | `btree (weld_date)` (weld_weld_date) |
| `weld` | `btree (sub_contractor, rt_pct) WHERE ((rt_report IS NULL) AND (weld_date IS NOT NULL) AND (weld_type = ANY (ARRAY['BW'::text, 'GW'::text, 'CLET'::text, 'MW'::text])))` (weld_rt_backlog) |
| `weld` | `btree (sub_contractor) WHERE ((pwht_report IS NULL) AND (pwht_weld_status IS NOT NULL))` (weld_pwht_backlog) |
| `weld` | `btree (service_class_cat_wd)` (weld_svcclass_wd) |
| `weld` | `btree (welder_id)` (weld_welder_id) |
| `weld` | `btree (joint_id) WHERE (weldpoint_seq = 1)` (weld_wp1) |
| `weld` | `btree (testpack_no_all)` (weld_testpack_all) |
| `weld` | `btree (week_end_date_rt)` (weld_week_end_rt) |
| `weld` | `btree (sub_contractor_tier) WHERE (sub_contractor_tier IS NOT NULL)` (weld_sub_tier) |
| `weld` | `gin (joint_id gin_trgm_ops)` (weld_trgm_joint) |
| `weld` | `gin (spool_id gin_trgm_ops)` (weld_trgm_spool) |
| `weld` | `gin (iso_number gin_trgm_ops)` (weld_trgm_iso) |
| `weld` | `gin (rt_report gin_trgm_ops)` (weld_trgm_rt_rep) |
| `weld` | `gin (welder_id gin_trgm_ops)` (weld_trgm_welder) |
| `weld` | `btree (iso_number)` (weld_iso) |
| `weld` | `btree (rt_report) WHERE (rt_report IS NOT NULL)` (weld_rt_report) |
| `weld_length_by_dia` | `btree (dia_inch)` (weld_length_by_dia_pkey) |
| `weld_manual_exclusion` | `btree (joint_id)` (weld_manual_exclusion_pkey) |
| `weld_weekly_snapshot` | `btree (metric, week_end_date)` (weld_weekly_snapshot_metric) |
| `weld_weekly_snapshot` | `btree (week_end_date, sub_contractor, scope, metric)` (weld_weekly_snapshot_pkey) |
| `welder_perf_note` | `btree (kind, cutoff, sub_contractor)` (welder_perf_note_pkey) |
| `mv_grid_batch` | `btree (k)` (mv_grid_batch_k) |
| `mv_grid_inco` | `btree (k)` (mv_grid_inco_k) |
| `mv_grid_joint` | `btree (k)` (mv_grid_joint_k) |
| `mv_grid_joint_tp` | `btree (k)` (mv_grid_joint_tp_k) |
| `mv_grid_material` | `btree (k)` (mv_grid_material_k) |
| `mv_grid_rt_report` | `btree (k)` (mv_grid_rt_report_k) |
| `mv_grid_sc` | `btree (sc)` (mv_grid_sc_k) |
| `mv_grid_sc_sub` | `btree (sc, sub)` (mv_grid_sc_sub_k) |
| `mv_grid_total` | `btree (k)` (mv_grid_total_k) |
| `mv_grid_tp` | `btree (k)` (mv_grid_tp_k) |
| `mv_grid_welder` | `btree (k)` (mv_grid_welder_k) |
| `mv_grid_welder_sc` | `btree (k, sc)` (mv_grid_welder_sc_k) |
| `mv_grid_wps` | `btree (k)` (mv_grid_wps_k) |
| `mv_joint` | `btree (source, joint_id)` (mv_joint_key) |
| `mv_joint` | `btree (sub_contractor, rt_pct, service_cat)` (mv_joint_scope) |
| `mv_joint` | `btree (wps_no)` (mv_joint_wps_no) |
| `mv_joint` | `btree (weld_date)` (mv_joint_date) |
| `mv_joint` | `btree (source)` (mv_joint_source) |
| `mv_joint` | `btree (service_class_cat_wd)` (mv_joint_svcwd) |
| `mv_joint` | `btree (service_class_cat_ndt)` (mv_joint_svcndt) |
| `mv_joint_attr` | `btree (source, joint_id)` (mv_joint_attr_key) |
| `mv_joint_extra_type` | `btree (source, joint_id, weld_type)` (mv_joint_extra_type_key) |
| `mv_joint_material` | `btree (source, joint_id, material_type)` (mv_joint_material_key) |
| `mv_joint_material` | `btree (material_type)` (mv_joint_material_type) |
| `mv_joint_pairs` | `btree (source, joint_id, wps_no, material_type, welder_id) NULLS NOT DISTINCT` (mv_joint_pairs_key) |
| `mv_joint_pairs` | `btree (wps_no)` (mv_joint_pairs_wps) |
| `mv_joint_pairs` | `btree (material_type)` (mv_joint_pairs_mat) |
| `mv_joint_wps` | `btree (source, joint_id, wps_no)` (mv_joint_wps_key) |
| `mv_joint_wps` | `btree (sub_contractor, service_cat, wps_no)` (mv_joint_wps_scope) |
| `mv_row_slicer` | `btree (source, joint_id)` (mv_row_slicer_joint) |
| `mv_row_slicer` | `btree (joint_id)` (mv_row_slicer_jid) |
| `mv_row_slicer` | `btree (rt_report)` (mv_row_slicer_rt_report) |
| `mv_row_slicer` | `btree (rt_batch)` (mv_row_slicer_rt_batch) |
| `mv_row_slicer` | `btree (iso)` (mv_row_slicer_iso) |
| `mv_row_slicer` | `btree (ut_report)` (mv_row_slicer_ut_report) |
| `mv_row_slicer` | `btree (weld_date)` (mv_row_slicer_weld_date) |
| `mv_row_slicer` | `btree (rt_date)` (mv_row_slicer_rt_date) |
| `mv_weekly_progress` | `btree (week_end_date, source, sub_contractor, weld_cat, weld_type, ha, area_classification_label) NULLS NOT DISTINCT` (mv_weekly_progress_key) |
| `mv_weekly_progress` | `btree (week_end_date)` (mv_weekly_progress_week) |
| `mv_welder_perf` | `btree (sub_contractor, welder_id)` (mv_welder_perf_welder) |
| `mv_welder_perf` | `btree (joint_id)` (mv_welder_perf_joint) |
| `mv_welder_status` | `btree (welder_id)` (mv_welder_status_key) |
| `mv_welder_sub_status` | `btree (sub_contractor)` (mv_welder_sub_status_key) |

## 6. Data flow

1. **Files** - `sources/` (the owner's exports and the CUM workbooks).
2. **Refresh** (`npm run db:refresh`, the Refresh button) - each step loads its files when their sha256 changed (the `load` ledger);
   the materialized views are refreshed after the loads that feed them.
3. **Definitions** - every table and view is created by a migration (`db/migrations/NNNN_*.sql`, `npm run db:migrate`), never by hand.
4. **Read** - the pages read the views and `weld` with the report cut-off (the last Friday).
5. **Check** - the Welding Statistics Platform reconciles its figures with this site's pages over HTTP (its Data page).

Last load of each source:

| Source | File | Finished | Rows |
|---|---|---|---:|
| ACCIONA | Acciona_Latest Add to Query.xlsx | 2026-09-05 14:27:32 | 13,313 |
| CCC_JOINT_RECORD | AllTrain_CSVExport_Joint Record.csv | 2026-11-01 12:31:35 | 99,580 |
| CCC_WELDER_RECORD | CSVExport_Welder Record.csv | 2026-11-01 12:45:17 | 5,536,320 |
| CODE_LABELS | Rework code.xlsx | 2026-11-01 12:54:16 | 73 |
| EXCLUSION_LIST | TO BE EXLUDE FROM DATA.xlsx | 2026-11-01 12:46:37 | 628 |
| FLANGE_PROGRESS | Flange Progress.xlsx | 2026-11-01 13:00:02 | 138,218 |
| HA_GUIDE | HA.csv | 2026-09-07 12:32:58 | 41 |
| HA_L0_GUIDE | l0_abs_guide.csv | 2026-10-13 12:43:47 | 910 |
| INCO | Master Weld_Latest.xlsx | 2026-10-19 09:35:59 | 10,327 |
| OVASSETS_1619 | ovAssets_1619.xlsx | 2026-11-01 13:00:16 | 227,230 |
| SPOOL_DUMP | Spool Dump.txt | 2026-11-01 12:30:44 | 198,795 |
| TALISMAN_JOINT | Joint.csv | 2026-11-01 13:00:46 | 1,508,080 |
| TALISMAN_SPOOL | Spool.csv | 2026-11-01 12:30:49 | 332,148 |
| UT_TRACKER_CCC | UT TRACKER (CCC)_Talisman.xlsx | 2026-11-01 12:46:25 | 10,043 |
| WEEKLY_SNAPSHOT | CUM Trend file RT and PWHT / CUM Trend RT% UT% RejRate / CUM Trend Active Welders / CUM MPI Done | 2026-11-01 12:30:34 | 11,106 |
| WELDERS_QUALIFICATION | Welders Power Q for PBI .xlsx | 2026-10-13 16:17:02 | 5,484 |
| WELDERS_SCTR | SCTR NFE WELDERS APPLIED.xls | 2026-10-13 16:17:02 | 6 |
| WELDER_PERF_CUM | UT CUM FILE Welders Performance.  Rejection Rate. Summary Status  2 Weeks Since UT Date .xlsx | 2026-11-02 14:11:57 | 21,137 |
| WELDER_STATUS_WEEKLY | Welders Power Q for PBI .xlsx | 2026-10-13 16:17:02 | 6,288 |
| WELD_DUMP | Weld Dump.txt | 2026-11-01 12:30:33 | 961,269 |
| WELD_LENGTH | Weld Length.xlsx | 2026-11-01 12:54:16 | 100 |
| WPS_PROCESS | WPQ RECORD REGISTER.xlsx | 2026-11-01 12:59:46 | 266 |
| WPS_PWHT_STATUS | WPS PWHT Status.xlsx | 2026-11-01 12:59:46 | 34 |
| WPS_REGISTER | WPQ RECORD REGISTER.xlsx | 2026-11-01 12:59:46 | 318 |
| WPS_STATUS_CUM | CUM WPS Status.xlsx | 2026-11-01 12:59:46 | 272 |

## 7. Do / avoid

| Do | Avoid |
|---|---|
| Change data only through a refresh of its file. | UPDATE / DELETE in `weld` or a reference table by hand. |
| Change a table or view with a new migration. | Editing a view in psql: the next migration or rebuild undoes it. |
| Keep the owner's rulings in RULINGS.md, with an example joint. | Changing a counted rule without a ruling. |
| Keep passwords in `.env`. | Copying them into docs, commits or chat. |

## Appendix A. Health check (30 seconds)

1. `curl http://127.0.0.1:3000/api/health` - the site and its database answer.
2. The Data page of the Welding Statistics Platform: **Data health** - the reconciliation of both sites.
3. The table above: each source's last load.
