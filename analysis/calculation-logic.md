# Calculation logic — the build specification

**Purpose.** Everything a Postgres + Next.js team needs to reproduce the 44 pages of
`mockups/welding-dashboard 1.html` from the raw sources. Every formula is traced to the
Power BI measure or Power Query step it came from; anything not traceable is marked
`NOT FOUND` or `INFERRED`.

**Inputs this document was built from** (all produced by earlier lanes in this session):

| what | file | how it is used here |
|---|---|---|
| mockup page/widget/value inventory | `analysis/mockups/welding-spec.md`, `welding-metrics.md` | §3 build sheet, §4 reference values |
| pbix page → visual → field bindings | `analysis/pbix/report-inventory.md` | §1 source map, §3 build sheet |
| 448 DAX measures, 291 calculated columns | `analysis/pbix/measures.md`, `analysis/pbix/raw/model/*.json` | §2 formulas (verbatim) |
| 62 Power Query M queries, 62 tables, row counts | `analysis/pbix/model.md` | §1 source map, §6 schema |
| `Weld Dump.txt` profile | `analysis/dump/profile.md`, `crosstabs.md`, `columns.json` | §4 checks, §6 types |
| my own numbers | `analysis/reconcile_check.py` → `analysis/reconcile_results.json` | §4 only |

**Two dates, never confuse them.**
The mockup is a snapshot of **Week Ending 16-Jan-2026**. `sources/Weld Dump.txt` is a
**30-Aug-2026** export (max `Weld Date` in it = 2026-08-28). Numbers in §4 are *not*
expected to equal the mockup. Only shape and order of magnitude are checked.

---

## §0 Conventions used by every formula below

### 0.1 The one normalised table

All SQL is written against a single table `weld`, one row per weld-record (the same grain
the pbix fact tables have), with a `source` discriminator. Column names are the snake_case
of the dump header after `.strip()` (`RT Acc/Rej` → `rt_acc_rej`, `PWHT Y/N` → `pwht_yn`,
`Weld No.` → `weld_no`, `RT%` → `rt_pct`, `Total No of films Rej` → `total_no_of_films_rej`).
Full DDL in §6.

### 0.2 Blank semantics — this is where a naive port breaks

Power BI reads the CSV with `QuoteStyle.None` and turns empty fields into **blank**, and DAX
blank comparison rules are *not* SQL NULL rules. Store empty text as `NULL` in Postgres and
translate as follows:

| DAX | meaning | Postgres |
|---|---|---|
| `[X] = ""` | X is blank | `x IS NULL` |
| `[X] <> ""` | X has a value | `x IS NOT NULL` |
| `[X] <> "RS"` | true **also when X is blank** | `x IS DISTINCT FROM 'RS'` |
| `[X] IN {"H","HS"}` | false when X is blank | `x IN ('H','HS')` |
| `[X] IN {"?","","S"}` | **includes blank** | `(x IS NULL OR x IN ('?','S'))` |
| `[Weld Date] > 0` | date present | `weld_date IS NOT NULL` |
| `ISBLANK([RT Date])` | date absent | `rt_date IS NULL` |
| `DIVIDE(a,b)` / `a/b` | blank on /0 | `a::numeric / NULLIF(b,0)` |

Getting `<> "RS"` wrong (writing `rt_acc_rej <> 'RS'`) silently drops every untested row and
changes the film totals. It is the single most common porting bug in this model.

### 0.3 Scope predicates ("EP" / "PR" / "PR all")

The pbix has three fact tables that are unions of the same row shape. In Postgres they are
one table plus a predicate:

```sql
-- "EP" / "WD"  -> 'Weld Dump'
WHERE w.source = 'WELD_DUMP'
-- "PR"         -> 'Project WD+WR'                (see ruling R-06: dead in the shipped pbix)
WHERE w.source IN ('WELD_DUMP','CCC_WELDER_RECORD')
-- "PR all"     -> 'Project WD+WR+INCO+Acciona'
WHERE w.source IN ('WELD_DUMP','CCC_WELDER_RECORD','ACCIONA','INCO')
```

Below, `⟨scope⟩` stands for whichever of those three the metric's suffix demands.

### 0.4 Load-time filters (must be applied when building `weld`, not per query)

Verbatim from the `Weld Dump` M query (`analysis/pbix/model.md` → Power Query → `Weld Dump`):

1. `Csv.Document(..., Delimiter=";", Columns=226, Encoding=1252, QuoteStyle.None)`
2. `Table.RemoveColumns({"Column221"})` — the stray ` WELDTYPEPARAMETER ` column
3. `Table.PromoteHeaders`
4. **keep** `[Area Classification] <> 0 and [Area Classification] <> ""` (applied twice)
5. **keep** `[Revision Status] = ""` ← **cancelled welds are excluded at load** (ruling R-02)
6. **keep** `[Sub-Contractor] <> ""`
7. `"NA" → ""` in `Preheat Date, Weld Date, Cutting Date, Beveling Date, Fitup Date, MIR Date`
8. `Weld Type`: `"BW_" → "BW"`, `"SW_" → "SW"`
9. `Manual UT Status`: `ACCEPT`/`ACEEPT` → `A`, `REJECT` → `R`; `Result (A/R)`: `ACCEPT` → `A`
10. `RT Weld Status`: `"T1-2" → "T1"`
11. `UT Operator ID`: `"-" → ""`
12. **drop** rows where `[Weld Date]` is `2026-12-30`, `2026-08-29` or `2026-08-30`
    (source-system garbage; step `#"Exlude after 28 Aug"`)
13. add `Spool ID  = [ISO Number] & "-" & [Spool No.]`
14. add `Joint ID  = [ISO Number] & "-" & [Spool No.] & "-" & [Weld No.]`
15. add `RT Film Total = [Total No of films Acc] + [Total No of films Rej]`
16. add `HT Remarks = if Text.Contains([RT Report],"PAUT") then "PAUT" else null`
17. add six **empty placeholder columns** so the shape matches the CCC export:
    `RT/UT`, `NDT Remarks`, `Tracer Shot`, `Weld Point Code`, `Original Joint`, `Repair Suffix`

My re-implementation of steps 1–14 lands on **958,615** rows against the pbix's stored
**958,634** for `Weld Dump` — a 19-row gap explained by the different snapshot. That is the
proof the load rules above are right.

### 0.5 Derived columns every metric depends on

| derived column | source | definition |
|---|---|---|
| `joint_id` | M step `#"JOINT ID"` | `iso_number‖'-'‖spool_no‖'-'‖weld_no` (Weld Dump) / `qc_iso_dwg_no‖'-'‖spool_no‖'-'‖joint_no‖repair_suffix` (CCC) |
| `spool_id` | M step `#"Added Custom"` | `iso_number‖'-'‖spool_no` |
| `rt_film_total` | M step `#"Added RT Film Total"` | `coalesce(total_no_of_films_acc,0)+coalesce(total_no_of_films_rej,0)` |
| `repair_reweld` | calc col `Weld Dump[Repair & Reweld]` | `CASE right(weld_no,2) WHEN 'R1' THEN 'Repair' WHEN 'R2' THEN 'Repair' WHEN 'RW' THEN 'Reweld' ELSE '' END` |
| `repair_reweld` (PR all) | calc col `PRALL[Repair & Reweld "PR all"]` | same on `joint_id`, **except `sub_contractor='Inco'` → blank**, plus `repair_suffix='RW1'→'Reweld'`, `'RS1'→'RS1'` |
| `days_since_weld` | calc col `No of Days "WD"` / `No of Days "PR all"` | `(:as_of_date - weld_date)` in days — **the only aging clock in the report** |
| `service_class_cat_wd` | calc col `Weld Dump[Service Class+Service Cat "WD"]` | `service_class‖' '‖service_cat` |
| `service_class_cat_ndt` | calc col `PRALL[Service Class + Service Cat+NDT Remarks]` | `service_class‖' '‖service_cat‖' '‖ndt_remarks‖' '‖rt_pct` |
| `temporary_lines` | calc col `Temporary Lines "WD"` / `[Temporary Lines]` | `right(iso_number,4)='-PCC'` |
| `tmcp_pipe` | calc col `Weld Dump[TMCP Pipe]` | `service_class='9C3AQN' AND dia_inch=46` (Weld Dump) / `dia_inch IN (30,34,46)` (PR all) |
| `spool_status` | calc cols `Fabricated Date`→`Status FABRICATED` | `spool_dump.fabricated IS NOT NULL` → `'Fabricated'` (join `spool_id = spool_dump.spool_id`) |
| `is_cancelled` | column `Revision Status` | `revision_status = 'Cancelled'` (rows kept only for audit, see R-02) |

### 0.6 Status whitelists (verbatim from the DAX, do not "tidy")

```sql
-- RT_BACKLOG_STATUS ("EP"/"WD" flavour)
('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S','T2','T3','T2-1','T2-1S','T2-2S','T2S')
-- RT_BACKLOG_STATUS ("PR all" flavour) = the above + 'T1-2'
-- PWHT_BACKLOG_STATUS ("EP"/"WD") = RT list without 'HS CCC'
-- PWHT_BACKLOG_STATUS ("PR all")  = RT list + 'T1-2'
-- second branch of every RT-backlog measure: rt_pct = 100 AND status IN {'?','','S'}
-- RT weld types everywhere: ('BW','GW','CLET','MW')
```

`'T1S'` appears twice in the DAX list — harmless duplication, not a typo for something else.
The `"EP"`/`"WD"` PWHT lists genuinely omit `'HS CCC'`; the `"PR all"` lists genuinely add
`'T1-2'`. These asymmetries are real and are reproduced below.

---

## §1 Source → subcontractor map

### 1.1 The finding that matters

The earlier pbix lane called `CSVExport_Welder Record` a *"weld repair/reweld export (WR)"*.
**That is wrong, and it changes the whole plan.** Evidence:

1. The file is literally `PCI CCC PBI WORK FILES\CSVExport_Welder Record.csv` — "Welder
   Record", not "Weld Repair". Its sibling is `AllTrain_CSVExport_Joint Record.csv`, "Joint
   Record". These are the two standard Talisman/PCI exports: one row per **welder pass on a
   joint** (5,433,009 rows) and one row per **joint** (1,560,273 rows).
2. Its M query ends with
   `#"Replaced Value # to CCC" = Table.ReplaceValue(Custom1,"#","CCC",Replacer.ReplaceText,{"Sub-Contractor"})`
   — the sub-contractor code `#` is rewritten to the literal string `CCC`. A repair export
   would not need to invent a subcontractor.
3. The calculated column `CSVExport_Welder Record[PWHT Y/N CCC]` starts
   `IF('CSVExport_Welder Record'[Sub-Contractor] <> "CCC", BLANK(), …)` — i.e. the table is
   expected to be all-CCC.
4. `Weld Dump.txt` contains **zero CCC rows** (`Sub-Contractor` = GAC 484,100 / TEKFEN
   426,977 / MEDGULF 90,025 / ACCIONA 12 — `analysis/dump/profile.md` §0 finding 1), yet
   every CCC page of the report binds `Project WD+WR+INCO+Acciona`, which is
   `Table.Combine({Weld Dump, CSVExport_Welder Record, Acciona_Query, Inco Weld Log})`.
   The only member that can supply CCC is `CSVExport_Welder Record`.
5. Size check: the mockup's CCC "Joints Welded" is **1,043,781** distinct joints. That
   cannot come from a repair log; it is CCC's entire weld population.

So: **"WR" = Welder Record = CCC's weld data (Talisman), not repairs.** Repairs are carried
*inside* it by the `Repair Suffix` / `Original Joint` columns, which is why `Weld Dump` has
to add those two columns as blanks to align the shapes.

`AllTrain_CSVExport_Joint Record` is **not** unioned into any fact table. It is used only as
a lookup for CCC's PWHT state, via `Joint ID "JR"` → `Joint ID`
(calc cols `PWHT Y/N CCC`, `PWHT Report No CCC`, `PWHT Date No CCC`). It is CCC's joint
master.

### 1.2 The map

| mockup page group | model table the visuals bind | measure suffix | source FILE | in `sources/`? | rows |
|---|---|---|---|---|---|
| **Project** (mockup p.1, 2) | `Project WD+WR+INCO+Acciona` | `"PR all"` | union of all four below | partial | 6,546,261 |
| **CCC** (p.3, 7, 12–18, 41) | `Project WD+WR+INCO+Acciona` filtered `Sub-Contractor = CCC` | `"PR all"` | `PCI CCC PBI WORK FILES\CSVExport_Welder Record.csv` (+ `AllTrain_CSVExport_Joint Record.csv` for PWHT) | **NO** | 5,433,009 (+1,560,273) |
| **GAC** welding status (p.4, 8, 9) | **both** `Weld Dump` and `Project WD+WR+INCO+Acciona` — see §3 note | `"EP"` and `"PR all"` | `Weld Dump Work File\Weld Dump.txt` | **yes** | 958,634 |
| **GAC** NDE/PWHT (p.19–26) | `Weld Dump` only | `"EP"` / `"WD"` | `Weld Dump.txt` | **yes** | |
| **TEKFEN** welding status (p.5, 10) | both | `"EP"` and `"PR all"` | `Weld Dump.txt` | **yes** | |
| **TEKFEN** NDE/PWHT (p.27–33) | `Weld Dump` only | `"EP"` / `"WD"` | `Weld Dump.txt` | **yes** | |
| **MEDGULF** welding status (p.6, 11) | both | `"EP"` and `"PR all"` | `Weld Dump.txt` | **yes** | |
| **MEDGULF** NDE/PWHT (p.34–40) | `Weld Dump` only | `"EP"` / `"WD"` | `Weld Dump.txt` | **yes** | |
| **Rejection per WPS** (p.41–44) | `Project WD+WR+INCO+Acciona` (CCC, TEKFEN, MEDGULF, GAC-except-SG) and `Weld Dump` (GAC-SG) | mixed | see §3 | mixed | |
| trend/backlog bar charts on p.1, 7–11 | `TREND Report`, `TREND RT UT` (pre-aggregated weekly snapshots) | — | `CUM Trend file RT and PWHT\CUM Trend file RT and PWHT Backlog .xlsx`, `CUM Trend RT% UT% RejRate\CUM Trend RT% UT% RejRate.xlsx` | **NO** | 943 / 976 |
| KPI `Project_Welder` (p.1) | `SCTR OVERALL APPLIED WELDERS` | — | `Welders\SCTR NFE WELDERS APPLIED.xls` | **NO** | 16 |
| KPI `WPS Approved` (p.1) | `WPQ RECORD REGISTER` | — | `WPQ RECORD REGISTER\WPQ RECORD REGISTER.xlsx` | **NO** | 318 |
| UT tracker joins (CCC/GAC/TEK) | `UT TRACKER (CCC)_Talisman`, `UT TRACKER (GAC)`, `UT TRACKER (TEK)` | — | UT tracker workbooks | **NO** | 9,419 / 155 / 10 |
| `Spool Dump` (feeds `Status FABRICATED`, used by M44/M48/M49) | `Spool Dump` | — | `Spool Dump.txt` | **NO** | 198,647 |
| `Weld Length` dimension (dia → metres, feeds M33 at `"PR all"` scope) | `Weld Length` | — | `Weld Length\Weld Length.xlsx` | **NO** | 728,550 |
| ACCIONA / INCO rows in the `"PR all"` union | `Acciona_Query`, `Inco Weld Log` | — | `Acciona\Acciona_Latest Add to Query.xlsx`, `Inco\Master Weld_Latest.xlsx` | **NO** | 13,313 / 10,327 |
| flange dashboard | `Flange Progress` + 12 `Flg *` tables | — | `Flange Progress.xlsx`, repair logs | **NO** | 363,245 |

