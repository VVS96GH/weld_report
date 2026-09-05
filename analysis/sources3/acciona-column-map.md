# ACCIONA — `Acciona_Latest Add to Query.xlsx` → `weld`

Evidence: `analysis/sources3/workbooks.md` (§ `sources/Acciona/Acciona_Latest Add to
Query.xlsx`), the verbatim M in `analysis/pbix/model.md` § `Acciona_Query`
(lines 4228-4542), the union M § `Project WD+WR+INCO+Acciona` (4543-4583),
`analysis/pbix/project-wd-wr-inco-acciona.md` §1.4/§1.5/§2.1, and the `weld`
contract in `db/README.md` / `db/migrations/0003_weld.sql`.

Every count in this file was produced by `analysis/sources3/profile_xlsx.py`.

---

## 0. What the M actually reads — and it is not a sheet

```m
Source = Excel.Workbook(File.Contents("…\Acciona\Acciona_Latest Add to Query.xlsx"), null, true),
Acciona_Query_Table = Source{[Item="Acciona_Query",Kind="Table"]}[Data],
```

`Kind="Table"` — a **named Excel Table (ListObject)**, not a worksheet. Measured:

| | |
|---|---|
| table | `Acciona_Query`, on sheet **`ICS Quary`**, range **`A1:BA13314`**, `headerRowCount=1` |
| header | row 1 of the table, **verbatim** — there is **no `Table.PromoteHeaders` step** and no `Table.Skip` |
| columns | **53** |
| data rows | **13,313** = the pbix's `Acciona_Query` row count, **exactly** |

The other sheets in the workbook (`ICS` with its own `Table2` at `A3:BA13316`,
`Joint Summary`, `Legend-Weld type`) are **not** read by `Acciona_Query`;
`Joint Summary` is read by a second query (§6).

**Canonical file.** Four Acciona workbooks sit in `sources/Acciona/` plus three in
`Back up/`. Only `Acciona_Latest Add to Query.xlsx` contains the `Acciona_Query`
table at all — the other six have no named Table and no `ICS Quary` sheet
(`workbooks.md` § "Back-ups and dated copies"). The M names this file; the file is
the only one whose shape can satisfy the M; and its 13,313 rows reproduce the pbix
exactly. **It is canonical, on evidence, not convention.** The two `.txt` notes next
to it (`Link .txt`, `PUT IN FILE .txt`) are SharePoint URLs to
`…/01-Main Works/Welding Register` and `…/Welding Register/Weld Log` — provenance
for where the analyst re-downloads it, nothing about the transform.

---

## 1. Column map — workbook → M → `weld`

`transform` is what our loader must do; it is the M's behaviour, restated in SQL terms.

