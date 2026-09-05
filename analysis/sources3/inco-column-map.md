# INCO — `Master Weld_Latest.xlsx` → `weld`

Evidence: `analysis/sources3/workbooks.md` (§ `sources/Inco/Master Weld_Latest.xlsx`),
the verbatim M in `analysis/pbix/model.md` § `Inco Weld Log` (lines 3937-4227), the union M
(4543-4583), `analysis/pbix/project-wd-wr-inco-acciona.md` §1.4/§1.5/§2.1, and the `weld`
contract in `db/README.md`.

Every count below came from `analysis/sources3/profile_xlsx.py`.

---

## 0. What the M reads

```m
Source = Excel.Workbook(File.Contents("…\Inco\Master Weld_Latest.xlsx"), null, true),
#"Overall Weld Log_Sheet" = Source{[Item="Overall Weld Log Query",Kind="Sheet"]}[Data],
#"Promoted Headers1" = Table.PromoteHeaders(#"Overall Weld Log_Sheet", [PromoteAllScalars=true]),
```

`Kind="Sheet"` — a **worksheet**, with `PromoteHeaders` and **no `Table.Skip`**.

| | |
|---|---|
| sheet | **`Overall Weld Log Query`** (the 4th of 7 sheets) |
| header | row 1, promoted |
| columns | **44** |
| data rows | **10,327** = the pbix's `Inco Weld Log` row count, **exactly** |

The sheet also carries a named Table `Overall_Weld_Log_Query` at `A1:AR10328` — same
range — but the M goes through the sheet, so the sheet is what we read.

The workbook's other sheets are **not** read by this query: `Overall Weld Log` (the human
log, with its own `Table1` at `A3:AP8318`), `NDT Tracking` → the separate `Inco NDT
Tracking` query (179 rows), `Summary of NDE` → `Inco of NDE Summary` (84), `Count Rows`
(a helper `Count_Rows` table at `A1:B7239`), `Correct Joints`, `DEC REJ`.

**`Overall Weld Log Query` is a machine-generated sheet, not the human log.** It is the
`Overall Weld Log` (8,315 rows) exploded by the `CountDelimiter` / `Count Rows.Count`
helper columns into 10,327 — one row per (joint × additional-RT-joint fragment).
Measured: `Sl No` has **8,315 distinct values over 10,327 rows**; `CountDelimiter`
runs 0-12 and `Count Rows.Count` 1-23. **The grain is therefore a joint-RT-fragment,
not a joint** (ruling R3-02).

**Canonical file.** Five Inco workbooks exist. Only `Master Weld_Latest.xlsx` and its
`Back up/` twin contain the `Overall Weld Log Query` sheet; the three dated
`01. Master Weld Log as on …` copies have only `Overall Weld Log`, `NDT Tracking`,
`Summary of NDE` (plus `Heating Coil Weldlog` in the July file) — the M would fail on
them (`workbooks.md`, back-ups table). The M names `Master Weld_Latest.xlsx`; it has
the sheet; it reproduces 10,327 exactly. **Canonical on evidence.**
`Link .txt` / `Put in FILE .txt` are the same two SharePoint URLs as Acciona's — where
the analyst re-downloads it. A stale LibreOffice lock file
`.~lock.Master Weld_Latest - Copy.xlsx#` from `VVS/MSI`, `18.08.2024 14:55`, sits in the
folder; the file it locked is not present. Harmless; delete it upstream.

---

## 1. Column map — workbook → M → `weld`