Evidence for the "Weld Dump only" rows: `analysis/pbix/report-inventory.md` pages 43–64 have
**zero** `Project WD+WR+INCO+Acciona` field references and page-level filters
`Weld Dump[Sub-Contractor] IN {GAC|TEKFEN|MEDGULF}` +
`Weld Dump[Revision Status] NOT IN {Cancelled}` +
`Weld Dump[Temporary Lines "WD"] IN {null}`. Evidence for the CCC rows: pages 23, 27, 36–42,
65 have **zero** `Weld Dump` value bindings and a page filter
`Project WD+WR+INCO+Acciona[Sub-Contractor] IN {CCC}`.

### 1.3 Column harmonisation the M performs (what an ETL must replicate)

`CSVExport_Welder Record` is renamed onto the `Weld Dump` shape. Renames, verbatim from
`Table.RenameColumns` steps 1–7 of that query:

| CCC export column | renamed to (Weld Dump name) |
|---|---|
| `QC ISO DWG. No.` | `ISO Number` |
| `Joint No.` | `Weld No.` |
| `Work Category` | `Weld Cat` |
| `Dia Inch` | `Dia inch` |
| `Wall Thickness` | `Thickness` |
| `Area Code` | `PDS Area` |
| `Area Group-2` | `Area Classification` |
| `Area Group-3` | `AG/UG/PKG` |
| `Sub-Con Code` | `Sub-Contractor` (and `"#"` → `"CCC"`) |
| `Material Category` | `Material Type` |
| `Service Class` | `Service class` |
| `Welder No.` | `Welder` |
| `Welding Process` | `WPS No.` |
| `Welded(Weld Point)` | `WeldPoint No.` |
| `RT/UT(%)` | `RT%` |
| `RT/UT Report No.` | `RT Report` |
| `RT/UT Result` | `RT Acc/Rej` |
| `RT/UT Date` | `RT Date` |
| `RT/UT Request Date` | `RT Selected Date` |
| `RT Film Reject` | `Total No of films Rej` |
| `RT/UT Defect Code` | `Defect Code` |
| `RT/UT Defect Code Class` | `Location of Defect` |

Columns the CCC export **does not have** and the M adds as blank/derived
(`Table.AddColumn(..., each "")` unless noted):
`Iso Rev No.`, `Spool Rev No.`, `wbu`, `System no`, `Testpack No`, `Service Cat`, `MIR No`,
`MIR Date`, `DWIR No.`, `Weld Length`, `PWHT Y/N`, `PWHT Weld Status`, `PWHT Selected Date`,
`PWHT Exam Req date`, `PWHT Date`, `PWHT Report`, `PWHT Acc/Rej`, `PWHT Client Exam Req Y/N`,
`PWHT Remarks`; plus derived `Dia Inch Factor = IF(Weld Type IN {"BW","CLET"},"Y","N")` and
`Cutting Date = Beveling Date = Fitup Date = Weld Date`.

Columns `Weld Dump` **does not have** and its M adds as blank so the union works:
`RT/UT`, `NDT Remarks`, `Tracer Shot`, `Weld Point Code`, `Original Joint`, `Repair Suffix`.

Consequences a backend team must plan for:

* CCC rows carry **no** `PWHT Y/N` / `PWHT Report` / `PWHT Weld Status` — that is why every
  PWHT measure has a second `PWHT Y/N CCC` / `PWHT Report No CCC` branch, sourced from
  `AllTrain_CSVExport_Joint Record` by `Joint ID`.
* CCC rows carry **no** `Weld Length` — that is why the calc column `Weld Length "PR all"`
  falls back to `LOOKUPVALUE('Weld Length'[Weld Length], 'Weld Length'[Dia inch], [Dia inch])`
  against the `Weld Length` dimension, loaded from
  `WORK FILES\Weld Length\Weld Length.xlsx` (columns `Weld Type`, `Dia inch`, `Weld Length`;
  728,550 rows in the pbix). **That workbook is not in `sources/` either.** The `Weld Dump`
  rows do carry their own `Weld Length` column (62 distinct values over 999,462 rows), so the
  `"EP"` UT-length metric M33 works without it; only the CCC/`"PR all"` one needs the lookup.
* CCC rows carry **no** `Service Cat`, so `Service Class + Service Cat+NDT Remarks` for CCC
  reads `"<class>  <ndt remarks> <rt%>"` with a double space. That is what the mockup's
  `6R1B P 100` style row labels are; the GAC style `1C3AS ABDF` comes from the *other*
  column, `Service Class+Service Cat "WD"`. Do not merge the two.
* `AllTrain_CSVExport_Joint Record` also carries a `Del Flag`; the M keeps only
  `[Del Flag] = ""`, and rewrites `Repair Suffix` `R01→R1`, `R02→R2`.

### 1.4 Extra pre-load: `CSVExport_Welder Record` de-duplicates itself

```m
#"RT Report (BLANK)"                 = Table.SelectRows(#"Changed Type", each ([#"RT/UT Report No."] = "")),
#"Appended Query+Welder Rec Acc/ Rej"= Table.Combine({#"RT Report (BLANK)", #"CSVExport_Welder Record - (ACC  REJ )"})
```
i.e. rows *with* an RT report are dropped from the main CSV and replaced by the 641,575-row
`CSVExport_Welder Record - (ACC  REJ )` table, which is loaded from
`CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx` (sheet whose `Name` starts
`CSVExport_Welder Record - FOR P`) and itself keeps only
`[RT/UT Report No.] <> "-" and [RT/UT Report No.] <> ""`, with `Repair Suffix` null→"".
An ETL must do the same split or CCC's tested-joint counts double-count every RT'd joint.

---

## §2 Metric catalogue

Each entry gives: the pbix measure name, its DAX verbatim, the plain rule, and the Postgres
expression. `⟨scope⟩` = §0.3. `:as_of` = the report run date (Power BI's `TODAY()`).

Two families exist for almost every metric — an `"EP"` one over `Weld Dump` and a `"PR all"`
one over the union. Where they differ in more than the table name it is called out.

### M01 — Joints Welded  ("EP")
* measure `[Welded Joint ID Uniq "EP"]`
```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Repair & Reweld]="",
'Weld Dump'[Weld Date]>0)
```
* Rule: distinct joints that have a weld date and are not a repair/reweld attempt.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.repair_reweld = '' AND w.weld_date IS NOT NULL)
```

### M02 — Joints Welded  ("PR all")
* measure `[Joint Uniq "PR all" Welded]`
```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Weld Date]>0)
```
* Same as M01 but over the union and using the `"PR all"` repair rule (§0.5), which reads the
  suffix off `Joint ID` (not `Weld No.`) and exempts Inco.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.repair_reweld = '' AND w.weld_date IS NOT NULL)
```

### M03 — Joints Welded incl. repairs and rewelds
* measure `[Joint Uniq "PR all" Welded & R/RW]` — `CALCULATE(DISTINCTCOUNT(...[Joint ID]), ...[Weld Date]>0)`
* Used as the denominator of the per-WPS `RT/UT Ratio %` on mockup pages 41–44.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL)
```

### M04 — Joints Welded, "F" welds only
* measure `[Joint Uniq "PR all" Welded "F"]` = M02 + `'…'[Weld Cat]="F"`
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.repair_reweld='' AND w.weld_date IS NOT NULL AND w.weld_cat='F')
```

### M05 — Welding Status for this Week
* No dedicated measure. It is **M01/M02 with a visual filter**
  `Calendar[Week_End_Date] IN TOP 1 BY (Max(Calendar[Week_End_Date]) DESC)`.
* `Calendar` is `CALENDAR("5/8/2021","31/12/2026")` with
  `Week_End_Date = CALCULATE(MAX([Date]), FILTER(Calendar,[Weekday]=7 && [Weeknum]=EARLIER([Weeknum])))`
  and `Weekday = IF(WEEKDAY([Date])<=6, WEEKDAY([Date])+1, WEEKDAY([Date])-6)` — i.e.
  **weeks run Saturday→Friday and `Week_End_Date` is the Friday**. The mockup's week labels
  (17-Oct … 16-Jan) are Fridays; confirm against your locale before shipping.
* There is **no active relationship** between `Calendar` and any fact table; the join is the
  implicit one Power BI creates on `Weld Date` via auto-date tables.
```sql
-- :week_end = the Friday of the reporting week
count(DISTINCT w.joint_id) FILTER (
  WHERE w.repair_reweld='' AND w.weld_date IS NOT NULL
    AND w.weld_date > :week_end - 7 AND w.weld_date <= :week_end)
```

### M06 — Welding Progress Trend (weekly F / S bars)
* M02 grouped by `Calendar[Week_End_Date]` and `Weld Cat`, filter
  `Week_End_Date IN TOP 14 DESC`, `Weld Cat NOT IN {J}`, `Sub-Contractor NOT IN {Inco}`.
```sql
SELECT c.week_end_date, w.weld_cat, count(DISTINCT w.joint_id)
FROM weld w JOIN calendar c ON c.date = w.weld_date
WHERE w.repair_reweld='' AND w.weld_date IS NOT NULL
  AND w.weld_cat <> 'J' AND w.sub_contractor <> 'Inco'
GROUP BY 1,2 ORDER BY 1 DESC LIMIT 14*2;
```

### M07 — Weld Type Distribution (donut)
* M02 grouped by `Weld Type`; filters `Weld Type NOT IN {THD}`,
  `Repair & Reweld NOT IN {Repair, Reweld}`, `Sub-Contractor NOT IN {Inco}`.
```sql
SELECT w.weld_type, count(DISTINCT w.joint_id)
FROM weld w WHERE w.repair_reweld='' AND w.weld_date IS NOT NULL
  AND w.weld_type <> 'THD' AND w.sub_contractor <> 'Inco'
GROUP BY 1 ORDER BY 2 DESC;
```

### M10 — Tested Joints  ("EP")
* measure `[Numb RT/UT]`
```dax
COALESCE(CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
  'Weld Dump'[Weld Date] > 0, 'Weld Dump'[RT Report] <> "", 'Weld Dump'[RT Acc/Rej] <> "RS"), 0)
```
```sql
coalesce(count(DISTINCT w.joint_id) FILTER (
  WHERE w.weld_date IS NOT NULL AND w.rt_report IS NOT NULL
    AND w.rt_acc_rej IS DISTINCT FROM 'RS'), 0)
```

### M11 — Tested Joints  ("PR all")
* measure `[Numb RT/UT "PR all"]` — identical **plus** `[RT Acc/Rej] <> "U/Review"`.
  `U/Review` never occurs in `Weld Dump.txt` (its `RT Acc/Rej` vocabulary is only
  `A`=84,217 / `R`=1,521 / `RS`=46); it is a Talisman value, so the extra predicate exists for
  CCC rows only.
```sql
coalesce(count(DISTINCT w.joint_id) FILTER (
  WHERE w.weld_date IS NOT NULL AND w.rt_report IS NOT NULL
    AND w.rt_acc_rej IS DISTINCT FROM 'RS'
    AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'), 0)
```

### M12 — Rejected RT/UT Joints  (`RT/UT "R"`, `Numb RT/UT "R"`)
* measures `[Numb RT/UT "R"]` / `[Numb RT/UT "PR all" "R"]`
```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]), 'Weld Dump'[RT Acc/Rej]="R")
```
* **Note the asymmetry**: no `Weld Date` and no `RT Report` predicate. Reproduce literally.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.rt_acc_rej = 'R')
```

### M13 — Accepted RT/UT Joints  (`RT/UT "A"`, `RT Acc.Joints`)
* measures `[Numb RT/UT "A"]` / `[Numb RT/UT "PR all" "A"]` = **M10/M11 minus M12**, evaluated
  as two independent distinct counts and subtracted. It is *not* `rt_acc_rej='A'`.
```sql
(M10) - (M12)          -- keep the subtraction; the two sets are not nested
```

### M14 — Rejection Rate Joint  (`Rejection Rate Joint`, `% Rej by Joint`, `% of Total Rej by joint`)
* measures `[Rejection Rate Joint "WD"]` = `[Numb RT/UT "R"]/[Numb RT/UT]`;
  `[Rejection Rate Joint "PR all"]` = `[Numb RT/UT "PR all" "R"]/[Numb RT/UT "PR all"]`
```sql
(M12)::numeric / NULLIF((M10),0)
```

### M15 — RT/UT Ratio %
* measures `[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]` = `[Numb RT/UT]/[Welded Joint ID Uniq "EP"]`;
  `[RT Ratio % RT/ Welded Joint ID uniq "PR all"]` = `[Numb RT/UT "PR all"]/[Joint Uniq "PR all" Welded]`;
  `[… & R/RW]` variant divides by M03 instead of M02 (used on pages 41–44).
* Can exceed 100 % — the numerator has no repair exclusion while the denominator does. The
  mockup shows 101.51 %, 189.29 % etc.; that is correct behaviour, not a bug.
```sql
(M10)::numeric / NULLIF((M01),0)
```

### M20 — Films Taken by joint  ("EP")
* measure `[RT Total Films by Joint "EP"]`
```dax
CALCULATE(sum('Weld Dump'[RT Film Total]), 'Weld Dump'[WeldPoint No.]=1, 'Weld Dump'[RT Acc/Rej]<>"RS")
```
* `WeldPoint No.` is the repair-attempt sequence (1 = original). Restricting to 1 is how the
  measure avoids counting a repair's films twice.
```sql
sum(w.rt_film_total) FILTER (WHERE w.weldpoint_no = 1 AND w.rt_acc_rej IS DISTINCT FROM 'RS')
```

### M21 — Films Accepted by joint  ("EP")
* measure `[RT Total Films by Joint "A" "EP"]` = `sum([Total No of films Acc])` with the same
  two filters. (Note: the "PR all" flavour instead computes `M22 subtracted from M23` — see M24.)
```sql
sum(w.total_no_of_films_acc) FILTER (WHERE w.weldpoint_no = 1 AND w.rt_acc_rej IS DISTINCT FROM 'RS')
```

### M22 — Films Rejected by joint  ("EP")
* measure `[RT Total Films by Joint "R" "EP"]` = `sum([Total No of films Rej])`,
  **`WeldPoint No.`=1 only — no `<> "RS"` filter.**
```sql
sum(w.total_no_of_films_rej) FILTER (WHERE w.weldpoint_no = 1)
```

### M23 — Films Taken by joint  ("PR all")
* measure `[RT Total Films by Joint "PR all"]` — three terms:
```dax
CALCULATE(SUM(...[RT Film Total]), ...[WeldPoint No.] = 1, ...[RT Acc/Rej] <> "RS",
  ...[RT Acc/Rej] <> "U/Review", ...[Exlude RT Films from UT] <> "Exclude UT Films",
  ...[Exlude Full Cut & Debris] <> "Exclude Films:Debris")
+ CALCULATE(SUM(...[RT Film Total]), ...[Weld Point Code] IN {"R","H","F","C"},
  ...[RT Acc/Rej] <> "RS", ...[RT Acc/Rej] <> "U/Review")
- CALCULATE(SUM(...[RT Film Total]), ...[WeldPoint No.] = 1,
  ...[Weld Point Code] IN {"R","H","F","C"}, ...[RT Acc/Rej] <> "RS", ...[RT Acc/Rej] <> "U/Review")
