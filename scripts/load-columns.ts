/**
 * The exact column lists the batch-2 loaders write, in one place so
 * scripts/check-sql-columns.ts can prove offline that every one of them exists
 * in the effective schema. Importing a loader module directly would run its
 * main(); these lists are the contract, so they live apart from the code that
 * streams the files.
 */

/** `spool` column -> `Spool Dump.txt` header name. */
export const SPOOL_DUMP_MAP: Record<string, string> = {
    iso_number: "ISO Number", spool_no: "Spool No.",
    iso_rev_no: "Iso Rev No.", spool_rev_no: "Spool Rev No.", sheet_no: "Sheet No.",
    barcode_number: "Barcode Number",
    spool_shop_sub_contractor: "Spool Shop Sub Contractor",
    spool_field_sub_contractor: "Spool Field Sub Contractor",
    spool_paint_sub_contractor: "Spool Paint Sub Contractor",
    shop_sub_contractor: "Shop Sub Contractor", field_sub_contractor: "Field Sub Contractor",
    area_classification: "Area Classification", wbu: "WBU", pds_area: "PDS Area",
    pds_area_type: "PDS Area Type", line_no: "Line No", system_no: "System no",
    subsystem_code: "Subsystem Code", testpack_no: "Testpack No",
    testpack_sub_contractor: "TESTPACK SUB CONTRACTOR",
    service_class: "Service class", service_cat: "Service Cat",
    piping_group: "Piping Group", matrl_type: "Matrl Type", ag_ug_pkg: "AG/UG/PKG",
    lb_sb: "LB/SB", paint_system: "Paint System", material_availability: "Material Availability",
    shop_dia: "Shop Dia", shop_di_comp: "Shop DI Comp", field_dia: "Field Dia",
    field_di_comp: "Field DI Comp", spool_diameter: "Spool diameter",
    spool_weight: "Spool Weight", spool_length: "Spool Length", spool_volume: "Spool Volume",
    surface_area: "Surface Area", spool_inch_meter: "Spool Inch Meter",
    material_issue: "Material Check", mir_no: "MIR NO", mir_date: "MIR DATE",
    start_fab: "START FAB", fabricated: "FABRICATED", qc_release: "QC RELEASE",
    qc_sign_off: "QC SIGN OFF", sent_to_paint: "SENT TO PAINT", painted: "PAINTED",
    final_qc: "FINAL QC", laydown: "LAYDOWN", to_site: "TO SITE", erected: "ERECTED",
    welded_bolt: "WELDED BOLT", supported: "SUPPORTED", rft: "RFT",
    erec_mir_no: "EREC MIR NO", erec_mir_date: "EREC MIR DATE",
    testpack_test_done_date: "TESTPACK TEST DONE DATE",
    spool_nde_status: "Spool Nde Status",
    assembly_weld_nde_completed: "Assembly Weld NDE Completed",
    field_weld_nde_completed: "Field Weld NDE Completed",
    revision_status: "Revision Status", revision_comments: "Revision Comments",
    hold_status: "Hold Status", hold_comments: "Hold Comments",
    location_status: "Location Status", spool_tracking_date: "Spool Tracking Date",
  };

/** `spool` column -> `Spool.csv` (Talisman) header name. */
export const TALISMAN_SPOOL_MAP: Record<string, string> = {
    iso_number: "QCISO NO", spool_no: "SPOOL NO", spool_weight: "WEIGHT",
    fabrication_order: "FABRICATION ORDER", material_issue: "MATERIAL ISSUE",
    cut_fit: "CUT / FIT", fabricated: "SHOP WELD COMPLETE",
    qc_release: "QC SPOOL RELEASED TO NDT/PWHT", pwht_date: "PWHT",
    shop_nde_done: "SHOP NDE DONE", sent_to_paint: "PAINT RELEASE",
    laydown: "SENT TO LAYDOWN", painted: "PAINT COMPLETE",
    final_qc: "QC RELEASE FROM PAINTING", paint_report_date: "PAINTING REPORT DATE",
    paint_report_no: "PAINTING REPORT NO", laydown_move: "LAYDOWN MOVE",
    to_site: "SITE MOVE", erected: "SPOOL ERECTION DONE",
    field_weld_complete: "FIELD WELD COMPLETE", field_nde_done: "FIELD NDE DONE",
  };

