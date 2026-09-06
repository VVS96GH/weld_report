# The flange data model inside the .pbix

Everything below is extracted verbatim from `analysis/pbix/raw/model/*.json` and
`analysis/pbix/raw/visuals-flat.json` (which `analysis/pbix/model.md`, `measures.md` and
`report-inventory.md` are the prose renderings of). Nothing is inferred from the mockup.

The flange dashboard is a **different grain from `weld`**: one row = one *flanged bolted
joint* (`Joint ID`), not one weld. It must not be loaded into the `weld` fact table.

---

## 1. The 18 tables

| # | pbix table | cols | rows | fed by | in `sources/`? |
|---|---|---:|---:|---|---|
| 1 | `Flange Progress` | 96 | **363,245** | `Flange Progress.xlsx` **appended with** `Flange ovAssets_1619` | **yes** (the xlsx half) |
| 2 | `Flange ovAssets_1619` | 79 | 226,504 | `ovAssets_1619.xlsx`, sheet `Exported from SC` | **yes** |
| 3 | `Flange ovAssets_1510` | 75 | 134,943 | `ovAssets_1510.csv` | no |
| 4 | `Flange ovAssets_1381` | 70 | **1** | `ovAssets_1381.csv`, then `Table.SelectRows(… [Joint ID] = "11010P1-CV6206101A-J01")` | no |
| 5 | `Flange BreakDown` | 4 | 288 | `CUM Trend Flange Progress Break Down Rate % .xlsx`, sheet `Fl.BreakDown` | no |
| 6 | `Flg CCC_Flange Repair` | 12 | 2,346 | SharePoint `…/30 - Repair Logs/10 - CCC/CCC - Flange Repair Log - Consolidated.xlsx`, sheet `Concat` | no |
| 7 | `Flg GAC_Flange Repair` | 10 | 255 | SharePoint `…/20 - GAC/GAC - Flange Repair Log - Consolidated.xlsx`, sheet `Concat` | no |
| 8 | `Flg TFN_Flange Repair` | 12 | 116 | SharePoint `…/30 - TFN/TFN - Flange Repair Log - Consolidated.xlsx`, sheet `Analysis` | no |
| 9 | `Flg tekfen repair log main log` | 17 | 116 | same TFN workbook, sheet `Data` | no |
| 10 | `Flg Medgulf_Flange Repair` | 17 | **6** | SharePoint `…/40 - MEG/MEG - Flange repair consolidated.xlsx`, sheet `Analysys` | no |
| 11 | `Flg Enova Flange Repair_W10` | 9 | 223 | SharePoint `…/50 - Enova/Flange Face Re-Machining Log for CTJV Matls_latest.xlsx`, sheet `W10 ` | no |
| 12 | `Flg Enova Flange Repair_W17` | 16 | 201 | same Enova workbook, sheet `W17` | no |
| 13 | `Flg Onepager_data` | 14 | **2,946** | `Table.Combine({CCC, GAC, TFN, Medgulf})` then appended with `Enova_W10` | no (derived from 6-12) |
| 14 | `HA l0_abs_guide` | 13 | 912 | `l0_abs_guide_202502191028.csv` | no |
| 15 | `SCDB Data l0_scdb_task` | 74 | 33,526 | `Sql.Databases("CTJVSTSRV06")` → `QC_Database.dbo.l1_scdb_task`, filtered `ITR_form = "PIP-018-A"` | no (SQL Server) |
| 16 | `l2_ndt_list` | 22 | 202 | `Sql.Databases("CTJVSTSRV06")` → `dbo.l2_ndt_list`, `Report_Type = "FN"` | no (SQL Server) |
| 17 | `l3_ndt_spo_summary` | 12 | 9,638 | `Sql.Databases("CTJVSTSRV06")` → `dbo.l3_ndt_spo_summary` | no (SQL Server) |
| 18 | `l3_ndt_spo_summary (2)` | 10 | 17 | `l3_ndt_spo_summary.csv` | no |