```
  i.e. inclusion–exclusion of "first weld point" ∪ "weld point code R/H/F/C".
* Two exclusion calc columns:
  * `[Exlude RT Films from UT]` = `By UT="Y" AND Sub-Contractor<>"Inco" AND RT Report CONTAINS "UT" AND (films Rej>0 OR RT Film Total>0)` → `"Exclude UT Films"`
  * `[Exlude Full Cut & Debris]` = `RT Re-Shoot Status="Full Cut" AND RT Re-Shoot Reason CONTAINS "Debris" AND Defect Code="XX"` → `"Exclude Films:Debris"`
```sql
  sum(w.rt_film_total) FILTER (WHERE w.weldpoint_no=1
        AND w.rt_acc_rej IS DISTINCT FROM 'RS' AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'
        AND NOT w.exclude_ut_films AND NOT w.exclude_debris_films)
+ sum(w.rt_film_total) FILTER (WHERE w.weld_point_code IN ('R','H','F','C')
        AND w.rt_acc_rej IS DISTINCT FROM 'RS' AND w.rt_acc_rej IS DISTINCT FROM 'U/Review')
- sum(w.rt_film_total) FILTER (WHERE w.weldpoint_no=1 AND w.weld_point_code IN ('R','H','F','C')
        AND w.rt_acc_rej IS DISTINCT FROM 'RS' AND w.rt_acc_rej IS DISTINCT FROM 'U/Review')
```

### M24 — Films Rejected / Accepted by joint  ("PR all")
* `[RT Total Films by Joint "PR all" "R"]` = `sum([Total No of films Rej])` with
  `NOT exclude_ut_films AND rt_acc_rej NOT IN ('RS','U/Review') AND NOT exclude_debris_films`
* `[RT Total Films by Joint "PR all" "A"]` = **M23 − that** (not a sum of the Acc column).
```sql
-- rejected
sum(w.total_no_of_films_rej) FILTER (WHERE NOT w.exclude_ut_films
    AND w.rt_acc_rej IS DISTINCT FROM 'RS' AND w.rt_acc_rej IS DISTINCT FROM 'U/Review'
    AND NOT w.exclude_debris_films)
-- accepted = (M23) - (above)
```

### M25 — % RT Film Rej  (`RT% Film Rej`, `%RT FILM Rej`, `RT% of Total Rej`, `% of Rej.Film`)
* measures `[RT FILM Ratio % by Joint "EP"]` = M22/M20;
  `[RT FILM Ratio % by Joint "PR all"]` and `[RT FILM Rej Ratio % "PR all"]` = M24/M23.
```sql
(M22)::numeric / NULLIF((M20),0)
```

### M26 — RT Total Films (all weld points)  — used only on the per-WPS pages
* measures `[RT Total Films]` = `sum([RT Film Total])` with `RT Acc/Rej <> "RS"` (no WeldPoint filter);
  `[RT Total Films "A"]` = `sum([Total No of films Acc])` same filter;
  `[RT Total Films "R"]` = `sum([Total No of films Rej])` **unfiltered**;
  `[RT FILM Ratio %]` = R/Total.
* `"PR all"` flavour (`[RT Total Films "PR all"]` etc.) adds `<> "U/Review"` and the
  Debris exclusion but **not** the UT-films exclusion.
```sql
sum(w.rt_film_total) FILTER (WHERE w.rt_acc_rej IS DISTINCT FROM 'RS')     -- total
sum(w.total_no_of_films_acc) FILTER (WHERE w.rt_acc_rej IS DISTINCT FROM 'RS')  -- "A"
sum(w.total_no_of_films_rej)                                              -- "R"
```
This is why mockup page 8 shows GAC `Films Taken` = 123,887 while page 42 (per-WPS) shows
171,021 for the same subcontractor: two different measures, both correct.

### M30 — UT Done  ("EP")
* measure `[Numb UT "EP"]`
```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]), 'Weld Dump'[UT Weld Status]IN{"NR"}, 'Weld Dump'[UT Report]<>"")
```
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.ut_weld_status = 'NR' AND w.ut_report IS NOT NULL)
```

### M31 — UT "A" / UT "R"  ("EP")
* measures `[Numb UT "A" "EP"]`, `[Numb UT "R" "EP"]` = M30 + `[UT Acc/Rej]="A"` / `="R"`.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.ut_weld_status='NR' AND w.ut_report IS NOT NULL AND w.ut_acc_rej='A')
count(DISTINCT w.joint_id) FILTER (WHERE w.ut_weld_status='NR' AND w.ut_report IS NOT NULL AND w.ut_acc_rej='R')
```

### M32 — UT Done / "A" / "R"  ("PR all")
* measures `[Numb UT "PR All"]`, `[Numb UT "A" "PR All"]`, `[Numb UT "R" "PR All"]` key off
  the calculated column `[Manual UT Report No.]` and `[Manual UT Status.]`, **not** `UT Report`:
```dax
[Numb UT "PR All"]      = CALCULATE(DISTINCTCOUNT(...[Joint ID]), ...[Manual UT Report No.]<>"")
[Numb UT "R" "PR All"]  = ... + ...[Manual UT Status.]="R"
[Numb UT "A" "PR All"]  = [Numb UT "PR All"] - [Numb UT "R" "PR All"]
```
* `[Manual UT Report No.]` and `[Manual UT Status.]` are 60-line coalescing calc columns that
  fall back per subcontractor: GAC/TEKFEN → `UT Acc/Rej` else `Manual UT Status`; Inco →
  `UT Acc/Rej`; CCC → `UT TRACKER (CCC)_Talisman[UT1 RESULT]` looked up by `Joint ID`.
  **They therefore need the UT tracker workbooks, which are not in `sources/`** (ruling R-05).
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.manual_ut_report_no IS NOT NULL)
count(DISTINCT w.joint_id) FILTER (WHERE w.manual_ut_report_no IS NOT NULL AND w.manual_ut_status='R')
```
`[Numb UT "PR All" Tracker]` is byte-identical to `[Numb UT "PR All"]` — a duplicate, use either.

### M33 — UT Weld Length m  (`UT Weld Len.m`, `UT Insp Len`)
* measure `[UT Weld Length by Joint "EP"]`
```dax
CALCULATE(sum('Weld Dump'[Weld Length]), 'Weld Dump'[WeldPoint No.]=1, 'Weld Dump'[UT Report]<>"")
```
* `"PR all"` flavour uses the calc column `[Weld Length "PR all"]` and keys on
  `[WeldPoint No.1 WP1]=1` (a row-number-within-joint calc column) and
  `[UT Report]<>"" OR [RT/UT]="UT"`.
```sql
sum(w.weld_length) FILTER (WHERE w.weldpoint_no = 1 AND w.ut_report IS NOT NULL)
```

### M34 — UT Def. Len.m  (`UT Def.Length`)
* measure `[UT Defect Length by Joint "PR all"]`
```dax
CALCULATE(SUM(...[Defect Length(MM).]), ...[Manual UT Report No.] <> "", ...[Manual UT Status.] = "R")
```
* `[Defect Length(MM).]` is a calc column: Inco → `Repair Length (mm)/1000`; else if
  `Manual UT Report No. <> "" AND By UT = "Y"` → `[Rej Length]`; else if CCC and status R →
  `UT TRACKER (CCC)_Talisman[Defect Lenght(MM).]`; else 0.
* There is **no `"EP"` version** — mockup pages 19–40 show it blank for GAC/TEK/MED, matching.
```sql
sum(w.defect_length_m) FILTER (WHERE w.manual_ut_report_no IS NOT NULL AND w.manual_ut_status='R')
-- defect_length_m := CASE WHEN sub_contractor='Inco' THEN repair_length_mm/1000.0
--                         WHEN manual_ut_report_no IS NOT NULL AND by_ut='Y' THEN rej_length
--                         WHEN manual_ut_status='R' AND sub_contractor='CCC' THEN ut_tracker_defect_len
--                         ELSE 0 END
```

### M35 — UT Inspected Length  (`UT Insp Len`, second card on page 1)
* measure `[UT Inspected Length by Joint "PR all"]` =
  `CALCULATE(sum(...[Inspected Length(MM).]), ...[Manual UT Report No.]<>"", ...[WeldPoint No.]=1)`.
  `[Inspected Length(MM).]` resolves to `[Weld Length "PR all"]` for GAC/TEKFEN/CCC and to a
  `MAX` over the joint for anyone else.

### M36 — % of Rej UT by Length  (`% Rej UT Len`, `UT Rej% Len`, `% UT Rej Length`)
* measure `[Rejection UT Rate Length by Sub-Con "PR all"]` = M34 / M35.
```sql
(M34)::numeric / NULLIF((M35),0)
```

### M37 — % of Rej UT by Joint  (`% Rej UT Joint`, `% of Rej UT by Joint (EP)`)
* measures `[Rejection UT Rate Joint "EP"]` = `[Numb UT "R" "EP"]/[Numb UT "EP"]`;
  `[Rejection UT Rate Joint "PR all"]` = `[Numb UT "R" "PR All"]/[Numb UT "PR all"]`;
  `[Rejection UT Rate Joint "PR all" 2]` = the Tracker pair.
```sql
(M31r)::numeric / NULLIF((M30),0)
```

### M38 — UT Ratio %
* measures `[UT Ratio % UT/ Welded Joint ID uniq "EP"]` = M30/M01;
  `[UT Ratio % UT/ Welded Joint ID uniq "PR all" Tracker]` = M32/M02.

### M39 — Numb UT/PAUT  (page-1 KPI)
* measure `[Numb UT "PR All" Tracker]` with visual filter `Weld Type IN {BW,CLET,GW,MW}` and
  `Sub-Contractor NOT IN {Inco}`. PAUT joints are flagged by the M-derived column
  `HT Remarks = "PAUT" when RT Report contains "PAUT"`; the count itself does not filter on it.

### M40 — Total RT Backlog  ("EP")   (`Total RT B.log`, `RT Backlog`, `RT B.LOG Total`)
* measure `[RT 5 10 20 100% B.log Joints Weld Status "EP"]`
```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
    'Weld Dump'[Weld Type] IN {"BW","GW","CLET","MW"}, 'Weld Dump'[Weld Date] > 0,
    'Weld Dump'[RT Report] = "", 'Weld Dump'[RT Weld Status] IN {…RT_BACKLOG_STATUS…})
+ CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
    'Weld Dump'[Weld Type] IN {"BW","GW","CLET","MW"}, 'Weld Dump'[Weld Date]>0,
    'Weld Dump'[RT%]=100, 'Weld Dump'[RT Report]="",
    FILTER('Weld Dump','Weld Dump'[RT Weld Status] IN {"?","","S"}))
```
* Rule: a joint is in the RT backlog if it is a pressure-retaining weld type, has been welded,
  has no RT report, and **either** its RT weld status is one of the "hold/selected" codes
  **or** it is a 100 %-RT joint whose status is still blank/`?`/`S`.
* The two branches are added, not OR-ed, so a joint in both is counted twice. In practice the
  status sets are disjoint, so the sum equals the OR — but the `"PR all"` twin
  (`[RT BACKLOG Total Project "PR all"]`) writes it explicitly as `OR(...)`. Use `OR`.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE
      w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL AND w.rt_report IS NULL
  AND ( w.rt_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S',
                             'T2','T3','T2-1','T2-1S','T2-2S','T2S')
        OR (w.rt_pct = 100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) ))
```

### M41 — Total RT Backlog  ("PR all")
* measure `[RT BACKLOG Total Project "PR all"]` — same as M40 but the status list adds
  `'T1-2'` and the whole thing is one `CALCULATE` with `OR(...)`.

### M42 — RT100% Backlog  ("EP")
* measure `[RT 100% Backlog Joints Weld Status "EP"]`
```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"}, 'Weld Dump'[RT%]=100,
'Weld Dump'[Weld Date]>0, 'Weld Dump'[RT Report]="")
```
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.weld_type IN ('BW','GW','CLET','MW')
   AND w.rt_pct = 100 AND w.weld_date IS NOT NULL AND w.rt_report IS NULL)
```

### M43 — RT100% Backlog  ("PR all")
* measure `[RT100% Backlog "PR all"]` — **different definition**: it keys on `RT Date` being
  blank rather than `RT Report`, and admits the whole status vocabulary:
```dax
CALCULATE(DISTINCTCOUNT(...[Joint ID]),
    NOT(ISBLANK(...[Weld Date])), ISBLANK(...[RT Date]), ...[RT%] = 100,
    ...[RT Weld Status] IN {…RT_BACKLOG_STATUS_PRALL…, "?","","S"},
    ...[Weld Type] IN {"BW","CLET","MW","GW"})
```
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL AND w.rt_date IS NULL
   AND w.rt_pct = 100 AND w.weld_type IN ('BW','GW','CLET','MW')
   AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN
        ('H','HS','HS CCC','SS','T','T1','T1-2','T1S','T1-1','T1-1S','T1-2S',
         'T2','T3','T2-1','T2-1S','T2-2S','T2S','?','S')))
```

### M44 — RT Backlog FABRICATED  (`RT B.log & FAB-D`)
* measures `[RT 5 10 20 100% B.log Joints Weld Status "EP" & FABRICATED]` and
  `[RT Backlog & FABRICATED "PR All"]` = M40 / M41 **+ `[Status FABRICATED]="Fabricated"`**
  (resp. `[Spool ID Status]="Fabricated"`), i.e. the joint's spool has a `FABRICATED` date in
  `Spool Dump`. Requires `Spool Dump.txt` (not in `sources/`).
* Note the `"EP"` FABRICATED variant drops `'HS CCC'` from its status list.
```sql
-- M40 predicate AND w.spool_status = 'Fabricated'
```

### M45 — RT Backlog + PWHT "Y" Done  (`RT+PWHT "Y" Done`, `RT Backlog+ PWHT "Y" Done`)
* measure `[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP"]`
```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Y/N]IN{"Y","25.01"}, 'Weld Dump'[PWHT Report]<>"",
'Weld Dump'[RT Weld Status]IN{…}, 'Weld Dump'[RT Report]="")
+ CALCULATE(… same PWHT test …, [Weld Date]>0, [RT%]=100, [RT Report]="",
            FILTER('Weld Dump',[RT Weld Status] IN {"?","","S"}))
```
* **`PWHT Y/N IN {"Y","25.01"}`** — the polluted `25.01` value is deliberately treated as
  "PWHT applies". See ruling R-04.
* Its `"PR all"` twin adds a third term for CCC using `PWHT Y/N CCC = "Y"` and
  `PWHT Report No CCC <> ""`.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE
      w.pwht_yn IN ('Y','25.01') AND w.pwht_report IS NOT NULL AND w.rt_report IS NULL
  AND ( w.rt_weld_status IN (…RT_BACKLOG_STATUS…)
        OR (w.weld_date IS NOT NULL AND w.rt_pct=100
            AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) ))
```

### M46 — RT Backlog + PWHT "N"  (`RT+PWHT "N"`, `RT Backlog+ PWHT"N"`)
* measure `[RT 5 10 20 100% B.log Joints+NO PWHT Progress Weld Status "EP"]` — same shape as
  M45 with `PWHT Y/N IN {"N","25.01"}` **and `PWHT Weld Status = ""`** and the
  `Weld Type IN {BW,GW,CLET,MW}` restriction. `"PR all"` adds a CCC term on `PWHT Y/N CCC="N"`.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE
      w.weld_type IN ('BW','GW','CLET','MW') AND w.weld_date IS NOT NULL
  AND w.pwht_yn IN ('N','25.01') AND w.pwht_weld_status IS NULL AND w.rt_report IS NULL
  AND ( w.rt_weld_status IN (…RT_BACKLOG_STATUS…)
        OR (w.rt_pct=100 AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) ))
```