| # | workbook column | M rename / step | `weld` column | transform | notes |
|---:|---|---|---|---|---|
| 1 | `Sl No` | `Removed Columns` | — | dropped | 8,315 distinct over 10,327 rows — the explosion key |
| 2 | `Tank No` | → `ISO Number` | `iso_number` | verbatim | 41 distinct tanks (`65-T9405-A`, `60-T8301-B`, …). **Inco welds tanks, not pipe** |
| 3 | `Category 1` | — | **no `weld` column** | — | 15 distinct: `Shell Plate`×4,530, `ROOF PLATE`×1,919, `BOTTOM PLATE `, `Annular Plate`, `COMPRESION RING`, `RAFTER`, `SUMP`. Casing is inconsistent (`Bottom Plate`/`BOTTOM PLATE `/`bottom plate`) |
| 4 | `Category 2` | — | **no `weld` column** | — | 63 distinct: `1st to 2nd SHELL`, `3rd SHELL`, … |
| 5 | `Drg No` | — | **no `weld` column** | — | 118 distinct, 765 blank |
| 6 | `Material` | → `Material Type` | `material_type` | verbatim | 57 distinct **for 4 real grades** — `A 516 GR.60` / `A 516 Gr.60` / ` A516 Gr.60` / `A516 GR.60` / `A 516 Gr. 60`… Needs normalising if any metric groups on it |
| 7 | `joint with tank` | → `Joint ID`, then **`Removed Columns4` deletes it** and the derived `Custom` takes the name | — | dropped | 7,238 distinct `65-T9405-A H1`-style keys. See §9 |
| 8 | `Joint No` | → `Weld No.` | `weld_no` | verbatim | 1,350 distinct (`AS1`, `H1`, `CS1`, `RP1J03`…) |
| 9 | `Thick` | → `Thickness` | `thickness` | numeric | 27 distinct, 3 blank |
| 10 | `Length (MM)` | → `Weld Length` | `weld_length` | numeric, **millimetres** | 10,268 non-blank; `0`×1,440. See §6 |
| 11 | `Type of Weld` | → `Weld Type`; `BUTT`→`BW`, `FILLET`→`FW`, `Fillet`→`FW` | `weld_type` | replace | **already `BW`×5,867 / `FW`×4,460** — all three replacements are no-ops today |
| 12 | `process` | — | **no `weld` column** | — | 16 distinct: `SMAW`×6,217, `FCAW`×2,206, `SAW + SMAW`, `FCAW#(lf)SMAW`… |
| 13 | `WPS` | → `WPS No.` | `wps_no` | verbatim | 25 distinct `INQ-420-WPS-nnn`; 4 rows carry **two** WPS numbers in one cell |
| 14 | `Welder ID.` | → `Welder` | `welder` | verbatim | 237 distinct `INW-nnn`; 8 blank. **No `Text.Trim`** here (unlike Acciona) |
| 15 | `Fitup Report No.` | — | **no `weld` column** | — | 1,747 distinct, max length **176 chars** (multiple reports crammed in one cell) |
| 16 | `Date` | → `Fitup Date` | `fitup_date` | date | 10,327 non-blank |
| 17 | `Welding Report No.` | → `DWIR No.`, then **`Removed Columns7` deletes `DWIR No.`** | — | dropped | 1,543 distinct DWIRs thrown away. `DWIR Report "PR All"` is blank for Inco |
| 18 | `Date2` | → `Weld Date` | `weld_date` | date | 10,327 non-blank, 2023-05 … 2025-06 |
| 19 | `First Prod. Joint` | — | **no `weld` column** | — | 295 non-blank, `FPJ-01`… |
| 20 | `RT/UT Report` | → `RT Report`; `#N/A`→`""` | `rt_report` | replace | 4,677 non-blank / 2,058 distinct. **The same column carries RT *and* UT reports** — see §7 |
| 21 | `RT/UT Date` | → `RT Date` | `rt_date` | date | 4,675 non-blank |
| 22 | `RT STATUC` | → `RT Acc/Rej`; 9 replacements | `rt_acc_rej` | see §4 | 4,674 non-blank |
| 23 | `RT LENGTH (MM)` | → `Rej Length` | `rej_length` | numeric, mm | 4,674 non-blank. **This is the *inspected* RT length, and the M files it under `Rej Length`.** See §6 |
| 24 | `No. of RT Films shoot` | → `RT Film Total` | `rt_film_total` | **numeric, fractional** | `0.5`×1,606, `0.333…`×45, `0.25`×8 — **R2-04's fractional-film problem applies to Inco too**, and here it is inherent (a joint shot across several films) |
| 25 | `Aditional #(lf)Joint No.#(lf)RT` | — | **no `weld` column** | — | header contains two literal newlines. 3,788 non-blank; the comma-list that drove the row explosion |
| 26 | `Type of Repair` | → `Defect Code` | `defect_code` | verbatim | 7 distinct: `LI`×84, `SLAG`×13, `R/I`×6, `LI,RI`×2, `LF`, `Slag`, `CP`. **A different vocabulary from the dump's defect codes** and from `Rework code.xlsx` |
| 27 | `Repair Length (mm)` | — | **no `weld` column** | — | `0`×10,219 + 41 distinct non-zero |
| 28 | `RT P1 Rep.` | — | **no `weld` column** | — | 20 non-blank; first-repair RT report |
| 29 | `P1 Date` | — | **no `weld` column** | — | 2 non-blank |
| 30 | `RT P2 Rep.` | — | **no `weld` column** | — | 2 non-blank |
| 31 | `P2 Date` | — | **no `weld` column** | — | 2 non-blank |
| 32 | `PT/MT Report` | duplicated → `PT/MT Report - Copy`; the blank added `MT Report` is removed and the original becomes `MT Report`; the copy becomes `PT Report` | **`mt_report` AND `pt_report`** | one source → two columns | 4,912 non-blank. Note the leading spaces: ` INQ420-65-T9405B-MT-0053` |
| 33 | `PT/MT Date` | same duplication | **`mt_date` AND `pt_date`** | one source → two columns | 4,901 non-blank |
| 34 | `VBT Report` | — | **no `weld` column** | — | 6,055 non-blank. Vacuum-box test — Inco's own NDE method, with no home in the schema |
| 35 | `VBT Date` | — | **no `weld` column** | — | 6,055 non-blank |
| 36 | `OPT Report` | — | **no `weld` column** | — | 230 non-blank |
| 37 | `OPT Date` | — | **no `weld` column** | — | 230 non-blank |
| 38 | `PWHT Report` | — | `pwht_report` | verbatim | **0 non-blank — 100 % empty** |
| 39 | `PWHT Date` | — | `pwht_date` | date | **0 non-blank — 100 % empty** |
| 40 | `HT Report` | — | `ht_report` | verbatim | 1,305 non-blank |
| 41 | `HT Date` | — | `ht_date` | date | 1,305 non-blank |
| 42 | `Remarks` | → `HT Remarks` | `ht_remarks` | verbatim | 446 non-blank, of which **`PAUT`×441**. The M then reads it back to synthesise the whole UT block — §7 |
| 43 | `CountDelimiter` | — | **no `weld` column** | — | the explosion counter, 0-12 |
| 44 | `Count Rows.Count` | — | **no `weld` column** | — | the explosion counter, 1-23 |