Tables 16-18 are NDT, not flange; they carry the `l*` prefix the recon brief asked about but
no flange visual binds them. They are listed for completeness and then ignored.

Two more tables the flange calculated columns reach into: `Project WD+WR+INCO+Acciona`
(the combined weld register — present in this repo as the `weld` fact) and
`Testpack-wise Details Report` (punch list; **not** in `sources/`).

## 2. Relationships

Of the model's 14 relationships, only four touch flange tables, and none of them is a
star join onto `Flange Progress`:

| from | to | active |
|---|---|---|
| `Flange ovAssets_1619[Joint ID]` | `Flange ovAssets_1381[Joint ID]` | yes (1:1, but `_1381` is 1 row) |
| `Flg GAC_Flange Repair[SN]` | `Flg CCC_Flange Repair[SN]` | yes |
| `Flg Onepager_data[SN]` | `Flg TFN_Flange Repair[SN]` | yes |
| `Flange Progress[Index]` | `Project WD+WR+INCO+Acciona[Index]` | **inactive** |

`Flange Progress` is not joined to `Calendar` by a listed relationship either — the date
slicing goes through the auto date hierarchy on `[Joint Date]`, and
`Flanges ID Inspected 2` explicitly re-points it with
`USERELATIONSHIP('Flange Progress'[Control Inspection Date], 'Calendar'[Date])`.
Everything else is done with flat-table filtering.

## 3. M lineage — how `Flange Progress` is actually built

```
Flange Progress.xlsx :: sheet "FlangeJointProgress"
  |> Table.Skip(5)  |> Table.PromoteHeaders          (54 fields)
  |> ReplaceText "02/05/06/07-Oct-0024" -> "…-2024"  on [Joint Date]   (4 hand-patched typos)
  |> SelectRows [Iso Number] <> "0" and <> "1M03"
  |> SelectRows [Flange Subcontractor] <> "ACCIONA"
  |> Replace null -> "TBN"   on [Joint Timing], [Cat.]
  |> AddColumn  Joint ID   = [Iso Number] & "-" & [BT No.]
  |> AddColumn  PDS Area   = Text.BeforeDelimiter([Iso Number], "-")
  |> AddColumn  Joint Method Original = [Joint Method]   ("Tensionning" -> "Tensioning")
  |> Replace on [Joint Method]:  Tensionning->Tensioning, "Manual Torquing"->Manual,
                                 "Hydraulic Torquing"->Torquing, "Torquing Critical"->Torquing,
                                 null->TBN
  |> Replace on [ACC/REJ]:  "AC"->"A", "ACC"->"A"
  |> Rename "Status - A/R " -> "Status - A/R"            (note the trailing space in the sheet)
  |> Table.Combine({ this , #"Flange ovAssets_1619" })   -- step is *named* "&ovAssets1381"
                                                            but combines 1619; 1381 is dead
  |> AddIndexColumn "Index"
  |> SelectRows [Joint Date] <> #date(2026, 11, 20)
```

`Flange ovAssets_1619` is the same vocabulary reached from a very different export:

```
ovAssets_1619.xlsx :: sheet "Exported from SC"   (headers on row 1, 46 fields)
  |> ~120 rename / replace steps, the load-bearing ones being:
       FlangeJointName                                  -> Joint ID
       WeldAreaname                                     -> PDS Area
       PipingIsometricNum - Field026 (Custom)           -> Iso Number
       Test Pack No - Field029 (Custom)                 -> Test Pack
       Category for final tightening - Field030 (Custom)-> Cat.        ("" -> "TBN")
       FL - Tightening Method                           -> Joint Method ("Torqueing"->"Torquing", null->TBN)
       FL - Torque Value                                -> Jointing Value
       Tightening Date - Field027 (Custom)              -> Joint Date   (strip "'", " 12:00:00 AM", "0:00")
       Verified Date - Field024 (Custom)                -> Control Inspection Date
       Report Number - Field031 (Custom)                -> Report Nbr
       Crew ID - Field034 (Custom)                      -> Jointer
       Re-Tightening Date - Field028 (Custom)           -> De-Tightening Requested Date
       Subsystem -> SubSystem, JointSize -> Diam, SpecNo -> Service Class,
       StudNumber/Diameter/Length -> Bolt Qty/Size/Length, GasketType -> Gasket Desc.,
       Stud Material -> Bolt Desc., Serial No of Field Tag - Field023 -> Tag Nbr
  |> Replace on [PCC Remarks - #(lf)Field045 (Custom)]:
       "Flange leaking"  -> "FLANGE LEAKAGE"
       "Flange leakage"  -> "FLANGE LEAKAGE"
  |> AddColumn Flange Subcontractor = "CCC"            <-- hard-coded, every row
  |> AddColumn Reason for De-Tightening = [PCC Remarks - Field045 (Custom)]
  |> AddColumn Joint Timing = X->"Before Pressure Test", Y->"Before Precom",
                              Z->"After Precom", else "TBN"
  |> AddColumn BT No. = List.Last(Text.Split([Joint ID], "-"))
  |> AddColumn 20 empty placeholder columns (Control %, Flange Joint Status, Status - A/R,
       BTC01, BT24, Batch Status, Selected/Issued Date, Hold*, WITNESSED BY, ACC/REJ, REMARKS…)
```

So **CCC's flange register is `ovAssets_1619` and nothing else**, and it arrives with no
inspection-status columns at all: `Status - A/R`, `Flange Joint Status`, `Control %`,
`BTC01` are literally `""` for all 226,504 CCC rows.

`Flange ovAssets_1381` and `_1510` are the same shape from `.csv` exports. `_1381` ends with
`Table.SelectRows(…, each [Joint ID] = "11010P1-CV6206101A-J01")` — **one row**; it is a
disabled query kept alive only so the `Table.Combine` step name and one relationship resolve.

`Flg Onepager_data` (the repair fact) is:

```
Table.Combine({ Flg CCC_Flange Repair, Flg GAC_Flange Repair,
                Flg TFN_Flange Repair, Flg Medgulf_Flange Repair })
  |> Table.Combine({ …, Flg Enova Flange Repair_W10 })      (which itself appends _W17)
```

with each contributor deriving the same four numeric flags from its own local columns:

| log | `Site SN` | `Vendor SN` | `Repaired` | `To be Repaired` |
|---|---|---|---|---|
| CCC | `[OSDR / PSO] = "Site"` | `= "Vendor"` | `[Action Done] <> null` | `[Action Done] = null` |
| GAC | `[Vendor/Site] = "Site"` | `= "Vendor"` | `[Re-Machining Date] <> null` | `= null` |
| TFN | `[Vendor/Site] = "Site"` | `= "Vendor"` | `NOT Contains([Final Conclusion],"Waiting Remachining")` | Contains(…) |
| MEG | `[Site/Vendor] = "Site"` | `= "Vendor"` | `[Flange Maching Date] <> null` | `= null` |
| Enova | — | `[OSD NO] <> null` | `[Re-Machining Date] <> null` | `= null` |

and every one of them stamps `ACCEPTED/REJECTED = "Rejected"` on every row (the measures then
filter on it, so the filter is a no-op).

## 4. DAX calculated columns on `Flange Progress` (verbatim)

