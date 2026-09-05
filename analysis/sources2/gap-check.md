# What arrived, what is still missing

Checked against `analysis/calculation-logic.md` §5 R-01 (the 15-file shopping list) by
name and by reproducing each file's pbix row count. Everything below is measured, not assumed.

## A. The R-01 fifteen — 9 present, 6 still missing

| # | R-01 file | feeds | present now? | evidence |
|---:|---|---|---|---|
| 1 | `Weld Dump Work File\Weld Dump.txt` | `Weld Dump` | **yes** (unchanged) | 958,615 rows in `weld` |
| 2 | `CSVExport_Welder Record.csv` | `CSVExport_Welder Record` | **YES — new** | 5,430,732 data lines; 4,791,434 with blank `RT/UT Report No.` + 641,575 from the ACC/REJ workbook = **5,433,009** = the pbix's stored row count, exactly |
| 3 | `CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx` | `… - (ACC  REJ )` | **YES — new** | sheet `CSVExport_Welder Record - FOR P`, **641,575** data rows = pbix exactly; 119 columns, same header as the CSV |
| 4 | `AllTrain_CSVExport_Joint Record.csv` | joint record + NOT WELDED | **YES — new** | 1,612,440 lines → `Del Flag=""` **1,560,273** = pbix; of those `Weld Date=null` **130,994** = pbix NOT WELDED. Both exact |
| 5 | `Acciona\Acciona_Latest Add to Query.xlsx` | `Acciona_Query` (13,313 rows) | **NO** | not in `sources/` under any name |
| 6 | `Inco\Master Weld_Latest.xlsx` | `Inco Weld Log` (10,327) | **NO** | not in `sources/`. R-03 excludes Inco by default anyway |
| 7 | `Spool Dump.txt` | `Spool Dump` | **YES — new** | 202,352 lines − 3,705 `Revision Status='Cancelled'` = **198,647** = pbix exactly |
| 8 | `Weld Length\Weld Length.xlsx` | `Weld Length` (728,550) | **NO** | M33/M34/M36 at `"PR all"` scope stay unbuildable; CCC rows carry a blank `Weld Length` |
| 9 | `UT TRACKER (CCC)_Talisman.xlsx` | `UT TRACKER (CCC)_Talisman` | **YES — new** | sheet `TalismanUT_update`, **9,419** rows = pbix exactly |
| 10 | `UT TRACKER (GAC)_Master.xlsx` | `UT TRACKER (GAC)` (155) | **NO** | tiny file, still worth asking for |
| 11 | `UT TRACKER (TEK).xlsx` | `UT TRACKER (TEK)` (10) | **NO** | 10 rows |
| 12 | `CUM Trend file RT and PWHT Backlog .xlsx` | `TREND Report` | **YES — new** | sheet `TREND`, **943** rows = pbix exactly (+ a 2024 `Back up/` copy) |
| 13 | `CUM Trend RT% UT% RejRate.xlsx` | `TREND RT UT` | **YES — new** | sheet `TREND RT UT`, **976** rows = pbix exactly (+ `Back up/` copy) |
| 14 | `Welders\SCTR NFE WELDERS APPLIED.xls` | `SCTR OVERALL APPLIED WELDERS` (16) | **NO** | M90 `Project_Welder` KPI still unsourced. **Partial substitute present**: `CUM Trend Active Welders.xlsx` gives a weekly active-welder count per sub-contractor, which is a different measure |
| 15 | `WPQ RECORD REGISTER\WPQ RECORD REGISTER.xlsx` | `WPQ RECORD REGISTER` (318) | **NO** | M91 `WPS Approved` KPI still unsourced |

Also asked for in the brief and **still missing**: `Welders Power Q for PBI .xlsx`
(`WELDERS_Qualification`), `CUM WPS Status.xlsx` (`WPS Status CUM`), the two
`CUM FILE … Welders Performance` workbooks, the eight `Flg *_Flange Repair` logs,
`ovAssets_1381.csv` / `ovAssets_1510.csv`, `PIC_vs_Talisman_2026_02_16.xlsx`,
`l3_ndt_spo_summary.csv`, and every `Sql.Databases("CTJVSTSRV06")` table (`l2_ndt_list`,
`l0_scdb_task`, `l0_abs_guide`) — those last are a live SQL Server, not a file, and can never
arrive as one.

## B. Files present that R-01 did not ask for

