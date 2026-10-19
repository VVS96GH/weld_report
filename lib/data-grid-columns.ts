/**
 * Columns of the Data page (the detailed weld table, lib/pages/data-grid.ts):
 * every column of `weld` but its internal ids, labelled with the dump's own
 * header (analysis/dump/columns.json) or, for the columns the loaders derive,
 * the name the pbix gives them. Generated once from the database on 2026-10-19;
 * a column added to `weld` later shows up only once it is listed here.
 */
export type GridColType = "text" | "num" | "date" | "bool";
export type GridCol = { key: string; label: string; type: GridColType };

export const GRID_COLUMNS: readonly GridCol[] = [
  {
    key: "source",
    label: "Source",
    type: "text",
  },
  {
    key: "joint_id",
    label: "Joint ID",
    type: "text",
  },
  {
    key: "spool_id",
    label: "Spool ID",
    type: "text",
  },
  {
    key: "iso_number",
    label: "ISO Number",
    type: "text",
  },
  {
    key: "iso_rev_no",
    label: "Iso Rev No.",
    type: "text",
  },
  {
    key: "spool_no",
    label: "Spool No.",
    type: "text",
  },
  {
    key: "weld_no",
    label: "Weld No.",
    type: "text",
  },
  {
    key: "spool_rev_no",
    label: "Spool Rev No.",
    type: "text",
  },
  {
    key: "weld_cat",
    label: "Weld Cat",
    type: "text",
  },
  {
    key: "weld_type",
    label: "Weld Type",
    type: "text",
  },
  {
    key: "dia_inch_factor",
    label: "Dia Inch Factor",
    type: "bool",
  },
  {
    key: "dia_inch",
    label: "Dia inch",
    type: "num",
  },
  {
    key: "thickness",
    label: "Thickness",
    type: "num",
  },
  {
    key: "pds_area",
    label: "PDS Area",
    type: "text",
  },
  {
    key: "ag_ug_pkg",
    label: "AG/UG/PKG",
    type: "text",
  },
  {
    key: "area_classification",
    label: "Area Classification",
    type: "num",
  },
  {
    key: "wbu",
    label: "WBU",
    type: "num",
  },
  {
    key: "system_no",
    label: "System no",
    type: "text",
  },
  {
    key: "testpack_no",
    label: "Testpack No",
    type: "text",
  },
  {
    key: "service_class",
    label: "Service class",
    type: "text",
  },
  {
    key: "service_cat",
    label: "Service Cat",
    type: "text",
  },
  {
    key: "material_type",
    label: "Material Type",
    type: "text",
  },
  {
    key: "mir_no",
    label: "MIR No",
    type: "text",
  },
  {
    key: "mir_date",
    label: "MIR Date",
    type: "date",
  },
  {
    key: "cutting_date",
    label: "Cutting Date",
    type: "date",
  },
  {
    key: "beveling_date",
    label: "Beveling Date",
    type: "date",
  },
  {
    key: "fitup_date",
    label: "Fitup Date",
    type: "date",
  },
  {
    key: "preheat_date",
    label: "Preheat Date",
    type: "date",
  },
  {
    key: "weld_date",
    label: "Weld Date",
    type: "date",
  },
  {
    key: "dwir_no",
    label: "DWIR No.",
    type: "text",
  },
  {
    key: "sub_contractor",
    label: "Sub-Contractor",
    type: "text",
  },
  {
    key: "rework_code",
    label: "Rework Code",
    type: "text",
  },
  {
    key: "weldpoint_no",
    label: "WeldPoint No.",
    type: "num",
  },
  {
    key: "wps_no",
    label: "WPS No.",
    type: "text",
  },
  {
    key: "welder",
    label: "Welder",
    type: "text",
  },
  {
    key: "pwht_y_n",
    label: "PWHT Y/N",
    type: "text",
  },
  {
    key: "pwht_weld_status",
    label: "PWHT Weld Status",
    type: "text",
  },
  {
    key: "pwht_selected_date",
    label: "PWHT Selected Date",
    type: "date",
  },
  {
    key: "pwht_selected_by",
    label: "PWHT Selected By",
    type: "text",
  },
  {
    key: "pwht_exam_req_date",
    label: "PWHT Exam Req date",
    type: "date",
  },
  {
    key: "pwht_exam_req_no",
    label: "PWHT Exam Req No",
    type: "text",
  },
  {
    key: "pwht_exam_req_by",
    label: "PWHT Exam Req By",
    type: "text",
  },
  {
    key: "pwht_date",
    label: "PWHT Date",
    type: "date",
  },
  {
    key: "pwht_report",
    label: "PWHT Report",
    type: "text",
  },
  {
    key: "pwht_acc_rej",
    label: "PWHT Acc/Rej",
    type: "text",
  },
  {
    key: "pwht_client_exam_req_y_n",
    label: "PWHT Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "pwht_remarks",
    label: "PWHT Remarks",
    type: "text",
  },
  {
    key: "ht_pct",
    label: "HT%",
    type: "num",
  },
  {
    key: "ht_weld_status",
    label: "HT Weld Status",
    type: "text",
  },
  {
    key: "ht_selected_date",
    label: "HT Selected Date",
    type: "date",
  },
  {
    key: "ht_selected_by",
    label: "HT Selected By",
    type: "text",
  },
  {
    key: "ht_exam_req_date",
    label: "HT Exam Req date",
    type: "date",
  },
  {
    key: "ht_exam_req_no",
    label: "HT Exam Req No",
    type: "text",
  },
  {
    key: "ht_exam_req_by",
    label: "HT Exam Req By",
    type: "text",
  },
  {
    key: "ht_date",
    label: "HT Date",
    type: "date",
  },
  {
    key: "ht_report",
    label: "HT Report",
    type: "text",
  },
  {
    key: "ht_acc_rej",
    label: "HT Acc/Rej",
    type: "text",
  },
  {
    key: "ht_client_exam_req_y_n",
    label: "HT Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "ht_remarks",
    label: "HT Remarks",
    type: "text",
  },
  {
    key: "rt_pct",
    label: "RT%",
    type: "num",
  },
  {
    key: "rt_batch_no",
    label: "RT Batch No",
    type: "num",
  },
  {
    key: "rt_batch_status",
    label: "RT Batch Status",
    type: "text",
  },
  {
    key: "rt_weld_status",
    label: "RT Weld Status",
    type: "text",
  },
  {
    key: "rt_selected_date",
    label: "RT Selected Date",
    type: "date",
  },
  {
    key: "rt_selected_by",
    label: "RT Selected By",
    type: "text",
  },
  {
    key: "rt_exam_req_date",
    label: "RT Exam Req date",
    type: "date",
  },
  {
    key: "rt_exam_req_no",
    label: "RT Exam Req No",
    type: "text",
  },
  {
    key: "rt_exam_req_by",
    label: "RT Exam Req By",
    type: "text",
  },
  {
    key: "rt_date",
    label: "RT Date",
    type: "date",
  },
  {
    key: "rt_xray_no",
    label: "RT Xray No",
    type: "text",
  },
  {
    key: "rt_report",
    label: "RT Report",
    type: "text",
  },
  {
    key: "rt_acc_rej",
    label: "RT Acc/Rej",
    type: "text",
  },
  {
    key: "total_no_of_films_acc",
    label: "Total No of films Acc",
    type: "num",
  },
  {
    key: "total_no_of_films_rej",
    label: "Total No of films Rej",
    type: "num",
  },
  {
    key: "defect_code",
    label: "Defect Code",
    type: "text",
  },
  {
    key: "location_of_defect",
    label: "Location of Defect",
    type: "text",
  },
  {
    key: "rt_re_shoot_rep",
    label: "RT Re-Shoot Rep",
    type: "text",
  },
  {
    key: "rt_re_shoot_data",
    label: "RT Re-Shoot Data",
    type: "date",
  },
  {
    key: "rt_re_shoot_status",
    label: "RT Re-Shoot Status",
    type: "text",
  },
  {
    key: "rt_re_shoot_reason",
    label: "RT Re-Shoot Reason",
    type: "text",
  },
  {
    key: "rt_re_shoot_films",
    label: "RT Re-Shoot Films",
    type: "num",
  },
  {
    key: "weld_length",
    label: "Weld Length",
    type: "num",
  },
  {
    key: "rej_length",
    label: "Rej Length",
    type: "num",
  },
  {
    key: "rt_client_exam_req_y_n",
    label: "RT Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "by_ut",
    label: "By UT",
    type: "bool",
  },
  {
    key: "rt_remarks",
    label: "RT Remarks",
    type: "text",
  },
  {
    key: "ut_pct",
    label: "UT%",
    type: "num",
  },
  {
    key: "ut_weld_status",
    label: "UT Weld Status",
    type: "text",
  },
  {
    key: "ut_selected_date",
    label: "UT Selected Date",
    type: "date",
  },
  {
    key: "ut_selected_by",
    label: "UT Selected By",
    type: "text",
  },
  {
    key: "ut_date",
    label: "UT Date",
    type: "date",
  },
  {
    key: "ut_report",
    label: "UT Report",
    type: "text",
  },
  {
    key: "ut_acc_rej",
    label: "UT Acc/Rej",
    type: "text",
  },
  {
    key: "ut_client_exam_req_y_n",
    label: "UT Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "ut_remarks",
    label: "UT Remarks",
    type: "text",
  },
  {
    key: "mt_pct",
    label: "MT%",
    type: "num",
  },
  {
    key: "mt_batch_no",
    label: "MT Batch No",
    type: "num",
  },
  {
    key: "mt_batch_status",
    label: "MT Batch Status",
    type: "text",
  },
  {
    key: "mt_weld_status",
    label: "MT Weld Status",
    type: "text",
  },
  {
    key: "mt_selected_date",
    label: "MT Selected Date",
    type: "date",
  },
  {
    key: "mt_selected_by",
    label: "MT Selected By",
    type: "text",
  },
  {
    key: "mt_exam_req_date",
    label: "MT Exam Req date",
    type: "date",
  },
  {
    key: "mt_exam_req_no",
    label: "MT Exam Req No",
    type: "text",
  },
  {
    key: "mt_exam_req_by",
    label: "MT Exam Req By",
    type: "text",
  },
  {
    key: "mt_date",
    label: "MT Date",
    type: "date",
  },
  {
    key: "mt_report",
    label: "MT Report",
    type: "text",
  },
  {
    key: "mt_acc_rej",
    label: "MT Acc/Rej",
    type: "text",
  },
  {
    key: "mt_client_exam_req_y_n",
    label: "MT Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "mt_remarks",
    label: "MT Remarks",
    type: "text",
  },
  {
    key: "pmi_pct",
    label: "PMI%",
    type: "num",
  },
  {
    key: "pmi_batch_no",
    label: "PMI Batch No",
    type: "num",
  },
  {
    key: "pmi_batch_status",
    label: "PMI Batch Status",
    type: "text",
  },
  {
    key: "pmi_weld_status",
    label: "PMI Weld Status",
    type: "text",
  },
  {
    key: "pmi_selected_date",
    label: "PMI Selected Date",
    type: "date",
  },
  {
    key: "pmi_selected_by",
    label: "PMI Selected By",
    type: "text",
  },
  {
    key: "pmi_exam_req_date",
    label: "PMI Exam Req date",
    type: "date",
  },
  {
    key: "pmi_exam_req_no",
    label: "PMI Exam Req No",
    type: "text",
  },
  {
    key: "pmi_exam_req_by",
    label: "PMI Exam Req By",
    type: "text",
  },
  {
    key: "pmi_date",
    label: "PMI Date",
    type: "date",
  },
  {
    key: "pmi_report",
    label: "PMI Report",
    type: "text",
  },
  {
    key: "pmi_acc_rej",
    label: "PMI Acc/Rej",
    type: "text",
  },
  {
    key: "pmi_client_exam_req_y_n",
    label: "PMI Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "pmi_remarks",
    label: "PMI Remarks",
    type: "text",
  },
  {
    key: "pt_pct",
    label: "PT%",
    type: "num",
  },
  {
    key: "pt_batch_no",
    label: "PT Batch No",
    type: "num",
  },
  {
    key: "pt_batch_status",
    label: "PT Batch Status",
    type: "text",
  },
  {
    key: "pt_weld_status",
    label: "PT Weld Status",
    type: "text",
  },
  {
    key: "pt_selected_date",
    label: "PT Selected Date",
    type: "date",
  },
  {
    key: "pt_selected_by",
    label: "PT Selected By",
    type: "text",
  },
  {
    key: "pt_exam_req_date",
    label: "PT Exam Req date",
    type: "date",
  },
  {
    key: "pt_exam_req_no",
    label: "PT Exam Req No",
    type: "text",
  },
  {
    key: "pt_exam_req_by",
    label: "PT Exam Req By",
    type: "text",
  },
  {
    key: "pt_date",
    label: "PT Date",
    type: "date",
  },
  {
    key: "pt_report",
    label: "PT Report",
    type: "text",
  },
  {
    key: "pt_acc_rej",
    label: "PT Acc/Rej",
    type: "text",
  },
  {
    key: "pt_client_exam_req_y_n",
    label: "PT Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "pt_remarks",
    label: "PT Remarks",
    type: "text",
  },
  {
    key: "fn_pct",
    label: "FN%",
    type: "num",
  },
  {
    key: "padlt_y_n",
    label: "PADLT Y/N",
    type: "bool",
  },
  {
    key: "padlt_weld_status",
    label: "PADLT Weld Status",
    type: "text",
  },
  {
    key: "padlt_selected_date",
    label: "PADLT Selected Date",
    type: "date",
  },
  {
    key: "padlt_selected_by",
    label: "PADLT Selected By",
    type: "text",
  },
  {
    key: "padlt_exam_req_date",
    label: "PADLT Exam Req date",
    type: "date",
  },
  {
    key: "padlt_exam_req_no",
    label: "PADLT Exam Req No",
    type: "text",
  },
  {
    key: "padlt_exam_req_by",
    label: "PADLT Exam Req By",
    type: "text",
  },
  {
    key: "padlt_date",
    label: "PADLT Date",
    type: "date",
  },
  {
    key: "padlt_report",
    label: "PADLT Report",
    type: "text",
  },
  {
    key: "padlt_acc_rej",
    label: "PADLT Acc/Rej",
    type: "text",
  },
  {
    key: "padlt_client_exam_req_y_n",
    label: "PADLT Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "orif_y_n",
    label: "ORIF Y/N",
    type: "bool",
  },
  {
    key: "orif_weld_status",
    label: "ORIF Weld Status",
    type: "text",
  },
  {
    key: "orif_selected_date",
    label: "ORIF Selected Date",
    type: "date",
  },
  {
    key: "orif_selected_by",
    label: "ORIF Selected By",
    type: "text",
  },
  {
    key: "orif_exam_req_date",
    label: "ORIF Exam Req date",
    type: "date",
  },
  {
    key: "orif_exam_req_no",
    label: "ORIF Exam Req No",
    type: "text",
  },
  {
    key: "orif_exam_req_by",
    label: "ORIF Exam Req By",
    type: "text",
  },
  {
    key: "orif_date",
    label: "ORIF Date",
    type: "date",
  },
  {
    key: "orif_report",
    label: "ORIF Report",
    type: "text",
  },
  {
    key: "orif_acc_rej",
    label: "ORIF Acc/Rej",
    type: "text",
  },
  {
    key: "orif_client_exam_req_y_n",
    label: "ORIF Client Exam Req Y/N",
    type: "bool",
  },
  {
    key: "matrl_traceability_y_n",
    label: "Matrl Traceability Y/N",
    type: "bool",
  },
  {
    key: "group_1",
    label: "GROUP-1",
    type: "text",
  },
  {
    key: "ident_code_1",
    label: "IDENT CODE-1",
    type: "text",
  },
  {
    key: "trac_no_1",
    label: "TRAC NO-1",
    type: "text",
  },
  {
    key: "part_1",
    label: "Part 1",
    type: "text",
  },
  {
    key: "group_2",
    label: "GROUP-2",
    type: "text",
  },
  {
    key: "ident_code_2",
    label: "IDENT CODE-2",
    type: "text",
  },
  {
    key: "trac_no_2",
    label: "TRAC NO-2",
    type: "text",
  },
  {
    key: "part_2",
    label: "Part 2",
    type: "text",
  },
  {
    key: "revision_status",
    label: "Revision Status",
    type: "text",
  },
  {
    key: "revision_comments",
    label: "Revision Comments",
    type: "text",
  },
  {
    key: "hold_status",
    label: "Hold Status",
    type: "text",
  },
  {
    key: "hold_comments",
    label: "Hold Comments",
    type: "text",
  },
  {
    key: "piping_group",
    label: "Piping Group",
    type: "text",
  },
  {
    key: "golden_weld_report_date",
    label: "Golden Weld Report Date",
    type: "text",
  },
  {
    key: "golden_weld_report_no",
    label: "Golden Weld Report No",
    type: "text",
  },
  {
    key: "ut_operator_id",
    label: "UT Operator ID",
    type: "text",
  },
  {
    key: "manual_ut_date",
    label: "Manual UT Date",
    type: "text",
  },
  {
    key: "manual_ut_report_no",
    label: "Manual UT Report No",
    type: "text",
  },
  {
    key: "manual_ut_status",
    label: "Manual UT Status",
    type: "text",
  },
  {
    key: "tpi_cross_checked",
    label: "TPI Cross Checked",
    type: "text",
  },
  {
    key: "checked_date",
    label: "Checked Date",
    type: "text",
  },
  {
    key: "result_a_r",
    label: "Result (A/R)",
    type: "text",
  },
  {
    key: "golden_weld",
    label: "Golden Weld",
    type: "text",
  },
  {
    key: "subsystem_code",
    label: "Subsystem Code",
    type: "text",
  },
  {
    key: "priority_no",
    label: "Priority No",
    type: "text",
  },
  {
    key: "pds_area_type",
    label: "PDS Area Type",
    type: "text",
  },
  {
    key: "shipment_date",
    label: "SHIPMENT DATE",
    type: "date",
  },
  {
    key: "packing_list_no",
    label: "PACKING LIST NO",
    type: "date",
  },
  {
    key: "shipment_recv_date",
    label: "SHIPMENT RECV DATE",
    type: "date",
  },
  {
    key: "erec_mir_date",
    label: "EREC MIR DATE",
    type: "date",
  },
  {
    key: "erec_mir_no",
    label: "EREC MIR NO",
    type: "text",
  },
  {
    key: "sheet_no",
    label: "SHEET NO",
    type: "num",
  },
  {
    key: "testpack_sub_contractor",
    label: "TESTPACK SUB CONTRACTOR",
    type: "text",
  },
  {
    key: "testpack_test_done_date",
    label: "TESTPACK TEST DONE DATE",
    type: "date",
  },
  {
    key: "pip_001_a",
    label: "PIP-001-A",
    type: "text",
  },
  {
    key: "w24dwir",
    label: "W24DWIR",
    type: "text",
  },
  {
    key: "rt_ut",
    label: "RT/UT",
    type: "text",
  },
  {
    key: "ndt_remarks",
    label: "NDT Remarks",
    type: "text",
  },
  {
    key: "tracer_shot",
    label: "Tracer Shot",
    type: "text",
  },
  {
    key: "weld_point_code",
    label: "Weld Point Code",
    type: "text",
  },
  {
    key: "original_joint",
    label: "Original Joint",
    type: "text",
  },
  {
    key: "repair_suffix",
    label: "Repair Suffix",
    type: "text",
  },
  {
    key: "pwht_y_n_ccc",
    label: "PWHT Y/N CCC",
    type: "text",
  },
  {
    key: "pwht_report_no_ccc",
    label: "PWHT Report No CCC",
    type: "text",
  },
  {
    key: "pwht_date_no_ccc",
    label: "PWHT Date CCC",
    type: "date",
  },
  {
    key: "spool_status",
    label: "Spool Status",
    type: "text",
  },
  {
    key: "ha",
    label: "HA",
    type: "text",
  },
  {
    key: "repair_reweld",
    label: "Repair/Reweld",
    type: "text",
  },
  {
    key: "service_class_cat_wd",
    label: "Service Class + Service Cat",
    type: "text",
  },
  {
    key: "service_class_cat_ndt",
    label: "Service Class + Service Cat+NDT Remarks",
    type: "text",
  },
  {
    key: "temporary_lines",
    label: "Temporary Lines",
    type: "bool",
  },
  {
    key: "tmcp_pipe",
    label: "TMCP Pipe",
    type: "bool",
  },
  {
    key: "exclude_ut_films",
    label: "Exclude UT Films",
    type: "bool",
  },
  {
    key: "exclude_debris_films",
    label: "Exclude Debris Films",
    type: "bool",
  },
  {
    key: "area_classification_label",
    label: "Area Classification Label",
    type: "text",
  },
  {
    key: "weldpoint_seq",
    label: "Weldpoint Seq",
    type: "num",
  },
  {
    key: "welder_id",
    label: "Welder ID",
    type: "text",
  },
  {
    key: "testpack_no_all",
    label: "Testpack No (All)",
    type: "text",
  },
  {
    key: "manual_ut_report_no_all",
    label: "Manual UT Report No.",
    type: "text",
  },
  {
    key: "manual_ut_status_all",
    label: "Manual UT Status.",
    type: "text",
  },
  {
    key: "manual_ut_date_all",
    label: "Manual UT Date.",
    type: "date",
  },
  {
    key: "ut_operator_id_all",
    label: "UT Operator ID.",
    type: "text",
  },
  {
    key: "ut_report_all",
    label: "UT Report (All)",
    type: "text",
  },
  {
    key: "ut_date_all",
    label: "UT Date (All)",
    type: "date",
  },
  {
    key: "mt_report_ccc",
    label: "MT Report CCC",
    type: "text",
  },
  {
    key: "mt_date_ccc",
    label: "MT Date CCC",
    type: "date",
  },
  {
    key: "mt_pct_ccc",
    label: "MT% CCC",
    type: "num",
  },
  {
    key: "pt_report_ccc",
    label: "PT Report CCC",
    type: "text",
  },
  {
    key: "pt_date_ccc",
    label: "PT Date CCC",
    type: "date",
  },
  {
    key: "pt_pct_ccc",
    label: "PT% CCC",
    type: "num",
  },
  {
    key: "pmi_report_ccc",
    label: "PMI Report CCC",
    type: "text",
  },
  {
    key: "pmi_date_ccc",
    label: "PMI Date CCC",
    type: "date",
  },
  {
    key: "ht_report_ccc",
    label: "HT Report CCC",
    type: "text",
  },
  {
    key: "ht_date_ccc",
    label: "HT Date CCC",
    type: "date",
  },
  {
    key: "dwir_ccc_from_jr",
    label: "DWIR CCC (Joint Record)",
    type: "text",
  },
  {
    key: "thickness_from_jr",
    label: "Thickness (Joint Record)",
    type: "num",
  },
  {
    key: "rework_code_all",
    label: "Rework Code (All)",
    type: "text",
  },
  {
    key: "rt_film_total",
    label: "RT Film Total",
    type: "num",
  },
  {
    key: "weld_length_m",
    label: "Weld Length m",
    type: "num",
  },
  {
    key: "inspected_length_mm",
    label: "Inspected Length(MM).",
    type: "num",
  },
  {
    key: "defect_length_mm",
    label: "Defect Length(MM).",
    type: "num",
  },
  {
    key: "week_end_date_rt",
    label: "Week_End_Date RT",
    type: "date",
  },
  {
    key: "sub_contractor_tier",
    label: "Sub-Contractor Tier",
    type: "text",
  },
  {
    key: "repair_length_mm",
    label: "Repair Length mm",
    type: "num",
  },
];

/** Shown when the page opens: the pbix data view's first columns, then the key NDE ones. */
export const GRID_DEFAULT_COLUMNS: readonly string[] = [
  "joint_id",
  "spool_id",
  "iso_number",
  "iso_rev_no",
  "spool_no",
  "weld_no",
  "spool_rev_no",
  "weld_cat",
  "weld_type",
  "dia_inch_factor",
  "dia_inch",
  "thickness",
  "pds_area",
  "ag_ug_pkg",
  "area_classification",
  "sub_contractor",
  "weld_date",
  "welder_id",
  "welder",
  "wps_no",
  "rt_pct",
  "rt_report",
  "rt_date",
  "rt_acc_rej",
  "ut_report",
  "pwht_report",
  "source",
];