**Accounting: 44 = 23 mapped to a `weld` column + 18 that reach the union with no `weld`
column + 3 dropped by the M itself** (`Sl No`, `joint with tank`, `Welding Report No.`).

The 18 without a target are exactly `project-wd-wr-inco-acciona.md` §2.1's
**block G, "Добавлено Inco Weld Log" (16 columns)** plus `CountDelimiter` and
`Count Rows.Count` from block H. They exist in the pbix union and in no metric.

### `weld` columns with no INCO source

* **`dia_inch` — added as `""`.** Inco welds plate, so there is no diameter.
  Consequence: every dia-inch measure (the entire welded-volume family) is **blank for
  Inco**, and the `weld_length_by_dia` lookup cannot resolve — which is precisely why
  the DAX has an Inco-specific branch (§6).
* **`rt_pct` — added as `""`.** Inco appears in no RT% page bucket.
* `weld_cat` is the constant `"F"`; `spool_no` / `spool_id` are the constant `"-"`;
  `iso_rev_no`, `spool_rev_no`, `pds_area`, `ag_ug_pkg`, `area_classification`, `wbu`,
  `system_no`, `testpack_no`, `service_class`, `service_cat`, `mir_no`, `mir_date`,
  `cutting_date`, `beveling_date`, `preheat_date` are all `""`.
* `rework_code`, `repair_suffix`, `weld_point_code`, `ndt_remarks`, `rt_ut`,
  `tracer_shot` — all `""`.
* the `PMI`, `FN`, `PADLT`, `ORIF` blocks, the material-traceability block,
  `revision_*`, `hold_*`, `golden_weld_*`, `subsystem_code`, `Custom3`…`Custom14`,
  `PED` — all `""`.
* everything dump- or CCC-only (`Manual UT *`, `Result (A/R)`, the shipment tail).

---

## 2. Constants and derived columns