| # | workbook column | M rename / step | `weld` column | transform | notes |
|---:|---|---|---|---|---|
| 1 | `Sl No` | `Removed Columns` | — | dropped | 13,313 distinct; a row counter |
| 2 | `ISO Number` | — | `iso_number` | verbatim | 394 distinct, never blank |
| 3 | `Line No.` | `DELL LINE No` removes it **after** deriving `Service class` | (`service_class` only) | `Text.BetweenDelimiters(Line No.,"(",")")` | 428 distinct, e.g. `SA6594870-2"(1A0K-AC)-N` → `1A0K-AC` |
| 4 | `Iso Rev No.` | — | `iso_rev_no` | verbatim | 21 distinct (`0`, `0.A`, `2.A`, `0A`…) — the dot/no-dot pairs are the same revision written two ways |
| 5 | `Spool No.` | `Replaced Value11`: `null` → `-_-` **before** `Spool ID` | `spool_no` | `coalesce(nullif(spool_no,''),'-_-')` | 1,013 distinct, 0 blank in this file, so the `-_-` branch never fires today |
| 6 | `Weld No.` | — | `weld_no` | verbatim | 1,408 distinct (`FJ-45`, `SJ-05RW1`…) |
| 7 | `Dia          (Ø)` | → `Dia inch` | `dia_inch` | numeric | **note the 10 spaces in the source name.** 15 distinct: 0.5×6,847 … 20, 24. Never 0, never blank |
| 8 | `Thickness` | — | `thickness` | numeric | **8,593 of 13,313 blank (64.5 %)** — exactly the `P001` WPS / `FOURTH DIMENSION` rows |
| 9 | `Material Type` | — | `material_type` | verbatim | 6 distinct: `WP 316L`, `TP 316L`, `SDSS`, `SS 316L`, `DSS`, `TEE`(×1, a data error) |
| 10 | `Part 1` | — | **no `weld` column** | — | survives into the union (block D of §2.1); `weld` has no `part_1` |
| 11 | `Heat No. 1` | `Removed Columns5` | — | dropped | |
| 12 | `Part 2` | — | **no `weld` column** | — | as `Part 1` |
| 13 | `Heat No. 2` | `Removed Columns5` | — | dropped | |
| 14 | `WPS No.` | — | `wps_no` | verbatim | 9 distinct. `P001`×8,593 is **not a WPS number** — it is the Fourth Dimension placeholder |
| 15 | `Weld Type` | — | `weld_type` | verbatim | 5 distinct: `BW`×7,323, `SW`×4,800, `FW`×1,067, `C`×120, `O'LET`×3. The union then runs its `RPD*`/`SOB*` collapses — none of these tokens is affected |
| 16 | `Welder` | `Trimmed Text1` = `Text.Trim` (the **last** step of the query) | `welder` | `trim()` | 34 distinct. Two vocabularies: `NFE-FD-xxx` (Fourth Dimension) and `W-xxx` (Debaj) |
| 17 | `DWR` | → `DWIR No.` | `dwir_no` | verbatim | 991 distinct `NFE1-ACA-…-FDWR-nnnnn` |
| 18 | `Weld Cat` | `Field`→`F`, `Shop`→`S`, `shop`→`S` | `weld_cat` | replace | already `F`×12,638 / `S`×675 in this file — the replacements are no-ops today |
| 19 | `Ferrite  Report No: & Date` | `Removed Columns1` | — | dropped | 187 values thrown away |
| 20 | `Ferrite Acc/Rej` | `Removed Columns1` | — | dropped | |
| 21 | `PMI Report No. & Date` | `SplitColumn` on `&` → `PMI Report` + `PMI Date` | `pmi_report`, `pmi_date` | split on first `&`; date part `dd-mm-yyyy` (M rewrites `-01-`…`-12-` to `-Jan-`…`-Dec-`) | 1,386 non-blank. Many contain an embedded newline before the date |
| 22 | `PMI Acc/Rej` | `Accepted`→`A` | `pmi_acc_rej` | replace | `A`×1,359 + `ACCEPTED`×26 → all `A` |
| 23 | `PT Report No. & Date` | split on `&` → `PT Report` + `PT Date`; then `/`→`-`, `Text.Trim`, month rewrite | `pt_report`, `pt_date` | same shape as PMI | 1,321 non-blank |
| 24 | `PT Acc/Rej` | `Accepted`→`A` | `pt_acc_rej` | replace | `A`×1,321 — single value |
| 25 | `RT Report No. & Date` | split on `&` into **3**, then part 3 split again → `RT Report`, `RT Date`, `RT Re-Shoot Data`, `RT Re-Shoot Rep` | `rt_report`, `rt_date`, `rt_re_shoot_data`, `rt_re_shoot_rep` | see §3 | 1,624 non-blank / 1,378 distinct |
| 26 | `RT Acc/Rej` | `Accepted`→`A`, `Repair`→`R`, `Reshoot / A`→`RS`, `(QG sign. pending)`→``, `U/review`→`U/Review` | `rt_acc_rej` | replace chain | **already `A`×1,559 / `RS`×52 / `R`×13** in this file — every replacement is a no-op today. See §4 |
| 27 | `Total Films` | → `RT Film Total` | `rt_film_total` | numeric | 0×11,689, then 1-8. **Integers** — unlike CCC, no fractional films here (R2-04 does not bite Acciona) |
| 28 | `Accepted Films` | `null`→`0` **first**, then → `Total No of films Acc` | `total_no_of_films_acc` | `coalesce(…,0)` | |
| 29 | `Rejected Films` | `null`→`0`; then **replaced** by `Total No of films Rej2 = if [RT Acc/Rej]="R" then [Total No of films Rej] else 0`, which is renamed back to `Total No of films Rej` | `total_no_of_films_rej` | `CASE WHEN rt_acc_rej='R' THEN rejected_films ELSE 0 END` | the raw column has 13 non-zero rows; the M zeroes any that are not `R` |
| 30 | `RT Status %` | `0.05`→`5`, `1`→`100`, `Int64` | `rt_pct` | see §5 | **already `100`×945 / `5`×679** — the 0.05/1 replacements are no-ops today |
| 31 | `Remark` | → `RT Remarks` | `rt_remarks` | verbatim | 101 non-blank |
| 32 | `INTERNAL CLEANING RFI` | `Removed Columns2` | — | dropped | 12,521 values thrown away |
| 33 | `INTERNAL CLEANING DATE` | `Removed Columns2` | — | dropped | 12,488 dates thrown away |
| 34 | `FITUP RFI` | `Removed Columns2` | — | dropped | |
| 35 | `FITUP DATE` | → `Fitup Date` | `fitup_date` | date | 13,313 non-blank, 448 distinct, 2024-01 … 2025-02 |
| 36 | `WELDING DATE` | → `Weld Date` | `weld_date` | date | **13,313 non-blank** — never null, which matters for `RT Weld Status` (§7) |
| 37 | `WELD VISUAL RFI` | `Removed Columns2` | — | dropped | |
| 38 | `WELD VISUAL DATE` | `Removed Columns2` | — | dropped | 13,313 dates thrown away |
| 39 | `Iso Penalty` | `Removed Columns4` | — | dropped | |
| 40 | `Sht` | `Removed Columns4` | — | dropped | 100 % blank |
| 41 | `Tracer 1` | → `Tracer Shot` (rename, **not** the derived flag) | `tracer_shot` | verbatim | **See the bug in §8**: the M computes `Tracer Shot = if [Tracer 1]<>"" then "T" else ""` and then immediately `Removed Columns3` deletes it, later renaming the raw `Tracer 1` to `Tracer Shot`. So `tracer_shot` for Acciona holds `FJ-49`, `FJ-23`, … — **not** `T`. 10 rows |
| 42 | `RT Report No:` | `Removed Columns4` | — | dropped | |
| 43 | `Tracer 1 RT Acc/Rej` | `Removed Columns4` | — | dropped | |
| 44 | `Iso Penalty7` | `Removed Columns4` | — | dropped | |
| 45 | `Sht8` | `Removed Columns4` | — | dropped | 100 % blank |
| 46 | `Tracer 2` | `Removed Columns4` | — | dropped | |
| 47 | `RT Report No:10` | `Removed Columns4` | — | dropped | |
| 48 | `Tracer 2 RT Acc/Rej` | `Removed Columns4` | — | dropped | |
| 49 | `Column12` | the blank added `Custom14` is removed, then `Column12` → `Custom14` | **no `weld` column** | — | **`FOURTH DIMENSION`×8,593 / `DEBAJ`×4,720.** This is the Acciona **sub-tier contractor** and it is the only place it exists. See ruling R3-04 |
| 50 | `PR` | `PR to Testpack No` (the second-to-last step) | `testpack_no` | verbatim | **100 % blank in this file** |
| 51 | `FABRICATION` | `Removed Columns4` | — | dropped | 100 % blank |
| 52 | `Paint Release` | `Removed Columns4` | — | dropped | 100 % blank |
| 53 | `Test Pack No: ` | renamed `Testpack No`, then `Removed Columns10` **deletes it** so `PR` can take the name | — | dropped | 100 % blank |