```dax
-- PDS Area "VPR"   (needs the weld register)
MAXX(FILTER('Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[ISO Number] = 'Flange Progress'[Iso Number]),
     'Project WD+WR+INCO+Acciona'[PDS Area])

-- PDS Area Final
IF(ISBLANK('Flange Progress'[PDS Area "VPR"]),
   'Flange Progress'[PDS Area], 'Flange Progress'[PDS Area "VPR"])

-- HA          <-- the dashboard's HA1..HA4 filter
VAR SystemVal = 'Flange Progress'[System]
VAR SecondDigit = MID(SystemVal, 2, 1)
RETURN
IF(ISBLANK(SystemVal) || SystemVal = "System-NA - Not Applicable",
   LOOKUPVALUE('HA l0_abs_guide'[Handover Area],
               'HA l0_abs_guide'[Location Number], 'Flange Progress'[PDS Area Final]),
   SWITCH(SecondDigit, "1","HA1", "2","HA2", "3","HA3", "4","HA4",
          LOOKUPVALUE('HA l0_abs_guide'[Handover Area],
                      'HA l0_abs_guide'[Location Number], 'Flange Progress'[PDS Area Final])))

-- HA CWA      (the pure guide lookup, unused by the dashboard visuals)
LOOKUPVALUE('HA l0_abs_guide'[Handover Area],
            'HA l0_abs_guide'[Location Number], 'Flange Progress'[PDS Area Final])

-- Sub-Contractor From WD+WR      (unused by the flange pages; they use [Flange Subcontractor])
MAXX(FILTER('Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[PDS Area] = 'Flange Progress'[PDS Area Final]),
     'Project WD+WR+INCO+Acciona'[Sub-Contractor])

-- Task_Status PIP-018-A "VPR"    (needs SCDB)
IF(MAXX(FILTER('SCDB Data l0_scdb_task',
               'SCDB Data l0_scdb_task'[TAG] = 'Flange Progress'[Test Pack]),
        IF('SCDB Data l0_scdb_task'[Task_Status] = "Closed", 1, 0)) = 1, "Closed", BLANK())

-- Test Completed Date / Reinstatement Completed Date   (need Testpack-wise Details Report)
MAXX(FILTER('Testpack-wise Details Report',
            'Testpack-wise Details Report'[TEST PACK] = 'Flange Progress'[Test Pack]),
     'Testpack-wise Details Report'[Test Completed Date])
-- Test Status         = IF(NOT ISBLANK([Test Completed Date]), "Tested", BLANK())
-- Reinstatement Status= IF(NOT ISBLANK([Reinstatement Completed Date]), "Reinstatement", BLANK())
-- Loose Bolts Description = MAX(punch descriptions CONTAINSSTRING "LOOSE BOLTS") per Test Pack

-- Dia Inch >60<
IF([Diam] < 60, "0-60", IF([Diam] >= 60 && [Diam] <= 200, "60-199", "Greater than 199"))

-- WeldPoint No.1 WP1 / Joint ID Max Joint_Date / Duplicate Joint ID
--   row-number-within-Joint-ID, "keep the max-Joint-Date (or the blank-date) row",
--   and DISTINCTCOUNT of WP1 per Joint ID.  Only used by the internal QA pages.
```

**`HA` is the only calculated column any mockup widget depends on**, and its primary branch
(`MID([System],2,1)`) needs no external table. The `HA l0_abs_guide` fallback fires only when
`[System]` is blank or `"System-NA - Not Applicable"`.

## 5. The 37 flange / leak / PCC measures

`grep -iE 'flange|flg |leak|PCC|joint method|HA1|handover'` over the 448 measures matches
**37**, all of them defined on the `Calendar` table. Nine are what the mockup renders; the
rest are variants used on the internal pages.

### The nine the mockup uses