| target | value |
|---|---|
| `sub_contractor` | **`"Inco"`** (mixed case). Trend workbooks use both `Inco` and `INCO`; the welder register uses `INCO`. Normalise to `INCO` (R2-08) |
| `original_joint` | **`"Inco"`** — as with Acciona, the sub-contractor name, not a joint id |
| `weld_cat` | `"F"` for every row |
| `spool_no`, `spool_id` | `"-"` for every row |
| `weldpoint_no` | `1` |
| `dia_inch`, `rt_pct`, `dia_inch_factor` | `""` |
| `total_no_of_films_rej` | `if [RT Acc/Rej]="R" then [RT Film Total] else 0` |
| `total_no_of_films_acc` | `if [RT Acc/Rej]="A" then [RT Film Total] else "0"` — **note the string `"0"`**, not the number 0; the union's `Table.TransformColumnTypes(… {"Total No of films Acc", type number})` coerces it |
| `by_ut` | `if [HT Remarks]="PAUT" then "Y" else ""` → 441 rows |
| `ut_remarks` | `if [HT Remarks]="PAUT" then "PAUT" else ""` |
| `ut_date` | `if [UT Remarks]="PAUT" then [RT Date] else ""` |
| `ut_report` | `if [UT Remarks]="PAUT" then [RT Report] else ""` |
| `ut_acc_rej` | `if [UT Remarks]="PAUT" then [RT Acc/Rej] else ""`, then `ACC`→`A`, `REJ`→`R`, `RECT`→`R` |
| `mt_weld_status` | `if [MT Report] <> null then "NR" else null` |
| `joint_id` | `[ISO Number]&"-"&[Spool No.]&"-"&[Weld No.]` — see §9 |

Filters the M applies: `[Joint ID] <> "blank"` and `[Weld Type] <> null`. Both are
satisfied by every row today (10,327 in, 10,327 out).

---

## 3. Dates

Every Inco date column is a **real Excel date cell**, not text: `Date`, `Date2`,
`RT/UT Date`, `P1 Date`, `P2 Date`, `PT/MT Date`, `VBT Date`, `OPT Date`, `PWHT Date`,
`HT Date`. The M only does `type date`. **No string parsing is needed and
`weld_to_date()` is not involved** — the opposite of Acciona (`dd-mm-yyyy` text) and CCC
(`yyyy/mm/dd` text).

---

## 4. `RT Acc/Rej` vocabulary vs the dump's

Raw, measured: **`A`×4,572, `R`×98, `RS`×4**, blank×5,653. Three tokens, all already in
the dump's vocabulary.

The M nevertheless runs **nine** replacements — `"ACC "`→`ACC`, `"A "`→`A`, `ACC`→`A`,
`REJ`→`R`, `GRS-A`→`A`, `RS-A`→`RS`, `RESHOOT`→`RS`, `R/S`→`RS`, `RECT`→`R` — **every
one a no-op on this file.** They are scar tissue from earlier vintages. Reproduce them
(cheap, and a future refresh may need them), but do not add any of the pre-images to a
status whitelist: they never reach the model.

Note the order hazard the M gets away with: `ACC`→`A` runs before `RECT`→`R`, and
`RECT` contains no `ACC`, so nothing collides. `GRS-A`→`A` before `RS-A`→`RS` matters
and the M has it right.

`UT Acc/Rej` is derived from `RT Acc/Rej` (§7) and then gets its own `ACC`→`A`,
`REJ`→`R`, `RECT`→`R`.

**Conclusion: Inco introduces no new acc/rej token.** No `lib/metrics` whitelist changes.

---

## 5. `RT%`

**`RT%` is the empty string for every Inco row** (`Table.AddColumn(…, "RT%", each "")`),
which the union then types `Int64` → **null**. Inco therefore appears in **none** of the
100/30/20/10/5 RT% page buckets, and any `rt_pct`-driven aggregate silently omits it.
This is not a defect to fix — it is what the report does.

---

## 6. Lengths — and the one place Inco is special-cased in DAX

Inco is the **only** source that carries a real weld length, and the DAX knows it:

```dax
Project WD+WR+INCO+Acciona[Weld Length "PR all"] =
IF( [Sub-Contractor] = "Inco" && [Manual UT Report No.] <> "",
    [Weld Length] / 1000,
    <LOOKUPVALUE on 'Weld Length'[Dia inch]> )
```