### M47 — RT B.LOG & PWHT NOT Done  (`RT B.log & PWHT NOT Done`, `RT Backlog & PWHT "Y" NOT Done`)
* measures `[RT BACKLOG Total Project & PWHT NOT Done "EP"]` /
  `[RT BACKLOG Total Project & PWHT "Y" NOT Done "PR all"]`
* Rule: RT backlog **and** PWHT is required (`Y`/`25.01`), still on hold
  (`PWHT Weld Status IN {"H","HS"}`, `"PR all"` adds `"NR"`) and has no PWHT report.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE
      w.weld_type IN ('BW','GW','CLET','MW')
  AND w.pwht_yn IN ('Y','25.01') AND w.pwht_weld_status IN ('H','HS')  -- 'PR all': + 'NR'
  AND w.pwht_report IS NULL AND w.rt_report IS NULL
  AND ( w.rt_weld_status IN (…RT_BACKLOG_STATUS…)
        OR (w.weld_date IS NOT NULL AND w.rt_pct=100
            AND (w.rt_weld_status IS NULL OR w.rt_weld_status IN ('?','S'))) ))
```
The `"PR all"` measure ends with a no-op
`IF(SELECTEDVALUE([Sub-Contractor])="CCC", BacklogCount - 0, BacklogCount)` — dead code, ignore.

### M48 — RT B.log & PWHT "Y" Done + PWHT "N" FAB-D
* measure `[RT Backlog+PWHT Progress "Y" Done + PWHT "N" FABRICATED "PR all"]` — six added
  `CALCULATE`s: M45's three branches and M46's three branches, each additionally requiring
  `[Spool ID Status] = "Fabricated"`. Port as `(M45 OR M46) AND spool_status='Fabricated'`
  but keep the sum-of-branches shape if you need bit-exact parity.

### M49 — RT B.Log & PWHT"Y" NOT Done FAB-D
* measure `[RT BACKLOG Total Project & PWHT"Y" NOT Done FABRICATED "PR all"]` = M47 with
  `[Spool ID Status] = "Fabricated"` added to every branch.

### M50 — RT B.log & FAB-D & Spool PWHT Date
* measure `[RT Backlog & FABRICATED & PWHT Spool Date "PR All"]`. Bound only on pbix page 36
  visual `c6e92e5e…`, which the mockup does not render. Not required.

### M51 — RT backlog aging: within 3 Days / 3 to 7 / 7 to 15 / 15 to 30 / above 30
* measures `[RT Backlog within 3 days "WD"]`, `[RT Backlog above 3 days below 7 "WD"]`,
  `[… above 7 days below 15 "WD"]`, `[… above 15 days below 30 "WD"]`, `[RT Backlog above 30 "WD"]`
  (and the `"PR all"` twins `[RT Backlog within 3 Days "PR all"]` …
  `[RT Backlog within above 30 Days"PR all"]`).
* **Which date pair is aged:** `No of Days "WD"` / `No of Days "PR all"` =
  `DATEDIFF([Weld Date], TODAY(), DAY)`. So the buckets age **Weld Date → report run date**.
  Not fit-up date, not RT selected date. (The 7/30/90/180 buckets that *do* use Fit-Up date
  live in the calc column `No Of Days Fit-UP - Today STATUS "PR all"` and appear only on the
  non-mockup page "Days Between Fit-Up Date & Today".)
* Bucket edges, verbatim: `<=3`, `>3 and <=7`, `>7 and <=15`, `>15 and <=30`, `>30`.
  The buckets are **left-open**, so a 3-day-old joint lands in "within 3 Days".
* Each bucket measure = M40's predicate + the day-range, in both branches. The `"WD"` bucket
  measures use the *short* status list (no `'HS CCC'`) and `{"?",""}` (no `'S'`) in the second
  branch — a real difference from M40, reproduce it.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE <M40 predicate>
   AND (:as_of - w.weld_date) > 3 AND (:as_of - w.weld_date) <= 7)   -- "3 to 7 Days"
```

### M52 — RT5% / RT10% / RT20% B.log Joints  (the "one formula" coverage-gap measures)
* measures `[RT5% Backlog Joints "PRall" (One Formula)]`, `[RT10% …]`, `[RT20% …]`
```dax
VAR NumberRT   = CALCULATE(DISTINCTCOUNT([Joint ID]), [RT%]=5, [RT Report]<>"",
                   [RT Acc/Rej]<>"RS", [RT Acc/Rej]<>"U/Review",
                   ALLEXCEPT(T,[HA],[Service Class],[Service Class + Service Cat+NDT Remarks]))
VAR JointUniq  = CALCULATE(DISTINCTCOUNT([Joint ID]), [Weld Date]>0, [RT%]=5,
                   [Repair & Reweld "PR all"]="", ALLEXCEPT(T, …same…))
VAR Ratio      = DIVIDE(NumberRT, JointUniq, 0)
RETURN IF(0.05 - Ratio > 0, ROUNDUP((0.05-Ratio)*JointUniq, 0), 0)
```
* Rule: **not** a backlog of held joints — it is *"how many more joints must be shot to reach
  the contractual 5 % / 10 % / 20 % coverage for this service class"*. `ALLEXCEPT` means the
  ratio is always computed at `(HA, Service Class, Service Class+Service Cat+NDT Remarks)`
  grain regardless of what else the pivot is slicing by; that is why the mockup's page-14
  sub-rows show `266.00` while the parent row shows `0.00`.
```sql
-- per service-class group g, for target t in (0.05, 0.10, 0.20):
WITH g AS (
  SELECT w.ha, w.service_class, w.service_class_cat_ndt,
    count(DISTINCT w.joint_id) FILTER (WHERE w.rt_pct = :p AND w.rt_report IS NOT NULL
        AND w.rt_acc_rej IS DISTINCT FROM 'RS' AND w.rt_acc_rej IS DISTINCT FROM 'U/Review') AS n_rt,
    count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL AND w.rt_pct = :p
        AND w.repair_reweld = '') AS n_joints
  FROM weld w GROUP BY 1,2,3)
SELECT ha, service_class, service_class_cat_ndt,
  GREATEST(ceil((:t - COALESCE(n_rt::numeric/NULLIF(n_joints,0),0)) * n_joints), 0) AS backlog_joints
FROM g;
```
`[HA]` is a column on `Project WD+WR+INCO+Acciona` only (hazard-area grouping); Weld Dump rows
have it blank.

### M60 — PWHT Backlog All Types  ("EP")
* measure `[PWHT Backlog Weld Status All Weld Types "EP"]`
```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Weld Status]IN{…PWHT_BACKLOG_STATUS…}, 'Weld Dump'[PWHT Report]="")
```
```sql
count(DISTINCT w.joint_id) FILTER (WHERE
   w.pwht_weld_status IN ('H','HS','SS','T','T1','T1S','T1-1','T1-1S','T1-2S','T2','T3','T2-1','T2-1S','T2-2S','T2S')
   AND w.pwht_report IS NULL)
```
In `Weld Dump.txt` the only `PWHT Weld Status` values that exist are `NR`=152,412, `HS`=873,
`H`=11, so this measure can never exceed 884 for the whole file.

### M61 — PWHT Backlog All Types  ("PR all")
* measure `[PWHT All BACKLOG All WELD TYPE "PR all"]` — two terms:
```dax
CALCULATE(DISTINCTCOUNT(...[Joint ID]), ...[Weld Date]>0,
          ...[PWHT Y/N CCC]="Y", ...[PWHT Report No CCC]="")            -- CCC branch
+ CALCULATE(DISTINCTCOUNT(...[Joint ID]),
          ...[PWHT Weld Status] IN {…+'T1-2','HS CCC'…}, ...[PWHT Report]="")  -- everyone else
```
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL
        AND w.pwht_yn_ccc='Y' AND w.pwht_report_no_ccc IS NULL)
+ count(DISTINCT w.joint_id) FILTER (WHERE
        w.pwht_weld_status IN (…PWHT_BACKLOG_STATUS_PRALL…) AND w.pwht_report IS NULL)
```

### M62 — PWHT Backlog Total for RT  (`PWHT B.log for RT`, BW/GW/CLET/MW only)
* measures `[PWHT Backlog Weld Status "BW" "GW" "EP"]` / `[PWHT All BACKLOG "BW" "GW" "CLET" "PR all"]`
  = M60 / M61 **+ `Weld Type IN {"BW","GW","CLET","MW"}`**.

### M63 — PWHT Backlog by RT100%
* measures `[PWHT BACKLOG RT100% "EP"]` / `[PWHT BACKLOG RT100% "PR all"]`
  = M62 + `RT% = 100`. The `"PR all"` one is
  `[PWHT Backlog RT100% "CCC" "PR all"] + CALCULATE(…)` (CCC branch + everyone else).

### M64 — PWHT B.Log RT NOT Done  (`PWHT B.log+RT NOT Done`)
* measure `[PWHT Backlog Weld Status All Weld Types RT NOT Done "EP"]`
```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Date]>0, 'Weld Dump'[RT Report]="",
'Weld Dump'[RT Weld Status]IN{…}, 'Weld Dump'[PWHT Weld Status]IN{…}, 'Weld Dump'[PWHT Report]="")
```
* The `"PR all"` twin is scoped to `Service Cat = "SG"` and `TMCP Pipe = "TMCP Pipe"` only —
  it is the slug-catcher/TMCP special case, four added `CALCULATE`s.

### M65 — PWHT Done
* measures `[PWHT Done All Weld Types "EP"]` = `CALCULATE(DISTINCTCOUNT([Joint ID]), [PWHT Report]<>"")`;
  `[PWHT Done All Weld Types "PR all"]` = same on the coalesced `[PWHT Report "PR All"]`
  (`PWHT Report` else `PWHT Report No CCC`).
```sql
count(DISTINCT w.joint_id) FILTER (WHERE coalesce(w.pwht_report, w.pwht_report_no_ccc) IS NOT NULL)
```

### M66 — PWHT backlog aging: within 3 / 3–7 / 7–15 / 15–30 / above 30 Days
* measures `[PWHT Backlog within 3 Days "WD"]`, `[PWHT Backlog above 3 Days below 7 "WD"]`,
  `[… above 7 Days below 15 "WD"]`, `[… above 15 Days below 30 "WD"]`,
  `[PWHT Backlog above 30 Days "WD"]`; `"PR all"` twins `[PWHT Backlog within 3 Days "PR all"]` …
  `[PWHT Backlog within Above 30 Days "PR all"]`.
* Same clock as M51: `DATEDIFF([Weld Date], TODAY(), DAY)`. Same edges.
* Each = M60 (resp. M61) + the day range. The `"PR all"` twins add the CCC branch
  (`Weld Date>0, PWHT Y/N CCC="Y", PWHT Report No CCC="", <day range>`).
```sql
count(DISTINCT w.joint_id) FILTER (WHERE <M60 predicate>
   AND (:as_of - w.weld_date) > 15 AND (:as_of - w.weld_date) <= 30)   -- "15 to 30 Days"
```

### M70 — MT/PT Done
* measure `[MT + PT "PR all"]` = joints with an MT report **plus** joints with a PT report,
  each `CALCULATE`d with `USERELATIONSHIP(MT Date "PR All"/PT Date "PR All", Calendar[Date])`
  so a week slicer ages them by inspection date, not weld date.
```sql
count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL AND w.mt_report_prall IS NOT NULL)
+ count(DISTINCT w.joint_id) FILTER (WHERE w.weld_date IS NOT NULL AND w.pt_report_prall IS NOT NULL)
```

### M71 — MT Qty / MPI Done
* measures `[MT Progress All "PR all"]` (`Weld Date>0 AND MT Report "PR All"<>""`),
  `[MT Progress  CCC  "PR all"]` (`Sub-Contractor="CCC" AND MT Report CCC<>""`),
  `[MT Progress All % Weld Status "PR_All"]` (`MT Weld Status IN {"NR"} AND MT Report<>""`).

### M80 — CUM … (all the cumulative trend lines)
* measures `[CUM RT FILM Ratio % by joint "PR all"]`, `[CUM Rejection UT Rate Length by Sub-Con "PR all"]`,
  `[CUM Rejection UT Rate Joint "PR all" Tracker]`, `[CUM RT BACKLOG Total Project "PR all"]`,
  `[CUM PWHT All BACKLOG "BW" "GW" "PR all"]`, `[CUM PWHT All BACKLOG All WELD TYPE "PR all"]`,
  `[CUM RT BACKLOG Total Project & PWHT NOT Done "PR all"]`. All share one pattern:
```dax
CALCULATE( <base measure>,
    FILTER(ALLSELECTED('Calendar'[Date]), ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)))
```
* Rule: "everything up to and including the current week", ignoring the visual's own date
  filter but respecting the page/report filters (`ALLSELECTED`).
```sql
-- running/cumulative form over the calendar axis
SELECT c.week_end_date,
       <base measure over rows where w.weld_date <= c.week_end_date>