**Accounting: 53 = 27 mapped to a `weld` column + 3 that reach the union but have no
`weld` column (`Part 1`, `Part 2`, `Column12`→`Custom14`) + 23 dropped by the M itself.**

### `weld` columns with no ACCIONA source

Everything not listed above. The M fills them with `""` (`AddColumn(… each "")`), i.e.
**blank by source, not blank by data** — the distinction `project-wd-wr-inco-acciona.md`
§1.5 insists on. The blocks:

* the whole **PWHT** block (9 cols) and the whole **HT** block (11)
* the whole **UT**, **MT**, **PMI %**, **PT %**, **FN**, **PADLT**, **ORIF** blocks (~70)
* `AG/UG/PKG`, `Area Classification`, `wbu`, `System no`, `Service Cat`, `MIR No`,
  `MIR Date`, `Cutting Date`, `Beveling Date`, `Preheat Date`
* `Rework Code`, `Repair Suffix`, `Weld Point Code`, `NDT Remarks`, `RT/UT`,
  `RT Batch No`, `RT Batch Status`, `RT Selected Date`, `RT Exam Req date`, `RT Xray No`
* `RT Re-Shoot Status`, `RT Re-Shoot Reason`, `RT Re-Shoot Films`,
  **`Weld Length`, `Rej Length`** (typed `number` on an empty string → **null**),
  `RT Client Exam Req Y/N`, `By UT`