export function spoolColumns(map: Record<string, string>): string[] {
  return ["source", "load_id", "spool_id", ...Object.keys(map)];
}

/** Value columns of `ccc_joint_pwht` the joint-record loader stages and collapses. */
export const CCC_JOINT_PWHT_COLUMNS = [
  "joint_id_jr", "pwht_y_n", "pwht_report_no", "pwht_date", "ht_report_no", "ht_date",
  "mt_root_report_no", "mt_root_date", "mt_root_pct", "mt_cap_pct",
  "pt_root_report_no", "pt_root_date", "pt_root_pct", "pt_cap_pct",
  "pmi_report_no", "pmi_date", "weld_report_no", "test_package_no", "sub_system_no",
  "wall_thickness", "rework_code", "sub_contractor", "weld_date", "repair_suffix",
] as const;

/** `weld` columns the NOT-WELDED joint-record slice writes (source CCC_JOINT_RECORD). */
export const CCC_JOINT_WELD_COLUMNS = [
  "source", "load_id", "joint_id", "spool_id",
  "iso_number", "iso_rev_no", "spool_no", "weld_no", "weld_cat", "weld_type",
  "dia_inch_factor", "dia_inch", "thickness", "pds_area", "ag_ug_pkg",
  "area_classification_label", "service_class", "material_type", "ndt_remarks",
  "sheet_no", "sub_contractor", "rework_code", "repair_suffix", "original_joint",
  "tracer_shot", "wps_no", "testpack_no_all", "welder_id",
  "pwht_y_n_ccc", "pwht_report_no_ccc", "pwht_date_no_ccc",
  "mt_report_ccc", "mt_date_ccc", "mt_pct_ccc",
  "pt_report_ccc", "pt_date_ccc", "pt_pct_ccc",
  "pmi_report_ccc", "pmi_date_ccc", "ht_report_ccc", "ht_date_ccc",
  "dwir_ccc_from_jr", "thickness_from_jr", "rework_code_all",
  "repair_reweld", "service_class_cat_wd", "service_class_cat_ndt",
  "temporary_lines", "tmcp_pipe", "exclude_ut_films", "exclude_debris_films",
] as const;

/** `weld` columns the welder record writes (source CCC_WELDER_RECORD). */
export const CCC_WELDER_WELD_COLUMNS = [
  "source", "load_id", "joint_id", "spool_id",
  "iso_number", "spool_no", "weld_no", "weld_cat", "weld_type", "dia_inch_factor",
  "dia_inch", "thickness", "pds_area", "ag_ug_pkg", "area_classification_label",
  "service_class", "material_type", "ndt_remarks", "weld_point_code", "weldpoint_no",
  "wps_no", "welder", "welder_id", "sub_contractor", "original_joint", "repair_suffix",
  "tracer_shot", "rt_ut", "weld_date", "cutting_date", "beveling_date", "fitup_date",
  "rt_report", "rt_date", "rt_acc_rej", "rt_pct", "rt_weld_status",
  "total_no_of_films_rej", "total_no_of_films_acc", "defect_code",
  "repair_reweld", "service_class_cat_wd", "service_class_cat_ndt",
  "temporary_lines", "tmcp_pipe", "exclude_ut_films", "exclude_debris_films",
  "weldpoint_seq",
] as const;

/** `weld` columns the post-COPY overlay UPDATE sets from ccc_joint_pwht. */
export const CCC_OVERLAY_COLUMNS = [
  "testpack_no_all", "pwht_y_n_ccc", "pwht_report_no_ccc", "pwht_date_no_ccc",
  "mt_report_ccc", "mt_date_ccc", "mt_pct_ccc",
  "pt_report_ccc", "pt_date_ccc", "pt_pct_ccc",
  "pmi_report_ccc", "pmi_date_ccc", "ht_report_ccc", "ht_date_ccc",
  "dwir_ccc_from_jr", "thickness_from_jr", "rework_code_all",
] as const;