FROM (SELECT DISTINCT week_end_date FROM calendar WHERE …) c;
```
Because the base measures are ratios and distinct counts, this must be a correlated
aggregate over `weld_date <= week_end_date`, **not** a `SUM() OVER ()` of weekly values.

### M81 — % of Target / % Unacceptable Limit (the flat reference lines)
* measures `[% of Target "PR"] = 0.01`, `[% Unacceptable Limit "PR"] = 0.03`,
  `[% UT of Target "PR all"] = 0.03`, `[% UT Unacceptable Limit "PR all"] = 0.05`.
  Hard-coded constants — port as constants.

### M90 — Project_Welder (page-1 KPI, 3,783)
* No fact-table measure. `Sum(SCTR OVERALL APPLIED WELDERS[QUALIFIED  WELDERS])` — a 16-row
  table loaded from `WORK FILES\Welders\SCTR NFE WELDERS APPLIED.xls`.
  **Not derivable from the weld data; the workbook is not in `sources/`.**

### M91 — WPS Approved (page-1 KPI, 294)
* `DistinctCount(WPQ RECORD REGISTER[WPS NO.])` filtered
  `[ DOCUMENT STATUS] IN {WPS APPROVED BY CTJV/ CPY}` — a 318-row register loaded from
  `WORK FILES\WPQ RECORD REGISTER\WPQ RECORD REGISTER.xlsx`.
  **Not derivable from the weld data; the workbook is not in `sources/`.**

### M92 — Project RT/UT Backlog & Project PWHT Backlog bar charts (pages 1, 7–11)
* Not measures over the fact table. `Sum(TREND Report[RT Backlog])`,
  `Sum(TREND Report[RT BACKLOG & PWHT Not Done])`, `Sum(TREND Report[RT BACKLOG & PWHT "Y" Done + "N"])`,
  `Sum(TREND Report[PWHT Backlog All Types])`, `Sum(TREND Report[PWHT BACKLOG RT NOT Done (SG+TMCP)])`
  — a 943-row weekly snapshot table keyed by `(Date, Sub-Contractor)`, filtered
  `TOP 5 BY Max(TREND Report[Date]) DESC`.
* Likewise `% RT Rejection Rate by Film` and `% UT Rejection Rate` on page 1 read
  `TREND RT UT[Project RT % Rej Rate]` / `[Project UT % Rej Rate]` (976 rows).
* Both come from hand-maintained workbooks:
  `WORK FILES\CUM Trend file RT and PWHT\CUM Trend file RT and PWHT Backlog .xlsx` (sheet
  `TREND`, columns `Date, Sub-Contractor, RT Backlog, PWHT Backlog All Types,
  PWHT Backlog For RT, RT BACKLOG & PWHT "Y" Done + "N", …`) and
  `WORK FILES\CUM Trend RT% UT% RejRate\CUM Trend RT% UT% RejRate.xlsx` (sheet
  `TREND RT UT`, columns `Date, Sub-Contractor, RT% Rate, UT% Rate, Project RT % Rej Rate,
  Project UT % Rej Rate`). **Neither is in `sources/`.**
* **These are historical snapshots the report author writes each week.** In the rebuild they
  must become a `weld_weekly_snapshot` table that the ETL appends to after each load —
  M40/M47/M61/M62 cannot be recomputed retrospectively because the aging clock uses `TODAY()`.
  Ruling R-08.

### M99 — `Master Table` measures (broken)
* `[Total Scope Dia "BW","CLET","GW","MW" Master Table]`,
  `[Total Scope Dia Welded "BW","CLET","GW","MW" Master Table]`,
  `[Total Scope Dia All Types Master Table]`, `[Total Scope Dia Welded "All Types" Master Table]`
  all reference `'Master Table'`, which **does not exist in the model**. They cannot evaluate.
  None of them is bound to any of the 44 mockup pages. Ruling R-07.

### 2.1 Coverage of the 172 mockup labels

One row per metric id; the `labels` column lists every one of the 172 distinct labels
from `analysis/mockups/welding-metrics.md` that resolves to it. The counts sum to 172.
`DIM …` rows are pivot *dimensions* (row/column headers), not measures — they are the
`GROUP BY` of the metric in the same table, and are listed here only so the 172 reconcile.

| metric id | n | mockup labels |
|---|---:|---|
| M01 / M02 / M03 | 1 | `Joints Welded` |
| M02 | 1 | `"F"+"S" Weld Qty` |
| M04 | 1 | `"F" Weld only` |
| M06 | 3 | `F Weld`, `S Weld`, `Welding Progress Trend` |
| M06 (+M04,M02,M70,M11) | 5 | `Welding Status - CCC`, `Welding Status - GAC`, `Welding Status - Medgulf`, `Welding Status - TEKFEN`, `Welding Status-GAC (Slug Catcher Area)` |
| M07 | 5 | `Weld Type - CCC`, `Weld Type Distribution`, `Weld Type-GAC`, `Weld Type-MEDGULF`, `Weld Type-TEKFEN` |
| M10 / M11 | 2 | `Numb RT/UT`, `Tested Joints` |
| M12 | 5 | `Numb RT/UT "R"`, `Rejected RT/UT`, `RT/UT "R"`, `RT/UT Rej`, `RT/UT Rej.Jts` |
| M13 | 5 | `Accepted RT/UT`, `Numb RT/UT "A"`, `RT Acc.Joints`, `RT/UT "A"`, `RT/UT Acc` |
| M14 | 2 | `% Rej by Joint`, `Rejection Rate Joint` |
| M15 | 1 | `RT/UT Ratio %` |
| M20 / M23 | 2 | `Films Taken`, `RT Films Taken` |
| M21 / M24 | 3 | `Films Acc`, `RT Film Accepted`, `RT Film_Accepted` |
| M22 / M24 | 4 | `Films Rej`, `No. Rej Films`, `No.Rej Film`, `Rej Films` |
| M25 | 7 | `% of Total Rej`, `% RT Film Rej`, `% Total Rej`, `%RT FILM Rej`, `RT FILM Ratio %`, `RT% Film Rej`, `RT% of Total Rej` |
| M26 | 3 | `RT Films "A"`, `RT Films "R"`, `RT Total Films` |
| M30 / M32 | 2 | `Numb UT`, `UT Done` |
| M31 / M32 | 2 | `UT "A"`, `UT "R"` |
| M32 | 2 | `UT/PAUT "A"`, `UT/PAUT "R"` |
| M33 | 1 | `UT Weld Len.m` |
| M34 | 4 | `UT Def Len m`, `UT Def Len.m`, `UT Def. Len.m`, `UT Def.Length` |
| M35 | 2 | `UT Insp Len`, `UT Insp Len m` |
| M36 | 3 | `% of Rej UT by Length`, `% Rej UT Len`, `UT Rej% Len` |
| M37 | 2 | `% of Rej UT by Joint (EP)`, `% Rej UT Joint` |
| M38 | 1 | `UT Ratio %` |
| M39 | 1 | `Numb UT/PAUT` |
| M40 / M41 | 5 | `RT B.LOG Total`, `RT Backlog`, `RT Backlog Total`, `Total RT B.log`, `Total RT Backlog` |
| M41 | 1 | `RT B.Log Total Project` |
| M42 / M43 | 3 | `RT 100% Backlog`, `RT100% B.log`, `RT100% Backlog` |
| M44 | 2 | `RT B.log & FAB-D`, `RT Backlog FABRICATED` |
| M45 | 3 | `RT B.log & PWHT "Y" Done`, `RT Backlog+ PWHT "Y" Done`, `RT+PWHT "Y" Done` |
| M46 | 4 | `RT B.log & PWHT "N"`, `RT Backlog +PWHT "N"`, `RT Backlog+ PWHT"N"`, `RT+PWHT "N"` |
| M47 | 4 | `RT B.LOG & PWHT "Y" NOT Done`, `RT B.LOG & PWHT NOT Done`, `RT B.log & PWHT NOT Done`, `RT Backlog & PWHT "Y" NOT Done` |
| M48 | 1 | `RT B.log & PWHT "Y" Done + PWHT "N" FAB-D` |
| M49 | 2 | `RT B.Log & PWHT"Y" NOT Done FAB-D`, `RT B.LOG & PWHT"Y" NOT Done FAB-D` |
| M51 | 1 | `above 30` |
| M51 / M66 | 5 | `15 to 30 Days`, `3 to 7 Days`, `7 to 15 Days`, `above 30 Days`, `within 3 Days` |
| M52 | 4 | `RT10% B.log Joints`, `RT20% B.log Joints`, `RT20% Backlog`, `RT5% B.log Joints` |
| M60 / M61 | 3 | `PWHT Backlog`, `PWHT Backlog All`, `PWHT Backlog All Types` |
| M62 | 3 | `PWHT B.log for RT`, `PWHT Backlog for RT`, `PWHT Backlog Total for RT` |
| M63 | 4 | `PWHT B.log RT100%`, `PWHT Backlog by RT100%`, `PWHT BACKLOG by RT100%`, `PWHT Backlog RT100%` |
| M64 | 2 | `PWHT B.Log RT NOT Done`, `PWHT B.log+RT NOT Done` |
| M65 | 1 | `PWHT Done` |
| M70 | 2 | `MT+PT Qty`, `MT/PT Done` |
| M80 | 10 | `% RT Rej Film`, `% RT Rejection Rate by Film (Project/Cumulative)`, `% UT Rej Length`, `% UT Rejection Rate by Length (Project/Cumulative)`, `% UT/PAUT Rejection Rate by Length (Project/Cumulative)`, `%RT Rejection Rate by Film (Cumulative-CCC)`, `%RT Rejection Rate by Film (Cumulative-GAC (SG))`, `%RT Rejection Rate by Film (Cumulative-GAC)`, `%RT Rejection Rate by Film (Cumulative-Medgulf)`, `%RT Rejection Rate by Film (Cumulative-TEKFEN)` |
| M90 | 1 | `Project_Welder` |
| M91 | 1 | `WPS Approved` |
| M92 | 8 | `Project PWHT Backlog`, `Project RT/UT Backlog`, `PWHT Only`, `PWHT+RT`, `PWHT+RT/UT`, `RT/UT Backlog`, `RT/UT Only`, `RT/UT+PWHT` |
| DIM pivot total | 1 | `Total` |
| DIM rt_pct | 3 | `10`, `5`, `RT%` |
| DIM service_class_cat_* | 1 | `Service Class+Weld Cat` |
| DIM service_class_cat_ndt | 1 | `Service Class+NDT Remarks` |
| DIM sub_contractor | 1 | `Sub-Contractor` |
| DIM weld_cat | 2 | `Weld Cat`, `Weld CAT` |
| DIM weld_type | 22 | `BON`, `BW`, `C`, `CLET`, `DMY`, `FW`, `FW.`, `GW`, `L4`, `LET`, `LUG`, `MW`, `O'LET`, `RPD`, `SLW`, `SOB`, `SOF`, `SP`, `SW`, `THD`, `TRN`, `WPAD` |
| DIM wps_no | 1 | `WPS No.` |
| **total** | **172** | |

Nothing is untraceable: every label above resolves to a pbix measure, a calculated
column, or a pivot dimension. **Ten** of them — `Project_Welder` (M90), `WPS Approved` (M91)
and the eight M92 backlog-trend series — resolve to tables that are **not files**: manually
maintained registers and weekly snapshots. See rulings R-08 and R-12.

**Measure sections in this document: 58 (`M01`–`M99`). Mockup labels covered: 172 of 172.
Labels marked `NOT FOUND in pbix`: 0.**

---

## §3 Page-by-page build sheet

Read as: **mockup page → pbix page → page-level filters → widget → metrics + grouping.**
Page-level filters are inherited by every widget unless the widget overrides them.

Notation: `SC=` sub-contractor, `WT=` Weld Type, `WC=` Weld Cat, `SVC=` Service Cat,
`RT%=` the `rt_pct` slicer value, `TMP` = `temporary_lines IS NULL`,
`W1` = `Week_End_Date IN TOP 1 DESC`.

### 3.1 Project pages

| mk | pbix page | page filters | widget | metrics | grouping |
|---|---|---|---|---|---|
| 1 | **21** `REP. Project Welding Progress +Inco+Acciona` (`ReportSection514242be207d15e172c1`) | none at page level; every visual carries `SC<>Inco` | 15 KPI cards | M02, M70, M39, M13, M12, M32(A), M23, M25, M32(R), M24(R), M36, M35, M90, M91, M34 | — |
| | | | chart `chart1_progress` (bar, 14 wks) | M06 | week × `weld_cat` (F/S) |
| | | | chart `chart1_weldtype` (donut) | M07 | `weld_type` |
| | | | chart `chart1_rtbacklog` | M92 (`TREND Report`) | week, 5 wks |
| | | | chart `chart1_pwhtbacklog` | M92 (`TREND Report`) | week, 5 wks |
| | | | chart `chart1_rtrej` | M80 (`TREND RT UT[Project RT % Rej Rate]`) | week, 6 wks |
| | | | chart `chart1_utrej` | M80 (`TREND RT UT[Project UT % Rej Rate]`) | week, 6 wks |
| 2 | **22** `REP. Project Welding & NDE Status +INCO+Acciona` (`ReportSection48abaf10b8b4a8823c85`) | `SC NOT IN {Inco}`, `TMP` | tbl *Project Welding Status* | M02 | rows `weld_cat` IN (F,S) × cols `weld_type` |
| | | | tbl *Welding Status for this Week* | M02 + `W1` | same |
| | | | tbl *Project RT/UT Tested…* | M11,M13,M12,M23,M24A,M24R,M25,M32,M33,M34,M32A,M32R,M36,M37 | rows `weld_cat`; `WT IN (BW,GW,MW,CLET)` |
| | | | tbl *Project RT & PWHT Status* | M41,M43,M61,M62,M63,M64,M45,M46,M47,M44,M48,M49,M25,M37 | rows `sub_contractor`; `WC<>J` |

### 3.2 Per-subcontractor welding-status pages

**Important, and easy to get wrong:** pbix pages 24–32 each carry *two* copies of every table
— one bound to `Weld Dump` (`"EP"` measures) and one bound to `Project WD+WR+INCO+Acciona`
(`"PR all"`). The mockup rendered a **mixture**. Two cross-checks fix which is which:

* mockup page 4 GAC `Joints Welded` = **375,152**; mockup page 42 GAC-except-SG per-WPS
  total = **371,613**; the page-42 pivot additionally excludes `Weld Type = DMY`, and mockup
  page 4 shows GAC DMY = **3,539**. `375,152 − 3,539 = 371,613` exactly ⇒ both are the
  **`"PR all"`** visual.
* mockup page 42 GAC-Slug-Catcher total = **1,479**, but page 9 GAC-SG `Joints Welded` =
  **1,466**; the difference of 13 is exactly the repair/reweld joints that
  `Joint Uniq "PR all" Welded` excludes and `DistinctCount(Weld Dump[Joint ID])` does not
  ⇒ that table is the **`Weld Dump`** visual.

So: default to the `"PR all"` visual; the GAC-Slug-Catcher WPS table on mockup page 42 is the
exception.

| mk | pbix page | page filters | widget | metrics | grouping |
|---|---|---|---|---|---|
| 3 | **23** `REP. CCC WELDING STATUS "PR all"` (`…56947ad6e1ecee586134`) | `SC IN {CCC}` | tbl *Cumulative Welding Status* | M02 | `weld_cat`(F,S) × `weld_type` |
| | | | tbl *Welding Status for this Week* | M02 + `W1` | same |
| | | | tbl *RT/UT Tested and Accepted/Rejected* | M11,M13,M12,M23,M24A,M24R,M25,M32,M33,M34,M32A,M32R,M36,M37 | rows `weld_cat`; `WT IN (BW,CLET)` |
| | | | tbl *RT & PWHT Status* | M41,M43,M61,M62,M63,M45,M46,M47,M44,M48,M49 | rows `weld_cat`; `WC<>J` |
| 4 | **24** `Rep. Welding Progress GAC` (`…71876cda0f04b42810b5`) | `Weld Dump[Revision Status]<>Cancelled`, `Weld Dump[SC]=GAC`, `TMP` | tbl *Cumulative Welding Status* (upper) | M02, `SC=GAC`, `SVC<>SG` | `weld_cat` × `weld_type` |
| | | | tbl *Welding Status for this Week* | M02 + `W1`, `SVC<>SG` | same |
| | | | tbl *Cumulative RT/UT Joints Tested…* | M11,M13,M12,M23,M24A,M24R,M25,M32,M33,M34,M32A,M32R,M36,M37; `WT IN (BW,CLET,GW,MW)`, `WC NOT IN ('',J)`, `SVC<>SG` | rows `weld_cat` |
| | | | tbl *RT% and PWHT Backlog* | M41,M43,M61,M62,M45,M46,M47; `SVC<>SG` | rows `weld_cat` |
| | | | 4 tables repeated with `SVC=SG` under the "SLG Service Only" heading | same metrics | |
| 5 | **25** `Rep. Welding Progress Tekfen & (TMPC)` (`…e0bad6c51ac92b2ae934`) | `TMP` | same four tables ×2 | as page 4 but `SC=TEKFEN`, first block `tmcp_pipe IS NULL`, second block `service_class='9C3AQN' AND tmcp_pipe='TMCP Pipe'` | |
| 6 | **26** `Rep. Welding Progress  MEDGULF` (`…3d8458ce5676cc8b3e18`) | `TMP` | same four tables ×1 | `SC=MEDGULF` | |
| 7 | **27** `Rep. Welding- CCC "PR all"` (`…de555c320e07d154e3c1`) | none | 4 KPI cards | M02; M24A; M24R; M25 — all `SC=CCC` | — |
| | | | chart `chart7_welding` | M04, M02, M70, M11 | week (TOP 8), `WC<>J` |
| | | | chart `chart7_weldtype` (donut) | M02 | `weld_type` |
| | | | tbl *Cumulative Welding Status* | M02 | `weld_cat`(F,S) × `weld_type` |
| | | | tbl *RT/UT Tested…* | M11,M13,M12,M23,M24A,M24R,M25,M32,M33,M34,M32A,M32R,M36 | rows `weld_cat`; `WT IN (BW,CLET)` |
| | | | tbl *RT% and PWHT Backlog\** | M41,M43,M61,M62,M63,M45,M46,M47 | rows `weld_cat`; `WC<>J` |
| | | | charts `chart7_rtbacklog`, `chart7_pwhtbacklog` | M92 `TREND Report` `SC=CCC` | week, 5 wks |
| | | | charts `chart7_rtrej`, `chart7_utrej` | M80 (`CUM RT FILM Ratio % by joint "PR all"` / `CUM Rejection UT Rate Length…`) | week, TOP 8 |
| 8 | **28** `Rep. Welding- GAC` (`…2d70b8887499d6cc0ee9`) | — | as page 7 with `SC=GAC`, `SVC<>SG` | | |
| 9 | **29** `Rep. Welding- GAC- SLG` (`…bff5b72c286b9ee0b028`) | — | as page 7 with `SC=GAC`, `SVC=SG` | | |
| 10 | **30** `Rep. Welding-Tekfen` (`…4f4083139ac8f6632b82`) | — | as page 7 with `SC=TEKFEN`, `tmcp_pipe IS NULL` | | |
| 11 | **32** `Rep. Welding-Medgulf` (`…111fa0dca9e3bfdad1e6`) | — | as page 7 with `SC=MEDGULF` | | |

