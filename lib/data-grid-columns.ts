/**
 * Columns of the Data page (the detailed weld table, lib/pages/data-grid.ts):
 * every column of `weld` but its internal ids, labelled with the dump's own
 * header (analysis/dump/columns.json) or, for the columns the loaders derive,
 * the name the pbix gives them. Generated once from the database on 2026-10-19;
 * a column added to `weld` later shows up only once it is listed here.
 */
export type GridColType = "text" | "num" | "date" | "bool";
export type GridCol = {
  key: string;
  label: string;
  type: GridColType;
  /** A pbix calculated column: its SQL over the row `w` ({today} = the load day). */
  sql?: string;
  fx?: boolean;
  /** GRID_JOINS the formula reads from (group columns). */
  joins?: string[];
};

const CATALOG: readonly GridCol[] = [
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
    // the pbix calculated column, Welder & "-" & Sub-Contractor, for every row;
    // the loaded welder_id equals it where present (CCC, Acciona, Inco)
    sql: "coalesce(w.welder, '') || '-' || coalesce(w.sub_contractor, '')",
    fx: true,
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

/** Every column, the basic ones first (Joint ID leads, as in the pbix data view), then the rest in table order. */


// ── the pbix calculated columns (DAX), computed per row ──

/** A text column's value as the DAX `<> ""` test sees it (blank and "" alike). */
const nz = (c: string) => `coalesce(w.${c}, '') <> ''`;
const up = (c: string) => `upper(coalesce(w.${c}, ''))`;
const RT_TYPES = `('BW', 'GW', 'CLET', 'MW')`;
const HOLD = `('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S','T2','T3','T2-1','T2-1S','T2-2S','T2S')`;
const bands = (x: string) =>
  `CASE WHEN ${x} >= 1 AND ${x} <= 7 THEN '1. 7 Days' WHEN ${x} > 7 AND ${x} <= 30 THEN '2. 7 to 30 Days'` +
  ` WHEN ${x} > 30 AND ${x} <= 90 THEN '3. 30 to 90 Days' WHEN ${x} > 90 AND ${x} <= 180 THEN '4. 90 to 180 Days'` +
  ` WHEN ${x} > 180 THEN '5. Above 180 Days' END`;
const DAYS_FITUP = `CASE WHEN w.weld_date IS NULL THEN {today} - w.fitup_date END`;
const DAYS_WELD =
  `CASE WHEN w.rt_date IS NULL AND ${up("weld_type")} IN ${RT_TYPES} AND ${up("rt_weld_status")} IN ${HOLD} THEN {today} - w.weld_date` +
  ` WHEN ${up("weld_type")} IN ${RT_TYPES} AND w.weld_date IS NOT NULL AND w.rt_pct = 100 AND coalesce(w.rt_report, '') = ''` +
  ` AND coalesce(w.rt_weld_status, '') IN ('?', '') THEN {today} - w.weld_date END`;
const WELDER_ID = `coalesce(w.welder, '') || '-' || coalesce(w.sub_contractor, '')`;
const SC_KEY = `coalesce(w.service_class, '') || ' ' || coalesce(w.service_cat, '') || ' ' || coalesce(w.ndt_remarks, '') || ' ' || coalesce(w.rt_pct::text, '')`;
const pct = (own: string, ccc: string) =>
  `CASE WHEN ${up("sub_contractor")} <> 'CCC' THEN CASE WHEN w.${own} >= 0 THEN w.${own} END ELSE CASE WHEN w.${ccc} >= 0 THEN w.${ccc} END END`;
const either = (a: string, b: string) => `coalesce(nullif(w.${a}, ''), nullif(w.${b}, ''))`;

/**
 * The pbix calculated columns of "Project WD+WR+INCO+Acciona" that read only
 * the row itself, ported from their DAX (analysis/pbix/raw-2026-10-18/model/
 * calculated-columns.json), owner 2026-10-19. DAX compares text case-blind and
 * treats blank and "" alike; TODAY() is the day the data was loaded ({today}).
 * Computed when read, so they cost nothing at refresh.
 */
export const FX_COLUMNS: readonly GridCol[] = [
  { key: "fx_repair_reweld", label: 'Repair & Reweld "PR all"', type: "text", fx: true,
    sql: `CASE WHEN ${up("sub_contractor")} <> 'INCO' THEN CASE WHEN upper(right(w.joint_id, 2)) IN ('R1', 'R2') THEN 'Repair' WHEN upper(right(w.joint_id, 2)) = 'RW' THEN 'Reweld' WHEN ${up("repair_suffix")} = 'RW1' THEN 'Reweld' WHEN ${up("repair_suffix")} = 'RS1' THEN 'RS1' END END` },
  { key: "fx_days", label: 'No of Days "PR all"', type: "num", fx: true, sql: `{today} - w.weld_date` },
  { key: "fx_days_fitup", label: 'No of Days Fit-UP - TODAY "PR all"', type: "num", fx: true, sql: DAYS_FITUP },
  { key: "fx_days_fitup_status", label: 'No Of Days Fit-UP - Today STATUS "PR all"', type: "text", fx: true, sql: bands(`(${DAYS_FITUP})`) },
  { key: "fx_days_weld", label: 'No of Days Weld Date - TODAY "PR all"', type: "num", fx: true, sql: DAYS_WELD },
  { key: "fx_days_weld_status", label: 'No Of Days Weld Date - Today RT STATUS "PR all"', type: "text", fx: true, sql: bands(`(${DAYS_WELD})`) },
  { key: "fx_report_type", label: "Report TYPE", type: "text", fx: true,
    sql: `CASE WHEN ${nz("rt_report")} AND ${up("rt_ut")} <> 'UT' THEN 'RT' WHEN ${nz("ut_report")} THEN 'UT' WHEN ${up("rt_ut")} = 'UT' THEN 'UT' WHEN ${nz("pt_report")} THEN 'PT' WHEN ${nz("pmi_report")} THEN 'PMI' WHEN ${nz("pwht_report")} THEN 'PWHT' WHEN ${nz("pwht_report_no_ccc")} THEN 'PWHT' WHEN ${nz("mt_report")} THEN 'MT' WHEN ${nz("mt_report_ccc")} THEN 'MT' END` },
  { key: "fx_pwht_status", label: "PWHT Status PR ALL", type: "text", fx: true,
    sql: `CASE WHEN ${up("pwht_y_n")} = 'Y' THEN 'Y' WHEN ${up("pwht_y_n")} = 'N' THEN 'N' WHEN w.pwht_y_n = '25.01' THEN '25.01' WHEN ${up("pwht_y_n_ccc")} = 'Y' THEN 'Y' WHEN ${up("pwht_y_n_ccc")} = 'N' THEN 'N' END` },
  { key: "fx_pwht_report", label: 'PWHT Report "PR All"', type: "text", fx: true, sql: either("pwht_report", "pwht_report_no_ccc") },
  { key: "fx_pwht_date", label: 'PWHT Date "PR All"', type: "date", fx: true, sql: `coalesce(w.pwht_date, w.pwht_date_no_ccc)` },
  { key: "fx_ut_report", label: 'UT Report "PR All"', type: "text", fx: true,
    sql: `CASE WHEN ${nz("ut_report")} THEN w.ut_report WHEN ${up("sub_contractor")} = 'CCC' THEN nullif(w.manual_ut_report_no_all, '') WHEN ${up("rt_ut")} = 'UT' THEN w.rt_report END` },
  { key: "fx_ut_date", label: 'UT Date "PR All"', type: "date", fx: true,
    sql: `CASE WHEN w.ut_date IS NOT NULL THEN w.ut_date WHEN ${up("sub_contractor")} = 'CCC' THEN w.manual_ut_date_all WHEN ${up("rt_ut")} = 'UT' THEN w.rt_date END` },
  { key: "fx_mt_report", label: 'MT Report "PR All"', type: "text", fx: true, sql: either("mt_report", "mt_report_ccc") },
  { key: "fx_mt_date", label: 'MT Date "PR All"', type: "date", fx: true, sql: `coalesce(w.mt_date, w.mt_date_ccc)` },
  { key: "fx_mt_pct", label: 'MT % "PR All"', type: "num", fx: true, sql: pct("mt_pct", "mt_pct_ccc") },
  { key: "fx_pt_report", label: 'PT Report "PR All"', type: "text", fx: true, sql: either("pt_report", "pt_report_ccc") },
  { key: "fx_pt_date", label: 'PT Date "PR All"', type: "date", fx: true, sql: `coalesce(w.pt_date, w.pt_date_ccc)` },
  { key: "fx_pt_pct", label: 'PT % "PR All"', type: "num", fx: true, sql: pct("pt_pct", "pt_pct_ccc") },
  { key: "fx_pmi_report", label: 'PMI Report "PR All"', type: "text", fx: true, sql: either("pmi_report", "pmi_report_ccc") },
  { key: "fx_pmi_date", label: 'PMI Date "PR All"', type: "date", fx: true, sql: `coalesce(w.pmi_date, w.pmi_date_ccc)` },
  { key: "fx_ht_report", label: 'HT Report "PR All"', type: "text", fx: true, sql: either("ht_report", "ht_report_ccc") },
  { key: "fx_ht_date", label: 'HT Date "PR All"', type: "date", fx: true, sql: `coalesce(w.ht_date, w.ht_date_ccc)` },
  { key: "fx_dwir_report", label: 'DWIR Report "PR All"', type: "text", fx: true, sql: either("dwir_no", "dwir_ccc_from_jr") },
  { key: "fx_ut_status_trfl", label: "UT Status TR/FL", type: "text", fx: true,
    sql: `CASE WHEN ${up("ut_acc_rej")} = ${up("manual_ut_status")} THEN 'TRUE' ELSE 'FALSE' END` },
  { key: "fx_line", label: "LINE", type: "text", fx: true, sql: `nullif(substr(w.iso_number, 9), '')` },
  { key: "fx_dia_band", label: "Dia Inch >20<", type: "text", fx: true,
    sql: `CASE WHEN coalesce(w.dia_inch, 0) <= 20 THEN '0-20' WHEN w.dia_inch <= 200 THEN '20-199' ELSE 'Greater than 199' END` },
  { key: "fx_sc_welder", label: "Service Class + Service Cat+NDT Remarks+Welder ID", type: "text", fx: true, sql: `${SC_KEY} || ' ' || ${WELDER_ID}` },
  { key: "fx_sc_sub", label: "Service Class + Service Cat+NDT Remarks+Sub-Contractor", type: "text", fx: true, sql: `${SC_KEY} || ' ' || coalesce(w.sub_contractor, '')` },
  { key: "fx_weld_cat_new", label: "Weld CAT (NEW)", type: "text", fx: true,
    sql: `CASE WHEN ${up("weld_type")} = 'SW' AND ${up("weld_cat")} = 'F' THEN 'S' ELSE w.weld_cat END` },
  { key: "fx_by_ut_all", label: "By UT All", type: "text", fx: true,
    sql: `CASE WHEN w.by_ut THEN 'BY UT' WHEN ${up("rt_ut")} = 'UT' THEN 'BY UT' WHEN ${up("ht_remarks")} = 'PAUT' THEN 'BY UT' WHEN ${nz("manual_ut_report_no_all")} THEN 'BY UT' END` },
  { key: "fx_days_rt_sel", label: "Days Between RT Selected and RT Date", type: "num", fx: true, sql: `w.rt_date - w.rt_selected_date` },
  { key: "fx_month_rt", label: "MonthRT", type: "date", fx: true, sql: `w.rt_date` },
  { key: "fx_year_rt", label: "YearRT", type: "text", fx: true, sql: `to_char(w.rt_date, 'YYYY')` },
  { key: "fx_full_cut", label: "Exlude Full Cut & Debris", type: "text", fx: true,
    sql: `CASE WHEN ${up("rt_re_shoot_status")} = 'FULL CUT' AND w.rt_re_shoot_reason ILIKE '%debris%' AND ${up("defect_code")} = 'XX' THEN 'Exclude Films:Debris' END` },
  { key: "fx_train_sg", label: "Train SG", type: "text", fx: true,
    sql: `CASE WHEN ${up("service_cat")} IN ('SG', 'SGCS') THEN substr(w.joint_id, 4, 3) END` },
  { key: "fx_stainless", label: "Stainless steel", type: "text", fx: true, sql: `CASE WHEN w.material_type ILIKE '%SS%' THEN 'Stainless Steel' END` },
  { key: "fx_excl_ut_films", label: "Exlude RT Films from UT", type: "text", fx: true,
    sql: `CASE WHEN w.by_ut AND ${up("sub_contractor")} <> 'INCO' AND w.rt_report ILIKE '%UT%' AND (w.total_no_of_films_rej > 0 OR w.rt_film_total > 0) THEN 'Exclude UT Films' END` },
];


// ── group calculated columns: a value per group, joined to the row ──

/**
 * The joins a group column needs (migration 0054, and the welder-performance
 * views of 0045, already checked against the pbix there). Keys are the pbix's
 * own: Welder ID = Welder & "-" & Sub-Contractor, the class key with RT%.
 */
export const GRID_JOINS: Record<string, string> = {
  gw: `LEFT JOIN mv_grid_welder gw ON gw.k = (${WELDER_ID})`,
  gss: `LEFT JOIN mv_grid_sc_sub gss ON gss.sc = (${SC_KEY}) AND gss.sub = coalesce(w.sub_contractor, '')`,
  gsc: `LEFT JOIN mv_grid_sc gsc ON gsc.sc = (${SC_KEY})`,
  gwps: `LEFT JOIN mv_grid_wps gwps ON gwps.k = coalesce(w.wps_no, '')`,
  gmat: `LEFT JOIN mv_grid_material gmat ON gmat.k = coalesce(w.material_type, '')`,
  gwsc: `LEFT JOIN mv_grid_welder_sc gwsc ON gwsc.k = (${WELDER_ID}) AND gwsc.sc = (${SC_KEY})`,
  gj: `LEFT JOIN mv_grid_joint gj ON gj.k = w.joint_id`,
  grr: `LEFT JOIN mv_grid_rt_report grr ON grr.k = coalesce(w.rt_report, '')`,
  gb: `LEFT JOIN mv_grid_batch gb ON gb.k = coalesce(w.rt_batch_no::text, '')`,
  gt: `LEFT JOIN mv_grid_total gt ON true`,
  ws: `LEFT JOIN mv_welder_status ws ON ws.welder_id = (${WELDER_ID})`,
  ss: `LEFT JOIN mv_welder_sub_status ss ON ss.sub_contractor = w.sub_contractor`,
};

const filmBands = (v: string) =>
  `CASE WHEN ${v} >= 0 AND ${v} < 0.05 THEN '1. 0 to 5% - ok' WHEN ${v} >= 0.05 AND ${v} < 0.075 THEN '2. 5 to 7.5% - monitor'` +
  ` WHEN ${v} >= 0.075 AND ${v} < 0.10 THEN '3. 7.5 to 10% - Critical' WHEN ${v} >= 0.10 AND ${v} <= 1 THEN '4. 10 to 100% - Disq.F' END`;
/** RT Ratio % STATUS for WPS / Material Type: SWITCH(TRUE(), r = 0 …) — a BLANK ratio equals 0 in DAX, so it reads "0%". */
const wpsBands = (v: string) =>
  `CASE WHEN coalesce(${v}, 0) = 0 THEN '0%' WHEN ${v} <= 0.01 THEN '1. <1% ' WHEN ${v} <= 0.02 THEN '2. 1% - 2% '` +
  ` WHEN ${v} <= 0.05 THEN '3. 2% - 5% ' WHEN ${v} <= 0.10 THEN '4. 5% - 10% ' ELSE '5. > 10% ' END`;
/** UT Rej Length Rate % "PR all" For Welder exists only on rows with a Manual UT Date. */
const UT_LEN_W = "(CASE WHEN w.manual_ut_date_all IS NOT NULL THEN ws.ut_len_w END)";
const RT_ROW = `upper(coalesce(w.weld_type, '')) IN ${RT_TYPES} AND w.weld_date IS NOT NULL`;
const g = (key: string, label: string, type: GridColType, sql: string, joins: string[]): GridCol => ({ key, label, type, sql, fx: true, joins });

/** The pbix group calculated columns (ALLEXCEPT per welder, sub-contractor, class, WPS, material, joint, report, batch). */
export const FX_GROUP_COLUMNS: readonly GridCol[] = [
  // per welder
  g("fx_rt_film_w", 'RT Film Ratio % "PR all" For Welder', "num", "gw.rt_film", ["gw"]),
  g("fx_rt_film_w_st", 'RT FILM Ratio % STATUS "PR all"', "text", filmBands("gw.rt_film"), ["gw"]),
  g("fx_cover_w", 'RT Ratio % For Welder (<5% ; >5%) "PR all"', "num", "ws.cover_w", ["ws"]),
  g("fx_cover_w_st", 'RT Ratio % STATUS for Welder Cover 5% "PR all"', "text",
    `CASE WHEN ws.cover_w >= 0.05 THEN '1. > 5% - ok' WHEN ws.cover_w < 0.05 AND ws.cover_w > 0 THEN '2. < 5% - Action' WHEN ws.cover_w IS NULL AND ${RT_ROW} THEN '3. No RT' END`, ["ws"]),
  g("fx_rt_film_w15", 'RT Film Ratio % "PR all" For Welder LAST 2 WEEKS', "num", "ws.rt_w_15", ["ws"]),
  g("fx_rt_film_w15_st", "RT FILM Ratio % STATUS LAST 2 WEEKS", "text", filmBands("ws.rt_w_15"), ["ws"]),
  g("fx_rt_film_w30", 'RT Film Ratio % "PR all" For Welder LAST 1 MONTH', "num", "ws.rt_w_30", ["ws"]),
  g("fx_rt_film_w30_st", "RT FILM Ratio % STATUS LAST 1 Month", "text", filmBands("ws.rt_w_30"), ["ws"]),
  g("fx_ut_ratio_w", 'UT Ratio % For Welder (<5% ; >5%) "PR all"', "num", "gw.ut_ratio", ["gw"]),
  g("fx_ut_len_w", 'UT Rej Length Rate % "PR all" For Welder', "num", UT_LEN_W, ["ws"]),
  g("fx_ut_len_w_st", "UT Rej Rate % STATUS for Welder by Length", "text",
    `CASE WHEN ${UT_LEN_W} >= 0 AND ${UT_LEN_W} < 0.015 THEN '1. Ok: 0 to 1.5%' WHEN ${UT_LEN_W} >= 0.015 AND ${UT_LEN_W} < 0.02 THEN '2. Monitor: 1.5% to 2%' WHEN ${UT_LEN_W} >= 0.02 AND ${UT_LEN_W} <= 1 THEN '3. Action: 2% to 100%' END`, ["ws"]),
  g("fx_ut_joint_w", 'UT Rej Rate % "PR all" For Welder by Joint', "num", "ws.ut_joint_w", ["ws"]),
  g("fx_ut_joint_w_st", "UT Rej Rate % STATUS for Welder by Joint", "text",
    "CASE WHEN ws.ut_joint_w >= 0 AND ws.ut_joint_w < 0.1 THEN '1. 0 to 10%' WHEN ws.ut_joint_w >= 0.1 AND ws.ut_joint_w <= 1 THEN '2. 10 to 100%' END", ["ws"]),
  g("fx_ut_len_w15", 'UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS', "num", "ws.ut_len_w_15", ["ws"]),
  g("fx_ut_len_w15_st", "UT Rej Rate % STATUS for Welder by Length Last 2 Weeks", "text",
    "CASE WHEN ws.ut_len_w_15 >= 0 AND ws.ut_len_w_15 < 0.015 THEN '1.Ok: 0 to 1.5%' WHEN ws.ut_len_w_15 >= 0.015 AND ws.ut_len_w_15 < 0.02 THEN '2.Monitor: 1.5% to 2%' WHEN ws.ut_len_w_15 >= 0.02 AND ws.ut_len_w_15 <= 1 THEN '3.Action: 2% to 100%' END", ["ws"]),
  // per sub-contractor
  g("fx_ut_joint_s", 'UT Rej Rate % by joint "PR all" For Sub-Con', "num", "ss.ut_joint_s", ["ss"]),
  g("fx_ut_joint_s_st", "UT Rej Rate % STATUS for Sub-Con by Joint", "text",
    "CASE WHEN ss.ut_joint_s >= 0 AND ss.ut_joint_s < 0.03 THEN '1. ok-0 to 3%' WHEN ss.ut_joint_s >= 0.03 AND ss.ut_joint_s < 0.05 THEN '2. Monitor-3% to 5%' WHEN ss.ut_joint_s >= 0.05 AND ss.ut_joint_s <= 1 THEN '3. Not Accept-5% to 100%' END", ["ss"]),
  g("fx_ut_len_s", 'UT Rej Rate % by Length "PR all" For Sub-Con', "num", "ss.ut_len_s", ["ss"]),
  g("fx_ut_len_s_st", "UT Rej Rate % STATUS for Sub-Con by Length", "text",
    "CASE WHEN ss.ut_len_s >= 0 AND ss.ut_len_s < 0.01 THEN '1.ok: 0 to 1%' WHEN ss.ut_len_s >= 0.01 AND ss.ut_len_s < 0.015 THEN '2.Monitor: 1% to 1.5%' WHEN ss.ut_len_s >= 0.015 AND ss.ut_len_s <= 1 THEN '3.Not Accept: 1.5% to 100%' END", ["ss"]),
  // per class
  g("fx_rt_film_scs", 'RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"', "num", "gss.rt_film", ["gss"]),
  g("fx_rt_film_scs_st", 'RT FILM Ratio % STATUS for Service Class By SUBCON "PR all"', "text",
    "CASE WHEN gss.rt_film >= 0 AND gss.rt_film < 0.02 THEN '1. 0 to 2% - ok' WHEN gss.rt_film >= 0.02 AND gss.rt_film < 0.04 THEN '2. 2 to 4% - monitor' WHEN gss.rt_film >= 0.04 AND gss.rt_film < 0.05 THEN '3. 4 to 5% - Critical' WHEN gss.rt_film >= 0.05 AND gss.rt_film <= 1 THEN '4. 5 to 100% - Action' END", ["gss"]),
  g("fx_welders_nort", "QTY Welder ID & No RT by Service Class + Service Cat+NDT Remarks", "num", "gss.welders_no_rt", ["gss"]),
  g("fx_cover_sc", 'RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"', "num", "coalesce(gsc.cover, 0)", ["gsc"]),
  g("fx_cover_sc_st", 'RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all" STATUS', "text",
    "CASE WHEN coalesce(gsc.cover, 0) < 0.05 THEN '1. < 5% - CHECK' WHEN gsc.cover < 0.1 THEN '2. 5% > 10%' END", ["gsc"]),
  g("fx_has_rt", "Has_RT_Report", "num", "gwsc.has_rt", ["gwsc"]),
  // per WPS / material
  g("fx_rt_wps", 'RT Ratio % For WPS "PR all"', "num", "gwps.rt_ratio", ["gwps"]),
  g("fx_rt_wps_st", "RT Ratio % STATUS for WPS", "text", wpsBands("gwps.rt_ratio"), ["gwps"]),
  g("fx_rt_mat", 'RT Ratio % For Material Type "PR all"', "num", "gmat.rt_ratio", ["gmat"]),
  g("fx_rt_mat_st", "RT Ratio % STATUS for Material Type", "text", wpsBands("gmat.rt_ratio"), ["gmat"]),
  // per joint, report, batch, the whole table
  g("fx_dup_weld_date", "Duplicate Weld Date", "num", "gj.dup_weld_date", ["gj"]),
  g("fx_dup_rt_date", "Duplicate RT Date", "num", "gj.dup_rt_date", ["gj"]),
  g("fx_dup_rt_report", "Duplicate RT Report", "num", "gj.dup_rt_report", ["gj"]),
  g("fx_dup_rt_report_joint", "Duplicate RT Report by Joint", "num", "grr.joints", ["grr"]),
  g("fx_batch_qty", "BATCH QTY Joints", "num", "gb.joints", ["gb"]),
  g("fx_pct_reject", "% of Total Reject", "num", "gt.pct_reject", ["gt"]),
  // CALCULATE in a column filters to the row itself (every row is unique by Index)
  g("fx_joint_uniq", 'Joint Uniq "PR all" Column', "num", "1", []),
  g("fx_total_dia", 'Total Welded Dia "PR all" Table', "num", "CASE WHEN w.weld_date IS NOT NULL THEN w.dia_inch END", []),
  // the row's own dates, and days to the report's Cur_Date (the cut-off Friday, {cur})
  g("fx_last_weld", 'Last_Weld Date "PR all"', "date", "w.weld_date", []),
  g("fx_days_last_weld", "Days Since Last Weld", "num", "{cur} - w.weld_date", []),
  g("fx_first_weld", 'First_Weld Date "PR all"', "date", "w.weld_date", []),
  g("fx_days_first_weld", "Days Since First Weld", "num", "{cur} - w.weld_date", []),
  g("fx_last_rt", 'Last_RT Date "PR all"', "date", "CASE WHEN w.manual_ut_date_all IS NULL THEN w.rt_date END", []),
  g("fx_days_last_rt", "Days Since Last RT", "num", "{cur} - CASE WHEN w.manual_ut_date_all IS NULL THEN w.rt_date END", []),
  g("fx_last_ut", 'Last_UT Date "PR all"', "date", "w.manual_ut_date_all", []),
  g("fx_days_last_ut", "Days Since Last UT", "num", "{cur} - w.manual_ut_date_all", []),
];


// ── lookups, testpacks, Inco, periods (migration 0055) ──

Object.assign(GRID_JOINS, {
  sd: `LEFT JOIN spool sd ON sd.source = 'SPOOL_DUMP' AND sd.spool_id = w.spool_id`,
  ts: `LEFT JOIN spool ts ON ts.source = 'TALISMAN_SPOOL' AND ts.spool_id = w.spool_id`,
  tal: `LEFT JOIN ref_talisman_joint tal ON tal.joint_id = w.joint_id`,
  mj: `LEFT JOIN mv_joint mj ON mj.source = w.source AND mj.joint_id = w.joint_id`,
  gi: `LEFT JOIN mv_grid_inco gi ON gi.k = (${WELDER_ID})`,
  gjtp: `LEFT JOIN mv_grid_joint_tp gjtp ON gjtp.k = w.joint_id`,
  gtp: `LEFT JOIN mv_grid_tp gtp ON gtp.k = coalesce(CASE WHEN upper(coalesce(w.sub_contractor, '')) = 'CCC' THEN gjtp.tp_ccc ELSE gjtp.tp_other END, '')`,
});

const IS_CCC = `upper(coalesce(w.sub_contractor, '')) = 'CCC'`;
const TP_ROW = `CASE WHEN ${IS_CCC} THEN gjtp.tp_ccc ELSE gjtp.tp_other END`;
/** Weld Dump's spool statuses ("Status … from WD"): the WD rows of the joint, by their spool in the Spool Dump. */
const WD = `w.source = 'WELD_DUMP'`;
const WD_FAB = `CASE WHEN ${WD} THEN CASE WHEN sd.fabricated IS NOT NULL THEN 'Fabricated' END END`;
const LAST_RT = `CASE WHEN w.manual_ut_date_all IS NULL THEN w.rt_date END`;
const incoBands = (v: string) =>
  `CASE WHEN ${v} >= 0 AND ${v} < 0.015 THEN '1. 0 to 1.5% - ok' WHEN ${v} >= 0.015 AND ${v} < 0.02 THEN '2.Monitor: 1.5% to 2%' WHEN ${v} >= 0.02 AND ${v} <= 1 THEN '3.Action: 2% to 100%' END`;
const tf = (x: string, y: string) => `CASE WHEN ${x} IS NULL THEN NULL WHEN upper(${x}::text) = upper(coalesce(${y}::text, '')) THEN 'TRUE' ELSE 'FALSE' END`;

/** "2 weeks Period for RT": 14-day periods from 28-Jul-23, the 37th open-ended (the pbix's nested IFs). */
function periods(): string {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const lab = (d: Date) => `${d.getUTCDate()}-${MON[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const parts: string[] = [];
  for (let i = 0; i < 37; i += 1) {
    const a = new Date(Date.UTC(2023, 6, 28 + 14 * i));
    const b = new Date(Date.UTC(2023, 6, 28 + 14 * (i + 1)));
    const label = `${i + 1}. ${lab(a)} to ${lab(b)}`;
    parts.push(i < 36 ? `WHEN w.rt_date >= DATE '${iso(a)}' AND w.rt_date < DATE '${iso(b)}' THEN '${label}'` : `WHEN w.rt_date >= DATE '${iso(a)}' THEN '${label}'`);
  }
  return `CASE ${parts.join(" ")} END`;
}

export const FX_MORE_COLUMNS: readonly GridCol[] = [
  g("fx_testpack", 'TESTPACK No "PR All"', "text", TP_ROW, ["gjtp"]),
  g("fx_tp_ratio", 'TP Ratio % Complete "PR all"', "num", "gtp.ratio", ["gjtp", "gtp"]),
  g("fx_tp_ratio_st", "TP Ratio % STATUS", "text",
    "CASE WHEN gtp.ratio >= 0 AND gtp.ratio < 0.5 THEN '1. 0 to 50%' WHEN gtp.ratio >= 0.5 AND gtp.ratio < 0.8 THEN '2. 50 to 80%' WHEN gtp.ratio >= 0.8 AND gtp.ratio < 0.99 THEN '3. 80 to 99%' WHEN gtp.ratio >= 0.99 AND gtp.ratio <= 1 THEN '4. 100%' END",
    ["gjtp", "gtp"]),
  g("fx_tp_complete", "TP Complete %", "num", "gtp.complete", ["gjtp", "gtp"]),
  g("fx_spool_status", "Spool ID Status", "text",
    `CASE WHEN ${IS_CCC} THEN CASE WHEN ts.qc_release IS NOT NULL THEN 'Fabricated' END ELSE ${WD_FAB} END`, ["ts", "sd"]),
  g("fx_spool_pwht", "Spool ID CCC PWHT Status", "text", `CASE WHEN ${IS_CCC} AND ts.pwht_date IS NOT NULL THEN 'Spool PWHT' END`, ["ts"]),
  g("fx_wd_fab", 'Status Fabricated from "WD"', "text", WD_FAB, ["sd"]),
  g("fx_wd_nde", 'Status Spool NDE from "WD"', "text", `CASE WHEN ${WD} THEN sd.spool_nde_status END`, ["sd"]),
  g("fx_wd_last", 'Last Spool Status from "WD"', "text",
    `CASE WHEN ${WD} THEN CASE WHEN sd.erected IS NOT NULL THEN 'ERECTED' WHEN sd.painted IS NOT NULL THEN 'PAINTED'` +
      ` WHEN upper(coalesce(sd.spool_nde_status, '')) = 'NOT RELEASED' THEN 'NOT Released' WHEN upper(coalesce(sd.spool_nde_status, '')) = 'RELEASED' THEN 'RELEASED'` +
      ` WHEN sd.qc_release IS NOT NULL THEN 'QC Release' WHEN sd.fabricated IS NOT NULL THEN 'Fabricated' END END`,
    ["sd"]),
  g("fx_wps_tal", 'WPS From "Talisman"', "text", `CASE WHEN ${IS_CCC} THEN tal.wps_code END`, ["tal"]),
  g("fx_wps_tal_tf", 'WPS from "Talisman" True/False Status', "text", tf(`(CASE WHEN ${IS_CCC} THEN tal.wps_code END)`, "w.wps_no"), ["tal"]),
  g("fx_tal_check", "CROSS CHECK DATA & Talisman JOINT ID", "text", `CASE WHEN ${IS_CCC} THEN coalesce(tal.joint_id, 'NO') END`, ["tal"]),
  g("fx_thk_tf", 'Thickness from "JR" True/False Status', "text",
    "CASE WHEN w.thickness_from_jr IS NULL THEN NULL WHEN w.thickness_from_jr = w.thickness THEN 'TRUE' ELSE 'FALSE' END", []),
  g("fx_pwht_new", 'PWHT Y/N CCC (NEW)', "text", `CASE WHEN ${IS_CCC} THEN CASE WHEN mj.pwht_y_n_ccc_new_y THEN 'Y' WHEN NOT mj.pwht_y_n_ccc_new_y THEN 'N' END END`, ["mj"]),
  g("fx_pwht_new_tf", "PWHT Y/N CCC True/False Status", "text",
    tf(`(CASE WHEN ${IS_CCC} THEN CASE WHEN mj.pwht_y_n_ccc_new_y THEN 'Y' WHEN NOT mj.pwht_y_n_ccc_new_y THEN 'N' END END)`, "w.pwht_y_n_ccc"), ["mj"]),
  g("fx_inco_15", 'Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS', "num", `CASE WHEN (${LAST_RT}) IS NOT NULL THEN gi.ratio_15 END`, ["gi"]),
  g("fx_inco_15_st", "Inco Rej Rate % STATUS for Welder by Length Last 2 Weeks", "text", incoBands(`(CASE WHEN (${LAST_RT}) IS NOT NULL THEN gi.ratio_15 END)`), ["gi"]),
  g("fx_inco_30", 'Inco Length Ratio % "PR all" For Welder LAST 1 Month', "num", `CASE WHEN (${LAST_RT}) IS NOT NULL THEN gi.ratio_30 END`, ["gi"]),
  g("fx_inco_30_st", "Inco Rej Rate % STATUS for Welder by Length Last 1 Month", "text", incoBands(`(CASE WHEN (${LAST_RT}) IS NOT NULL THEN gi.ratio_30 END)`), ["gi"]),
  g("fx_period_2w", "2 weeks Period for RT", "text", periods(), []),
];

/** Every column: the basic ones first (Joint ID leads, as in the pbix data view), the rest in table order, then the calculated ones. */
export const GRID_COLUMNS: readonly GridCol[] = [
  ...GRID_DEFAULT_COLUMNS.map((k) => CATALOG.find((c) => c.key === k)!),
  ...CATALOG.filter((c) => !GRID_DEFAULT_COLUMNS.includes(c.key)),
  ...FX_COLUMNS,
  ...FX_GROUP_COLUMNS,
  ...FX_MORE_COLUMNS,
];