* `weld_length` for Inco = the workbook's `Length (MM)` — **millimetres**, hence `/1000`.
  10,268 non-blank, `0` on 1,440 rows.
* The guard is `[Manual UT Report No.] <> ""`. **`Manual UT Report No.` is a `Weld Dump`
  column that Inco fills with nothing** — the Inco M never populates it. Read literally,
  the Inco branch **never fires**, and the `LOOKUPVALUE` branch then fails because
  `dia_inch` is empty → `Weld Length "PR all"` is **BLANK for every Inco row**.
  Flag this to the owner (ruling R3-06): either the guard is a bug, or Inco lengths were
  never meant to appear in the length metrics. Do not "fix" it silently.
* `rej_length` for Inco = `RT LENGTH (MM)` — which by its own name is the **length
  radiographed**, not the length rejected. The six `Inco RT/UT * Length` measures
  (`measures.md` 5783-5888) read it as inspected length. **The column name in `weld` is
  therefore wrong for Inco rows.** Record it; do not rename the column.
* `Repair Length (mm)` — the actual repaired length — has **no target column**.

---

## 7. There is no UT tracker for Inco — the M fabricates one

Inco's `RT/UT Report` / `RT/UT Date` / `RT STATUC` are a **single combined RT-or-UT
column set**. The M splits them apart on one signal, `Remarks = "PAUT"`
(phased-array UT), 441 rows:

```
By UT       = if [HT Remarks]="PAUT" then "Y" else ""
UT Remarks  = if [HT Remarks]="PAUT" then "PAUT" else ""
UT Date     = if [UT Remarks]="PAUT" then [RT Date]      else ""
UT Report   = if [UT Remarks]="PAUT" then [RT Report]    else ""
UT Acc/Rej  = if [UT Remarks]="PAUT" then [RT Acc/Rej]   else ""
```

So 441 rows are **counted as both an RT and a UT** — the RT columns are never cleared.
Any measure that sums `rt_report IS NOT NULL` plus `ut_report IS NOT NULL` double-counts
those 441 for Inco. Reproduce literally; note it in the metrics lane.

`MT Weld Status = if [MT Report] <> null then "NR" else null` is the other synthesised
status, and `NR` is already in the dump's vocabulary.

---

## 8. Repairs

* `Repair Suffix` and `Rework Code` are added blank.
* The DAX makes this explicit:
  `Project WD+WR+INCO+Acciona[Repair & Reweld "PR all"]` opens with
  `[Sub-Contractor] <> "Inco"` (`measures.md:8091`) — **Inco is hard-excluded from the
  repair/reweld split by DAX**, not by the filter layer. `repair_reweld` must be `''`
  for every Inco row (`db/README.md` §"one column, two rules" already says so).
* `Exlude RT Films from UT` likewise carries `[Sub-Contractor] <> "Inco"`
  (`measures.md:11367`).
* The real repair data (`Type of Repair`, `Repair Length (mm)`, `RT P1 Rep.`, `P1 Date`,
  `RT P2 Rep.`, `P2 Date`) reaches the union but no metric.

---

## 9. Joint id

```m
#"Added Custom6" = Table.AddColumn(…, "Custom", each [ISO Number]&"-"&[#"Spool No."]&"-"&[#"Weld No."]),
… Removed Columns4 ({"Joint ID"}) … Renamed Columns9 ({{"Custom","Joint ID"}})
… Filtered Rows4 = Table.SelectRows(…, each ([Joint ID] <> "blank"))
```

With `Spool No. = "-"` this yields **`<Tank No>---<Joint No>`**, e.g. `75-T9203---AS1`,
`65-T9405-A---H1`. Three consecutive hyphens are the Inco signature in `joint_id`.

The workbook's own `joint with tank` column (`65-T9405-A H1`, space-separated, 7,238
distinct) is **discarded** in favour of the constructed key. Since the sheet is exploded,
`joint_id` is **not unique** — 7,238 real joints across 10,327 rows. Every Inco metric
must be `count(DISTINCT joint_id)`, the same rule R2-01 imposed on CCC.

`Spool ID = "-"` for every row, so Inco can never join `spool`.

---

## 10. What the union does with Inco specifically