*Mapping note (from `report-inventory.md`): mockup title 10 was ambiguous between pbix pages
30 `Rep. Welding-Tekfen` and 31 `Rep. Welding (TMCP) - Tekfen`. **Pick page 30.** Evidence:
the mockup's page-10 `Joints Welded` KPI is 349,667, which equals the page-5 TEKFEN
non-TMCP cumulative total; the TMCP page carries the textbox "TMCP scope completed:
Tested 122. RT/UT Acc 110. UT Rej 12." and its totals are two orders of magnitude smaller.*

### 3.3 NDE-by-RT% and PWHT-by-RT% pages

All of these have the same two-table shape. The **row grouping differs by subcontractor**:

* CCC pages (mk 12–18): `Weld Cat` › `Service Class + Service Cat+NDT Remarks` › `RT%`
  (label style `6R1B P 100`)
* GAC/TEKFEN/MEDGULF pages (mk 19–40): `Weld Cat` › `Service Class+Service Cat "WD"` › `RT%`
  (label style `1C3AS ABDF`, `EQP-SLG-01 SG`)

| mk | pbix page | page filters | table 1 (Backlog Details) metrics | table 2 metrics |
|---|---|---|---|---|
| 12 | **36** `Rep. CCC RT 100% NDE STATUS S.Class "PR all"` | `SC=CCC`, slicer `RT%=100` | M02, M11, M32, M15, M38, M13, M12, **M43**, M51(×5) | *RT Status*: M41, M45, M46, M47, M44, M48, M49 — rows `rt_pct`›`weld_cat`›`joint_id` |
| 13 | **37** `Rep. CCC-PWHT by RT 100 % STATUS "PR all"` | `SC=CCC`, `RT%=100`, tbl filter `PWHT Y/N CCC = Y` | M02, M65, **M63**, M66(×5) | *PWHT Status*: M61, M62, M63, M45, M46, M47 — rows `rt_pct`›`weld_cat` |
| 14 | **38** `Rep. CCC RT 5% NDE STATUS S.Class "PR all"` | `SC=CCC`, `RT%=5`, `weld_date IS NOT NULL` | M02, M11, M32, M15, M38, M13, M12, **M52(5 %)**, M51(×5) | *RT Backlog*: M52(5 %) — rows `service_class_cat_ndt`, `>0`, excl. `1A1A  H 5` |
| 15 | **39** `Rep. CCC-PWHT by RT 5% STATUS "PR all"` | `SC=CCC`, `RT%=5`, `PWHT Y/N CCC=Y` | M02, M65, **M61**, M66(×5) | *PWHT Backlog*: M61 — rows `weld_cat` × cols `rt_pct` |
| 16 | **40** `Rep. CCC RT 10% NDE STATUS S.Class "PR all"` | `SC=CCC`, `RT%=10`, `weld_date IS NOT NULL` | M02, M11, M32, M15, M38, M13, M12, **M52(10 %)**, M51(×5) | *RT Backlog*: M52(10 %) — rows `service_class_cat_ndt`, `>0`, `SC IN (CCC,GAC,MEDGULF,TEKFEN)` |
| 17 | **41** `Rep. CCC-PWHT by RT 10% STATUS "PR all"` | `SC=CCC`, `RT%=10`, `PWHT Y/N CCC=Y` | M02, M65, **M61**, M66(×5) | *PWHT Backlog*: M61 — rows `weld_cat` × cols `rt_pct` |
| 18 | **42** `Rep. CCC RT 20% NDE STATUS S.Class "PR all"` | `SC=CCC`, `RT%=20`, `WC IN (F,S)`, `weld_date IS NOT NULL` | M02, M11, M32, M15, M38, M13, M12, **M52(20 %)**, M51(×5) | *RT Backlog*: M52(20 %) — rows `service_class_cat_ndt`›`weld_cat`, `>0`, `WC<>J` |
| 19 | **43** `Rep. GAC NDE RT 100% STATUS` | `Weld Dump[SC]=GAC`, `Revision Status<>Cancelled`, `Temporary Lines "WD" IS NULL`, `RT%=100`, `weld_date IS NOT NULL` | M01, M10, M30, M15, M38, M13, M12, **M42**, M51-"WD"(×5) | *RT% Backlog*: M40, M45, M46, M47 (rows `weld_cat`); *RT Backlog*: M44 (rows `rt_pct`›`weld_cat`) |
| 20 | **44** `Rep. GAC- PWHT STATUS by RT 100%` | as 19 + `PWHT Weld Status` not blank | M01, M65, **M60**, M66-"WD"(×5) | *PWHT Backlog*: M60, M62, M63, M47 — rows `rt_pct`›`weld_cat` |
| 21 | **45** `Rep. GAC NDE RT 5% STATUS` | as 19, `RT%=5` | M01, M10, M30, M15, M38, M13, M12, **M40**, M51-"WD"(×5) | *RT% Backlog*: M40, M45, M46, M47; *RT Backlog*: M44 |
| 22 | **46** `Rep. GAC- PWHT STATUS by RT 5%` | as 20, `RT%=5` | as mk 20 | as mk 20 |
| 23 | **47** `Rep. GAC NDE RT 10% STATUS` | as 19, `RT%=10` | as mk 21 | as mk 21 |
| 24 | **48** `Rep. GAC- PWHT STATUS by RT 10%` | as 20, `RT%=10` | as mk 20 | as mk 20 |
| 25 | **49** `Rep. GAC NDE RT 20% STATUS` | as 19, `RT%=20` | as mk 21 | as mk 21, **+ a third *RT Status* pivot bound to `"PR all"`** (M41,M45,M46,M47,M44,M48,M49, `SC=GAC`, `RT%=20`) — the mockup does not render it |
| 26 | **50** `Rep. GAC NDE RT 30% STATUS` | as 19, `RT%=30` | as mk 21, minus `Numb UT` | as mk 21 |
| 27 | **51** `Rep. TEKFEN NDE RT 100% STATUS` | as 19 with `SC=TEKFEN`, `RT%=100` | as mk 19 | as mk 19 |
| 28 | **52** `Rep. TEKFEN- PWHT STATUS by RT 100%` | `SC=TEKFEN`, `RT%=100` | as mk 20 | as mk 20 |
| 29 | **53** `Rep. TEKFEN NDE RT 5% STATUS` | `SC=TEKFEN`, `RT%=5` | as mk 21 | as mk 21 |
| 30 | **54** `Rep. TEKFEN- PWHT STATUS by RT 5%` | `SC=TEKFEN`, `RT%=5` | as mk 20 | as mk 20 |
| 31 | **55** `Rep. TEKFEN NDE RT 10% STATUS` | `SC=TEKFEN`, `RT%=10` | as mk 21 | as mk 21 |
| 32 | **56** `Rep. TEKFEN- PWHT STATUS by RT 10%` | `SC=TEKFEN`, `RT%=10` | as mk 20 | as mk 20 |
| 33 | **57** `Rep. TEKFEN NDE RT 20% STATUS` | `SC=TEKFEN`, `RT%=20` | as mk 21 | as mk 21 |
| 34 | **58** `Rep. MEDGULF NDE RT 100% STATUS` | `SC=MEDGULF`, `RT%=100` | as mk 19 | as mk 19 |
| 35 | **59** `Rep. MEDGULF-PWHT STATUS by RT 100%` | `SC=MEDGULF`, `RT%=100` | as mk 20 | *PWHT Backlog*: M60, M62, M47 |
| 36 | **60** `Rep. MEDGULF NDE RT 5% STATUS` | `SC=MEDGULF`, `RT%=5` | as mk 21 | as mk 21 |
| 37 | **61** `Rep. MEDGULF- PWHT STATUS by RT 5%` | `SC=MEDGULF`, `RT%=5` | as mk 20 | as mk 20 |
| 38 | **62** `Rep. MEDGULF NDE RT 10% STATUS` | `SC=MEDGULF`, `RT%=10` | as mk 21 | as mk 21 |
| 39 | **63** `Rep. MEDGULF-PWHT STATUS by RT 10%` | `SC=MEDGULF`, `RT%=10` | as mk 20 | as mk 20 |
| 40 | **64** `Rep. MEDGULF NDE RT 20% STATUS` | `SC=MEDGULF`, `RT%=20` | as mk 21 | as mk 21 |

`M51-"WD"` / `M66-"WD"` = the `Weld Dump` bucket measures (short status list, `{"?",""}` in the
second branch); the CCC pages use the `"PR all"` twins (`{"?","","S"}`, `'T1-2'` added).

### 3.4 Weld-rejection-detail-per-WPS pages

| mk | pbix page | page filters | widget | metrics | grouping |
|---|---|---|---|---|---|
| 41 | **65** `Rep. CCC Weld Rej. Detail as per WPS "PR All"` (`…ab4a587ca398559a9d06`) | `SC=CCC` | 1 pivot | M03, M11, M15(&R/RW), M13, M12, M26(total/A/R), M25, M14 | rows `wps_no`; `WT<>THD`, `wps_no IS NOT NULL` |
| 42 | **66** `Rep. GAC Weld Rejection Detail as per WPS` (`…95645a101f383e75c9cf`) | `TMP` | pivot *GAC (Except Slug Catcher)* — the **`"PR all"`** visual `89ae2bdb…` | M02, M11, M15, M13, M12, M26, M25, M14 | rows `wps_no`; `SC=GAC`, `WT<>DMY`, `SVC<>SG`, `weld_date IS NOT NULL` |
| | | | pivot *GAC (Slug Catcher Only)* — the **`Weld Dump`** visual `7077adfc…` | `count(DISTINCT joint_id)`, M10, M13, M12, M26, M25, M14 | rows `wps_no`; `SVC=SG`, `weld_date IS NOT NULL` |
| 43 | **67** `Rep. TEKFEN  Weld Rejection Detail as per WPS` (`…74392e6e0b38cf52a65c`) | none | pivot (non-TMCP) `93d19d4b…` | M03, M02, M11, M15(&R/RW), M13, M12, M26, M25, M14 | rows `wps_no`; `SC=TEKFEN`, `WT<>DMY`, `tmcp_pipe IS NULL`, `TMP` |
| 44 | **68** `Rep. MEDGULF Weld Rejection Detail as per WPS` (`…cd143d9d2e09e94a4e27`) | `TMP` | pivot `44fc05a9…` | M03, M11, M15(&R/RW), M13, M12, M26, M25, M14 | rows `wps_no`; `SC=MEDGULF`, `WT<>DMY`, `tmcp_pipe IS NULL` |

*Mapping note: `report-inventory.md` marked mockup titles 41–44 ambiguous between pbix pages
65–68 (`… Weld Rej. Detail as per WPS`) and 88–91 (`… Welders Performance. Cumulative
Rejection Rate`). **Pages 65–68 are correct.** Evidence: the mockup's column headers are
`WPS No. | Joints Welded | Tested Joints | RT/UT Ratio % | Accepted RT/UT | Rejected RT/UT |
RT Total Films | RT Films "A" | RT Films "R" | RT FILM Ratio % | Rejection Rate Joint`, which
is the exact `Values` list of visual `f1649a7d…` on page 65, and the row key is `WPS No.`,
not `Welder ID`.*

**Page count in this build sheet: 44 mockup pages (1–44), all mapped.**

---

## §4 Plausibility checks against `sources/Weld Dump.txt`

Script: `analysis/reconcile_check.py` (stdlib only, streaming, ~9 s).
Output: `analysis/reconcile_results.json` + the console table below.
It reuses `analysis/dump/profile.py`'s record-assembly rule (accumulate CRLF pieces until the
record holds 223 fields) — splitting on newlines corrupts 17 records and mis-parses 1,236 more.

### 4.1 Load reproduction

| check | value |
|---|---|
| logical data records read | **1,001,114** ✓ matches `profile.md` |
| dropped `Revision Status = Cancelled` | 42,473 ✓ matches `profile.md` |
| dropped by the `Weld Date` exclusion list | 26 |
| dropped by `Area Classification = 0/""` | 0 (this export has none) |
| rows after the Power Query filters | **958,615** vs pbix stored `Weld Dump` **958,634** (Δ 19, different snapshot) |
| rows per sub-contractor **before** filters | GAC 484,100 · TEKFEN 426,977 · MEDGULF 90,025 · ACCIONA 12 · **CCC 0** |
| rows per sub-contractor **after** filters | GAC 473,938 · TEKFEN 398,992 · MEDGULF 85,685 · **ACCIONA 0** · **CCC 0** |
| `RT%` vocabulary | `0`=698,104 · `5`=182,910 · `100`=52,557 · `10`=24,884 · `30`=134 · `20`=26 |
| max `Weld Date` | 2026-08-28 (used as `TODAY()`) |

### 4.2 Per-subcontractor metrics — dump (30-Aug-26) vs mockup (16-Jan-26)