* `Defect Code`, `Location of Defect`, the material-traceability block,
  `Revision Status/Comments`, `Hold Status/Comments`, `Piping Group`,
  `Golden Weld Report Date/No`, `Subsystem Code`, `PED`, `Custom3`…`Custom14`
* every column that only `Weld Dump` or the CCC welder record has
  (`Manual UT *`, `TPI Cross Checked`, `Result (A/R)`, the shipment tail, …)

Consequence, stated plainly: **ACCIONA contributes to the RT/PMI/PT metrics and to the
welded-joint counts, and to nothing else.** No PWHT, no UT, no MT, no film-aging, no
spool status, no weld length.

---

## 2. Constants and derived columns the M adds

| target | value | note |
|---|---|---|
| `sub_contractor` | **`"Acciona"`** — literal, mixed case | The dump uses `ACCIONA` (12 rows, all `Cancelled`); `SCTR NFE WELDERS APPLIED.xls` uses `ACCIONA (DEBAJ+FD)`; the trend workbooks use `Acciona`. **Normalise to `ACCIONA` per R2-08** and keep `Acciona` as `label_raw` if we keep one |
| `original_joint` | **`"Acciona"`** | The dump/CCC put a joint id or `#` here. Acciona puts the sub-contractor name. Do not let any `original_joint`-based logic run on Acciona rows |
| `weldpoint_no` | `"1"` for every row | so `weldpoint_seq = 1` everywhere; the `WP1` dia-inch measures see every Acciona row |
| `weld_point_code` | `""` | |
| `spool_id` | `[ISO Number] & "-" & [Spool No.]` | after the `null → -_-` replace |
| `joint_id` | **`[ISO Number] & "-" & [Spool No.] & "-" & [Weld No.]`** | see §9 |
| `dia_inch_factor` | `if [Weld Type]="BW" then "Y" else "N"` | note: **only `BW`**. CCC's rule is `BW or CLET`; the dump's is sourced. Three rules for one column |
| `pds_area` | `Text.Start([ISO Number], 7)` | e.g. `31941A7` |
| `service_class` | `Text.BetweenDelimiters([Line No.],"(",")")` | then `Line No.` is dropped |
| `rt_weld_status` | a 4-branch `if` — see §7 | |
| `rework_code` | `""` | so `Rework Code "PR All"` falls back to the joint record, which has no Acciona rows → blank |
| everything else above | `""` | |

---

## 3. Dates

| column | source format | M treatment | loader rule |
|---|---|---|---|
| `Fitup Date`, `Weld Date` | real Excel **datetime** cells | `type date` | read as date, no parsing |
| `PMI Date` | text after splitting `PMI Report No. & Date` on `&`; `dd-mm-yyyy`, often preceded by a newline | M rewrites `-01-`…`-12-` → `-Jan-`…`-Dec-`, then `type date` | parse `dd-mm-yyyy` directly after `trim()` |
| `PT Date` | same, but may use `/` separators | `/`→`-`, `Text.Trim`, then the same 12 month rewrites | `trim()`, `/`→`-`, parse `dd-mm-yyyy` |
| `RT Date` | the **hardest one** — see below | 8 steps | parse `dd-mm-yyyy` from the first 11 characters of the `&`-part |