| file | pbix table | rows reproduced | what it is for |
|---|---|---|---|
| `Joint.csv` (322 MB, 62 cols, cp1252) | `TALISMAN DATA` | **exact**: 1,548,056 lines → drop 41,935 `ORIGINAL REPAIR DELETE FLAG='D'` → 1,506,121 → four successive `Table.ExpandListColumn` splitting `WELDER ID 1..4` on `/` → **3,098,341** = pbix | **A QC cross-check table, not a metric source.** It joins 1:1 to `Project WD+WR+INCO+Acciona[Index]` and carries 22 calculated columns named `Weld Date from Welder Record`, `Weld Date TR/F Talisman & Welder Record`, `RT Report TR/F Talisman & Joint Record`, `Joint ID+Welder ID TR/F …` (model.md 2912-2927) — i.e. it exists to prove the PIC export agrees with Talisman. No mockup metric binds it. **Do not load it into `weld`.** |
| `Spool.csv` (58 MB, 22 cols, cp1252) | `Talisman Spool Dump` | **exact**: 331,979 lines = pbix; `Spool ID` = `QCISO NO`-`SPOOL NO` is **unique** | Talisman's own spool milestone dump: `FABRICATION ORDER`, `CUT / FIT`, `SHOP WELD COMPLETE`, `PWHT` (renamed `PWHT Date Spool`), `SHOP NDE DONE`, `SITE MOVE`, `SPOOL ERECTION DONE`, `FIELD WELD COMPLETE`, `FIELD NDE DONE`. `PWHT Date Spool` is what M50 (`RT B.log & FAB-D & Spool PWHT Date`) needs. It is a **second, CCC-side spool master** alongside `Spool Dump.txt`, which covers only GAC/TEKFEN/MEDGULF |
| `ovAssets_1619.xlsx` (29 MB) | `Flange ovAssets_1619` | **exact**: sheet `Exported from SC`, 226,504 rows = pbix | Flange dashboard only (R-11). It is appended into `Flange Progress` (`Table.Combine`), and the M stamps `Flange Subcontractor = "CCC"` on every row. 136,742 + 226,504 ≈ the pbix's 363,245 `Flange Progress` rows after its three filters |
| `Flange Progress.xlsx` (26 MB) | `Flange Progress` | sheet `FlangeJointProgress`, 136,742 rows after `Table.Skip(5)` | Flange dashboard only (R-11). Its 11 sibling repair logs are still missing, so the flange dashboard is still not buildable |
| `CUM MPI Done .xlsx` | `CUM MPI Done` | **exact**: sheet `MPI Done`, 124 rows = pbix | Weekly cumulative `MPI Done` / `MPI / PT Done` project totals → M71. No sub-contractor column |
| `CUM Trend Active Welders/CUM Trend Active Welders.xlsx` | `Trend Active Welders` | 576 rows, 115 Fridays | Weekly active-welder count per sub-contractor — the "Project Welders By Weekend" column charts. **Not** M90 |
| `TO BE EXLUDE FROM DATA.xlsx` | **none — not referenced by any Power Query in `analysis/pbix/model.md`** | sheet `TO BE Exlude from Data`, 596 rows + a 20-row `Sheet1` scratch | 596 CCC welder-record rows in the welder-record shape (119 cols + `RT Report + Welder` prepended and `VPR Welder Record Table ACC/REJ`, `New Reports`, `Joint ID` appended), keyed by `RT Report + Welder` (161 distinct reports) and `Joint ID`. It is a **hand-curated exclusion list the pbix does not yet apply.** Needs a ruling — see plan.md |
| `CUM Trend Active Welders/Project Welders By Weekend .csv` | **none** | 47 data lines, UTF-8 **BOM**, 2024-06-14 … 2024-07-05 | The same three columns as the Active Welders workbook (`Week_End_Date`, `No. of Welders 'PR all"`, `Sub-Contractor`) for six weeks only. A stale export/scratch. **Superseded by the workbook — ignore** |
| `CUM Trend Active Welders/New Text Document.txt` | **none** | 29 lines of prose | Analyst's narrative notes on individual welders' 2-week and monthly rejection rates ("`TEK-438: 3 Joints RT done and 2 Joint was rejected, is 66.67%`"). Commentary, not data. **Ignore** |
| `CUM Trend …/Back up/*.xlsx` ×2 | — | 2024-08-25 vintage | Older copies of the two trend sheets. Provenance only |
| `CUM Trend file RT and PWHT/1 RT .PNG`, `1 UT .PNG` | — | — | Screenshots of the charts the workbook feeds. Reference only |

## C. What is now buildable that was not

* **All 8 CCC pages + the CCC slice of pages 1–2**, except: CCC UT (needs the tracker — now
  present), CCC `Weld Length` metrics (M33/M34/M36 — still blocked by `Weld Length.xlsx`), and
  CCC RT-backlog **aging** buckets (M51 needs `RT Selected Date`, which is empty in all
  5,430,732 CCC rows).
* **The `FABRICATED` metrics M44/M48/M49/M50** for GAC/TEKFEN/MEDGULF via `Spool Dump.txt`
  (`spool.fabricated`, `qc_release`, …). **Not** for CCC — `Spool Dump.txt` contains only
  GAC 103,260 / TEKFEN 82,072 / MEDGULF 17,020 shop-sub-contractor spools, zero CCC. CCC's
  spool milestones are in `Spool.csv` instead, under a different column vocabulary.
* **The six weekly trend charts** on mockup pages 1, 7–11 (R-08) — seed from the two workbooks;
  see `trend-seed-plan.md`.
* **M71 MPI/PT Done** weekly line.

## D. Still blocked

| what | blocked by |
|---|---|
| Acciona row on mockup p.2 | `Acciona_Latest Add to Query.xlsx` |
| Inco (off by default, R-03) | `Master Weld_Latest.xlsx` |
| M33/M34/M36 at `"PR all"` scope | `Weld Length.xlsx` |
| GAC/TEKFEN UT at `"PR all"` scope (M32) | `UT TRACKER (GAC)_Master.xlsx`, `UT TRACKER (TEK).xlsx` |
| M90 `Project_Welder` KPI | `SCTR NFE WELDERS APPLIED.xls` |
| M91 `WPS Approved` KPI | `WPQ RECORD REGISTER.xlsx` |
| CCC RT-backlog aging (M51) | nothing to ask for — `RT/UT Request Date` is empty in the export itself |
| the flange dashboard (R-11) | 11 more workbooks + two SQL Server tables |