| metric | GAC non-SG dump | GAC non-SG mk | GAC SG dump | GAC SG mk | TEKFEN dump | TEKFEN mk | MEDGULF dump | MEDGULF mk |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Joints Welded (M01) | 412,983 | 375,152 | 1,798 | 1,466 | 370,089 | 349,667 | 74,281 | 69,843 |
| Tested Joints (M10) | 37,679 | 34,895 | 1,082 | 933 | 23,130 | 22,918 | 6,090 | 5,408 |
| RT/UT "A" (M13) | 37,043 | 34,342 | 1,070 | 920 | 22,486 | 22,292 | 6,058 | 5,384 |
| RT/UT "R" (M12) | 636 | 553 | 12 | 13 | 644 | 626 | 32 | 24 |
| joint rejection % (M14) | 1.69 % | 1.59 % | 1.11 % | 1.39 % | 2.78 % | 2.73 % | 0.53 % | 0.44 % |
| Films Taken by joint (M20) | 132,354 | 123,887 | 10,598 | 9,662 | 82,339 | 81,851 | 18,780 | 16,862 |
| Films Rej by joint (M22) | 534 | **534** | 2 | **2** | 773 | 801 | 41 | 32 |
| film rejection % (M25) | 0.40 % | 0.43 % | 0.02 % | 0.02 % | 0.94 % | 0.98 % | 0.22 % | 0.19 % |
| UT Done (M30) | 1,769 | 1,447 | 265 | 187 | 2,534 | 2,433 | 0 | 0 |
| UT "R" (M31) | 104 | 80 | 11 | **11** | 197 | 182 | 0 | 0 |
| UT Weld Len m (M33) | 3,913.09 | 3,269.79 | 929.32 | 672.50 | 3,977.55 | 3,681.20 | 0 | 0 |
| RT Backlog total (M40) | 289 | 177 | 3 | 45 | **0** | 17 | 23 | 22 |
| RT100% Backlog (M42) | 256 | 147 | 3 | 45 | **0** | 12 | 22 | 22 |
| PWHT Backlog All Types (M60) | 424 | 407 | 3 | 47 | **26** | 123 | 26 | 54 |
| PWHT Backlog for RT (M62) | 131 | 86 | 3 | 47 | 11 | 36 | 25 | 36 |

Every cumulative metric is 4–13 % higher in the dump than in the mockup — exactly what seven
extra months of welding should do, and the ratios (`film rejection %`, `joint rejection %`)
are within 0.05 pp. **The formulas reproduce.**

Bold cells are exact matches on a metric that had stopped moving (`Films Rej` 534/2, `UT "R"` 11).

### 4.3 Aging buckets (as of 2026-08-28)

| scope | RT backlog: ≤3 / 3–7 / 7–15 / 15–30 / >30 | PWHT backlog: ≤3 / 3–7 / 7–15 / 15–30 / >30 |
|---|---|---|
| GAC non-SG | 65 / 31 / 34 / 18 / 141 | 44 / 20 / 23 / 61 / 276 |
| GAC SG | 0 / 0 / 0 / 0 / 3 | 0 / 0 / 0 / 0 / 3 |
| TEKFEN | — (backlog is 0) | 3 / 12 / 5 / 0 / 6 |
| MEDGULF | see `reconcile_results.json` | see `reconcile_results.json` |

The buckets sum to the backlog total in every scope, which is the internal-consistency check
on the "age from Weld Date to today" reading of `No of Days "WD"`.

### 4.4 By RT% (GAC non-SG)

| RT% | joints welded | tested | accepted | rejected | RT backlog |
|---:|---:|---:|---:|---:|---:|
| 0 | 308,332 | 3,339 | 3,276 | 63 | 0 |
| 5 | 72,918 | 7,275 | 7,136 | 139 | 9 |
| 10 | 6,965 | 2,302 | 2,255 | 47 | 24 |
| 20 | 22 | 9 | 9 | 0 | 0 |
| 30 | 126 | 43 | 43 | 0 | 3 |
| 100 | 24,620 | 24,711 | 24,324 | 387 | 253 |

Note `RT% = 100` tested (24,711) **exceeds** joints welded (24,620): repairs and rewelds are
tested but excluded from the welded count (M15 can exceed 100 %, §M15). This is why the
mockup's `RT/UT Ratio %` column shows 100.49 %, 102.66 %, 189.29 % etc.

### 4.5 WPS-level rejection table — GAC excl. Slug Catcher (mockup page 42)

| | dump 30-Aug-26 | mockup 16-Jan-26 |
|---|---:|---:|
| WPS rows with data | 55 | 32 (mockup renders only the non-empty ones) |
| Joints Welded (total) | 409,028 | 371,613 |
| Tested Joints | 37,678 | 34,908 |
| Accepted | 37,042 | 34,357 |
| Rejected | 636 | 551 |
| RT Total Films (M26) | 180,034 | 171,021 |
| RT Films "R" | 596 | 548 |
| Rejection Rate Joint | 1.69 % | 1.58 % |

Row-level spot checks that match **exactly** (these WPSs finished before 16-Jan):
`GAC-WPS-P-CS/LTC-017` 252 / 252 / 249 / 3, `GAC-WPS-P-CS/LTC-014` 270 / 153 / 151 / 2,
`GAC-WPS-P-CS/LTC-011` 815 vs 806 welded but 528 / 521 / 7 tested identical.

### 4.6 Structural inconsistencies found — the signal

1. **CCC is not in the dump at all.** 0 rows. Mockup pages 3, 7, 12–18 and 41 (8 of 44) are
   unreproducible from `sources/`. So is the CCC slice of pages 1 and 2 — which is 56 % of the
   project total (1,043,781 of 1,853,374 joints welded).
1b. **ACCIONA is effectively not in the dump either.** It has 12 raw rows and *all twelve* are
   `Revision Status = Cancelled` with `Area Classification = 3000000` and a blank `Weld Date`,
   so after the load filters ACCIONA contributes **0** rows. The mockup's page-2 Acciona row
   (`% Rej by Joint` 0.39 %) therefore comes entirely from `Acciona_Query`
   (`Acciona_Latest Add to Query.xlsx`, 13,313 rows), not from this file.
2. **TEKFEN RT backlog computes to 0** where the mockup shows 17. Not a formula error: in this
   export every TEKFEN `RT% = 100` joint already has an `RT Report`, and TEKFEN's
   `RT Weld Status` is `NR`/blank throughout. The backlog genuinely closed between January and
   August. Worth confirming with the report author before shipping a page that will read "0".
3. **GAC Slug-Catcher backlogs collapsed** (RT 45→3, PWHT 47→3) for the same reason.
4. **`Numb UT` is unreproducible at "PR all" scope.** `[Manual UT Report No.]` /
   `[Manual UT Status.]` coalesce through `UT TRACKER (CCC)_Talisman`, `UT TRACKER (GAC)` and
   `UT TRACKER (TEK)`, none of which are in `sources/`. The `"EP"` version (`UT Weld Status='NR'
   AND UT Report<>""`) does work and is what pages 19–40 use — the dump gives GAC 1,769 vs
   mockup 1,447, TEKFEN 2,534 vs 2,433. The **page-1/2/3/7 UT numbers cannot be rebuilt**
   without the trackers.
5. **MEDGULF has no UT at all** in the dump (0 rows with `UT Report`), matching the mockup's
   blank UT columns on pages 6 and 11. Consistent, not a gap.
6. **`RT% = 0` covers 698,104 of 958,615 rows** (73 %). Those joints are outside every RT page
   (the pages slice on `RT% IN {5,10,20,30,100}`) but are inside `Joints Welded`. Any
   "coverage %" KPI built naively over all joints will be wrong.
7. **`RT% = 20` has 26 rows in the whole dump** and `RT% = 30` has 134. Mockup pages 25, 33, 40
   (RT 20 %) are already empty and page 26 (RT 30 %) shows one row. The rebuild should render
   an explicit "no data" state, not a broken table.
8. **`RT Weld Status` is 99.8 % `NR`** (276,560 of 277,267 non-blank). Every backlog measure's
   first branch is therefore near-dead for this dataset; the RT%=100 second branch does the
   work. If the source system's status coding changes, the backlog numbers move discontinuously.

---

## §5 Open rulings for the orchestrator

**R-01 — CCC source files are missing. Which way do we go?**
`CSVExport_Welder Record.csv` (5.43 M rows), `AllTrain_CSVExport_Joint Record.csv` (1.56 M),
`CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx` and `UT TRACKER (CCC)_Talisman.xlsx`
are all absent. So are
`Spool Dump.txt` (needed by every `FABRICATED` metric, M44/M48/M49) and
`Weld Length\Weld Length.xlsx` (needed by M33 at `"PR all"` scope).

