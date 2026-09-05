# `CSVExport_Welder Record.csv` -> `weld` column map (CCC)

Source of truth: the `CSVExport_Welder Record` Power Query in `analysis/pbix/model.md`
lines 3790-3928, replayed against the real 119-column header of
`sources/CSVExport_Welder Record.csv`. Counts are from
`analysis/sources2/welder-record.columns.json` (5,430,732 data lines, full pass).
Target names are `analysis/dump/profile.md` §8.1 `pg column name` (the db/README contract).

## Arithmetic

| step | count |
|---|---:|
| header columns in the CSV | 119 |
| dropped by `Table.RemoveColumns` | 78 |
| dropped by `Removed Columns1` (after rename) | 3 |
| **survive** into the model | **38** |
| added blank / derived by the M | 50 |
| = imported columns | **88** |
| pbix stores | 91 = 88 imported + 3 calculated (`PWHT Y/N CCC`, `PWHT Report No CCC`, `PWHT Date No CCC`) |

The 88 reconciles exactly. Note the M's `Table.RemoveColumns` list names 81 columns but
only 78 exist in the CSV header - `Last Reshoot Date_1`, `Last Reshoot Report No_2`,
`Last Reshoot Result_3` are spelled with a dot (`.1`) in the file. Power Query would
normally raise on a missing column name; the pbix's stored 91 says it did not, so those
names must resolve inside the appended `(ACC REJ)` workbook. An ETL should drop both
spellings; all three columns are empty in all 5.43 M rows.

## A. The 38 columns that survive (source -> M name -> `weld` column)