`RT Date`'s M pipeline, verbatim in order:
`null → ""` → `Table.RemoveRowsWithErrors({"RT Date"})` → remove spaces →
`SplitTextByPositions({0,23})` keep part 1 → `SplitTextByPositions({0,11})` keep part 1 →
`RemoveRowsWithErrors` again → remove spaces → `-`→`/` → twelve `/MM/` → `-Mon-`
rewrites → `type date`.

Two things follow. (a) The **positional** splits at 23 and 11 characters are the
real parser: anything after character 11 of the date fragment is discarded, so a
`dd-mm-yyyy` prefix is all that survives. (b) `RemoveRowsWithErrors` **can silently
drop rows** — measured: it drops **0** here (13,313 in, 13,313 out), so no data is
lost today, but a malformed date in a future refresh would vanish rather than error.
Our loader must **log** such rows, not drop them silently.

`RT Re-Shoot Data` is typed `date` from the third `&`-fragment; `RT Re-Shoot Rep` is
text.

---

## 4. `RT Acc/Rej` vocabulary vs the dump's

| token | Acciona (measured) | in the dump? | meaning |
|---|---:|---|---|
| `A` | 1,559 | yes | accepted |
| `RS` | 52 | yes | re-shoot |
| `R` | 13 | yes | rejected |
| _(blank)_ | 11,689 | yes | no RT yet |

**Acciona's vocabulary is a strict subset of the dump's.** No new token, no
`U/Review` (the M has a replacement for it, but the file has none today), no
`ACCEPT`/`ACCEPTED` survivors. Nothing in `lib/metrics` needs a new branch for
Acciona's acc/rej. Contrast CCC, which introduced `HS CCC` (R2-13).

`PMI Acc/Rej`: `A`×1,359 + `ACCEPTED`×26 → the M's `Accepted`→`A` replacement is
**case-sensitive `Replacer.ReplaceText`** and `ACCEPTED` is upper-case, so the 26 rows
**stay `ACCEPTED`** in the model. Our loader should reproduce that literally (and flag it).
`PT Acc/Rej` is `A` for all 1,321 rows.

---

## 5. `RT%` vocabulary

Measured: `100`×945, `5`×679, blank×11,689 — **two values only**.

* The dump's page split is 100 / 30 / 20 / 10 / 5; CCC added a `0` bucket and has no
  `30`. **Acciona lands only in the 100 % and 5 % pages** and contributes nothing to
  30/20/10.
* The M's `0.05 → 5` and `1 → 100` replacements are **no-ops on this file** (the values
  are already integers). Reproduce them anyway — a future refresh may re-introduce the
  fractional form, exactly as the `"#"→"CCC"` no-op in the CCC lane (C-10).
* `rt_pct` is blank on 11,689 of 13,313 rows (87.8 %). Any metric that treats
  `rt_pct IS NULL` as "0 % RT required" will mis-bucket Acciona.

---

## 6. `Acciona Joint Summary` — the second query on the same workbook

```m
#"Joint Summary_Sheet" = Source{[Item="Joint Summary",Kind="Sheet"]}[Data],
```

A **sheet**, this time, with a double promote: `PromoteHeaders` → `Skip(1)` →
`PromoteHeaders` → renames `Column5/6/7` → `PMI Completed` / `PT Completed` /
`RT Completed` and `NDT STATUS` → `Ferrite Test Completed` → `RemoveColumns
{Column11..14}` → `Skip(1)` → null→0 fills → `RemoveLastN(1)` → filter
`[No. of Joints Welded ] <> null` → filter `[Material] <> "Grand Total ==>"`.

Measured: the sheet's declared dimension is `B2:O16179`, and **150** non-blank rows
survive a naive read — because a *second, unrelated block* has been pasted below the
summary (29 rows of `UHP-SCT-P81-TAW-D-2037` / `81TAW17BR003-25ND-E0` and a column of
`FJ-nn` joint numbers). **The M's own two filters cut it to exactly 29 = the pbix's
`Acciona Joint Summary` row count.** Our loader must apply both filters, not a row limit.