* **Position 4 of 4** in `Table.Combine({Weld Dump, CSVExport_Welder Record, Acciona_Query, Inco Weld Log})`.
* `Filtered Rows SubCon` (`[Sub-Contractor] <> ""`): 0 Inco rows dropped.
* `Replaced RPDS/RPDUA/RPD0/…/SOBA to RPD/SOB`: Inco has only `BW`/`FW` → no-ops.
* `Joint ID for Heat N` = `ISO-WeldNo` (empty `Repair Suffix`).
* `EXLUDE 4 RT B.log CCC`: all four ids are CCC → no Inco row excluded.
* Contribution: **10,327 rows = 0.16 %** of the 6,546,261-row union.

---

## 11. R-03 confirmation — INCO is out by default

Measured from `analysis/pbix/report-inventory.md`:

| filter predicate | visual-level | page-level | total |
|---|---:|---:|---:|
| `NOT ('Project WD+WR+INCO+Acciona'[Sub-Contractor] IN {Inco})` | 61 | 8 | **69** |
| `NOT (…[Sub-Contractor] IN {Acciona, Inco})` | 5 | 2 | **7** |
| `NOT ('TREND Report'[Sub-Contractor] IN {Inco})` | 2 | 0 | **2** |
| `NOT (…[Sub-Contractor] IN {CCC, GAC, Inco, MEDGULF, TEKFEN})` | 1 | 0 | **1** |

* The two pages behind the mockup — pbix **21** `REP. Project Welding Progress
  +Inco+Acciona` and **22** `REP. Project Welding & NDE Status +INCO+Acciona` — both
  exclude Inco: page 21 with 23 per-visual filters, page 22 with one page-level filter.
* The **mockup's page 2** sub-contractor table (`mockups/welding-dashboard 1.html:846-851`)
  lists **Acciona, CCC, GAC, MEDGULF, TEKFEN, Total** — an **Acciona row (`% Rej by J` =
  0.39 %) and no Inco row**. That is the decisive artefact.
* **The exclusion lives in the filter layer, not in DAX.** Base measures such as
  `[Total Scope Joints Uniq "BW" "PR all"]` and `[Total Scope Dia "BW" "PR all"]`
  explicitly include Inco: `[Sub-Contractor] IN {"GAC","TEKFEN","MEDGULF","Acciona","Inco"}`
  (`measures.md` 2844 / 2858 / 3881). A reimplementation that omits the
  `sub_contractor <> 'INCO'` predicate at query scope will over-count.
* Inco-specific measures do exist and are wanted where the page asks for them:
  `[RT BACKLOG INCO]`, `[Qualified Welders Inco]`, `[No Weld Done Inco]`, and the six
  `Inco RT/UT * Length` measures. **So Inco must be loaded, not skipped** — it is
  excluded by a default predicate, not absent.
* Caveat to record: 7 filters exclude **Acciona and Inco together**, on internal /
  error-audit pages 13, 76, 82, 87, 113, 114. "Include Acciona" is the default for the
  two report pages, not a global invariant.

**R-03 stands, unchanged and now evidenced: load INCO, default-filter it out.**

---

## 12. Loader checklist

1. Read sheet **`Overall Weld Log Query`**, promote row 1, assert **44 columns** and
   **10,327 data rows**; abort otherwise.
2. `source = 'INCO'`, `sub_contractor = 'INCO'`.
3. Apply the 23-column map (remembering that `PT/MT Report` and `PT/MT Date` each feed
   **two** target columns), the constants, and the 5 synthesised UT columns.
4. Dates are real date cells — read them as dates, do not route through
   `weld_to_date()`.
5. `weld_length` stays in **millimetres** as the pbix stores it; `weld_length_m` is
   computed downstream (§6) and today evaluates to NULL for Inco. Do not divide at load.
6. `rt_film_total` is **fractional** for Inco (`0.5`, `0.333…`, `0.25`) — the
   `numeric(10,4)` from R2-04 covers it.
7. `repair_reweld = ''` unconditionally for Inco (the DAX says so).
8. Every Inco metric is `count(DISTINCT joint_id)` — 7,238 joints in 10,327 rows.
9. Add `sub_contractor <> 'INCO'` to the default project-scope predicate in
   `lib/metrics`, switchable, and never to the Inco-specific KPIs.
10. `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_joint` after the load.