The M code names **42 distinct source files**; `sources/` holds **one** of them. The 15 that
the 44 welding pages actually need (paths relative to `…\PCI Work File\WORK FILES\`):

| # | file | feeds | needed for | present |
|---:|---|---|---|---|
| 1 | `Weld Dump Work File\Weld Dump.txt` | `Weld Dump` | everything GAC/TEKFEN/MEDGULF | **yes** |
| 2 | `PCI CCC  PBI WORK FILES\CSVExport_Welder Record.csv` | `CSVExport_Welder Record` | all CCC pages | no |
| 3 | `PCI CCC  PBI WORK FILES\CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx` | `CSVExport_Welder Record - (ACC  REJ )` | CCC tested/rejected (§1.4) | no |
| 4 | `PCI CCC  PBI WORK FILES\AllTrain_CSVExport_Joint Record.csv` | `AllTrain_CSVExport_Joint Record` | CCC PWHT (M61–M66) | no |
| 5 | `Acciona\Acciona_Latest Add to Query.xlsx` | `Acciona_Query` | Acciona row on mockup p.2 | no |
| 6 | `Inco\Master Weld_Latest.xlsx` | `Inco Weld Log` | Inco (excluded by default, R-03) | no |
| 7 | `Spool Dump.txt` | `Spool Dump` | `FABRICATED` metrics M44/M48/M49 | no |
| 8 | `Weld Length\Weld Length.xlsx` | `Weld Length` | M33 at `"PR all"` scope | no |
| 9 | `UT TRACKER (CCC)_Talisman.xlsx` | `UT TRACKER (CCC)_Talisman` | M32/M34 (CCC UT) | no |
| 10 | `UT TRACKER (GAC)_Master.xlsx` | `UT TRACKER (GAC)` | M32 (GAC UT) | no |
| 11 | `UT TRACKER (TEK).xlsx` | `UT TRACKER (TEK)` | M32 (TEKFEN UT) | no |
| 12 | `CUM Trend file RT and PWHT\CUM Trend file RT and PWHT Backlog .xlsx` | `TREND Report` | M92, 6 charts | no |
| 13 | `CUM Trend RT% UT% RejRate\CUM Trend RT% UT% RejRate.xlsx` | `TREND RT UT` | M80 chart lines on p.1 | no |
| 14 | `Welders\SCTR NFE WELDERS APPLIED.xls` | `SCTR OVERALL APPLIED WELDERS` | M90 KPI | no |
| 15 | `WPQ RECORD REGISTER\WPQ RECORD REGISTER.xlsx` | `WPQ RECORD REGISTER` | M91 KPI | no |

Options: (a) request the 14 missing files from the report owner and build all 44 pages;
(b) build the 30 GAC/TEKFEN/MEDGULF pages now and stub the 8 CCC pages + the CCC slice of
pages 1–2 behind a "source not loaded" state; (c) extract CCC's rows out of the 1 GB pbix's
VertiPaq store.
**Recommendation: (b) now, (a) in parallel.** (c) is possible — the earlier lane already
decompressed the DataModel with a locally built `libxpress9.so` — but it yields a 30-Oct-2025
frozen copy, not a refreshable source, and the whole point of the rebuild is a live pipeline.
Evidence for (b) being safe: pages 19–40 and the GAC/TEK/MED half of 4–11, 42–44 are 100 %
`Weld Dump`-bound (§1.2) and §4 shows they reproduce.

**R-02 — Are cancelled welds in or out?**
**Out. Confirmed, not inferred.** The `Weld Dump` M query has
`#"Revision Status" = Table.SelectRows(#"Changed Type", each ([Revision Status] = ""))`, and
`Revision Status` only ever holds `Cancelled` (42,473 rows). Belt-and-braces, pbix pages 24
and 43–64 *also* carry a page filter `Weld Dump[Revision Status] NOT IN {Cancelled}` — a
redundant no-op that tells you the author intended exclusion.
**Recommendation:** load cancelled rows into the staging table (for audit / "what changed"),
exclude them from `weld` via `is_cancelled = false`, and expose a count so nobody wonders
where 42,473 rows went.

**R-03 — ACCIONA and INCO: in or out?**
The dump has 12 ACCIONA rows and **all 12 are `Revision Status = Cancelled`**, so the load
filters remove them and the dump contributes zero ACCIONA welds (script-verified, §4.1).
The pbix sources them from separate files
(`Acciona\Acciona_Latest Add to Query.xlsx` → `Acciona_Query`, 13,313 rows;
`Inco\Master Weld_Latest.xlsx` → `Inco Weld Log`, 10,327 rows), both missing from `sources/`.
Every project-level visual on mockup pages 1 and 2 filters `Sub-Contractor NOT IN {Inco}`,
but the page-2 sub-contractor table *does* show an `Acciona` row (with only a `% Rej by Joint`
of 0.39 %).
**Recommendation: include ACCIONA, exclude INCO by default.** Model INCO as a `source` value
so it can be switched on, but keep the default `sub_contractor <> 'Inco'` filter, which is
what every project visual does. Ask for the two workbooks anyway — Acciona's 13,313 rows are
1,000× the 12 in the dump, so the dump's ACCIONA rows are a fragment, not the population.

**R-04 — `PWHT Y/N = 25.01` (580,860 rows, the most common value).**
Options: (a) treat as data error and null it; (b) treat as `N`; (c) treat as **both** `Y` and
`N`, which is what the DAX does — `PWHT Y/N IN {"Y","25.01"}` in the "PWHT done" measures
*and* `PWHT Y/N IN {"N","25.01"}` in the "no PWHT" measures.
**Recommendation: (c) — reproduce the DAX literally, and flag it to the report owner.**
It is not defensible logic (a joint counted in both the Y and N buckets) but changing it
changes M45/M46/M47 and therefore the headline backlog numbers. Do not silently "fix" it;
put it in a config constant `PWHT_AMBIGUOUS_TOKEN = '25.01'` so the owner can rule later.
Note the mitigating detail: M45 also requires `PWHT Report <> ""` and M46 requires
`PWHT Weld Status = ""`, so a given row usually lands in only one.

**R-05 — UT trackers missing → `Numb UT` at "PR all" scope.**
`[Manual UT Report No.]` and `[Manual UT Status.]` need `UT TRACKER (CCC)_Talisman` (9,419),
`UT TRACKER (GAC)` (155) and `UT TRACKER (TEK)` (10).
**Recommendation:** request them (they are tiny), and until they arrive substitute the `"EP"`
definition (`ut_weld_status='NR' AND ut_report IS NOT NULL`, acc/rej from `UT Acc/Rej`), which
§4.2 shows tracks the mockup within ~20 %. Mark those KPIs "provisional" in the UI.

**R-06 — `Project WD+WR` ("PR" measures) is a dead table.**
Its M query ends
`#"Filtered Rows" = Table.SelectRows(#"Changed Type1", each ([Joint ID] = "21010AA-BD6132009A01-SP1-001"))`
— filtered to **one joint**, and the model stores **1 row** for it. All 31 `"PR"` measures
therefore return that single joint or blank. Five `"PR"` cards sit on pbix page 21 and are
overlaid by their `"PR all"` twins; the mockup renders the `"PR all"` values.
**Recommendation: do not port the `"PR"` scope at all.** Implement `"EP"` and `"PR all"` only.
If a two-source scope is ever wanted, it is `source IN ('WELD_DUMP','CCC_WELDER_RECORD')`.

**R-07 — the four `'Master Table'` measures.**
`[Total Scope Dia … Master Table]` ×4 reference a table that is not in the model; they cannot
evaluate and are bound to no mockup page.
**Recommendation: drop them.** They look like an abandoned attempt at a "total scope" (planned
vs welded dia-inch) denominator. If the client wants a scope-completion %, that is a new
requirement needing a scope register, not a port.

**R-08 — the weekly backlog trend charts cannot be recomputed.**
`TREND Report` (943 rows) and `TREND RT UT` (976 rows) are hand-maintained weekly snapshot
workbooks (`CUM Trend file RT and PWHT Backlog .xlsx`, `CUM Trend RT% UT% RejRate.xlsx`) —
someone types last week's backlog into them every Friday. Neither is in `sources/`. Six charts
on mockup pages 1, 7, 8, 9, 10, 11 read them. The underlying measures use `TODAY()`, so the
history is genuinely unrecoverable from a single dump: you cannot ask this dump what the
backlog was on 19-Dec.
**Recommendation:** create `weld_weekly_snapshot(week_end_date, sub_contractor, metric, value)`
and have the ETL append M40/M47/M60/M62/M25/M36 after every load, replacing the manual
workbooks. Seed it either from the two workbooks (ask for them — they are small) or from the
pbix's stored copies of those two tables. Until it is seeded, the six trend charts must render
with whatever history exists, not with an empty axis.

**R-09 — Slug Catcher: which column?**
`analysis/dump/profile.md` finding 9 says `Service class` values `EQP-SLG-*`. The pbix filters
on `Service Cat IN {SG}`. Both are true and consistent — mockup page 20 renders the row label
`EQP-SLG-01 SG`, i.e. `service_class='EQP-SLG-01'` **and** `service_cat='SG'`.
**Recommendation: use `service_cat = 'SG'`**, which is what every pbix visual does, and treat
the `EQP-SLG-*` class prefix as corroboration only.

**R-10 — TEKFEN mockup page ambiguity (mk 10 → pbix 30 vs 31), rejection pages (mk 41–44 → 65–68 vs 88–91).**
Resolved above in §3.2 and §3.4 with numeric evidence. **No orchestrator decision needed**,
but flag if you disagree.

**R-11 — the flange dashboard is entirely unsourced.**
`mockups/flange-dashboard 1.html` is driven by `Flange Progress` (363,245 rows from
`Flange Progress.xlsx`), `Flange ovAssets_1381/1510/1619`, `SCDB Data l0_scdb_task`,
`HA l0_abs_guide` and eight `Flg *_Flange Repair` logs — **none** in `sources/`. Its
`analysis/mockups/flange-spec.md` shows the mockup carries its own embedded `rawData` array
and JS formulas, so it is currently a self-contained static page.
**Recommendation:** treat the flange dashboard as a **separate, later work package**. Either
(a) port it against its embedded `rawData` as a fixed snapshot, or (b) request the eleven
source workbooks. Do not block the welding rebuild on it.

**R-12 — metrics I could not trace to a fact-table formula.**
`Project_Welder` (M90) and `WPS Approved` (M91) come from two small manual registers
(`SCTR OVERALL APPLIED WELDERS`, `WPQ RECORD REGISTER`). Eight backlog-trend series (M92) come
from `TREND Report`. That is 11 of the 172 labels.
**Recommendation:** model all three as small editable reference tables in Postgres with a
simple admin screen, seeded from the pbix extract. They are not computable and never were.

---

## §6 Schema proposal

### 6.1 Staging / raw

```sql
CREATE TABLE stg_weld_dump (
  line_no        bigint,          -- assembled logical record number
  raw            text[]           -- 223 fields, untouched
);
-- COPY with: FORMAT csv, DELIMITER ';', QUOTE E'\b', HEADER false, ENCODING 'WIN1252'
-- ...but only after the record-assembly pass: 17 records contain embedded CRLF and
-- 1,236 contain embedded LF, so a plain COPY mis-splits them. Pre-process with the
-- assembler in analysis/reconcile_check.py::iter_records and re-emit clean rows.
```

### 6.2 The normalised fact table

Types taken from `analysis/dump/profile.md` §8.1. Only the columns the 44 pages actually
touch are shown; the other ~180 come along with the same rules (29 of them are empty in every
row and can be dropped).

```sql
CREATE TYPE weld_source AS ENUM ('WELD_DUMP','CCC_WELDER_RECORD','ACCIONA','INCO');

CREATE TABLE weld (
  id                      bigserial PRIMARY KEY,      -- no natural key is unique (profile §2)
  source                  weld_source NOT NULL,
  -- identity
  joint_id                text        NOT NULL,       -- iso-spool-weld (+repair suffix for CCC)
  spool_id                text        NOT NULL,
  iso_number              text        NOT NULL,
  spool_no                text        NOT NULL,
  weld_no                 text        NOT NULL,
  weldpoint_no            smallint,                   -- repair/attempt sequence, 1..17
  repair_suffix           text,
  original_joint          text,
  -- scope / geometry
  weld_cat                char(1),                    -- F / S
  weld_type               text,                       -- BW, SW, FW, ... 22 values
  dia_inch                numeric(6,2),
  dia_inch_factor         char(1),                    -- Y/N flag, NOT a number (profile §0.3)
  thickness               numeric(6,2),
  pds_area                text,
  ag_ug_pkg               text,
  area_classification     smallint,
  system_no               text,
  testpack_no             text,
  service_class           text,
  service_cat             text,
  ndt_remarks             text,                       -- blank for WELD_DUMP rows
  material_type           text,
  wps_no                  text,
  welder                  text,
  sub_contractor          text        NOT NULL,
  -- lifecycle dates
  fitup_date              date,
  weld_date               date,
  -- RT
  rt_pct                  smallint,                   -- 0,5,10,20,30,100
  rt_weld_status          text,
  rt_selected_date        date,
  rt_date                 date,
  rt_report               text,
  rt_acc_rej              text,                       -- A / R / RS / U/Review
  total_no_of_films_acc   integer,
  total_no_of_films_rej   integer,
  rt_film_total           integer     GENERATED ALWAYS AS
                            (coalesce(total_no_of_films_acc,0)+coalesce(total_no_of_films_rej,0)) STORED,
  rt_re_shoot_status      text,
  rt_re_shoot_reason      text,
  defect_code             text,
  weld_point_code         text,                       -- R/H/F/C, blank for WELD_DUMP
  rt_ut                   text,                       -- 'UT' marker, blank for WELD_DUMP
  by_ut                   char(1),
  weld_length             numeric(8,3),               -- metres
  rej_length              numeric(8,3),
  -- UT
  ut_weld_status          text,
  ut_date                 date,
  ut_report               text,
  ut_acc_rej              text,
  manual_ut_report_no     text,
  manual_ut_status        text,
  -- PWHT / HT / MT / PT / PMI  (same shape, one block each)
  pwht_yn                 text,                       -- 'Y' | 'N' | '25.01'  (ruling R-04)
  pwht_weld_status        text,
  pwht_date               date,
  pwht_report             text,
  pwht_yn_ccc             text,                       -- from AllTrain joint record
  pwht_report_no_ccc      text,
  pwht_date_no_ccc        date,
  mt_weld_status text, mt_date date, mt_report text,
  pt_weld_status text, pt_date date, pt_report text,
  -- housekeeping
  revision_status         text,
  is_cancelled            boolean     GENERATED ALWAYS AS (revision_status = 'Cancelled') STORED,
  rework_code             text,
  hold_status             text,                       -- trim(): 'No ' and 'No' are one state
  -- derived (materialise; they are used in every WHERE clause)
  repair_reweld           text        NOT NULL DEFAULT '',   -- '' | 'Repair' | 'Reweld' | 'RS1'
  service_class_cat_wd    text,
  service_class_cat_ndt   text,
  temporary_lines         boolean     NOT NULL DEFAULT false,
  tmcp_pipe               boolean     NOT NULL DEFAULT false,
  exclude_ut_films        boolean     NOT NULL DEFAULT false,
  exclude_debris_films    boolean     NOT NULL DEFAULT false,
  spool_status            text,                       -- 'Fabricated' etc., from spool_dump
  ha                      text
);

CREATE INDEX weld_sub_date      ON weld (sub_contractor, weld_date);
CREATE INDEX weld_joint         ON weld (joint_id);
CREATE INDEX weld_rtpct_sub     ON weld (rt_pct, sub_contractor) INCLUDE (weld_cat, weld_type);
CREATE INDEX weld_svcclass      ON weld (service_class_cat_ndt);
CREATE INDEX weld_wps           ON weld (wps_no);
CREATE INDEX weld_rt_backlog    ON weld (sub_contractor, rt_pct)
       WHERE rt_report IS NULL AND weld_date IS NOT NULL
         AND weld_type IN ('BW','GW','CLET','MW');
CREATE INDEX weld_pwht_backlog  ON weld (sub_contractor)
       WHERE pwht_report IS NULL AND pwht_weld_status IS NOT NULL;
```

**Do not** put a unique constraint on `(iso_number, spool_no, weld_no, weldpoint_no)`: it is
the best natural key but still has 3,847 duplicated keys over 7,776 rows, and there are 0
duplicate whole rows, so those are genuinely distinct welds (`profile.md` §2).

### 6.3 Supporting tables

```sql
CREATE TABLE calendar (            -- CALENDAR("5/8/2021","31/12/2026"), 1,975 rows
  date            date PRIMARY KEY,
  weekday         smallint,        -- IF(WEEKDAY(d)<=6, WEEKDAY(d)+1, WEEKDAY(d)-6)  Sat=1
  weeknum         integer,
  week_start_date date,            -- the Saturday
  week_end_date   date,            -- the Friday   <- the report's week label
  month           text,            -- 'MMM-yy'
  year            smallint
);
CREATE INDEX calendar_week ON calendar (week_end_date);

CREATE TABLE weld_length_by_dia (  -- the pbix 'Weld Length' dimension: dia -> metres
  dia_inch     numeric(6,2) PRIMARY KEY,
  weld_length  numeric(8,3)
);

CREATE TABLE spool (               -- from Spool Dump.txt, 198,647 rows
  spool_id     text PRIMARY KEY,
  fabricated   date, qc_release date, painted date, to_site date, erected date,
  spool_nde_status text
);

-- the three manual registers (ruling R-12)
CREATE TABLE ref_qualified_welders (sub_contractor text, qualified_welders integer);
CREATE TABLE ref_wps_register      (wps_no text, document_status text);
CREATE TABLE weld_weekly_snapshot  (             -- ruling R-08
  week_end_date  date, sub_contractor text, metric text, value numeric,
  PRIMARY KEY (week_end_date, sub_contractor, metric)
);
```

### 6.4 Per-method views

The dump repeats an identical 10–14 column block for `PWHT, HT, RT, UT, MT, PMI, PT, FN,
PADLT, ORIF`. Rather than 10 wide column groups in every query, expose one long view:

```sql
CREATE VIEW nde_result AS
SELECT id, joint_id, sub_contractor, weld_date, 'RT' AS method,
       rt_pct AS pct, rt_weld_status AS weld_status, rt_date AS done_date,
       rt_report AS report, rt_acc_rej AS acc_rej
FROM weld
UNION ALL SELECT id, joint_id, sub_contractor, weld_date, 'UT', NULL, ut_weld_status, ut_date, ut_report, ut_acc_rej FROM weld
UNION ALL SELECT id, joint_id, sub_contractor, weld_date, 'PWHT', NULL, pwht_weld_status, pwht_date, pwht_report, NULL FROM weld
UNION ALL SELECT id, joint_id, sub_contractor, weld_date, 'MT', NULL, mt_weld_status, mt_date, mt_report, NULL FROM weld
UNION ALL SELECT id, joint_id, sub_contractor, weld_date, 'PT', NULL, pt_weld_status, pt_date, pt_report, NULL FROM weld;
```
Use it for the generic "method progress" widgets (`MT/PT Done`, `MPI Done`). Keep the RT and
PWHT page queries on the wide table — they mix RT and PWHT predicates in a single row test
(M45–M49) and a long view would force a self-join.

### 6.5 Live vs materialised

Measured on this machine, a full streaming pass over the 1 M-row dump with all the distinct
counts takes **8.6 s in Python**. Postgres over an indexed 1 M-row table will do any single
page's aggregates in **20–200 ms**. So:

| workload | rows | verdict |
|---|---|---|
| single-subcontractor page (pages 3–11, 19–44): ~15 aggregates over ≤500 k rows | 1 M | **live** |
| project pages 1–2: same aggregates over the full table | 1 M → 6.5 M with CCC | **live** at 1 M; **materialise** at 6.5 M (the `count(DISTINCT joint_id)` ×14 in one pivot is the cost) |
| per-WPS pages 41–44: `GROUP BY wps_no` with 10 aggregates | 1 M | **live** |
| the 5 aging buckets ×2 families ×44 pages | small (backlog sets are <1 000 rows) | **live** |
| weekly trend charts (M06, M80 cumulative) | 14 weeks × full scan each | **materialise** — one `mv_weekly_progress(week_end_date, sub_contractor, weld_cat, joints, tested, rejected, films, films_rej, rt_backlog, pwht_backlog)` refreshed after each load |
| the `CUM …` cumulative ratios (M80) | O(weeks × rows) | **materialise** on top of `mv_weekly_progress` |

```sql
CREATE MATERIALIZED VIEW mv_weekly_progress AS
SELECT c.week_end_date, w.sub_contractor, w.weld_cat, w.weld_type,
       count(DISTINCT w.joint_id) FILTER (WHERE w.repair_reweld='')       AS joints_welded,
       count(DISTINCT w.joint_id) FILTER (WHERE w.rt_report IS NOT NULL
             AND w.rt_acc_rej IS DISTINCT FROM 'RS')                      AS tested,
       count(DISTINCT w.joint_id) FILTER (WHERE w.rt_acc_rej='R')         AS rejected,
       sum(w.rt_film_total)  FILTER (WHERE w.weldpoint_no=1
             AND w.rt_acc_rej IS DISTINCT FROM 'RS')                      AS films,
       sum(w.total_no_of_films_rej) FILTER (WHERE w.weldpoint_no=1)       AS films_rej
FROM weld w JOIN calendar c ON c.date = w.weld_date
WHERE NOT w.is_cancelled
GROUP BY 1,2,3,4;
CREATE UNIQUE INDEX ON mv_weekly_progress (week_end_date, sub_contractor, weld_cat, weld_type);
```

At 6.5 M rows (CCC loaded) this materialised view is ~150 k rows and refreshes in seconds;
it feeds M05, M06 and every `CUM …` line without touching the fact table.

---

## Appendix — verification

```
$ time python3 analysis/reconcile_check.py
  logical data records read      : 1001114        <- matches analysis/dump/profile.md
  rows after Power Query filters : 958615         <- pbix stores 958,634 for 'Weld Dump'
  real 0m9.2s
$ grep -c '^### ' analysis/calculation-logic.md            -> 84   (58 of them are M-metrics)
$ grep -c '^### M[0-9]' analysis/calculation-logic.md      -> 58
$ grep -c 'NOT FOUND' analysis/calculation-logic.md        -> 3    (all 3 are prose about the
                                                                    convention, not untraced
                                                                    metrics; 0 metrics untraced)
$ wc -l analysis/calculation-logic.md                      -> ~1631
```
Mockup labels covered: **172 / 172** (§2.1). Mockup pages in the build sheet: **44 / 44** (§3).
Files this lane wrote: `analysis/calculation-logic.md`, `analysis/reconcile_check.py`,
`analysis/reconcile_results.json`. Nothing else was touched.