Columns: `Material`, `Size ("Ø)`, `No. of Joints Welded `, `Ferrite Test Completed`,
`PMI Completed`, `PT Completed`, `RT Completed`, `Threaded Joints`,
`Total No. of Joints`, `Total Welding ("Ø)`. The header carries a **stale date**:
`Metallic Piping Joint Summary as on 22-02-2024`, while `Acciona_Query`'s weld dates run
to 2025-02. It is a hand-typed summary, ~1 year stale, and it does **not** reconcile with
`Acciona_Query` (`Total No. of Joints` is `0` on all 34 non-blank rows). **Ruling R3-05:
do not load it as a fact source.** At most a `ref_acciona_joint_summary` provenance table.

---

## 7. `RT Weld Status` — Acciona's own synthesis

```m
each if [Weld Date] = null and [#"RT%"] = 100 then "S"
     else if [Weld Date] <> null and [#"RT%"] = 100 and [RT Report]=null then "HS"
     else if [Weld Date] <> null and [RT Report] <> "" then ""
     else "S"
```

Evaluated against the measured data (`Weld Date` is **never** null; `RT%` is 100 on 945
rows, 5 on 679, null on 11,689; `RT Report` is non-blank on 1,624):

| branch | fires when | rows |
|---|---|---:|
| 1 → `"S"` | `Weld Date` null | **0** — dead branch |
| 2 → `"HS"` | `RT% = 100` and no RT report | the 100 %-RT joints still awaiting a shot |
| 3 → `""` | RT report present | ≈1,624 |
| 4 → `"S"` | everything else (incl. all 11,689 blank-`RT%` rows) | the bulk |

So Acciona emits **`S`, `HS`, `""`** — all three already in the dump's vocabulary
(`calculation-logic.md` §0.6). **No new status token**, unlike CCC's `HS CCC`.
Note the third branch tests `<> ""` while the second tests `= null`: on a column that
holds `""` for "no report", branch 2 can never fire either. Reproduce literally,
flag to the owner.

---

## 8. Repairs and re-shoots

* **`Repair Suffix` = `""` for every Acciona row** (an added blank).
* **`Rework Code` = `""`** likewise.
* `repair_reweld` (`db/README.md` §"one column, two rules") is
  `right([Joint ID],2) IN ('R1','R2') → 'Repair'`, `'RW' → 'Reweld'`, else the
  `Repair Suffix` branch, else `''`. Acciona's `Weld No.` values include
  `SJ-05RW1` — so `right(joint_id,2)` = `W1`, **not** `RW` — meaning
  **`repair_reweld` is `''` for every Acciona row.** Acciona repairs are invisible
  to the repair/reweld split. Evidence: `Weld No.` distinct values contain `RW1`
  suffixes but never end in `RW`, `R1` or `R2`.
* Re-shoots exist and are captured: `RT Acc/Rej = 'RS'` on 52 rows, plus
  `RT Re-Shoot Rep` / `RT Re-Shoot Data` from the third `&`-fragment of
  `RT Report No. & Date`. `RT Re-Shoot Status`, `RT Re-Shoot Reason` and
  `RT Re-Shoot Films` are added blank.
* The `Tracer 1`/`Tracer 2` block is a **second and third RT shot on the same joint**
  (`Iso Penalty`, `Sht`, `Tracer n`, `RT Report No:`, `Tracer n RT Acc/Rej`). The M
  **drops all of it except `Tracer 1`**, which it then mis-renames to `Tracer Shot`
  (§1 row 41). 10 + 9 rows of real second/third-shot data are discarded.

---

## 9. Joint id

```m
#"Joint ID" = Table.AddColumn(…, "Joint ID", each [ISO Number]&"-"&[#"Spool No."]&"-"&[#"Weld No."]),
#"Spool ID" = Table.AddColumn(…, "Spool ID", each [ISO Number]&"-"&[#"Spool No."]),
```

Identical in **form** to the dump's and CCC's, so the union's `Joint ID` column is
homogeneous. But the *content* is not: Acciona's `Spool No.` is often a full
`31941A6-IA6594827-01-01` string (1,013 distinct, up to 51 chars) rather than a short
`SP7`, so an Acciona `joint_id` looks like
`31941A7-BR6594818AE-31941A7-BR6594818AE-03-FJ-47` — the ISO number appears twice.
That is what the pbix stores; reproduce it verbatim so `joint_id` joins across sources.
No trimming (Power Query does not trim; `db/README.md:185` says the same for the dump).