```dax
Total Flanges ID =
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]))

Total Flanges ID Jointed =                          -- "Inspected" in the mockup
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]), 'Flange Progress'[Joint Date] > 0)

Flanges ID Jointed % =
[Total Flanges ID Jointed] / [Total Flanges ID]

Total Flanges ID Tightening Constraction "CCC no cat" =        -- "Const-n"
VAR DateFilter =
    FILTER('Flange Progress',
        NOT ISBLANK('Flange Progress'[Joint Date]) &&
        ISBLANK('Flange Progress'[PCC Tightening Date- Field039 (Custom)]))
RETURN
    CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]), DateFilter,
              'Flange Progress'[Flange Subcontractor] = "CCC")
  + CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]), DateFilter,
              FILTER('Flange Progress',
                     'Flange Progress'[Flange Subcontractor] <> "CCC" &&
                     'Flange Progress'[Cat.] IN {"X", "Y"}))

Total Flanges ID Tightening PCC "CCC no cat" =                 -- "PCC"
VAR CurrentSubcontractor = VALUES('Flange Progress'[Flange Subcontractor])
VAR TighteningPCCCount =
    CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
        'Flange Progress'[PCC Tightening Date- Field039 (Custom)] > 0, CurrentSubcontractor)
VAR NonCCCWeldedCount =
    CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
        'Flange Progress'[Joint Date] > 0, CurrentSubcontractor,
        'Flange Progress'[Flange Subcontractor] <> "CCC",
        'Flange Progress'[Cat.] IN {"Z", "A", "B"})
RETURN TighteningPCCCount + NonCCCWeldedCount

Total Flanges ID Remainder =                        -- "Remains" in the HA1 progress donut
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]), ISBLANK('Flange Progress'[Joint Date]))

Flanges ID BreakDown =                              -- "Leaked Flange Break"
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
          'Flange Progress'[Reason for De-Tightening] = "FLANGE LEAKAGE")

Flange Break Down Rate % =                          -- "Leaked %"
[Flanges ID BreakDown] / [Total Flanges ID Jointed]

Repaired FLG      = CALCULATE(SUM('Flg Onepager_data'[Repaired]),
                              'Flg Onepager_data'[ACCEPTED/REJECTED] = "REJECTED")
To be Repaired FLG= CALCULATE(SUM('Flg Onepager_data'[To be Repaired]),
                              'Flg Onepager_data'[ACCEPTED/REJECTED] = "REJECTED")
```

Note the two spellings that coexist: `Total Flanges ID Tightening Constraction` /
`… PCC` (plain, `Cat. IN {X,Y}` resp. `{Z,A,B}` for **every** subcontractor, plus a separate
`Total Flanges ID TBN`) and the `"CCC no cat"` variants above, which exempt CCC from the
`Cat.` test because `ovAssets_1619` fills `Cat.` only 75.3 % of the time. **The mockup's
numbers are the `"CCC no cat"` pair** — proof: the mockup's 4 subcontractor `constn` values
sum to 122,867 and `pcc` to 2,276, and only the "CCC no cat" pair can produce a non-zero CCC
`pcc` (773) together with a CCC `constn` (59,126) that ignores `Cat.`.

### The other 28, one line each

`Total Flanges ID Jointed` variants: `Flanges Backlog "FH,FHS"` (`[Flange Joint Status] IN
{"FH","FHS"}`), `CUM Flange BACKLOG` (running total of it), `Flanges ID Inspected`
(`[Control Inspection Date] > 0`), `Flanges ID Inspected "Acc"` / `"Rej"`
(`+ [Status - A/R] = "A"/"R"`), `Flanges ID Inspected 2` (same, but
`USERELATIONSHIP([Control Inspection Date], Calendar[Date])`), `Total Flanges ID 100% Control`
(`[Control %] = 100`), `Flanges ID Complete "BTC01"`, `Flanges ID De-Tightening`
(`CONTAINSSTRING([Joint Point],"FR")`), `Flange ID De-Tightening Rate %`,
`Flanges ID PCC Tightening` / `PCC De-Tightening`, `Flange ID Status Tested`,
`Total Flanges ID Reinstatement`, `Total Flanges ID Tightening Constraction` /
`… PCC` / `… TBN` (the `Cat.`-for-everyone variants), `CUM Flange Rejection Rate Project`,
four `Total Flanges ID Reinstatement SCDB *` (all gated on `[Task_Status PIP-018-A "VPR"]`),
four `* 1510` measures over `Flange ovAssets_1510`, and
`Flange ID from SCDB 1510 VPR "Not Found"`.

Plus two on `Flg Onepager_data`: `CUM Repaired running total Calendar` and
`CUM To be Repaired running total Calendar` (`CALCULATE([Repaired FLG],
FILTER(ALLSELECTED('Calendar'), 'Calendar'[Date] <= MAX('Calendar'[Date])))`).