| CSV column | M renames to | `weld` column | transform | non-empty | distinct | notes |
|---|---|---|---|---:|---:|---|
| `Original Joint` | `-` | `original_joint` | carried through | 5,389,971 | 1 | `#` on 5,389,971 rows, blank on 40,761 - and the 40,761 blanks are exactly the rows that carry a `Repair Suffix`. So `'#'` means *this IS the original joint*; blank means repair/reweld. Inverted from the name. |
| `Sub-Con Code` | `Sub-Contractor` | `sub_contractor` | rename + `"#"`->`"CCC"` (no-op, see notes) | 5,430,732 | 1 | **already `CCC` in all 5,430,732 rows** - the M's `"#"`->`"CCC"` ReplaceValue is a NO-OP on this export (0 `#` values). calculation-logic.md §1.1 evidence-point 2 and §1.3 both assume otherwise. |
| `Welder No.` | `Welder` | `welder` | rename only | 5,430,729 | 2,047 | 2,047 distinct, all `W-####` in this CSV. The ACC/REJ workbook's first rows carry `E-###` ids instead - two id spaces in one column after the append. |
| `Weld Date` | `-` | `weld_date` | `0:00:00`->`''`; then `type date` | 5,430,732 | 1,607 | format is **`yyyy/mm/dd`**, 2021-12-01 .. 2026-08-28, 1,607 distinct, zero blanks. The dump is `dd-MMM-yyyy`. No `0:00:00` token is present, so the M's ReplaceText is also a no-op here. |
| `Area Code` | `PDS Area` | `pds_area` | rename only | 5,430,732 | 487 |  |
| `Area Group-2` | `Area Classification` | `area_classification` | rename only | 5,430,732 | 12 |  |
| `Area Group-3` | `AG/UG/PKG` | `ag_ug_pkg` | rename only | 5,430,732 | 2 |  |
| `QC ISO DWG. No.` | `ISO Number` | `iso_number` | rename only | 5,430,732 | 56,257 |  |
| `Joint No.` | `Weld No.` | `weld_no` | rename only | 5,430,732 | 1,860 |  |
| `Repair Suffix` | `-` | `repair_suffix` | `R01`->`R1`, `R02`->`R2` (ReplaceText) | 40,761 | 8 | `RW1` 34,706 / `RS1` 4,432 / `R01` 1,487 / `RW2` 60 / `RW1RS1` 36 / `RS2` 16 / `R1RS1` 12 / `R02` 12. M does `R01`->`R1`, `R02`->`R2` (ReplaceText, so `R1RS1` is untouched). The dump has NO such column - it encodes repairs in the last 2 chars of `Weld No.` (`weld.repair_reweld`). **Two different conventions in one column set.** |
| `Spool No.` | `-` | `spool_no` | carried through | 5,430,732 | 199 | 199 distinct, incl. 4,202 rows of the literal `-`. |
| `Service Class` | `Service class` | `service_class` | rename only | 5,430,732 | 112 |  |
| `Wall Thickness` | `Thickness` | `thickness` | rename only | 5,430,732 | 63 |  |
| `Dia Inch` | `Dia inch` | `dia_inch` | rename only | 5,430,724 | 69 | 448,842 rows are `0.0`; 69 distinct. `Dia Inch Factor` is derived `BW`/`CLET` -> Y. |
| `Material Category` | `Material Type` | `material_type` | rename only | 5,430,732 | 6 |  |
| `Work Category` | `Weld Cat` | `weld_cat` | rename only | 5,430,732 | 3 |  |
| `Weld Type` | `-` | `weld_type` | carried through | 5,430,732 | 26 |  |
| `NDT Remarks` | `-` | `ndt_remarks` | carried through | 5,430,732 | 4 |  |
| `Weld Point Code` | `-` | `weld_point_code` | carried through | 5,430,732 | 4 |  |
| `Welded(Weld Point)` | `WeldPoint No.` | `weldpoint_no` | rename only | 5,430,732 | 32 | 1..32, and `Weld Point Code` is `C`/`F`/`R`/`H` (cap/fill/root/hot) - **this is the file's grain**: one row per welder per pass position, not per joint. |
| `Welding Process` | `WPS No.` | `wps_no` | rename only | 5,430,730 | 85 | 85 distinct WPS codes (`CS/LTCS-001` 2,694,463 ...). Renamed to `WPS No.`, which in the dump is a genuinely different vocabulary - do not expect the per-WPS pages 41-44 to share codes across sources. |
| `Tracer Shot` | `-` | `tracer_shot` | carried through | 4,215 | 1 | `T` on 4,215 rows only; it is the only input to the derived `RT Weld Status = ... else if [Tracer Shot]="T" then "T"`. |
| `RT/UT` | `-` | `rt_ut` | carried through | 639,298 | 1 |  |
| `RT/UT Report No.` | `RT Report` | `rt_report` | rename only | 639,298 | ≥60,000 |  |
| `RT/UT Date` | `RT Date` | `rt_date` | `0:00:00`->`''`; `type date`; 4 hand-typed year fixes | 639,298 | 1,478 | `yyyy/mm/dd`, 2021-12-06 .. 2026-08-26, non-empty on 639,298 rows only. |
| `RT Film Total` | `-` | `rt_film_total` | carried through | 638,686 | 145 | **decimal, not integer**: `0.75` 296,274, `1.0` 83,911, `0.5` 76,411, `1.25` 24,304 ... 145 distinct. The dump's film counts are whole films. CCC's value is the *weld-point share* of a joint's films. `weld.rt_film_total` is a GENERATED column `acc+rej` and the M sets `Total No of films Acc = RT Film Total - Total No of films Rej`, so the generated column reproduces the source value exactly - but every film metric (M20-M26) becomes fractional for CCC. |
| `RT Film Reject` | `Total No of films Rej` | `total_no_of_films_rej` | rename only | 638,654 | 8 | `0.0` 637,809 / `1.0` 693 / `2.0` 104 / `3.0` 37 / `6.0` 6 / `4.0` 3 / `5.0` 1 / `10.0` 1. |
| `RT/UT Result` | `RT Acc/Rej` | `rt_acc_rej` | rename only | 639,298 | 3 | `A` 631,426 / `RS` 5,038 / `R` 2,834. Same three tokens the DAX tests, so `<> "RS"` ports unchanged. |
| `RT/UT(%)` | `RT%` | `rt_pct` | rename only | 5,430,732 | 5 | 5 values: `0` 3,421,891 / `5` 1,223,209 / `100` 484,130 / `10` 279,920 / `20` 21,582. **No `30`** (the dump has one) and a huge `0` bucket the dump does not have. The report's RT%-split pages (100/30/20/10/5) have no CCC 30% page and gain a 0% bucket. |
| `RT/UT Request Date` | `RT Selected Date` | `rt_selected_date` | rename only | 0 | 0 | **empty in all 5,430,732 rows** -> `rt_selected_date` is NULL for every CCC row. The RT-backlog aging buckets (M51) are driven by `RT Selected Date`; they cannot be computed for CCC from this file. |
| `RT/UT Defect Code` | `Defect Code` | `defect_code` | rename only | 706 | 9 |  |
| `RT/UT Defect Code Class` | `Location of Defect` | `location_of_defect` | rename only | 0 | 0 | **empty in all rows** -> `location_of_defect` NULL for CCC. |
| `Reshoot-1 RT/UT Report No.` | `RT Re-Shoot Rep` | `rt_re_shoot_rep` | rename only | 0 | 0 | **empty in all rows** -> `rt_re_shoot_rep` NULL for CCC (so M's `RT Re-Shoot Status`/`Reason` blanks are consistent). |
| `Reshoot-1 RT/UT Date` | `RT Re-Shoot Data` | `rt_re_shoot_data` | rename only | 0 | 0 | **empty in all rows**. |
| `Reshoot-1 RT Film Total` | `RT Re-Shoot Films` | `rt_re_shoot_films` | rename only | 0 | 0 | **empty in all rows**. |
| `Last Reshoot Date.1` | `-` | `last_reshoot_date1` | carried through | 0 | 0 | empty in all rows. **The M tries to drop `Last Reshoot Date_1` (underscore) but the CSV header spells it `Last Reshoot Date.1` (dot)** - same for `Last Reshoot Report No.1`/`Result.1`. Three columns therefore survive into the pbix table that the author meant to remove; all three are empty, so nothing breaks. Drop both spellings. |
| `Last Reshoot Report No.1` | `-` | `last_reshoot_report_no1` | carried through | 0 | 0 | empty in all rows; see the note on `Last Reshoot Date.1`. |
| `Last Reshoot Result.1` | `-` | `last_reshoot_result1` | carried through | 0 | 0 | empty in all rows; see the note on `Last Reshoot Date.1`. |

## B. The 50 columns the M adds (blank or derived)

| added column | `weld` column | value |
|---|---|---|
| `Iso Rev No.` | `iso_rev_no` | blank `""` |
| `Dia Inch Factor` | `dia_inch_factor` | `if [Weld Type] = "BW" or [Weld Type] = "CLET" then "Y" else "N"` |
| `Spool Rev No.` | `spool_rev_no` | blank `""` |
| `wbu` | `wbu` | blank `""` |
| `System no` | `system_no` | blank `""` |
| `Testpack No` | `testpack_no` | blank `""` |
| `Service Cat` | `service_cat` | blank `""` |
| `MIR No` | `mir_no` | blank `""` |
| `MIR Date` | `mir_date` | blank `""` |
| `Cutting Date` | `cutting_date` | `[Weld Date]` |
| `Beveling Date` | `beveling_date` | `[Weld Date]` |
| `Fitup Date` | `fitup_date` | `[Weld Date]` |
| `Preheat Date` | `preheat_date` | blank `""` |
| `DWIR No.` | `dwir_no` | blank `""` |
| `Total No of films Acc` | `total_no_of_films_acc` | `[RT Film Total]-[Total No of films Rej]` |
| `RT Batch No` | `rt_batch_no` | blank `""` |
| `RT Batch Status` | `rt_batch_status` | blank `""` |
| `RT Weld Status` | `rt_weld_status` | `if [RT Report] = "blank" then "HS" else if [#"RT%"] = 100 then "HS CCC" else if [Tracer Shot] = "T" then "T" else ""` |
| `RT Exam Req date` | `rt_exam_req_date` | blank `""` |
| `RT Xray No` | `rt_xray_no` | blank `""` |
| `RT Re-Shoot Status` | `rt_re_shoot_status` | blank `""` |
| `RT Re-Shoot Reason` | `rt_re_shoot_reason` | blank `""` |
| `Weld Length` | `weld_length` | blank `""` |
| `Rej Length` | `rej_length` | blank `""` |
| `RT Client Exam Req Y/N` | `rt_client_exam_req_y_n` | blank `""` |
| `By UT` | `by_ut` | blank `""` |
| `RT Remarks` | `rt_remarks` | blank `""` |
| `UT%` | `ut_pct` | blank `""` |
| `PWHT Y/N` | `pwht_y_n` | blank `""` |
| `PWHT Weld Status` | `pwht_weld_status` | blank `""` |
| `PWHT Selected Date` | `pwht_selected_date` | blank `""` |
| `PWHT Exam Req date` | `pwht_exam_req_date` | blank `""` |
| `PWHT Date` | `pwht_date` | blank `""` |
| `PWHT Report` | `pwht_report` | blank `""` |
| `PWHT Acc/Rej` | `pwht_acc_rej` | blank `""` |
| `PWHT Client Exam Req Y/N` | `pwht_client_exam_req_y_n` | blank `""` |
| `PWHT Remarks` | `pwht_remarks` | blank `""` |
| `HT%` | `ht_pct` | blank `""` |
| `HT Batch No` | `ht_batch_no` | blank `""` |
| `HT Batch Status` | `ht_batch_status` | blank `""` |
| `HT Weld Status` | `ht_weld_status` | blank `""` |
| `HT Selected Date` | `ht_selected_date` | blank `""` |
| `HT Exam Req date` | `ht_exam_req_date` | blank `""` |
| `HT Date` | `ht_date` | blank `""` |
| `HT Report` | `ht_report` | blank `""` |
| `HT Acc/Rej` | `ht_acc_rej` | blank `""` |
| `HT Client Exam Req Y/N` | `ht_client_exam_req_y_n` | blank `""` |
| `HT Remarks` | `ht_remarks` | blank `""` |
| `Joint ID` | `joint_id` | `[ISO Number]&"-"&[#"Spool No."]&"-"&[#"Weld No."]&""&[Repair Suffix]` |
| `Spool ID` | `spool_id` | `[ISO Number]&"-"&[#"Spool No."]` |

Three of these are **not** blank and matter:

* `Dia Inch Factor` = `Y` if `Weld Type` in {BW, CLET} else `N`.
* `Cutting Date` = `Beveling Date` = `Fitup Date` = `Weld Date` (fabricated, not real dates).
* `RT Weld Status` = `if [RT Report]="blank" then "HS" else if [RT%]=100 then "HS CCC"
  else if [Tracer Shot]="T" then "T" else ""`. The first branch tests the *literal string*
  `"blank"`, which never occurs (`RT Report` is either empty or a report number), so it is
  dead: CCC's `rt_weld_status` is `HS CCC` on the 484,130 RT%=100 rows, `T` on part of the
  4,215 tracer rows, and `''` elsewhere. **`HS CCC` is a token the dump never uses**, and the
  DAX status whitelists in calculation-logic.md §0.6 must be checked against it.
* `Total No of films Acc` = `RT Film Total - Total No of films Rej` - so `weld.rt_film_total`
  (GENERATED `acc+rej`) round-trips the source value.

## C. The 81 columns dropped

Dropped by `Table.RemoveColumns` (78 present in the header): `Del Flag`, `Welder Name`, `Serial No.`, `Weld Week`, `Weld Month`, `Area Group-1`, `Area Group-4`, `Area Group-5`, `Sheet No.`, `Pressure Level`, `Pipe Size`, `P No.`, `Original Work Category`, `Weld Remark`, `Joint Percent`, `Welding Position`, `Welding Rod Type`, `Reshoot-1 RT/UT Defect Code Class`, `Reshoot-2 RT/UT Report No.`, `Reshoot-2 RT/UT Date`, `Reshoot-2 RT Film Total`, `Reshoot-2 RT Film Reject`, `Reshoot-2 RT/UT Result`, `Reshoot-2 RT/UT Defect Code`, `Reshoot-2 RT/UT Defect Code Class`, `Reshoot-3 RT/UT Report No.`, `Reshoot-3 RT/UT Date`, `Reshoot-3 RT Film Total`, `Reshoot-3 RT Film Reject`, `Reshoot-3 RT/UT Result`, `Reshoot-3 RT/UT Defect Code`, `Reshoot-3 RT/UT Defect Code Class`, `Reshoot RT/UT Total`, `Reshoot RT/UT Film Total`, `Last Reshoot Date`, `Last Reshoot Report No`, `Last Reshoot Result`, `Last Reshoot RT/UT Defect Code`, `Last Reshoot RT/UT Defect Code Class`, `RT2/UT2`, `RT2/UT2 Report No.`, `RT2/UT2 Date`, `RT2 Film Total`, `RT2 Film Reject`, `RT2/UT2 Result`, `RT2/UT2(%)`, `RT2/UT2 Request Date`, `RT2/UT2 Defect Code`, `RT2/UT2 Defect Code Class`, `Reshoot-1 RT2/UT2 Report No.`, `Reshoot-1 RT2/UT2 Date`, `Reshoot-1 RT2 Film Total`, `Reshoot-1 RT2 Film Reject`, `Reshoot-1 RT2/UT2 Result`, `Reshoot-1 RT2/UT2 Defect Code`, `Reshoot-2 RT2/UT2 Report No.`, `Reshoot-2 RT2/UT2 Date`, `Reshoot-2 RT2 Film Total`, `Reshoot-2 RT2 Film Reject`, `Reshoot-1 RT2/UT2 Defect Code Class`, `Reshoot-2 RT2/UT2 Result`, `Reshoot-2 RT2/UT2 Defect Code`, `Reshoot-2 RT2/UT2 Defect Code Class`, `Reshoot-3 RT2/UT2 Report No.`, `Reshoot-3 RT2/UT2 Date`, `Reshoot-3 RT2 Film Total`, `Reshoot-3 RT2 Film Reject`, `Reshoot-3 RT2/UT2 Result`, `Reshoot-3 RT2/UT2 Defect Code`, `Reshoot-3 RT2/UT2 Defect Code Class`, `Reshoot RT2/UT2 Total`, `Reshoot RT2/UT2 Film Total`, `Last Reshoot RT2/UT2 Defect Code`, `Last Reshoot RT2/UT2 Defect Code Class`, `VT Judge`, `Welding Inspection Identifier Date`, `Welding Inspection Identifier Client`, `Welding Inspection Identifier Chiyoda`

Dropped after rename by `Removed Columns1`: `Reshoot-1 RT Film Reject`, `Reshoot-1 RT/UT Result`, `Reshoot-1 RT/UT Defect Code`

Names in the M's remove list that do **not** exist in the CSV header: `Last Reshoot Date_1`, `Last Reshoot Report No_2`, `Last Reshoot Result_3`.

## D. `weld` columns with NO CCC source (125)

These stay NULL for every `source='CCC_WELDER_RECORD'` row. Grouped:

* **UT block** (9): `ut_acc_rej`, `ut_client_exam_req_y_n`, `ut_date`, `ut_operator_id`, `ut_remarks`, `ut_report`, `ut_selected_by`, `ut_selected_date`, `ut_weld_status`
* **MT block** (14): `mt_acc_rej`, `mt_batch_no`, `mt_batch_status`, `mt_client_exam_req_y_n`, `mt_date`, `mt_exam_req_by`, `mt_exam_req_date`, `mt_exam_req_no`, `mt_pct`, `mt_remarks`, `mt_report`, `mt_selected_by`, `mt_selected_date`, `mt_weld_status`
* **PT block** (14): `pt_acc_rej`, `pt_batch_no`, `pt_batch_status`, `pt_client_exam_req_y_n`, `pt_date`, `pt_exam_req_by`, `pt_exam_req_date`, `pt_exam_req_no`, `pt_pct`, `pt_remarks`, `pt_report`, `pt_selected_by`, `pt_selected_date`, `pt_weld_status`
* **PMI block** (14): `pmi_acc_rej`, `pmi_batch_no`, `pmi_batch_status`, `pmi_client_exam_req_y_n`, `pmi_date`, `pmi_exam_req_by`, `pmi_exam_req_date`, `pmi_exam_req_no`, `pmi_pct`, `pmi_remarks`, `pmi_report`, `pmi_selected_by`, `pmi_selected_date`, `pmi_weld_status`
* **PADLT block** (11): `padlt_acc_rej`, `padlt_client_exam_req_y_n`, `padlt_date`, `padlt_exam_req_by`, `padlt_exam_req_date`, `padlt_exam_req_no`, `padlt_report`, `padlt_selected_by`, `padlt_selected_date`, `padlt_weld_status`, `padlt_y_n`
* **ORIF block** (11): `orif_acc_rej`, `orif_client_exam_req_y_n`, `orif_date`, `orif_exam_req_by`, `orif_exam_req_date`, `orif_exam_req_no`, `orif_report`, `orif_selected_by`, `orif_selected_date`, `orif_weld_status`, `orif_y_n`
* **FN block** (1): `fn_pct`
* **Manual UT** (3): `manual_ut_date`, `manual_ut_report_no`, `manual_ut_status`
* **Golden weld** (3): `golden_weld`, `golden_weld_report_date`, `golden_weld_report_no`
* **other** (45): `checked_date`, `erec_mir_date`, `erec_mir_no`, `group_1`, `group_2`, `ha`, `hold_comments`, `hold_status`, `ht_exam_req_by`, `ht_exam_req_no`, `ht_selected_by`, `ident_code_1`, `ident_code_2`, `matrl_traceability_y_n`, `packing_list_no`, `part_1`, `part_2`, `pds_area_type`, `pip_001_a`, `piping_group`, `priority_no`, `pwht_date_no_ccc`, `pwht_exam_req_by`, `pwht_exam_req_no`, `pwht_report_no_ccc`, `pwht_selected_by`, `pwht_y_n_ccc`, `result_a_r`, `revision_comments`, `revision_status`, `rework_code`, `rt_exam_req_by`, `rt_exam_req_no`, `rt_selected_by`, `sheet_no`, `shipment_date`, `shipment_recv_date`, `spool_status`, `subsystem_code`, `testpack_sub_contractor`, `testpack_test_done_date`, `tpi_cross_checked`, `trac_no_1`, `trac_no_2`, `w24dwir`

Consequences the metrics lane must plan for:

1. **UT.** `ut_weld_status` / `ut_report` / `ut_acc_rej` / `ut_date` are all NULL, so the
   `"EP"` definition of M30-M39 returns 0 for CCC. The pbix gets CCC's UT from
   `UT TRACKER (CCC)_Talisman` (9,419 rows, present) via `Manual UT Report No.` /
   `Manual UT Status` - which are *also* NULL in the welder record, i.e. they are supplied
   by a DAX `LOOKUPVALUE` against the tracker, not by the union.
2. **PWHT.** `pwht_y_n`, `pwht_report`, `pwht_weld_status`, `pwht_date` are added blank.
   CCC's PWHT comes from `AllTrain_CSVExport_Joint Record` - see §E.
3. **`weld_length` / `rej_length` are blank**, so M33/M34/M36 need the `Weld Length` dimension
   workbook, which is still missing.
4. **`service_cat` is blank**, so `service_class_cat_ndt` for CCC is `"<class>  <ndt> <rt%>"`
   with the doubled space - already documented in calculation-logic.md §1.3, and now
   confirmed: `NDT Remarks` is non-blank for CCC (`H`/`P`/`S`/`V`) whereas it is the empty
   placeholder for every Weld Dump row. **The composite key differs in shape between the two
   sources by more than a space** - CCC keys look like `1S1A  H 100` (blank service cat, non-blank NDT); dump keys like `1C3AS ABDF  100` (non-blank service cat, blank NDT) - the doubled space sits in a different position in each.
5. `revision_status` is absent, so the R-02 cancelled-weld filter has nothing to test on CCC
   rows; `Del Flag` (the file's own delete flag) is **empty in all 5,430,732 rows**.

## E. `AllTrain_CSVExport_Joint Record.csv` - what the model takes from it

It is **not** unioned into the fact table except for its NOT-WELDED slice. Two uses:

1. **CCC PWHT lookup.** Calculated columns `PWHT Y/N CCC`, `PWHT Report No CCC`,
   `PWHT Date No CCC` look up `Joint ID "JR"` -> `Joint ID`. The joint record's own
   `Joint ID` = `QC ISO DWG No & "-" & Spool No & "-" & Joint No & Repair Suffix`, the same
   recipe the welder-record query uses, so the join key is consistent.
2. **`AllTrain_CSVExport_Joint Record NOT WELDED`** - the same file re-read, filtered
   `Del Flag = ""` **and** `Weld Date = null`, and appended into
   `Project WD+WR+INCO+Acciona` (model.md line 4554). Those rows are joints that exist but
   have not been welded; they carry a `Sub-Contractor` and therefore appear in scope counts.

Row arithmetic, reproduced exactly:

| step | this file | pbix |
|---|---:|---:|
| physical data lines | 1,612,440 | - |
| `Del Flag = ""` | **1,560,273** | 1,560,273 |
| ... of which `Weld Date = null` -> NOT WELDED | **130,994** | 130,994 |
| ... of which welded | 1,429,279 | - |
| distinct `Joint ID` among welded | 1,339,071 | - |
| distinct `Joint ID` among NOT WELDED | 130,994 (unique) | - |

The columns the PWHT lookup needs:

| joint-record column | non-empty | vocabulary / range |
|---|---:|---|
| `PWHT` | 1,612,440 | `N`=1,403,778, `Y`=208,662 |
| `PWHT Report No` | 188,997 | `PWFRN00155`=366, `PWFRN00141`=339, `PWFRN00143`=301, `PWFR00062`=282, `PWFRN00135`=280, `PWFRN00167`=280, `PWFR00113`=275, `PWFR00076`=273 |
| `PWHT Date` | 188,997 | 2022-02-25 .. 2026-08-27 (`yyyy/mm/dd`) |
| `PWHT Request Date` | 0 | **empty in all rows** |
| `HT Report No` | 199,534 | `HT21418`=26, `HT24712`=22, `HT24871`=22, `HTE1510`=21, `HT24713`=20, `HT24714`=20, `HT24716`=20, `HT25037`=20 |
| `HT Date` | 199,534 | 2022-01-30 .. 2026-08-27 (`yyyy/mm/dd`) |
| `Del Flag` | 52,167 | `#`=52,167 |
| `Weld Date` | 1,431,795 | 2021-12-01 .. 2026-08-28 (`yyyy/mm/dd`) |
| `Repair Suffix` | 10,252 | `RW1`=8,693, `RS1`=1,145, `R01`=380, `RW2`=15, `RW1RS1`=9, `RS2`=4, `R02`=3, `R1RS1`=3 |

**`PWHT` is a clean `Y`/`N`** - `Y` 202,786 / `N` 1,357,487 on the kept rows. There is **no
`25.01` token here**: ruling R-04's ambiguous value is a Weld Dump artefact only, and CCC's
PWHT branch of M45/M46/M47 does not need it.

`PWHT Date` is `yyyy/mm/dd`, 2022-02-25 .. 2026-08-27, non-empty on 188,397 kept rows.
`PWHT Request Date` and `HT(%)` are **empty in all 1,612,440 rows**.

The 145-vs-143 field hazard: every data line carries **145** comma-separated fields against a
**143**-name header. Field 144 is empty on all 1,612,440 rows and field 145 holds the ISO's
line-number fragment on 1,029,449 rows (e.g. `BD6287101` for `11010P1-BD6287101`). Both are
unnamed; `Csv.Document(Columns=143)` truncates them and column alignment for 1..143 is
correct. An ETL must truncate, not fail.