---

## 10. What the union does with Acciona specifically

```m
Source = Table.Combine({#"Weld Dump", #"CSVExport_Welder Record", Acciona_Query, #"Inco Weld Log"}),
```

* **Position 3 of 4** in the first `Table.Combine`. `Table.Combine` unions by column
  *name*, so order only decides the row order (and therefore the `Index` column, which
  we do not port — `db/README.md:333`).
* `#"Filtered Rows SubCon" = Table.SelectRows(… [Sub-Contractor] <> "")` — Acciona's is
  the literal `"Acciona"`, so **0 rows dropped**.
* The `RPD*`/`SOB*` weld-type collapses do not touch Acciona's 5 tokens.
* `Manual UT Status` `ACCEPT/ACEPT/REJECT` replacements: Acciona has no manual-UT
  columns at all → no-ops.
* `#"Joint ID for Heat N" = [ISO Number]&"-"&[Weld No.]&""&[Repair Suffix]` — with
  `Repair Suffix = ""` this is just `ISO-WeldNo` for Acciona.
* `#"EXLUDE 4 RT B.log CCC"` — the four hard-coded joint ids are all CCC
  (`11040A1-…`, `11060A4-…`); **no Acciona row is excluded**.
* Row arithmetic (`project-wd-wr-inco-acciona.md` §1.4): 958,634 + 5,433,009 +
  **13,313** + 10,327 = 6,415,283, then +130,994 NOT-WELDED = 6,546,277, −16 = 6,546,261.
  Acciona is **0.20 %** of the union.

---

## 11. R-03 confirmation — is ACCIONA in?

`calculation-logic.md` §5 R-03 recommends **include ACCIONA, exclude INCO by default**,
on the basis that "the page-2 sub-contractor table *does* show an `Acciona` row (with
only a `% Rej by Joint` of 0.39 %)".

Cross-check against the data now in hand: Acciona has **13 `R` rows out of 1,624 rows
with an RT report** — a per-row reject rate of 0.80 %. The mockup's `% Rej by Joint`
of 0.39 % is computed over *distinct joints* rather than rows, so the two are not
directly comparable; what matters is that the order of magnitude matches and that the
row exists at all. The 12 `ACCIONA` rows in
`Weld Dump.txt` are all `Revision Status = Cancelled` and contribute nothing, so
**this workbook is the only source of Acciona welds** — 13,313 vs 12, three orders of
magnitude. R-03's "include ACCIONA" stands, and it is now buildable.

The INCO half of R-03 is argued in `inco-column-map.md` §11.

---

## 12. Loader checklist

1. Read the **named Table** `Acciona_Query` (sheet `ICS Quary`, `A1:BA13314`), not a
   sheet. `exceljs` exposes `worksheet.getTable(name)`; if that proves unreliable,
   read the range literally — it is stable and asserted in the profile.
2. Assert **53 columns** and **13,313 data rows** before inserting; abort otherwise.
3. `source = 'ACCIONA'` (the enum value already exists — `0001_bookkeeping.sql`),
   `sub_contractor = 'ACCIONA'` (normalised, R2-08).
4. Apply the 27-column map, the 12 constants, and the 4 derived columns above.
5. Dates: `weld_to_date()` must accept `dd-mm-yyyy` (R2-11 added `yyyy/mm/dd` and
   `yyyy-mm-dd`; **`dd-mm-yyyy` is a third branch and is ambiguous with `mm-dd-yyyy`** —
   Acciona is unambiguously day-first, so parse it in an Acciona-specific path, not in
   the shared helper. See ruling R3-03).
6. Log, never silently drop, any row whose `RT Date` fragment fails to parse (the M's
   `RemoveRowsWithErrors` drops 0 today).
7. `weld_length_m` stays **NULL** for Acciona: `dia_inch` is present, so the
   `weld_length_by_dia` lookup *will* resolve — see `weld-length.md` §4 for whether
   that is wanted (Acciona's dia values 0.5…24 are all in the 98-row table).
8. `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_joint` after the load.