## 6. Report pages → the mockup's 8 sections

Six of the 145 report pages bind flange tables:

| page | visuals | flange-bound | what it is |
|---|---:|---:|---|
| `CPY Rep. FlangeManagment` | 87 | 43 | **the mockup's source page** — client-facing one-pager |
| `CPY Rep. FlangeManagment Page 2` | 41 | 23 | same tiles, extra `FLANGE MANAGEMENT / Repartition and Progress` pivot |
| `Internal CPY Rep. FlangeManagment` | 90 | 48 | + an `SCDB 1510` pivot |
| `Internal Rep. FlangeManagment` | 41 | 40 | card wall + `Flange Status` pivot + leak line |
| `Internal Rep. FlangeManagment TP wise` | 41 | 40 | same, grouped by Test Pack |
| `Internal Rep. FlangeManagment By Dia` | 44 | 43 | same, grouped by `Dia Inch >60<` |

`mockups/flange-dashboard 1.html` is a redraw of **`CPY Rep. FlangeManagment`**. Section by
section:

| mockup section | pbix visual on `CPY Rep. FlangeManagment` | binding |
|---|---|---|
| **Filters** (`#filterSubco`/`#filterHA`/`#filterMethod`) | three `slicer` visuals | `Flange Progress[Flange Subcontractor]`, `[HA]`+`[Process Area]`+`[PDS Area Final]`, `[Joint Method]`+`[Joint Method Original]` (the page carries 12 more slicers the mockup dropped: `Cat.`, `Joint Timing`, `Test Pack`/`Joint ID`, `Control %`, `Dia Inch >60<`, `Joint Point`, `Reason for De-Tightening`/`Reason`, `PCC Remarks`, `Task_Status`, `Loose Bolts`, `Test Status`, `Reinstatement Status`, the two PCC date pairs) |
| **Summary Highlights** (4 tiles) | 4 `card` visuals under the `TOTAL Register / Constr-on / PCC / INSPECTED` textboxes | `Total Flanges ID`, `… Tightening Constraction "CCC no cat"`, `… Tightening PCC "CCC no cat"`, `… Jointed` + `Flanges ID Jointed %` |
| **Project Inspection & Status Tables** | `donutChart "Project Flange Inspected"` + 2 `pivotTable "Subcontractor Flange Status"` + `pivotTable "HA Flange Status"` | donut = `[Joint Method]` × `Total Flanges ID Jointed`; pivots = rows `[Flange Subcontractor]`/`[Joint Method]`/`[HA]` × the 7-measure column set |
| **HA1 Subcontractor & Progress** | 2 `pivotTable "HA 1 Subcontractor Flange Status"` + `donutChart "HA 1 Flange Inspection Progress"` | donut Y = `Constraction "CCC no cat"`, `PCC "CCC no cat"`, `Total Flanges ID Remainder` |
| **Leaked Flange Break % Timeline** | `lineChart "Leaked Flange Break %"` | X `Flange BreakDown[Date]`, Y `Avg(Flange BreakDown[Project Fl.BreakDown % Rej Rate])` — **a pre-aggregated trend workbook, not `Flange Progress`**; badge card = `Flanges ID BreakDown`, rate card = `Flange Break Down Rate %` |
| **Repair Overview** | `donutChart` (unnamed) + `clusteredColumnChart "Flange Repair (Site Issue)"` + `"(Vendor Issue)"` (+ a `tableEx` the mockup dropped) | `Sum(Flg Onepager_data[Repaired])` / `[To be Repaired]`; the two bars = `Sum([Site SN])` / `Sum([Vendor SN])` by month, series `[Subcontractor]` |
| **Inspection Progress Overview** (3 bubbles) | the same `card` visuals re-labelled | `Total Flanges ID Jointed`, `… Tightening PCC "CCC no cat"`, `Flanges ID BreakDown` |
| **Monthly Inspection** | `clusteredColumnChart "Project Flange Monthly Inspection"` | Date-hierarchy Year/Month × `Total Flanges ID Jointed` (the pbix also has a `Project Flange Weekly Inspection` on `Calendar[Week_End_Date]` the mockup dropped) |

The mockup's `rawData.leakedTimeline`, `.repair`, `.monthly` and `.ha1Progress` are keyed by
`All` / `<Subco>` / `<HA>` / `HA1_<Subco>` — i.e. the mockup author pre-materialised the
cross-filter results of these four visuals for the filter combinations the page allows,
because a static page cannot re-query.

## 7. What is missing, and exactly what it blocks

| absent artefact | rows in pbix | mockup widgets it blocks |
|---|---:|---|
| `Flg CCC/GAC/TFN/MEG/Enova_*` repair logs (5 SharePoint workbooks, 7 pbix tables) → `Flg Onepager_data` | 2,946 | **Repaired vs To Be Repaired** donut, **Flange Repair (Site Issue)** bar, **Flange Repair (Vendor Issue)** bar — 3 of 22 widgets, and the badge totals on the last two |
| `CUM Trend Flange Progress Break Down Rate % .xlsx` → `Flange BreakDown` | 288 | **Leaked Flange Break % Timeline** line chart (the *as-reported weekly* series). A cumulative series is re-derivable from `Flange Progress` — see §8 |
| `l0_abs_guide_202502191028.csv` → `HA l0_abs_guide` | 912 | the `HA` fallback for rows whose `[System]` is blank/`"System-NA"`. Measured cost on the delivered data: **6,593 of 357,787 Joint IDs (1.84 %)** land in a `(blank)` HA bucket |
| `Sql.Databases("CTJVSTSRV06")` → `SCDB Data l0_scdb_task` | 33,526 | `Task_Status PIP-018-A "VPR"` and the four `Reinstatement SCDB` measures — **used by no mockup widget**, only by the internal pages and one slicer the mockup dropped |
| `ovAssets_1510.csv` → `Flange ovAssets_1510` | 134,943 | the four `* 1510` measures and the `SCDB 1510` pivot — **internal page only, no mockup widget** |
| `ovAssets_1381.csv` → `Flange ovAssets_1381` | 1 (filtered) | **nothing.** The query is filtered down to a single Joint ID and the `Table.Combine` that names it actually combines `_1619` |
| `Testpack-wise Details Report` | — | `Test Status`, `Reinstatement Status`, `Loose Bolts Description` — **no mockup widget**, three dropped slicers |

**Net:** of the eleven workbooks R-11 listed, the two that carry the register itself
(`Flange Progress.xlsx`, `ovAssets_1619.xlsx`) are present and reproduce the pbix table
row-for-row (363,245 = 363,245, verified in `analysis/flange/workbooks.md`). The nine that are
missing cost **3 widgets outright** (the repair trio), **1 widget in its as-reported form**
(the leak timeline), and **1.84 % of rows' HA attribution**.

## 8. What the delivered data can still do for the two blocked widgets

* **Leak timeline.** `Flange BreakDown` is only a cached copy of
  `CUM Flange Rejection Rate Project = CALCULATE([Flange Break Down Rate %],
  FILTER(ALLSELECTED('Calendar'[Date]), ISONORAFTER(…, DESC)))`. Since both operands
  (`Flanges ID BreakDown`, `Total Flanges ID Jointed`) are `Flange Progress` measures with a
  `[Joint Date]` grain, the *cumulative* weekly series is computable from the delivered
  workbooks. What is **not** recoverable is the historical weekly *as-reported* value —
  `Flange Progress.xlsx` is a current-state register, so a leak recorded today back-dates
  itself to its `Joint Date`. Numbers will drift from the mockup's; label the chart as
  recomputed, not as-reported.
* **Repair.** Nothing in either workbook carries a repair record.
  `Flange Repair Record - Field032 (Custom)` exists in `ovAssets_1619` and is **100 % empty**
  (0 of 226,504 non-blank). There is no substitute. The three repair widgets render empty.
