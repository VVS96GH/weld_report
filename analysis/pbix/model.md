# Semantic model

## How this was extracted

`DataModel` is a 1,043,647,012-byte Xpress9-compressed VertiPaq image; nothing in it is 
readable as text. Extraction path that worked, step by step:

1. No `pip`, no `ensurepip`, no `venv` on this box, and no compiler (`gcc`/`cc`/`make` all absent).
2. Bootstrapped pip from `https://bootstrap.pypa.io/get-pip.py` into a scratchpad 
   `--target` directory (no global install, no venv).
3. `pip install pbixray` fails: its `xpress9` dependency has **no cp314 wheel** (wheels stop at 
   cp313) and the 0.3.8 sdist cannot build — `setup.py` cythonizes `xpress9.pyx`, which is not 
   shipped in the sdist (`ValueError: 'xpress9.pyx' doesn't match any files`). Same failure for 
   `xmhuffman` and `xpress8`.
4. Installed the `ziglang` wheel (a complete C toolchain shipped as a pure-Python wheel) and 
   compiled `libxpress9.so` from the C sources in `github.com/Hugoberry/xpress9-python` 
   (`Xpress9Wrapper.c`, `Xpress9DecLz77.c`, `Xpress9DecHuffman.c`, `Xpress9EncLz77.c`, 
   `Xpress9EncHuffman.c`, `Xpress9Misc.c`) with `zig cc -shared -O2 -fPIC -DXPRESS9DLL_EXPORT`.
5. Wrote a `ctypes` module named `xpress9` exposing the same `Xpress9.decompress(bytes, size)` 
   API the Cython extension exposes, and stubbed `xpress8` / `xmhuffman` (both are used only for 
   **column data** pages, which this recon does not need — model metadata does not go through them).
6. `pbixray==0.15.5` then opened the .pbix directly and returned the full metadata: measures, 
   calculated columns/tables, relationships, Power Query M, schema, statistics.
7. Additionally dumped the raw `metadata.sqlitedb` (47,493,120 bytes) out of the decompressed 
   model to read `Measure.FormatString` and per-table row counts, which pbixray does not surface.

Everything below is read out of that model. No DAX or M has been paraphrased.

## Model-level facts

| property | value |
|---|---|
| Name | `Model` |
| Culture | `en-US` |
| Collation | _(unset)_ |
| DefaultMode | `0` |
| DefaultPowerBIDataSourceVersion | `2` |
| DiscourageImplicitMeasures | `0` |
| ModifiedTime | `1761636672000` |
| tables (total, incl. auto-date) | 500 |
| tables (real) | 63 |
| auto-generated date tables | 437 |
| columns (all tables) | 20132 |
| measures | 448 |
| relationships | 14 |
| Power Query (M) expressions | 62 |
| VertiPaq size reported by pbixray | 2256051245 bytes |

**All 448 measures live on the `Calendar` table**, which is itself a calculated table 
(`CALENDAR("5/8/2021","31/12/2026")`). `Calendar` is a measure-holder, not a date dimension 
used in relationships — it has no relationship to any other table (see the relationship table 
below, which never mentions it).

## Tables (63 real tables)

`rows` is `max(ColumnStorage.Statistics_RowCount)` over the table's columns, read from 
`metadata.sqlitedb`. A blank means the table has no materialised column storage under that name.

| # | table | columns | rows | calc. columns | M query |
|---|---|---|---|---|---|
| 1 | `Acciona Joint Summary` | 10 | 29 | 0 | yes |
| 2 | `Acciona_Query` | 187 | 13,313 | 0 | yes |
| 3 | `AllTrain_CSVExport_Joint Record` | 146 | 1,560,273 | 1 | yes |
| 4 | `AllTrain_CSVExport_Joint Record NOT WELDED` | 186 | 130,994 | 0 | yes |
| 5 | `Bracing FE_Analysis` | 58 | 1 | 0 | yes |
| 6 | `CSVExport_Welder Record` | 91 | 5,433,009 | 3 | yes |
| 7 | `CSVExport_Welder Record - (ACC  REJ )` | 119 | 641,575 | 0 | yes |
| 8 | `CUM FILE UT Welders Performance 2 Weeks` | 12 | 20,026 | 0 | yes |
| 9 | `CUM FILE Welders Performance 1 Month` | 12 | 103,331 | 0 | yes |
| 10 | `CUM FILE Welders Performance 2 Weeks` | 12 | 100,723 | 0 | yes |
| 11 | `CUM MPI Done` | 3 | 124 | 0 | yes |
| 12 | `CUM WEEK # Status` | 12 | 1,016 | 0 | yes |
| 13 | `Calendar` | 9 | 1,975 | 9 | no (calculated table) |
| 14 | `Flange BreakDown` | 4 | 288 | 0 | yes |
| 15 | `Flange Progress` | 96 | 363,245 | 16 | yes |
| 16 | `Flange ovAssets_1381` | 70 | 1 | 0 | yes |
| 17 | `Flange ovAssets_1510` | 75 | 134,943 | 2 | yes |
| 18 | `Flange ovAssets_1619` | 79 | 226,504 | 0 | yes |
| 19 | `Flg CCC_Flange Repair` | 12 | 2,346 | 0 | yes |
| 20 | `Flg Enova Flange Repair_W10` | 9 | 223 | 0 | yes |
| 21 | `Flg Enova Flange Repair_W17` | 16 | 201 | 0 | yes |
| 22 | `Flg GAC_Flange Repair` | 10 | 255 | 0 | yes |
| 23 | `Flg Medgulf_Flange Repair` | 17 | 6 | 0 | yes |
| 24 | `Flg Onepager_data` | 14 | 2,946 | 1 | yes |
| 25 | `Flg TFN_Flange Repair` | 12 | 116 | 0 | yes |
| 26 | `Flg tekfen repair log main log` | 17 | 116 | 0 | yes |
| 27 | `HA l0_abs_guide` | 13 | 912 | 0 | yes |
| 28 | `Inco NDT Tracking` | 14 | 179 | 0 | yes |
| 29 | `Inco Weld Log` | 205 | 10,327 | 0 | yes |
| 30 | `Inco of NDE Summary` | 5 | 84 | 0 | yes |
| 31 | `Man_Power` | 6 | 4,417 | 0 | yes |
| 32 | `PIC_vs_Talisman_2026_02_16` | 13 | 44,950 | 2 | yes |
| 33 | `PWHT Status` | 3 | 34 | 0 | yes |
| 34 | `Project WD+WR` | 266 | 1 | 29 | yes |
| 35 | `Project WD+WR+INCO+Acciona` | 425 | 6,546,261 | 158 | yes |
| 36 | `RT Films Att RT_MI Master Register` | 23 | 177,148 | 5 | yes |
| 37 | `RT Films For PBI WD+WR` | 14 | 186,258 | 0 | yes |
| 38 | `SCDB Data l0_scdb_task` | 74 | 33,526 | 0 | yes |
| 39 | `SCTR OVERALL APPLIED WELDERS` | 17 | 16 | 1 | yes |
| 40 | `Spool Dump` | 106 | 198,647 | 3 | yes |
| 41 | `TALISMAN DATA` | 88 | 3,098,341 | 22 | yes |
| 42 | `TREND RT UT` | 6 | 976 | 0 | yes |
| 43 | `TREND Report` | 8 | 943 | 0 | yes |
| 44 | `Talisman Spool Dump` | 26 | 331,979 | 3 | yes |
| 45 | `Temporary` | 2 | 24 | 0 | yes |
| 46 | `Testpack-wise Details Report` | 48 | 247,528 | 4 | yes |
| 47 | `Trend Active Welders` | 3 | 576 | 0 | yes |
| 48 | `UT TRACKER (CCC)_Talisman` | 25 | 9,419 | 0 | yes |
| 49 | `UT TRACKER (GAC)` | 31 | 155 | 0 | yes |
| 50 | `UT TRACKER (TEK)` | 34 | 10 | 0 | yes |
| 51 | `WEEK #   STATUS` | 9 | 8 | 0 | yes |
| 52 | `WELDERS_Qualification` | 21 | 5,484 | 2 | yes |
| 53 | `WPQ RECORD REGISTER` | 12 | 318 | 0 | yes |
| 54 | `WPQ WELDING PROCESS` | 5 | 266 | 0 | yes |
| 55 | `WPS Reg#` | 26 | 71 | 0 | yes |
| 56 | `WPS Status CUM` | 3 | 127 | 0 | yes |
| 57 | `Weld Dump` | 260 | 958,634 | 26 | yes |
| 58 | `Weld Length` | 3 | 728,550 | 0 | yes |
| 59 | `Welding Progress (Project) Nov 2024 - Nov 2025` | 3 | 116 | 0 | yes |
| 60 | `l2_ndt_list` | 22 | 202 | 4 | yes |
| 61 | `l3_ndt_spo_summary` | 12 | 9,638 | 0 | yes |
| 62 | `l3_ndt_spo_summary (2)` | 10 | 17 | 0 | yes |
| 63 | `t_QOB_Log_SP` | 29 | 16,532 | 0 | yes |

### The fact-table lineage (read out of the M below)

```
Weld Dump                      = Csv.Document("...\\Weld Dump.txt", 226 cols, ";", cp1252)
                                 -> drop Column221, promote headers
                                 -> keep [Area Classification] <> 0 and <> ""
                                 -> keep [Revision Status] = ""
                                 -> add  Spool ID = ISO Number & "-" & Spool No.
                                 -> add  Joint ID = ISO Number & "-" & Spool No. & "-" & Weld No.

Project WD+WR                  = Table.Combine({Weld Dump, CSVExport_Welder Record})
                                 -> keep [Sub-Contractor] <> ""

Project WD+WR+INCO+Acciona     = Table.Combine({Weld Dump, CSVExport_Welder Record,
                                                Acciona_Query, Inco Weld Log})
                                 -> keep [Sub-Contractor] <> ""
```

`CSVExport_Welder Record` is the weld-**repair/reweld** export (WR); `Acciona_Query` and 
`Inco Weld Log` are the two extra subcontractors. So the three scopes are unions of the same 
row shape, which is why the measures repeat three times with the `"EP"` / `"PR"` / `"PR all"` 
suffixes. In Postgres this is one weld table with a `source` discriminator, not three tables.

## Relationships (14)

| from | to | cardinality | cross-filter | active |
|---|---|---|---|---|
| `Weld Dump[Spool ID]` | `Spool Dump[SPOOL ID]` | M:1 | Both | **no (inactive)** |
| `CUM WEEK # Status[Welders Qualification Status Summary Report]` | `WEEK #   STATUS[Welders Qualification Status Summary Report]` | M:1 | Single | yes |
| `Project WD+WR+INCO+Acciona[Joint ID]` | `l2_ndt_list[Joint_ID]` | M:M | Both | yes |
| `UT TRACKER (GAC)[SL]` | `UT TRACKER (TEK)[SL]` | M:1 | Single | yes |
| `CSVExport_Welder Record[WPS No.]` | `WPQ WELDING PROCESS[WPS No.]` | M:1 | Single | yes |
| `PWHT Status[WPS No.]` | `WPQ WELDING PROCESS[WPS No.]` | 1:1 | Both | yes |
| `Flange ovAssets_1619[Joint ID]` | `Flange ovAssets_1381[Joint ID]` | 1:1 | Both | yes |
| `WPQ RECORD REGISTER[S.N]` | `Flg CCC_Flange Repair[SN]` | 1:1 | Both | yes |
| `WPS Reg#[S.N]` | `Flg CCC_Flange Repair[SN]` | 1:1 | Both | yes |
| `WPQ WELDING PROCESS[Sn.]` | `Flg CCC_Flange Repair[SN]` | 1:1 | Both | yes |
| `Flg GAC_Flange Repair[SN]` | `Flg CCC_Flange Repair[SN]` | M:1 | Single | yes |
| `Flg Onepager_data[SN]` | `Flg TFN_Flange Repair[SN]` | M:1 | Single | yes |
| `Flange Progress[Index]` | `Project WD+WR+INCO+Acciona[Index]` | 1:1 | Both | **no (inactive)** |
| `TALISMAN DATA[Index]` | `Project WD+WR+INCO+Acciona[Index]` | 1:1 | Both | yes |

Note how thin this is for a 62-table model: most tables are **not** joined at all — the report 
mostly puts a whole flat table behind a page and filters it, rather than star-joining. 
The two big fact tables (`Weld Dump`, `Project WD+WR+INCO+Acciona`) each stand alone except for 
the relationships listed above.

## Columns by table (real tables only)

Type is the model data type (`tmschema_columns.DataType`); `Type` 2 = calculated column, 
1 = imported column, 3 = row-number system column.

### `Acciona Joint Summary` — 10 columns, 29 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Material` | String | imported | `nan` |  |
| `Size ("Ø)` | String | imported | `nan` |  |
| `No. of Joints Welded ` | Double | imported | `0` |  |
| `Ferrite Test Completed` | Int64 | imported | `0` |  |
| `PMI Completed` | Int64 | imported | `0` |  |
| `PT Completed` | String | imported | `nan` |  |
| `RT Completed` | Int64 | imported | `0` |  |
| `Threaded Joints` | Int64 | imported | `nan` |  |
| `Total No. of Joints` | Int64 | imported | `0` |  |
| `Total Welding ("Ø)` | Double | imported | `nan` |  |

### `Acciona_Query` — 187 columns, 13,313 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `ISO Number` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Iso Rev No.` | String | imported | `nan` |  |
| `Weld No.` | String | imported | `nan` |  |
| `Dia inch` | Double | imported | `nan` |  |
| `Thickness` | Double | imported | `nan` |  |
| `Material Type` | String | imported | `nan` |  |
| `Part 1` | String | imported | `nan` |  |
| `Part 2` | String | imported | `nan` |  |
| `WPS No.` | String | imported | `nan` |  |
| `Weld Type` | String | imported | `nan` |  |
| `Welder` | String | imported | `nan` |  |
| `DWIR No.` | String | imported | `nan` |  |
| `Weld Cat` | String | imported | `nan` |  |
| `PMI Report` | String | imported | `nan` |  |
| `PMI Date` | DateTime | imported | `dd-mmm-yy` |  |
| `PMI Acc/Rej` | String | imported | `nan` |  |
| `PT Report` | String | imported | `nan` |  |
| `PT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `PT Acc/Rej` | String | imported | `nan` |  |
| `RT Report` | String | imported | `nan` |  |
| `RT Acc/Rej` | String | imported | `nan` |  |
| `RT Film Total` | Double | imported | `0` |  |
| `Total No of films Acc` | Double | imported | `0` |  |
| `RT%` | Int64 | imported | `nan` |  |
| `RT Remarks` | String | imported | `nan` |  |
| `Fitup Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Weld Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `Spool Rev No.` | String | imported | `nan` |  |
| `RT Re-Shoot Rep` | String | imported | `nan` |  |
| `RT Re-Shoot Data` | DateTime | imported | `Long Date` |  |
| `Dia Inch Factor` | String | imported | `nan` |  |
| `PDS Area` | String | imported | `nan` |  |
| `AG/UG/PKG` | String | imported | `nan` |  |
| `Area Classification` | String | imported | `nan` |  |
| `wbu` | String | imported | `nan` |  |
| `System no` | String | imported | `nan` |  |
| `Service class` | String | imported | `nan` |  |
| `Service Cat` | String | imported | `nan` |  |
| `MIR No` | String | imported | `nan` |  |
| `MIR Date` | DateTime | imported | `Long Date` |  |
| `Cutting Date` | DateTime | imported | `Long Date` |  |
| `Beveling Date` | DateTime | imported | `Long Date` |  |
| `Preheat Date` | DateTime | imported | `Long Date` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Rework Code` | String | imported | `nan` |  |
| `Original Joint` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `Weld Point Code` | String | imported | `nan` |  |
| `WeldPoint No.` | String | imported | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `PWHT Y/N` | String | imported | `nan` |  |
| `PWHT Weld Status` | String | imported | `nan` |  |
| `PWHT Selected Date` | DateTime | imported | `Long Date` |  |
| `PWHT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PWHT Date` | DateTime | imported | `Long Date` |  |
| `PWHT Report` | String | imported | `nan` |  |
| `PWHT Acc/Rej` | String | imported | `nan` |  |
| `PWHT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PWHT Remarks` | String | imported | `nan` |  |
| `HT%` | String | imported | `nan` |  |
| `HT Batch No` | String | imported | `nan` |  |
| `HT Batch Status` | String | imported | `nan` |  |
| `HT Weld Status` | String | imported | `nan` |  |
| `HT Selected Date` | DateTime | imported | `Long Date` |  |
| `HT Exam Req date` | DateTime | imported | `Long Date` |  |
| `HT Date` | DateTime | imported | `Long Date` |  |
| `HT Report` | String | imported | `nan` |  |
| `HT Acc/Rej` | String | imported | `nan` |  |
| `HT Client Exam Req Y/N` | String | imported | `nan` |  |
| `HT Remarks` | String | imported | `nan` |  |
| `RT Batch No` | String | imported | `nan` |  |
| `RT Batch Status` | String | imported | `nan` |  |
| `RT Weld Status` | String | imported | `nan` |  |
| `RT Selected Date` | DateTime | imported | `Long Date` |  |
| `RT Exam Req date` | DateTime | imported | `Long Date` |  |
| `RT Xray No` | String | imported | `nan` |  |
| `Defect Code` | String | imported | `nan` |  |
| `Location of Defect` | String | imported | `nan` |  |
| `RT Re-Shoot Status` | String | imported | `nan` |  |
| `RT Re-Shoot Reason` | String | imported | `nan` |  |
| `RT Re-Shoot Films` | String | imported | `nan` |  |
| `Weld Length` | Double | imported | `nan` |  |
| `Rej Length` | Double | imported | `nan` |  |
| `RT Client Exam Req Y/N` | String | imported | `nan` |  |
| `By UT` | String | imported | `nan` |  |
| `UT%` | String | imported | `nan` |  |
| `UT Batch No` | String | imported | `nan` |  |
| `UT Batch Status` | String | imported | `nan` |  |
| `UT Weld Status` | String | imported | `nan` |  |
| `UT Selected Date` | DateTime | imported | `Long Date` |  |
| `UT Exam Req date` | DateTime | imported | `Long Date` |  |
| `UT Date` | DateTime | imported | `Long Date` |  |
| `UT Report` | String | imported | `nan` |  |
| `UT Acc/Rej` | String | imported | `nan` |  |
| `UT Client Exam Req Y/N` | String | imported | `nan` |  |
| `UT Remarks` | String | imported | `nan` |  |
| `MT%` | String | imported | `nan` |  |
| `MT Batch No` | String | imported | `nan` |  |
| `MT Batch Status` | String | imported | `nan` |  |
| `MT Weld Status` | String | imported | `nan` |  |
| `MT Selected Date` | DateTime | imported | `Long Date` |  |
| `MT Exam Req date` | DateTime | imported | `Long Date` |  |
| `MT Date` | DateTime | imported | `Long Date` |  |
| `MT Report` | String | imported | `nan` |  |
| `MT Acc/Rej` | String | imported | `nan` |  |
| `MT Client Exam Req Y/N` | String | imported | `nan` |  |
| `MT Remarks` | String | imported | `nan` |  |
| `PMI%` | String | imported | `nan` |  |
| `PMI Batch No` | String | imported | `nan` |  |
| `PMI Batch Status` | String | imported | `nan` |  |
| `PMI Weld Status` | String | imported | `nan` |  |
| `PMI Selected Date` | DateTime | imported | `Long Date` |  |
| `PMI Exam Req date` | DateTime | imported | `Long Date` |  |
| `PMI Client Exam Req Y/N` | String | imported | `nan` |  |
| `PMI Remarks` | String | imported | `nan` |  |
| `PT%` | String | imported | `nan` |  |
| `PT Batch No` | String | imported | `nan` |  |
| `PT Batch Status` | String | imported | `nan` |  |
| `PT Weld Status` | String | imported | `nan` |  |
| `PT Selected Date` | DateTime | imported | `Long Date` |  |
| `PT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PT Remarks` | String | imported | `nan` |  |
| `FN%` | String | imported | `nan` |  |
| `FN Batch No` | String | imported | `nan` |  |
| `FN Batch Status` | String | imported | `nan` |  |
| `FN Weld Status` | String | imported | `nan` |  |
| `FN Selected Date` | DateTime | imported | `Long Date` |  |
| `FN Exam Req date` | DateTime | imported | `Long Date` |  |
| `FN Date` | DateTime | imported | `Long Date` |  |
| `FN Report` | String | imported | `nan` |  |
| `FN Acc/Rej` | String | imported | `nan` |  |
| `FN Client Exam Req Y/N` | String | imported | `nan` |  |
| `FN Remarks` | String | imported | `nan` |  |
| `PADLT Y/N` | String | imported | `nan` |  |
| `PADLT Weld Status` | String | imported | `nan` |  |
| `PADLT Selected Date` | DateTime | imported | `Long Date` |  |
| `PADLT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PADLT Date` | DateTime | imported | `Long Date` |  |
| `PADLT Report` | String | imported | `nan` |  |
| `PADLT Acc/Rej` | String | imported | `nan` |  |
| `PADLT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PADLT Remarks` | String | imported | `nan` |  |
| `ORIF Y/N` | String | imported | `nan` |  |
| `ORIF Weld Status` | String | imported | `nan` |  |
| `ORIF Selected Date` | DateTime | imported | `Long Date` |  |
| `ORIF Exam Req date` | DateTime | imported | `Long Date` |  |
| `ORIF Date` | DateTime | imported | `Long Date` |  |
| `ORIF Report` | String | imported | `nan` |  |
| `ORIF Acc/Rej` | String | imported | `nan` |  |
| `ORIF Client Exam Req Y/N` | String | imported | `nan` |  |
| `Matrl Traceability Y/N` | String | imported | `nan` |  |
| `GROUP-1` | String | imported | `nan` |  |
| `IDENT CODE-1` | String | imported | `nan` |  |
| `TRAC NO-1` | String | imported | `nan` |  |
| `GROUP-2` | String | imported | `nan` |  |
| `IDENT CODE-2` | String | imported | `nan` |  |
| `TRAC NO-2` | String | imported | `nan` |  |
| `Revision Status` | String | imported | `nan` |  |
| `Revision Comments` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `Piping Group` | String | imported | `nan` |  |
| `Golden Weld Report Date` | DateTime | imported | `Long Date` |  |
| `Golden Weld Report No` | String | imported | `nan` |  |
| `Joint ID` | String | imported | `nan` |  |
| `Spool ID` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `Custom3` | String | imported | `nan` |  |
| `Custom4` | String | imported | `nan` |  |
| `Custom5` | String | imported | `nan` |  |
| `Custom6` | String | imported | `nan` |  |
| `Custom7` | String | imported | `nan` |  |
| `Custom8` | String | imported | `nan` |  |
| `Custom9` | String | imported | `nan` |  |
| `Custom10` | String | imported | `nan` |  |
| `Custom11` | String | imported | `nan` |  |
| `Custom12` | String | imported | `nan` |  |
| `Custom13` | String | imported | `nan` |  |
| `Subsystem Code` | String | imported | `nan` |  |
| `PED` | String | imported | `nan` |  |
| `RT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Total No of films Rej` | Double | imported | `0.00` |  |
| `Custom14` | String | imported | `nan` |  |
| `Testpack No` | String | imported | `nan` |  |

### `AllTrain_CSVExport_Joint Record` — 146 columns, 1,560,273 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Del Flag` | String | imported | `nan` |  |
| `Weld Point First` | String | imported | `nan` |  |
| `Original Joint` | String | imported | `nan` |  |
| `Latest Joint` | String | imported | `nan` |  |
| `Project No` | Int64 | imported | `0` |  |
| `Sub-Con Code` | String | imported | `nan` |  |
| `Area Code` | String | imported | `nan` |  |
| `Area Group-1` | String | imported | `nan` |  |
| `Area Group-2` | String | imported | `nan` |  |
| `Area Group-3` | String | imported | `nan` |  |
| `Area Group-4` | String | imported | `nan` |  |
| `Area Group-5` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `Rework Code` | String | imported | `nan` |  |
| `Rework Code2` | String | imported | `nan` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `Service Class` | String | imported | `nan` |  |
| `Pressure Level` | String | imported | `nan` |  |
| `Size-2` | Double | imported | `nan` |  |
| `Size Range` | String | imported | `nan` |  |
| `Dia-Inch` | Double | imported | `nan` |  |
| `Wall Thickness` | Double | imported | `nan` |  |
| `Material Category` | String | imported | `nan` |  |
| `Material Spec` | String | imported | `nan` |  |
| `Pipe Schedule` | String | imported | `nan` |  |
| `Design Code` | String | imported | `nan` |  |
| `Work Category` | String | imported | `nan` |  |
| `Original Work Category` | String | imported | `nan` |  |
| `Weld Type` | String | imported | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `Remarks` | String | imported | `nan` |  |
| `Weld Date` | DateTime | imported | `Long Date` |  |
| `Weld Week` | String | imported | `nan` |  |
| `Weld Month` | String | imported | `nan` |  |
| `Welder(Root)` | String | imported | `nan` |  |
| `Welder(Heat)` | String | imported | `nan` |  |
| `Welder(Fill)` | String | imported | `nan` |  |
| `Welder(Cap)` | String | imported | `nan` |  |
| `EP Date` | String | imported | `nan` |  |
| `EP Judge` | String | imported | `nan` |  |
| `EP Identifier Date` | String | imported | `nan` |  |
| `EP Identifier Client` | String | imported | `nan` |  |
| `EP Identifier Chiyoda` | String | imported | `nan` |  |
| `VI Date` | String | imported | `nan` |  |
| `VI Judge` | String | imported | `nan` |  |
| `VI Identifier Client` | String | imported | `nan` |  |
| `VI Identifier Chiyoda` | String | imported | `nan` |  |
| `WT Measurement Data` | String | imported | `nan` |  |
| `WT Date` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `RT Film Total` | Int64 | imported | `0` |  |
| `RT/UT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `RT/UT(%)` | Int64 | imported | `0` |  |
| `RT/UT Request Date` | String | imported | `nan` |  |
| `RT/UT Result` | String | imported | `nan` |  |
| `Reshoot-1 RT Film Total` | String | imported | `nan` |  |
| `Reshoot-1 RT/UT Date` | DateTime | imported | `Long Date` |  |
| `Reshoot-1 RT/UT Result` | String | imported | `nan` |  |
| `Reshoot-2 RT Film Total` | String | imported | `nan` |  |
| `Reshoot-2 RT/UT Date` | DateTime | imported | `Long Date` |  |
| `Reshoot-2 RT/UT Result` | String | imported | `nan` |  |
| `Reshoot-3 RT Film Total` | String | imported | `nan` |  |
| `Reshoot-3 RT/UT Date` | DateTime | imported | `Long Date` |  |
| `Reshoot-3 RT/UT Result` | String | imported | `nan` |  |
| `Reshoot RT/UT Total` | String | imported | `nan` |  |
| `Reshoot RT/UT Film Total` | String | imported | `nan` |  |
| `Last Reshoot Date (RT/UT)` | String | imported | `nan` |  |
| `Last Reshoot Report No (RT/UT)` | String | imported | `nan` |  |
| `Last Reshoot Result (RT/UT)` | String | imported | `nan` |  |
| `RT2/UT2` | String | imported | `nan` |  |
| `RT2 Film Total` | String | imported | `nan` |  |
| `RT2/UT2 Date` | String | imported | `nan` |  |
| `RT2/UT2(%)` | Int64 | imported | `0` |  |
| `RT2/UT2 Request Date` | String | imported | `nan` |  |
| `RT2/UT2 Result` | String | imported | `nan` |  |
| `Reshoot-1 RT2 Film Total` | String | imported | `nan` |  |
| `Reshoot-1 RT2/UT2 Date` | String | imported | `nan` |  |
| `Reshoot-1 RT2/UT2 Result` | String | imported | `nan` |  |
| `Reshoot-2 RT2 Film Total` | String | imported | `nan` |  |
| `Reshoot-2 RT2/UT2 Date` | String | imported | `nan` |  |
| `Reshoot-2 RT2/UT2 Result` | String | imported | `nan` |  |
| `Reshoot-3 RT2 Film Total` | String | imported | `nan` |  |
| `Reshoot-3 RT2/UT2 Date` | String | imported | `nan` |  |
| `Reshoot-3 RT2/UT2 Result` | String | imported | `nan` |  |
| `Reshoot RT2/UT2 Total` | String | imported | `nan` |  |
| `Reshoot RT2/UT2 Film Total` | String | imported | `nan` |  |
| `Last Reshoot Date (RT2/UT2)` | String | imported | `nan` |  |
| `Last Reshoot Report No (RT2/UT2)` | String | imported | `nan` |  |
| `Last Reshoot Result (RT2/UT2)` | String | imported | `nan` |  |
| `PT Root Date` | DateTime | imported | `Long Date` |  |
| `PT Root(%)` | Int64 | imported | `0` |  |
| `PT Root Request Date` | String | imported | `nan` |  |
| `PT Cap Date` | DateTime | imported | `Long Date` |  |
| `PT Cap(%)` | Int64 | imported | `0` |  |
| `PT Cap Request Date` | String | imported | `nan` |  |
| `MT Root Date` | DateTime | imported | `Long Date` |  |
| `MT Root(%)` | Int64 | imported | `0` |  |
| `MT Root Request Date` | DateTime | imported | `Long Date` |  |
| `MT Cap Date` | DateTime | imported | `Long Date` |  |
| `MT Cap(%)` | Int64 | imported | `0` |  |
| `MT Cap Request Date` | DateTime | imported | `Long Date` |  |
| `PWHT Date` | DateTime | imported | `d mmmm\, yyyy` |  |
| `PWHT` | String | imported | `nan` |  |
| `PWHT Request Date` | DateTime | imported | `Long Date` |  |
| `HT Date` | DateTime | imported | `Long Date` |  |
| `HT(%)` | Int64 | imported | `0` |  |
| `HT Request Date` | DateTime | imported | `Long Date` |  |
| `PMI Date` | DateTime | imported | `Long Date` |  |
| `PMI(%)` | Int64 | imported | `0` |  |
| `PMI Request Date` | DateTime | imported | `Long Date` |  |
| `PMI Up Date` | DateTime | imported | `Long Date` |  |
| `PMI Down Date` | DateTime | imported | `Long Date` |  |
| `FT Date` | DateTime | imported | `Long Date` |  |
| `FT(%)` | Int64 | imported | `0` |  |
| `FT Request Date` | DateTime | imported | `Long Date` |  |
| `Spool ID "JR" Table` | String | imported | `nan` |  |
| `Joint ID "JR"` | 1 | calculated | `nan` |  |
| `Joint ID` | String | imported | `nan` |  |
| `QC ISO DWG No` | String | imported | `nan` |  |
| `Sheet No` | Int64 | imported | `0` |  |
| `Joint No` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Revision No` | String | imported | `nan` |  |
| `Rework Ref Doc No` | String | imported | `nan` |  |
| `P No` | Int64 | imported | `0` |  |
| `Test Package No` | String | imported | `nan` |  |
| `Sub-System No` | String | imported | `nan` |  |
| `Weld Report No` | String | imported | `nan` |  |
| `RT/UT Report No` | String | imported | `nan` |  |
| `Reshoot-1 RT/UT Report No` | String | imported | `nan` |  |
| `Reshoot-2 RT/UT Report No` | String | imported | `nan` |  |
| `Reshoot-3 RT/UT Report No` | String | imported | `nan` |  |
| `RT2/UT2 Report No` | String | imported | `nan` |  |
| `Reshoot-1 RT2/UT2 Report No` | String | imported | `nan` |  |
| `Reshoot-2 RT2/UT2 Report No` | String | imported | `nan` |  |
| `Reshoot-3 RT2/UT2 Report No` | String | imported | `nan` |  |
| `PT Root Report No` | String | imported | `nan` |  |
| `PT Cap Report No` | String | imported | `nan` |  |
| `MT Root Report No` | String | imported | `nan` |  |
| `MT Cap Report No` | String | imported | `nan` |  |
| `PWHT Report No` | String | imported | `nan` |  |
| `HT Report No` | String | imported | `nan` |  |
| `PMI Report No` | String | imported | `nan` |  |
| `PMI Up Report No` | String | imported | `nan` |  |
| `PMI Down Report No` | String | imported | `nan` |  |
| `FT Report No` | String | imported | `nan` |  |

### `AllTrain_CSVExport_Joint Record NOT WELDED` — 186 columns, 130,994 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `Spool ID` | String | imported | `nan` |  |
| `Spool Rev No.` | String | imported | `nan` |  |
| `Weld Cat` | String | imported | `nan` |  |
| `Weld Type` | String | imported | `nan` |  |
| `Dia Inch Factor` | String | imported | `nan` |  |
| `Dia inch` | Double | imported | `nan` |  |
| `Thickness` | Double | imported | `nan` |  |
| `PDS Area` | String | imported | `nan` |  |
| `AG/UG/PKG` | String | imported | `nan` |  |
| `Area Classification` | String | imported | `nan` |  |
| `wbu` | String | imported | `nan` |  |
| `System no` | String | imported | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `Service class` | String | imported | `nan` |  |
| `Service Cat` | String | imported | `nan` |  |
| `Material Type` | String | imported | `nan` |  |
| `MIR No` | String | imported | `nan` |  |
| `MIR Date` | DateTime | imported | `Long Date` |  |
| `Cutting Date` | DateTime | imported | `Long Date` |  |
| `Beveling Date` | DateTime | imported | `Long Date` |  |
| `Fitup Date` | DateTime | imported | `Long Date` |  |
| `Preheat Date` | DateTime | imported | `Long Date` |  |
| `Weld Date` | DateTime | imported | `Long Date` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Rework Code` | String | imported | `nan` |  |
| `Original Joint` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `Weld Point Code` | String | imported | `nan` |  |
| `WPS No.` | String | imported | `nan` |  |
| `Welder` | String | imported | `nan` |  |
| `PWHT Y/N` | String | imported | `nan` |  |
| `PWHT Weld Status` | String | imported | `nan` |  |
| `PWHT Selected Date` | DateTime | imported | `Long Date` |  |
| `PWHT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PWHT Date` | DateTime | imported | `Long Date` |  |
| `PWHT Acc/Rej` | String | imported | `nan` |  |
| `PWHT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PWHT Remarks` | String | imported | `nan` |  |
| `HT%` | Int64 | imported | `0` |  |
| `HT Batch No` | String | imported | `nan` |  |
| `HT Batch Status` | String | imported | `nan` |  |
| `HT Weld Status` | String | imported | `nan` |  |
| `HT Selected Date` | DateTime | imported | `Long Date` |  |
| `HT Exam Req date` | DateTime | imported | `Long Date` |  |
| `HT Date` | DateTime | imported | `Long Date` |  |
| `HT Acc/Rej` | String | imported | `nan` |  |
| `HT Client Exam Req Y/N` | String | imported | `nan` |  |
| `HT Remarks` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `RT%` | Int64 | imported | `0` |  |
| `RT Batch No` | String | imported | `nan` |  |
| `RT Batch Status` | String | imported | `nan` |  |
| `RT Weld Status` | String | imported | `nan` |  |
| `RT Selected Date` | DateTime | imported | `Long Date` |  |
| `RT Exam Req date` | DateTime | imported | `Long Date` |  |
| `RT Date` | DateTime | imported | `Long Date` |  |
| `RT Xray No` | String | imported | `nan` |  |
| `RT Acc/Rej` | String | imported | `nan` |  |
| `RT Film Total` | Int64 | imported | `0` |  |
| `Total No of films Acc` | Double | imported | `nan` |  |
| `Total No of films Rej` | Double | imported | `nan` |  |
| `Defect Code` | String | imported | `nan` |  |
| `Location of Defect` | String | imported | `nan` |  |
| `RT Re-Shoot Rep` | String | imported | `nan` |  |
| `RT Re-Shoot Data` | DateTime | imported | `Long Date` |  |
| `RT Re-Shoot Status` | String | imported | `nan` |  |
| `RT Re-Shoot Reason` | String | imported | `nan` |  |
| `RT Re-Shoot Films` | String | imported | `nan` |  |
| `Weld Length` | Double | imported | `nan` |  |
| `Rej Length` | Double | imported | `nan` |  |
| `RT Client Exam Req Y/N` | String | imported | `nan` |  |
| `By UT` | String | imported | `nan` |  |
| `RT Remarks` | String | imported | `nan` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `UT%` | Int64 | imported | `0` |  |
| `UT Batch No` | String | imported | `nan` |  |
| `UT Batch Status` | String | imported | `nan` |  |
| `UT Weld Status` | String | imported | `nan` |  |
| `UT Selected Date` | DateTime | imported | `Long Date` |  |
| `UT Exam Req date` | DateTime | imported | `Long Date` |  |
| `UT Date` | DateTime | imported | `Long Date` |  |
| `UT Report` | String | imported | `nan` |  |
| `UT Acc/Rej` | String | imported | `nan` |  |
| `UT Client Exam Req Y/N` | String | imported | `nan` |  |
| `UT Remarks` | String | imported | `nan` |  |
| `MT%` | Int64 | imported | `0` |  |
| `MT Batch No` | String | imported | `nan` |  |
| `MT Batch Status` | String | imported | `nan` |  |
| `MT Weld Status` | String | imported | `nan` |  |
| `MT Selected Date` | DateTime | imported | `Long Date` |  |
| `MT Exam Req date` | DateTime | imported | `Long Date` |  |
| `MT Date` | DateTime | imported | `Long Date` |  |
| `MT Acc/Rej` | String | imported | `nan` |  |
| `MT Client Exam Req Y/N` | String | imported | `nan` |  |
| `MT Remarks` | String | imported | `nan` |  |
| `PMI%` | Int64 | imported | `0` |  |
| `PMI Batch No` | String | imported | `nan` |  |
| `PMI Batch Status` | String | imported | `nan` |  |
| `PMI Weld Status` | String | imported | `nan` |  |
| `PMI Selected Date` | DateTime | imported | `Long Date` |  |
| `PMI Exam Req date` | DateTime | imported | `Long Date` |  |
| `PMI Date` | DateTime | imported | `Long Date` |  |
| `PMI Acc/Rej` | String | imported | `nan` |  |
| `PMI Client Exam Req Y/N` | String | imported | `nan` |  |
| `PMI Remarks` | String | imported | `nan` |  |
| `PT%` | Int64 | imported | `0` |  |
| `PT Batch No` | String | imported | `nan` |  |
| `PT Batch Status` | String | imported | `nan` |  |
| `PT Weld Status` | String | imported | `nan` |  |
| `PT Selected Date` | DateTime | imported | `Long Date` |  |
| `PT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PT Date` | DateTime | imported | `Long Date` |  |
| `PT Acc/Rej` | String | imported | `nan` |  |
| `PT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PT Remarks` | String | imported | `nan` |  |
| `FN%` | Int64 | imported | `0` |  |
| `FN Batch No` | String | imported | `nan` |  |
| `FN Batch Status` | String | imported | `nan` |  |
| `FN Weld Status` | String | imported | `nan` |  |
| `FN Selected Date` | DateTime | imported | `Long Date` |  |
| `FN Exam Req date` | DateTime | imported | `Long Date` |  |
| `FN Date` | DateTime | imported | `Long Date` |  |
| `FN Acc/Rej` | String | imported | `nan` |  |
| `FN Client Exam Req Y/N` | String | imported | `nan` |  |
| `FN Remarks` | String | imported | `nan` |  |
| `PADLT Y/N` | String | imported | `nan` |  |
| `PADLT Weld Status` | String | imported | `nan` |  |
| `PADLT Selected Date` | DateTime | imported | `Long Date` |  |
| `PADLT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PADLT Date` | DateTime | imported | `Long Date` |  |
| `PADLT Report` | String | imported | `nan` |  |
| `PADLT Acc/Rej` | String | imported | `nan` |  |
| `PADLT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PADLT Remarks` | String | imported | `nan` |  |
| `ORIF Y/N` | String | imported | `nan` |  |
| `ORIF Weld Status` | String | imported | `nan` |  |
| `ORIF Selected Date` | DateTime | imported | `Long Date` |  |
| `ORIF Exam Req date` | DateTime | imported | `Long Date` |  |
| `ORIF Date` | DateTime | imported | `Long Date` |  |
| `ORIF Report` | String | imported | `nan` |  |
| `ORIF Acc/Rej` | String | imported | `nan` |  |
| `ORIF Client Exam Req Y/N` | String | imported | `nan` |  |
| `Matrl Traceability Y/N` | String | imported | `nan` |  |
| `GROUP-1` | String | imported | `nan` |  |
| `IDENT CODE-1` | String | imported | `nan` |  |
| `TRAC NO-1` | String | imported | `nan` |  |
| `GROUP-2` | String | imported | `nan` |  |
| `IDENT CODE-2` | String | imported | `nan` |  |
| `TRAC NO-2` | String | imported | `nan` |  |
| `Revision Status` | String | imported | `nan` |  |
| `Revision Comments` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `Piping Group` | String | imported | `nan` |  |
| `Golden Weld Report Date` | String | imported | `nan` |  |
| `Golden Weld Report No` | String | imported | `nan` |  |
| `Custom3` | String | imported | `nan` |  |
| `Custom4` | String | imported | `nan` |  |
| `Custom5` | String | imported | `nan` |  |
| `Custom6` | String | imported | `nan` |  |
| `Custom7` | String | imported | `nan` |  |
| `Custom8` | String | imported | `nan` |  |
| `Custom9` | String | imported | `nan` |  |
| `Custom10` | String | imported | `nan` |  |
| `Custom11` | String | imported | `nan` |  |
| `Custom12` | String | imported | `nan` |  |
| `Custom13` | String | imported | `nan` |  |
| `Custom14` | String | imported | `nan` |  |
| `PED` | String | imported | `nan` |  |
| `Weld Point First` | String | imported | `nan` |  |
| `ISO Number` | String | imported | `nan` |  |
| `Iso Rev No.` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Weld No.` | String | imported | `nan` |  |
| `Testpack No` | String | imported | `nan` |  |
| `DWIR No.` | String | imported | `nan` |  |
| `WeldPoint No.` | Int64 | imported | `0` |  |
| `PWHT Report` | String | imported | `nan` |  |
| `HT Report` | String | imported | `nan` |  |
| `RT Report` | String | imported | `nan` |  |
| `MT Report` | String | imported | `nan` |  |
| `PT Report` | String | imported | `nan` |  |
| `PMI Report` | String | imported | `nan` |  |
| `FT Report` | String | imported | `nan` |  |
| `Subsystem Code` | String | imported | `nan` |  |

### `Bracing FE_Analysis` — 58 columns, 1 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Project ID` | String | imported | `nan` |  |
| `MTO Stage` | String | imported | `nan` |  |
| `CWA` | String | imported | `nan` |  |
| `AREA` | String | imported | `nan` |  |
| `Line No` | String | imported | `nan` |  |
| `Line No(Plant Item)` | String | imported | `nan` |  |
| `Testpack` | String | imported | `nan` |  |
| `Test  Date` | String | imported | `nan` |  |
| `Isometric Number` | String | imported | `nan` |  |
| `ISO/SPOOL` | String | imported | `nan` |  |
| `L_DWG_REVNO` | String | imported | `nan` |  |
| `Issue Status` | String | imported | `nan` |  |
| `Issue Status (Highest Flag)` | String | imported | `nan` |  |
| `BOM Pos` | Int64 | imported | `0` |  |
| `FROM_POS` | String | imported | `nan` |  |
| `HOLD_STATUS` | String | imported | `nan` |  |
| `SPEC_CODE_REF` | String | imported | `nan` |  |
| `Field Discipline Code` | String | imported | `nan` |  |
| `Part Name` | String | imported | `nan` |  |
| `SHORT_CODE_REF` | String | imported | `nan` |  |
| `LOCATION` | String | imported | `nan` |  |
| `CWP` | String | imported | `nan` |  |
| `Size-1` | Int64 | imported | `0` |  |
| `Size-2` | Double | imported | `nan` |  |
| `Size-3` | String | imported | `nan` |  |
| `Size-4` | String | imported | `nan` |  |
| `Size-5` | String | imported | `nan` |  |
| `Sch-1` | String | imported | `nan` |  |
| `Sch-2` | String | imported | `nan` |  |
| `Actual Thickness-1` | Int64 | imported | `0` |  |
| `Actual Thickness-2` | Int64 | imported | `0` |  |
| `Size Group` | Int64 | imported | `0` |  |
| `Quantity` | Int64 | imported | `0` |  |
| `Issued Quantity` | Int64 | imported | `0` |  |
| `Unit Code` | String | imported | `nan` |  |
| `Ident Code or Company Ident Code` | String | imported | `nan` |  |
| `Tag Number` | String | imported | `nan` |  |
| `Commodity Code` | String | imported | `nan` |  |
| `Part Division` | String | imported | `nan` |  |
| `Main Material for W.V. Suumary` | String | imported | `nan` |  |
| `Meterial Division` | String | imported | `nan` |  |
| `LS01P02 MAIN-MATL (Short Desc)` | String | imported | `nan` |  |
| `LS01P09 AUTH-CODE (Short Desc)` | String | imported | `nan` |  |
| `LS01P03 RATING (Short Desc)` | String | imported | `nan` |  |
| `LS01P06A CONNECTION-A (Short Desc)` | String | imported | `nan` |  |
| `LS01P06B CONNECTION-B (Short Desc)` | String | imported | `nan` |  |
| `Ident Description (According to Parameter ZCH_X_DESC)` | String | imported | `nan` |  |
| `GUID(LP_ID)` | Int64 | imported | `0` |  |
| `BOM Comment` | String | imported | `nan` |  |
| `Last Date` | DateTime | imported | `Long Date` |  |
| `Two phase with Vibration` | String | imported | `nan` |  |
| `FIV` | String | imported | `nan` |  |
| `AIV` | String | imported | `nan` |  |
| `900# above` | String | imported | `nan` |  |
| `PRV` | String | imported | `nan` |  |
| `Rotating and reciprocating` | String | imported | `nan` |  |
| `Refer here for Bracing requirement` | String | imported | `nan` |  |
| `Subcontractor` | String | imported | `nan` |  |

### `CSVExport_Welder Record` — 91 columns, 5,433,009 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Original Joint` | String | imported | `nan` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Welder` | String | imported | `nan` |  |
| `Weld Date` | DateTime | imported | `dd-mmm-yy` |  |
| `PDS Area` | String | imported | `nan` |  |
| `Area Classification` | String | imported | `nan` |  |
| `AG/UG/PKG` | String | imported | `nan` |  |
| `ISO Number` | String | imported | `nan` |  |
| `Weld No.` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Service class` | String | imported | `nan` |  |
| `Thickness` | Double | imported | `nan` |  |
| `Dia inch` | Double | imported | `nan` |  |
| `Material Type` | String | imported | `nan` |  |
| `Weld Cat` | String | imported | `nan` |  |
| `Weld Type` | String | imported | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `Weld Point Code` | String | imported | `nan` |  |
| `WeldPoint No.` | Int64 | imported | `0` |  |
| `WPS No.` | String | imported | `nan` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `RT Report` | String | imported | `nan` |  |
| `RT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `RT Film Total` | Double | imported | `nan` |  |
| `Total No of films Rej` | Double | imported | `0.00` |  |
| `RT Acc/Rej` | String | imported | `nan` |  |
| `RT%` | Int64 | imported | `0` |  |
| `RT Selected Date` | DateTime | imported | `Long Date` |  |
| `Defect Code` | String | imported | `nan` |  |
| `Location of Defect` | String | imported | `nan` |  |
| `RT Re-Shoot Rep` | String | imported | `nan` |  |
| `RT Re-Shoot Data` | DateTime | imported | `Long Date` |  |
| `RT Re-Shoot Films` | Int64 | imported | `0` |  |
| `Iso Rev No.` | String | imported | `nan` |  |
| `Spool Rev No.` | String | imported | `nan` |  |
| `Dia Inch Factor` | String | imported | `nan` |  |
| `wbu` | String | imported | `nan` |  |
| `System no` | String | imported | `nan` |  |
| `Testpack No` | String | imported | `nan` |  |
| `Service Cat` | String | imported | `nan` |  |
| `MIR No` | String | imported | `nan` |  |
| `MIR Date` | DateTime | imported | `Long Date` |  |
| `Cutting Date` | DateTime | imported | `Long Date` |  |
| `Beveling Date` | DateTime | imported | `Long Date` |  |
| `Fitup Date` | DateTime | imported | `Long Date` |  |
| `Preheat Date` | DateTime | imported | `Long Date` |  |
| `DWIR No.` | String | imported | `nan` |  |
| `Total No of films Acc` | Double | imported | `0.00` |  |
| `PWHT Y/N` | String | imported | `nan` |  |
| `PWHT Weld Status` | String | imported | `nan` |  |
| `PWHT Selected Date` | DateTime | imported | `Long Date` |  |
| `PWHT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PWHT Date` | DateTime | imported | `Long Date` |  |
| `PWHT Report` | String | imported | `nan` |  |
| `PWHT Acc/Rej` | String | imported | `nan` |  |
| `PWHT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PWHT Remarks` | String | imported | `nan` |  |
| `HT%` | Int64 | imported | `0` |  |
| `HT Batch No` | String | imported | `nan` |  |
| `HT Batch Status` | String | imported | `nan` |  |
| `HT Weld Status` | String | imported | `nan` |  |
| `HT Selected Date` | DateTime | imported | `Long Date` |  |
| `HT Exam Req date` | DateTime | imported | `Long Date` |  |
| `HT Date` | DateTime | imported | `Long Date` |  |
| `HT Report` | String | imported | `nan` |  |
| `HT Acc/Rej` | String | imported | `nan` |  |
| `HT Client Exam Req Y/N` | String | imported | `nan` |  |
| `HT Remarks` | String | imported | `nan` |  |
| `RT Batch No` | String | imported | `nan` |  |
| `RT Batch Status` | String | imported | `nan` |  |
| `RT Weld Status` | String | imported | `nan` |  |
| `RT Exam Req date` | DateTime | imported | `Long Date` |  |
| `RT Xray No` | String | imported | `nan` |  |
| `RT Re-Shoot Status` | String | imported | `nan` |  |
| `RT Re-Shoot Reason` | String | imported | `nan` |  |
| `Weld Length` | Double | imported | `nan` |  |
| `Rej Length` | Int64 | imported | `0` |  |
| `RT Client Exam Req Y/N` | String | imported | `nan` |  |
| `By UT` | String | imported | `nan` |  |
| `RT Remarks` | String | imported | `nan` |  |
| `UT%` | Int64 | imported | `0` |  |
| `Joint ID` | String | imported | `nan` |  |
| `Spool ID` | String | imported | `nan` |  |
| `PWHT Y/N CCC` | 1 | calculated | `nan` |  |
| `PWHT Report No CCC` | 1 | calculated | `nan` |  |
| `Joint ID+Welder ID` | 1 | calculated | `nan` |  |
| `Last Reshoot Date.1` | String | imported | `nan` |  |
| `Last Reshoot Report No.1` | String | imported | `nan` |  |
| `Last Reshoot Result.1` | String | imported | `nan` |  |

### `CSVExport_Welder Record - (ACC  REJ )` — 119 columns, 641,575 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Del Flag` | String | imported | `nan` |  |
| `Original Joint` | String | imported | `nan` |  |
| `Sub-Con Code` | String | imported | `nan` |  |
| `Welder No.` | String | imported | `nan` |  |
| `Welder Name` | String | imported | `nan` |  |
| `Weld Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Serial No.` | Int64 | imported | `0` |  |
| `Weld Week` | String | imported | `nan` |  |
| `Weld Month` | String | imported | `nan` |  |
| `Area Code` | String | imported | `nan` |  |
| `Area Group-1` | String | imported | `nan` |  |
| `Area Group-2` | String | imported | `nan` |  |
| `Area Group-3` | String | imported | `nan` |  |
| `Area Group-4` | String | imported | `nan` |  |
| `Area Group-5` | String | imported | `nan` |  |
| `QC ISO DWG. No.` | String | imported | `nan` |  |
| `Sheet No.` | Int64 | imported | `0` |  |
| `Joint No.` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Service Class` | String | imported | `nan` |  |
| `Pressure Level` | String | imported | `nan` |  |
| `Pipe Size` | Int64 | imported | `0` |  |
| `Wall Thickness` | Double | imported | `nan` |  |
| `Dia Inch` | Int64 | imported | `0` |  |
| `Material Category` | String | imported | `nan` |  |
| `P No.` | Int64 | imported | `0` |  |
| `Work Category` | String | imported | `nan` |  |
| `Original Work Category` | String | imported | `nan` |  |
| `Weld Type` | String | imported | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `Weld Point Code` | String | imported | `nan` |  |
| `Welded(Weld Point)` | Int64 | imported | `0` |  |
| `Weld Remark` | String | imported | `nan` |  |
| `Joint Percent` | Int64 | imported | `0` |  |
| `Welding Process` | String | imported | `nan` |  |
| `Welding Position` | String | imported | `nan` |  |
| `Welding Rod Type` | String | imported | `nan` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `RT/UT Report No.` | String | imported | `nan` |  |
| `RT/UT Date` | DateTime | imported | `Long Date` |  |
| `RT Film Total` | Double | imported | `nan` |  |
| `RT Film Reject` | Double | imported | `nan` |  |
| `RT/UT Result` | String | imported | `nan` |  |
| `RT/UT(%)` | Int64 | imported | `0` |  |
| `RT/UT Request Date` | String | imported | `nan` |  |
| `RT/UT Defect Code` | String | imported | `nan` |  |
| `RT/UT Defect Code Class` | String | imported | `nan` |  |
| `Reshoot-1 RT/UT Report No.` | String | imported | `nan` |  |
| `Reshoot-1 RT/UT Date` | String | imported | `nan` |  |
| `Reshoot-1 RT Film Total` | String | imported | `nan` |  |
| `Reshoot-1 RT Film Reject` | String | imported | `nan` |  |
| `Reshoot-1 RT/UT Result` | String | imported | `nan` |  |
| `Reshoot-1 RT/UT Defect Code` | String | imported | `nan` |  |
| `Reshoot-1 RT/UT Defect Code Class` | String | imported | `nan` |  |
| `Reshoot-2 RT/UT Report No.` | String | imported | `nan` |  |
| `Reshoot-2 RT/UT Date` | String | imported | `nan` |  |
| `Reshoot-2 RT Film Total` | String | imported | `nan` |  |
| `Reshoot-2 RT Film Reject` | String | imported | `nan` |  |
| `Reshoot-2 RT/UT Result` | String | imported | `nan` |  |
| `Reshoot-2 RT/UT Defect Code` | String | imported | `nan` |  |
| `Reshoot-2 RT/UT Defect Code Class` | String | imported | `nan` |  |
| `Reshoot-3 RT/UT Report No.` | String | imported | `nan` |  |
| `Reshoot-3 RT/UT Date` | String | imported | `nan` |  |
| `Reshoot-3 RT Film Total` | String | imported | `nan` |  |
| `Reshoot-3 RT Film Reject` | String | imported | `nan` |  |
| `Reshoot-3 RT/UT Result` | String | imported | `nan` |  |
| `Reshoot-3 RT/UT Defect Code` | String | imported | `nan` |  |
| `Reshoot-3 RT/UT Defect Code Class` | String | imported | `nan` |  |
| `Reshoot RT/UT Total` | String | imported | `nan` |  |
| `Reshoot RT/UT Film Total` | String | imported | `nan` |  |
| `Last Reshoot Date` | String | imported | `nan` |  |
| `Last Reshoot Report No` | String | imported | `nan` |  |
| `Last Reshoot Result` | String | imported | `nan` |  |
| `Last Reshoot RT/UT Defect Code` | String | imported | `nan` |  |
| `Last Reshoot RT/UT Defect Code Class` | String | imported | `nan` |  |
| `RT2/UT2` | String | imported | `nan` |  |
| `RT2/UT2 Report No.` | String | imported | `nan` |  |
| `RT2/UT2 Date` | String | imported | `nan` |  |
| `RT2 Film Total` | String | imported | `nan` |  |
| `RT2 Film Reject` | String | imported | `nan` |  |
| `RT2/UT2 Result` | String | imported | `nan` |  |
| `RT2/UT2(%)` | Int64 | imported | `0` |  |
| `RT2/UT2 Request Date` | String | imported | `nan` |  |
| `RT2/UT2 Defect Code` | String | imported | `nan` |  |
| `RT2/UT2 Defect Code Class` | String | imported | `nan` |  |
| `Reshoot-1 RT2/UT2 Report No.` | String | imported | `nan` |  |
| `Reshoot-1 RT2/UT2 Date` | String | imported | `nan` |  |
| `Reshoot-1 RT2 Film Total` | String | imported | `nan` |  |
| `Reshoot-1 RT2 Film Reject` | String | imported | `nan` |  |
| `Reshoot-1 RT2/UT2 Result` | String | imported | `nan` |  |
| `Reshoot-1 RT2/UT2 Defect Code` | String | imported | `nan` |  |
| `Reshoot-2 RT2/UT2 Report No.` | String | imported | `nan` |  |
| `Reshoot-2 RT2/UT2 Date` | String | imported | `nan` |  |
| `Reshoot-2 RT2 Film Total` | String | imported | `nan` |  |
| `Reshoot-2 RT2 Film Reject` | String | imported | `nan` |  |
| `Reshoot-1 RT2/UT2 Defect Code Class` | String | imported | `nan` |  |
| `Reshoot-2 RT2/UT2 Result` | String | imported | `nan` |  |
| `Reshoot-2 RT2/UT2 Defect Code` | String | imported | `nan` |  |
| `Reshoot-2 RT2/UT2 Defect Code Class` | String | imported | `nan` |  |
| `Reshoot-3 RT2/UT2 Report No.` | String | imported | `nan` |  |
| `Reshoot-3 RT2/UT2 Date` | String | imported | `nan` |  |
| `Reshoot-3 RT2 Film Total` | String | imported | `nan` |  |
| `Reshoot-3 RT2 Film Reject` | String | imported | `nan` |  |
| `Reshoot-3 RT2/UT2 Result` | String | imported | `nan` |  |
| `Reshoot-3 RT2/UT2 Defect Code` | String | imported | `nan` |  |
| `Reshoot-3 RT2/UT2 Defect Code Class` | String | imported | `nan` |  |
| `Reshoot RT2/UT2 Total` | String | imported | `nan` |  |
| `Reshoot RT2/UT2 Film Total` | String | imported | `nan` |  |
| `Last Reshoot Date_1` | String | imported | `nan` |  |
| `Last Reshoot Report No_2` | String | imported | `nan` |  |
| `Last Reshoot Result_3` | String | imported | `nan` |  |
| `Last Reshoot RT2/UT2 Defect Code` | String | imported | `nan` |  |
| `Last Reshoot RT2/UT2 Defect Code Class` | String | imported | `nan` |  |
| `VT Judge` | String | imported | `nan` |  |
| `Welding Inspection Identifier Date` | String | imported | `nan` |  |
| `Welding Inspection Identifier Client` | String | imported | `nan` |  |
| `Welding Inspection Identifier Chiyoda` | String | imported | `nan` |  |

### `CUM FILE UT Welders Performance 2 Weeks` — 12 columns, 20,026 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Date` | DateTime | imported | `Long Date` |  |
| `Row Index Column` | String | imported | `nan` |  |
| `Week_Start_Date` | DateTime | imported | `Long Date` |  |
| `Weeknum` | String | imported | `nan` |  |
| `Week_End_Date` | DateTime | imported | `Long Date` |  |
| `2 Weeks Period` | String | imported | `nan` |  |
| `Last_UT Date "PR all"` | DateTime | imported | `Long Date` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `STATUS` | String | imported | `nan` |  |
| `Welder ID` | String | imported | `nan` |  |
| `UT Rej Length Ratio % For Welder LAST 2 WEEKS` | Double | imported | `nan` |  |
| `Count of Welder ID` | Int64 | imported | `0` |  |

### `CUM FILE Welders Performance 1 Month` — 12 columns, 103,331 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Date` | DateTime | imported | `Long Date` |  |
| `Row Index Column` | String | imported | `nan` |  |
| `Week_Start_Date` | DateTime | imported | `Long Date` |  |
| `Weeknum` | String | imported | `nan` |  |
| `Week_End_Date` | DateTime | imported | `Long Date` |  |
| `1 Month  Period` | String | imported | `nan` |  |
| `Last_RT Date "PR all"` | DateTime | imported | `Long Date` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `STATUS` | String | imported | `nan` |  |
| `Welder ID` | String | imported | `nan` |  |
| `RT Film Ratio % "PR all" For Welder LAST 1 Month` | Int64 | imported | `0` |  |
| `Count of Welder ID` | Int64 | imported | `0` |  |

### `CUM FILE Welders Performance 2 Weeks` — 12 columns, 100,723 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Date` | DateTime | imported | `Long Date` |  |
| `Row Index Column` | Int64 | imported | `0` |  |
| `Week_Start_Date` | DateTime | imported | `Long Date` |  |
| `Weeknum` | String | imported | `nan` |  |
| `Week_End_Date` | DateTime | imported | `Long Date` |  |
| `2 Weeks Period` | String | imported | `nan` |  |
| `Last_RT Date "PR all"` | DateTime | imported | `Long Date` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `STATUS` | String | imported | `nan` |  |
| `Welder ID` | String | imported | `nan` |  |
| `RT Film Ratio % "PR all" For Welder LAST 2 WEEKS` | Double | imported | `nan` |  |
| `Count of Welder ID` | Int64 | imported | `0` |  |

### `CUM MPI Done` — 3 columns, 124 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Week_End_Date` | DateTime | imported | `Long Date` |  |
| `MPI Done` | Int64 | imported | `0` |  |
| `MPI / PT Done` | Int64 | imported | `0` |  |

### `CUM WEEK # Status` — 12 columns, 1,016 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `PERIOD` | String | imported | `nan` |  |
| `WEEK` | String | imported | `nan` |  |
| `S.No` | Int64 | imported | `0` |  |
| `Welders Qualification Status Summary Report` | String | imported | `nan` |  |
| `GAC` | Int64 | imported | `0` |  |
| `MEDGULF` | Int64 | imported | `0` |  |
| `TEKFEN` | Int64 | imported | `0` |  |
| `CCC` | Int64 | imported | `0` |  |
| `ACCIONA` | Int64 | imported | `0` |  |
| `INCO` | Int64 | imported | `0` |  |
| `TOTAL ` | Int64 | imported | `0` |  |
| `%` | String | imported | `nan` |  |

### `Calendar` — 9 columns, 1,975 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Month` | DateTime | calculated | `mmmm d` |  |
| `Row Index Column` | 1 | calculated | `0` |  |
| `Name_of_the_Month` | 1 | calculated | `nan` |  |
| `Week_Start_Date` | 1 | calculated | `dd-mmm-yy` |  |
| `Weekday` | 1 | calculated | `0` |  |
| `Weeknum` | 1 | calculated | `0` |  |
| `Week_End_Date` | 1 | calculated | `dd-mmm-yy` |  |
| `YEAR` | String | calculated | `nan` |  |
| `Date2` | 1 | calculated | `dd-mmm-yy` |  |

### `Flange BreakDown` — 4 columns, 288 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Fl.BreakDown % Rate` | Double | imported | `0.00%;-0.00%;0.00%` |  |
| `Project Fl.BreakDown  % Rej Rate` | Double | imported | `0.00%;-0.00%;0.00%` |  |

### `Flange Progress` — 96 columns, 363,245 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `Test Pack` | String | imported | `nan` |  |
| `System` | String | imported | `nan` |  |
| `SubSystem` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `Iso Number` | String | imported | `nan` |  |
| `Rev No.` | String | imported | `nan` |  |
| `Sheet No.` | Int64 | imported | `0` |  |
| `BT No.` | String | imported | `nan` |  |
| `Joint Point` | String | imported | `nan` |  |
| `Diam` | Double | imported | `nan` |  |
| `Rating` | Int64 | imported | `0` |  |
| `Bolt Size` | Double | imported | `nan` |  |
| `Bolt Qty` | Int64 | imported | `0` |  |
| `Bolt Length` | Double | imported | `0` |  |
| `Bolt Ident` | String | imported | `nan` |  |
| `Service Class` | String | imported | `nan` |  |
| `Bolt Desc.` | String | imported | `nan` |  |
| `Gasket Desc.` | String | imported | `nan` |  |
| `Lubricant Type` | String | imported | `nan` |  |
| `Service Type` | String | imported | `nan` |  |
| `UT` | Int64 | imported | `0` |  |
| `Joint Method` | String | imported | `nan` |  |
| `Jointing Value` | String | imported | `nan` |  |
| `Joint Timing` | String | imported | `nan` |  |
| `Cat.` | String | imported | `nan` |  |
| `Reason` | String | imported | `nan` |  |
| `Joint Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Report Nbr` | String | imported | `nan` |  |
| `Jointer` | String | imported | `nan` |  |
| `Tag Nbr` | String | imported | `nan` |  |
| `Control %` | Int64 | imported | `0` |  |
| `Flange Batch No` | String | imported | `nan` |  |
| `Selected Date` | DateTime | imported | `Long Date` |  |
| `Issued Date` | DateTime | imported | `Long Date` |  |
| `Issue Request No` | String | imported | `nan` |  |
| `Batch Status` | String | imported | `nan` |  |
| `Flange Joint Status` | String | imported | `nan` |  |
| `Control Inspection Report No` | String | imported | `nan` |  |
| `Control Inspection Date` | DateTime | imported | `Long Date` |  |
| `Status - A/R` | String | imported | `nan` |  |
| `Client Requested` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Flange Subcontractor` | String | imported | `nan` |  |
| `WITNESSED BY` | String | imported | `nan` |  |
| `REMARKS` | String | imported | `nan` |  |
| `Tightening Tool Id` | String | imported | `nan` |  |
| `ACC/REJ` | String | imported | `nan` |  |
| `Hold Date` | String | imported | `nan` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `BTC01` | String | imported | `nan` |  |
| `BT24` | String | imported | `nan` |  |
| `Reason for De-Tightening` | String | imported | `nan` |  |
| `User requested for De-Tightening` | String | imported | `nan` |  |
| `De-Tightening Requested Date` | DateTime | imported | `Long Date` |  |
| `Line No. - Field025 (Custom)` | String | imported | `nan` |  |
| `Process Plant` | String | imported | `nan` |  |
| `Process Area` | String | imported | `nan` |  |
| `MaterialIDCode` | String | imported | `nan` |  |
| `GasketRating` | String | imported | `nan` |  |
| `TorqueEU` | String | imported | `nan` |  |
| `Flange Repair Record - Field032 (Custom)` | String | imported | `nan` |  |
| `Nut Material` | String | imported | `nan` |  |
| `Parent Asset` | String | imported | `nan` |  |
| `RecordLastModifiedBy` | String | imported | `nan` |  |
| `RecordLastModified` | DateTime | imported | `Long Date` |  |
| `PDS Area` | String | imported | `nan` |  |
| `PDS Area "VPR"` | 1 | calculated | `nan` |  |
| `PDS Area Final` | 1 | calculated | `nan` |  |
| `HA` | 1 | calculated | `nan` |  |
| `Joint Method Original` | String | imported | `nan` |  |
| `Sub-Contractor From WD+WR` | 1 | calculated | `nan` |  |
| `Dia Inch >60<` | 1 | calculated | `nan` |  |
| `Task_Status PIP-018-A "VPR"` | 1 | calculated | `nan` |  |
| `Loose Bolts Description` | 1 | calculated | `nan` |  |
| `Test Completed Date` | 1 | calculated | `dd-mmm-yy` |  |
| `Reinstatement Completed Date` | 1 | calculated | `dd-mmm-yy` |  |
| `Test Status` | 1 | calculated | `nan` |  |
| `Reinstatement Status` | 1 | calculated | `nan` |  |
| `Re-Tightening Report Number - Field032 (Custom)` | String | imported | `nan` |  |
| `Construction Responsible Company - Field021 (Custom)` | String | imported | `nan` |  |
| `Commissioning Responsible Company - Field022 (Custom)` | String | imported | `nan` |  |
| `PCC Serial No of Field Tag- Field038 (Custom)` | String | imported | `nan` |  |
| `PCC Tightening Date- Field039 (Custom)` | DateTime | imported | `dd-mmm-yy` |  |
| `PCC Report Number - Field040 (Custom)` | String | imported | `nan` |  |
| `PCC Verified Date - Field041 (Custom)` | DateTime | imported | `Long Date` |  |
| `PCC Re-Tightening Date - Field042 (Custom)` | DateTime | imported | `dd-mmm-yy` |  |
| `PCC Re-Tightening Report Number - Field043 (Custom)` | String | imported | `nan` |  |
| `PCC Crew ID -Field044 (Custom)` | String | imported | `nan` |  |
| `PCC Remarks - Field045 (Custom)` | String | imported | `nan` |  |
| `Index` | Int64 | imported | `0` |  |
| `WeldPoint No.1 WP1` | 1 | calculated | `0` |  |
| `Joint ID Max Joint_Date` | 1 | calculated | `nan` |  |
| `Duplicate Joint ID` | 1 | calculated | `0` |  |
| `Flange ID from SCDB 1510 VPR` | 1 | calculated | `nan` |  |
| `HA CWA` | 1 | calculated | `nan` |  |

### `Flange ovAssets_1381` — 70 columns, 1 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `PDS Area` | String | imported | `nan` |  |
| `Iso Number` | String | imported | `nan` |  |
| `Line No. - Field025 (Custom)` | String | imported | `nan` |  |
| `Test Pack` | String | imported | `nan` |  |
| `Cat.` | String | imported | `nan` |  |
| `Process Plant` | String | imported | `nan` |  |
| `Process Area` | String | imported | `nan` |  |
| `System` | String | imported | `nan` |  |
| `SubSystem` | String | imported | `nan` |  |
| `Service Class` | String | imported | `nan` |  |
| `MaterialIDCode` | String | imported | `nan` |  |
| `Diam` | Double | imported | `nan` |  |
| `Gasket Desc.` | String | imported | `nan` |  |
| `GasketRating` | String | imported | `nan` |  |
| `Bolt Qty` | Int64 | imported | `0` |  |
| `Bolt Size` | Double | imported | `nan` |  |
| `Bolt Length` | Double | imported | `nan` |  |
| `TorqueEU` | String | imported | `nan` |  |
| `Report Nbr` | String | imported | `nan` |  |
| `Joint Date` | DateTime | imported | `Long Date` |  |
| `Tag Nbr` | String | imported | `nan` |  |
| `Verified Date - Field024 (Custom)` | DateTime | imported | `Long Date` |  |
| `Flange Repair Record - Field032 (Custom)` | String | imported | `nan` |  |
| `De-Tightening Requested Date` | DateTime | imported | `Long Date` |  |
| `Jointer` | String | imported | `nan` |  |
| `Bolt Desc.` | String | imported | `nan` |  |
| `Nut Material` | String | imported | `nan` |  |
| `Parent Asset` | String | imported | `nan` |  |
| `RecordLastModifiedBy` | String | imported | `nan` |  |
| `RecordLastModified` | DateTime | imported | `Long Date` |  |
| `Jointing Value` | String | imported | `nan` |  |
| `Joint Method` | String | imported | `nan` |  |
| `BT No.` | String | imported | `nan` |  |
| `Flange Subcontractor` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `Rev No.` | String | imported | `nan` |  |
| `Sheet No.` | Int64 | imported | `0` |  |
| `Joint Point` | String | imported | `nan` |  |
| `Rating` | Int64 | imported | `0` |  |
| `Bolt Ident` | String | imported | `nan` |  |
| `Lubricant Type` | String | imported | `nan` |  |
| `Service Type` | String | imported | `nan` |  |
| `UT` | Int64 | imported | `0` |  |
| `Joint Timing` | String | imported | `nan` |  |
| `Reason` | String | imported | `nan` |  |
| `Tightening Tool Id` | String | imported | `nan` |  |
| `Control %` | Int64 | imported | `0` |  |
| `Flange Batch No` | String | imported | `nan` |  |
| `Selected Date` | DateTime | imported | `Long Date` |  |
| `Issued Date` | DateTime | imported | `Long Date` |  |
| `Issue Request No` | String | imported | `nan` |  |
| `Batch Status` | String | imported | `nan` |  |
| `Flange Joint Status` | String | imported | `nan` |  |
| `Control Inspection Report No` | String | imported | `nan` |  |
| `Status - A/R` | String | imported | `nan` |  |
| `Client Requested` | String | imported | `nan` |  |
| `Reason for De-Tightening` | String | imported | `nan` |  |
| `User requested for De-Tightening` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Hold Date` | DateTime | imported | `Long Date` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `WITNESSED BY` | String | imported | `nan` |  |
| `ACC/REJ` | String | imported | `nan` |  |
| `REMARKS` | String | imported | `nan` |  |
| `BTC01` | String | imported | `nan` |  |
| `BT24` | String | imported | `nan` |  |
| `De-Tightening Report Number` | String | imported | `nan` |  |
| `Joint Method Original` | String | imported | `nan` |  |
| `Control Inspection Date` | DateTime | imported | `Long Date` |  |

### `Flange ovAssets_1510` — 75 columns, 134,943 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `Test Pack` | String | imported | `nan` |  |
| `System` | String | imported | `nan` |  |
| `SubSystem` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `Iso Number` | String | imported | `nan` |  |
| `Rev No.` | String | imported | `nan` |  |
| `Sheet No.` | Int64 | imported | `0` |  |
| `BT No.` | String | imported | `nan` |  |
| `Joint Point` | String | imported | `nan` |  |
| `Diam` | Double | imported | `nan` |  |
| `Rating` | Int64 | imported | `0` |  |
| `Bolt Size` | Double | imported | `nan` |  |
| `Bolt Qty` | Int64 | imported | `0` |  |
| `Bolt Length` | Double | imported | `nan` |  |
| `Bolt Ident` | String | imported | `nan` |  |
| `Service Class` | String | imported | `nan` |  |
| `Bolt Desc.` | String | imported | `nan` |  |
| `Gasket Desc.` | String | imported | `nan` |  |
| `Lubricant Type` | String | imported | `nan` |  |
| `Service Type` | String | imported | `nan` |  |
| `UT` | Int64 | imported | `0` |  |
| `Joint Method` | String | imported | `nan` |  |
| `Jointing Value` | String | imported | `nan` |  |
| `Joint Timing` | String | imported | `nan` |  |
| `Cat.` | String | imported | `nan` |  |
| `Reason` | String | imported | `nan` |  |
| `Joint Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Report Nbr` | String | imported | `nan` |  |
| `Tag Nbr` | String | imported | `nan` |  |
| `Control %` | Int64 | imported | `0` |  |
| `Flange Batch No` | String | imported | `nan` |  |
| `Selected Date` | DateTime | imported | `Long Date` |  |
| `Issued Date` | DateTime | imported | `Long Date` |  |
| `Issue Request No` | String | imported | `nan` |  |
| `Batch Status` | String | imported | `nan` |  |
| `Flange Joint Status` | String | imported | `nan` |  |
| `Control Inspection Report No` | String | imported | `nan` |  |
| `Control Inspection Date` | DateTime | imported | `Long Date` |  |
| `Status - A/R` | String | imported | `nan` |  |
| `Client Requested` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Flange Subcontractor` | String | imported | `nan` |  |
| `WITNESSED BY` | String | imported | `nan` |  |
| `REMARKS` | String | imported | `nan` |  |
| `Tightening Tool Id` | String | imported | `nan` |  |
| `ACC/REJ` | String | imported | `nan` |  |
| `Hold Date` | DateTime | imported | `Long Date` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `BTC01` | String | imported | `nan` |  |
| `BT24` | String | imported | `nan` |  |
| `Reason for De-Tightening` | String | imported | `nan` |  |
| `User requested for De-Tightening` | String | imported | `nan` |  |
| `De-Tightening Requested Date` | DateTime | imported | `Long Date` |  |
| `Lineno. - Field025(Custom)` | String | imported | `nan` |  |
| `Process Plant` | String | imported | `nan` |  |
| `Process Area` | String | imported | `nan` |  |
| `MateriallDCode` | String | imported | `nan` |  |
| `GasketRating` | String | imported | `nan` |  |
| `TorqueEU` | String | imported | `nan` |  |
| `Flange Repair Record - Field032 (Custom)` | String | imported | `nan` |  |
| `Jointer` | String | imported | `nan` |  |
| `Nut Material` | String | imported | `nan` |  |
| `Parent Asset` | String | imported | `nan` |  |
| `RecordLastModifiedBy` | String | imported | `nan` |  |
| `RecordLastModified` | DateTime | imported | `Long Date` |  |
| `PDS Area` | String | imported | `nan` |  |
| `Joint Method Original` | String | imported | `nan` |  |
| `Construction Responsible Company - Field021 (Custom)` | String | imported | `nan` |  |
| `Commissioning Responsible Company - Field022 (Custom)` | String | imported | `nan` |  |
| `Flange ID from EP VPR` | 1 | calculated | `nan` |  |
| `HA` | 1 | calculated | `nan` |  |
| `Joint Method*` | String | imported | `nan` |  |
| `TorqueValue` | String | imported | `nan` |  |
| `Tightening Date - Field027 (Custom)NEW` | DateTime | imported | `Long Date` |  |

### `Flange ovAssets_1619` — 79 columns, 226,504 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `Test Pack` | String | imported | `nan` |  |
| `System` | String | imported | `nan` |  |
| `SubSystem` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `Iso Number` | String | imported | `nan` |  |
| `Line No. - Field025 (Custom)` | String | imported | `nan` |  |
| `Rev No.` | String | imported | `nan` |  |
| `Sheet No.` | Int64 | imported | `0` |  |
| `BT No.` | String | imported | `nan` |  |
| `Joint Point` | String | imported | `nan` |  |
| `Diam` | Double | imported | `nan` |  |
| `Rating` | Int64 | imported | `0` |  |
| `Bolt Size` | Double | imported | `nan` |  |
| `Bolt Qty` | Int64 | imported | `0` |  |
| `Bolt Length` | Double | imported | `nan` |  |
| `Bolt Ident` | String | imported | `nan` |  |
| `Service Class` | String | imported | `nan` |  |
| `Bolt Desc.` | String | imported | `nan` |  |
| `Gasket Desc.` | String | imported | `nan` |  |
| `Lubricant Type` | String | imported | `nan` |  |
| `Service Type` | String | imported | `nan` |  |
| `UT` | Int64 | imported | `0` |  |
| `Re-Tightening Report Number - Field032 (Custom)` | String | imported | `nan` |  |
| `Joint Method` | String | imported | `nan` |  |
| `Jointing Value` | String | imported | `nan` |  |
| `Joint Timing` | String | imported | `nan` |  |
| `Cat.` | String | imported | `nan` |  |
| `Reason` | String | imported | `nan` |  |
| `Report Nbr` | String | imported | `nan` |  |
| `Jointer` | String | imported | `nan` |  |
| `Tag Nbr` | String | imported | `nan` |  |
| `Control %` | Int64 | imported | `0` |  |
| `Flange Batch No` | String | imported | `nan` |  |
| `PCC Serial No of Field Tag- Field038 (Custom)` | String | imported | `nan` |  |
| `PCC Tightening Date- Field039 (Custom)` | DateTime | imported | `Long Date` |  |
| `PCC Report Number - Field040 (Custom)` | String | imported | `nan` |  |
| `PCC Verified Date - Field041 (Custom)` | DateTime | imported | `Long Date` |  |
| `PCC Re-Tightening Date - Field042 (Custom)` | DateTime | imported | `Long Date` |  |
| `PCC Re-Tightening Report Number - Field043 (Custom)` | String | imported | `nan` |  |
| `PCC Crew ID -Field044 (Custom)` | String | imported | `nan` |  |
| `PCC Remarks - Field045 (Custom)` | String | imported | `nan` |  |
| `Selected Date` | DateTime | imported | `Long Date` |  |
| `Issued Date` | DateTime | imported | `Long Date` |  |
| `Issue Request No` | String | imported | `nan` |  |
| `Batch Status` | String | imported | `nan` |  |
| `Flange Joint Status` | String | imported | `nan` |  |
| `Control Inspection Report No` | String | imported | `nan` |  |
| `Control Inspection Date` | DateTime | imported | `Long Date` |  |
| `Status - A/R` | String | imported | `nan` |  |
| `Client Requested` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Flange Subcontractor` | String | imported | `nan` |  |
| `WITNESSED BY` | String | imported | `nan` |  |
| `REMARKS` | String | imported | `nan` |  |
| `Tightening Tool Id` | String | imported | `nan` |  |
| `ACC/REJ` | String | imported | `nan` |  |
| `Hold Date` | DateTime | imported | `Long Date` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `BTC01` | String | imported | `nan` |  |
| `BT24` | String | imported | `nan` |  |
| `Reason for De-Tightening` | String | imported | `nan` |  |
| `User requested for De-Tightening` | String | imported | `nan` |  |
| `De-Tightening Requested Date` | DateTime | imported | `Long Date` |  |
| `Process Plant` | String | imported | `nan` |  |
| `Process Area` | String | imported | `nan` |  |
| `MaterialIDCode` | String | imported | `nan` |  |
| `GasketRating` | String | imported | `nan` |  |
| `TorqueEU` | String | imported | `nan` |  |
| `Flange Repair Record - Field032 (Custom)` | String | imported | `nan` |  |
| `Nut Material` | String | imported | `nan` |  |
| `Parent Asset` | String | imported | `nan` |  |
| `RecordLastModifiedBy` | String | imported | `nan` |  |
| `RecordLastModified` | DateTime | imported | `Long Date` |  |
| `PDS Area` | String | imported | `nan` |  |
| `Joint Method Original` | String | imported | `nan` |  |
| `Construction Responsible Company - Field021 (Custom)` | String | imported | `nan` |  |
| `Commissioning Responsible Company - Field022 (Custom)` | String | imported | `nan` |  |
| `Joint Date` | DateTime | imported | `Long Date` |  |

### `Flg CCC_Flange Repair` — 12 columns, 2,346 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `SN` | Int64 | imported | `0` |  |
| `Date` | DateTime | imported | `dd-mmm-yy` |  |
| `OSDR / PSO` | String | imported | `nan` |  |
| `ACCEPTED/REJECTED` | String | imported | `nan` |  |
| `Action` | String | imported | `nan` |  |
| `Delay` | String | imported | `nan` |  |
| `Site SN` | Int64 | imported | `0` |  |
| `Vendor SN` | Int64 | imported | `0` |  |
| `Action Done` | Int64 | imported | `0` |  |
| `Subcontractor` | String | imported | `nan` |  |
| `To be Repaired` | Int64 | imported | `0` |  |
| `Repaired` | Int64 | imported | `0` |  |

### `Flg Enova Flange Repair_W10` — 9 columns, 223 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Date` | DateTime | imported | `Long Date` |  |
| `Action` | String | imported | `nan` |  |
| `Re-Machining Date` | DateTime | imported | `Long Date` |  |
| `Locations` | String | imported | `nan` |  |
| `Vendor SN` | Int64 | imported | `0` |  |
| `Repaired` | Int64 | imported | `0` |  |
| `To be Repaired` | Int64 | imported | `0` |  |
| `Subcontractor` | String | imported | `nan` |  |
| `ACCEPTED/REJECTED` | String | imported | `nan` |  |

### `Flg Enova Flange Repair_W17` — 16 columns, 201 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `TAG ID` | String | imported | `nan` |  |
| `Flange Description` | String | imported | `nan` |  |
| `Flange Size` | String | imported | `nan` |  |
| `Heat No` | String | imported | `nan` |  |
| `Locations` | String | imported | `nan` |  |
| `Affected Qty` | String | imported | `nan` |  |
| `OSD NO` | String | imported | `nan` |  |
| `OSD Date` | String | imported | `nan` |  |
| `Defect Description` | String | imported | `nan` |  |
| `Disposition Plan` | String | imported | `nan` |  |
| `Action` | String | imported | `nan` |  |
| `Re-Machining Date` | DateTime | imported | `Long Date` |  |
| `ACC/REJ` | String | imported | `nan` |  |
| `Current location` | String | imported | `nan` |  |
| `Current Status_1` | String | imported | `nan` |  |
| `Location` | String | imported | `nan` |  |

### `Flg GAC_Flange Repair` — 10 columns, 255 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `SN` | Int64 | imported | `0` |  |
| `Date` | DateTime | imported | `Long Date` |  |
| `Vendor/Site` | String | imported | `nan` |  |
| `Re-Machining Date` | DateTime | imported | `Long Date` |  |
| `Vendor SN` | Int64 | imported | `0` |  |
| `Site SN` | Int64 | imported | `0` |  |
| `Repaired` | Int64 | imported | `0` |  |
| `To be Repaired` | Int64 | imported | `0` |  |
| `Subcontractor` | String | imported | `nan` |  |
| `ACCEPTED/REJECTED` | String | imported | `nan` |  |

### `Flg Medgulf_Flange Repair` — 17 columns, 6 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Subcontractor` | String | imported | `nan` |  |
| `Group` | String | imported | `nan` |  |
| `Ident Code` | String | imported | `nan` |  |
| `Trac No.` | String | imported | `nan` |  |
| `Flange Rating` | String | imported | `nan` |  |
| `Date` | DateTime | imported | `Long Date` |  |
| `Re-Machining Date` | DateTime | imported | `Long Date` |  |
| `Flange Maching Contractor` | String | imported | `nan` |  |
| `Flange Maching Report No.` | String | imported | `nan` |  |
| `Vendor/Site` | String | imported | `nan` |  |
| `Action` | String | imported | `nan` |  |
| `Site SN` | Int64 | imported | `0` |  |
| `Vendor SN` | Int64 | imported | `0` |  |
| `Repaired` | Int64 | imported | `0` |  |
| `To be Repaired` | Int64 | imported | `0` |  |
| `ACCEPTED/REJECTED` | String | imported | `nan` |  |
| `ACCEPTED/REJECTED.1` | String | imported | `nan` |  |

### `Flg Onepager_data` — 14 columns, 2,946 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `SN` | String | imported | `nan` |  |
| `Date` | DateTime | imported | `dd-mmm-yy` |  |
| `ACCEPTED/REJECTED` | String | imported | `nan` |  |
| `Action` | String | imported | `nan` |  |
| `Subcontractor` | String | imported | `nan` |  |
| `Site SN` | Int64 | imported | `0` |  |
| `Vendor SN` | Int64 | imported | `0` |  |
| `To be Repaired` | Int64 | imported | `0` |  |
| `Repaired` | Int64 | imported | `0` |  |
| `Vendor/Site` | String | imported | `nan` |  |
| `Re-Machining Date` | DateTime | imported | `Long Date` |  |
| `tekfen repair log main log.Final Conclusion` | String | imported | `nan` |  |
| `Locations` | String | imported | `nan` |  |
| `Week_End_Date from Calendar` | 1 | calculated | `dd-mmm-yy` |  |

### `Flg TFN_Flange Repair` — 12 columns, 116 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `SN` | String | imported | `nan` |  |
| `Date` | DateTime | imported | `Long Date` |  |
| `Vendor/Site` | String | imported | `nan` |  |
| `Repaire Request` | String | imported | `nan` |  |
| `Re-Machining Date` | DateTime | imported | `Long Date` |  |
| `tekfen repair log main log.Final Conclusion` | String | imported | `nan` |  |
| `Site SN` | Int64 | imported | `0` |  |
| `Vendor SN` | Int64 | imported | `0` |  |
| `Repaired` | Int64 | imported | `0` |  |
| `To be Repaired` | Int64 | imported | `0` |  |
| `Subcontractor` | String | imported | `nan` |  |
| `ACCEPTED/REJECTED` | String | imported | `nan` |  |

### `Flg tekfen repair log main log` — 17 columns, 116 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `#` | String | imported | `nan` |  |
| `CDR/CQA Referance ` | String | imported | `nan` |  |
| `ISO No.` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Dia inch` | String | imported | `nan` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Group` | String | imported | `nan` |  |
| `Observation  Date` | String | imported | `nan` |  |
| `RFI No` | String | imported | `nan` |  |
| `Flange Maching Date` | String | imported | `nan` |  |
| `Flange Maching Contractor` | String | imported | `nan` |  |
| `Flange Maching Report No.` | String | imported | `nan` |  |
| `Remarks` | String | imported | `nan` |  |
| `Final Conclusion` | String | imported | `nan` |  |
| `Column15` | String | imported | `nan` |  |
| `Column16` | String | imported | `nan` |  |
| `ACCEPTED/REJECTED` | String | imported | `nan` |  |

### `HA l0_abs_guide` — 13 columns, 912 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Handover Area` | String | imported | `nan` |  |
| `Location Number` | String | imported | `nan` |  |
| `Location Name` | String | imported | `nan` |  |
| `Location Summary` | String | imported | `nan` |  |
| `Area Number` | String | imported | `nan` |  |
| `Area Name` | String | imported | `nan` |  |
| `Area Summary` | String | imported | `nan` |  |
| `Facility Number` | String | imported | `nan` |  |
| `Facility Name` | String | imported | `nan` |  |
| `Facility Summary` | String | imported | `nan` |  |
| `Project Number` | String | imported | `nan` |  |
| `Project Name` | String | imported | `nan` |  |
| `Project Summary` | String | imported | `nan` |  |

### `Inco NDT Tracking` — 14 columns, 179 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Sl. No.` | Int64 | imported | `0` |  |
| `Activity Discription` | String | imported | `nan` |  |
| `Tank No.` | String | imported | `nan` |  |
| `NDE Req.` | String | imported | `nan` |  |
| `UNIT` | String | imported | `nan` |  |
| `Welded Weekly` | Int64 | imported | `0` |  |
| `RT Req. Weekly` | Int64 | imported | `0` |  |
| `RT Taken Weekly` | String | imported | `nan` |  |
| `Bal.Weekly` | Int64 | imported | `0` |  |
| `Welded Cummulative` | Double | imported | `0.0` |  |
| `RT Req. Cummulative` | Int64 | imported | `0` |  |
| `RT Taken Cummulative` | Int64 | imported | `0` |  |
| `Bal Cummulative` | Int64 | imported | `0` |  |
| `Remarks` | String | imported | `nan` |  |

### `Inco Weld Log` — 205 columns, 10,327 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `ISO Number` | String | imported | `nan` |  |
| `Category 1` | String | imported | `nan` |  |
| `Category 2` | String | imported | `nan` |  |
| `Drg No` | String | imported | `nan` |  |
| `Material Type` | String | imported | `nan` |  |
| `Weld No.` | String | imported | `nan` |  |
| `Thickness` | Double | imported | `nan` |  |
| `Weld Length` | Double | imported | `0.000` |  |
| `Weld Type` | String | imported | `nan` |  |
| `process` | String | imported | `nan` |  |
| `WPS No.` | String | imported | `nan` |  |
| `Welder` | String | imported | `nan` |  |
| `Fitup Report No.` | String | imported | `nan` |  |
| `Fitup Date` | DateTime | imported | `Long Date` |  |
| `DWIR No.` | String | imported | `nan` |  |
| `First Prod. Joint` | String | imported | `nan` |  |
| `RT Report` | String | imported | `nan` |  |
| `RT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `RT Acc/Rej` | String | imported | `nan` |  |
| `Rej Length` | Int64 | imported | `0` |  |
| `RT Film Total` | Double | imported | `0.0` |  |
| `Aditional Joint No.RT` | String | imported | `nan` |  |
| `Defect Code` | String | imported | `nan` |  |
| `Repair Length (mm)` | Int64 | imported | `0` |  |
| `RT P1 Rep.` | String | imported | `nan` |  |
| `P1 Date` | DateTime | imported | `Long Date` |  |
| `RT P2 Rep.` | String | imported | `nan` |  |
| `P2 Date` | DateTime | imported | `Long Date` |  |
| `MT Report` | String | imported | `nan` |  |
| `MT Date` | DateTime | imported | `Long Date` |  |
| `VBT Report` | String | imported | `nan` |  |
| `VBT Date` | DateTime | imported | `Long Date` |  |
| `OPT Report` | String | imported | `nan` |  |
| `OPT Date` | DateTime | imported | `Long Date` |  |
| `PWHT Report` | String | imported | `nan` |  |
| `PWHT Date` | DateTime | imported | `Long Date` |  |
| `HT Report` | String | imported | `nan` |  |
| `HT Date` | DateTime | imported | `Long Date` |  |
| `HT Remarks` | String | imported | `nan` |  |
| `Spool ID` | String | imported | `nan` |  |
| `Iso Rev No.` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Spool Rev No.` | String | imported | `nan` |  |
| `Weld Cat` | String | imported | `nan` |  |
| `Dia Inch Factor` | String | imported | `nan` |  |
| `Dia inch` | String | imported | `nan` |  |
| `PDS Area` | String | imported | `nan` |  |
| `AG/UG/PKG` | String | imported | `nan` |  |
| `Area Classification` | String | imported | `nan` |  |
| `wbu` | String | imported | `nan` |  |
| `System no` | String | imported | `nan` |  |
| `Testpack No` | String | imported | `nan` |  |
| `Service class` | String | imported | `nan` |  |
| `Service Cat` | String | imported | `nan` |  |
| `MIR No` | String | imported | `nan` |  |
| `MIR Date` | DateTime | imported | `Long Date` |  |
| `Cutting Date` | DateTime | imported | `Long Date` |  |
| `Beveling Date` | DateTime | imported | `Long Date` |  |
| `Preheat Date` | DateTime | imported | `Long Date` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Rework Code` | String | imported | `nan` |  |
| `WeldPoint No.` | Int64 | imported | `0` |  |
| `PWHT Y/N` | String | imported | `nan` |  |
| `PWHT Weld Status` | String | imported | `nan` |  |
| `PWHT Selected Date` | DateTime | imported | `Long Date` |  |
| `PWHT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PWHT Acc/Rej` | String | imported | `nan` |  |
| `PWHT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PWHT Remarks` | String | imported | `nan` |  |
| `HT%` | String | imported | `nan` |  |
| `HT Batch No` | String | imported | `nan` |  |
| `HT Batch Status` | String | imported | `nan` |  |
| `HT Weld Status` | String | imported | `nan` |  |
| `HT Selected Date` | DateTime | imported | `Long Date` |  |
| `HT Exam Req date` | DateTime | imported | `Long Date` |  |
| `HT Acc/Rej` | String | imported | `nan` |  |
| `HT Client Exam Req Y/N` | String | imported | `nan` |  |
| `RT%` | String | imported | `nan` |  |
| `RT Batch No` | String | imported | `nan` |  |
| `RT Batch Status` | String | imported | `nan` |  |
| `RT Weld Status` | String | imported | `nan` |  |
| `RT Selected Date` | DateTime | imported | `Long Date` |  |
| `RT Exam Req date` | DateTime | imported | `Long Date` |  |
| `RT Xray No` | String | imported | `nan` |  |
| `Total No of films Acc` | Double | imported | `0` |  |
| `Total No of films Rej` | Double | imported | `0` |  |
| `Location of Defect` | String | imported | `nan` |  |
| `RT Re-Shoot Rep` | String | imported | `nan` |  |
| `RT Re-Shoot Data` | DateTime | imported | `Long Date` |  |
| `RT Re-Shoot Status` | String | imported | `nan` |  |
| `RT Re-Shoot Reason` | String | imported | `nan` |  |
| `RT Re-Shoot Films` | String | imported | `nan` |  |
| `RT Client Exam Req Y/N` | String | imported | `nan` |  |
| `By UT` | String | imported | `nan` |  |
| `RT Remarks` | String | imported | `nan` |  |
| `UT%` | String | imported | `nan` |  |
| `UT Batch No` | String | imported | `nan` |  |
| `UT Batch Status` | String | imported | `nan` |  |
| `UT Weld Status` | String | imported | `nan` |  |
| `UT Selected Date` | DateTime | imported | `Long Date` |  |
| `UT Exam Req date` | DateTime | imported | `Long Date` |  |
| `UT Date` | DateTime | imported | `Long Date` |  |
| `UT Report` | String | imported | `nan` |  |
| `UT Acc/Rej` | String | imported | `nan` |  |
| `UT Client Exam Req Y/N` | String | imported | `nan` |  |
| `UT Remarks` | String | imported | `nan` |  |
| `MT%` | String | imported | `nan` |  |
| `MT Batch No` | String | imported | `nan` |  |
| `MT Batch Status` | String | imported | `nan` |  |
| `MT Selected Date` | DateTime | imported | `Long Date` |  |
| `MT Exam Req date` | DateTime | imported | `Long Date` |  |
| `MT Acc/Rej` | String | imported | `nan` |  |
| `MT Client Exam Req Y/N` | String | imported | `nan` |  |
| `MT Remarks` | String | imported | `nan` |  |
| `PMI%` | String | imported | `nan` |  |
| `PMI Batch No` | String | imported | `nan` |  |
| `PMI Batch Status` | String | imported | `nan` |  |
| `PMI Weld Status` | String | imported | `nan` |  |
| `PMI Selected Date` | DateTime | imported | `Long Date` |  |
| `PMI Exam Req date` | DateTime | imported | `Long Date` |  |
| `PMI Date` | DateTime | imported | `Long Date` |  |
| `PMI Report` | String | imported | `nan` |  |
| `PMI Acc/Rej` | String | imported | `nan` |  |
| `PMI Client Exam Req Y/N` | String | imported | `nan` |  |
| `PMI Remarks` | String | imported | `nan` |  |
| `PT%` | String | imported | `nan` |  |
| `PT Batch No` | String | imported | `nan` |  |
| `PT Batch Status` | String | imported | `nan` |  |
| `PT Weld Status` | String | imported | `nan` |  |
| `PT Selected Date` | DateTime | imported | `Long Date` |  |
| `PT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PT Acc/Rej` | String | imported | `nan` |  |
| `PT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PT Remarks` | String | imported | `nan` |  |
| `FN%` | String | imported | `nan` |  |
| `FN Batch No` | String | imported | `nan` |  |
| `FN Batch Status` | String | imported | `nan` |  |
| `FN Weld Status` | String | imported | `nan` |  |
| `FN Selected Date` | DateTime | imported | `Long Date` |  |
| `FN Exam Req date` | DateTime | imported | `Long Date` |  |
| `FN Date` | DateTime | imported | `Long Date` |  |
| `FN Report` | String | imported | `nan` |  |
| `FN Acc/Rej` | String | imported | `nan` |  |
| `FN Client Exam Req Y/N` | String | imported | `nan` |  |
| `FN Remarks` | String | imported | `nan` |  |
| `PADLT Y/N` | String | imported | `nan` |  |
| `PADLT Weld Status` | String | imported | `nan` |  |
| `PADLT Selected Date` | DateTime | imported | `Long Date` |  |
| `PADLT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PADLT Date` | DateTime | imported | `Long Date` |  |
| `PADLT Report` | String | imported | `nan` |  |
| `PADLT Acc/Rej` | String | imported | `nan` |  |
| `PADLT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PADLT Remarks` | String | imported | `nan` |  |
| `ORIF Y/N` | String | imported | `nan` |  |
| `ORIF Weld Status` | String | imported | `nan` |  |
| `ORIF Selected Date` | DateTime | imported | `Long Date` |  |
| `ORIF Exam Req date` | DateTime | imported | `Long Date` |  |
| `ORIF Date` | DateTime | imported | `Long Date` |  |
| `ORIF Report` | String | imported | `nan` |  |
| `ORIF Acc/Rej` | String | imported | `nan` |  |
| `ORIF Client Exam Req Y/N` | String | imported | `nan` |  |
| `Matrl Traceability Y/N` | String | imported | `nan` |  |
| `GROUP-1` | String | imported | `nan` |  |
| `IDENT CODE-1` | String | imported | `nan` |  |
| `TRAC NO-1` | String | imported | `nan` |  |
| `Part 1` | String | imported | `nan` |  |
| `GROUP-2` | String | imported | `nan` |  |
| `IDENT CODE-2` | String | imported | `nan` |  |
| `TRAC NO-2` | String | imported | `nan` |  |
| `Part 2` | String | imported | `nan` |  |
| `Revision Status` | String | imported | `nan` |  |
| `Revision Comments` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `Piping Group` | String | imported | `nan` |  |
| `Golden Weld Report Date` | DateTime | imported | `Long Date` |  |
| `Golden Weld Report No` | String | imported | `nan` |  |
| `Custom3` | String | imported | `nan` |  |
| `Custom4` | String | imported | `nan` |  |
| `Custom5` | String | imported | `nan` |  |
| `Custom6` | String | imported | `nan` |  |
| `Custom7` | String | imported | `nan` |  |
| `Custom8` | String | imported | `nan` |  |
| `Custom9` | String | imported | `nan` |  |
| `Custom10` | String | imported | `nan` |  |
| `Custom11` | String | imported | `nan` |  |
| `Custom12` | String | imported | `nan` |  |
| `Custom13` | String | imported | `nan` |  |
| `Custom14` | String | imported | `nan` |  |
| `PED` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `Original Joint` | String | imported | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `PT Date` | DateTime | imported | `Long Date` |  |
| `PT Report` | String | imported | `nan` |  |
| `Weld Point Code` | String | imported | `nan` |  |
| `Subsystem Code` | String | imported | `nan` |  |
| `Joint ID` | String | imported | `nan` |  |
| `MT Weld Status` | String | imported | `nan` |  |
| `Weld Date` | DateTime | imported | `dd-mmm-yy` |  |
| `CountDelimiter` | Int64 | imported | `0` |  |
| `Count Rows.Count` | Int64 | imported | `0` |  |

### `Inco of NDE Summary` — 5 columns, 84 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `As on Date` | DateTime | imported | `d mmmm\, yyyy` |  |
| `RT REQUIRED` | Int64 | imported | `0` |  |
| `RT TAKEN` | Int64 | imported | `0` |  |
| `RT BACKLOG` | Int64 | imported | `0` |  |
| `REMARKS` | String | imported | `nan` |  |

### `Man_Power` — 6 columns, 4,417 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Sub` | String | imported | `nan` |  |
| `Weld Cat` | String | imported | `nan` |  |
| `NDE` | String | imported | `nan` |  |
| `MP` | Int64 | imported | `0` |  |
| `Date` | DateTime | imported | `Long Date` |  |
| `Week Numb` | String | imported | `nan` |  |

### `PIC_vs_Talisman_2026_02_16` — 13 columns, 44,950 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Comparison_Result` | String | imported | `nan` |  |
| `Report_No` | String | imported | `nan` |  |
| `Talisman_Report_No` | String | imported | `nan` |  |
| `PIC_Report_No` | String | imported | `nan` |  |
| `Report_Type` | String | imported | `nan` |  |
| `Report_Date` | DateTime | imported | `Long Date` |  |
| `ISO_Number` | String | imported | `nan` |  |
| `Joint_ID` | String | imported | `nan` |  |
| `Comments` | String | imported | `nan` |  |
| `Joint ID QC Data` | String | imported | `nan` |  |
| `Report QC Data` | String | imported | `nan` |  |
| `Joint ID QC Data Project WD+WR+INCO+Acciona` | 1 | calculated | `nan` |  |
| `RT Report QC Data Project WD+WR+INCO+Acciona` | 1 | calculated | `nan` |  |

### `PWHT Status` — 3 columns, 34 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `WPS No.` | String | imported | `nan` |  |
| `PWHT(Y/N)` | String | imported | `nan` |  |
| `Thickness` | String | imported | `nan` |  |

### `Project WD+WR` — 266 columns, 1 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `Spool ID` | String | imported | `nan` |  |
| `ISO Number` | String | imported | `nan` |  |
| `Iso Rev No.` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Weld No.` | String | imported | `nan` |  |
| `Spool Rev No.` | String | imported | `nan` |  |
| `Weld Cat` | String | imported | `nan` |  |
| `Weld Type` | String | imported | `nan` |  |
| `Dia Inch Factor` | String | imported | `nan` |  |
| `Dia inch` | Double | imported | `nan` |  |
| `Thickness` | Double | imported | `nan` |  |
| `PDS Area` | String | imported | `nan` |  |
| `AG/UG/PKG` | String | imported | `nan` |  |
| `Area Classification` | String | imported | `nan` |  |
| `wbu` | String | imported | `nan` |  |
| `System no` | String | imported | `nan` |  |
| `Testpack No` | String | imported | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `Service class` | String | imported | `nan` |  |
| `Service Cat` | String | imported | `nan` |  |
| `Material Type` | String | imported | `nan` |  |
| `MIR No` | String | imported | `nan` |  |
| `MIR Date` | DateTime | imported | `Long Date` |  |
| `Cutting Date` | DateTime | imported | `Long Date` |  |
| `Beveling Date` | DateTime | imported | `Long Date` |  |
| `Fitup Date` | DateTime | imported | `Long Date` |  |
| `Preheat Date` | DateTime | imported | `Long Date` |  |
| `Weld Date` | DateTime | imported | `Long Date` |  |
| `DWIR No.` | String | imported | `nan` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Rework Code` | String | imported | `nan` |  |
| `Original Joint` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `WeldPoint No.` | Int64 | imported | `0` |  |
| `Weld Point Code` | String | imported | `nan` |  |
| `WPS No.` | String | imported | `nan` |  |
| `Welder` | String | imported | `nan` |  |
| `PWHT Y/N` | String | imported | `nan` |  |
| `PWHT Weld Status` | String | imported | `nan` |  |
| `PWHT Selected Date` | DateTime | imported | `Long Date` |  |
| `PWHT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PWHT Date` | DateTime | imported | `Long Date` |  |
| `PWHT Report` | String | imported | `nan` |  |
| `PWHT Acc/Rej` | String | imported | `nan` |  |
| `PWHT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PWHT Remarks` | String | imported | `nan` |  |
| `HT%` | Int64 | imported | `0` |  |
| `HT Batch No` | String | imported | `nan` |  |
| `HT Batch Status` | String | imported | `nan` |  |
| `HT Weld Status` | String | imported | `nan` |  |
| `HT Selected Date` | DateTime | imported | `Long Date` |  |
| `HT Exam Req date` | DateTime | imported | `Long Date` |  |
| `HT Date` | DateTime | imported | `Long Date` |  |
| `HT Report` | String | imported | `nan` |  |
| `HT Acc/Rej` | String | imported | `nan` |  |
| `HT Client Exam Req Y/N` | String | imported | `nan` |  |
| `HT Remarks` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `RT%` | Int64 | imported | `0` |  |
| `RT Batch No` | String | imported | `nan` |  |
| `RT Batch Status` | String | imported | `nan` |  |
| `RT Weld Status` | String | imported | `nan` |  |
| `RT Selected Date` | DateTime | imported | `Long Date` |  |
| `RT Exam Req date` | DateTime | imported | `Long Date` |  |
| `RT Date` | DateTime | imported | `Long Date` |  |
| `RT Xray No` | String | imported | `nan` |  |
| `RT Report` | String | imported | `nan` |  |
| `RT Acc/Rej` | String | imported | `nan` |  |
| `RT Film Total` | Double | imported | `nan` |  |
| `Total No of films Acc` | Double | imported | `nan` |  |
| `Total No of films Rej` | Double | imported | `0.00` |  |
| `Defect Code` | String | imported | `nan` |  |
| `Location of Defect` | String | imported | `nan` |  |
| `RT Re-Shoot Rep` | String | imported | `nan` |  |
| `RT Re-Shoot Data` | DateTime | imported | `Long Date` |  |
| `RT Re-Shoot Status` | String | imported | `nan` |  |
| `RT Re-Shoot Reason` | String | imported | `nan` |  |
| `RT Re-Shoot Films` | Int64 | imported | `0` |  |
| `Weld Length` | Double | imported | `nan` |  |
| `Rej Length` | Double | imported | `0.000` |  |
| `RT Client Exam Req Y/N` | String | imported | `nan` |  |
| `By UT` | String | imported | `nan` |  |
| `RT Remarks` | String | imported | `nan` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `UT%` | Int64 | imported | `0` |  |
| `UT Batch No` | String | imported | `nan` |  |
| `UT Batch Status` | String | imported | `nan` |  |
| `UT Weld Status` | String | imported | `nan` |  |
| `UT Selected Date` | DateTime | imported | `Long Date` |  |
| `UT Exam Req date` | DateTime | imported | `Long Date` |  |
| `UT Date` | DateTime | imported | `Long Date` |  |
| `UT Report` | String | imported | `nan` |  |
| `UT Acc/Rej` | String | imported | `nan` |  |
| `UT Client Exam Req Y/N` | String | imported | `nan` |  |
| `UT Remarks` | String | imported | `nan` |  |
| `MT%` | Int64 | imported | `0` |  |
| `MT Batch No` | String | imported | `nan` |  |
| `MT Batch Status` | String | imported | `nan` |  |
| `MT Weld Status` | String | imported | `nan` |  |
| `MT Selected Date` | DateTime | imported | `Long Date` |  |
| `MT Exam Req date` | DateTime | imported | `Long Date` |  |
| `MT Date` | DateTime | imported | `Long Date` |  |
| `MT Report` | String | imported | `nan` |  |
| `MT Acc/Rej` | String | imported | `nan` |  |
| `MT Client Exam Req Y/N` | String | imported | `nan` |  |
| `MT Remarks` | String | imported | `nan` |  |
| `PMI%` | Int64 | imported | `0` |  |
| `PMI Batch No` | String | imported | `nan` |  |
| `PMI Batch Status` | String | imported | `nan` |  |
| `PMI Weld Status` | String | imported | `nan` |  |
| `PMI Selected Date` | DateTime | imported | `Long Date` |  |
| `PMI Exam Req date` | DateTime | imported | `Long Date` |  |
| `PMI Date` | DateTime | imported | `Long Date` |  |
| `PMI Report` | String | imported | `nan` |  |
| `PMI Acc/Rej` | String | imported | `nan` |  |
| `PMI Client Exam Req Y/N` | String | imported | `nan` |  |
| `PMI Remarks` | String | imported | `nan` |  |
| `PT%` | Int64 | imported | `0` |  |
| `PT Batch No` | String | imported | `nan` |  |
| `PT Batch Status` | String | imported | `nan` |  |
| `PT Weld Status` | String | imported | `nan` |  |
| `PT Selected Date` | DateTime | imported | `Long Date` |  |
| `PT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PT Date` | DateTime | imported | `Long Date` |  |
| `PT Report` | String | imported | `nan` |  |
| `PT Acc/Rej` | String | imported | `nan` |  |
| `PT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PT Remarks` | String | imported | `nan` |  |
| `FN%` | Int64 | imported | `0` |  |
| `FN Batch No` | String | imported | `nan` |  |
| `FN Batch Status` | String | imported | `nan` |  |
| `FN Weld Status` | String | imported | `nan` |  |
| `FN Selected Date` | DateTime | imported | `Long Date` |  |
| `FN Exam Req date` | DateTime | imported | `Long Date` |  |
| `FN Date` | DateTime | imported | `Long Date` |  |
| `FN Report` | String | imported | `nan` |  |
| `FN Acc/Rej` | String | imported | `nan` |  |
| `FN Client Exam Req Y/N` | String | imported | `nan` |  |
| `FN Remarks` | String | imported | `nan` |  |
| `PADLT Y/N` | String | imported | `nan` |  |
| `PADLT Weld Status` | String | imported | `nan` |  |
| `PADLT Selected Date` | DateTime | imported | `Long Date` |  |
| `PADLT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PADLT Date` | DateTime | imported | `Long Date` |  |
| `PADLT Report` | String | imported | `nan` |  |
| `PADLT Acc/Rej` | String | imported | `nan` |  |
| `PADLT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PADLT Remarks` | String | imported | `nan` |  |
| `ORIF Y/N` | String | imported | `nan` |  |
| `ORIF Weld Status` | String | imported | `nan` |  |
| `ORIF Selected Date` | DateTime | imported | `Long Date` |  |
| `ORIF Exam Req date` | DateTime | imported | `Long Date` |  |
| `ORIF Date` | DateTime | imported | `Long Date` |  |
| `ORIF Report` | String | imported | `nan` |  |
| `ORIF Acc/Rej` | String | imported | `nan` |  |
| `ORIF Client Exam Req Y/N` | String | imported | `nan` |  |
| `Matrl Traceability Y/N` | String | imported | `nan` |  |
| `GROUP-1` | String | imported | `nan` |  |
| `IDENT CODE-1` | String | imported | `nan` |  |
| `TRAC NO-1` | String | imported | `nan` |  |
| `Part 1` | String | imported | `nan` |  |
| `GROUP-2` | String | imported | `nan` |  |
| `IDENT CODE-2` | String | imported | `nan` |  |
| `TRAC NO-2` | String | imported | `nan` |  |
| `Part 2` | String | imported | `nan` |  |
| `Revision Status` | String | imported | `nan` |  |
| `Revision Comments` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `Piping Group` | String | imported | `nan` |  |
| `Golden Weld Report Date` | String | imported | `nan` |  |
| `Golden Weld Report No` | String | imported | `nan` |  |
| `Custom3` | String | imported | `nan` |  |
| `Custom11` | String | imported | `nan` |  |
| `Custom12` | String | imported | `nan` |  |
| `Custom13` | String | imported | `nan` |  |
| `Subsystem Code` | String | imported | `nan` |  |
| `No of Days "PR"` | 1 | calculated | `0` |  |
| `Last_Weld Date "PR"` | 1 | calculated | `d mmmm\, yyyy` |  |
| `Days Since Last Weld "PR"` | 1 | calculated | `nan` |  |
| `RT Film Ratio % "PR" For Welder` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `Repair & Reweld "PR"` | 1 | calculated | `nan` |  |
| `RT FILM Ratio % STATUS "PR"` | 1 | calculated | `nan` |  |
| `PWHT Y/N CCC` | 1 | calculated | `nan` |  |
| `PWHT Report No CCC` | 1 | calculated | `nan` |  |
| `PWHT Date No CCC` | DateTime | calculated | `d mmmm\, yyyy` |  |
| `Joint Uniq "PR" Total` | 1 | calculated | `0` |  |
| `MT Report CCC` | 1 | calculated | `nan` |  |
| `MT Date CCC` | 1 | calculated | `dd-mmm-yy` |  |
| `MT% CCC` | 1 | calculated | `0` |  |
| `Total Welded Dia "PR" Table` | 1 | calculated | `nan` |  |
| `% of Total Reject` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `Last Spool Status "WD"` | 1 | calculated | `nan` |  |
| `LINE` | 1 | calculated | `nan` |  |
| `RT Film Ratio % "PR" For SERVICE Class` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT FILM Ratio % STATUS for Service Class "PR"` | 1 | calculated | `nan` |  |
| `RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT FILM Ratio % STATUS for Service Class By SUBCON "PR"` | 1 | calculated | `nan` |  |
| `RT Ratio % For Welder (<5% ; >5%) "PR"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT Ratio % STATUS for Welder Cover 5% "PR"` | 1 | calculated | `nan` |  |
| `No of Days Fit-UP - TODAY "PR"` | 1 | calculated | `0` |  |
| `No Of Days Fit-UP - Today STATUS "PR"` | 1 | calculated | `nan` |  |
| `No of Days Weld Date - TODAY "PR"` | 1 | calculated | `0` |  |
| `No Of Days Weld Date - Today RT STATUS "PR"` | 1 | calculated | `nan` |  |
| `Service Class + Service Cat+NDT Remarks` | 1 | calculated | `nan` |  |
| `Welder ID` | 1 | calculated | `nan` |  |
| `UT Operator ID` | String | imported | `nan` |  |
| `Manual UT Date` | DateTime | imported | `Long Date` |  |
| `Manual UT Report No` | String | imported | `nan` |  |
| `Manual UT Status` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `TPI Cross Checked` | String | imported | `nan` |  |
| `Checked Date` | DateTime | imported | `Long Date` |  |
| `Result (A/R)` | String | imported | `nan` |  |
| `PWHT Selected By` | String | imported | `nan` |  |
| `PWHT Exam Req No` | String | imported | `nan` |  |
| `PWHT Exam Req By` | String | imported | `nan` |  |
| `HT Selected By` | String | imported | `nan` |  |
| `HT Exam Req No` | String | imported | `nan` |  |
| `HT Exam Req By` | String | imported | `nan` |  |
| `RT Selected By` | String | imported | `nan` |  |
| `RT Exam Req No` | String | imported | `nan` |  |
| `RT Exam Req By` | String | imported | `nan` |  |
| `UT Selected By` | String | imported | `nan` |  |
| `UT Exam Req No` | String | imported | `nan` |  |
| `UT Exam Req By` | String | imported | `nan` |  |
| `MT Selected By` | String | imported | `nan` |  |
| `MT Exam Req No` | String | imported | `nan` |  |
| `MT Exam Req By` | String | imported | `nan` |  |
| `PMI Selected By` | String | imported | `nan` |  |
| `PMI Exam Req No` | String | imported | `nan` |  |
| `PMI Exam Req By` | String | imported | `nan` |  |
| `PT Selected By` | String | imported | `nan` |  |
| `PT Exam Req No` | String | imported | `nan` |  |
| `PT Exam Req By` | String | imported | `nan` |  |
| `FN Selected By` | String | imported | `nan` |  |
| `FN Exam Req No` | String | imported | `nan` |  |
| `FN Exam Req By` | String | imported | `nan` |  |
| `PADLT Selected By` | String | imported | `nan` |  |
| `PADLT Exam Req No` | String | imported | `nan` |  |
| `PADLT Exam Req By` | String | imported | `nan` |  |
| `ORIF Selected By` | String | imported | `nan` |  |
| `ORIF Exam Req No` | String | imported | `nan` |  |
| `ORIF Exam Req By` | String | imported | `nan` |  |
| `PED` | String | imported | `nan` |  |
| `Priority No` | String | imported | `nan` |  |
| `GWBS` | String | imported | `nan` |  |
| `PDS Area Type` | String | imported | `nan` |  |
| `SHIPMENT DATE` | String | imported | `nan` |  |
| ` SHIPMENT RECV DATE` | String | imported | `nan` |  |
| ` EREC MIR DATE` | String | imported | `nan` |  |
| ` EREC MIR NO` | String | imported | `nan` |  |
| ` SHEET NO` | String | imported | `nan` |  |
| `PIP-001-A` | String | imported | `nan` |  |
| `W24DWIR` | String | imported | `nan` |  |
| `BHS` | String | imported | `nan` |  |
| ` TESTPACK SUB CONTRACTOR` | String | imported | `nan` |  |
| ` TESTPACK TEST DONE DATE` | DateTime | imported | `Long Date` |  |
| `PIP-124-A` | String | imported | `nan` |  |
| `WHS` | String | imported | `nan` |  |
| `PACKING LIST NO` | String | imported | `nan` |  |
| `Last Reshoot Date.1` | String | imported | `nan` |  |
| `Last Reshoot Report No.1` | String | imported | `nan` |  |
| `Last Reshoot Result.1` | String | imported | `nan` |  |
| `Golden Weld` | String | imported | `nan` |  |

### `Project WD+WR+INCO+Acciona` — 425 columns, 6,546,261 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `Spool ID` | String | imported | `nan` |  |
| `ISO Number` | String | imported | `nan` |  |
| `Iso Rev No.` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Weld No.` | String | imported | `nan` |  |
| `Spool Rev No.` | String | imported | `nan` |  |
| `Weld Cat` | String | imported | `nan` |  |
| `Weld Type` | String | imported | `nan` |  |
| `Dia Inch Factor` | String | imported | `nan` |  |
| `Dia inch` | Double | imported | `nan` |  |
| `Thickness` | Double | imported | `nan` |  |
| `PDS Area` | String | imported | `nan` |  |
| `AG/UG/PKG` | String | imported | `nan` |  |
| `Area Classification` | String | imported | `nan` |  |
| `wbu` | String | imported | `nan` |  |
| `System no` | String | imported | `nan` |  |
| `Testpack No` | String | imported | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `Service class` | String | imported | `nan` |  |
| `Service Cat` | String | imported | `nan` |  |
| `Material Type` | String | imported | `nan` |  |
| `MIR No` | String | imported | `nan` |  |
| `MIR Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Cutting Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Beveling Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Fitup Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Preheat Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Weld Date` | DateTime | imported | `dd-mmm-yy` |  |
| `DWIR No.` | String | imported | `nan` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Rework Code` | String | imported | `nan` |  |
| `Original Joint` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `WeldPoint No.` | Int64 | imported | `0` |  |
| `Weld Point Code` | String | imported | `nan` |  |
| `WPS No.` | String | imported | `nan` |  |
| `Welder` | String | imported | `nan` |  |
| `PWHT Y/N` | String | imported | `nan` |  |
| `PWHT Weld Status` | String | imported | `nan` |  |
| `PWHT Selected Date` | DateTime | imported | `dd-mmm-yy` |  |
| `PWHT Exam Req date` | DateTime | imported | `yyyy-mm-dd` |  |
| `PWHT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `PWHT Report` | String | imported | `nan` |  |
| `PWHT Acc/Rej` | String | imported | `nan` |  |
| `PWHT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PWHT Remarks` | String | imported | `nan` |  |
| `HT%` | Int64 | imported | `0` |  |
| `HT Batch No` | String | imported | `nan` |  |
| `HT Batch Status` | String | imported | `nan` |  |
| `HT Weld Status` | String | imported | `nan` |  |
| `HT Selected Date` | DateTime | imported | `Long Date` |  |
| `HT Exam Req date` | DateTime | imported | `Long Date` |  |
| `HT Date` | DateTime | imported | `Long Date` |  |
| `HT Report` | String | imported | `nan` |  |
| `HT Acc/Rej` | String | imported | `nan` |  |
| `HT Client Exam Req Y/N` | String | imported | `nan` |  |
| `HT Remarks` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `RT%` | Int64 | imported | `0` |  |
| `RT Batch No` | String | imported | `nan` |  |
| `RT Batch Status` | String | imported | `nan` |  |
| `RT Weld Status` | String | imported | `nan` |  |
| `RT Selected Date` | DateTime | imported | `Long Date` |  |
| `RT Exam Req date` | DateTime | imported | `Long Date` |  |
| `RT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `RT Xray No` | String | imported | `nan` |  |
| `RT Report` | String | imported | `nan` |  |
| `RT Acc/Rej` | String | imported | `nan` |  |
| `RT Film Total` | Double | imported | `nan` |  |
| `Total No of films Acc` | Double | imported | `0.00` |  |
| `Total No of films Rej` | Double | imported | `0.00` |  |
| `Defect Code` | String | imported | `nan` |  |
| `Location of Defect` | String | imported | `nan` |  |
| `RT Re-Shoot Rep` | String | imported | `nan` |  |
| `RT Re-Shoot Data` | DateTime | imported | `dd-mmm-yy` |  |
| `RT Re-Shoot Status` | String | imported | `nan` |  |
| `RT Re-Shoot Reason` | String | imported | `nan` |  |
| `RT Re-Shoot Films` | Int64 | imported | `0` |  |
| `Weld Length` | Double | imported | `#,0.000` |  |
| `Rej Length` | Double | imported | `0.000` |  |
| `RT Client Exam Req Y/N` | String | imported | `nan` |  |
| `By UT` | String | imported | `nan` |  |
| `RT Remarks` | String | imported | `nan` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `UT%` | Int64 | imported | `0` |  |
| `UT Batch No` | String | imported | `nan` |  |
| `UT Batch Status` | String | imported | `nan` |  |
| `UT Weld Status` | String | imported | `nan` |  |
| `UT Selected Date` | DateTime | imported | `Long Date` |  |
| `UT Exam Req date` | DateTime | imported | `Long Date` |  |
| `UT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `UT Report` | String | imported | `nan` |  |
| `UT Acc/Rej` | String | imported | `nan` |  |
| `UT Client Exam Req Y/N` | String | imported | `nan` |  |
| `UT Remarks` | String | imported | `nan` |  |
| `MT%` | Int64 | imported | `0` |  |
| `MT Batch No` | String | imported | `nan` |  |
| `MT Batch Status` | String | imported | `nan` |  |
| `MT Weld Status` | String | imported | `nan` |  |
| `MT Selected Date` | DateTime | imported | `Long Date` |  |
| `MT Exam Req date` | DateTime | imported | `Long Date` |  |
| `MT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `MT Report` | String | imported | `nan` |  |
| `MT Acc/Rej` | String | imported | `nan` |  |
| `MT Client Exam Req Y/N` | String | imported | `nan` |  |
| `MT Remarks` | String | imported | `nan` |  |
| `PMI%` | Int64 | imported | `0` |  |
| `PMI Batch No` | String | imported | `nan` |  |
| `PMI Batch Status` | String | imported | `nan` |  |
| `PMI Weld Status` | String | imported | `nan` |  |
| `PMI Selected Date` | DateTime | imported | `Long Date` |  |
| `PMI Exam Req date` | DateTime | imported | `Long Date` |  |
| `PMI Date` | DateTime | imported | `Long Date` |  |
| `PMI Report` | String | imported | `nan` |  |
| `PMI Acc/Rej` | String | imported | `nan` |  |
| `PMI Client Exam Req Y/N` | String | imported | `nan` |  |
| `PMI Remarks` | String | imported | `nan` |  |
| `PT%` | Int64 | imported | `0` |  |
| `PT Batch No` | String | imported | `nan` |  |
| `PT Batch Status` | String | imported | `nan` |  |
| `PT Weld Status` | String | imported | `nan` |  |
| `PT Selected Date` | DateTime | imported | `Long Date` |  |
| `PT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PT Date` | DateTime | imported | `Long Date` |  |
| `PT Report` | String | imported | `nan` |  |
| `PT Acc/Rej` | String | imported | `nan` |  |
| `PT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PT Remarks` | String | imported | `nan` |  |
| `FN%` | Int64 | imported | `0` |  |
| `FN Batch No` | String | imported | `nan` |  |
| `FN Batch Status` | String | imported | `nan` |  |
| `FN Weld Status` | String | imported | `nan` |  |
| `FN Selected Date` | DateTime | imported | `Long Date` |  |
| `FN Exam Req date` | DateTime | imported | `Long Date` |  |
| `FN Date` | DateTime | imported | `Long Date` |  |
| `FN Report` | String | imported | `nan` |  |
| `FN Acc/Rej` | String | imported | `nan` |  |
| `FN Client Exam Req Y/N` | String | imported | `nan` |  |
| `FN Remarks` | String | imported | `nan` |  |
| `PADLT Y/N` | String | imported | `nan` |  |
| `PADLT Weld Status` | String | imported | `nan` |  |
| `PADLT Selected Date` | DateTime | imported | `Long Date` |  |
| `PADLT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PADLT Date` | DateTime | imported | `Long Date` |  |
| `PADLT Report` | String | imported | `nan` |  |
| `PADLT Acc/Rej` | String | imported | `nan` |  |
| `PADLT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PADLT Remarks` | String | imported | `nan` |  |
| `ORIF Y/N` | String | imported | `nan` |  |
| `ORIF Weld Status` | String | imported | `nan` |  |
| `ORIF Selected Date` | DateTime | imported | `Long Date` |  |
| `ORIF Exam Req date` | DateTime | imported | `Long Date` |  |
| `ORIF Date` | DateTime | imported | `Long Date` |  |
| `ORIF Report` | String | imported | `nan` |  |
| `ORIF Acc/Rej` | String | imported | `nan` |  |
| `ORIF Client Exam Req Y/N` | String | imported | `nan` |  |
| `Matrl Traceability Y/N` | String | imported | `nan` |  |
| `GROUP-1` | String | imported | `nan` |  |
| `IDENT CODE-1` | String | imported | `nan` |  |
| `TRAC NO-1` | String | imported | `nan` |  |
| `Part 1` | String | imported | `nan` |  |
| `GROUP-2` | String | imported | `nan` |  |
| `IDENT CODE-2` | String | imported | `nan` |  |
| `TRAC NO-2` | String | imported | `nan` |  |
| `Part 2` | String | imported | `nan` |  |
| `Revision Status` | String | imported | `nan` |  |
| `Revision Comments` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `Piping Group` | String | imported | `nan` |  |
| `Golden Weld Report Date` | String | imported | `nan` |  |
| `Golden Weld Report No` | String | imported | `nan` |  |
| `Custom3` | String | imported | `nan` |  |
| `Custom4` | String | imported | `nan` |  |
| `Custom5` | String | imported | `nan` |  |
| `Custom6` | String | imported | `nan` |  |
| `Custom7` | String | imported | `nan` |  |
| `Custom8` | String | imported | `nan` |  |
| `Custom9` | String | imported | `nan` |  |
| `Custom10` | String | imported | `nan` |  |
| `Custom11` | String | imported | `nan` |  |
| `Custom12` | String | imported | `nan` |  |
| `Custom13` | String | imported | `nan` |  |
| `Custom14` | String | imported | `nan` |  |
| `Subsystem Code` | String | imported | `nan` |  |
| `PED` | String | imported | `nan` |  |
| `Aditional Joint No.RT` | String | imported | `nan` |  |
| `Repair Length (mm)` | Int64 | imported | `0` |  |
| `RT P1 Rep.` | String | imported | `nan` |  |
| `P1 Date` | DateTime | imported | `Long Date` |  |
| `RT P2 Rep.` | String | imported | `nan` |  |
| `P2 Date` | DateTime | imported | `Long Date` |  |
| `Category 1` | String | imported | `nan` |  |
| `Category 2` | String | imported | `nan` |  |
| `Drg No` | String | imported | `nan` |  |
| `process` | String | imported | `nan` |  |
| `Fitup Report No.` | String | imported | `nan` |  |
| `First Prod. Joint` | String | imported | `nan` |  |
| `VBT Report` | String | imported | `nan` |  |
| `VBT Date` | DateTime | imported | `Long Date` |  |
| `OPT Report` | String | imported | `nan` |  |
| `OPT Date` | DateTime | imported | `Long Date` |  |
| `Repair & Reweld "PR all"` | 1 | calculated | `nan` |  |
| `No of Days "PR all"` | 1 | calculated | `0` |  |
| `Last_Weld Date "PR all"` | 1 | calculated | `d mmmm\, yyyy` |  |
| `Days Since Last Weld` | 1 | calculated | `nan` |  |
| `RT Film Ratio % "PR all" For Welder` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT FILM Ratio % STATUS "PR all"` | 1 | calculated | `nan` |  |
| `PWHT Y/N CCC` | 1 | calculated | `nan` |  |
| `PWHT Report No CCC` | 1 | calculated | `nan` |  |
| `PWHT Date No CCC` | 1 | calculated | `d mmmm\, yyyy` |  |
| `MT Report CCC` | 1 | calculated | `nan` |  |
| `MT Date CCC` | 1 | calculated | `d mmmm\, yyyy` |  |
| `MT% CCC` | 1 | calculated | `0` |  |
| `Total Welded Dia "PR all" Table` | 1 | calculated | `nan` |  |
| `% of Total Reject` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `Service Class + Service Cat+NDT Remarks` | 1 | calculated | `nan` |  |
| `RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT FILM Ratio % STATUS for Service Class By SUBCON "PR all"` | 1 | calculated | `nan` |  |
| `RT Ratio % For Welder (<5% ; >5%) "PR all"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT Ratio % STATUS for Welder Cover 5% "PR all"` | 1 | calculated | `nan` |  |
| `No of Days Fit-UP - TODAY "PR all"` | 1 | calculated | `0` |  |
| `No Of Days Fit-UP - Today STATUS "PR all"` | 1 | calculated | `nan` |  |
| `No of Days Weld Date - TODAY "PR all"` | 1 | calculated | `0` |  |
| `No Of Days Weld Date - Today RT STATUS "PR all"` | 1 | calculated | `nan` |  |
| `Welder ID` | 1 | calculated | `nan` |  |
| `Joint Uniq "PR all" Column` | 1 | calculated | `0` |  |
| `Last_RT Date "PR all"` | 1 | calculated | `dd-mmm-yy` |  |
| `Days Since Last RT` | Int64 | calculated | `0` |  |
| `RT Film Ratio % "PR all" For Welder LAST 2 WEEKS` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT FILM Ratio % STATUS LAST 2 WEEKS` | 1 | calculated | `nan` |  |
| `2 weeks Period for RT` | 1 | calculated | `nan` |  |
| `Report TYPE` | 1 | calculated | `nan` |  |
| `TMCP Pipe` | 1 | calculated | `nan` |  |
| `Weld Length "PR all"` | 1 | calculated | `nan` |  |
| `PWHT Status PR ALL` | 1 | calculated | `nan` |  |
| `TESTPACK No "PR All"` | 1 | calculated | `nan` |  |
| `TP Ratio % Complete "PR all"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `TP Ratio % STATUS` | 1 | calculated | `nan` |  |
| `UT Report "PR All"` | 1 | calculated | `nan` |  |
| `UT Ratio % For Welder (<5% ; >5%) "PR all"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `UT Operator ID.` | 1 | calculated | `nan` |  |
| `Manual UT Date.` | DateTime | calculated | `mmmm d\, yyyy` |  |
| `Manual UT Report No.` | 1 | calculated | `nan` |  |
| `Manual UT Status.` | 1 | calculated | `nan` |  |
| `Inspected Length(MM).` | 1 | calculated | `nan` |  |
| `Defect Length(MM).` | Double | calculated | `0.0000` |  |
| `Cross Verification-by CTJV (TPI).` | 1 | calculated | `nan` |  |
| `CTJV VERIFICATION Date.` | 1 | calculated | `d mmmm\, yyyy` |  |
| `CTJV VERIFICATION BY.` | 1 | calculated | `nan` |  |
| `UT Rej Length Rate % "PR all" For Welder` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `UT Rej Rate % STATUS for Welder by Length` | 1 | calculated | `nan` |  |
| `UT Rej Rate % "PR all" For Welder by Joint` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `UT Rej Rate % STATUS for Welder by Joint` | 1 | calculated | `nan` |  |
| `UT Rej Rate % by joint "PR all" For Sub-Con` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `UT Rej Rate % STATUS for Sub-Con by Joint` | 1 | calculated | `nan` |  |
| `Weld Point First` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `PWHT Report "PR All"` | 1 | calculated | `nan` |  |
| `PWHT Date "PR All"` | 1 | calculated | `dd-mmm-yy` |  |
| `UT Date "PR All"` | 1 | calculated | `d mmmm\, yyyy` |  |
| `MT Report "PR All"` | 1 | calculated | `nan` |  |
| `MT Date "PR All"` | 1 | calculated | `d mmmm\, yyyy` |  |
| `MT % "PR All"` | 1 | calculated | `0` |  |
| `PMI Report CCC` | 1 | calculated | `nan` |  |
| `PMI Date CCC` | 1 | calculated | `d mmmm\, yyyy` |  |
| `PMI% CCC` | Int64 | calculated | `0` |  |
| `PMI % "PR All"` | 1 | calculated | `nan` |  |
| `PMI Report "PR All"` | 1 | calculated | `nan` |  |
| `PMI Date "PR All"` | 1 | calculated | `d mmmm\, yyyy` |  |
| `PT% CCC` | 1 | calculated | `0` |  |
| `PT Report CCC` | 1 | calculated | `nan` |  |
| `PT Date CCC` | 1 | calculated | `d mmmm\, yyyy` |  |
| `PT % "PR All"` | 1 | calculated | `0` |  |
| `PT Report "PR All"` | 1 | calculated | `nan` |  |
| `PT Date "PR All"` | 1 | calculated | `d mmmm\, yyyy` |  |
| `HT Report CCC` | 1 | calculated | `nan` |  |
| `HT Date CCC` | 1 | calculated | `d mmmm\, yyyy` |  |
| `HT% CCC` | 1 | calculated | `0` |  |
| `HT % "PR All"` | 1 | calculated | `0` |  |
| `HT Report "PR All"` | 1 | calculated | `nan` |  |
| `HT Date "PR All"` | 1 | calculated | `d mmmm\, yyyy` |  |
| `UT Rej Rate % by Length "PR all" For Sub-Con` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `UT Rej Rate % STATUS for Sub-Con by Length` | 1 | calculated | `nan` |  |
| `RT Film Ratio % "PR all" For Welder LAST 1 MONTH` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT FILM Ratio % STATUS LAST 1 Month` | 1 | calculated | `nan` |  |
| `CROSS CHECK DATA & Talisman JOINT ID` | 1 | calculated | `nan` |  |
| `RT CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `MT CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `PWHT CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `UT CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `PMI CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `PT CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `HT CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `ORIF CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `PADLT CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `TPI Cross Checked` | String | imported | `nan` |  |
| `Checked Date` | DateTime | imported | `Long Date` |  |
| `Result (A/R)` | String | imported | `nan` |  |
| `UT Operator ID` | String | imported | `nan` |  |
| `Manual UT Date` | DateTime | imported | `Long Date` |  |
| `Manual UT Report No` | String | imported | `nan` |  |
| `Manual UT Status` | String | imported | `nan` |  |
| `FT Report` | String | imported | `nan` |  |
| `UT Status TR/FL` | 1 | calculated | `nan` |  |
| `Spool ID Status` | 1 | calculated | `nan` |  |
| `UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `UT Rej Rate % STATUS for Welder by Length Last 2 Weeks` | 1 | calculated | `nan` |  |
| `Last_UT Date "PR all"` | 1 | calculated | `dd-mmm-yy` |  |
| `Days Since Last UT` | 1 | calculated | `nan` |  |
| `VI CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `Spool ID CCC PWHT Status` | 1 | calculated | `nan` |  |
| `CountDelimiter` | Int64 | imported | `0` |  |
| `Count Rows.Count` | Int64 | imported | `0` |  |
| `VBT CROSS CHECK PRJ Data & FRB` | 1 | calculated | `nan` |  |
| `LINE` | 1 | calculated | `nan` |  |
| `First_Weld Date "PR all"` | 1 | calculated | `dd-mmm-yy` |  |
| `Days Since First Weld` | 1 | calculated | `nan` |  |
| `Dia Inch >20<` | 1 | calculated | `nan` |  |
| `WeldPoint No.1 WP1` | 1 | calculated | `0` |  |
| `Index` | Int64 | imported | `0` |  |
| `Duplicate Weld Date` | 1 | calculated | `0` |  |
| `Duplicate RT Date` | 1 | calculated | `0` |  |
| `TP Complete %` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all" STATUS` | 1 | calculated | `nan` |  |
| `BATCH QTY Joints` | 1 | calculated | `0` |  |
| `QTY Welder ID & No RT by Service Class + Service Cat+NDT Remarks` | 1 | calculated | `0` |  |
| `Has_RT_Report` | 1 | calculated | `0` |  |
| `Service Class + Service Cat+NDT Remarks+Welder ID` | 1 | calculated | `nan` |  |
| `Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `Inco Rej Rate % STATUS for Welder by Length Last 2 Weeks` | 1 | calculated | `nan` |  |
| `Inco Length Ratio % "PR all" For Welder LAST 1 Month` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `Inco Rej Rate % STATUS for Welder by Length Last 1 Month` | 1 | calculated | `nan` |  |
| `Status Fabricated from "WD"` | 1 | calculated | `nan` |  |
| `Status Spool NDE from "WD"` | 1 | calculated | `nan` |  |
| `Last Spool Status from "WD"` | 1 | calculated | `nan` |  |
| `Weld CAT (NEW)` | 1 | calculated | `nan` |  |
| `Duplicate RT Report` | 1 | calculated | `0` |  |
| `By UT All` | 1 | calculated | `nan` |  |
| `PWHT Selected By` | String | imported | `nan` |  |
| `PWHT Exam Req No` | String | imported | `nan` |  |
| `PWHT Exam Req By` | String | imported | `nan` |  |
| `HT Selected By` | String | imported | `nan` |  |
| `HT Exam Req No` | String | imported | `nan` |  |
| `HT Exam Req By` | String | imported | `nan` |  |
| `RT Selected By` | String | imported | `nan` |  |
| `RT Exam Req No` | String | imported | `nan` |  |
| `RT Exam Req By` | String | imported | `nan` |  |
| `UT Selected By` | String | imported | `nan` |  |
| `UT Exam Req No` | String | imported | `nan` |  |
| `UT Exam Req By` | String | imported | `nan` |  |
| `MT Selected By` | String | imported | `nan` |  |
| `MT Exam Req No` | String | imported | `nan` |  |
| `MT Exam Req By` | String | imported | `nan` |  |
| `PMI Selected By` | String | imported | `nan` |  |
| `PMI Exam Req No` | String | imported | `nan` |  |
| `PMI Exam Req By` | String | imported | `nan` |  |
| `PT Selected By` | String | imported | `nan` |  |
| `PT Exam Req No` | String | imported | `nan` |  |
| `PT Exam Req By` | String | imported | `nan` |  |
| `FN Selected By` | String | imported | `nan` |  |
| `FN Exam Req No` | String | imported | `nan` |  |
| `FN Exam Req By` | String | imported | `nan` |  |
| `PADLT Selected By` | String | imported | `nan` |  |
| `PADLT Exam Req No` | String | imported | `nan` |  |
| `PADLT Exam Req By` | String | imported | `nan` |  |
| `ORIF Selected By` | String | imported | `nan` |  |
| `ORIF Exam Req No` | String | imported | `nan` |  |
| `ORIF Exam Req By` | String | imported | `nan` |  |
| `Priority No` | String | imported | `nan` |  |
| `GWBS` | String | imported | `nan` |  |
| `PDS Area Type` | String | imported | `nan` |  |
| `SHIPMENT DATE` | String | imported | `nan` |  |
| ` SHIPMENT RECV DATE` | String | imported | `nan` |  |
| ` EREC MIR DATE` | String | imported | `nan` |  |
| ` EREC MIR NO` | String | imported | `nan` |  |
| ` SHEET NO` | String | imported | `nan` |  |
| `PIP-001-A` | String | imported | `nan` |  |
| `W24DWIR` | String | imported | `nan` |  |
| `BHS` | String | imported | `nan` |  |
| `PWHT Y/N CCC (NEW)` | 1 | calculated | `nan` |  |
| `PWHT Y/N CCC True/False Status` | 1 | calculated | `nan` |  |
| `Thickness From "JR"` | 1 | calculated | `nan` |  |
| `Thickness from "JR" True/False Status` | 1 | calculated | `nan` |  |
| `WPS From "Talisman"` | 1 | calculated | `nan` |  |
| `WPS from "Talisman" True/False Status` | 1 | calculated | `nan` |  |
| `DWIR CCC From "JR"` | 1 | calculated | `nan` |  |
| `DWIR Report "PR All"` | 1 | calculated | `nan` |  |
| ` TESTPACK SUB CONTRACTOR` | String | imported | `nan` |  |
| ` TESTPACK TEST DONE DATE` | DateTime | imported | `dd-mmm-yy` |  |
| `PIP-124-A` | String | imported | `nan` |  |
| `WHS` | String | imported | `nan` |  |
| `HA` | 1 | calculated | `nan` |  |
| `Days Between RT Selected and RT Date` | 1 | calculated | `0` |  |
| `Duplicate RT Report by Joint` | 1 | calculated | `0` |  |
| `Week_End_Date from Calendar` | 1 | calculated | `dd-mmm-yy` |  |
| `MonthRT` | DateTime | calculated | `mmmm d` |  |
| `YearRT` | 1 | calculated | `nan` |  |
| `Exlude Full Cut & Debris` | 1 | calculated | `nan` |  |
| `Service Class + Service Cat+NDT Remarks+Sub-Contractor` | 1 | calculated | `nan` |  |
| `Rework Code "PR All"` | 1 | calculated | `nan` |  |
| `Temporary Lines` | 1 | calculated | `nan` |  |
| `PACKING LIST NO` | String | imported | `nan` |  |
| `Train SG` | 1 | calculated | `nan` |  |
| `Open_Punch_"X"` | 1 | calculated | `0` |  |
| `Reinstatement_Date` | 1 | calculated | `dd-mmm-yy` |  |
| `Open_Punch_"Y"` | 1 | calculated | `nan` |  |
| `Open_Punch_"Z"` | 1 | calculated | `0` |  |
| `RT Ratio % For WPS "PR all"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT Ratio % STATUS for WPS` | 1 | calculated | `nan` |  |
| `RT Ratio % For Material Type "PR all"` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `RT Ratio % STATUS for Material Type` | 1 | calculated | `nan` |  |
| `Status WPQ Welding Process` | 1 | calculated | `nan` |  |
| `Status WPQ Type of Welding Machine` | 1 | calculated | `nan` |  |
| `Last Reshoot Date.1` | String | imported | `nan` |  |
| `Last Reshoot Report No.1` | String | imported | `nan` |  |
| `Last Reshoot Result.1` | String | imported | `nan` |  |
| `Bracing` | 1 | calculated | `nan` |  |
| `Golden Weld` | String | imported | `nan` |  |
| `Task_Status PIP-018-A "VPR"` | 1 | calculated | `nan` |  |
| `Stainless steel` | 1 | calculated | `nan` |  |
| `Exlude RT Films from UT` | 1 | calculated | `nan` |  |
| `Joint ID for Heat N` | String | imported | `nan` |  |

### `RT Films Att RT_MI Master Register` — 23 columns, 177,148 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Sl.No.` | Int64 | imported | `0` |  |
| `Report No` | String | imported | `nan` |  |
| `Quantity of RT Films` | Int64 | imported | `0` |  |
| `ISO number` | String | imported | `nan` |  |
| `Weld Joint number` | String | imported | `nan` |  |
| `Date of exposure` | DateTime | imported | `Long Date` |  |
| `Box No` | String | imported | `nan` |  |
| `Sub-Box No` | String | imported | `nan` |  |
| `HANDOVER AREA` | String | imported | `nan` |  |
| `SCTR` | String | imported | `nan` |  |
| `Column3` | String | imported | `nan` |  |
| ` Seal # ` | String | imported | `nan` |  |
| `RT Films Register No.` | String | imported | `nan` |  |
| `Remarks` | String | imported | `nan` |  |
| `Column1` | String | imported | `nan` |  |
| `Column2` | String | imported | `nan` |  |
| `Remarks (Quantity of RT Films as per Viktor repor)` | Int64 | imported | `0` |  |
| `RT Report No` | String | imported | `nan` |  |
| `Report Match` | 1 | calculated | `nan` |  |
| `Report Match 2` | 1 | calculated | `nan` |  |
| `VPR RT Films` | 1 | calculated | `0` |  |
| `RT Films Difference` | 1 | calculated | `nan` |  |
| `RT Films Diff <1>` | 1 | calculated | `nan` |  |

### `RT Films For PBI WD+WR` — 14 columns, 186,258 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Sub-Contractor` | String | imported | `nan` |  |
| `HA` | String | imported | `nan` |  |
| `RT Report` | String | imported | `nan` |  |
| `RT Total Films by Joint +"CCC RS"+ "Talisman not found" "PR all"` | Double | imported | `nan` |  |
| `RT Total Films +"CCC RS"` | Double | imported | `nan` |  |
| `RT Total Films` | Double | imported | `nan` |  |
| `Acc Films` | Double | imported | `nan` |  |
| `REJ Films` | Int64 | imported | `0` |  |
| `First RT Acc/Rej` | String | imported | `nan` |  |
| `REJ Films ПРОБНЫЙ` | Int64 | imported | `0` |  |
| `RT Total Films RS` | Double | imported | `nan` |  |
| `RT Total Films -"RS"` | Double | imported | `nan` |  |
| `RT Total Films - "RS" "A"` | Double | imported | `nan` |  |
| `Count of RT Report` | Int64 | imported | `0` |  |

### `SCDB Data l0_scdb_task` — 74 columns, 33,526 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Task_ID` | String | imported | `nan` |  |
| `Description` | String | imported | `nan` |  |
| `Task_Status` | String | imported | `nan` |  |
| `Test_Form_Description` | String | imported | `nan` |  |
| `Task_Model` | String | imported | `nan` |  |
| `Task_Type` | String | imported | `nan` |  |
| `Check_In_Date` | DateTime | imported | `Long Date` |  |
| `Check_Out_Date` | DateTime | imported | `Long Date` |  |
| `Modified_Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Modified_By` | String | imported | `nan` |  |
| `Created_Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Created_By` | String | imported | `nan` |  |
| `Start_Date` | DateTime | imported | `Long Date` |  |
| `Submitted_Date` | DateTime | imported | `Long Date` |  |
| `Submitted_By` | String | imported | `nan` |  |
| `Completed_Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Completed_By` | String | imported | `nan` |  |
| `Closing_Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Closed_By` | String | imported | `nan` |  |
| `Asset_Tag_Description` | String | imported | `nan` |  |
| `Status` | String | imported | `nan` |  |
| `Comments` | String | imported | `nan` |  |
| `Asset_Discipline` | String | imported | `nan` |  |
| `Responsible_Workgroup_Name` | String | imported | `nan` |  |
| `Cable_Drum` | String | imported | `nan` |  |
| `Comment_Section` | String | imported | `nan` |  |
| `Loop_No` | String | imported | `nan` |  |
| `Activity_Description` | String | imported | `nan` |  |
| `Activity` | String | imported | `nan` |  |
| `Phase` | String | imported | `nan` |  |
| `Project` | String | imported | `nan` |  |
| `Physical_Location_Area_Summary` | String | imported | `nan` |  |
| `Physical_Location_Facility_Summary` | String | imported | `nan` |  |
| `Plant` | String | imported | `nan` |  |
| `System_ID` | String | imported | `nan` |  |
| `Subsystem_ID` | String | imported | `nan` |  |
| `Systemization_Subsystem_Summary` | String | imported | `nan` |  |
| `Process_Area_ID` | String | imported | `nan` |  |
| `Systemization_Process_Area_Summary` | String | imported | `nan` |  |
| `Systemization_Process_Plant_Summary` | String | imported | `nan` |  |
| `Subsystem_Priority` | String | imported | `nan` |  |
| `Contract_No` | String | imported | `nan` |  |
| `fws_description` | String | imported | `nan` |  |
| `FWC` | String | imported | `nan` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `ID` | String | imported | `nan` |  |
| `FRB_Package` | String | imported | `nan` |  |
| `Group_ID` | String | imported | `nan` |  |
| `SCTR` | String | imported | `nan` |  |
| `Subcon_code` | String | imported | `nan` |  |
| `psm_code` | String | imported | `nan` |  |
| `HA` | String | imported | `nan` |  |
| `CWA_Code` | String | imported | `nan` |  |
| `CWA_Description` | String | imported | `nan` |  |
| `cwp` | String | imported | `nan` |  |
| `cwp_description` | String | imported | `nan` |  |
| `TAG` | String | imported | `nan` |  |
| `TAG_Description` | String | imported | `nan` |  |
| `object_type` | String | imported | `nan` |  |
| `object_type_description` | String | imported | `nan` |  |
| `FWC_Code` | String | imported | `nan` |  |
| `ITR_form` | String | imported | `nan` |  |
| `completion_date` | DateTime | imported | `Long Date` |  |
| `Schedule_Start_Date` | DateTime | imported | `Long Date` |  |
| `Schedule_End_Date` | DateTime | imported | `Long Date` |  |
| `Date_Removed` | DateTime | imported | `Long Date` |  |
| `Removed_By` | String | imported | `nan` |  |
| `Scheduled_Duration` | String | imported | `nan` |  |
| `Actual_Duration` | String | imported | `nan` |  |
| `QR_Code_String` | String | imported | `nan` |  |
| `FD` | String | imported | `nan` |  |
| `Discipline` | String | imported | `nan` |  |
| `System` | String | imported | `nan` |  |
| `Area` | String | imported | `nan` |  |

### `SCTR OVERALL APPLIED WELDERS` — 17 columns, 16 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Sub-Contractor` | String | imported | `nan` |  |
| `STRUCTURAL / PIPING` | String | imported | `nan` |  |
| `WELDERS TESTED (APPLIED)` | Int64 | imported | `0` |  |
| `VISUAL ACCEPTED ` | Int64 | imported | `0` |  |
| ` VISUAL REJECTED ` | Int64 | imported | `0` |  |
| `RT ACCEPTED ` | Int64 | imported | `0` |  |
| `RT REJECTED` | Int64 | imported | `0` |  |
| `DISQUALIFIED DUE TO MEDICAL REASON / BEHAVIOUR / HIGH REPAIR` | Int64 | imported | `0` |  |
| `NOT MOBILIZED / DISQUALIFIED DUE TO 6 MONTH VALIDITY EXPIRED` | Int64 | imported | `0` |  |
| `TRANSFER / PROMOTED  ` | String | imported | `nan` |  |
| `RESIGNATION` | Int64 | imported | `0` |  |
| `ACTIVE WELDERS` | Int64 | imported | `0` |  |
| `Column14` | String | imported | `nan` |  |
| `ACTIVE PIPING WELDERS` | Int64 | imported | `0` |  |
| `Total Qualified Welders TXT` | String | calculated | `nan` |  |
| `QUALIFIED  WELDERS` | Int64 | imported | `0` |  |
| `REMARKS` | String | imported | `nan` |  |

### `Spool Dump` — 106 columns, 198,647 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `ISO Number` | String | imported | `nan` |  |
| `Iso Rev No.` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Barcode Number` | Int64 | imported | `0` |  |
| `Sheet No.` | Int64 | imported | `0` |  |
| `Spool Rev No.` | String | imported | `nan` |  |
| `Spool Shop Sub Contractor` | String | imported | `nan` |  |
| `Spool Field Sub Contractor` | String | imported | `nan` |  |
| `Spool Paint Sub Contractor` | String | imported | `nan` |  |
| `Shop Sub Contractor` | String | imported | `nan` |  |
| `Field Sub Contractor` | String | imported | `nan` |  |
| `Area Classification` | Int64 | imported | `0` |  |
| `WBU` | Int64 | imported | `0` |  |
| `PDS Area` | String | imported | `nan` |  |
| `Line No` | String | imported | `nan` |  |
| `Priority` | DateTime | imported | `Long Date` |  |
| `System no` | String | imported | `nan` |  |
| `Testpack No` | String | imported | `nan` |  |
| `Service class` | String | imported | `nan` |  |
| `Service Cat` | String | imported | `nan` |  |
| `Piping Group` | String | imported | `nan` |  |
| `Matrl Type` | String | imported | `nan` |  |
| `Field Pipe` | String | imported | `nan` |  |
| `Shop Dia` | Double | imported | `nan` |  |
| `Shop DI Comp` | Double | imported | `nan` |  |
| `Field Dia` | Double | imported | `nan` |  |
| `Field DI Comp` | Int64 | imported | `#,0` |  |
| `AG/UG/PKG` | String | imported | `nan` |  |
| `LB/SB` | String | imported | `nan` |  |
| `Spool diameter` | Double | imported | `nan` |  |
| `Spool Weight` | Double | imported | `nan` |  |
| `Spool Length` | Double | imported | `nan` |  |
| `Spool Volume` | Double | imported | `nan` |  |
| `Surface Area` | Double | imported | `nan` |  |
| `Spool Inch Meter` | Double | imported | `nan` |  |
| `Paint System` | String | imported | `nan` |  |
| `Material Availability` | String | imported | `nan` |  |
| `ETA` | DateTime | imported | `Long Date` |  |
| `QC13 Form No` | String | imported | `nan` |  |
| `W10/P Form No` | String | imported | `nan` |  |
| `W24 Form No` | String | imported | `nan` |  |
| `Material Check` | DateTime | imported | `Long Date` |  |
| `MIR NO` | String | imported | `nan` |  |
| `MIR DATE` | DateTime | imported | `Long Date` |  |
| `START FAB` | DateTime | imported | `Long Date` |  |
| `FABRICATED` | DateTime | imported | `Long Date` |  |
| `QC RELEASE` | DateTime | imported | `Long Date` |  |
| `SENT TO PAINT` | DateTime | imported | `Long Date` |  |
| `PAINTED` | DateTime | imported | `Long Date` |  |
| `FINAL QC` | DateTime | imported | `Long Date` |  |
| `LAYDOWN` | DateTime | imported | `Long Date` |  |
| `Spool Nde Status` | String | imported | `nan` |  |
| `TO SITE` | DateTime | imported | `Long Date` |  |
| `ERECTED` | DateTime | imported | `Long Date` |  |
| `WELDED BOLT` | DateTime | imported | `Long Date` |  |
| `SUPPORTED` | DateTime | imported | `Long Date` |  |
| `RFT` | DateTime | imported | `Long Date` |  |
| `INTERNAL CLEANING IDLL` | String | imported | `nan` |  |
| `CLEANING PRIOR INSTALLATION` | String | imported | `nan` |  |
| `Revision Status` | String | imported | `nan` |  |
| `Revision Comments` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `PAINTED SURFACE` | Double | calculated | `nan` |  |
| `Spools Straight` | 1 | calculated | `nan` |  |
| `SPOOL ID` | 1 | calculated | `nan` |  |
| `Spool ID table` | String | imported | `nan` |  |
| `QC SIGN OFF` | String | imported | `nan` |  |
| `PACKING LIST NO` | String | imported | `nan` |  |
| `SHIPMENT DATE` | String | imported | `nan` |  |
| `SHIPMENT RECV DATE` | String | imported | `nan` |  |
| `EREC MIR NO` | String | imported | `nan` |  |
| `EREC MIR DATE` | String | imported | `nan` |  |
| `TRACING COMPLETION` | String | imported | `nan` |  |
| `RELEASE FOR INSULATION` | String | imported | `nan` |  |
| `INSULATION COMPLETION` | String | imported | `nan` |  |
| `INSULATION TYPE` | String | imported | `nan` |  |
| `PAINTING TOUCH-UP` | String | imported | `nan` |  |
| `TESTPACK EXCEPTION` | String | imported | `nan` |  |
| `Subsystem Code` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `QR Code` | String | imported | `nan` |  |
| `GPSECOORDINATE ` | String | imported | `nan` |  |
| `GPSNCOORDINATE ` | String | imported | `nan` |  |
| `Location Status` | String | imported | `nan` |  |
| `Spool Tracking Date` | DateTime | imported | `Long Date` |  |
| `Assembly Weld NDE Completed` | String | imported | `nan` |  |
| `Field Weld NDE Completed` | String | imported | `nan` |  |
| `PED` | String | imported | `nan` |  |
| `Priority No` | String | imported | `nan` |  |
| `GWBS` | String | imported | `nan` |  |
| `PDS Area Type` | String | imported | `nan` |  |
| `TESTPACK SUB CONTRACTOR` | String | imported | `nan` |  |
| `TESTPACK TEST DONE DATE` | DateTime | imported | `dd-mmm-yy` |  |
| `QC13` | String | imported | `nan` |  |
| `W10P` | String | imported | `nan` |  |
| `BHS` | String | imported | `nan` |  |
| `WHS` | String | imported | `nan` |  |
| `PAIINT FINAL INSP RFI NO` | String | imported | `nan` |  |
| `FULL/PARTIAL INPS` | String | imported | `nan` |  |
| `RELEASE FOR TRACING` | String | imported | `nan` |  |
| `TRACING FINAL INSP RFI NO` | String | imported | `nan` |  |
| `INSU FINAL INSP RFI NO` | String | imported | `nan` |  |
| `TQ/SDR FOR INSULATION` | String | imported | `nan` |  |
| `CLADDING` | String | imported | `nan` |  |
| `IWP CODE` | String | imported | `nan` |  |

### `TALISMAN DATA` — 88 columns, 3,098,341 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `SUBCON CODE` | String | imported | `nan` |  |
| `QCISO NO` | String | imported | `nan` |  |
| `SHEET NO` | Int64 | imported | `0` |  |
| `JOINT NO` | String | imported | `nan` |  |
| `ORIGINAL REPAIR DELETE FLAG` | String | imported | `nan` |  |
| `REV NO` | String | imported | `nan` |  |
| `SPOOL NO` | String | imported | `nan` |  |
| `WORK CATEGORY` | String | imported | `nan` |  |
| `ORIGINAL WORK CATEGORY` | String | imported | `nan` |  |
| `SIZE` | Int64 | imported | `0` |  |
| `2ND SIZE` | Int64 | imported | `0` |  |
| `WELD TYPE` | String | imported | `nan` |  |
| `SERVICE CLASS` | String | imported | `nan` |  |
| `TESTPACK NO` | String | imported | `nan` |  |
| `SUBSYSTEM NO` | String | imported | `nan` |  |
| `LINE NO` | String | imported | `nan` |  |
| `WELD DATE` | DateTime | imported | `dd-mmm-yy` |  |
| `WPS CODE` | String | imported | `nan` |  |
| `REWORK CODE` | String | imported | `nan` |  |
| `RT1 DATE` | DateTime | imported | `dd-mmm-yy` |  |
| `RT1 REP NO` | String | imported | `nan` |  |
| `RT1 RESULT` | String | imported | `nan` |  |
| `RT1 TOTAL FILM NO` | Int64 | imported | `0` |  |
| `RT1 REJECT FILM NO` | Int64 | imported | `0` |  |
| `RT1 DEFECT CODE` | String | imported | `nan` |  |
| `RT2 DATE` | DateTime | imported | `Long Date` |  |
| `RT2 REP NO` | String | imported | `nan` |  |
| `RT2 RESULT` | String | imported | `nan` |  |
| `RT2 TOTAL FILM NO` | String | imported | `nan` |  |
| `RT2 REJECT FILM NO` | String | imported | `nan` |  |
| `RT2 DEFECT CODE` | String | imported | `nan` |  |
| `UT1 DATE` | DateTime | imported | `dd-mmm-yy` |  |
| `UT1 REP NO` | String | imported | `nan` |  |
| `UT1 RESULT` | String | imported | `nan` |  |
| `UT1 DEFECT CODE` | String | imported | `nan` |  |
| `UT2 DATE` | DateTime | imported | `Long Date` |  |
| `UT2 REP NO` | String | imported | `nan` |  |
| `UT2 RESULT` | String | imported | `nan` |  |
| `UT2 DEFECT CODE` | String | imported | `nan` |  |
| `TRACER FLG` | String | imported | `nan` |  |
| `PT DATE` | DateTime | imported | `Long Date` |  |
| `PT REP NO` | String | imported | `nan` |  |
| `MT DATE` | DateTime | imported | `Long Date` |  |
| `MT REP NO` | String | imported | `nan` |  |
| `PWHT DATE` | DateTime | imported | `Long Date` |  |
| `PWHT REP NO` | String | imported | `nan` |  |
| `HT DATE` | DateTime | imported | `Long Date` |  |
| `HT REP NO` | String | imported | `nan` |  |
| `PMI DATE` | DateTime | imported | `Long Date` |  |
| `PMI REP NO` | String | imported | `nan` |  |
| `PMI UP DATE` | DateTime | imported | `Long Date` |  |
| `PMI UP REP NO` | String | imported | `nan` |  |
| `PMI DOWN DATE` | DateTime | imported | `Long Date` |  |
| `PMI DOWN REP NO` | String | imported | `nan` |  |
| `FT DATE` | DateTime | imported | `Long Date` |  |
| `FT REP NO` | String | imported | `nan` |  |
| `CROSS CHECK DATA JOINT ID` | 1 | calculated | `nan` |  |
| `Area Classification` | 1 | calculated | `nan` |  |
| `Weld Date from Welder Record` | 1 | calculated | `dd-mmm-yy` |  |
| `Weld Date TR/F Talisman & Welder Record` | 1 | calculated | `"TRUE";"TRUE";"FALSE"` |  |
| `Weld Date from Joint Record` | 1 | calculated | `dd-mmm-yy` |  |
| `Weld date TR/F Talisman & Joint Record` | 1 | calculated | `"TRUE";"TRUE";"FALSE"` |  |
| `RT Date from Welder Record` | 1 | calculated | `dd-mmm-yy` |  |
| `RT Date TR/F Talisman & Welder Record` | 1 | calculated | `"TRUE";"TRUE";"FALSE"` |  |
| `RT Date from Joint Record` | 1 | calculated | `dd-mmm-yy` |  |
| `RT date TR/F Talisman & Joint Record` | 1 | calculated | `"TRUE";"TRUE";"FALSE"` |  |
| `RT Report from Welder Record` | 1 | calculated | `nan` |  |
| `RT Report TR/F Talisman & Welder Record` | 1 | calculated | `"TRUE";"TRUE";"FALSE"` |  |
| `RT Report from Joint Record` | 1 | calculated | `nan` |  |
| `RT Report TR/F Talisman & Joint Record` | 1 | calculated | `"TRUE";"TRUE";"FALSE"` |  |
| `WELDER ID ALL` | String | imported | `nan` |  |
| `Joint ID+Welder ID` | String | imported | `nan` |  |
| `Joint ID+Welder ID from Welder Record` | 1 | calculated | `nan` |  |
| `Joint ID+Welder ID TR/F Talisman & Welder Record` | 1 | calculated | `nan` |  |
| `RT% from Project WD+WR` | 1 | calculated | `0` |  |
| `Service Class from Project WD+WR.` | 1 | calculated | `nan` |  |
| `NDT Remarks from Project WD+WR` | 1 | calculated | `nan` |  |
| `Service Class + Service Cat+NDT Remarks from Project WD+WR` | 1 | calculated | `nan` |  |
| `WELD REP NO` | String | imported | `nan` |  |
| `AREA` | String | imported | `nan` |  |
| `WELDER ID 1` | String | imported | `nan` |  |
| `WELDER ID 2` | String | imported | `nan` |  |
| `WELDER ID 3` | String | imported | `nan` |  |
| `WELDER ID 4` | String | imported | `nan` |  |
| `Area Classification from WD+WR` | 1 | calculated | `nan` |  |
| `Index` | Int64 | imported | `0` |  |
| `WeldPoint No.1 WP1` | 1 | calculated | `0` |  |

### `TREND RT UT` — 6 columns, 976 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Date` | DateTime | imported | `Long Date` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `RT% Rate` | Double | imported | `0.00%;-0.00%;0.00%` |  |
| `UT% Rate` | Double | imported | `0.00%;-0.00%;0.00%` |  |
| `Project RT % Rej Rate` | Double | imported | `0.00%;-0.00%;0.00%` |  |
| `Project UT % Rej Rate` | Double | imported | `0.00%;-0.00%;0.00%` |  |

### `TREND Report` — 8 columns, 943 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `RT Backlog` | Int64 | imported | `0` |  |
| `PWHT Backlog All Types` | Int64 | imported | `0` |  |
| `PWHT Backlog For RT` | Int64 | imported | `0` |  |
| `RT BACKLOG & PWHT "Y" Done + "N"` | Int64 | imported | `0` |  |
| `RT BACKLOG & PWHT Not Done` | Int64 | imported | `0` |  |
| `PWHT BACKLOG RT NOT Done (SG+TMCP)` | Int64 | imported | `0` |  |

### `Talisman Spool Dump` — 26 columns, 331,979 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Spool ID` | String | imported | `nan` |  |
| `QCISO NO` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `WEIGHT` | Int64 | imported | `0` |  |
| `FABRICATION ORDER` | DateTime | imported | `Long Date` |  |
| `MATERIAL ISSUE` | DateTime | imported | `Long Date` |  |
| `CUT / FIT` | DateTime | imported | `Long Date` |  |
| `SHOP WELD COMPLETE` | DateTime | imported | `Long Date` |  |
| `QC SPOOL RELEASED TO NDT/PWHT` | DateTime | imported | `Long Date` |  |
| `PWHT Date Spool` | DateTime | imported | `Long Date` |  |
| `SHOP NDE DONE` | DateTime | imported | `Long Date` |  |
| `PAINT RELEASE` | DateTime | imported | `Long Date` |  |
| `SENT TO LAYDOWN` | DateTime | imported | `Long Date` |  |
| `PAINT COMPLETE` | DateTime | imported | `Long Date` |  |
| `QC RELEASE FROM PAINTING` | DateTime | imported | `Long Date` |  |
| `PAINTING REPORT DATE` | DateTime | imported | `Long Date` |  |
| `PAINTING REPORT NO` | String | imported | `nan` |  |
| `LAYDOWN MOVE` | DateTime | imported | `Long Date` |  |
| `LAYDOWN LOCATION` | String | imported | `nan` |  |
| `SITE MOVE` | DateTime | imported | `Long Date` |  |
| `SPOOL ERECTION DONE` | DateTime | imported | `Long Date` |  |
| `FIELD WELD COMPLETE` | DateTime | imported | `Long Date` |  |
| `FIELD NDE DONE` | DateTime | imported | `Long Date` |  |
| `Status Released` | 1 | calculated | `nan` |  |
| `Sub-Contractor` | 1 | calculated | `nan` |  |
| `Status PWHT Spool Date` | 1 | calculated | `nan` |  |

### `Temporary` — 2 columns, 24 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Temporary` | String | imported | `nan` |  |
| `ISO Number` | String | imported | `nan` |  |

### `Testpack-wise Details Report` — 48 columns, 247,528 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `S. NO` | Int64 | imported | `0` |  |
| `Item No` | Int64 | imported | `0` |  |
| `SYSTEM #` | String | imported | `nan` |  |
| `SUB-SYSTEM #` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `TEST PACK` | String | imported | `nan` |  |
| `Testpack Location` | String | imported | `nan` |  |
| `PRIORITY` | Int64 | imported | `0` |  |
| `TEST MEDIUM` | String | imported | `nan` |  |
| `UT` | Int64 | imported | `0` |  |
| `Volume (m3)` | Double | imported | `nan` |  |
| `Linear Meter (M)` | Double | imported | `nan` |  |
| `Test Pressure (Barg)` | Double | imported | `nan` |  |
| `Line Service` | String | imported | `nan` |  |
| `Weight (KG)` | Double | imported | `nan` |  |
| `Type (AG/UG/PKG)` | String | imported | `nan` |  |
| `Piping Group` | String | imported | `nan` |  |
| `Iso Number` | String | imported | `nan` |  |
| `To be Welded` | Int64 | imported | `0` |  |
| `To be Bolted` | Int64 | imported | `0` |  |
| `To be NDE` | Int64 | imported | `0` |  |
| `Construction Completion %` | Double | imported | `0.00%;-0.00%;0.00%` |  |
| `Line Check Request Request No` | String | imported | `nan` |  |
| `Line Check Request Request Date` | DateTime | imported | `Long Date` |  |
| `Line Check Request Request Issued to` | String | imported | `nan` |  |
| `Line Check Completed` | DateTime | imported | `dd-mmm-yy` |  |
| `Spool No` | String | imported | `nan` |  |
| `Punch raised By` | String | imported | `nan` |  |
| `Punch Code` | String | imported | `nan` |  |
| `Punch Description` | String | imported | `nan` |  |
| `Punch CAT` | String | imported | `nan` |  |
| `Punch Clearance Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Punch Clearance Done By` | String | imported | `nan` |  |
| `Item Clearance Request Request No` | String | imported | `nan` |  |
| `Item Clearance Request Date` | DateTime | imported | `Long Date` |  |
| `Item Clearance Request Issued to` | String | imported | `nan` |  |
| `Item Clearance Completed` | DateTime | imported | `dd-mmm-yy` |  |
| `Test pack Clearance Date` | DateTime | imported | `Long Date` |  |
| `Blinding Completed Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Test Completed Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Pre-Com Completed Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Reinstatement Details No of joints to be Reinstated` | Int64 | imported | `0` |  |
| `Reinstatement Details No of joints Completed` | Int64 | imported | `0` |  |
| `Reinstatement Completed Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Open_Punch "X"` | 1 | calculated | `0` |  |
| `Open_Punch "Y"` | 1 | calculated | `0` |  |
| `Open_Punch "Z"` | 1 | calculated | `0` |  |
| `Stasus in Punch Description` | 1 | calculated | `nan` |  |

### `Trend Active Welders` — 3 columns, 576 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Week_End_Date` | DateTime | imported | `Long Date` |  |
| `No. of Welders 'PR all"` | Int64 | imported | `0` |  |
| `Sub-Contractor` | String | imported | `nan` |  |

### `UT TRACKER (CCC)_Talisman` — 25 columns, 9,419 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `ISO Number` | String | imported | `nan` |  |
| `JOINT NO` | String | imported | `nan` |  |
| `SPOOL NO` | String | imported | `nan` |  |
| `SIZE` | Int64 | imported | `0` |  |
| `Wall Thickness` | Double | imported | `nan` |  |
| `SERVICE CLASS` | String | imported | `nan` |  |
| `WELD TYPE` | String | imported | `nan` |  |
| `AREA` | String | imported | `nan` |  |
| `WELD DATE` | DateTime | imported | `Long Date` |  |
| `WELDER ID 2` | String | imported | `nan` |  |
| `WELDER ID 3` | String | imported | `nan` |  |
| `WELDER ID 4` | String | imported | `nan` |  |
| `WPS CODE` | String | imported | `nan` |  |
| `UT1 DATE` | DateTime | imported | `Long Date` |  |
| `UT1 REP NO` | String | imported | `nan` |  |
| `UT1 RESULT` | String | imported | `nan` |  |
| `UT Operator ID.` | String | imported | `nan` |  |
| `UT Operator ID 2` | String | imported | `nan` |  |
| `Defect Lenght(MM).` | Double | imported | `nan` |  |
| `PWHT DATE` | DateTime | imported | `Long Date` |  |
| `PWHT REP NO` | String | imported | `nan` |  |
| `Welder ID` | String | imported | `nan` |  |
| `TPI Date` | String | imported | `nan` |  |
| `TPI Report No` | String | imported | `nan` |  |

### `UT TRACKER (GAC)` — 31 columns, 155 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Joint ID` | String | imported | `nan` |  |
| `SL` | Int64 | imported | `0` |  |
| `DRAWING NUMBER` | String | imported | `nan` |  |
| `REV` | String | imported | `nan` |  |
| `SPOOL` | String | imported | `nan` |  |
| `RFI NO` | Int64 | imported | `0` |  |
| `JOINT` | String | imported | `nan` |  |
| `DIA` | Int64 | imported | `0` |  |
| ` THICKNESS (mm)` | Double | imported | `nan` |  |
| `LINE CLASS` | String | imported | `nan` |  |
| `METERIAL` | String | imported | `nan` |  |
| `LOCATION(Shop / Field)` | String | imported | `nan` |  |
| `Specific Location` | String | imported | `nan` |  |
| `WELDING PROCESS` | String | imported | `nan` |  |
| `WPS` | String | imported | `nan` |  |
| `WELDER'S` | String | imported | `nan` |  |
| `PWHT Status` | String | imported | `nan` |  |
| `Request No` | String | imported | `nan` |  |
| `MUT REPORT NO` | String | imported | `nan` |  |
| `RESULT` | String | imported | `nan` |  |
| `InspectedLength(MM)` | Double | imported | `nan` |  |
| `Defect Length(MM)` | Double | imported | `0.000` |  |
| `DATE OF EXAMINATION` | DateTime | imported | `d mmmm\, yyyy` |  |
| `WEEK` | String | imported | `nan` |  |
| `MUT TECHNICIAN NAME` | String | imported | `nan` |  |
| `MUT Technician ID` | String | imported | `nan` |  |
| `Cross Verification-by  CTJV (TPI) ` | String | imported | `nan` |  |
| `CTJV VERIFICATIONDATE` | DateTime | imported | `Long Date` |  |
| `CTJV VERIFICATIONBY` | String | imported | `nan` |  |
| `Remarks` | String | imported | `nan` |  |
| `REPORT STATUS` | String | imported | `nan` |  |

### `UT TRACKER (TEK)` — 34 columns, 10 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `SL` | Int64 | imported | `0` |  |
| `DRAWING NUMBER` | String | imported | `nan` |  |
| `REV` | String | imported | `nan` |  |
| `SPOOL` | String | imported | `nan` |  |
| `RFI NO` | Int64 | imported | `0` |  |
| `JOINT` | String | imported | `nan` |  |
| `DIA` | Int64 | imported | `0` |  |
| ` THICKNESS (mm)` | Int64 | imported | `0` |  |
| `LINE CLASS` | String | imported | `nan` |  |
| `METERIAL` | String | imported | `nan` |  |
| `LOCATION(Shop / Field)` | String | imported | `nan` |  |
| `Specific Location` | String | imported | `nan` |  |
| `WELDING PROCESS` | String | imported | `nan` |  |
| `WPS` | String | imported | `nan` |  |
| `WELDER'S` | String | imported | `nan` |  |
| `PWHT Status` | String | imported | `nan` |  |
| `Request No` | String | imported | `nan` |  |
| `MUT REPORT NO` | String | imported | `nan` |  |
| `RESULT` | String | imported | `nan` |  |
| `InspectedLength(MM)` | Double | imported | `nan` |  |
| `Defect Length(MM)` | Double | imported | `nan` |  |
| `DATE OF EXAMINATION` | DateTime | imported | `Long Date` |  |
| `WEEK` | String | imported | `nan` |  |
| `MUT TECHNICIAN NAME` | String | imported | `nan` |  |
| `MUT Technician ID` | String | imported | `nan` |  |
| `Cross Verification-by  CTJV (TPI) ` | String | imported | `nan` |  |
| `CTJV VERIFICATIONDATE` | DateTime | imported | `Long Date` |  |
| `CTJV VERIFICATIONBY` | String | imported | `nan` |  |
| `Remarks` | String | imported | `nan` |  |
| `Joint ID` | String | imported | `nan` |  |
| `TOTAL Defect Length(MM)` | String | imported | `nan` |  |
| `AMPLITUDE HEIGHT%` | String | imported | `nan` |  |
| `DEFECT LOCATION FROM "0"` | String | imported | `nan` |  |
| `QG VERIFICATION` | String | imported | `nan` |  |

### `WEEK #   STATUS` — 9 columns, 8 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `S.No` | String | imported | `nan` |  |
| `Welders Qualification Status Summary Report` | String | imported | `nan` |  |
| `GAC` | Int64 | imported | `0` |  |
| `MEDGULF` | Int64 | imported | `0` |  |
| `TEKFEN` | Int64 | imported | `0` |  |
| `CCC` | Int64 | imported | `0` |  |
| `ACCIONA` | Int64 | imported | `0` |  |
| `INCO` | Int64 | imported | `0` |  |
| `TOTAL` | Int64 | imported | `0` |  |

### `WELDERS_Qualification` — 21 columns, 5,484 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `SL No.` | Int64 | imported | `0` |  |
| `PIP -PIPING                                 STR- STRUCTURAL WELDERS` | String | imported | `nan` |  |
| `Welder Name` | String | imported | `nan` |  |
| `WQT NO #` | String | imported | `nan` |  |
| `Welder No.` | String | imported | `nan` |  |
| `WPS No` | String | imported | `nan` |  |
| `Date of Test` | DateTime | imported | `Long Date` |  |
| `Welding Process` | String | imported | `nan` |  |
| `Filler Materials` | String | imported | `nan` |  |
| `Base Material` | String | imported | `nan` |  |
| `Type of Joint` | String | imported | `nan` |  |
| `WORKING LOCATION` | String | imported | `nan` |  |
| `VT RESULT` | String | imported | `nan` |  |
| `RT RESULT` | String | imported | `nan` |  |
| `STATUS` | String | imported | `nan` |  |
| `REMARKS` | String | imported | `nan` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `WELDER ID+NAME` | String | imported | `nan` |  |
| `Welder ID Code+Sub` | String | imported | `nan` |  |
| `Welder ID in System` | 1 | calculated | `nan` |  |
| `Dublicate Welders` | 1 | calculated | `nan` |  |

### `WPQ RECORD REGISTER` — 12 columns, 318 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `S.N` | Int64 | imported | `0` |  |
| `SCTR` | String | imported | `nan` |  |
| `WPS NO.` | String | imported | `nan` |  |
| `WPS Rev. No.` | String | imported | `nan` |  |
| `PQR No/Rev.` | String | imported | `nan` |  |
| `WELDING PROCESS (ES)` | String | imported | `nan` |  |
| `Column7` | String | imported | `nan` |  |
| `PQR Material Seamless / Welder Pipes & Plate` | String | imported | `nan` |  |
| `Column9` | String | imported | `nan` |  |
| `PWHT ` | String | imported | `nan` |  |
| ` DOCUMENT STATUS` | String | imported | `nan` |  |
| `APPLICATION` | String | imported | `nan` |  |

### `WPQ WELDING PROCESS` — 5 columns, 266 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Sn.` | Int64 | imported | `0` |  |
| `SCNTR` | String | imported | `nan` |  |
| `WPS No.` | String | imported | `nan` |  |
| `Welding process` | String | imported | `nan` |  |
| `Type of Welding Machine` | String | imported | `nan` |  |

### `WPS Reg#` — 26 columns, 71 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `S.N` | Int64 | imported | `0` |  |
| `Material Type` | String | imported | `nan` |  |
| `WPS NO.` | String | imported | `nan` |  |
| `WPSDocument No/Rev.OLD DOC. NO` | String | imported | `nan` |  |
| `WPS Rev. No.` | Int64 | imported | `0` |  |
| `PQR No/Rev.` | String | imported | `nan` |  |
| `WELDING PROCESS (ES)` | String | imported | `nan` |  |
| `WELDING PROCESS (ES)2` | String | imported | `nan` |  |
| `PQR Material Seamless / Welder Pipes & Plate Mat.1` | String | imported | `nan` |  |
| `PQR Material Seamless / Welder Pipes & Plate Mat.2` | String | imported | `nan` |  |
| `Actual PQR THICKNESS MM` | String | imported | `nan` |  |
| `Actual PQR DIA MM` | String | imported | `nan` |  |
| `Actual PQR DIA IN` | String | imported | `nan` |  |
| `Design Code` | String | imported | `nan` |  |
| `WELDING CONSUMABLESAPI582` | String | imported | `nan` |  |
| `WELDING POSITION/PROGRESSION` | String | imported | `nan` |  |
| `IMPACT` | String | imported | `nan` |  |
| `PWHT/NACE  ` | String | imported | `nan` |  |
| `Qualified Material ` | String | imported | `nan` |  |
| `Qualified Rangemin.` | String | imported | `nan` |  |
| `Qualified Range Max.` | String | imported | `nan` |  |
| `Qualified welding Position` | String | imported | `nan` |  |
| `Pre-Heat` | String | imported | `nan` |  |
| `Line Class` | String | imported | `nan` |  |
| `DocumentStatus` | String | imported | `nan` |  |
| `PREQUALIED /NEW PQR` | String | imported | `nan` |  |

### `WPS Status CUM` — 3 columns, 127 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Week_End_Date` | DateTime | imported | `Long Date` |  |
| `WPS Submitted` | Int64 | imported | `0` |  |
| `WPS Approved` | Int64 | imported | `0` |  |

### `Weld Dump` — 260 columns, 958,634 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `ISO Number` | String | imported | `nan` |  |
| `Iso Rev No.` | String | imported | `nan` |  |
| `Spool No.` | String | imported | `nan` |  |
| `Weld No.` | String | imported | `nan` |  |
| `Spool Rev No.` | String | imported | `nan` |  |
| `Weld Cat` | String | imported | `nan` |  |
| `Weld Type` | String | imported | `nan` |  |
| `Dia Inch Factor` | String | imported | `nan` |  |
| `Dia inch` | Double | imported | `nan` |  |
| `Thickness` | Double | imported | `nan` |  |
| `PDS Area` | String | imported | `nan` |  |
| `AG/UG/PKG` | String | imported | `nan` |  |
| `Area Classification` | Int64 | imported | `0` |  |
| `wbu` | Int64 | imported | `0` |  |
| `System no` | String | imported | `nan` |  |
| `Testpack No` | String | imported | `nan` |  |
| `Service class` | String | imported | `nan` |  |
| `Service Cat` | String | imported | `nan` |  |
| `Material Type` | String | imported | `nan` |  |
| `MIR No` | String | imported | `nan` |  |
| `MIR Date` | DateTime | imported | `Long Date` |  |
| `Cutting Date` | DateTime | imported | `Long Date` |  |
| `Beveling Date` | DateTime | imported | `Long Date` |  |
| `Fitup Date` | DateTime | imported | `Long Date` |  |
| `Preheat Date` | DateTime | imported | `Long Date` |  |
| `Weld Date` | DateTime | imported | `dd-mmm-yy` |  |
| `DWIR No.` | String | imported | `nan` |  |
| `Sub-Contractor` | String | imported | `nan` |  |
| `Rework Code` | String | imported | `nan` |  |
| `WeldPoint No.` | Int64 | imported | `0` |  |
| `WPS No.` | String | imported | `nan` |  |
| `Welder` | String | imported | `nan` |  |
| `PWHT Y/N` | String | imported | `nan` |  |
| `PWHT Weld Status` | String | imported | `nan` |  |
| `PWHT Selected Date` | DateTime | imported | `Long Date` |  |
| `PWHT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PWHT Date` | DateTime | imported | `Long Date` |  |
| `PWHT Report` | String | imported | `nan` |  |
| `PWHT Acc/Rej` | String | imported | `nan` |  |
| `PWHT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PWHT Remarks` | String | imported | `nan` |  |
| `HT%` | Int64 | imported | `0` |  |
| `HT Batch No` | String | imported | `nan` |  |
| `HT Batch Status` | String | imported | `nan` |  |
| `HT Weld Status` | String | imported | `nan` |  |
| `HT Selected Date` | DateTime | imported | `Long Date` |  |
| `HT Exam Req date` | DateTime | imported | `Long Date` |  |
| `HT Date` | DateTime | imported | `Long Date` |  |
| `HT Report` | String | imported | `nan` |  |
| `HT Acc/Rej` | String | imported | `nan` |  |
| `HT Client Exam Req Y/N` | String | imported | `nan` |  |
| `HT Remarks` | String | imported | `nan` |  |
| `RT%` | Int64 | imported | `0` |  |
| `RT Batch No` | Int64 | imported | `0` |  |
| `RT Batch Status` | String | imported | `nan` |  |
| `RT Weld Status` | String | imported | `nan` |  |
| `RT Selected Date` | DateTime | imported | `Long Date` |  |
| `RT Exam Req date` | DateTime | imported | `Long Date` |  |
| `RT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `RT Xray No` | String | imported | `nan` |  |
| `RT Report` | String | imported | `nan` |  |
| `RT Acc/Rej` | String | imported | `nan` |  |
| `Total No of films Acc` | Double | imported | `0` |  |
| `Total No of films Rej` | Double | imported | `0.00` |  |
| `Defect Code` | String | imported | `nan` |  |
| `Location of Defect` | String | imported | `nan` |  |
| `RT Re-Shoot Rep` | String | imported | `nan` |  |
| `RT Re-Shoot Data` | DateTime | imported | `Long Date` |  |
| `RT Re-Shoot Status` | String | imported | `nan` |  |
| `RT Re-Shoot Reason` | String | imported | `nan` |  |
| `RT Re-Shoot Films` | Int64 | imported | `0` |  |
| `Weld Length` | Double | imported | `nan` |  |
| `Rej Length` | Double | imported | `0.000` |  |
| `RT Client Exam Req Y/N` | String | imported | `nan` |  |
| `By UT` | String | imported | `nan` |  |
| `RT Remarks` | String | imported | `nan` |  |
| `UT%` | Int64 | imported | `0` |  |
| `UT Batch No` | String | imported | `nan` |  |
| `UT Batch Status` | String | imported | `nan` |  |
| `UT Weld Status` | String | imported | `nan` |  |
| `UT Selected Date` | DateTime | imported | `Long Date` |  |
| `UT Exam Req date` | DateTime | imported | `Long Date` |  |
| `UT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `UT Report` | String | imported | `nan` |  |
| `UT Acc/Rej` | String | imported | `nan` |  |
| `UT Client Exam Req Y/N` | String | imported | `nan` |  |
| `UT Remarks` | String | imported | `nan` |  |
| `MT%` | Int64 | imported | `0` |  |
| `MT Batch No` | String | imported | `nan` |  |
| `MT Batch Status` | String | imported | `nan` |  |
| `MT Weld Status` | String | imported | `nan` |  |
| `MT Selected Date` | DateTime | imported | `Long Date` |  |
| `MT Exam Req date` | DateTime | imported | `Long Date` |  |
| `MT Date` | DateTime | imported | `Long Date` |  |
| `MT Report` | String | imported | `nan` |  |
| `MT Acc/Rej` | String | imported | `nan` |  |
| `MT Client Exam Req Y/N` | String | imported | `nan` |  |
| `MT Remarks` | String | imported | `nan` |  |
| `PMI%` | Int64 | imported | `0` |  |
| `PMI Batch No` | String | imported | `nan` |  |
| `PMI Batch Status` | String | imported | `nan` |  |
| `PMI Weld Status` | String | imported | `nan` |  |
| `PMI Selected Date` | DateTime | imported | `Long Date` |  |
| `PMI Exam Req date` | DateTime | imported | `Long Date` |  |
| `PMI Date` | DateTime | imported | `Long Date` |  |
| `PMI Report` | String | imported | `nan` |  |
| `PMI Acc/Rej` | String | imported | `nan` |  |
| `PMI Client Exam Req Y/N` | String | imported | `nan` |  |
| `PMI Remarks` | String | imported | `nan` |  |
| `PT%` | Int64 | imported | `0` |  |
| `PT Batch No` | String | imported | `nan` |  |
| `PT Batch Status` | String | imported | `nan` |  |
| `PT Weld Status` | String | imported | `nan` |  |
| `PT Selected Date` | DateTime | imported | `Long Date` |  |
| `PT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PT Date` | DateTime | imported | `Long Date` |  |
| `PT Report` | String | imported | `nan` |  |
| `PT Acc/Rej` | String | imported | `nan` |  |
| `PT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PT Remarks` | String | imported | `nan` |  |
| `FN%` | Int64 | imported | `0` |  |
| `FN Batch No` | String | imported | `nan` |  |
| `FN Batch Status` | String | imported | `nan` |  |
| `FN Weld Status` | String | imported | `nan` |  |
| `FN Selected Date` | DateTime | imported | `Long Date` |  |
| `FN Exam Req date` | DateTime | imported | `Long Date` |  |
| `FN Date` | DateTime | imported | `Long Date` |  |
| `FN Report` | String | imported | `nan` |  |
| `FN Acc/Rej` | String | imported | `nan` |  |
| `FN Client Exam Req Y/N` | String | imported | `nan` |  |
| `FN Remarks` | String | imported | `nan` |  |
| `PADLT Y/N` | String | imported | `nan` |  |
| `PADLT Weld Status` | String | imported | `nan` |  |
| `PADLT Selected Date` | DateTime | imported | `Long Date` |  |
| `PADLT Exam Req date` | DateTime | imported | `Long Date` |  |
| `PADLT Date` | DateTime | imported | `Long Date` |  |
| `PADLT Report` | String | imported | `nan` |  |
| `PADLT Acc/Rej` | String | imported | `nan` |  |
| `PADLT Client Exam Req Y/N` | String | imported | `nan` |  |
| `PADLT Remarks` | String | imported | `nan` |  |
| `ORIF Y/N` | String | imported | `nan` |  |
| `ORIF Weld Status` | String | imported | `nan` |  |
| `ORIF Selected Date` | DateTime | imported | `Long Date` |  |
| `ORIF Exam Req date` | DateTime | imported | `Long Date` |  |
| `ORIF Date` | DateTime | imported | `Long Date` |  |
| `ORIF Report` | String | imported | `nan` |  |
| `ORIF Acc/Rej` | String | imported | `nan` |  |
| `ORIF Client Exam Req Y/N` | String | imported | `nan` |  |
| `Matrl Traceability Y/N` | String | imported | `nan` |  |
| `GROUP-1` | String | imported | `nan` |  |
| `IDENT CODE-1` | String | imported | `nan` |  |
| `TRAC NO-1` | String | imported | `nan` |  |
| `Part 1` | String | imported | `nan` |  |
| `GROUP-2` | String | imported | `nan` |  |
| `IDENT CODE-2` | String | imported | `nan` |  |
| `TRAC NO-2` | String | imported | `nan` |  |
| `Part 2` | String | imported | `nan` |  |
| `Revision Status` | String | imported | `nan` |  |
| `Revision Comments` | String | imported | `nan` |  |
| `Hold Status` | String | imported | `nan` |  |
| `Hold Comments` | String | imported | `nan` |  |
| `Piping Group` | String | imported | `nan` |  |
| `Golden Weld Report Date` | String | imported | `nan` |  |
| `Golden Weld Report No` | String | imported | `nan` |  |
| `Custom3` | String | imported | `nan` |  |
| `Custom11` | String | imported | `nan` |  |
| `Custom12` | String | imported | `nan` |  |
| `Custom13` | String | imported | `nan` |  |
| `Subsystem Code` | String | imported | `nan` |  |
| `Spool ID` | String | imported | `nan` |  |
| `Welded Dia` | 1 | calculated | `0` |  |
| `Total Welded Dia` | 1 | calculated | `nan` |  |
| `Repair & Reweld` | 1 | calculated | `nan` |  |
| `Joint ID` | String | imported | `nan` |  |
| `No of Days "WD"` | 1 | calculated | `0` |  |
| `Fabricated Date` | 1 | calculated | `d mmmm\, yyyy` |  |
| `Status FABRICATED` | 1 | calculated | `nan` |  |
| `QC Release Date` | 1 | calculated | `d mmmm\, yyyy` |  |
| `Status QC Release` | 1 | calculated | `nan` |  |
| `PAINTED Date` | 1 | calculated | `d mmmm\, yyyy` |  |
| `Status PAINTED` | 1 | calculated | `nan` |  |
| `Status Spool NDE` | 1 | calculated | `nan` |  |
| `To Site Date` | String | calculated | `nan` |  |
| `Status To Site` | 1 | calculated | `nan` |  |
| `ERECTED Date` | 1 | calculated | `nan` |  |
| `Status ERECTED` | 1 | calculated | `nan` |  |
| `Last Status` | 1 | calculated | `nan` |  |
| `Last_Weld Date` | 1 | calculated | `dd-mmm-yy` |  |
| `Days Since Last Weld` | 1 | calculated | `0` |  |
| `RT Film Ratio % "WD" For Welder` | 1 | calculated | `0.00%;-0.00%;0.00%` |  |
| `Total No Films A+R` | 1 | calculated | `0` |  |
| `RT FILM Ratio % STATUS "WD"` | 1 | calculated | `nan` |  |
| `NDT Remarks` | String | imported | `nan` |  |
| `Original Joint` | String | imported | `nan` |  |
| `Repair Suffix` | String | imported | `nan` |  |
| `Weld Point Code` | String | imported | `nan` |  |
| `RT/UT` | String | imported | `nan` |  |
| `RT Film Total` | Double | imported | `nan` |  |
| `Tracer Shot` | String | imported | `nan` |  |
| `Service Class+Service Cat "WD"` | 1 | calculated | `nan` |  |
| `Last_RT Date "EP"` | 1 | calculated | `dd-mmm-yy` |  |
| `Days Since Last RT "EP"` | Int64 | calculated | `nan` |  |
| `TMCP Pipe` | 1 | calculated | `nan` |  |
| `UT Operator ID` | String | imported | `nan` |  |
| `Manual UT Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Manual UT Report No` | String | imported | `nan` |  |
| `Manual UT Status` | String | imported | `nan` |  |
| `Commissioning Package` | String | imported | `nan` |  |
| `TPI Cross Checked` | String | imported | `nan` |  |
| `Checked Date` | DateTime | imported | `Long Date` |  |
| `Result (A/R)` | String | imported | `nan` |  |
| `PWHT Selected By` | String | imported | `nan` |  |
| `PWHT Exam Req No` | String | imported | `nan` |  |
| `PWHT Exam Req By` | String | imported | `nan` |  |
| `HT Selected By` | String | imported | `nan` |  |
| `HT Exam Req No` | String | imported | `nan` |  |
| `HT Exam Req By` | String | imported | `nan` |  |
| `RT Selected By` | String | imported | `nan` |  |
| `RT Exam Req No` | String | imported | `nan` |  |
| `RT Exam Req By` | String | imported | `nan` |  |
| `UT Selected By` | String | imported | `nan` |  |
| `UT Exam Req No` | String | imported | `nan` |  |
| `UT Exam Req By` | String | imported | `nan` |  |
| `MT Selected By` | String | imported | `nan` |  |
| `MT Exam Req No` | String | imported | `nan` |  |
| `MT Exam Req By` | String | imported | `nan` |  |
| `PMI Selected By` | String | imported | `nan` |  |
| `PMI Exam Req No` | String | imported | `nan` |  |
| `PMI Exam Req By` | String | imported | `nan` |  |
| `PT Selected By` | String | imported | `nan` |  |
| `PT Exam Req No` | String | imported | `nan` |  |
| `PT Exam Req By` | String | imported | `nan` |  |
| `FN Selected By` | String | imported | `nan` |  |
| `FN Exam Req No` | String | imported | `nan` |  |
| `FN Exam Req By` | String | imported | `nan` |  |
| `PADLT Selected By` | String | imported | `nan` |  |
| `PADLT Exam Req No` | String | imported | `nan` |  |
| `PADLT Exam Req By` | String | imported | `nan` |  |
| `ORIF Selected By` | String | imported | `nan` |  |
| `ORIF Exam Req No` | String | imported | `nan` |  |
| `ORIF Exam Req By` | String | imported | `nan` |  |
| `PED` | String | imported | `nan` |  |
| `Priority No` | String | imported | `nan` |  |
| `GWBS` | String | imported | `nan` |  |
| `PDS Area Type` | String | imported | `nan` |  |
| `SHIPMENT DATE` | String | imported | `nan` |  |
| `PACKING LIST NO` | String | imported | `nan` |  |
| ` SHIPMENT RECV DATE` | String | imported | `nan` |  |
| ` EREC MIR DATE` | String | imported | `nan` |  |
| ` EREC MIR NO` | String | imported | `nan` |  |
| ` SHEET NO` | String | imported | `nan` |  |
| `PIP-001-A` | String | imported | `nan` |  |
| `W24DWIR` | String | imported | `nan` |  |
| `BHS` | String | imported | `nan` |  |
| ` TESTPACK SUB CONTRACTOR` | String | imported | `nan` |  |
| ` TESTPACK TEST DONE DATE` | DateTime | imported | `Long Date` |  |
| `PIP-124-A` | String | imported | `nan` |  |
| `WHS` | String | imported | `nan` |  |
| `Temporary Lines "WD"` | 1 | calculated | `nan` |  |
| `Golden Weld` | String | imported | `nan` |  |

### `Weld Length` — 3 columns, 728,550 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Weld Type` | String | imported | `nan` |  |
| `Dia inch` | Double | imported | `0.00` |  |
| `Weld Length` | Double | imported | `nan` |  |

### `Welding Progress (Project) Nov 2024 - Nov 2025` — 3 columns, 116 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Week_End_Date` | DateTime | imported | `dd-mmm-yy` |  |
| `Joint Uniq "PR all" Welded` | Int64 | imported | `0` |  |
| `Weld Qty` | String | imported | `nan` |  |

### `l2_ndt_list` — 22 columns, 202 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `HA` | String | imported | `nan` |  |
| `CWA` | String | imported | `nan` |  |
| `SCTR` | String | imported | `nan` |  |
| `EP_PIC_Testpack_No` | String | imported | `nan` |  |
| `Joint_ID` | String | imported | `nan` |  |
| `Report_Type` | String | imported | `nan` |  |
| `Report_No` | String | imported | `nan` |  |
| `Report_Date` | DateTime | imported | `Long Date` |  |
| `REPORTS All DataBase` | 1 | calculated | `nan` |  |
| `Joint ID AllData "Pr all"` | 1 | calculated | `nan` |  |
| `CROSS CHECK FRB DATA REPORTS & PRJ` | 1 | calculated | `nan` |  |
| `System_No` | String | imported | `nan` |  |
| `ISO_Number` | String | imported | `nan` |  |
| `Result` | String | imported | `nan` |  |
| `Comments` | String | imported | `nan` |  |
| `SPO Upload Date` | DateTime | imported | `Long Date` |  |
| `SPO_URL` | String | imported | `nan` |  |
| `Origin_Report_No` | String | imported | `nan` |  |
| `Uniq Report` | 1 | calculated | `nan` |  |
| `Report_Type_Desc` | String | imported | `nan` |  |
| `Remarks` | String | imported | `nan` |  |
| `Source` | String | imported | `nan` |  |

### `l3_ndt_spo_summary` — 12 columns, 9,638 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `COD` | DateTime | imported | `dd-mmm-yy` |  |
| `Sub_Contractor` | String | imported | `nan` |  |
| `Report_Type` | String | imported | `nan` |  |
| `EP_Total` | Int64 | imported | `0` |  |
| `Not_Uploaded` | Int64 | imported | `0` |  |
| `Not_Uploaded_MaxDays` | Int64 | imported | `0` |  |
| `SPO_Uploaded` | Int64 | imported | `0` |  |
| `SPO_Uploaded_MinDays` | Int64 | imported | `0` |  |
| `SPO_Matched_EP` | Int64 | imported | `0` |  |
| `SPO_Mismatched_EP` | Int64 | imported | `0` |  |
| `Total` | Int64 | imported | `0` |  |
| `PIMS_transmitted` | Int64 | imported | `0` |  |

### `l3_ndt_spo_summary (2)` — 10 columns, 17 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `COD` | DateTime | imported | `dd-mmm-yy` |  |
| `Sub_Contractor` | String | imported | `nan` |  |
| `Report_Type` | String | imported | `nan` |  |
| `EP_Total` | Int64 | imported | `0` |  |
| `Not_Uploaded` | Int64 | imported | `0` |  |
| `Not_Uploaded_MaxDays` | Int64 | imported | `0` |  |
| `SPO_Uploaded` | Int64 | imported | `0` |  |
| `SPO_Uploaded_MinDays` | Int64 | imported | `0` |  |
| `SPO_Matched_EP` | Int64 | imported | `0` |  |
| `SPO_Mismatched_EP` | Int64 | imported | `0` |  |

### `t_QOB_Log_SP` — 29 columns, 16,532 rows

| column | data type | kind | format | hidden |
|---|---|---|---|---|
| `Observation Source Ref` | String | imported | `nan` |  |
| `QOB Reference` | String | imported | `nan` |  |
| `Observation Type` | String | imported | `nan` |  |
| `QOB Status` | String | imported | `nan` |  |
| `Issued By` | String | imported | `nan` |  |
| `Created By` | String | imported | `nan` |  |
| `Created By email` | String | imported | `nan` |  |
| `SCTR` | String | imported | `nan` |  |
| `Drafted date` | DateTime | imported | `dd-mmm-yy` |  |
| `Issued Date` | DateTime | imported | `dd-mmm-yy` |  |
| `QOB Discipline` | String | imported | `nan` |  |
| `Source discipline` | String | imported | `nan` |  |
| `Area` | String | imported | `nan` |  |
| `Precise location or TAG` | String | imported | `nan` |  |
| `Observation Description` | String | imported | `nan` |  |
| `Close out date` | DateTime | imported | `dd-mmm-yy` |  |
| `ChronoNumber` | Int64 | imported | `0` |  |
| `Observation source (WQWT or CQA)` | String | imported | `nan` |  |
| `Project Week Number` | Int64 | imported | `0` |  |
| `CQA CheckSheet Ident Code` | String | imported | `nan` |  |
| `CQA CheckSheet Description` | String | imported | `nan` |  |
| `Actions taken` | String | imported | `nan` |  |
| `Images` | String | imported | `nan` |  |
| `Comments` | String | imported | `nan` |  |
| `Attachments` | Boolean | imported | `"TRUE";"TRUE";"FALSE"` |  |
| `ID` | Int64 | imported | `0` |  |
| `Created` | DateTime | imported | `dd-mmm-yy` |  |
| `Modified` | DateTime | imported | `dd-mmm-yy` |  |
| `List` | String | imported | `nan` |  |

## Power Query (M) per table — verbatim (62 queries)

### `Weld Dump`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Weld Dump Work File\Weld Dump.txt"),[Delimiter=";", Columns=226, Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Removed  WELDTYPEPARAMETER" = Table.RemoveColumns(Source,{"Column221"}),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed  WELDTYPEPARAMETER", [PromoteAllScalars=true]),
    #"TESTPACK TEST DONE DATE" = Table.TransformColumnTypes(#"Promoted Headers",{{" TESTPACK TEST DONE DATE", type date}}),
    #"Exlude Area Class ""0""" = Table.SelectRows(#"TESTPACK TEST DONE DATE", each ([Area Classification] <> 0 and [Area Classification] <> "")),
    #"Replaced Value NA" = Table.ReplaceValue(#"Exlude Area Class ""0""","NA","",Replacer.ReplaceText,{"Preheat Date"}),
    #"Replaced Value NA Weld date" = Table.ReplaceValue(#"Replaced Value NA","NA","",Replacer.ReplaceText,{"Weld Date"}),
    #"Replaced Value NA Cutt" = Table.ReplaceValue(#"Replaced Value NA Weld date","NA","",Replacer.ReplaceText,{"Cutting Date"}),
    #"Replaced Value NA Bevel" = Table.ReplaceValue(#"Replaced Value NA Cutt","NA","",Replacer.ReplaceText,{"Beveling Date"}),
    #"Replaced Value NA Fit" = Table.ReplaceValue(#"Replaced Value NA Bevel","NA","",Replacer.ReplaceText,{"Fitup Date"}),
    #"Replaced Value NA Mir" = Table.ReplaceValue(#"Replaced Value NA Fit","NA","",Replacer.ReplaceText,{"MIR Date"}),
    #"Check Date 1" = Table.ReplaceValue(#"Replaced Value NA Mir","/","-",Replacer.ReplaceText,{"Checked Date"}),
    #"Replaced Value" = Table.ReplaceValue(#"Check Date 1","45455","12-Jun-2024",Replacer.ReplaceText,{"Checked Date"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value","45433","21-May-2024",Replacer.ReplaceText,{"Checked Date"}),
    #"Replaced Value2" = Table.ReplaceValue(#"Replaced Value1","45432","20-May-2024",Replacer.ReplaceText,{"Checked Date"}),
    #"Replaced Value3" = Table.ReplaceValue(#"Replaced Value2","45441","29-May-2024",Replacer.ReplaceText,{"Checked Date"}),
    #"Replaced Value4" = Table.ReplaceValue(#"Replaced Value3","45442","30-May-2024",Replacer.ReplaceText,{"Checked Date"}),
    #"Replaced Value5" = Table.ReplaceValue(#"Replaced Value4","45456","13-Jun-2024",Replacer.ReplaceText,{"Checked Date"}),
    #"Replaced Result (A/R)" = Table.ReplaceValue(#"Replaced Value5","ACCEPT","A",Replacer.ReplaceText,{"Result (A/R)"}),
    #"Replaced Value6" = Table.ReplaceValue(#"Replaced Result (A/R)","GAC,GAC","GAC",Replacer.ReplaceText,{" TESTPACK SUB CONTRACTOR"}),
    #"Replaced Value7" = Table.ReplaceValue(#"Replaced Value6","GAC,GAC,GAC","GAC",Replacer.ReplaceText,{" TESTPACK SUB CONTRACTOR"}),
    #"Replaced Value10" = Table.ReplaceValue(#"Replaced Value7","GAC,GAC","GAC",Replacer.ReplaceText,{" TESTPACK SUB CONTRACTOR"}),
    #"Replaced Value8" = Table.ReplaceValue(#"Replaced Value10","MEDGULF,MEDGULF","MEDGULF",Replacer.ReplaceText,{" TESTPACK SUB CONTRACTOR"}),
    #"Replaced Value9" = Table.ReplaceValue(#"Replaced Value8","MEDGULF,MEDGULF","MEDGULF",Replacer.ReplaceText,{" TESTPACK SUB CONTRACTOR"}),
    #"Replaced Value11" = Table.ReplaceValue(#"Replaced Value9","TEKFEN,TEKFEN,TEKFEN","TEKFEN",Replacer.ReplaceText,{" TESTPACK SUB CONTRACTOR"}),
    #"Replaced Value12" = Table.ReplaceValue(#"Replaced Value11","TEKFEN,TEKFEN","TEKFEN",Replacer.ReplaceText,{" TESTPACK SUB CONTRACTOR"}),
    #"Replaced BW_ to BW" = Table.ReplaceValue(#"Replaced Value12","BW_","BW",Replacer.ReplaceText,{"Weld Type"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced BW_ to BW",{{"ISO Number", type text}, {"Spool No.", type text}, {"Weld No.", type text}, {"Weld Cat", type text}, {"Weld Type", type text}, {"Dia Inch Factor", type text}, {"Dia inch", type number}, {"Thickness", type number}, {"PDS Area", type text}, {"AG/UG/PKG", type text}, {"Area Classification", Int64.Type}, {"wbu", Int64.Type}, {"System no", type text}, {"Testpack No", type text}, {"Service class", type text}, {"Service Cat", type text}, {"Material Type", type text}, {"MIR No", type text}, {"MIR Date", type date}, {"Cutting Date", type date}, {"Beveling Date", type date}, {"Fitup Date", type date}, {"Preheat Date", type date}, {"Weld Date", type date}, {"DWIR No.", type text}, {"Sub-Contractor", type text}, {"Rework Code", type text}, {"WeldPoint No.", Int64.Type}, {"WPS No.", type text}, {"Welder", type text}, {"PWHT Y/N", type text}, {"PWHT Weld Status", type text}, {"PWHT Selected Date", type date}, {"PWHT Exam Req date", type date}, {"PWHT Date", type date}, {"PWHT Report", type text}, {"PWHT Acc/Rej", type text}, {"PWHT Client Exam Req Y/N", type text}, {"PWHT Remarks", type text}, {"HT%", Int64.Type}, {"HT Batch No", type text}, {"HT Batch Status", type text}, {"HT Weld Status", type text}, {"HT Selected Date", type date}, {"HT Exam Req date", type date}, {"HT Date", type date}, {"HT Report", type text}, {"HT Acc/Rej", type text}, {"HT Client Exam Req Y/N", type text}, {"HT Remarks", type text}, {"RT%", Int64.Type}, {"RT Batch No", Int64.Type}, {"RT Batch Status", type text}, {"RT Weld Status", type text}, {"RT Selected Date", type date}, {"RT Exam Req date", type date}, {"RT Date", type date}, {"RT Xray No", type text}, {"RT Report", type text}, {"RT Acc/Rej", type text}, {"Total No of films Acc", Int64.Type}, {"Total No of films Rej", Int64.Type}, {"Defect Code", type text}, {"Location of Defect", type text}, {"RT Re-Shoot Rep", type text}, {"RT Re-Shoot Data", type date}, {"RT Re-Shoot Status", type text}, {"RT Re-Shoot Reason", type text}, {"RT Re-Shoot Films", Int64.Type}, {"Weld Length", type number}, {"Rej Length", type number}, {"RT Client Exam Req Y/N", type text}, {"By UT", type text}, {"RT Remarks", type text}, {"UT%", Int64.Type}, {"UT Batch No", type text}, {"UT Batch Status", type text}, {"UT Weld Status", type text}, {"UT Selected Date", type date}, {"UT Exam Req date", type date}, {"UT Date", type date}, {"UT Report", type text}, {"UT Acc/Rej", type text}, {"UT Client Exam Req Y/N", type text}, {"UT Remarks", type text}, {"MT%", Int64.Type}, {"MT Batch No", type text}, {"MT Batch Status", type text}, {"MT Weld Status", type text}, {"MT Selected Date", type date}, {"MT Exam Req date", type date}, {"MT Date", type date}, {"MT Report", type text}, {"MT Acc/Rej", type text}, {"MT Client Exam Req Y/N", type text}, {"MT Remarks", type text}, {"PMI%", Int64.Type}, {"PMI Batch No", type text}, {"PMI Batch Status", type text}, {"PMI Weld Status", type text}, {"PMI Selected Date", type date}, {"PMI Exam Req date", type date}, {"PMI Date", type date}, {"PMI Report", type text}, {"PMI Acc/Rej", type text}, {"PMI Client Exam Req Y/N", type text}, {"PMI Remarks", type text}, {"PT%", Int64.Type}, {"PT Batch No", type text}, {"PT Batch Status", type text}, {"PT Weld Status", type text}, {"PT Selected Date", type date}, {"PT Exam Req date", type date}, {"PT Date", type date}, {"PT Report", type text}, {"PT Acc/Rej", type text}, {"PT Client Exam Req Y/N", type text}, {"PT Remarks", type text}, {"FN%", Int64.Type}, {"FN Batch No", type text}, {"FN Batch Status", type text}, {"FN Weld Status", type text}, {"FN Selected Date", type date}, {"FN Exam Req date", type date}, {"FN Date", type date}, {"FN Report", type text}, {"FN Acc/Rej", type text}, {"FN Client Exam Req Y/N", type text}, {"FN Remarks", type text}, {"PADLT Y/N", type text}, {"PADLT Weld Status", type text}, {"PADLT Selected Date", type date}, {"PADLT Exam Req date", type date}, {"PADLT Date", type date}, {"PADLT Report", type text}, {"PADLT Acc/Rej", type text}, {"PADLT Client Exam Req Y/N", type text}, {"PADLT Remarks", type text}, {"ORIF Y/N", type text}, {"ORIF Weld Status", type text}, {"ORIF Selected Date", type date}, {"ORIF Exam Req date", type date}, {"ORIF Date", type date}, {"ORIF Report", type text}, {"ORIF Acc/Rej", type text}, {"ORIF Client Exam Req Y/N", type text}, {"Matrl Traceability Y/N", type text}, {"GROUP-1", type text}, {"IDENT CODE-1", type text}, {"TRAC NO-1", type text}, {"Part 1", type text}, {"GROUP-2", type text}, {"IDENT CODE-2", type text}, {"TRAC NO-2", type text}, {"Part 2", type text}, {"Revision Status", type text}, {"Revision Comments", type text}, {"Hold Status", type text}, {"Hold Comments", type text}, {"Piping Group", type text}, {"Golden Weld Report Date", type text}, {"Golden Weld Report No", type text}, {"Custom3", type text}, {"Custom11", type text}, {"Custom12", type text}, {"Custom13", type text}, {"Subsystem Code", type text}}),
    #"Revision Status" = Table.SelectRows(#"Changed Type", each ([Revision Status] = "")),
    #"Added Custom" = Table.AddColumn(#"Revision Status", "Spool ID", each [ISO Number]&"-"&[#"Spool No."]),
    #"JOINT ID" = Table.AddColumn(#"Added Custom", "JOINT ID", each [ISO Number]&"-"&[#"Spool No."]&"-"&[#"Weld No."]),
    #"Reordered Columns" = Table.ReorderColumns(#"JOINT ID",{"JOINT ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom11", "Custom12", "Custom13", "Subsystem Code"}),
    #"Renamed Columns" = Table.RenameColumns(#"Reordered Columns",{{"JOINT ID", "Joint ID"}}),
    #"Added Custom1" = Table.AddColumn(#"Renamed Columns", "RT/UT", each ""),
    #"Reordered Columns1" = Table.ReorderColumns(#"Added Custom1",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom11", "Custom12", "Custom13", "Subsystem Code"}),
    #"Added RT Film Total" = Table.AddColumn(#"Reordered Columns1", "RT Film Total", each [Total No of films Acc]+[Total No of films Rej]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Added RT Film Total",{{"RT Film Total", type number}}),
    #"Reordered Columns2" = Table.ReorderColumns(#"Changed Type1",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom11", "Custom12", "Custom13", "Subsystem Code"}),
    #"Added Custom4" = Table.AddColumn(#"Reordered Columns2", "NDT Remarks", each ""),
    #"Reordered Columns3" = Table.ReorderColumns(#"Added Custom4",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom11", "Custom12", "Custom13",  "Subsystem Code"}),
    #"Added Custom5" = Table.AddColumn(#"Reordered Columns3", "Tracer Shot", each ""),
    #"Reordered Columns4" = Table.ReorderColumns(#"Added Custom5",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom11", "Custom12", "Custom13",  "Subsystem Code"}),
    #"Added Custom6" = Table.AddColumn(#"Reordered Columns4", "Weld Point Code", each ""),
    #"Reordered Columns5" = Table.ReorderColumns(#"Added Custom6",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3",  "Custom11", "Custom12", "Custom13", "Subsystem Code"}),
    #"Added Custom7" = Table.AddColumn(#"Reordered Columns5", "Original Joint", each ""),
    #"Added Custom8" = Table.AddColumn(#"Added Custom7", "Repair Suffix", each ""),
    #"Reordered Columns6" = Table.ReorderColumns(#"Added Custom8",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom11", "Custom12", "Custom13",  "Subsystem Code"}),
    #"Filtered Rows1 Subcon" = Table.SelectRows(#"Reordered Columns6", each ([#"Sub-Contractor"] <> "")),
    #"Changed Type2" = Table.TransformColumnTypes(#"Filtered Rows1 Subcon",{{"Total No of films Acc", type number}, {"Total No of films Rej", type number}}),
    #"9/5/0202 to null Fitup Date" = Table.ReplaceValue(#"Changed Type2",#date(202, 9, 5),null,Replacer.ReplaceValue,{"Fitup Date"}),
    #"9/5/0202 to null Cutting Date" = Table.ReplaceValue(#"9/5/0202 to null Fitup Date",#date(202, 9, 5),null,Replacer.ReplaceValue,{"Cutting Date"}),
    #"9/5/0202 to null Bev Date" = Table.ReplaceValue(#"9/5/0202 to null Cutting Date",#date(202, 9, 5),null,Replacer.ReplaceValue,{"Beveling Date"}),
    #"8/3/0202 to null Preheat Date" = Table.ReplaceValue(#"9/5/0202 to null Bev Date",#date(202, 8, 3),null,Replacer.ReplaceValue,{"Preheat Date"}),
    #"10/11/0202 to null Preheat Date" = Table.ReplaceValue(#"8/3/0202 to null Preheat Date",#date(202, 10, 11),null,Replacer.ReplaceValue,{"Preheat Date"}),
    #"MOVE UT Colums 31 May" = Table.ReorderColumns(#"10/11/0202 to null Preheat Date",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Commissioning Package", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "UT Operator ID", "Manual UT Date", "Manual UT Report No", "Manual UT Status", "TPI Cross Checked", "Checked Date", "Result (A/R)", "Custom3", "Custom11", "Custom12", "Custom13",  "Subsystem Code"}),
    #"Changed Type Manual UT" = Table.TransformColumnTypes(#"MOVE UT Colums 31 May",{{"Manual UT Date", type date}, {"Checked Date", type date}}),
    #"Replaced ACCEPT to A" = Table.ReplaceValue(#"Changed Type Manual UT","ACCEPT","A",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Replaced ACEEPT to A" = Table.ReplaceValue(#"Replaced ACCEPT to A","ACEEPT","A",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Replaced REJECT to R" = Table.ReplaceValue(#"Replaced ACEEPT to A","REJECT","R",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Exlude Area Class ""0"" 2" = Table.SelectRows(#"Replaced REJECT to R", each ([Area Classification] <> 0)),
    #"Replaced ""-"" to" = Table.ReplaceValue(#"Exlude Area Class ""0"" 2","-","",Replacer.ReplaceText,{"UT Operator ID"}),
    #"Removed HT Remarks" = Table.RemoveColumns(#"Replaced ""-"" to",{"HT Remarks"}),
    #"Added HT Remarks" = Table.AddColumn(#"Removed HT Remarks", "HT Remarks", each if Text.Contains([RT Report], "PAUT") then "PAUT" else null),
    #"Reordered Columns7" = Table.ReorderColumns(#"Added HT Remarks",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "PWHT Selected By", "Weld Point Code", "PWHT Exam Req No", "PWHT Exam Req By", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "HT Selected By", "PWHT Remarks", "HT Exam Req No", "HT Exam Req By", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT Selected By", "RT Exam Req No", "RT Exam Req By", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "UT Selected By", "RT Client Exam Req Y/N", "UT Exam Req No", "UT Exam Req By", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "MT Selected By", "UT Report", "MT Exam Req No", "MT Exam Req By", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "PMI Selected By", "MT Report", "PMI Exam Req No", "PMI Exam Req By", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PT Selected By", "PMI Report", "PT Exam Req No", "PT Exam Req By", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "FN Selected By", "PT Report", "FN Exam Req No", "FN Exam Req By", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "PADLT Selected By", "FN Exam Req date", "PADLT Exam Req No", "PADLT Exam Req By", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "ORIF Selected By", "PADLT Exam Req date", "ORIF Exam Req No", "ORIF Exam Req By", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Commissioning Package", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "UT Operator ID", "Manual UT Date", "Manual UT Report No", "Manual UT Status", "PED", "Priority No", "GWBS", "PDS Area Type", "SHIPMENT DATE", " PACKING LIST NO", " SHIPMENT RECV DATE", " EREC MIR DATE", " EREC MIR NO", " SHEET NO", " TESTPACK SUB CONTRACTOR", " TESTPACK TEST DONE DATE", "PIP-001-A", "W24DWIR", "BHS", "PIP-124-A", "WHS", "TPI Cross Checked", "Checked Date", "Result (A/R)", "Custom3", "Custom11", "Custom12", "Custom13",  "Subsystem Code"}),
    #"Changed Type HT Remarks" = Table.TransformColumnTypes(#"Reordered Columns7",{{"HT Remarks", type text}}),
    #"Renamed Columns1" = Table.RenameColumns(#"Changed Type HT Remarks",{{" PACKING LIST NO", "PACKING LIST NO"}}),
    #"Replaced T1-2 to T1" = Table.ReplaceValue(#"Renamed Columns1","T1-2","T1",Replacer.ReplaceText,{"RT Weld Status"}),
    #"Replaced SW_ to SW" = Table.ReplaceValue(#"Replaced T1-2 to T1","SW_","SW",Replacer.ReplaceText,{"Weld Type"}),
    Custom1 = #"Replaced SW_ to SW",
    #"Exlude after 28 Aug" = Table.SelectRows(Custom1, each [Weld Date] <> #date(2026, 12, 30) and [Weld Date] <> #date(2026, 8, 29) and [Weld Date] <> #date(2026, 8, 30))
in
    #"Exlude after 28 Aug"
```

### `Spool Dump`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\SpoolDump Work File\Spool Dump.txt"),[Delimiter=";", Columns=102, Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Replaced Value NA 10" = Table.ReplaceValue(#"Promoted Headers","NA","",Replacer.ReplaceText,{"MIR DATE"}),
    #"Replaced Value NA" = Table.ReplaceValue(#"Replaced Value NA 10","NA","",Replacer.ReplaceText,{"START FAB"}),
    #"Replaced Value NA 1" = Table.ReplaceValue(#"Replaced Value NA","NA","",Replacer.ReplaceText,{"FABRICATED"}),
    #"Replaced Value1 NA 2" = Table.ReplaceValue(#"Replaced Value NA 1","NA","",Replacer.ReplaceText,{"QC RELEASE"}),
    #"Replaced Value2 NA 3" = Table.ReplaceValue(#"Replaced Value1 NA 2","NA","",Replacer.ReplaceText,{"SENT TO PAINT"}),
    #"Replaced Value3 NA 4" = Table.ReplaceValue(#"Replaced Value2 NA 3","NA","",Replacer.ReplaceText,{"PAINTED"}),
    #"Replaced Value4 NA 5" = Table.ReplaceValue(#"Replaced Value3 NA 4","NA","",Replacer.ReplaceText,{"FINAL QC"}),
    #"Replaced Value5 NA 6" = Table.ReplaceValue(#"Replaced Value4 NA 5","NA","",Replacer.ReplaceText,{"MIR DATE"}),
    #"Replaced Value6 NA 7" = Table.ReplaceValue(#"Replaced Value5 NA 6","NA","",Replacer.ReplaceText,{"SUPPORTED"}),
    #"Replaced Value7 NA 8" = Table.ReplaceValue(#"Replaced Value6 NA 7","NA","",Replacer.ReplaceText,{"WELDED BOLT"}),
    #"Replaced Value8 NA 9" = Table.ReplaceValue(#"Replaced Value7 NA 8","NA","",Replacer.ReplaceText,{"RFT"}),
    #"Replaced Value9 NA 9" = Table.ReplaceValue(#"Replaced Value8 NA 9","NA","",Replacer.ReplaceText,{"LAYDOWN"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced Value9 NA 9",{{"ISO Number", type text}, {"Iso Rev No.", type text}, {"Spool No.", type text}, {"Barcode Number", Int64.Type}, {"Sheet No.", Int64.Type}, {"Spool Rev No.", type text}, {"Spool Shop Sub Contractor", type text}, {"Spool Field Sub Contractor", type text}, {"Spool Paint Sub Contractor", type text}, {"Shop Sub Contractor", type text}, {"Field Sub Contractor", type text}, {"Area Classification", Int64.Type}, {"WBU", Int64.Type}, {"PDS Area", type text}, {"Line No", type text}, {"Priority", type date}, {"System no", type text}, {"Testpack No", type text}, {"Service class", type text}, {"Service Cat", type text}, {"Piping Group", type text}, {"Matrl Type", type text}, {"Field Pipe", type text}, {"Shop Dia", type number}, {"Shop DI Comp", type number}, {"Field Dia", type number}, {"Field DI Comp", Int64.Type}, {"AG/UG/PKG", type text}, {"LB/SB", type text}, {"Spool diameter", type number}, {"Spool Weight", type number}, {"Spool Length", type number}, {"Spool Volume", type number}, {"Surface Area", type number}, {"Spool Inch Meter", type number}, {"Paint System", type text}, {"Material Availability", type text}, {"ETA", type date}, {"QC13 Form No", type text}, {"W10/P Form No", type text}, {"W24 Form No", type text}, {"Material Check", type date}, {"MIR NO", type text}, {"MIR DATE", type date}, {"START FAB", type date}, {"FABRICATED", type date}, {"QC RELEASE", type date}, {"SENT TO PAINT", type date}, {"PAINTED", type date}, {"FINAL QC", type date}, {"LAYDOWN", type date}, {"Spool Nde Status", type text}, {"TO SITE", type text}, {"ERECTED", type text}, {"WELDED BOLT", type text}, {"SUPPORTED", type text}, {"RFT", type text}, {"INTERNAL CLEANING IDLL", type text}, {"CLEANING PRIOR INSTALLATION", type text}, {"Revision Status", type text}, {"Revision Comments", type text}, {"Hold Status", type text}, {"Hold Comments", type text}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each ([Revision Status] = "")),
    #"Changed Type1" = Table.TransformColumnTypes(#"Filtered Rows",{{"TO SITE", type date}, {"ERECTED", type date}, {"WELDED BOLT", type date}, {"SUPPORTED", type date}, {"RFT", type date}, {"TESTPACK TEST DONE DATE", type date}, {"Spool Tracking Date", type date}}),
    #"Spool ID" = Table.AddColumn(#"Changed Type1", "Spool ID table", each [ISO Number]&"-"&[#"Spool No."])
in
    #"Spool ID"
```

### `AllTrain_CSVExport_Joint Record`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\PCI CCC  PBI WORK FILES\AllTrain_CSVExport_Joint Record.csv"),[Delimiter=",", Columns=143, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type2" = Table.TransformColumnTypes(#"Promoted Headers",{{"Joint No", type text}}),
    #"Replaced 0:00:00" = Table.ReplaceValue(#"Changed Type2","0:00:00","",Replacer.ReplaceText,{"Weld Date"}),
    #"Replaced 0:00:00 2" = Table.ReplaceValue(#"Replaced 0:00:00","0:00:00","",Replacer.ReplaceText,{"RT/UT Date"}),
    #"Replaced 0:00:00  3" = Table.ReplaceValue(#"Replaced 0:00:00 2","0:00:00","",Replacer.ReplaceText,{"PT Root Date"}),
    #"Replaced 0:00:00 4" = Table.ReplaceValue(#"Replaced 0:00:00  3","0:00:00","",Replacer.ReplaceText,{"MT Root Date"}),
    #"Replaced 0:00:00 5" = Table.ReplaceValue(#"Replaced 0:00:00 4","0:00:00","",Replacer.ReplaceText,{"PWHT Date"}),
    #"Replaced 0:00:00 6" = Table.ReplaceValue(#"Replaced 0:00:00 5","0:00:00","",Replacer.ReplaceText,{"PMI Date"}),
    #"Replaced 0:00:00 7" = Table.ReplaceValue(#"Replaced 0:00:00 6","0:00:00","",Replacer.ReplaceText,{"HT Date"}),
    #"Replaced 0:00:00 8" = Table.ReplaceValue(#"Replaced 0:00:00 7","0:00:00","",Replacer.ReplaceText,{"PMI Up Date"}),
    #"Replaced 0:00:00 9" = Table.ReplaceValue(#"Replaced 0:00:00 8","0:00:00","",Replacer.ReplaceText,{"FT Date"}),
    #"Replaced 0:00:00 10" = Table.ReplaceValue(#"Replaced 0:00:00 9","0:00:00","",Replacer.ReplaceText,{"PMI Up Date"}),
    #"Replaced 0:00:00 11" = Table.ReplaceValue(#"Replaced 0:00:00 10","0:00:00","",Replacer.ReplaceText,{"PMI Down Date"}),
    #"Replaced 0:00:00 12" = Table.ReplaceValue(#"Replaced 0:00:00 11","0:00:00","",Replacer.ReplaceText,{"HT Date"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced 0:00:00 12",{{"Del Flag", type text}, {"Weld Point First", type text}, {"Original Joint", type text}, {"Latest Joint", type text}, {"Project No", Int64.Type}, {"Sub-Con Code", type text}, {"Area Code", type text}, {"Area Group-1", type text}, {"Area Group-2", type text}, {"Area Group-3", type text}, {"Area Group-4", type text}, {"Area Group-5", type text}, {"QC ISO DWG No", type text}, {"Sheet No", Int64.Type}, {"Repair Suffix", type text}, {"Spool No", type text}, {"Revision No", type text}, {"Rework Code", type text}, {"Rework Code2", type text}, {"Rework Ref Doc No", type text}, {"Tracer Shot", type text}, {"Service Class", type text}, {"Pressure Level", type text}, {"Size-2", type number}, {"Size Range", type text}, {"Dia-Inch", type number}, {"Wall Thickness", type number}, {"Material Category", type text}, {"P No", Int64.Type}, {"Material Spec", type text}, {"Pipe Schedule", type text}, {"Design Code", type text}, {"Work Category", type text}, {"Original Work Category", type text}, {"Weld Type", type text}, {"NDT Remarks", type text}, {"Test Package No", type text}, {"Sub-System No", type text}, {"Remarks", type text}, {"Weld Report No", type text}, {"Weld Date", type date}, {"Weld Week", type text}, {"Weld Month", type text}, {"Welder(Root)", type text}, {"Welder(Heat)", type text}, {"Welder(Fill)", type text}, {"Welder(Cap)", type text}, {"EP Date", type text}, {"EP Judge", type text}, {"EP Identifier Date", type text}, {"EP Identifier Client", type text}, {"EP Identifier Chiyoda", type text}, {"VI Date", type text}, {"VI Judge", type text}, {"VI Identifier Client", type text}, {"VI Identifier Chiyoda", type text}, {"WT Measurement Data", type text}, {"WT Date", type text}, {"RT/UT", type text}, {"RT/UT Report No", type text}, {"RT Film Total", Int64.Type}, {"RT/UT Date", type date}, {"RT/UT(%)", Int64.Type}, {"RT/UT Request Date", type text}, {"RT/UT Result", type text}, {"Reshoot-1 RT/UT Report No", type text}, {"Reshoot-1 RT Film Total", type text}, {"Reshoot-1 RT/UT Date", type text}, {"Reshoot-1 RT/UT Result", type text}, {"Reshoot-2 RT/UT Report No", type text}, {"Reshoot-2 RT Film Total", type text}, {"Reshoot-2 RT/UT Date", type text}, {"Reshoot-2 RT/UT Result", type text}, {"Reshoot-3 RT/UT Report No", type text}, {"Reshoot-3 RT Film Total", type text}, {"Reshoot-3 RT/UT Date", type text}, {"Reshoot-3 RT/UT Result", type text}, {"Reshoot RT/UT Total", type text}, {"Reshoot RT/UT Film Total", type text}, {"Last Reshoot Date (RT/UT)", type text}, {"Last Reshoot Report No (RT/UT)", type text}, {"Last Reshoot Result (RT/UT)", type text}, {"RT2/UT2", type text}, {"RT2/UT2 Report No", type text}, {"RT2 Film Total", type text}, {"RT2/UT2 Date", type text}, {"RT2/UT2(%)", Int64.Type}, {"RT2/UT2 Request Date", type text}, {"RT2/UT2 Result", type text}, {"Reshoot-1 RT2/UT2 Report No", type text}, {"Reshoot-1 RT2 Film Total", type text}, {"Reshoot-1 RT2/UT2 Date", type text}, {"Reshoot-1 RT2/UT2 Result", type text}, {"Reshoot-2 RT2/UT2 Report No", type text}, {"Reshoot-2 RT2 Film Total", type text}, {"Reshoot-2 RT2/UT2 Date", type text}, {"Reshoot-2 RT2/UT2 Result", type text}, {"Reshoot-3 RT2/UT2 Report No", type text}, {"Reshoot-3 RT2 Film Total", type text}, {"Reshoot-3 RT2/UT2 Date", type text}, {"Reshoot-3 RT2/UT2 Result", type text}, {"Reshoot RT2/UT2 Total", type text}, {"Reshoot RT2/UT2 Film Total", type text}, {"Last Reshoot Date (RT2/UT2)", type text}, {"Last Reshoot Report No (RT2/UT2)", type text}, {"Last Reshoot Result (RT2/UT2)", type text}, {"PT Root Report No", type text}, {"PT Root Date", type date}, {"PT Root(%)", Int64.Type}, {"PT Root Request Date", type text}, {"PT Cap Report No", type text}, {"PT Cap Date", type text}, {"PT Cap(%)", Int64.Type}, {"PT Cap Request Date", type text}, {"MT Root Report No", type text}, {"MT Root Date", type date}, {"MT Root(%)", Int64.Type}, {"MT Root Request Date", type text}, {"MT Cap Report No", type text}, {"MT Cap Date", type text}, {"MT Cap(%)", Int64.Type}, {"MT Cap Request Date", type text}, {"PWHT Report No", type text}, {"PWHT Date", type date}, {"PWHT", type text}, {"PWHT Request Date", type text}, {"HT Report No", type text}, {"HT Date", type date}, {"HT(%)", type text}, {"HT Request Date", type text}, {"PMI Report No", type text}, {"PMI Date", type date}, {"PMI(%)", type text}, {"PMI Request Date", type text}, {"PMI Up Report No", type text}, {"PMI Up Date", type date}, {"PMI Down Report No", type text}, {"PMI Down Date", type date}, {"FT Report No", type text}, {"FT Date", type date}, {"FT(%)", type text}, {"FT Request Date", type text}}),
    #"Filtered Del Flag" = Table.SelectRows(#"Changed Type", each ([Del Flag] = "")),
    #"Spool Id" = Table.AddColumn(#"Filtered Del Flag", "Spool ID ""JR"" Table", each [#"QC ISO DWG No"]&"-"&[#"Spool No"]),
    #"Replaced Value" = Table.ReplaceValue(#"Spool Id","R01","R1",Replacer.ReplaceText,{"Repair Suffix"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value","R02","R2",Replacer.ReplaceText,{"Repair Suffix"}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Replaced Value1",{{"PWHT Date", type date}}),
    #"Joint ID" = Table.AddColumn(#"Changed Type1", "Joint ID", each [#"QC ISO DWG No"]&"-"&[#"Spool No"]&"-"&[#"Joint No"]&""&[Repair Suffix]),
    #"Changed Type3" = Table.TransformColumnTypes(#"Joint ID",{{"Joint ID", type text}, {"Reshoot-1 RT/UT Date", type date}, {"Reshoot-2 RT/UT Date", type date}, {"Reshoot-3 RT/UT Date", type date}, {"PT Cap Date", type date}, {"MT Root Request Date", type date}, {"MT Cap Date", type date}, {"MT Cap Request Date", type date}, {"PWHT Request Date", type date}, {"HT Date", type date}, {"HT Request Date", type date}, {"PMI Request Date", type date}, {"PMI Up Date", type date}, {"PMI Down Date", type date}, {"FT Date", type date}, {"FT Request Date", type date}, {"HT(%)", Int64.Type}, {"PMI(%)", Int64.Type}, {"FT(%)", Int64.Type}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type3",{{"Spool No", "Spool No."}}),
    #"Replaced Value2" = Table.ReplaceValue(#"Renamed Columns",#date(2008, 6, 24),#date(2024, 6, 24),Replacer.ReplaceValue,{"Weld Date"}),
    Custom1 = #"Replaced Value2"
in
    Custom1
```

### `CSVExport_Welder Record`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\PCI CCC  PBI WORK FILES\CSVExport_Welder Record.csv"),[Delimiter=",", Columns=119, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Replaced WD Value 0:00 to" = Table.ReplaceValue(#"Promoted Headers","0:00:00","",Replacer.ReplaceText,{"Weld Date"}),
    #"Replaced RT Value 0:00 to" = Table.ReplaceValue(#"Replaced WD Value 0:00 to","0:00:00","",Replacer.ReplaceText,{"RT/UT Date"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced RT Value 0:00 to",{{"Del Flag", type text}, {"Original Joint", type text}, {"Sub-Con Code", type text}, {"Welder No.", type text}, {"Welder Name", type text}, {"Serial No.", Int64.Type}, {"Weld Date", type date},{"Weld Week", type text}, {"Weld Month", type text}, {"Area Code", type text}, {"Area Group-1", type text}, {"Area Group-2", type text}, {"Area Group-3", type text}, {"Area Group-4", type text}, {"Area Group-5", type text}, {"QC ISO DWG. No.", type text}, {"Sheet No.", Int64.Type}, {"Joint No.", type text}, {"Repair Suffix", type text}, {"Spool No.", type text}, {"Service Class", type text}, {"Pressure Level", type text}, {"Pipe Size", type number}, {"Wall Thickness", type number}, {"Dia Inch", type number}, {"Material Category", type text}, {"P No.", Int64.Type}, {"Work Category", type text}, {"Original Work Category", type text}, {"Weld Type", type text}, {"NDT Remarks", type text}, {"Weld Point Code", type text}, {"Welded(Weld Point)", Int64.Type}, {"Weld Remark", type text}, {"Joint Percent", Int64.Type}, {"Welding Process", type text}, {"Welding Position", type text}, {"Welding Rod Type", type text}, {"Tracer Shot", type text}, {"RT/UT", type text}, {"RT/UT Report No.", type text}, {"RT/UT Date", type date}, {"RT Film Total", type number}, {"RT Film Reject", type number}, {"RT/UT Result", type text}, {"RT/UT(%)", Int64.Type}, {"RT/UT Request Date", type text}, {"RT/UT Defect Code", type text}, {"RT/UT Defect Code Class", type text}, {"Reshoot-1 RT/UT Report No.", type text}, {"Reshoot-1 RT/UT Date", type text}, {"Reshoot-1 RT Film Total", type text}, {"Reshoot-1 RT Film Reject", type text}, {"Reshoot-1 RT/UT Result", type text}, {"Reshoot-1 RT/UT Defect Code", type text}, {"Reshoot-1 RT/UT Defect Code Class", type text}, {"Reshoot-2 RT/UT Report No.", type text}, {"Reshoot-2 RT/UT Date", type text}, {"Reshoot-2 RT Film Total", type text}, {"Reshoot-2 RT Film Reject", type text}, {"Reshoot-2 RT/UT Result", type text}, {"Reshoot-2 RT/UT Defect Code", type text}, {"Reshoot-2 RT/UT Defect Code Class", type text}, {"Reshoot-3 RT/UT Report No.", type text}, {"Reshoot-3 RT/UT Date", type text}, {"Reshoot-3 RT Film Total", type text}, {"Reshoot-3 RT Film Reject", type text}, {"Reshoot-3 RT/UT Result", type text}, {"Reshoot-3 RT/UT Defect Code", type text}, {"Reshoot-3 RT/UT Defect Code Class", type text}, {"Reshoot RT/UT Total", type text}, {"Reshoot RT/UT Film Total", type text}, {"Last Reshoot Date", type text}, {"Last Reshoot Report No", type text}, {"Last Reshoot Result", type text}, {"Last Reshoot RT/UT Defect Code", type text}, {"Last Reshoot RT/UT Defect Code Class", type text}, {"RT2/UT2", type text}, {"RT2/UT2 Report No.", type text}, {"RT2/UT2 Date", type text}, {"RT2 Film Total", type text}, {"RT2 Film Reject", type text}, {"RT2/UT2 Result", type text}, {"RT2/UT2(%)", type text}, {"RT2/UT2 Request Date", type text}, {"RT2/UT2 Defect Code", type text}, {"RT2/UT2 Defect Code Class", type text}, {"Reshoot-1 RT2/UT2 Report No.", type text}, {"Reshoot-1 RT2/UT2 Date", type text}, {"Reshoot-1 RT2 Film Total", type text}, {"Reshoot-1 RT2 Film Reject", type text}, {"Reshoot-1 RT2/UT2 Result", type text}, {"Reshoot-1 RT2/UT2 Defect Code", type text}, {"Reshoot-2 RT2/UT2 Report No.", type text}, {"Reshoot-2 RT2/UT2 Date", type text}, {"Reshoot-2 RT2 Film Total", type text}, {"Reshoot-2 RT2 Film Reject", type text}, {"Reshoot-1 RT2/UT2 Defect Code Class", type text}, {"Reshoot-2 RT2/UT2 Result", type text}, {"Reshoot-2 RT2/UT2 Defect Code", type text}, {"Reshoot-2 RT2/UT2 Defect Code Class", type text}, {"Reshoot-3 RT2/UT2 Report No.", type text}, {"Reshoot-3 RT2/UT2 Date", type text}, {"Reshoot-3 RT2 Film Total", type text}, {"Reshoot-3 RT2 Film Reject", type text}, {"Reshoot-3 RT2/UT2 Result", type text}, {"Reshoot-3 RT2/UT2 Defect Code", type text}, {"Reshoot-3 RT2/UT2 Defect Code Class", type text}, {"Reshoot RT2/UT2 Total", type text}, {"Reshoot RT2/UT2 Film Total", type text}, {"Last Reshoot Date.1", type text}, {"Last Reshoot RT2/UT2 Defect Code", type text}, {"Last Reshoot RT2/UT2 Defect Code Class", type text}, {"VT Judge", type text}, {"Welding Inspection Identifier Date", type text}, {"Welding Inspection Identifier Client", type text}, {"Welding Inspection Identifier Chiyoda", type text}}),
    #"RT Report (BLANK)" = Table.SelectRows(#"Changed Type", each ([#"RT/UT Report No."] = "")),
    #"Appended Query+Welder Rec Acc/ Rej" = Table.Combine({#"RT Report (BLANK)", #"CSVExport_Welder Record - (ACC  REJ )"}),
    #"Removed Columns" = Table.RemoveColumns(#"Appended Query+Welder Rec Acc/ Rej",{"Welder Name", "Serial No.", "Weld Week", "Weld Month", "Area Group-1", "Area Group-4", "Area Group-5", "Sheet No.", "Pressure Level", "Pipe Size", "P No.", "Original Work Category", "Weld Remark", "Joint Percent", "Welding Position", "Welding Rod Type", "Reshoot-1 RT/UT Defect Code Class", "Reshoot-2 RT/UT Report No.", "Reshoot-2 RT/UT Date", "Reshoot-2 RT Film Total", "Reshoot-2 RT Film Reject", "Reshoot-2 RT/UT Result", "Reshoot-2 RT/UT Defect Code", "Reshoot-2 RT/UT Defect Code Class", "Reshoot-3 RT/UT Report No.", "Reshoot-3 RT/UT Date", "Reshoot-3 RT Film Total", "Reshoot-3 RT Film Reject", "Reshoot-3 RT/UT Result", "Reshoot-3 RT/UT Defect Code", "Reshoot-3 RT/UT Defect Code Class", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date", "Last Reshoot Report No", "Last Reshoot Result", "Last Reshoot RT/UT Defect Code", "Last Reshoot RT/UT Defect Code Class", "RT2/UT2", "RT2/UT2 Report No.", "RT2/UT2 Date", "RT2 Film Total", "RT2 Film Reject", "RT2/UT2 Result", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Defect Code", "RT2/UT2 Defect Code Class", "Reshoot-1 RT2/UT2 Report No.", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2 Film Reject", "Reshoot-1 RT2/UT2 Result", "Reshoot-1 RT2/UT2 Defect Code", "Reshoot-2 RT2/UT2 Report No.", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2 Film Reject", "Reshoot-1 RT2/UT2 Defect Code Class", "Reshoot-2 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Defect Code", "Reshoot-2 RT2/UT2 Defect Code Class", "Reshoot-3 RT2/UT2 Report No.", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2 Film Reject", "Reshoot-3 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Defect Code", "Reshoot-3 RT2/UT2 Defect Code Class", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date_1", "Last Reshoot Report No_2", "Last Reshoot Result_3", "Last Reshoot RT2/UT2 Defect Code", "Last Reshoot RT2/UT2 Defect Code Class", "VT Judge", "Welding Inspection Identifier Date", "Welding Inspection Identifier Client", "Welding Inspection Identifier Chiyoda", "Del Flag"}),
    #"Reordered Columns" = Table.ReorderColumns(#"Removed Columns",{"QC ISO DWG. No.", "Spool No.", "Joint No.", "Work Category", "Weld Type", "Dia Inch", "Wall Thickness", "Area Code", "Area Group-3", "Area Group-2", "Original Joint", "Welder No.", "Weld Date", "Repair Suffix", "Service Class", "Material Category", "Sub-Con Code", "NDT Remarks", "Weld Point Code", "Welded(Weld Point)", "Welding Process", "Tracer Shot", "RT/UT", "RT/UT Report No.", "RT/UT Date", "RT Film Total", "RT Film Reject", "RT/UT Result", "RT/UT(%)", "RT/UT Request Date", "RT/UT Defect Code", "RT/UT Defect Code Class", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Renamed Columns" = Table.RenameColumns(#"Reordered Columns",{{"QC ISO DWG. No.", "ISO Number"}, {"Joint No.", "Weld No."}, {"Work Category", "Weld Cat"}, {"Dia Inch", "Dia inch"}, {"Wall Thickness", "Thickness"}, {"Area Code", "PDS Area"}, {"Area Group-2", "Area Classification"}, {"Area Group-3", "AG/UG/PKG"}}),
    #"Reordered Columns1" = Table.ReorderColumns(#"Renamed Columns",{"ISO Number", "Spool No.", "Weld No.", "Weld Cat", "Weld Type", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Original Joint", "Repair Suffix", "Service Class", "Material Category", "Sub-Con Code", "Weld Date", "Welder No.", "NDT Remarks", "Weld Point Code", "Welded(Weld Point)", "Welding Process", "Tracer Shot", "RT/UT", "RT/UT Report No.", "RT/UT Date", "RT Film Total", "RT Film Reject", "RT/UT Result", "RT/UT(%)", "RT/UT Request Date", "RT/UT Defect Code", "RT/UT Defect Code Class", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Reordered Columns1",{{"Welder No.", "Welder"}, {"Welding Process", "WPS No."}}),
    #"Reordered Columns2" = Table.ReorderColumns(#"Renamed Columns1",{"ISO Number", "Spool No.", "Weld No.", "Weld Cat", "Weld Type", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Original Joint", "Repair Suffix", "Service Class", "Material Category", "Sub-Con Code", "Weld Date", "WPS No.", "Welder", "NDT Remarks", "Weld Point Code", "Welded(Weld Point)", "Tracer Shot", "RT/UT", "RT/UT Report No.", "RT/UT Date", "RT Film Total", "RT Film Reject", "RT/UT Result", "RT/UT(%)", "RT/UT Request Date", "RT/UT Defect Code", "RT/UT Defect Code Class", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Renamed Columns2" = Table.RenameColumns(#"Reordered Columns2",{{"Welded(Weld Point)", "WeldPoint No."}}),
    #"Reordered Columns3" = Table.ReorderColumns(#"Renamed Columns2",{"ISO Number", "Spool No.", "Weld No.", "Weld Cat", "Weld Type", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Original Joint", "Repair Suffix", "NDT Remarks", "Service Class", "Material Category", "Sub-Con Code", "Weld Date", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT/UT Report No.", "RT/UT Date", "RT Film Total", "RT Film Reject", "RT/UT Result", "RT/UT(%)", "RT/UT Request Date", "RT/UT Defect Code", "RT/UT Defect Code Class", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Renamed Columns3" = Table.RenameColumns(#"Reordered Columns3",{{"Sub-Con Code", "Sub-Contractor"}}),
    #"Reordered Columns4" = Table.ReorderColumns(#"Renamed Columns3",{"ISO Number", "Spool No.", "Weld No.", "Weld Cat", "Weld Type", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Original Joint", "Repair Suffix", "NDT Remarks", "Service Class", "Material Category", "Weld Date", "Sub-Contractor", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT/UT Report No.", "RT/UT Date", "RT Film Total", "RT Film Reject", "RT/UT Result", "RT/UT(%)", "RT/UT Request Date", "RT/UT Defect Code", "RT/UT Defect Code Class", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Renamed Columns4" = Table.RenameColumns(#"Reordered Columns4",{{"Material Category", "Material Type"}, {"Service Class", "Service class"}, {"RT/UT(%)", "RT%"}}),
    #"Reordered Columns5" = Table.ReorderColumns(#"Renamed Columns4",{"ISO Number", "Spool No.", "Weld No.", "Weld Cat", "Weld Type", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Original Joint", "Repair Suffix", "NDT Remarks", "Service class", "Material Type", "Weld Date", "Sub-Contractor", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT/UT Report No.", "RT/UT Date", "RT Film Total", "RT Film Reject", "RT/UT Result", "RT/UT Request Date", "RT/UT Defect Code", "RT/UT Defect Code Class", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Renamed Columns5" = Table.RenameColumns(#"Reordered Columns5",{{"RT/UT Report No.", "RT Report"}, {"RT/UT Result", "RT Acc/Rej"}}),
    #"Reordered Columns6" = Table.ReorderColumns(#"Renamed Columns5",{"ISO Number", "Spool No.", "Weld No.", "Weld Cat", "Weld Type", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Original Joint", "Repair Suffix", "NDT Remarks", "Service class", "Material Type", "Weld Date", "Sub-Contractor", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT Report", "RT Acc/Rej", "RT/UT Date", "RT Film Total", "RT Film Reject", "RT/UT Request Date", "RT/UT Defect Code", "RT/UT Defect Code Class", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Renamed Columns6" = Table.RenameColumns(#"Reordered Columns6",{{"RT/UT Request Date", "RT Selected Date"}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Renamed Columns6",{{"RT Selected Date", type date}, {"RT/UT Date", type date}}),
    #"Reordered Columns7" = Table.ReorderColumns(#"Changed Type1",{"ISO Number", "Spool No.", "Weld No.", "Weld Cat", "Weld Type", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Original Joint", "Repair Suffix", "NDT Remarks", "Service class", "Material Type", "Weld Date", "Sub-Contractor", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT Selected Date", "RT/UT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "RT Film Reject", "RT/UT Defect Code", "RT/UT Defect Code Class", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Renamed Columns7" = Table.RenameColumns(#"Reordered Columns7",{{"RT Film Reject", "Total No of films Rej"}, {"RT/UT Defect Code", "Defect Code"}, {"RT/UT Defect Code Class", "Location of Defect"}, {"RT/UT Date", "RT Date"}}),
    #"Added Custom" = Table.AddColumn(#"Renamed Columns7", "Iso Rev No.", each ""),
    #"Dia Inch Factor" = Table.AddColumn(#"Added Custom", "Dia Inch Factor", each if [Weld Type] = "BW" or [Weld Type] = "CLET" then "Y" else "N"),
    #"Reordered Columns8" = Table.ReorderColumns(#"Dia Inch Factor",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Original Joint", "Repair Suffix", "NDT Remarks", "Service class", "Material Type", "Weld Date", "Sub-Contractor", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT Selected Date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Rej", "Defect Code", "Location of Defect", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Added Custom2" = Table.AddColumn(#"Reordered Columns8", "Spool Rev No.", each ""),
    #"Reordered Columns9" = Table.ReorderColumns(#"Added Custom2",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "NDT Remarks", "Service class", "Material Type", "Weld Date", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT Selected Date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Rej", "Defect Code", "Location of Defect", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Changed Type16" = Table.TransformColumnTypes(#"Reordered Columns9",{{"Spool Rev No.", type text}, {"Iso Rev No.", type text}}),
    #"Added Custom3" = Table.AddColumn(#"Changed Type16", "wbu", each ""),
    #"Added Custom4" = Table.AddColumn(#"Added Custom3", "System no", each ""),
    #"Testpack No" = Table.AddColumn(#"Added Custom4", "Testpack No", each ""),
    #"Reordered Columns10" = Table.ReorderColumns(#"Testpack No",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Material Type", "Weld Date", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT Selected Date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Rej", "Defect Code", "Location of Defect", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Added Custom6" = Table.AddColumn(#"Reordered Columns10", "Service Cat", each ""),
    #"Reordered Columns11" = Table.ReorderColumns(#"Added Custom6",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "Weld Date", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT Selected Date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Rej", "Defect Code", "Location of Defect", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"MIR No" = Table.AddColumn(#"Reordered Columns11", "MIR No", each ""),
    #"MIR Date" = Table.AddColumn(#"MIR No", "MIR Date", each ""),
    #"Changed Type2" = Table.TransformColumnTypes(#"MIR Date",{{"MIR Date", type date}}),
    #"2011 to 2023" = Table.ReplaceValue(#"Changed Type2",#date(2011, 12, 23),#date(2023, 12, 11),Replacer.ReplaceValue,{"Weld Date"}),
    #"2008 to 2024" = Table.ReplaceValue(#"2011 to 2023",#date(2008, 6, 24),#date(2024, 6, 24),Replacer.ReplaceValue,{"Weld Date"}),
    #"2006 to 2024" = Table.ReplaceValue(#"2008 to 2024",#date(2006, 6, 24),#date(2024, 6, 24),Replacer.ReplaceValue,{"Weld Date"}),
    #"2015 to 2024" = Table.ReplaceValue(#"2006 to 2024",#date(2015, 2, 24),#date(2024, 2, 15),Replacer.ReplaceValue,{"Weld Date"}),
    #"2020 to 2024 rt" = Table.ReplaceValue(#"2015 to 2024",#date(2020, 4, 24),#date(2024, 4, 20),Replacer.ReplaceValue,{"RT Date"}),
    #"2008 to 2024 rt" = Table.ReplaceValue(#"2020 to 2024 rt",#date(2008, 6, 24),#date(2024, 6, 24),Replacer.ReplaceValue,{"RT Date"}),
    #"2009 to 2024 rt" = Table.ReplaceValue(#"2008 to 2024 rt",#date(2009, 6, 24),#date(2024, 6, 9),Replacer.ReplaceValue,{"RT Date"}),
    #"2010 to 2024 rt" = Table.ReplaceValue(#"2009 to 2024 rt",#date(2010, 6, 24),#date(2024, 6, 10),Replacer.ReplaceValue,{"RT Date"}),
    #"Cutting Date" = Table.AddColumn(#"2010 to 2024 rt", "Cutting Date", each [Weld Date]),
    #"Changed Type3" = Table.TransformColumnTypes(#"Cutting Date",{{"Cutting Date", type date}}),
    #"Beveling Date" = Table.AddColumn(#"Changed Type3", "Beveling Date", each [Weld Date]),
    #"Changed Type4" = Table.TransformColumnTypes(#"Beveling Date",{{"Beveling Date", type date}}),
    #"Fitup Date" = Table.AddColumn(#"Changed Type4", "Fitup Date", each [Weld Date]),
    #"Preheat Date" = Table.AddColumn(#"Fitup Date", "Preheat Date", each ""),
    #"Changed Type5" = Table.TransformColumnTypes(#"Preheat Date",{{"Fitup Date", type date}, {"Preheat Date", type date}}),
    #"Reordered Columns12" = Table.ReorderColumns(#"Changed Type5",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT Selected Date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Rej", "Defect Code", "Location of Defect", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Added Custom13" = Table.AddColumn(#"Reordered Columns12", "DWIR No.", each ""),
    #"Reordered Columns13" = Table.ReorderColumns(#"Added Custom13",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "Tracer Shot", "RT/UT", "RT%", "RT Selected Date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Rej", "Defect Code", "Location of Defect", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Changed Type6" = Table.TransformColumnTypes(#"Reordered Columns13",{{"RT Film Total", type number}, {"Total No of films Rej", type number}}),
    #"Total No of films Acc" = Table.AddColumn(#"Changed Type6", "Total No of films Acc", each [RT Film Total]-[Total No of films Rej]),
    #"Reordered Columns14" = Table.ReorderColumns(#"Total No of films Acc",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Selected Date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "Tracer Shot", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Added Custom15" = Table.AddColumn(#"Reordered Columns14", "RT Batch No", each ""),
    #"Added Custom16" = Table.AddColumn(#"Added Custom15", "RT Batch Status", each ""),
    #"WELD Status" = Table.AddColumn(#"Added Custom16", "RT Weld Status", each if [RT Report] = "blank" then "HS" else if [#"RT%"] = 100 then "HS CCC" else if [Tracer Shot] = "T" then "T" else ""),
    #"Reordered Columns15" = Table.ReorderColumns(#"WELD Status",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "Tracer Shot", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Added Custom18" = Table.AddColumn(#"Reordered Columns15", "RT Exam Req date", each ""),
    #"Changed Type7" = Table.TransformColumnTypes(#"Added Custom18",{{"RT Exam Req date", type date}}),
    #"Reordered Columns16" = Table.ReorderColumns(#"Changed Type7",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "Tracer Shot", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Added Custom19" = Table.AddColumn(#"Reordered Columns16", "RT Xray No", each ""),
    #"Reordered Columns17" = Table.ReorderColumns(#"Added Custom19",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "Reshoot-1 RT/UT Report No.", "Reshoot-1 RT/UT Date", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code", "Tracer Shot"}),
    #"Renamed Columns8" = Table.RenameColumns(#"Reordered Columns17",{{"Reshoot-1 RT/UT Report No.", "RT Re-Shoot Rep"}, {"Reshoot-1 RT/UT Date", "RT Re-Shoot Data"}}),
    #"Added Custom20" = Table.AddColumn(#"Renamed Columns8", "RT Re-Shoot Status", each ""),
    #"Reordered Columns18" = Table.ReorderColumns(#"Added Custom20",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code", "Tracer Shot"}),
    #"Added Custom21" = Table.AddColumn(#"Reordered Columns18", "RT Re-Shoot Reason", each ""),
    #"Reordered Columns19" = Table.ReorderColumns(#"Added Custom21",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "Reshoot-1 RT Film Total", "Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code", "Tracer Shot"}),
    #"Renamed Columns9" = Table.RenameColumns(#"Reordered Columns19",{{"Reshoot-1 RT Film Total", "RT Re-Shoot Films"}}),
    #"Removed Columns1" = Table.RemoveColumns(#"Renamed Columns9",{"Reshoot-1 RT Film Reject", "Reshoot-1 RT/UT Result", "Reshoot-1 RT/UT Defect Code"}),
    #"Changed Type8" = Table.TransformColumnTypes(#"Removed Columns1",{{"RT Re-Shoot Films", Int64.Type}}),
    #"WELD Length" = Table.AddColumn(#"Changed Type8", "Weld Length", each ""),
    #"Reordered Columns20" = Table.ReorderColumns(#"WELD Length",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Tracer Shot"}),
    #"Changed Type9" = Table.TransformColumnTypes(#"Reordered Columns20",{{"Weld Length", type number}}),
    #"Rej Length" = Table.AddColumn(#"Changed Type9", "Rej Length", each ""),
    #"Changed Type10" = Table.TransformColumnTypes(#"Rej Length",{{"Rej Length", Int64.Type}}),
    #"Reordered Columns21" = Table.ReorderColumns(#"Changed Type10",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "Tracer Shot"}),
    #"Added Custom24" = Table.AddColumn(#"Reordered Columns21", "RT Client Exam Req Y/N", each ""),
    #"Reordered Columns22" = Table.ReorderColumns(#"Added Custom24",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "Tracer Shot"}),
    #"By UT" = Table.AddColumn(#"Reordered Columns22", "By UT", each ""),
    #"Added Custom26" = Table.AddColumn(#"By UT", "RT Remarks", each ""),
    #"Reordered Columns23" = Table.ReorderColumns(#"Added Custom26",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot"}),
    #"UT %" = Table.AddColumn(#"Reordered Columns23", "UT%", each ""),
    #"Changed Type11" = Table.TransformColumnTypes(#"UT %",{{"UT%", Int64.Type}}),
    #"PWHT Y/N" = Table.AddColumn(#"Changed Type11", "PWHT Y/N", each ""),
    #"PWHT Weld Status" = Table.AddColumn(#"PWHT Y/N", "PWHT Weld Status", each ""),
    #"PWHT Selected Date" = Table.AddColumn(#"PWHT Weld Status", "PWHT Selected Date", each ""),
    #"PWHT Exam Req Date" = Table.AddColumn(#"PWHT Selected Date", "PWHT Exam Req date", each ""),
    #"PWHT Date" = Table.AddColumn(#"PWHT Exam Req Date", "PWHT Date", each ""),
    #"Changed Type12" = Table.TransformColumnTypes(#"PWHT Date",{{"PWHT Selected Date", type date}, {"PWHT Exam Req date", type date}, {"PWHT Date", type date}}),
    #"PWHT Report" = Table.AddColumn(#"Changed Type12", "PWHT Report", each ""),
    #"Added Custom34" = Table.AddColumn(#"PWHT Report", "PWHT Acc/Rej", each ""),
    #"Added Custom35" = Table.AddColumn(#"Added Custom34", "PWHT Client Exam Req Y/N", each ""),
    #"Added Custom36" = Table.AddColumn(#"Added Custom35", "PWHT Remarks", each ""),
    #"Added Custom37" = Table.AddColumn(#"Added Custom36", "HT%", each ""),
    #"Changed Type13" = Table.TransformColumnTypes(#"Added Custom37",{{"HT%", Int64.Type}}),
    #"Added Custom38" = Table.AddColumn(#"Changed Type13", "HT Batch No", each ""),
    #"Added Custom39" = Table.AddColumn(#"Added Custom38", "HT Batch Status", each ""),
    #"Added Custom40" = Table.AddColumn(#"Added Custom39", "HT Weld Status", each ""),
    #"Added Custom41" = Table.AddColumn(#"Added Custom40", "HT Selected Date", each ""),
    #"Added Custom42" = Table.AddColumn(#"Added Custom41", "HT Exam Req date", each ""),
    #"Added Custom43" = Table.AddColumn(#"Added Custom42", "HT Date", each ""),
    #"Added Custom44" = Table.AddColumn(#"Added Custom43", "HT Report", each ""),
    #"Added Custom45" = Table.AddColumn(#"Added Custom44", "HT Acc/Rej", each ""),
    #"Added Custom46" = Table.AddColumn(#"Added Custom45", "HT Client Exam Req Y/N", each ""),
    #"Changed Type14" = Table.TransformColumnTypes(#"Added Custom46",{{"HT Date", type date}, {"HT Exam Req date", type date}, {"HT Selected Date", type date}}),
    #"Added Custom47" = Table.AddColumn(#"Changed Type14", "HT Remarks", each ""),
    #"Reordered Columns24" = Table.ReorderColumns(#"Added Custom47",{"ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%"}),
    #"Replaced Value Repair Suffix R01 -R1" = Table.ReplaceValue(#"Reordered Columns24","R01","R1",Replacer.ReplaceText,{"Repair Suffix"}),
    #"Repair Suffix R02 - R2" = Table.ReplaceValue(#"Replaced Value Repair Suffix R01 -R1","R02","R2",Replacer.ReplaceText,{"Repair Suffix"}),
    #"Joint ID" = Table.AddColumn(#"Repair Suffix R02 - R2", "Joint ID", each [ISO Number]&"-"&[#"Spool No."]&"-"&[#"Weld No."]&""&[Repair Suffix]),
    #"Reordered Columns25" = Table.ReorderColumns(#"Joint ID",{"Joint ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%"}),
    #"Spool ID" = Table.AddColumn(#"Reordered Columns25", "Spool ID", each [ISO Number]&"-"&[#"Spool No."]),
    #"Reordered Columns26" = Table.ReorderColumns(#"Spool ID",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia inch", "Dia Inch Factor", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%"}),
    #"Changed Type15" = Table.TransformColumnTypes(#"Reordered Columns26",{{"Total No of films Acc", type number}}),
    #"Changed Type17" = Table.TransformColumnTypes(#"Changed Type15",{{"RT Re-Shoot Data", type date}, {"RT%", Int64.Type}}),
    Custom1 = #"Changed Type17",
    #"Replaced Value # to CCC" = Table.ReplaceValue(Custom1,"#","CCC",Replacer.ReplaceText,{"Sub-Contractor"}),
    #"Exlude after 28 Aug" = Table.SelectRows(#"Replaced Value # to CCC", each [Weld Date] <> #date(2026, 8, 29) and [Weld Date] <> #date(2026, 8, 30))
in
    #"Exlude after 28 Aug"
```

### `Project WD+WR`

```m
let
    Source = Table.Combine({#"Weld Dump", #"CSVExport_Welder Record"}),
    #"Changed Type" = Table.TransformColumnTypes(Source,{{"RT%", Int64.Type}}),
    #"Filtered Rows Subcon" = Table.SelectRows(#"Changed Type", each ([#"Sub-Contractor"] <> "")),
    #"Changed Type1" = Table.TransformColumnTypes(#"Filtered Rows Subcon",{{"Iso Rev No.", type text}, {"Spool Rev No.", type text}, {"RT Re-Shoot Data", type date}, {"UT Selected Date", type date}, {"UT Exam Req date", type date}, {"UT Date", type date}, {"PMI Selected Date", type date}, {"PMI Exam Req date", type date}, {"PMI Date", type date}, {"PT Selected Date", type date}, {"PT Exam Req date", type date}, {"PT Date", type date}, {"FN Selected Date", type date}, {"FN Exam Req date", type date}, {"FN Date", type date}, {"PADLT Selected Date", type date}, {"PADLT Exam Req date", type date}, {"PADLT Date", type date}, {"ORIF Selected Date", type date}, {"ORIF Exam Req date", type date}, {"ORIF Date", type date}, {"Manual UT Date", type date}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type1", each ([Joint ID] = "21010AA-BD6132009A01-SP1-001"))
in
    #"Filtered Rows"
```

### `Inco Weld Log`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Inco\Master Weld_Latest.xlsx"), null, true),
    #"Overall Weld Log_Sheet" = Source{[Item="Overall Weld Log Query",Kind="Sheet"]}[Data],
    #"Promoted Headers1" = Table.PromoteHeaders(#"Overall Weld Log_Sheet", [PromoteAllScalars=true]),
    #"Changed Type18" = Table.TransformColumnTypes(#"Promoted Headers1",{{"Sl No", Int64.Type}, {"Tank No", type text}, {"Category 1", type text}, {"Category 2", type text}, {"Drg No", type text}, {"Material", type text}, {"joint with tank", type text}, {"Joint No", type text}, {"Thick", type number}, {"Length (MM)", Int64.Type}, {"Type of Weld", type text}, {"process", type text}, {"WPS", type text}, {"Welder ID.", type text}, {"Fitup Report No.", type text}, {"Date", type date}, {"Welding Report No.", type text}, {"First Prod. Joint", type text}, {"RT/UT Report", type text}, {"RT/UT Date", type date}, {"RT STATUC", type text}, {"RT LENGTH (MM)", Int64.Type}, {"No. of RT Films shoot", type number}, {"Aditional #(lf)Joint No.#(lf)RT", type text}, {"Type of Repair", type any}, {"Repair Length (mm)", type any}, {"RT P1 Rep.", type any}, {"P1 Date", type any}, {"RT P2 Rep.", type any}, {"P2 Date", type any}, {"PT/MT Report", type any}, {"PT/MT Date", type any}, {"VBT Report", type text}, {"VBT Date", type date}, {"OPT Report", type any}, {"OPT Date", type any}, {"PWHT Report", type any}, {"PWHT Date", type any}, {"HT Report", type any}, {"HT Date", type any}, {"Remarks", type any}}),
    #"Changed Type17" = Table.TransformColumnTypes(#"Changed Type18",{{"Sl No", Int64.Type}, {"Tank No", type text}, {"Category 1", type text}, {"Category 2", type text}, {"Drg No", type text}, {"Material", type text}, {"Joint No", type text}, {"Thick", type number}, {"Length (MM)", Int64.Type}, {"Type of Weld", type text}, {"process", type text}, {"WPS", type text}, {"Welder ID.", type text}, {"Fitup Report No.", type text}, {"Date", type date}, {"Welding Report No.", type text}, {"First Prod. Joint", type text}, {"RT/UT Report", type text}, {"RT/UT Date", type date}, {"RT STATUC", type text}, {"RT LENGTH (MM)", Int64.Type}, {"No. of RT Films shoot", type number}, {"Aditional #(lf)Joint No.#(lf)RT", type text}, {"Type of Repair", type any}, {"Repair Length (mm)", type any}, {"RT P1 Rep.", type any}, {"P1 Date", type any}, {"RT P2 Rep.", type any}, {"P2 Date", type any}, {"PT/MT Report", type any}, {"PT/MT Date", type any}, {"VBT Report", type text}, {"VBT Date", type date}, {"OPT Report", type any}, {"OPT Date", type any}, {"PWHT Report", type any}, {"PWHT Date", type any}, {"HT Report", type any}, {"HT Date", type any}, {"Remarks", type any}}),
    #"Changed Type16" = Table.TransformColumnTypes(#"Changed Type17",{{"Sl No", Int64.Type}, {"Tank No", type text}, {"Category 1", type text}, {"Category 2", type text}, {"Drg No", type text}, {"Material", type text}, {"Joint No", type text}, {"Thick", type number}, {"Length (MM)", Int64.Type}, {"Type of Weld", type text}, {"process", type text}, {"WPS", type text}, {"Welder ID.", type text}, {"Fitup Report No.", type text}, {"Date", type date}, {"Welding Report No.", type text}, {"First Prod. Joint", type text}, {"RT/UT Report", type text}, {"RT/UT Date", type date}, {"RT STATUC", type text}, {"RT LENGTH (MM)", Int64.Type}, {"No. of RT Films shoot", type number}, {"Aditional #(lf)Joint No.#(lf)RT", type text}, {"Type of Repair", type any}, {"Repair Length (mm)", type any}, {"RT P1 Rep.", type any}, {"P1 Date", type any}, {"RT P2 Rep.", type any}, {"P2 Date", type any}, {"PT/MT Report", type any}, {"PT/MT Date", type any}, {"VBT Report", type text}, {"VBT Date", type date}, {"OPT Report", type any}, {"OPT Date", type any}, {"PWHT Report", type any}, {"PWHT Date", type any}, {"HT Report", type any}, {"HT Date", type any}, {"Remarks", type any}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Changed Type16",{{"Sl No", Int64.Type}, {"Tank No", type text}, {"Category 1", type text}, {"Category 2", type text}, {"Drg No", type text}, {"Material", type text}, {"joint with tank", type text}, {"Joint No", type text}, {"Thick", type number}, {"Type of Weld", type text}, {"process", type text}, {"WPS", type text}, {"Welder ID.", type text}, {"Fitup Report No.", type text}, {"Date", type date}, {"Welding Report No.", type text}, {"First Prod. Joint", type text}, {"RT/UT Report", type text}, {"RT/UT Date", type date}, {"RT STATUC", type text}, {"RT LENGTH (MM)", Int64.Type}, {"No. of RT Films shoot", type number}, {"Aditional #(lf)Joint No.#(lf)RT", type any}, {"Type of Repair", type any}, {"Repair Length (mm)", type any}, {"RT P1 Rep.", type any}, {"P1 Date", type date}, {"RT P2 Rep.", type any}, {"P2 Date", type date}, {"PT/MT Report", type any}, {"PT/MT Date", type date}, {"VBT Report", type text}, {"VBT Date", type date}, {"OPT Report", type any}, {"OPT Date", type date}, {"PWHT Report", type any}, {"PWHT Date", type date}, {"HT Report", type any}, {"HT Date", type date}, {"Remarks", type any}, {"Date2", type date}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"Date2", "Weld Date"}}),
    #"Changed Type20" = Table.TransformColumnTypes(#"Renamed Columns",{{"CountDelimiter", Int64.Type}, {"Count Rows.Count", Int64.Type}}),
    INCO = Table.AddColumn(#"Changed Type20", "Sub-Contractor", each "Inco"),
    #"Reordered Columns" = Table.ReorderColumns(INCO,{"joint with tank", "Sl No", "Tank No", "Category 1", "Category 2", "Drg No", "Material", "Joint No", "Thick", "Length (MM)", "Type of Weld", "process", "WPS", "Welder ID.", "Fitup Report No.", "Date", "Welding Report No.", "Weld Date", "First Prod. Joint", "RT/UT Report", "RT/UT Date", "RT STATUC", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks", "Sub-Contractor"}),
    #"Removed Columns" = Table.RemoveColumns(#"Reordered Columns",{"Sl No"}),
    #"Joint ID" = Table.RenameColumns(#"Removed Columns",{{"joint with tank", "Joint ID"}, {"Tank No", "ISO Number"}}),
    #"Spool ID" = Table.AddColumn(#"Joint ID", "Spool ID", each "-"),
    #"Reordered Columns1" = Table.ReorderColumns(#"Spool ID",{"Joint ID", "Spool ID", "ISO Number", "Category 1", "Category 2", "Drg No", "Material", "Joint No", "Thick", "Length (MM)", "Type of Weld", "process", "WPS", "Welder ID.", "Fitup Report No.", "Date", "Welding Report No.", "Weld Date", "First Prod. Joint", "RT/UT Report", "RT/UT Date", "RT STATUC", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks", "Sub-Contractor"}),
    #"Iso Rev No." = Table.AddColumn(#"Reordered Columns1", "Iso Rev No.", each ""),
    #"Spool No." = Table.AddColumn(#"Iso Rev No.", "Spool No.", each "-"),
    #"Reordered Columns2" = Table.ReorderColumns(#"Spool No.",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Joint No", "Category 1", "Category 2", "Drg No", "Material", "Thick", "Length (MM)", "Type of Weld", "process", "WPS", "Welder ID.", "Fitup Report No.", "Date", "Welding Report No.", "Weld Date", "First Prod. Joint", "RT/UT Report", "RT/UT Date", "RT STATUC", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks", "Sub-Contractor"}),
    #"Weld No." = Table.RenameColumns(#"Reordered Columns2",{{"Joint No", "Weld No."}}),
    #"Added Custom" = Table.AddColumn(#"Weld No.", "Spool Rev No.", each ""),
    #"Reordered Columns3" = Table.ReorderColumns(#"Added Custom",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Category 1", "Category 2", "Drg No", "Material", "Thick", "Length (MM)", "Type of Weld", "process", "WPS", "Welder ID.", "Fitup Report No.", "Date", "Welding Report No.", "Weld Date", "Sub-Contractor", "First Prod. Joint", "RT/UT Report", "RT/UT Date", "RT STATUC", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"Weld Cat" = Table.AddColumn(#"Reordered Columns3", "Weld Cat", each "F"),
    #"Reordered Columns4" = Table.ReorderColumns(#"Weld Cat",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Type of Weld", "Category 1", "Category 2", "Drg No", "Material", "Thick", "Length (MM)", "process", "WPS", "Welder ID.", "Fitup Report No.", "Date", "Welding Report No.", "Weld Date", "Sub-Contractor", "First Prod. Joint", "RT/UT Report", "RT/UT Date", "RT STATUC", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"Weld Type" = Table.RenameColumns(#"Reordered Columns4",{{"Type of Weld", "Weld Type"}}),
    #"Replaced Value" = Table.ReplaceValue(#"Weld Type","BUTT","BW",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value","FILLET","FW",Replacer.ReplaceText,{"Weld Type"}),
    #"Added Custom2" = Table.AddColumn(#"Replaced Value1", "Dia Inch Factor", each if[Weld Type]="BW" then "Y" else "N"),
    #"Reordered Columns5" = Table.ReorderColumns(#"Added Custom2",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Category 1", "Category 2", "Drg No", "Material", "Thick", "Length (MM)", "process", "WPS", "Welder ID.", "Fitup Report No.", "Date", "Welding Report No.", "Weld Date", "Sub-Contractor", "First Prod. Joint", "RT/UT Report", "RT/UT Date", "RT STATUC", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"RT Report" = Table.RenameColumns(#"Reordered Columns5",{{"Thick", "Thickness"}, {"Material", "Material Type"}, {"WPS", "WPS No."}, {"Welder ID.", "Welder"}, {"Date", "Fitup Date"}, {"RT/UT Report", "RT Report"}, {"RT/UT Date", "RT Date"}, {"RT STATUC", "RT Acc/Rej"}}),
    #"Added Custom3" = Table.AddColumn(#"RT Report", "Dia inch", each ""),
    #"Reordered Columns6" = Table.ReorderColumns(#"Added Custom3",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Category 1", "Category 2", "Drg No", "Material Type", "Length (MM)", "process", "WPS No.", "Welder", "Fitup Report No.", "Fitup Date", "Welding Report No.", "Weld Date", "Sub-Contractor", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"PDS Area" = Table.AddColumn(#"Reordered Columns6", "PDS Area", each ""),
    #"Reordered Columns7" = Table.ReorderColumns(#"PDS Area",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "Category 1", "Category 2", "Drg No", "Material Type", "Length (MM)", "process", "WPS No.", "Welder", "Fitup Report No.", "Fitup Date", "Welding Report No.", "Weld Date", "Sub-Contractor", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"AG/UG/PKG""" = Table.AddColumn(#"Reordered Columns7", "AG/UG/PKG", each ""),
    #"Reordered Columns8" = Table.ReorderColumns(#"AG/UG/PKG""",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Category 1", "Category 2", "Drg No", "Material Type", "Length (MM)", "process", "WPS No.", "Welder", "Fitup Report No.", "Fitup Date", "Welding Report No.", "Weld Date", "Sub-Contractor", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"Area Classification" = Table.AddColumn(#"Reordered Columns8", "Area Classification", each ""),
    #"Reordered Columns9" = Table.ReorderColumns(#"Area Classification",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "Category 1", "Category 2", "Drg No", "Material Type", "Length (MM)", "process", "WPS No.", "Welder", "Fitup Report No.", "Fitup Date", "Welding Report No.", "Weld Date", "Sub-Contractor", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    wbu = Table.AddColumn(#"Reordered Columns9", "wbu", each ""),
    #"System no" = Table.AddColumn(wbu, "System no", each ""),
    #"Testpack No" = Table.AddColumn(#"System no", "Testpack No", each ""),
    #"Service class" = Table.AddColumn(#"Testpack No", "Service class", each ""),
    #"Service Cat" = Table.AddColumn(#"Service class", "Service Cat", each ""),
    #"Reordered Columns10" = Table.ReorderColumns(#"Service Cat",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "WPS No.", "Welder", "Fitup Report No.", "Fitup Date", "Welding Report No.", "Weld Date", "Sub-Contractor", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"MIR No" = Table.AddColumn(#"Reordered Columns10", "MIR No", each ""),
    #"MIR Date" = Table.AddColumn(#"MIR No", "MIR Date", each ""),
    #"Cutting Date" = Table.AddColumn(#"MIR Date", "Cutting Date", each ""),
    #"Beveling Date" = Table.AddColumn(#"Cutting Date", "Beveling Date", each ""),
    #"Changed Type1" = Table.TransformColumnTypes(#"Beveling Date",{{"Cutting Date", type date}, {"Beveling Date", type date}, {"MIR Date", type date}}),
    #"Reordered Columns11" = Table.ReorderColumns(#"Changed Type1",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Weld Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "WPS No.", "Welder", "Fitup Report No.", "Welding Report No.", "Sub-Contractor", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Reordered Columns11",{{"Fitup Date", type date}}),
    #"Added Custom16" = Table.AddColumn(#"Changed Type2", "Preheat Date", each ""),
    #"Reordered Columns12" = Table.ReorderColumns(#"Added Custom16",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "WPS No.", "Welder", "Fitup Report No.", "Welding Report No.", "Sub-Contractor", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Reordered Columns12",{{"Preheat Date", type date}}),
    #"Added Custom17" = Table.AddColumn(#"Changed Type3", "DWIR No.", each ""),
    #"Reordered Columns13" = Table.ReorderColumns(#"Added Custom17",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "WPS No.", "Welder", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "PWHT Report", "PWHT Date", "HT Report", "HT Date", "Remarks"}),
    #"Rework Code" = Table.AddColumn(#"Reordered Columns13", "Rework Code", each ""),
    #"WeldPoint No." = Table.AddColumn(#"Rework Code", "WeldPoint No.", each "1"),
    #"Reordered Columns14" = Table.ReorderColumns(#"WeldPoint No.",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Report", "PWHT Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "HT Report", "HT Date", "Remarks"}),
    #"Filtered Rows" = Table.SelectRows(#"Reordered Columns14", each true),
    #"Added Custom20" = Table.AddColumn(#"Filtered Rows", "PWHT Y/N", each ""),
    #"Added Custom21" = Table.AddColumn(#"Added Custom20", "PWHT Weld Status", each ""),
    #"Added Custom22" = Table.AddColumn(#"Added Custom21", "PWHT Selected Date", each ""),
    #"Added Custom23" = Table.AddColumn(#"Added Custom22", "PWHT Exam Req date", each ""),
    #"Added Custom24" = Table.AddColumn(#"Added Custom23", "PWHT Acc/Rej", each ""),
    #"Added Custom25" = Table.AddColumn(#"Added Custom24", "PWHT Client Exam Req Y/N", each ""),
    #"Added Custom26" = Table.AddColumn(#"Added Custom25", "PWHT Remarks", each ""),
    #"Reordered Columns15" = Table.ReorderColumns(#"Added Custom26",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "HT Report", "HT Date", "Remarks"}),
    #"Filtered Rows1" = Table.SelectRows(#"Reordered Columns15", each true),
    #"Reordered Columns16" = Table.ReorderColumns(#"Filtered Rows1",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT Report", "HT Date", "Remarks", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Added Custom27" = Table.AddColumn(#"Reordered Columns16", "HT%", each ""),
    #"Added Custom28" = Table.AddColumn(#"Added Custom27", "HT Batch No", each ""),
    #"Added Custom29" = Table.AddColumn(#"Added Custom28", "HT Batch Status", each ""),
    #"Added Custom30" = Table.AddColumn(#"Added Custom29", "HT Weld Status", each ""),
    #"Added Custom31" = Table.AddColumn(#"Added Custom30", "HT Selected Date", each ""),
    #"Added Custom32" = Table.AddColumn(#"Added Custom31", "HT Exam Req date", each ""),
    #"Reordered Columns17" = Table.ReorderColumns(#"Added Custom32",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "Remarks", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Reordered Columns17",{{"Remarks", "HT Remarks"}}),
    #"Added Custom33" = Table.AddColumn(#"Renamed Columns1", "HT Acc/Rej", each ""),
    #"Added Custom34" = Table.AddColumn(#"Added Custom33", "HT Client Exam Req Y/N", each ""),
    #"Reordered Columns18" = Table.ReorderColumns(#"Added Custom34",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Changed Type4" = Table.TransformColumnTypes(#"Reordered Columns18",{{"PWHT Exam Req date", type date}, {"PWHT Selected Date", type date}, {"HT Date", type date}}),
    #"Reordered Columns19" = Table.ReorderColumns(#"Changed Type4",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT Report", "RT Date", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Changed Type5" = Table.TransformColumnTypes(#"Reordered Columns19",{{"HT Remarks", type text}}),
    #"Added Custom35" = Table.AddColumn(#"Changed Type5", "RT%", each ""),
    #"Added Custom36" = Table.AddColumn(#"Added Custom35", "RT Batch No", each ""),
    #"Added Custom37" = Table.AddColumn(#"Added Custom36", "RT Batch Status", each ""),
    #"Added Custom38" = Table.AddColumn(#"Added Custom37", "RT Weld Status", each ""),
    #"Added Custom39" = Table.AddColumn(#"Added Custom38", "RT Selected Date", each ""),
    #"Changed Type6" = Table.TransformColumnTypes(#"Added Custom39",{{"RT Selected Date", type date}}),
    #"Added Custom40" = Table.AddColumn(#"Changed Type6", "RT Exam Req date", each ""),
    #"Changed Type7" = Table.TransformColumnTypes(#"Added Custom40",{{"RT Exam Req date", type date}}),
    #"Reordered Columns20" = Table.ReorderColumns(#"Changed Type7",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Report", "RT Acc/Rej", "RT LENGTH (MM)", "No. of RT Films shoot", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Added Custom41" = Table.AddColumn(#"Reordered Columns20", "RT Xray No", each ""),
    #"Reordered Columns21" = Table.ReorderColumns(#"Added Custom41",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "No. of RT Films shoot", "RT LENGTH (MM)", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Renamed Columns2" = Table.RenameColumns(#"Reordered Columns21",{{"No. of RT Films shoot", "RT Film Total"}}),
    #"Replaced Value5" = Table.ReplaceValue(#"Renamed Columns2","ACC ","ACC",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Replace A to A" = Table.ReplaceValue(#"Replaced Value5","A ","A",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Total No of films Rej" = Table.AddColumn(#"Replace A to A", "Total No of films Rej", each if [#"RT Acc/Rej"] = "R" then [RT Film Total] else 0),
    #"Changed Type13" = Table.TransformColumnTypes(#"Total No of films Rej",{{"Total No of films Rej", type number}}),
    #"Total No of films Acc" = Table.AddColumn(#"Changed Type13", "Total No of films Acc", each if [#"RT Acc/Rej"] = "A" then [RT Film Total] else "0"),
    #"Changed Type14" = Table.TransformColumnTypes(#"Total No of films Acc",{{"Total No of films Acc", type number}}),
    #"Reordered Columns22" = Table.ReorderColumns(#"Changed Type14",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "RT LENGTH (MM)", "Aditional #(lf)Joint No.#(lf)RT", "Type of Repair", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Renamed Columns3" = Table.RenameColumns(#"Reordered Columns22",{{"Type of Repair", "Defect Code"}}),
    #"Reordered Columns23" = Table.ReorderColumns(#"Renamed Columns3",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "RT LENGTH (MM)", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Added Custom44" = Table.AddColumn(#"Reordered Columns23", "Location of Defect", each ""),
    #"Reordered Columns24" = Table.ReorderColumns(#"Added Custom44",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT LENGTH (MM)", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "Length (MM)", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Renamed Columns4" = Table.RenameColumns(#"Reordered Columns24",{{"Length (MM)", "Weld Length"}}),
    #"Reordered Columns25" = Table.ReorderColumns(#"Renamed Columns4",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "Weld Length", "RT LENGTH (MM)", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Renamed Columns5" = Table.RenameColumns(#"Reordered Columns25",{{"RT LENGTH (MM)", "Rej Length"}}),
    #"Added Custom45" = Table.AddColumn(#"Renamed Columns5", "RT Re-Shoot Rep", each ""),
    #"Added Custom46" = Table.AddColumn(#"Added Custom45", "RT Re-Shoot Data", each ""),
    #"Added Custom47" = Table.AddColumn(#"Added Custom46", "RT Re-Shoot Status", each ""),
    #"Added Custom48" = Table.AddColumn(#"Added Custom47", "RT Re-Shoot Reason", each ""),
    #"Added Custom49" = Table.AddColumn(#"Added Custom48", "RT Re-Shoot Films", each ""),
    #"Reordered Columns26" = Table.ReorderColumns(#"Added Custom49",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Reason", "RT Re-Shoot Status", "Weld Length", "Rej Length", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "RT Re-Shoot Films"}),
    #"Changed Type8" = Table.TransformColumnTypes(#"Reordered Columns26",{{"RT Re-Shoot Data", type date}}),
    #"Reordered Columns27" = Table.ReorderColumns(#"Changed Type8",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Added Custom50" = Table.AddColumn(#"Reordered Columns27", "RT Client Exam Req Y/N", each ""),
    #"By UT" = Table.AddColumn(#"Added Custom50", "By UT", each if [HT Remarks] = "PAUT" then "Y" else ""),
    #"Added Custom52" = Table.AddColumn(#"By UT", "RT Remarks", each ""),
    #"Reordered Columns28" = Table.ReorderColumns(#"Added Custom52",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"UT%" = Table.AddColumn(#"Reordered Columns28", "UT%", each ""),
    #"Added Custom54" = Table.AddColumn(#"UT%", "UT Batch No", each ""),
    #"Added Custom55" = Table.AddColumn(#"Added Custom54", "UT Batch Status", each ""),
    #"Added UT Weld Status" = Table.AddColumn(#"Added Custom55", "UT Weld Status", each ""),
    #"Added UT Selected Date" = Table.AddColumn(#"Added UT Weld Status", "UT Selected Date", each null),
    #"Added UT Exam Req date" = Table.AddColumn(#"Added UT Selected Date", "UT Exam Req date", each null),
    #"Added UT Remarks" = Table.AddColumn(#"Added UT Exam Req date", "UT Remarks", each if [HT Remarks] = "PAUT" then "PAUT" else ""),
    #"Added UT Date" = Table.AddColumn(#"Added UT Remarks", "UT Date", each if [UT Remarks] = "PAUT" then [RT Date] else ""),
    #"Added UT Report" = Table.AddColumn(#"Added UT Date", "UT Report", each if [UT Remarks] = "PAUT" then [RT Report] else ""),
    #"Added UT Acc/Rej" = Table.AddColumn(#"Added UT Report", "UT Acc/Rej", each if [UT Remarks] = "PAUT" then [#"RT Acc/Rej"] else ""),
    #"Added UT Client Exam Req Y/N" = Table.AddColumn(#"Added UT Acc/Rej", "UT Client Exam Req Y/N", each ""),
    #"Changed Type9" = Table.TransformColumnTypes(#"Added UT Client Exam Req Y/N",{{"UT Selected Date", type date}, {"UT Exam Req date", type date}, {"UT Date", type date}}),
    #"Added Custom56" = Table.AddColumn(#"Changed Type9", "MT%", each ""),
    #"Added MT Batch No" = Table.AddColumn(#"Added Custom56", "MT Batch No", each ""),
    #"Added MT Batch Status" = Table.AddColumn(#"Added MT Batch No", "MT Batch Status", each ""),
    #"Added MT Weld Status" = Table.AddColumn(#"Added MT Batch Status", "MT Weld Status", each ""),
    #"Added MT Selected Date" = Table.AddColumn(#"Added MT Weld Status", "MT Selected Date", each null),
    #"Added MT Exam Req date" = Table.AddColumn(#"Added MT Selected Date", "MT Exam Req date", each null),
    #"Added MT Date" = Table.AddColumn(#"Added MT Exam Req date", "MT Date", each null),
    #"Added MT Report" = Table.AddColumn(#"Added MT Date", "MT Report", each ""),
    #"Added MT Acc/Rej" = Table.AddColumn(#"Added MT Report", "MT Acc/Rej", each ""),
    #"Added MT Client Exam Req Y/N" = Table.AddColumn(#"Added MT Acc/Rej", "MT Client Exam Req Y/N", each ""),
    #"Added MT Remarks" = Table.AddColumn(#"Added MT Client Exam Req Y/N", "MT Remarks", each ""),
    #"Added PMI%" = Table.AddColumn(#"Added MT Remarks", "PMI%", each ""),
    #"Added PMI Batch No" = Table.AddColumn(#"Added PMI%", "PMI Batch No", each ""),
#"Added PMI Batch Status" = Table.AddColumn(#"Added PMI Batch No", "PMI Batch Status", each ""),
#"Added PMI Weld Status" = Table.AddColumn(#"Added PMI Batch Status", "PMI Weld Status", each ""),
#"Added PMI Selected Date" = Table.AddColumn(#"Added PMI Weld Status", "PMI Selected Date", each ""),
#"Added PMI Exam Req date" = Table.AddColumn(#"Added PMI Selected Date", "PMI Exam Req date", each ""),
#"Added PMI Date" = Table.AddColumn(#"Added PMI Exam Req date", "PMI Date", each ""),
#"Added PMI Report" = Table.AddColumn(#"Added PMI Date", "PMI Report", each ""),
#"Added PMI Acc/Rej" = Table.AddColumn(#"Added PMI Report", "PMI Acc/Rej", each ""),
#"Added PMI Client Exam Req Y/N" = Table.AddColumn(#"Added PMI Acc/Rej", "PMI Client Exam Req Y/N", each ""),
    #"PMI Remarks" = Table.AddColumn(#"Added PMI Client Exam Req Y/N", "PMI Remarks", each ""),
    #"Added PT%" = Table.AddColumn(#"PMI Remarks", "PT%", each ""),
#"Added PT Batch No" = Table.AddColumn(#"Added PT%", "PT Batch No", each ""),
#"Added PT Batch Status" = Table.AddColumn(#"Added PT Batch No", "PT Batch Status", each ""),
#"Added PT Weld Status" = Table.AddColumn(#"Added PT Batch Status", "PT Weld Status", each ""),
#"Added PT Selected Date" = Table.AddColumn(#"Added PT Weld Status", "PT Selected Date", each ""),
#"Added PT Exam Req date" = Table.AddColumn(#"Added PT Selected Date", "PT Exam Req date", each ""),
#"Added PT Date" = Table.AddColumn(#"Added PT Exam Req date", "PT Date", each ""),
#"Added PT Report" = Table.AddColumn(#"Added PT Date", "PT Report", each ""),
#"Added PT Acc/Rej" = Table.AddColumn(#"Added PT Report", "PT Acc/Rej", each ""),
#"Added PT Client Exam Req Y/N" = Table.AddColumn(#"Added PT Acc/Rej", "PT Client Exam Req Y/N", each ""),
#"Added PT Remarks" = Table.AddColumn(#"Added PT Client Exam Req Y/N", "PT Remarks", each ""),
#"Added FN%" = Table.AddColumn(#"Added PT Remarks", "FN%", each ""),
#"Added FN Batch No" = Table.AddColumn(#"Added FN%", "FN Batch No", each ""),
#"Added FN Batch Status" = Table.AddColumn(#"Added FN Batch No", "FN Batch Status", each ""),
#"Added FN Weld Status" = Table.AddColumn(#"Added FN Batch Status", "FN Weld Status", each ""),
#"Added FN Selected Date" = Table.AddColumn(#"Added FN Weld Status", "FN Selected Date", each ""),
#"Added FN Exam Req date" = Table.AddColumn(#"Added FN Selected Date", "FN Exam Req date", each ""),
#"Added FN Date" = Table.AddColumn(#"Added FN Exam Req date", "FN Date", each ""),
#"Added FN Report" = Table.AddColumn(#"Added FN Date", "FN Report", each ""),
#"Added FN Acc/Rej" = Table.AddColumn(#"Added FN Report", "FN Acc/Rej", each ""),
#"Added FN Client Exam Req Y/N" = Table.AddColumn(#"Added FN Acc/Rej", "FN Client Exam Req Y/N", each ""),
#"Added FN Remarks" = Table.AddColumn(#"Added FN Client Exam Req Y/N", "FN Remarks", each ""),
#"Added PADLT Y/N" = Table.AddColumn(#"Added FN Remarks", "PADLT Y/N", each ""),
#"Added PADLT Weld Status" = Table.AddColumn(#"Added PADLT Y/N", "PADLT Weld Status", each ""),
#"Added PADLT Selected Date" = Table.AddColumn(#"Added PADLT Weld Status", "PADLT Selected Date", each ""),
#"Added PADLT Exam Req date" = Table.AddColumn(#"Added PADLT Selected Date", "PADLT Exam Req date", each ""),
#"Added PADLT Date" = Table.AddColumn(#"Added PADLT Exam Req date", "PADLT Date", each ""),
#"Added PADLT Report" = Table.AddColumn(#"Added PADLT Date", "PADLT Report", each ""),
#"Added PADLT Acc/Rej" = Table.AddColumn(#"Added PADLT Report", "PADLT Acc/Rej", each ""),
#"Added PADLT Client Exam Req Y/N" = Table.AddColumn(#"Added PADLT Acc/Rej", "PADLT Client Exam Req Y/N", each ""),
#"Added PADLT Remarks" = Table.AddColumn(#"Added PADLT Client Exam Req Y/N", "PADLT Remarks", each ""),
#"Added ORIF Y/N" = Table.AddColumn(#"Added PADLT Remarks", "ORIF Y/N", each ""),
#"Added ORIF Weld Status" = Table.AddColumn(#"Added ORIF Y/N", "ORIF Weld Status", each ""),
#"Added ORIF Selected Date" = Table.AddColumn(#"Added ORIF Weld Status", "ORIF Selected Date", each ""),
#"Added ORIF Exam Req date" = Table.AddColumn(#"Added ORIF Selected Date", "ORIF Exam Req date", each ""),
#"Added ORIF Date" = Table.AddColumn(#"Added ORIF Exam Req date", "ORIF Date", each ""),
#"Added ORIF Report" = Table.AddColumn(#"Added ORIF Date", "ORIF Report", each ""),
#"Added ORIF Acc/Rej" = Table.AddColumn(#"Added ORIF Report", "ORIF Acc/Rej", each ""),
#"Added ORIF Client Exam Req Y/N" = Table.AddColumn(#"Added ORIF Acc/Rej", "ORIF Client Exam Req Y/N", each ""),
#"Added Matrl Traceability Y/N" = Table.AddColumn(#"Added ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", each ""),
#"Added GROUP-1" = Table.AddColumn(#"Added Matrl Traceability Y/N", "GROUP-1", each ""),
#"Added IDENT CODE-1" = Table.AddColumn(#"Added GROUP-1", "IDENT CODE-1", each ""),
#"Added TRAC NO-1" = Table.AddColumn(#"Added IDENT CODE-1", "TRAC NO-1", each ""),
#"Added Part 1" = Table.AddColumn(#"Added TRAC NO-1", "Part 1", each ""),
#"Added GROUP-2" = Table.AddColumn(#"Added Part 1", "GROUP-2", each ""),
#"Added IDENT CODE-2" = Table.AddColumn(#"Added GROUP-2", "IDENT CODE-2", each ""),
#"Added TRAC NO-2" = Table.AddColumn(#"Added IDENT CODE-2", "TRAC NO-2", each ""),
#"Added Part 2" = Table.AddColumn(#"Added TRAC NO-2", "Part 2", each ""),
#"Added Revision Status" = Table.AddColumn(#"Added Part 2", "Revision Status", each ""),
#"Added Revision Comments" = Table.AddColumn(#"Added Revision Status", "Revision Comments", each ""),
#"Added Hold Status" = Table.AddColumn(#"Added Revision Comments", "Hold Status", each ""),
#"Added Hold Comments" = Table.AddColumn(#"Added Hold Status", "Hold Comments", each ""),
#"Added Piping Group" = Table.AddColumn(#"Added Hold Comments", "Piping Group", each ""),
#"Added Golden Weld Report Date" = Table.AddColumn(#"Added Piping Group", "Golden Weld Report Date", each ""),
#"Added Golden Weld Report No" = Table.AddColumn(#"Added Golden Weld Report Date", "Golden Weld Report No", each ""),
    #"Reordered Columns29" = Table.ReorderColumns(#"Added Golden Weld Report No",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint"}),
    #"Changed Type10" = Table.TransformColumnTypes(#"Reordered Columns29",{{"PMI Selected Date", type date}, {"PMI Exam Req date", type date}, {"PMI Date", type date}, {"PT Selected Date", type date}, {"PT Exam Req date", type date}, {"PT Date", type date}, {"FN Selected Date", type date}, {"FN Exam Req date", type date}, {"FN Date", type date}, {"PADLT Selected Date", type date}, {"PADLT Exam Req date", type date}, {"PADLT Date", type date}, {"ORIF Selected Date", type date}, {"ORIF Exam Req date", type date}, {"ORIF Date", type date}, {"Golden Weld Report Date", type date}}),
    Custom3 = Table.AddColumn(#"Changed Type10", "Custom3", each ""),
    Custom4 = Table.AddColumn(Custom3, "Custom4", each ""),
    Custom5 = Table.AddColumn(Custom4, "Custom5", each ""),
    Custom6 = Table.AddColumn(Custom5, "Custom6", each ""),
    Custom7 = Table.AddColumn(Custom6, "Custom7", each ""),
    Custom8 = Table.AddColumn(Custom7, "Custom8", each ""),
    Custom9 = Table.AddColumn(Custom8, "Custom9", each ""),
    Custom10 = Table.AddColumn(Custom9, "Custom10", each ""),
    Custom11 = Table.AddColumn(Custom10, "Custom11", each ""),
    Custom12 = Table.AddColumn(Custom11, "Custom12", each ""),
    Custom13 = Table.AddColumn(Custom12, "Custom13", each ""),
    Custom14 = Table.AddColumn(Custom13, "Custom14", each ""),
    PED = Table.AddColumn(Custom14, "PED", each ""),
    #"Reordered Columns30" = Table.ReorderColumns(PED,{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint"}),
    #"Added Custom4" = Table.AddColumn(#"Reordered Columns30", "RT/UT", each ""),
    #"Reordered Columns31" = Table.ReorderColumns(#"Added Custom4",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint"}),
    #"Tracer Shot" = Table.AddColumn(#"Reordered Columns31", "Tracer Shot", each ""),
    #"Reordered Columns32" = Table.ReorderColumns(#"Tracer Shot",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "PT/MT Report", "PT/MT Date", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint"}),
    #"Original Joint" = Table.AddColumn(#"Reordered Columns32", "Original Joint", each "Inco"),
    #"Reordered Columns33" = Table.ReorderColumns(#"Original Joint",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "PT/MT Date", "PT/MT Report", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "Original Joint"}),
    #"Duplicated Column" = Table.DuplicateColumn(#"Reordered Columns33", "PT/MT Date", "PT/MT Date - Copy"),
    #"Duplicated Column1" = Table.DuplicateColumn(#"Duplicated Column", "PT/MT Report", "PT/MT Report - Copy"),
    #"Removed Columns1" = Table.RemoveColumns(#"Duplicated Column1",{"MT Date"}),
    #"Renamed Columns6" = Table.RenameColumns(#"Removed Columns1",{{"PT/MT Date", "MT Date"}}),
    #"Removed Columns2" = Table.RemoveColumns(#"Renamed Columns6",{"MT Report"}),
    #"Renamed Columns7" = Table.RenameColumns(#"Removed Columns2",{{"PT/MT Report", "MT Report"}}),
    #"Reordered Columns34" = Table.ReorderColumns(#"Renamed Columns7",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT/MT Date - Copy", "PT/MT Report - Copy", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "Original Joint"}),
    #"Removed Columns3" = Table.RemoveColumns(#"Reordered Columns34",{"PT Date", "PT Report"}),
    #"Renamed Columns8" = Table.RenameColumns(#"Removed Columns3",{{"PT/MT Date - Copy", "PT Date"}, {"PT/MT Report - Copy", "PT Report"}}),
    #"Reordered Columns35" = Table.ReorderColumns(#"Renamed Columns8",{"Original Joint", "Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Repair Suffix" = Table.AddColumn(#"Reordered Columns35", "Repair Suffix", each ""),
    #"Reordered Columns36" = Table.ReorderColumns(#"Repair Suffix",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Added Custom5" = Table.AddColumn(#"Reordered Columns36", "NDT Remarks", each ""),
    #"Reordered Columns37" = Table.ReorderColumns(#"Added Custom5",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Weld Point Code" = Table.AddColumn(#"Reordered Columns37", "Weld Point Code", each ""),
    #"Reordered Columns38" = Table.ReorderColumns(#"Weld Point Code",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Subsystem Code" = Table.AddColumn(#"Reordered Columns38", "Subsystem Code", each ""),
    #"Reordered Columns39" = Table.ReorderColumns(#"Subsystem Code",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Subsystem Code", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Replaced Value2" = Table.ReplaceValue(#"Reordered Columns39","Fillet","FW",Replacer.ReplaceText,{"Weld Type"}),
    #"Filtered Rows3" = Table.SelectRows(#"Replaced Value2", each true),
    #"Added Custom6" = Table.AddColumn(#"Filtered Rows3", "Custom", each [ISO Number]&"-"&[#"Spool No."]&"-"&[#"Weld No."]),
    #"Reordered Columns40" = Table.ReorderColumns(#"Added Custom6",{"Custom", "Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Subsystem Code", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Removed Columns4" = Table.RemoveColumns(#"Reordered Columns40",{"Joint ID"}),
    #"Renamed Columns9" = Table.RenameColumns(#"Removed Columns4",{{"Custom", "Joint ID"}}),
    #"Filtered Rows4" = Table.SelectRows(#"Renamed Columns9", each ([Joint ID] <> "blank")),
    #"Changed Type11" = Table.TransformColumnTypes(#"Filtered Rows4",{{"Repair Length (mm)", Int64.Type}}),
    #"ACC to A" = Table.ReplaceValue(#"Changed Type11","ACC","A",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"REJ to R" = Table.ReplaceValue(#"ACC to A","REJ","R",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Changed Type12" = Table.TransformColumnTypes(#"REJ to R",{{"Iso Rev No.", type text}, {"Spool Rev No.", type text}}),
    #"Replaced Value3" = Table.ReplaceValue(#"Changed Type12","GRS-A","A",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Replaced Value4" = Table.ReplaceValue(#"Replaced Value3","RS-A","RS",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Filtered Rows2" = Table.SelectRows(#"Replaced Value4", each true),
    #"MT Weld Status (2)" = Table.AddColumn(#"Filtered Rows2", "MT Weld Status.1", each if [MT Report] <> null then "NR" else null),
    #"Reordered Columns41" = Table.ReorderColumns(#"MT Weld Status (2)",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Weld Status.1", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Subsystem Code", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "Welding Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Removed Columns5" = Table.RemoveColumns(#"Reordered Columns41",{"MT Weld Status"}),
    #"Renamed Columns10" = Table.RenameColumns(#"Removed Columns5",{{"MT Weld Status.1", "MT Weld Status"}}),
    #"Changed Type15" = Table.TransformColumnTypes(#"Renamed Columns10",{{"PT Report", type text}, {"RT Film Total", type number}, {"Total No of films Acc", type number}, {"Total No of films Rej", type number}}),
    #"Filtered Rows5" = Table.SelectRows(#"Changed Type15", each ([Weld Type] <> null)),
    #"Replaced Value6" = Table.ReplaceValue(#"Filtered Rows5","RESHOOT","RS",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Changed Type16 Weld Length" = Table.TransformColumnTypes(#"Replaced Value6",{{"Weld Length", type number}, {"WeldPoint No.", Int64.Type}, {"PWHT Date", type date}, {"HT Selected Date", type date}, {"HT Exam Req date", type date}, {"PT Date", type date}, {"OPT Date", type date}, {"P2 Date", type date}, {"P1 Date", type date}}),
    #"#N/A replace" = Table.ReplaceValue(#"Changed Type16 Weld Length","#N/A","",Replacer.ReplaceText,{"RT Report"}),
    #"Changed Type19" = Table.TransformColumnTypes(#"#N/A replace",{{"MT Selected Date", type date}, {"MT Exam Req date", type date}, {"MT Date", type date}}),
    #"R/S to RS" = Table.ReplaceValue(#"Changed Type19","R/S","RS",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Replaced ACC to A" = Table.ReplaceValue(#"R/S to RS","ACC","A",Replacer.ReplaceText,{"UT Acc/Rej"}),
    #"Replaced REJ to R" = Table.ReplaceValue(#"Replaced ACC to A","REJ","R",Replacer.ReplaceText,{"UT Acc/Rej"}),
    #"Reordered Columns42" = Table.ReorderColumns(#"Replaced REJ to R",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "Welding Report No.", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Subsystem Code", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date"}),
    #"Removed Columns7" = Table.RemoveColumns(#"Reordered Columns42",{"DWIR No."}),
    #"Renamed Columns11" = Table.RenameColumns(#"Removed Columns7",{{"Welding Report No.", "DWIR No."}}),
    #"Reordered Columns43" = Table.ReorderColumns(#"Renamed Columns11",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Subsystem Code", "PED", "Aditional #(lf)Joint No.#(lf)RT", "Repair Length (mm)", "RT P1 Rep.", "P1 Date", "RT P2 Rep.", "P2 Date", "Category 1", "Category 2", "Drg No", "process", "Fitup Report No.", "First Prod. Joint", "VBT Report", "VBT Date", "OPT Report", "OPT Date", "CountDelimiter", "Count Rows.Count"}),
    #"RECT to R" = Table.ReplaceValue(#"Reordered Columns43","RECT","R",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"RECT to R UT" = Table.ReplaceValue(#"RECT to R","RECT","R",Replacer.ReplaceText,{"UT Acc/Rej"})
in
    #"RECT to R UT"
```

### `Acciona_Query`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Acciona\Acciona_Latest Add to Query.xlsx"), null, true),
    Acciona_Query_Table = Source{[Item="Acciona_Query",Kind="Table"]}[Data],
    #"Replaced Null to 0 Acc Films" = Table.ReplaceValue(Acciona_Query_Table,null,0,Replacer.ReplaceValue,{"Accepted Films"}),
    #"Replaced Null to 0 Rej Films" = Table.ReplaceValue(#"Replaced Null to 0 Acc Films",null,0,Replacer.ReplaceValue,{"Rejected Films"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced Null to 0 Rej Films",{{"Sl No", Int64.Type}, {"ISO Number", type text}, {"Line No.", type text}, {"Iso Rev No.", type text}, {"Spool No.", type text}, {"Weld No.", type text}, {"Dia          (Ø)", type number}, {"Thickness", type number}, {"Material Type", type text}, {"Part 1", type text}, {"Heat No. 1", type any}, {"Part 2", type text}, {"Heat No. 2", type any}, {"WPS No.", type text}, {"Weld Type", type text}, {"Welder", type text}, {"DWR", type text}, {"Weld Cat", type text}, {"Ferrite  Report No: & Date", type text}, {"Ferrite Acc/Rej", type text}, {"PMI Report No. & Date", type text}, {"PMI Acc/Rej", type text}, {"PT Report No. & Date", type text}, {"PT Acc/Rej", type text}, {"RT Report No. & Date", type text}, {"RT Acc/Rej", type text}, {"Total Films", Int64.Type}, {"Accepted Films", type number}, {"Rejected Films", type number}, {"RT Status %", type number}, {"Remark", type text}, {"INTERNAL CLEANING RFI", type text}, {"INTERNAL CLEANING DATE", type any}, {"FITUP RFI", type text}, {"FITUP DATE", type datetime}, {"WELDING DATE", type datetime}, {"WELD VISUAL RFI", type text}, {"WELD VISUAL DATE", type datetime}, {"Iso Penalty", type text}, {"Sht", type date}, {"Tracer 1", type text}, {"RT Report No:", type text}, {"Tracer 1 RT Acc/Rej", type text}, {"Iso Penalty7", type text}, {"Sht8", type date}, {"Tracer 2", type text}, {"RT Report No:10", type text}, {"Tracer 2 RT Acc/Rej", type text}, {"Column12", type any}, {"PR", type text}, {"FABRICATION", type any}, {"Paint Release", Int64.Type}, {"Test Pack No: ", type text}}),
    #"Reordered Columns" = Table.ReorderColumns(#"Changed Type",{"Sl No", "ISO Number", "Spool No.", "Iso Rev No.", "Line No.", "Weld No.", "Dia          (Ø)", "Thickness", "Material Type", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "WPS No.", "Weld Type", "Welder", "DWR", "Weld Cat", "Ferrite  Report No: & Date", "Ferrite Acc/Rej", "PMI Report No. & Date", "PMI Acc/Rej", "PT Report No. & Date", "PT Acc/Rej", "RT Report No. & Date", "RT Acc/Rej", "Total Films", "Accepted Films", "Rejected Films", "RT Status %", "Remark", "INTERNAL CLEANING RFI", "INTERNAL CLEANING DATE", "FITUP RFI", "FITUP DATE", "WELDING DATE", "WELD VISUAL RFI", "WELD VISUAL DATE", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release", "Test Pack No: "}),
    #"Removed Columns" = Table.RemoveColumns(#"Reordered Columns",{"Sl No"}),
    #"Replaced Value" = Table.ReplaceValue(#"Removed Columns","Field","F",Replacer.ReplaceText,{"Weld Cat"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value","Shop","S",Replacer.ReplaceText,{"Weld Cat"}),
    #"Removed Columns1" = Table.RemoveColumns(#"Replaced Value1",{"Ferrite  Report No: & Date", "Ferrite Acc/Rej"}),
    #"Split Column by Delimiter" = Table.SplitColumn(#"Removed Columns1", "PMI Report No. & Date", Splitter.SplitTextByDelimiter("&", QuoteStyle.Csv), {"PMI Report No. & Date.1", "PMI Report No. & Date.2"}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Split Column by Delimiter",{{"PMI Report No. & Date.1", type text}, {"PMI Report No. & Date.2", type text}}),
    #"Replaced Value41" = Table.ReplaceValue(#"Changed Type1","-01-","-Jan-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value42" = Table.ReplaceValue(#"Replaced Value41","-02-","-Feb-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value43" = Table.ReplaceValue(#"Replaced Value42","-03-","-Mar-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value44" = Table.ReplaceValue(#"Replaced Value43","-04-","-Apr-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value45" = Table.ReplaceValue(#"Replaced Value44","-05-","-May-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value46" = Table.ReplaceValue(#"Replaced Value45","-06-","-Jun-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value47" = Table.ReplaceValue(#"Replaced Value46","-07-","-Jul-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value48" = Table.ReplaceValue(#"Replaced Value47","-08-","-Aug-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value49" = Table.ReplaceValue(#"Replaced Value48","-09-","-Sep-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value50" = Table.ReplaceValue(#"Replaced Value49","-10-","-Oct-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value51" = Table.ReplaceValue(#"Replaced Value50","-11-","-Nov-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Replaced Value52" = Table.ReplaceValue(#"Replaced Value51","-12-","-Dec-",Replacer.ReplaceText,{"PMI Report No. & Date.2"}),
    #"Renamed Columns" = Table.RenameColumns(#"Replaced Value52",{{"PMI Report No. & Date.1", "PMI Report"}, {"PMI Report No. & Date.2", "PMI Date"}}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Renamed Columns",{{"PMI Date", type date}}),
    #"Split Column by Delimiter1" = Table.SplitColumn(#"Changed Type2", "PT Report No. & Date", Splitter.SplitTextByDelimiter("&", QuoteStyle.Csv), {"PT Report No. & Date.1", "PT Report No. & Date.2"}),
    #"/  to -" = Table.ReplaceValue(#"Split Column by Delimiter1","/","-",Replacer.ReplaceText,{"PT Report No. & Date.2"}),
    #"Changed Type3" = Table.TransformColumnTypes(#"/  to -",{{"PT Report No. & Date.1", type text}, {"PT Report No. & Date.2", type text}}),
    #"Renamed Columns1" = Table.RenameColumns(#"Changed Type3",{{"PT Report No. & Date.1", "PT Report"}, {"PT Report No. & Date.2", "PT Date"}}),
    #"Trimmed Text" = Table.TransformColumns(#"Renamed Columns1",{{"PT Date", Text.Trim, type text}}),
    #"Replaced Value29" = Table.ReplaceValue(#"Trimmed Text","-02-","-Feb-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value30" = Table.ReplaceValue(#"Replaced Value29","-01-","-Jan-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value31" = Table.ReplaceValue(#"Replaced Value30","-10-","-Oct-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value32" = Table.ReplaceValue(#"Replaced Value31","-12-","-Dec-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value33" = Table.ReplaceValue(#"Replaced Value32","-03-","-Mar-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value35" = Table.ReplaceValue(#"Replaced Value33","-05-","-May-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value36" = Table.ReplaceValue(#"Replaced Value35","-06-","-Jun-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value37" = Table.ReplaceValue(#"Replaced Value36","-07-","-Jul-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value38" = Table.ReplaceValue(#"Replaced Value37","-08-","-Aug-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value39" = Table.ReplaceValue(#"Replaced Value38","-09-","-Sep-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value40" = Table.ReplaceValue(#"Replaced Value39","-11-","-Nov-",Replacer.ReplaceText,{"PT Date"}),
    #"Replaced Value34" = Table.ReplaceValue(#"Replaced Value40","-04-","-Apr-",Replacer.ReplaceText,{"PT Date"}),
    #"Changed Type4" = Table.TransformColumnTypes(#"Replaced Value34",{{"PT Date", type date}}),
    #"Split Column by Delimiter2" = Table.SplitColumn(#"Changed Type4", "RT Report No. & Date", Splitter.SplitTextByDelimiter("&", QuoteStyle.Csv), {"RT Report No. & Date.1", "RT Report No. & Date.2", "RT Report No. & Date.3"}),
    #"Changed Type5" = Table.TransformColumnTypes(#"Split Column by Delimiter2",{{"RT Report No. & Date.1", type text}, {"RT Report No. & Date.2", type text}, {"RT Report No. & Date.3", type text}}),
    #"Renamed Columns2" = Table.RenameColumns(#"Changed Type5",{{"RT Report No. & Date.1", "RT Report"}, {"RT Report No. & Date.2", "RT Date"}}),
    #"Split Column by Delimiter3" = Table.SplitColumn(#"Renamed Columns2", "RT Report No. & Date.3", Splitter.SplitTextByDelimiter("&", QuoteStyle.Csv), {"RT Report No. & Date.3.1", "RT Report No. & Date.3.2"}),
    #"Changed Type6" = Table.TransformColumnTypes(#"Split Column by Delimiter3",{{"RT Report No. & Date.3.1", type text}, {"RT Report No. & Date.3.2", type text}}),
    #"Renamed Columns3" = Table.RenameColumns(#"Changed Type6",{{"RT Report No. & Date.3.2", "RT Re-Shoot Rep"}}),
    #"Reordered Columns1" = Table.ReorderColumns(#"Renamed Columns3",{"ISO Number", "Spool No.", "Iso Rev No.", "Line No.", "Weld No.", "Dia          (Ø)", "Thickness", "Material Type", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "WPS No.", "Weld Type", "Welder", "DWR", "Weld Cat", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Report No. & Date.3.1", "RT Acc/Rej", "Total Films", "Accepted Films", "Rejected Films", "RT Status %", "Remark", "INTERNAL CLEANING RFI", "INTERNAL CLEANING DATE", "FITUP RFI", "FITUP DATE", "WELDING DATE", "WELD VISUAL RFI", "WELD VISUAL DATE", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release", "Test Pack No: "}),
    #"Renamed Columns4" = Table.RenameColumns(#"Reordered Columns1",{{"RT Report No. & Date.3.1", "RT Re-Shoot Data"}}),
    #"Renamed Columns5" = Table.RenameColumns(#"Renamed Columns4",{{"Accepted Films", "Total No of films Acc"}, {"Rejected Films", "Total No of films Rej"}, {"RT Status %", "RT%"}}),
    #"Removed Columns2" = Table.RemoveColumns(#"Renamed Columns5",{"INTERNAL CLEANING RFI", "INTERNAL CLEANING DATE", "FITUP RFI", "WELD VISUAL RFI", "WELD VISUAL DATE"}),
    #"Changed Type8" = Table.TransformColumnTypes(#"Removed Columns2",{{"RT Re-Shoot Data", type text}}),
    #"Reordered Columns2" = Table.ReorderColumns(#"Changed Type8",{"ISO Number", "Spool No.", "Iso Rev No.", "Line No.", "Weld No.", "Dia          (Ø)", "Thickness", "Material Type", "WELDING DATE", "FITUP DATE", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "WPS No.", "Weld Type", "Welder", "DWR", "Weld Cat", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release", "Test Pack No: "}),
    #"Changed Type7" = Table.TransformColumnTypes(#"Reordered Columns2",{{"WELDING DATE", type date}, {"FITUP DATE", type date}}),
    #"Reordered Columns3" = Table.ReorderColumns(#"Changed Type7",{"ISO Number", "Spool No.", "Iso Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia          (Ø)", "Thickness", "Material Type", "WELDING DATE", "FITUP DATE", "WPS No.", "Welder", "DWR", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release", "Test Pack No: "}),
    #"Added Custom" = Table.AddColumn(#"Reordered Columns3", "Spool Rev No.", each ""),
    #"Reordered Columns4" = Table.ReorderColumns(#"Added Custom",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia          (Ø)", "Thickness", "Material Type", "WELDING DATE", "FITUP DATE", "WPS No.", "Welder", "DWR", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release", "Test Pack No: "}),
    #"Changed Type16" = Table.TransformColumnTypes(#"Reordered Columns4",{{"Spool Rev No.", type text}}),
    #"Renamed Columns6" = Table.RenameColumns(#"Changed Type16",{{"Dia          (Ø)", "Dia inch"}}),
    #"Dia Inch Factor" = Table.AddColumn(#"Renamed Columns6", "Dia Inch Factor", each if[Weld Type]="BW" then "Y" else "N"),
    #"Reordered Columns5" = Table.ReorderColumns(#"Dia Inch Factor",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "WELDING DATE", "FITUP DATE", "WPS No.", "Welder", "DWR", "Material Type", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release", "Test Pack No: "}),
    #"PDS Area" = Table.AddColumn(#"Reordered Columns5", "PDS Area", each Text.Start([ISO Number], 7)),
    #"AG/UG/PKG" = Table.AddColumn(#"PDS Area", "AG/UG/PKG", each ""),
    #"Added Area Classification" = Table.AddColumn(#"AG/UG/PKG", "Area Classification", each ""),
#"Added wbu" = Table.AddColumn(#"Added Area Classification", "wbu", each ""),
#"Added System no" = Table.AddColumn(#"Added wbu", "System no", each ""),
#"Added Service class" = Table.AddColumn(#"Added System no", "Service class", each Text.BetweenDelimiters([#"Line No."], "(", ")")),
    #"Filtered Rows" = Table.SelectRows(#"Added Service class", each true),
    #"Added Service Cat" = Table.AddColumn(#"Filtered Rows", "Service Cat", each ""),
    #"Reordered Columns6" = Table.ReorderColumns(#"Added Service Cat",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "Service class", "Service Cat", "Material Type", "WELDING DATE", "FITUP DATE", "WPS No.", "Welder", "DWR", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"MIR No" = Table.AddColumn(#"Reordered Columns6", "MIR No", each ""),
    #"MIR Date" = Table.AddColumn(#"MIR No", "MIR Date", each ""),
    #"Cutting Date" = Table.AddColumn(#"MIR Date", "Cutting Date", each ""),
    #"Beveling Date" = Table.AddColumn(#"Cutting Date", "Beveling Date", each ""),
    #"Preheat Date" = Table.AddColumn(#"Beveling Date", "Preheat Date", each ""),
    #"Changed Type9" = Table.TransformColumnTypes(#"Preheat Date",{{"Cutting Date", type date}, {"Beveling Date", type date}, {"Preheat Date", type date}}),
    #"Reordered Columns7" = Table.ReorderColumns(#"Changed Type9",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "FITUP DATE", "Preheat Date", "WELDING DATE", "WPS No.", "Welder", "DWR", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Renamed Columns7" = Table.RenameColumns(#"Reordered Columns7",{{"FITUP DATE", "Fitup Date"}, {"WELDING DATE", "Weld Date"}}),
    #"Reordered Columns8" = Table.ReorderColumns(#"Renamed Columns7",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWR", "WPS No.", "Welder", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Renamed Columns8" = Table.RenameColumns(#"Reordered Columns8",{{"DWR", "DWIR No."}}),
    #"Added Custom6" = Table.AddColumn(#"Renamed Columns8", "Sub-Contractor", each "Acciona"),
    #"Reordered Columns9" = Table.ReorderColumns(#"Added Custom6",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "WPS No.", "Welder", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Rework Code" = Table.AddColumn(#"Reordered Columns9", "Rework Code", each ""),
    #"Original Joint" = Table.AddColumn(#"Rework Code", "Original Joint", each "Acciona"),
    #"Repair Suffix" = Table.AddColumn(#"Original Joint", "Repair Suffix", each ""),
    #"Reordered Columns10" = Table.ReorderColumns(#"Repair Suffix",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WPS No.", "Welder", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Added Custom10" = Table.AddColumn(#"Reordered Columns10", "WeldPoint No.Custom", each "1"),
    #"Renamed Columns9" = Table.RenameColumns(#"Added Custom10",{{"WeldPoint No.Custom", "WeldPoint No."}}),
    #"Added Custom11" = Table.AddColumn(#"Renamed Columns9", "Weld Point Code", each ""),
    #"Reordered Columns11" = Table.ReorderColumns(#"Added Custom11",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT Report", "RT Date", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT%", "Remark", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Renamed Columns10" = Table.RenameColumns(#"Reordered Columns11",{{"Remark", "RT Remarks"}}),
    #"Reordered Columns12" = Table.ReorderColumns(#"Renamed Columns10",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PMI Report", "PMI Date", "PMI Acc/Rej", "PT Report", "PT Date", "PT Acc/Rej", "RT%", "RT Report", "RT Date", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Remarks", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Replaced Value2" = Table.ReplaceValue(#"Reordered Columns12",0.05,5,Replacer.ReplaceValue,{"RT%"}),
    #"Replaced Value3" = Table.ReplaceValue(#"Replaced Value2",1,100,Replacer.ReplaceValue,{"RT%"}),
    #"Changed Type10" = Table.TransformColumnTypes(#"Replaced Value3",{{"RT%", Int64.Type}}),
    #"Replaced Value4" = Table.ReplaceValue(#"Changed Type10","Accepted","A",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Replaced Value5" = Table.ReplaceValue(#"Replaced Value4","Repair","R",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Replaced Value6" = Table.ReplaceValue(#"Replaced Value5","Reshoot / A","RS",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Replaced Value7" = Table.ReplaceValue(#"Replaced Value6","(QG sign. pending)","",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"Reordered Columns13" = Table.ReorderColumns(#"Replaced Value7",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT%", "RT Report", "RT Date", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Remarks", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "PMI Date", "PMI Report", "PMI Acc/Rej", "PT Date", "PT Report", "PT Acc/Rej", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Added Custom12" = Table.AddColumn(#"Reordered Columns13", "NDT Remarks", each ""),
    #"NDT Remarks" = Table.ReorderColumns(#"Added Custom12",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "RT%", "RT Date", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Remarks", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "PMI Date", "PMI Report", "PMI Acc/Rej", "PT Date", "PT Report", "PT Acc/Rej", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"RT Batch No" = Table.AddColumn(#"NDT Remarks", "RT Batch No", each ""),
    #"RT Batch Status" = Table.AddColumn(#"RT Batch No", "RT Batch Status", each ""),
    #"RT Weld Status" = Table.AddColumn(#"RT Batch Status", "RT Weld Status", each if [Weld Date] = null and [#"RT%"] = 100 then "S"
else if [Weld Date] <> null and [#"RT%"] = 100 and [RT Report]=null then "HS" 
else if [Weld Date] <> null and [RT Report] <> "" then "" // Добавлено как ещё одно условие "else if"
else "S"),
    #"RT Selected Date" = Table.AddColumn(#"RT Weld Status", "RT Selected Date", each ""),
    #"RT Exam Req date" = Table.AddColumn(#"RT Selected Date", "RT Exam Req date", each ""),
    #"RT Xray No" = Table.AddColumn(#"RT Exam Req date", "RT Xray No", each ""),
    #"Added PWHT Y/N" = Table.AddColumn(#"RT Xray No", "PWHT Y/N", each ""),
#"Added PWHT Weld Status" = Table.AddColumn(#"Added PWHT Y/N", "PWHT Weld Status", each ""),
#"Added PWHT Selected Date" = Table.AddColumn(#"Added PWHT Weld Status", "PWHT Selected Date", each ""),
#"Added PWHT Exam Req date" = Table.AddColumn(#"Added PWHT Selected Date", "PWHT Exam Req date", each ""),
#"Added PWHT Date" = Table.AddColumn(#"Added PWHT Exam Req date", "PWHT Date", each ""),
#"Added PWHT Report" = Table.AddColumn(#"Added PWHT Date", "PWHT Report", each ""),
#"Added PWHT Acc/Rej" = Table.AddColumn(#"Added PWHT Report", "PWHT Acc/Rej", each ""),
#"Added PWHT Client Exam Req Y/N" = Table.AddColumn(#"Added PWHT Acc/Rej", "PWHT Client Exam Req Y/N", each ""),
#"Added PWHT Remarks" = Table.AddColumn(#"Added PWHT Client Exam Req Y/N", "PWHT Remarks", each ""),
#"Added HT%" = Table.AddColumn(#"Added PWHT Remarks", "HT%", each ""),
#"Added HT Batch No" = Table.AddColumn(#"Added HT%", "HT Batch No", each ""),
#"Added HT Batch Status" = Table.AddColumn(#"Added HT Batch No", "HT Batch Status", each ""),
#"Added HT Weld Status" = Table.AddColumn(#"Added HT Batch Status", "HT Weld Status", each ""),
#"Added HT Selected Date" = Table.AddColumn(#"Added HT Weld Status", "HT Selected Date", each ""),
#"Added HT Exam Req date" = Table.AddColumn(#"Added HT Selected Date", "HT Exam Req date", each ""),
#"Added HT Date" = Table.AddColumn(#"Added HT Exam Req date", "HT Date", each ""),
#"Added HT Report" = Table.AddColumn(#"Added HT Date", "HT Report", each ""),
#"Added HT Acc/Rej" = Table.AddColumn(#"Added HT Report", "HT Acc/Rej", each ""),
#"Added HT Client Exam Req Y/N" = Table.AddColumn(#"Added HT Acc/Rej", "HT Client Exam Req Y/N", each ""),
#"Added HT Remarks" = Table.AddColumn(#"Added HT Client Exam Req Y/N", "HT Remarks", each ""),
    #"Reordered Columns14" = Table.ReorderColumns(#"Added HT Remarks",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Remarks", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "PMI Date", "PMI Report", "PMI Acc/Rej", "PT Date", "PT Report", "PT Acc/Rej", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Defect Code" = Table.AddColumn(#"Reordered Columns14", "Defect Code", each ""),
    #"Location of Defect" = Table.AddColumn(#"Defect Code", "Location of Defect", each ""),
    #"Reordered Columns15" = Table.ReorderColumns(#"Location of Defect",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Remarks", "Iso Penalty", "Sht", "Tracer 1", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "PMI Date", "PMI Report", "PMI Acc/Rej", "PT Date", "PT Report", "PT Acc/Rej", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Added Custom7" = Table.AddColumn(#"Reordered Columns15", "Tracer Shot", each if [Tracer 1]<>"" then "T" else ""),
    #"Removed Columns3" = Table.RemoveColumns(#"Added Custom7",{"Tracer Shot"}),
    #"Replaced Value9" = Table.ReplaceValue(#"Removed Columns3",null,"",Replacer.ReplaceValue,{"Tracer 1"}),
    #"Replaced Value10" = Table.ReplaceValue(#"Replaced Value9",null,"",Replacer.ReplaceValue,{"Tracer 2"}),
    #"Tracer Shot" = Table.RenameColumns(#"Replaced Value10",{{"Tracer 1", "Tracer Shot"}}),
    #"Reordered Columns16" = Table.ReorderColumns(#"Tracer Shot",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Remarks", "Tracer Shot", "Iso Penalty", "Sht", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "PMI Date", "PMI Report", "PMI Acc/Rej", "PT Date", "PT Report", "PT Acc/Rej", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "Column12", "PR", "FABRICATION", "Paint Release"}),
    #"Removed Columns4" = Table.RemoveColumns(#"Reordered Columns16",{"Iso Penalty", "Sht", "RT Report No:", "Tracer 1 RT Acc/Rej", "Iso Penalty7", "Sht8", "Tracer 2", "RT Report No:10", "Tracer 2 RT Acc/Rej", "FABRICATION", "Paint Release"}),
    #"RT Re-Shoot Status" = Table.AddColumn(#"Removed Columns4", "RT Re-Shoot Status", each ""),
    #"Added Custom8" = Table.AddColumn(#"RT Re-Shoot Status", "RT Re-Shoot Reason", each ""),
    #"Added Custom9" = Table.AddColumn(#"Added Custom8", "RT Re-Shoot Films", each ""),
    #"Added Weld Length" = Table.AddColumn(#"Added Custom9", "Weld Length", each ""),
    #"Added Rej Length" = Table.AddColumn(#"Added Weld Length", "Rej Length", each ""),
    #"Added Custom15" = Table.AddColumn(#"Added Rej Length", "RT Client Exam Req Y/N", each ""),
    #"By UT" = Table.AddColumn(#"Added Custom15", "By UT", each ""),
    #"Added UT%" = Table.AddColumn(#"By UT", "UT%", each ""),
#"Added UT Batch No" = Table.AddColumn(#"Added UT%", "UT Batch No", each ""),
#"Added UT Batch Status" = Table.AddColumn(#"Added UT Batch No", "UT Batch Status", each ""),
#"Added UT Weld Status" = Table.AddColumn(#"Added UT Batch Status", "UT Weld Status", each ""),
#"Added UT Selected Date" = Table.AddColumn(#"Added UT Weld Status", "UT Selected Date", each ""),
#"Added UT Exam Req date" = Table.AddColumn(#"Added UT Selected Date", "UT Exam Req date", each ""),
#"Added UT Date" = Table.AddColumn(#"Added UT Exam Req date", "UT Date", each ""),
#"Added UT Report" = Table.AddColumn(#"Added UT Date", "UT Report", each ""),
#"Added UT Acc/Rej" = Table.AddColumn(#"Added UT Report", "UT Acc/Rej", each ""),
#"Added UT Client Exam Req Y/N" = Table.AddColumn(#"Added UT Acc/Rej", "UT Client Exam Req Y/N", each ""),
#"Added UT Remarks" = Table.AddColumn(#"Added UT Client Exam Req Y/N", "UT Remarks", each ""),
#"Added MT%" = Table.AddColumn(#"Added UT Remarks", "MT%", each ""),
#"Added MT Batch No" = Table.AddColumn(#"Added MT%", "MT Batch No", each ""),
#"Added MT Batch Status" = Table.AddColumn(#"Added MT Batch No", "MT Batch Status", each ""),
#"Added MT Weld Status" = Table.AddColumn(#"Added MT Batch Status", "MT Weld Status", each ""),
#"Added MT Selected Date" = Table.AddColumn(#"Added MT Weld Status", "MT Selected Date", each ""),
#"Added MT Exam Req date" = Table.AddColumn(#"Added MT Selected Date", "MT Exam Req date", each ""),
#"Added MT Date" = Table.AddColumn(#"Added MT Exam Req date", "MT Date", each ""),
#"Added MT Report" = Table.AddColumn(#"Added MT Date", "MT Report", each ""),
#"Added MT Acc/Rej" = Table.AddColumn(#"Added MT Report", "MT Acc/Rej", each ""),
#"Added MT Client Exam Req Y/N" = Table.AddColumn(#"Added MT Acc/Rej", "MT Client Exam Req Y/N", each ""),
#"Added MT Remarks" = Table.AddColumn(#"Added MT Client Exam Req Y/N", "MT Remarks", each ""),
#"Added PMI%" = Table.AddColumn(#"Added MT Remarks", "PMI%", each ""),
#"Added PMI Batch No" = Table.AddColumn(#"Added PMI%", "PMI Batch No", each ""),
#"Added PMI Batch Status" = Table.AddColumn(#"Added PMI Batch No", "PMI Batch Status", each ""),
#"Added PMI Weld Status" = Table.AddColumn(#"Added PMI Batch Status", "PMI Weld Status", each ""),
#"Added PMI Selected Date" = Table.AddColumn(#"Added PMI Weld Status", "PMI Selected Date", each ""),
#"Added PMI Exam Req date" = Table.AddColumn(#"Added PMI Selected Date", "PMI Exam Req date", each ""),
#"Added PMI Client Exam Req Y/N" = Table.AddColumn(#"Added PMI Exam Req date", "PMI Client Exam Req Y/N", each ""),
#"Added PMI Remarks" = Table.AddColumn(#"Added PMI Client Exam Req Y/N", "PMI Remarks", each ""),
#"Added PT%" = Table.AddColumn(#"Added PMI Remarks", "PT%", each ""),
#"Added PT Batch No" = Table.AddColumn(#"Added PT%", "PT Batch No", each ""),
#"Added PT Batch Status" = Table.AddColumn(#"Added PT Batch No", "PT Batch Status", each ""),
#"Added PT Weld Status" = Table.AddColumn(#"Added PT Batch Status", "PT Weld Status", each ""),
#"Added PT Selected Date" = Table.AddColumn(#"Added PT Weld Status", "PT Selected Date", each ""),
#"Added PT Exam Req date" = Table.AddColumn(#"Added PT Selected Date", "PT Exam Req date", each ""),
#"Added PT Client Exam Req Y/N" = Table.AddColumn(#"Added PT Exam Req date", "PT Client Exam Req Y/N", each ""),
#"Added PT Remarks" = Table.AddColumn(#"Added PT Client Exam Req Y/N", "PT Remarks", each ""),
#"Added FN%" = Table.AddColumn(#"Added PT Remarks", "FN%", each ""),
#"Added FN Batch No" = Table.AddColumn(#"Added FN%", "FN Batch No", each ""),
#"Added FN Batch Status" = Table.AddColumn(#"Added FN Batch No", "FN Batch Status", each ""),
#"Added FN Weld Status" = Table.AddColumn(#"Added FN Batch Status", "FN Weld Status", each ""),
#"Added FN Selected Date" = Table.AddColumn(#"Added FN Weld Status", "FN Selected Date", each ""),
#"Added FN Exam Req date" = Table.AddColumn(#"Added FN Selected Date", "FN Exam Req date", each ""),
#"Added FN Date" = Table.AddColumn(#"Added FN Exam Req date", "FN Date", each ""),
#"Added FN Report" = Table.AddColumn(#"Added FN Date", "FN Report", each ""),
#"Added FN Acc/Rej" = Table.AddColumn(#"Added FN Report", "FN Acc/Rej", each ""),
#"Added FN Client Exam Req Y/N" = Table.AddColumn(#"Added FN Acc/Rej", "FN Client Exam Req Y/N", each ""),
#"Added FN Remarks" = Table.AddColumn(#"Added FN Client Exam Req Y/N", "FN Remarks", each ""),
#"Added PADLT Y/N" = Table.AddColumn(#"Added FN Remarks", "PADLT Y/N", each ""),
#"Added PADLT Weld Status" = Table.AddColumn(#"Added PADLT Y/N", "PADLT Weld Status", each ""),
#"Added PADLT Selected Date" = Table.AddColumn(#"Added PADLT Weld Status", "PADLT Selected Date", each ""),
#"Added PADLT Exam Req date" = Table.AddColumn(#"Added PADLT Selected Date", "PADLT Exam Req date", each ""),
#"Added PADLT Date" = Table.AddColumn(#"Added PADLT Exam Req date", "PADLT Date", each ""),
#"Added PADLT Report" = Table.AddColumn(#"Added PADLT Date", "PADLT Report", each ""),
#"Added PADLT Acc/Rej" = Table.AddColumn(#"Added PADLT Report", "PADLT Acc/Rej", each ""),
#"Added PADLT Client Exam Req Y/N" = Table.AddColumn(#"Added PADLT Acc/Rej", "PADLT Client Exam Req Y/N", each ""),
#"Added PADLT Remarks" = Table.AddColumn(#"Added PADLT Client Exam Req Y/N", "PADLT Remarks", each ""),
#"Added ORIF Y/N" = Table.AddColumn(#"Added PADLT Remarks", "ORIF Y/N", each ""),
#"Added ORIF Weld Status" = Table.AddColumn(#"Added ORIF Y/N", "ORIF Weld Status", each ""),
#"Added ORIF Selected Date" = Table.AddColumn(#"Added ORIF Weld Status", "ORIF Selected Date", each ""),
#"Added ORIF Exam Req date" = Table.AddColumn(#"Added ORIF Selected Date", "ORIF Exam Req date", each ""),
#"Added ORIF Date" = Table.AddColumn(#"Added ORIF Exam Req date", "ORIF Date", each ""),
#"Added ORIF Report" = Table.AddColumn(#"Added ORIF Date", "ORIF Report", each ""),
#"Added ORIF Acc/Rej" = Table.AddColumn(#"Added ORIF Report", "ORIF Acc/Rej", each ""),
#"Added ORIF Client Exam Req Y/N" = Table.AddColumn(#"Added ORIF Acc/Rej", "ORIF Client Exam Req Y/N", each ""),
#"Added Matrl Traceability Y/N" = Table.AddColumn(#"Added ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", each ""),
#"Added GROUP-1" = Table.AddColumn(#"Added Matrl Traceability Y/N", "GROUP-1", each ""),
#"Added IDENT CODE-1" = Table.AddColumn(#"Added GROUP-1", "IDENT CODE-1", each ""),
#"Added TRAC NO-1" = Table.AddColumn(#"Added IDENT CODE-1", "TRAC NO-1", each ""),
#"Added GROUP-2" = Table.AddColumn(#"Added TRAC NO-1", "GROUP-2", each ""),
#"Added IDENT CODE-2" = Table.AddColumn(#"Added GROUP-2", "IDENT CODE-2", each ""),
#"Added TRAC NO-2" = Table.AddColumn(#"Added IDENT CODE-2", "TRAC NO-2", each ""),
#"Added Revision Status" = Table.AddColumn(#"Added TRAC NO-2", "Revision Status", each ""),
#"Added Revision Comments" = Table.AddColumn(#"Added Revision Status", "Revision Comments", each ""),
#"Added Hold Status" = Table.AddColumn(#"Added Revision Comments", "Hold Status", each ""),
#"Added Hold Comments" = Table.AddColumn(#"Added Hold Status", "Hold Comments", each ""),
#"Added Piping Group" = Table.AddColumn(#"Added Hold Comments", "Piping Group", each ""),
    #"Added Custom16" = Table.AddColumn(#"Added Piping Group", "Golden Weld Report Date", each ""),
    #"Changed Type11" = Table.TransformColumnTypes(#"Added Custom16",{{"Golden Weld Report Date", type date}}),
    #"Added Custom17" = Table.AddColumn(#"Changed Type11", "Golden Weld Report No", each ""),
    #"Reordered Columns17" = Table.ReorderColumns(#"Added Custom17",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "PMI Date", "PMI Report", "PMI Acc/Rej", "PT Date", "PT Report", "PT Acc/Rej", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No"}),
    #"Changed Type12" = Table.TransformColumnTypes(#"Reordered Columns17",{{"Weld Length", type number}, {"Rej Length", type number}}),
    #"Reordered Columns18" = Table.ReorderColumns(#"Changed Type12",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "Heat No. 1", "Part 2", "Heat No. 2", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No"}),
    #"Removed Columns5" = Table.RemoveColumns(#"Reordered Columns18",{"Heat No. 1", "Heat No. 2"}),
    #"Reordered Columns19" = Table.ReorderColumns(#"Removed Columns5",{"ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No"}),
    #"CHANGE TYPE to DATE" = Table.TransformColumnTypes(#"Reordered Columns19",{{"UT Selected Date", type date}, {"UT Exam Req date", type date}, {"UT Date", type date}, {"MT Selected Date", type date}, {"MT Exam Req date", type date}, {"MT Date", type date}, {"PMI Selected Date", type date}, {"PMI Exam Req date", type date}, {"PT Selected Date", type date}, {"PT Exam Req date", type date}, {"FN Selected Date", type date}, {"FN Exam Req date", type date}, {"FN Date", type date}, {"PADLT Selected Date", type date}, {"PADLT Exam Req date", type date}, {"PADLT Date", type date}, {"ORIF Selected Date", type date}, {"ORIF Exam Req date", type date}, {"ORIF Date", type date}}),
    #"Joint ID" = Table.AddColumn(#"CHANGE TYPE to DATE", "Joint ID", each [ISO Number]&"-"&[#"Spool No."]&"-"&[#"Weld No."]),
    #"Reordered Columns20" = Table.ReorderColumns(#"Joint ID",{"Joint ID", "ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No"}),
    #"Replaced Value11" = Table.ReplaceValue(#"Reordered Columns20",null,"-_-",Replacer.ReplaceValue,{"Spool No."}),
    #"Spool ID" = Table.AddColumn(#"Replaced Value11", "Spool ID", each [ISO Number]&"-"&[#"Spool No."]),
    #"Reordered Columns21" = Table.ReorderColumns(#"Spool ID",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Line No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No"}),
    #"DELL LINE No" = Table.RemoveColumns(#"Reordered Columns21",{"Line No."}),
    #"Added Custom18" = Table.AddColumn(#"DELL LINE No", "RT/UT", each ""),
    #"Reordered Columns22" = Table.ReorderColumns(#"Added Custom18",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Test Pack No: ", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "Total Films", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No"}),
    #"Added Custom1" = Table.AddColumn(#"Reordered Columns22", "Custom3", each ""),
    #"Added Custom2" = Table.AddColumn(#"Added Custom1", "Custom4", each ""),
    #"Added Custom3" = Table.AddColumn(#"Added Custom2", "Custom5", each ""),
    #"Added Custom4" = Table.AddColumn(#"Added Custom3", "Custom6", each ""),
    #"Added Custom5" = Table.AddColumn(#"Added Custom4", "Custom7", each ""),
    #"Added Custom19" = Table.AddColumn(#"Added Custom5", "Custom8", each ""),
    #"Added Custom20" = Table.AddColumn(#"Added Custom19", "Custom9", each ""),
    #"Added Custom21" = Table.AddColumn(#"Added Custom20", "Custom10", each ""),
    #"Added Custom22" = Table.AddColumn(#"Added Custom21", "Custom11", each ""),
    #"Added Custom23" = Table.AddColumn(#"Added Custom22", "Custom12", each ""),
    #"Added Custom24" = Table.AddColumn(#"Added Custom23", "Custom13", each ""),
    #"Added Custom25" = Table.AddColumn(#"Added Custom24", "Custom14", each ""),
    #"Added Custom26" = Table.AddColumn(#"Added Custom25", "Subsystem Code", each ""),
    PED = Table.AddColumn(#"Added Custom26", "PED", each ""),
    #"Renamed Columns11" = Table.RenameColumns(PED,{{"Test Pack No: ", "Testpack No"}, {"Total Films", "RT Film Total"}}),
    #"Replaced Value12" = Table.ReplaceValue(#"Renamed Columns11",null,"",Replacer.ReplaceValue,{"RT Date"}),
    #"Removed Errors" = Table.RemoveRowsWithErrors(#"Replaced Value12", {"RT Date"}),
    #"Replaced Value13" = Table.ReplaceValue(#"Removed Errors"," ","",Replacer.ReplaceText,{"RT Date"}),
    #"Split Column by Position" = Table.SplitColumn(#"Replaced Value13", "RT Date", Splitter.SplitTextByPositions({0, 23}, false), {"RT Date.1", "RT Date.2"}),
    #"Changed Type14" = Table.TransformColumnTypes(#"Split Column by Position",{{"RT Date.1", type text}, {"RT Date.2", type text}}),
    #"Removed Columns6" = Table.RemoveColumns(#"Changed Type14",{"RT Date.2"}),
    #"Split Column by Position1" = Table.SplitColumn(#"Removed Columns6", "RT Date.1", Splitter.SplitTextByPositions({0, 11}, false), {"RT Date.1.1", "RT Date.1.2"}),
    #"Changed Type15" = Table.TransformColumnTypes(#"Split Column by Position1",{{"RT Date.1.1", type text}, {"RT Date.1.2", type text}}),
    #"Removed Columns7" = Table.RemoveColumns(#"Changed Type15",{"RT Date.1.2"}),
    #"Renamed Columns12" = Table.RenameColumns(#"Removed Columns7",{{"RT Date.1.1", "RT Date"}}),
    #"Removed Errors1" = Table.RemoveRowsWithErrors(#"Renamed Columns12", {"RT Date"}),
    #"Replaced Value14" = Table.ReplaceValue(#"Removed Errors1"," ","",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value15" = Table.ReplaceValue(#"Replaced Value14","-","/",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value16" = Table.ReplaceValue(#"Replaced Value15","/08/","-Aug-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value17" = Table.ReplaceValue(#"Replaced Value16","/09/","-Sep-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value18" = Table.ReplaceValue(#"Replaced Value17","/10/","-Oct-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value19" = Table.ReplaceValue(#"Replaced Value18","/11/","-Nov-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value20" = Table.ReplaceValue(#"Replaced Value19","/12/","-Dec-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value21" = Table.ReplaceValue(#"Replaced Value20","/01/","-Jan-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value22" = Table.ReplaceValue(#"Replaced Value21","/02/","-Feb-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value23" = Table.ReplaceValue(#"Replaced Value22","/03/","-Mar-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value24" = Table.ReplaceValue(#"Replaced Value23","/04/","-Apr-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value25" = Table.ReplaceValue(#"Replaced Value24","/05/","-May-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value26" = Table.ReplaceValue(#"Replaced Value25","/06/","-Jun-",Replacer.ReplaceText,{"RT Date"}),
    #"Replaced Value27" = Table.ReplaceValue(#"Replaced Value26","/07/","-Jul-",Replacer.ReplaceText,{"RT Date"}),
    #"Changed Type13" = Table.TransformColumnTypes(#"Replaced Value27",{{"RT Date", type date}}),
    #"Filtered Rows1" = Table.SelectRows(#"Changed Type13", each true),
    #"Replaced Value28" = Table.ReplaceValue(#"Filtered Rows1","shop","S",Replacer.ReplaceText,{"Weld Cat"}),
    #"Replaced Value8" = Table.ReplaceValue(#"Replaced Value28","U/review","U/Review",Replacer.ReplaceText,{"RT Acc/Rej"}),
    #"ADD Total No of films Rej 2" = Table.AddColumn(#"Replaced Value8", "Total No of films Rej2", each if [#"RT Acc/Rej"] = "R" then [Total No of films Rej] else 0),
    #"Reordered Columns23" = Table.ReorderColumns(#"ADD Total No of films Rej 2",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Total No of films Rej2", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Subsystem Code", "PED"}),
    #"Removed Columns8" = Table.RemoveColumns(#"Reordered Columns23",{"Total No of films Rej"}),
    #"Renamed Columns13" = Table.RenameColumns(#"Removed Columns8",{{"Total No of films Rej2", "Total No of films Rej"}}),
    #"Filtered Rows2" = Table.SelectRows(#"Renamed Columns13", each true),
    #"Replaced Value53" = Table.ReplaceValue(#"Filtered Rows2","Accepted","A",Replacer.ReplaceText,{"PMI Acc/Rej"}),
    #"Replaced Value54" = Table.ReplaceValue(#"Replaced Value53","Accepted","A",Replacer.ReplaceText,{"PT Acc/Rej"}),
    #"Changed Type17" = Table.TransformColumnTypes(#"Replaced Value54",{{"Total No of films Rej", type number}, {"Total No of films Acc", type number}, {"RT Film Total", type number}}),
    #"Reordered Columns24" = Table.ReorderColumns(#"Changed Type17",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Column12", "Subsystem Code", "PED"}),
    #"Removed Columns9" = Table.RemoveColumns(#"Reordered Columns24",{"Custom14"}),
    #"Renamed Columns14" = Table.RenameColumns(#"Removed Columns9",{{"Column12", "Custom14"}}),
    #"Changed Type18" = Table.TransformColumnTypes(#"Renamed Columns14",{{"MIR Date", type date}, {"PWHT Selected Date", type date}, {"PWHT Exam Req date", type date}, {"PWHT Date", type date}, {"HT Selected Date", type date}, {"HT Exam Req date", type date}, {"HT Date", type date}, {"RT Selected Date", type date}, {"RT Exam Req date", type date}, {"RT Re-Shoot Data", type date}}),
    #"Reordered Columns25" = Table.ReorderColumns(#"Changed Type18",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No.", "Spool No.", "Spool Rev No.", "Weld No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "PR", "NDT Remarks", "Service class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "Weld Point Code", "WeldPoint No.", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "RT Remarks", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Date", "PMI Report", "PMI Acc/Rej", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Date", "PT Report", "PT Acc/Rej", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "Part 1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Part 2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Subsystem Code", "PED"}),
    #"Removed Columns10" = Table.RemoveColumns(#"Reordered Columns25",{"Testpack No"}),
    #"PR to Testpack No" = Table.RenameColumns(#"Removed Columns10",{{"PR", "Testpack No"}}),
    #"Trimmed Text1" = Table.TransformColumns(#"PR to Testpack No",{{"Welder", Text.Trim, type text}})
in
    #"Trimmed Text1"
```

### `Project WD+WR+INCO+Acciona`

```m
let
    Source = Table.Combine({#"Weld Dump", #"CSVExport_Welder Record", Acciona_Query, #"Inco Weld Log"}),
    #"Changed Type" = Table.TransformColumnTypes(Source,{{"RT%", Int64.Type}, {"UT%", Int64.Type}, {"MT%", Int64.Type}, {"PMI%", Int64.Type}, {"PT%", Int64.Type}, {"Weld Cat", type text}, {"RT Re-Shoot Films", Int64.Type}}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Changed Type",{{"Joint ID", type text}}),
    #"Filtered Rows SubCon" = Table.SelectRows(#"Changed Type3", each ([#"Sub-Contractor"] <> "")),
    #"Replaced Value" = Table.ReplaceValue(#"Filtered Rows SubCon",null,"",Replacer.ReplaceValue,{"Weld Cat"}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Replaced Value",{{"Total No of films Acc", type number}, {"WeldPoint No.", Int64.Type}, {"Dia inch", type number}}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Changed Type1",{{"Total No of films Rej", type number}}),
    #"Appended Query" = Table.Combine({#"Changed Type2", #"AllTrain_CSVExport_Joint Record NOT WELDED"}),
    #"Changed Type4" = Table.TransformColumnTypes(#"Appended Query",{{"HT%", Int64.Type}, {"FN%", Int64.Type}, {"RT Re-Shoot Films", Int64.Type}}),
    #"Replaced Value1" = Table.ReplaceValue(#"Changed Type4","ACCEPT","A",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Replaced Value2" = Table.ReplaceValue(#"Replaced Value1","ACEPT","A",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Replaced Value3" = Table.ReplaceValue(#"Replaced Value2","REJECT","R",Replacer.ReplaceText,{"Manual UT Status"}),
    #"Replaced RPDS to RPD" = Table.ReplaceValue(#"Replaced Value3","RPDS","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDUA to RPD" = Table.ReplaceValue(#"Replaced RPDS to RPD","RPDUA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPD0 to RPD" = Table.ReplaceValue(#"Replaced RPDUA to RPD","RPD0","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDF to RPD" = Table.ReplaceValue(#"Replaced RPD0 to RPD","RPDF","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDN to RPD" = Table.ReplaceValue(#"Replaced RPDF to RPD","RPDN","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDNA to RPD" = Table.ReplaceValue(#"Replaced RPDN to RPD","RPDNA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDSA to RPD" = Table.ReplaceValue(#"Replaced RPDNA to RPD","RPDSA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDHA to RPD" = Table.ReplaceValue(#"Replaced RPDSA to RPD","RPDHA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced RPDA to RPD" = Table.ReplaceValue(#"Replaced RPDHA to RPD","RPDA","RPD",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOB0 to SOB" = Table.ReplaceValue(#"Replaced RPDA to RPD","SOB0","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBF to SOB" = Table.ReplaceValue(#"Replaced SOB0 to SOB","SOBF","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBHA to SOB" = Table.ReplaceValue(#"Replaced SOBF to SOB","SOBHA","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBN to SOB" = Table.ReplaceValue(#"Replaced SOBHA to SOB","SOBN","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBS to SOB" = Table.ReplaceValue(#"Replaced SOBN to SOB","SOBS","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBSA to SOB" = Table.ReplaceValue(#"Replaced SOBS to SOB","SOBSA","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBUA to SOB" = Table.ReplaceValue(#"Replaced SOBSA to SOB","SOBUA","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"Replaced SOBA to SOB" = Table.ReplaceValue(#"Replaced SOBUA to SOB","SOBA","SOB",Replacer.ReplaceText,{"Weld Type"}),
    #"ACCEPT to A" = Table.ReplaceValue(#"Replaced SOBA to SOB","ACCEPT","A",Replacer.ReplaceText,{"Result (A/R)"}),
    #"Joint ID for Heat N" = Table.AddColumn(#"ACCEPT to A", "Joint ID for Heat N", each [ISO Number]&"-"&[#"Weld No."]&""&[Repair Suffix]),
    #"EXLUDE 4 RT B.log CCC" = Table.SelectRows(#"Joint ID for Heat N", each [Joint ID] <> "11040A1-DG6204061C-SP2-9" and [Joint ID] <> "11040A3-DB6204507-SP4-12" and [Joint ID] <> "11040A3-NG6204709-SP17-62" and [Joint ID] <> "11060A4-PR6206008-SP3-11"),
    #"Added Index" = Table.AddIndexColumn(#"EXLUDE 4 RT B.log CCC", "Index", 1, 1, Int64.Type)
in
    #"Added Index"
```

### `WELDERS_Qualification`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Welders\Welders Power Q for PBI .xlsx"), null, true),
    WELDERS_Qualification_Table = Source{[Item="WELDERS_Qualification",Kind="Table"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(WELDERS_Qualification_Table,{{"SL No.", Int64.Type}, {"PIP -PIPING                                 STR- STRUCTURAL WELDERS", type text}, {"Welder Name", type text}, {"WQT NO #", type text}, {"Welder No.", type text}, {"WPS No", type text}, {"Date of Test", type date}, {"Welding Process", type text}, {"Filler Materials", type text}, {"Base Material", type text}, {"Type of Joint", type text}, {"WORKING LOCATION", type text}, {"VT RESULT", type text}, {"RT RESULT", type text}, {"STATUS", type text}, {"REMARKS", type text}, {"Sub-Contractor", type text}, {"WELDER ID", type text}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"WELDER ID", "WELDER ID+NAME"}})
in
    #"Renamed Columns"
```

### `SCTR OVERALL APPLIED WELDERS`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Welders\SCTR NFE WELDERS APPLIED.xls"), null, true),
    #"SCTR OVERALL APPLIED WELDERS1" = Source{[Name="SCTR OVERALL APPLIED WELDERS"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(#"SCTR OVERALL APPLIED WELDERS1",{{"Column1", type text}, {"Column2", type text}, {"Column3", type text}, {"Column4", type text}, {"Column5", type text}, {"Column6", type text}, {"Column7", type text}, {"Column8", type text}, {"Column9", type text}, {"Column10", type text}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",1),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Removed Bottom Rows" = Table.RemoveLastN(#"Promoted Headers",4),
    #"Removed Columns" = Table.RemoveColumns(#"Removed Bottom Rows",{"SUB CONTRACTOR"}),
    #"Renamed Columns" = Table.RenameColumns(#"Removed Columns",{{"Column2", "SUB CONTRACTOR"}}),
    #"Filled Down" = Table.FillDown(#"Renamed Columns",{"SUB CONTRACTOR"}),
    #"Replaced Value" = Table.ReplaceValue(#"Filled Down","CONSOLIDATED  CONTRACTORS COMPANY (CCC)","CCC",Replacer.ReplaceText,{"SUB CONTRACTOR"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value","ACCIONA (DEBAJ)","ACCIONA",Replacer.ReplaceText,{"SUB CONTRACTOR"}),
    #"Replaced Value2" = Table.ReplaceValue(#"Replaced Value1","TEKFEN (BLACK CAT)","TEKFEN",Replacer.ReplaceText,{"SUB CONTRACTOR"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Replaced Value2",{{"SUB CONTRACTOR", "Sub-Contractor"}}),
    #"Removed Bottom Rows1" = Table.RemoveLastN(#"Renamed Columns1",1),
    #"Replaced Value3" = Table.ReplaceValue(#"Removed Bottom Rows1","ACCIONA","Acciona",Replacer.ReplaceText,{"Sub-Contractor"}),
    #"Replaced Value4" = Table.ReplaceValue(#"Replaced Value3","INCO","Inco",Replacer.ReplaceText,{"Sub-Contractor"}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Replaced Value4",{{"WELDERS TESTED (APPLIED)", Int64.Type}, {"VISUAL ACCEPTED ", Int64.Type}, {" VISUAL REJECTED ", Int64.Type}, {"RT ACCEPTED ", Int64.Type}, {"RT REJECTED", Int64.Type}, {"DISQUALIFIED DUE TO MEDICAL REASON / BEHAVIOUR / HIGH REPAIR", Int64.Type}, {"NOT MOBILIZED / DISQUALIFIED DUE TO 6 MONTH VALIDITY EXPIRED", Int64.Type}, {"RESIGNATION", Int64.Type}, {"ACTIVE WELDERS", Int64.Type}, {"ACTIVE PIPING WELDERS", Int64.Type}, {"QUALIFIED  WELDERS", Int64.Type}}),
    #"(BLACK CAT) to TEKFEN" = Table.ReplaceValue(#"Changed Type1","TEKFEN                        (BLACK CAT)","TEKFEN",Replacer.ReplaceText,{"Sub-Contractor"}),
    #"CCC (DANEM) to CCC" = Table.ReplaceValue(#"(BLACK CAT) to TEKFEN","CCC (DANEM)","CCC",Replacer.ReplaceText,{"Sub-Contractor"}),
    #"DEBAJ+FD to Acciona" = Table.ReplaceValue(#"CCC (DANEM) to CCC","Acciona (DEBAJ+FD)","Acciona",Replacer.ReplaceText,{"Sub-Contractor"}),
    #"CCC+EMKAN to CCC" = Table.ReplaceValue(#"DEBAJ+FD to Acciona","CONSOLIDATED  CONTRACTORS COMPANY (CCC+EMKAN)","CCC",Replacer.ReplaceText,{"Sub-Contractor"}),
    #"Filtered Rows" = Table.SelectRows(#"CCC+EMKAN to CCC", each ([#"STRUCTURAL / PIPING"] <> "TOTAL"))
in
    #"Filtered Rows"
```

### `Inco of NDE Summary`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Inco\Master Weld_Latest.xlsx"), null, true),
    #"Summary of NDE_Sheet" = Source{[Item="Summary of NDE",Kind="Sheet"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(#"Summary of NDE_Sheet",{{"Column1", type any}, {"Column2", type any}, {"Column3", type any}, {"Column4", type any}, {"Column5", type text}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",2),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers",{{"As on Date", type date}, {"RT REQUIRED", Int64.Type}, {"RT TAKEN", Int64.Type}, {"RT BACKLOG", Int64.Type}, {"REMARKS", type text}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type1", each ([As on Date] <> null))
in
    #"Filtered Rows"
```

### `Inco NDT Tracking`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Inco\Master Weld_Latest.xlsx"), null, true),
    #"NDT Tracking_Sheet" = Source{[Item="NDT Tracking",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"NDT Tracking_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Sl. No.", Int64.Type}, {"Activity Discription", type text}, {"Tank No.", type text}, {"NDE Req.", type any}, {"UNIT", type text}, {"Weekly", type any}, {"Column7", type any}, {"Column8", type any}, {"Column9", type any}, {"Cummulative", type any}, {"Column11", type any}, {"Column12", type any}, {"Column13", type any}, {"Remarks", type any}}),
    #"Promoted Headers1" = Table.PromoteHeaders(#"Changed Type", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers1",{{"Column1", Int64.Type}, {"Column2", type text}, {"Column3", type text}, {"Column4", type any}, {"Column5", type text}, {"Welded", Int64.Type}, {"RT Req.", Int64.Type}, {"RT Taken", type any}, {"Bal", Int64.Type}, {"Welded_1", type number}, {"RT Req._2", Int64.Type}, {"RT Taken_3", Int64.Type}, {"Bal_4", Int64.Type}, {"Column14", type any}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type1",{{"Column1", "Sl. No."}, {"Column2", "Activity Discription"}, {"Column3", "Tank No."}, {"Column4", "NDE Req."}, {"Column5", "UNIT"}, {"Welded", "Welded Weekly"}, {"RT Req.", "RT Req. Weekly"}, {"RT Taken", "RT Taken Weekly"}, {"Bal", "Bal.Weekly"}, {"Welded_1", "Welded Cummulative"}, {"RT Req._2", "RT Req. Cummulative"}, {"RT Taken_3", "RT Taken Cummulative"}, {"Bal_4", "Bal Cummulative"}, {"Column14", "Remarks"}})
in
    #"Renamed Columns"
```

### `WPQ RECORD REGISTER`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\WPQ RECORD REGISTER\WPQ RECORD REGISTER.xlsx"), null, true),
    CONSOLIDATED1 = Source{[Name="CONSOLIDATED"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(CONSOLIDATED1,{{"Column1", type text}, {"Column2", type text}, {"Column3", type text}, {"Column4", type text}, {"Column5", type text}, {"Column6", type text}, {"Column7", type text}, {"Column8", type text}, {"Column9", type text}, {"Column10", type text}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type text}, {"Column18", type text}, {"Column19", type text}, {"Column20", type text}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",3),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers",{{"S.N", Int64.Type}, {"SCTR", type text}, {"WPS NO.", type text}, {"WPS Rev. No.", type text}, {"PQR #(lf)No/Rev.", type text}, {"WELDING PROCESS (ES)", type text}, {"Column7", type text}, {"PQR Material #(lf)Seamless / Welder Pipes & Plate", type text}, {"Column9", type text}, {"PWHT ", type text}, {" DOCUMENT STATUS", type text}, {"APPLICATION", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type text}, {"Column18", type text}, {"CODE ", Int64.Type}, {"REMARKS", type text}}),
    #"Removed Columns" = Table.RemoveColumns(#"Changed Type1",{"Column13", "Column14", "Column15", "Column16", "Column17", "Column18", "CODE ", "REMARKS"}),
    #"Filtered Rows" = Table.SelectRows(#"Removed Columns", each ([#"WPS NO."] <> null)),
    #"Trimmed Text" = Table.TransformColumns(#"Filtered Rows",{{"WPS NO.", Text.Trim, type text}})
in
    #"Trimmed Text"
```

### `Acciona Joint Summary`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Acciona\Acciona_Latest Add to Query.xlsx"), null, true),
    #"Joint Summary_Sheet" = Source{[Item="Joint Summary",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"Joint Summary_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Metallic Piping Joint Summary as on 22-02-2024", type text}, {"Column2", type any}, {"Column3", type any}, {"Column4", type any}, {"Column5", type any}, {"Column6", type any}, {"Column7", type any}, {"Column8", type any}, {"Column9", type any}, {"Column10", type any}, {"Column11", type any}, {"Column12", type any}, {"Column13", type any}, {"Column14", type any}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",1),
    #"Promoted Headers1" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers1",{{"Material", type text}, {"Size (""Ø)", type any}, {"No. of Joints Welded ", Int64.Type}, {"NDT STATUS", type any}, {"Column5", type any}, {"Column6", type any}, {"Column7", type any}, {"Threaded Joints", Int64.Type}, {"Total No. of Joints", Int64.Type}, {"Total Welding (""Ø)", type number}, {"Column11", type any}, {"Column12", type any}, {"Column13", type any}, {"Column14", type any}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type1",{{"NDT STATUS", "Ferrite Test Completed"}, {"Column5", "PMI Completed"}, {"Column6", "PT Completed"}, {"Column7", "RT Completed"}}),
    #"Removed Columns" = Table.RemoveColumns(#"Renamed Columns",{"Column11", "Column12", "Column13", "Column14"}),
    #"Removed Top Rows1" = Table.Skip(#"Removed Columns",1),
    #"Replaced Value" = Table.ReplaceValue(#"Removed Top Rows1",null,0,Replacer.ReplaceValue,{"Threaded Joints"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Replaced Value",{{"Threaded Joints", Int64.Type}}),
    #"Removed Bottom Rows" = Table.RemoveLastN(#"Changed Type2",1),
    #"Filtered Rows1" = Table.SelectRows(#"Removed Bottom Rows", each ([#"No. of Joints Welded "] <> null)),
    #"Replaced Value1" = Table.ReplaceValue(#"Filtered Rows1",null,0,Replacer.ReplaceValue,{"No. of Joints Welded "}),
    #"Replaced Value2" = Table.ReplaceValue(#"Replaced Value1",null,0,Replacer.ReplaceValue,{"Ferrite Test Completed"}),
    #"Replaced Value3" = Table.ReplaceValue(#"Replaced Value2",null,0,Replacer.ReplaceValue,{"PMI Completed"}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Replaced Value3",{{"PMI Completed", Int64.Type}, {"Ferrite Test Completed", Int64.Type}}),
    #"Replaced Value4" = Table.ReplaceValue(#"Changed Type3",null,0,Replacer.ReplaceValue,{"RT Completed"}),
    #"Changed Type4" = Table.TransformColumnTypes(#"Replaced Value4",{{"RT Completed", Int64.Type}}),
    #"Replaced Value5" = Table.ReplaceValue(#"Changed Type4",null,0,Replacer.ReplaceValue,{"PT Completed"}),
    #"Filtered Rows" = Table.SelectRows(#"Replaced Value5", each ([Material] <> "Grand Total ==>"))
in
    #"Filtered Rows"
```

### `CUM FILE Welders Performance 2 Weeks`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\CUM FILE Welders Performance For Graphic\CUM FILE Welders Performance.  Rejection Rate. Summary Status  2 Weeks Since RT Date .xlsx"), null, true),
    #"CUM FILE Welders Performance_Sheet" = Source{[Item="CUM FILE Welders Performance",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"CUM FILE Welders Performance_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Date", type date}, {"Row Index Column", Int64.Type}, {"Week_Start_Date", type date}, {"Weeknum", type text}, {"Week_End_Date", type date}, {"2 Weeks Period", type text}, {"Last_RT Date ""PR all""", type date}, {"Sub-Contractor", type text}, {"STATUS", type text}, {"Welder ID", type text}, {"RT Film Ratio % ""PR all"" For Welder LAST 2 WEEKS", type number}, {"Count of Welder ID", Int64.Type}})
in
    #"Changed Type"
```

### `WEEK #   STATUS`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Welders\Welders Power Q for PBI .xlsx"), null, true),
    #"WEEK #   STATUS_Sheet" = Source{[Item="WEEK #   STATUS",Kind="Sheet"]}[Data],
    #"Removed Top Rows" = Table.Skip(#"WEEK #   STATUS_Sheet",1),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Removed Bottom Rows" = Table.RemoveLastN(#"Promoted Headers",1),
    #"Changed Type" = Table.TransformColumnTypes(#"Removed Bottom Rows",{{"GAC", Int64.Type}, {"MEDGULF", Int64.Type}, {"TEKFEN", Int64.Type}, {"CCC", Int64.Type}, {"ACCIONA", Int64.Type}, {"INCO", Int64.Type}, {"TOTAL", Int64.Type}})
in
    #"Changed Type"
```

### `CUM WEEK # Status`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\viktor.savin\OneDrive - Chiyoda Technip Joint Venture\Desktop\PCI Work File\WORK FILES\Welders\Welders Power Q for PBI .xlsx"), null, true),
    #"CUM WEEK # Status_Sheet" = Source{[Item="CUM WEEK # Status",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"CUM WEEK # Status_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"PERIOD", type text}, {"WEEK", type text}, {"S.No", Int64.Type}, {"Welders Qualification Status Summary Report", type text}, {"GAC", Int64.Type}, {"MEDGULF", Int64.Type}, {"TEKFEN", Int64.Type}, {"CCC", Int64.Type}, {"ACCIONA", Int64.Type}, {"INCO", Int64.Type}, {"TOTAL ", Int64.Type}})
in
    #"Changed Type"
```

### `Weld Length`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Weld Length\Weld Length.xlsx"), null, true),
    Sheet1_Sheet = Source{[Item="Sheet1",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Sheet1_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Weld Type", type text}, {"Dia inch", type number}, {"Weld Length", type number}})
in
    #"Changed Type"
```

### `TREND Report`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\CUM Trend file RT and PWHT\CUM Trend file RT and PWHT Backlog .xlsx"), null, true),
    TREND_Sheet = Source{[Item="TREND",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(TREND_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Date", type date}, {"Sub-Contractor", type text}, {"RT Backlog", Int64.Type}, {"PWHT Backlog All Types", Int64.Type}, {"PWHT Backlog For RT", Int64.Type}, {"RT BACKLOG & PWHT ""Y"" Done + ""N""", Int64.Type}, {"RT BACKLOG & PWHT Not Done", Int64.Type}, {"PWHT BACKLOG RT NOT Done (SG+TMCP)", Int64.Type}})
in
    #"Changed Type"
```

### `AllTrain_CSVExport_Joint Record NOT WELDED`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\PCI CCC  PBI WORK FILES\AllTrain_CSVExport_Joint Record.csv"),[Delimiter=",", Columns=143, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Replaced 0:00:00 2" = Table.ReplaceValue(#"Promoted Headers","0:00:00","",Replacer.ReplaceText,{"Weld Date"}),
    #"Replaced 0:00:00 3" = Table.ReplaceValue(#"Replaced 0:00:00 2","0:00:00","",Replacer.ReplaceText,{"RT/UT Date"}),
    #"Replaced 0:00:00 4" = Table.ReplaceValue(#"Replaced 0:00:00 3","0:00:00","",Replacer.ReplaceText,{"PT Root Date"}),
    #"Replaced 0:00:00 5" = Table.ReplaceValue(#"Replaced 0:00:00 4","0:00:00","",Replacer.ReplaceText,{"MT Root Date"}),
    #"Replaced 0:00:00 6" = Table.ReplaceValue(#"Replaced 0:00:00 5","0:00:00","",Replacer.ReplaceText,{"PWHT Date"}),
    #"Replaced 0:00:00 7" = Table.ReplaceValue(#"Replaced 0:00:00 6","0:00:00","",Replacer.ReplaceText,{"HT Date"}),
    #"Replaced 0:00:00 8" = Table.ReplaceValue(#"Replaced 0:00:00 7","0:00:00","",Replacer.ReplaceText,{"PMI Date"}),
    #"Replaced 0:00:00 9" = Table.ReplaceValue(#"Replaced 0:00:00 8","0:00:00","",Replacer.ReplaceText,{"PMI Up Date"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced 0:00:00 9",{{"Del Flag", type text}, {"Weld Point First", type text}, {"Original Joint", type text}, {"Latest Joint", type text}, {"Project No", Int64.Type}, {"Sub-Con Code", type text}, {"Area Code", type text}, {"Area Group-1", type text}, {"Area Group-2", type text}, {"Area Group-3", type text}, {"Area Group-4", type text}, {"Area Group-5", type text}, {"QC ISO DWG No", type text}, {"Sheet No", Int64.Type}, {"Repair Suffix", type text}, {"Spool No", type text}, {"Revision No", type text}, {"Rework Code", type text}, {"Rework Code2", type text}, {"Rework Ref Doc No", type text}, {"Tracer Shot", type text}, {"Service Class", type text}, {"Pressure Level", type text}, {"Size-2", type number}, {"Size Range", type text}, {"Dia-Inch", type number}, {"Wall Thickness", type number}, {"Material Category", type text}, {"P No", Int64.Type}, {"Material Spec", type text}, {"Pipe Schedule", type text}, {"Design Code", type text}, {"Work Category", type text}, {"Original Work Category", type text}, {"Weld Type", type text}, {"NDT Remarks", type text}, {"Test Package No", type text}, {"Sub-System No", type text}, {"Remarks", type text}, {"Weld Report No", type text}, {"Weld Date", type date}, {"Weld Week", type text}, {"Weld Month", type text}, {"Welder(Root)", type text}, {"Welder(Heat)", type text}, {"Welder(Fill)", type text}, {"Welder(Cap)", type text}, {"EP Date", type text}, {"EP Judge", type text}, {"EP Identifier Date", type text}, {"EP Identifier Client", type text}, {"EP Identifier Chiyoda", type text}, {"VI Date", type text}, {"VI Judge", type text}, {"VI Identifier Client", type text}, {"VI Identifier Chiyoda", type text}, {"WT Measurement Data", type text}, {"WT Date", type text}, {"RT/UT", type text}, {"RT/UT Report No", type text}, {"RT Film Total", Int64.Type}, {"RT/UT Date", type date}, {"RT/UT(%)", Int64.Type}, {"RT/UT Request Date", type text}, {"RT/UT Result", type text}, {"Reshoot-1 RT/UT Report No", type text}, {"Reshoot-1 RT Film Total", type text}, {"Reshoot-1 RT/UT Date", type text}, {"Reshoot-1 RT/UT Result", type text}, {"Reshoot-2 RT/UT Report No", type text}, {"Reshoot-2 RT Film Total", type text}, {"Reshoot-2 RT/UT Date", type text}, {"Reshoot-2 RT/UT Result", type text}, {"Reshoot-3 RT/UT Report No", type text}, {"Reshoot-3 RT Film Total", type text}, {"Reshoot-3 RT/UT Date", type text}, {"Reshoot-3 RT/UT Result", type text}, {"Reshoot RT/UT Total", type text}, {"Reshoot RT/UT Film Total", type text}, {"Last Reshoot Date (RT/UT)", type text}, {"Last Reshoot Report No (RT/UT)", type text}, {"Last Reshoot Result (RT/UT)", type text}, {"RT2/UT2", type text}, {"RT2/UT2 Report No", type text}, {"RT2 Film Total", type text}, {"RT2/UT2 Date", type text}, {"RT2/UT2(%)", Int64.Type}, {"RT2/UT2 Request Date", type text}, {"RT2/UT2 Result", type text}, {"Reshoot-1 RT2/UT2 Report No", type text}, {"Reshoot-1 RT2 Film Total", type text}, {"Reshoot-1 RT2/UT2 Date", type text}, {"Reshoot-1 RT2/UT2 Result", type text}, {"Reshoot-2 RT2/UT2 Report No", type text}, {"Reshoot-2 RT2 Film Total", type text}, {"Reshoot-2 RT2/UT2 Date", type text}, {"Reshoot-2 RT2/UT2 Result", type text}, {"Reshoot-3 RT2/UT2 Report No", type text}, {"Reshoot-3 RT2 Film Total", type text}, {"Reshoot-3 RT2/UT2 Date", type text}, {"Reshoot-3 RT2/UT2 Result", type text}, {"Reshoot RT2/UT2 Total", type text}, {"Reshoot RT2/UT2 Film Total", type text}, {"Last Reshoot Date (RT2/UT2)", type text}, {"Last Reshoot Report No (RT2/UT2)", type text}, {"Last Reshoot Result (RT2/UT2)", type text}, {"PT Root Report No", type text}, {"PT Root Date", type date}, {"PT Root(%)", Int64.Type}, {"PT Root Request Date", type text}, {"PT Cap Report No", type text}, {"PT Cap Date", type text}, {"PT Cap(%)", Int64.Type}, {"PT Cap Request Date", type text}, {"MT Root Report No", type text}, {"MT Root Date", type date}, {"MT Root(%)", Int64.Type}, {"MT Root Request Date", type text}, {"MT Cap Report No", type text}, {"MT Cap Date", type text}, {"MT Cap(%)", Int64.Type}, {"MT Cap Request Date", type text}, {"PWHT Report No", type text}, {"PWHT Date", type text}, {"PWHT", type text}, {"PWHT Request Date", type text}, {"HT Report No", type text}, {"HT Date", type text}, {"HT(%)", type text}, {"HT Request Date", type text}, {"PMI Report No", type text}, {"PMI Date", type date}, {"PMI(%)", type text}, {"PMI Request Date", type text}, {"PMI Up Report No", type text}, {"PMI Up Date", type text}, {"PMI Down Report No", type text}, {"PMI Down Date", type text}, {"FT Report No", type text}, {"FT Date", type text}, {"FT(%)", type text}, {"FT Request Date", type text}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Changed Type",{{"Joint No", type text}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type1", each ([Del Flag] = "")),
    #"Spool ID" = Table.AddColumn(#"Filtered Rows", "Spool ID", each [#"QC ISO DWG No"]&"-"&[#"Spool No"]),
    #"Replaced Value" = Table.ReplaceValue(#"Spool ID","R01","R1",Replacer.ReplaceText,{"Repair Suffix"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value","R02","R2",Replacer.ReplaceText,{"Repair Suffix"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Replaced Value1",{{"PWHT Date", type date}}),
    #"Joint ID" = Table.AddColumn(#"Changed Type2", "Joint ID", each [#"QC ISO DWG No"]&"-"&[#"Spool No"]&"-"&[#"Joint No"]&""&[Repair Suffix]),
    #"Changed Type3" = Table.TransformColumnTypes(#"Joint ID",{{"Joint ID", type text}}),
    #"Filtered Rows1" = Table.SelectRows(#"Changed Type3", each ([Weld Date] = null)),
    #"Reordered Columns" = Table.ReorderColumns(#"Filtered Rows1",{"Joint ID", "Spool ID", "QC ISO DWG No", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "Area Code", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Joint No", "Repair Suffix", "Spool No", "Revision No", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Dia-Inch", "Wall Thickness", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Work Category", "Original Work Category", "Weld Type", "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns" = Table.RenameColumns(#"Reordered Columns",{{"QC ISO DWG No", "ISO Number"}}),
    #"Reordered Columns1" = Table.ReorderColumns(#"Renamed Columns",{"Joint ID", "Spool ID", "ISO Number", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "Area Code", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Joint No", "Repair Suffix", "Spool No", "Revision No", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Dia-Inch", "Wall Thickness", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Work Category", "Original Work Category", "Weld Type", "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Reordered Columns1",{{"Revision No", "Iso Rev No"}}),
    #"Reordered Columns2" = Table.ReorderColumns(#"Renamed Columns1",{"Joint ID", "Spool ID", "ISO Number", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "Area Code", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Joint No", "Repair Suffix", "Spool No", "Iso Rev No", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Dia-Inch", "Wall Thickness", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Work Category", "Original Work Category", "Weld Type", "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns2" = Table.RenameColumns(#"Reordered Columns2",{{"Joint No", "Weld No."}}),
    #"Added Custom" = Table.AddColumn(#"Renamed Columns2", "Spool Rev No.", each ""),
    #"Reordered Columns3" = Table.ReorderColumns(#"Added Custom",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Work Category", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "Area Code", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Dia-Inch", "Wall Thickness", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "Weld Type", "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns3" = Table.RenameColumns(#"Reordered Columns3",{{"Work Category", "Weld Cat"}}),
    #"Reordered Columns4" = Table.ReorderColumns(#"Renamed Columns3",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "Area Code", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Dia-Inch", "Wall Thickness", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Dia Inch Factor" = Table.AddColumn(#"Reordered Columns4", "Dia Inch Factor", each if [Weld Type] = "BW" or [Weld Type] = "CLET" then "Y" else "N"),
    #"Reordered Columns5" = Table.ReorderColumns(#"Dia Inch Factor",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia-Inch", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "Area Code", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Wall Thickness", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns4" = Table.RenameColumns(#"Reordered Columns5",{{"Dia-Inch", "Dia inch"}}),
    #"Reordered Columns6" = Table.ReorderColumns(#"Renamed Columns4",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Wall Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "Area Code", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns5" = Table.RenameColumns(#"Reordered Columns6",{{"Wall Thickness", "Thickness"}}),
    #"Reordered Columns7" = Table.ReorderColumns(#"Renamed Columns5",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "Area Code", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns6" = Table.RenameColumns(#"Reordered Columns7",{{"Area Code", "PDS Area"}}),
    #"Reordered Columns8" = Table.ReorderColumns(#"Renamed Columns6",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "PDS Area", "Area Group-1", "Area Group-2", "Area Group-3", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns7" = Table.RenameColumns(#"Reordered Columns8",{{"Area Group-3", "AG/UG/PKG"}}),
    #"Reordered Columns9" = Table.ReorderColumns(#"Renamed Columns7",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "PDS Area", "Area Group-1", "Area Group-2", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns8" = Table.RenameColumns(#"Reordered Columns9",{{"Area Group-2", "Area Classification"}}),
    wbu = Table.AddColumn(#"Renamed Columns8", "wbu", each ""),
    #"System no" = Table.AddColumn(wbu, "System no", each ""),
    #"Reordered Columns10" = Table.ReorderColumns(#"System no",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "PDS Area", "Area Group-1", "Area Classification", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Test Package No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Testpack No" = Table.RenameColumns(#"Reordered Columns10",{{"Test Package No", "Testpack No"}}),
    #"Reordered Columns11" = Table.ReorderColumns(#"Testpack No",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "PDS Area", "Area Group-1", "Area Classification", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Testpack No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Added Custom1" = Table.AddColumn(#"Reordered Columns11", "Service Cat", each ""),
    #"Reordered Columns12" = Table.ReorderColumns(#"Added Custom1",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "PDS Area", "Area Group-1", "Area Classification", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Category", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Testpack No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns9" = Table.RenameColumns(#"Reordered Columns12",{{"Material Category", "Material Type"}}),
    #"MIR No" = Table.AddColumn(#"Renamed Columns9", "MIR No", each ""),
    #"Added Custom3" = Table.AddColumn(#"MIR No", "MIR Date", each ""),
    #"Added Custom4" = Table.AddColumn(#"Added Custom3", "Cutting Date", each ""),
    #"Added Custom5" = Table.AddColumn(#"Added Custom4", "Beveling Date", each ""),
    #"Added Custom6" = Table.AddColumn(#"Added Custom5", "Fitup Date", each ""),
    #"Preheat Date" = Table.AddColumn(#"Added Custom6", "Preheat Date", each ""),
    #"Reordered Columns13" = Table.ReorderColumns(#"Preheat Date",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "PDS Area", "Area Group-1", "Area Classification", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Type", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Testpack No", "Sub-System No", "Remarks", "Weld Report No", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns10" = Table.RenameColumns(#"Reordered Columns13",{{"Weld Report No", "DWIR No."}}),
    #"Reordered Columns14" = Table.ReorderColumns(#"Renamed Columns10",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Con Code", "PDS Area", "Area Group-1", "Area Classification", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Type", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Testpack No", "Sub-System No", "Remarks", "DWIR No.", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns11" = Table.RenameColumns(#"Reordered Columns14",{{"Sub-Con Code", "Sub-Contractor"}}),
    #"Reordered Columns15" = Table.ReorderColumns(#"Renamed Columns11",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Contractor", "PDS Area", "Area Group-1", "Area Classification", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Type", "P No", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Testpack No", "Sub-System No", "Remarks", "DWIR No.", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns12" = Table.RenameColumns(#"Reordered Columns15",{{"P No", "WeldPoint No."}}),
    #"Added Custom2" = Table.AddColumn(#"Renamed Columns12", "Weld Point Code", each ""),
    #"Reordered Columns16" = Table.ReorderColumns(#"Added Custom2",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Contractor", "PDS Area", "Area Group-1", "Area Classification", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Type", "WeldPoint No.", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Testpack No", "Sub-System No", "Remarks", "DWIR No.", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"WPS No." = Table.AddColumn(#"Reordered Columns16", "WPS No.", each ""),
    #"Reordered Columns17" = Table.ReorderColumns(#"WPS No.",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "Del Flag", "Weld Point First", "Original Joint", "Latest Joint", "Project No", "Sub-Contractor", "PDS Area", "Area Group-1", "Area Classification", "AG/UG/PKG", "Area Group-4", "Area Group-5", "Sheet No", "Repair Suffix", "Rework Code", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Service Class", "Pressure Level", "Size-2", "Size Range", "Material Type", "WeldPoint No.", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category",  "NDT Remarks", "Testpack No", "Sub-System No", "Remarks", "DWIR No.", "Weld Date", "Weld Week", "Weld Month", "Welder(Root)", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "PWHT Report No", "PWHT Date", "PWHT", "PWHT Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns13" = Table.RenameColumns(#"Reordered Columns17",{{"Welder(Root)", "Welder"}}),
    #"Removed Columns" = Table.RemoveColumns(#"Renamed Columns13",{"Weld Week", "Weld Month", "Welder(Heat)", "Welder(Fill)", "Welder(Cap)", "EP Date", "EP Judge", "EP Identifier Date", "EP Identifier Client", "EP Identifier Chiyoda", "VI Date", "VI Judge", "VI Identifier Client", "VI Identifier Chiyoda", "WT Measurement Data", "WT Date", "Reshoot-1 RT/UT Report No", "Reshoot-1 RT Film Total", "Reshoot-1 RT/UT Date", "Reshoot-1 RT/UT Result", "Reshoot-2 RT/UT Report No", "Reshoot-2 RT Film Total", "Reshoot-2 RT/UT Date", "Reshoot-2 RT/UT Result", "Reshoot-3 RT/UT Report No", "Reshoot-3 RT Film Total", "Reshoot-3 RT/UT Date", "Reshoot-3 RT/UT Result", "Reshoot RT/UT Total", "Reshoot RT/UT Film Total", "Last Reshoot Date (RT/UT)", "Last Reshoot Report No (RT/UT)", "Last Reshoot Result (RT/UT)", "RT2/UT2", "RT2/UT2 Report No", "RT2 Film Total", "RT2/UT2 Date", "RT2/UT2(%)", "RT2/UT2 Request Date", "RT2/UT2 Result", "Reshoot-1 RT2/UT2 Report No", "Reshoot-1 RT2 Film Total", "Reshoot-1 RT2/UT2 Date", "Reshoot-1 RT2/UT2 Result", "Reshoot-2 RT2/UT2 Report No", "Reshoot-2 RT2 Film Total", "Reshoot-2 RT2/UT2 Date", "Reshoot-2 RT2/UT2 Result", "Reshoot-3 RT2/UT2 Report No", "Reshoot-3 RT2 Film Total", "Reshoot-3 RT2/UT2 Date", "Reshoot-3 RT2/UT2 Result", "Reshoot RT2/UT2 Total", "Reshoot RT2/UT2 Film Total", "Last Reshoot Date (RT2/UT2)", "Last Reshoot Report No (RT2/UT2)", "Last Reshoot Result (RT2/UT2)"}),
    #"Reordered Columns18" = Table.ReorderColumns(#"Removed Columns",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT", "PWHT Report No", "PWHT Date", "PWHT Request Date", "Del Flag", "Weld Point First", "Latest Joint", "Project No", "Area Group-1", "Area Group-4", "Area Group-5", "Sheet No", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Pressure Level", "Size-2", "Size Range", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"PWHT Y/N Rename" = Table.RenameColumns(#"Reordered Columns18",{{"PWHT", "PWHT Y/N"}, {"PWHT Report No", "PWHT Report"}}),
    #"Reordered Columns19" = Table.ReorderColumns(#"PWHT Y/N Rename",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Request Date", "Del Flag", "Weld Point First", "Latest Joint", "Project No", "Area Group-1", "Area Group-4", "Area Group-5", "Sheet No", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Pressure Level", "Size-2", "Size Range", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns14" = Table.RenameColumns(#"Reordered Columns19",{{"PWHT Request Date", "PWHT Exam Req date"}}),
    #"Added Custom7" = Table.AddColumn(#"Renamed Columns14", "PWHT Weld Status", each ""),
    #"Added Custom8" = Table.AddColumn(#"Added Custom7", "PWHT Selected Date", each ""),
    #"Added Custom9" = Table.AddColumn(#"Added Custom8", "PWHT Acc/Rej", each ""),
    #"Added Custom10" = Table.AddColumn(#"Added Custom9", "PWHT Client Exam Req Y/N", each ""),
    #"Added Custom11" = Table.AddColumn(#"Added Custom10", "PWHT Remarks", each ""),
    #"Reordered Columns20" = Table.ReorderColumns(#"Added Custom11",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Project No", "Area Group-1", "Area Group-4", "Area Group-5", "Sheet No", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Pressure Level", "Size-2", "Size Range", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report No", "HT Date", "HT(%)", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns15" = Table.RenameColumns(#"Reordered Columns20",{{"HT(%)", "HT%"}}),
    #"Reordered Columns21" = Table.ReorderColumns(#"Renamed Columns15",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Project No", "Area Group-1", "Area Group-4", "Area Group-5", "Sheet No", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Pressure Level", "Size-2", "Size Range", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report No", "HT Date", "HT%", "HT Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns16" = Table.RenameColumns(#"Reordered Columns21",{{"HT Request Date", "HT Selected Date"}, {"HT Report No", "HT Report"}}),
    #"Reordered Columns22" = Table.ReorderColumns(#"Renamed Columns16",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Project No", "Area Group-1", "Area Group-4", "Area Group-5", "Sheet No", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Pressure Level", "Size-2", "Size Range", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Added Custom12" = Table.AddColumn(#"Reordered Columns22", "HT Batch No", each ""),
    #"Added Custom13" = Table.AddColumn(#"Added Custom12", "HT Batch Status", each ""),
    #"Added Custom14" = Table.AddColumn(#"Added Custom13", "HT Weld Status", each ""),
    #"Added Custom15" = Table.AddColumn(#"Added Custom14", "HT Exam Req date", each ""),
    #"Added Custom16" = Table.AddColumn(#"Added Custom15", "HT Acc/Rej", each ""),
    #"Added Custom17" = Table.AddColumn(#"Added Custom16", "HT Client Exam Req Y/N", each ""),
    #"Reordered Columns23" = Table.ReorderColumns(#"Added Custom17",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Project No", "Area Group-1", "Area Group-4", "Area Group-5", "Sheet No", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Pressure Level", "Size-2", "Size Range", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Changed Type4" = Table.TransformColumnTypes(#"Reordered Columns23",{{"HT Selected Date", type date}, {"HT Exam Req date", type date}, {"HT Date", type date}}),
    #"Added Custom18" = Table.AddColumn(#"Changed Type4", "HT Remarks", each ""),
    #"Reordered Columns24" = Table.ReorderColumns(#"Added Custom18",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Project No", "Area Group-1", "Area Group-4", "Area Group-5", "Sheet No", "Rework Code2", "Rework Ref Doc No", "Tracer Shot", "Pressure Level", "Size-2", "Size Range", "Material Spec", "Pipe Schedule", "Design Code", "Original Work Category", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT/UT(%)", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns17" = Table.RenameColumns(#"Reordered Columns24",{{"RT/UT(%)", "RT%"}}),
    #"Added Custom19" = Table.AddColumn(#"Renamed Columns17", "RT Batch No", each ""),
    #"Added Custom20" = Table.AddColumn(#"Added Custom19", "RT Batch Status", each ""),
    #"Added Custom21" = Table.AddColumn(#"Added Custom20", "RT Weld Status", each ""),
    #"Added Custom22" = Table.AddColumn(#"Added Custom21", "RT Selected Date", each ""),
    #"Removed Columns1" = Table.RemoveColumns(#"Added Custom22",{"Original Work Category", "Size-2", "Size Range", "Pipe Schedule", "Rework Ref Doc No", "Rework Code2", "Sheet No", "Area Group-5", "Area Group-4", "Area Group-1", "Project No"}),
    #"Reordered Columns25" = Table.ReorderColumns(#"Removed Columns1",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Tracer Shot", "Pressure Level", "Material Spec", "Design Code", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT%", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Changed Type5" = Table.TransformColumnTypes(#"Reordered Columns25",{{"RT Selected Date", type date}}),
    #"Reordered Columns26" = Table.ReorderColumns(#"Changed Type5",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Tracer Shot", "Pressure Level", "Material Spec", "Design Code", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT%", "RT/UT Request Date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns18" = Table.RenameColumns(#"Reordered Columns26",{{"RT/UT Request Date", "RT Exam Req date"}}),
    #"Changed Type6" = Table.TransformColumnTypes(#"Renamed Columns18",{{"RT Exam Req date", type date}}),
    #"Reordered Columns27" = Table.ReorderColumns(#"Changed Type6",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Tracer Shot", "Pressure Level", "Material Spec", "Design Code", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT/UT Date", "RT%", "RT Exam Req date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns19" = Table.RenameColumns(#"Reordered Columns27",{{"RT/UT Date", "RT Date"}}),
    #"Added Custom23" = Table.AddColumn(#"Renamed Columns19", "RT Xray No", each ""),
    #"Reordered Columns28" = Table.ReorderColumns(#"Added Custom23",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Tracer Shot", "Pressure Level", "Material Spec", "Design Code", "Sub-System No", "Remarks", "RT/UT", "RT/UT Report No", "RT Film Total", "RT Date", "RT%", "RT Exam Req date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns20" = Table.RenameColumns(#"Reordered Columns28",{{"RT/UT Report No", "RT Report"}}),
    #"Reordered Columns29" = Table.ReorderColumns(#"Renamed Columns20",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Tracer Shot", "Pressure Level", "Material Spec", "Design Code", "Sub-System No", "Remarks", "RT/UT", "RT Report", "RT Film Total", "RT Date", "RT%", "RT Exam Req date", "RT/UT Result", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Renamed Columns21" = Table.RenameColumns(#"Reordered Columns29",{{"RT/UT Result", "RT Acc/Rej"}}),
    #"Added Custom24" = Table.AddColumn(#"Renamed Columns21", "Total No of films Acc", each ""),
    #"Added Custom25" = Table.AddColumn(#"Added Custom24", "Total No of films Rej", each ""),
    #"Reordered Columns30" = Table.ReorderColumns(#"Added Custom25",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Tracer Shot", "Pressure Level", "Material Spec", "Design Code", "Sub-System No", "Remarks", "RT/UT", "RT Report", "RT Film Total", "RT Date", "RT%", "RT Exam Req date", "RT Acc/Rej", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Defect Code" = Table.AddColumn(#"Reordered Columns30", "Defect Code", each ""),
    #"Added Custom26" = Table.AddColumn(#"Defect Code", "Location of Defect", each ""),
    #"Added Custom27" = Table.AddColumn(#"Added Custom26", "RT Re-Shoot Rep", each ""),
    #"Added Custom28" = Table.AddColumn(#"Added Custom27", "RT Re-Shoot Data", each ""),
    #"Added Custom29" = Table.AddColumn(#"Added Custom28", "RT Re-Shoot Status", each ""),
    #"Added Custom30" = Table.AddColumn(#"Added Custom29", "RT Re-Shoot Reason", each ""),
    #"Added Custom31" = Table.AddColumn(#"Added Custom30", "RT Re-Shoot Films", each ""),
    #"Added Custom32" = Table.AddColumn(#"Added Custom31", "Weld Length", each ""),
    #"Added Custom33" = Table.AddColumn(#"Added Custom32", "Rej Length", each ""),
    #"Added Custom34" = Table.AddColumn(#"Added Custom33", "RT Client Exam Req Y/N", each ""),
    #"By UT" = Table.AddColumn(#"Added Custom34", "By UT", each ""),
    #"Added UT%" = Table.AddColumn(#"By UT", "UT%", each ""),
#"Added UT Batch No" = Table.AddColumn(#"Added UT%", "UT Batch No", each ""),
#"Added UT Batch Status" = Table.AddColumn(#"Added UT Batch No", "UT Batch Status", each ""),
#"Added UT Weld Status" = Table.AddColumn(#"Added UT Batch Status", "UT Weld Status", each ""),
#"Added UT Selected Date" = Table.AddColumn(#"Added UT Weld Status", "UT Selected Date", each ""),
#"Added UT Exam Req date" = Table.AddColumn(#"Added UT Selected Date", "UT Exam Req date", each ""),
#"Added UT Date" = Table.AddColumn(#"Added UT Exam Req date", "UT Date", each ""),
#"Added UT Report" = Table.AddColumn(#"Added UT Date", "UT Report", each ""),
#"Added UT Acc/Rej" = Table.AddColumn(#"Added UT Report", "UT Acc/Rej", each ""),
#"Added UT Client Exam Req Y/N" = Table.AddColumn(#"Added UT Acc/Rej", "UT Client Exam Req Y/N", each ""),
#"Added UT Remarks" = Table.AddColumn(#"Added UT Client Exam Req Y/N", "UT Remarks", each ""),
#"Added MT%" = Table.AddColumn(#"Added UT Remarks", "MT%", each ""),
#"Added MT Batch No" = Table.AddColumn(#"Added MT%", "MT Batch No", each ""),
#"Added MT Batch Status" = Table.AddColumn(#"Added MT Batch No", "MT Batch Status", each ""),
#"Added MT Weld Status" = Table.AddColumn(#"Added MT Batch Status", "MT Weld Status", each ""),
#"Added MT Selected Date" = Table.AddColumn(#"Added MT Weld Status", "MT Selected Date", each ""),
#"Added MT Exam Req date" = Table.AddColumn(#"Added MT Selected Date", "MT Exam Req date", each ""),
#"Added MT Date" = Table.AddColumn(#"Added MT Exam Req date", "MT Date", each ""),
#"Added MT Report" = Table.AddColumn(#"Added MT Date", "MT Report", each ""),
#"Added MT Acc/Rej" = Table.AddColumn(#"Added MT Report", "MT Acc/Rej", each ""),
#"Added MT Client Exam Req Y/N" = Table.AddColumn(#"Added MT Acc/Rej", "MT Client Exam Req Y/N", each ""),
#"Added MT Remarks" = Table.AddColumn(#"Added MT Client Exam Req Y/N", "MT Remarks", each ""),
#"Added PMI%" = Table.AddColumn(#"Added MT Remarks", "PMI%", each ""),
#"Added PMI Batch No" = Table.AddColumn(#"Added PMI%", "PMI Batch No", each ""),
#"Added PMI Batch Status" = Table.AddColumn(#"Added PMI Batch No", "PMI Batch Status", each ""),
#"Added PMI Weld Status" = Table.AddColumn(#"Added PMI Batch Status", "PMI Weld Status", each ""),
#"Added PMI Selected Date" = Table.AddColumn(#"Added PMI Weld Status", "PMI Selected Date", each ""),
#"Added PMI Exam Req date" = Table.AddColumn(#"Added PMI Selected Date", "PMI Exam Req date", each ""),
#"Added PMI Client Exam Req Y/N" = Table.AddColumn(#"Added PMI Exam Req date", "PMI Client Exam Req Y/N", each ""),
#"Added PMI Remarks" = Table.AddColumn(#"Added PMI Client Exam Req Y/N", "PMI Remarks", each ""),
#"Added PT%" = Table.AddColumn(#"Added PMI Remarks", "PT%", each ""),
#"Added PT Batch No" = Table.AddColumn(#"Added PT%", "PT Batch No", each ""),
#"Added PT Batch Status" = Table.AddColumn(#"Added PT Batch No", "PT Batch Status", each ""),
#"Added PT Weld Status" = Table.AddColumn(#"Added PT Batch Status", "PT Weld Status", each ""),
#"Added PT Selected Date" = Table.AddColumn(#"Added PT Weld Status", "PT Selected Date", each ""),
#"Added PT Exam Req date" = Table.AddColumn(#"Added PT Selected Date", "PT Exam Req date", each ""),
#"Added PT Client Exam Req Y/N" = Table.AddColumn(#"Added PT Exam Req date", "PT Client Exam Req Y/N", each ""),
#"Added PT Remarks" = Table.AddColumn(#"Added PT Client Exam Req Y/N", "PT Remarks", each ""),
#"Added FN%" = Table.AddColumn(#"Added PT Remarks", "FN%", each ""),
#"Added FN Batch No" = Table.AddColumn(#"Added FN%", "FN Batch No", each ""),
#"Added FN Batch Status" = Table.AddColumn(#"Added FN Batch No", "FN Batch Status", each ""),
#"Added FN Weld Status" = Table.AddColumn(#"Added FN Batch Status", "FN Weld Status", each ""),
#"Added FN Selected Date" = Table.AddColumn(#"Added FN Weld Status", "FN Selected Date", each ""),
#"Added FN Exam Req date" = Table.AddColumn(#"Added FN Selected Date", "FN Exam Req date", each ""),
#"Added FN Date" = Table.AddColumn(#"Added FN Exam Req date", "FN Date", each ""),
#"Added FN Report" = Table.AddColumn(#"Added FN Date", "FN Report", each ""),
#"Added FN Acc/Rej" = Table.AddColumn(#"Added FN Report", "FN Acc/Rej", each ""),
#"Added FN Client Exam Req Y/N" = Table.AddColumn(#"Added FN Acc/Rej", "FN Client Exam Req Y/N", each ""),
#"Added FN Remarks" = Table.AddColumn(#"Added FN Client Exam Req Y/N", "FN Remarks", each ""),
#"Added PADLT Y/N" = Table.AddColumn(#"Added FN Remarks", "PADLT Y/N", each ""),
#"Added PADLT Weld Status" = Table.AddColumn(#"Added PADLT Y/N", "PADLT Weld Status", each ""),
#"Added PADLT Selected Date" = Table.AddColumn(#"Added PADLT Weld Status", "PADLT Selected Date", each ""),
#"Added PADLT Exam Req date" = Table.AddColumn(#"Added PADLT Selected Date", "PADLT Exam Req date", each ""),
#"Added PADLT Date" = Table.AddColumn(#"Added PADLT Exam Req date", "PADLT Date", each ""),
#"Added PADLT Report" = Table.AddColumn(#"Added PADLT Date", "PADLT Report", each ""),
#"Added PADLT Acc/Rej" = Table.AddColumn(#"Added PADLT Report", "PADLT Acc/Rej", each ""),
#"Added PADLT Client Exam Req Y/N" = Table.AddColumn(#"Added PADLT Acc/Rej", "PADLT Client Exam Req Y/N", each ""),
#"Added PADLT Remarks" = Table.AddColumn(#"Added PADLT Client Exam Req Y/N", "PADLT Remarks", each ""),
#"Added ORIF Y/N" = Table.AddColumn(#"Added PADLT Remarks", "ORIF Y/N", each ""),
#"Added ORIF Weld Status" = Table.AddColumn(#"Added ORIF Y/N", "ORIF Weld Status", each ""),
#"Added ORIF Selected Date" = Table.AddColumn(#"Added ORIF Weld Status", "ORIF Selected Date", each ""),
#"Added ORIF Exam Req date" = Table.AddColumn(#"Added ORIF Selected Date", "ORIF Exam Req date", each ""),
#"Added ORIF Date" = Table.AddColumn(#"Added ORIF Exam Req date", "ORIF Date", each ""),
#"Added ORIF Report" = Table.AddColumn(#"Added ORIF Date", "ORIF Report", each ""),
#"Added ORIF Acc/Rej" = Table.AddColumn(#"Added ORIF Report", "ORIF Acc/Rej", each ""),
#"Added ORIF Client Exam Req Y/N" = Table.AddColumn(#"Added ORIF Acc/Rej", "ORIF Client Exam Req Y/N", each ""),
#"Added Matrl Traceability Y/N" = Table.AddColumn(#"Added ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", each ""),
#"Added GROUP-1" = Table.AddColumn(#"Added Matrl Traceability Y/N", "GROUP-1", each ""),
#"Added IDENT CODE-1" = Table.AddColumn(#"Added GROUP-1", "IDENT CODE-1", each ""),
#"Added TRAC NO-1" = Table.AddColumn(#"Added IDENT CODE-1", "TRAC NO-1", each ""),
#"Added GROUP-2" = Table.AddColumn(#"Added TRAC NO-1", "GROUP-2", each ""),
#"Added IDENT CODE-2" = Table.AddColumn(#"Added GROUP-2", "IDENT CODE-2", each ""),
#"Added TRAC NO-2" = Table.AddColumn(#"Added IDENT CODE-2", "TRAC NO-2", each ""),
#"Added Revision Status" = Table.AddColumn(#"Added TRAC NO-2", "Revision Status", each ""),
#"Added Revision Comments" = Table.AddColumn(#"Added Revision Status", "Revision Comments", each ""),
#"Added Hold Status" = Table.AddColumn(#"Added Revision Comments", "Hold Status", each ""),
#"Added Hold Comments" = Table.AddColumn(#"Added Hold Status", "Hold Comments", each ""),
#"Added Piping Group" = Table.AddColumn(#"Added Hold Comments", "Piping Group", each ""),
    #"Reordered Columns31" = Table.ReorderColumns(#"Added Piping Group",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Tracer Shot", "Pressure Level", "Material Spec", "Design Code", "Sub-System No", "Remarks", "RT/UT", "RT Report", "RT Film Total", "RT Date", "RT%", "RT Exam Req date", "RT Acc/Rej", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Added Custom35" = Table.AddColumn(#"Reordered Columns31", "RT Remarks", each ""),
    #"Reordered Columns32" = Table.ReorderColumns(#"Added Custom35",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Report", "PWHT Date", "PWHT Exam Req date", "Del Flag", "Weld Point First", "Latest Joint", "Tracer Shot", "Pressure Level", "Material Spec", "Design Code", "Sub-System No", "Remarks", "RT/UT", "RT Report", "RT Film Total", "RT Date", "RT%", "RT Exam Req date", "RT Acc/Rej", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "MT Root Report No", "MT Root Date", "MT Root(%)", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "HT Report", "HT Date", "HT%", "HT Selected Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date"}),
    #"Changed Type7" = Table.TransformColumnTypes(#"Reordered Columns32",{{"UT Selected Date", type date}, {"UT Exam Req date", type date}, {"UT Date", type date}}),
    #"Reordered Columns33" = Table.ReorderColumns(#"Changed Type7",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT Root(%)", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "MT Root Report No", "MT Root Date", "MT Root Request Date", "MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Removed Columns2" = Table.RemoveColumns(#"Reordered Columns33",{"MT Cap Report No", "MT Cap Date", "MT Cap(%)", "MT Cap Request Date", "MT%"}),
    #"Renamed Columns22" = Table.RenameColumns(#"Removed Columns2",{{"MT Root(%)", "MT%"}}),
    #"Reordered Columns34" = Table.ReorderColumns(#"Renamed Columns22",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "MT Root Report No", "MT Root Date", "MT Root Request Date", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Removed Columns3" = Table.RemoveColumns(#"Reordered Columns34",{"MT Report"}),
    #"Renamed Columns23" = Table.RenameColumns(#"Removed Columns3",{{"MT Root Report No", "MT Report"}}),
    #"Removed Columns4" = Table.RemoveColumns(#"Renamed Columns23",{"MT Date"}),
    #"Renamed Columns24" = Table.RenameColumns(#"Removed Columns4",{{"MT Root Date", "MT Date"}}),
    #"Reordered Columns35" = Table.ReorderColumns(#"Renamed Columns24",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "MT Root Request Date", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "PMI Down Report No", "PMI Down Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Removed Columns5" = Table.RemoveColumns(#"Reordered Columns35",{"MT Root Request Date", "PMI Down Report No", "PMI Down Date"}),
    #"Reordered Columns36" = Table.ReorderColumns(#"Removed Columns5",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI%", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Removed Columns6" = Table.RemoveColumns(#"Reordered Columns36",{"PMI%"}),
    #"Reordered Columns37" = Table.ReorderColumns(#"Removed Columns6",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "PMI Report No", "PMI Date", "PMI(%)", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Renamed Columns25" = Table.RenameColumns(#"Reordered Columns37",{{"PMI(%)", "PMI%"}}),
    #"Reordered Columns38" = Table.ReorderColumns(#"Renamed Columns25",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "PMI Report No", "PMI Date", "PMI%", "PMI Request Date", "PMI Up Report No", "PMI Up Date", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Renamed Columns26" = Table.RenameColumns(#"Reordered Columns38",{{"PMI Report No", "PMI Report"}}),
    #"Removed Columns7" = Table.RemoveColumns(#"Renamed Columns26",{"PMI Request Date", "PMI Up Report No", "PMI Up Date"}),
    #"Added Custom36" = Table.AddColumn(#"Removed Columns7", "PMI Acc/Rej", each ""),
    #"Reordered Columns39" = Table.ReorderColumns(#"Added Custom36",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "PMI Report", "PMI Date", "PMI%", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT%", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Removed Columns8" = Table.RemoveColumns(#"Reordered Columns39",{"PT Cap Report No", "PT Cap Date", "PT Cap(%)", "PT Cap Request Date", "PT%"}),
    #"Reordered Columns40" = Table.ReorderColumns(#"Removed Columns8",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT Root(%)", "PT Root Request Date", "PMI Report", "PMI Date", "PMI%", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Renamed Columns27" = Table.RenameColumns(#"Reordered Columns40",{{"PT Root(%)", "PT%"}}),
    #"Reordered Columns41" = Table.ReorderColumns(#"Renamed Columns27",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Root Date", "PT%", "PT Root Request Date", "PMI Report", "PMI Date", "PMI%", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Renamed Columns28" = Table.RenameColumns(#"Reordered Columns41",{{"PT Root Date", "PT Date"}}),
    #"Reordered Columns42" = Table.ReorderColumns(#"Renamed Columns28",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Root Report No", "PT Date", "PT%", "PT Root Request Date", "PMI Report", "PMI Date", "PMI%", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Renamed Columns29" = Table.RenameColumns(#"Reordered Columns42",{{"PT Root Report No", "PT Report"}}),
    #"Removed Columns9" = Table.RemoveColumns(#"Renamed Columns29",{"PT Root Request Date"}),
    #"Added Custom37" = Table.AddColumn(#"Removed Columns9", "PT Acc/Rej", each ""),
    #"Reordered Columns43" = Table.ReorderColumns(#"Added Custom37",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Report", "PT Date", "PT%", "PMI Report", "PMI Date", "PMI%", "FT Report No", "FT Date", "FT(%)", "FT Request Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Date", "FN Report", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Removed Columns10" = Table.RemoveColumns(#"Reordered Columns43",{"FN%"}),
    #"Renamed Columns30" = Table.RenameColumns(#"Removed Columns10",{{"FT(%)", "FN%"}}),
    #"Removed Columns11" = Table.RemoveColumns(#"Renamed Columns30",{"FN Date", "FN Report"}),
    #"Renamed Columns31" = Table.RenameColumns(#"Removed Columns11",{{"FT Report No", "FT Report"}}),
    #"Reordered Columns44" = Table.ReorderColumns(#"Renamed Columns31",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Report", "PT Date", "PT%", "PMI Report", "PMI Date", "PMI%", "FT Report", "FT Date", "FT Request Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Removed Columns12" = Table.RemoveColumns(#"Reordered Columns44",{"FT Request Date"}),
    #"Changed Type8" = Table.TransformColumnTypes(#"Removed Columns12",{{"FN Selected Date", type date}, {"FN Exam Req date", type date}, {"FT Date", type date}}),
    #"Reordered Columns45" = Table.ReorderColumns(#"Changed Type8",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Report", "PT Date", "PT%", "PMI Report", "PMI Date", "PMI%", "FT Report", "FT Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "Sub-System No", "RT Remarks"}),
    #"Golden Weld Report Date" = Table.AddColumn(#"Reordered Columns45", "Golden Weld Report Date", each ""),
    #"Golden Weld Report No" = Table.AddColumn(#"Golden Weld Report Date", "Golden Weld Report No", each ""),
    Custom3 = Table.AddColumn(#"Golden Weld Report No", "Custom3", each ""),
    Custom4 = Table.AddColumn(Custom3, "Custom4", each ""),
    Custom5 = Table.AddColumn(Custom4, "Custom5", each ""),
    Custom6 = Table.AddColumn(Custom5, "Custom6", each ""),
    Custom7 = Table.AddColumn(Custom6, "Custom7", each ""),
    Custom8 = Table.AddColumn(Custom7, "Custom8", each ""),
    Custom9 = Table.AddColumn(Custom8, "Custom9", each ""),
    Custom10 = Table.AddColumn(Custom9, "Custom10", each ""),
    Custom11 = Table.AddColumn(Custom10, "Custom11", each ""),
    Custom12 = Table.AddColumn(Custom11, "Custom12", each ""),
    Custom13 = Table.AddColumn(Custom12, "Custom13", each ""),
    Custom14 = Table.AddColumn(Custom13, "Custom14", each ""),
    #"Reordered Columns46" = Table.ReorderColumns(Custom14,{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Report", "PT Date", "PT%", "PMI Report", "PMI Date", "PMI%", "FT Report", "FT Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "RT Remarks", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Sub-System No"}),
    #"Renamed Columns32" = Table.RenameColumns(#"Reordered Columns46",{{"Sub-System No", "Subsystem Code"}}),
    #"Added Custom38" = Table.AddColumn(#"Renamed Columns32", "PED", each ""),
    #"Reordered Columns47" = Table.ReorderColumns(#"Added Custom38",{"Joint ID", "Spool ID", "ISO Number", "Iso Rev No", "Spool No", "Weld No.", "Spool Rev No.", "Weld Cat", "Weld Type", "Dia Inch Factor", "Dia inch", "Thickness", "PDS Area", "AG/UG/PKG", "Area Classification", "wbu", "System no", "Testpack No", "NDT Remarks", "Service Class", "Service Cat", "Material Type", "MIR No", "MIR Date", "Cutting Date", "Beveling Date", "Fitup Date", "Preheat Date", "Weld Date", "DWIR No.", "Sub-Contractor", "Rework Code", "Original Joint", "Repair Suffix", "WeldPoint No.", "Weld Point Code", "WPS No.", "Welder", "PWHT Y/N", "PWHT Weld Status", "PWHT Selected Date", "PWHT Exam Req date", "PWHT Date", "PWHT Report", "PWHT Acc/Rej", "PWHT Client Exam Req Y/N", "PWHT Remarks", "HT%", "HT Batch No", "HT Batch Status", "HT Weld Status", "HT Selected Date", "HT Exam Req date", "HT Date", "HT Report", "HT Acc/Rej", "HT Client Exam Req Y/N", "HT Remarks", "RT/UT", "RT%", "RT Batch No", "RT Batch Status", "RT Weld Status", "RT Selected Date", "RT Exam Req date", "RT Date", "RT Xray No", "RT Report", "RT Acc/Rej", "RT Film Total", "Total No of films Acc", "Total No of films Rej", "Defect Code", "Location of Defect", "RT Re-Shoot Rep", "RT Re-Shoot Data", "RT Re-Shoot Status", "RT Re-Shoot Reason", "RT Re-Shoot Films", "Weld Length", "Rej Length", "RT Client Exam Req Y/N", "By UT", "Tracer Shot", "UT%", "UT Batch No", "UT Batch Status", "UT Weld Status", "UT Selected Date", "UT Exam Req date", "UT Date", "UT Report", "UT Acc/Rej", "UT Client Exam Req Y/N", "UT Remarks", "MT%", "MT Batch No", "MT Batch Status", "MT Weld Status", "MT Selected Date", "MT Exam Req date", "MT Date", "MT Report", "MT Acc/Rej", "MT Client Exam Req Y/N", "MT Remarks", "Del Flag", "Weld Point First", "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks", "PT Report", "PT Date", "PT%", "PMI Report", "PMI Date", "PMI%", "FT Report", "FT Date", "PMI Batch No", "PMI Batch Status", "PMI Weld Status", "PMI Selected Date", "PMI Exam Req date", "PMI Client Exam Req Y/N", "PMI Remarks", "PT Batch No", "PT Batch Status", "PT Weld Status", "PT Selected Date", "PT Exam Req date", "PT Client Exam Req Y/N", "PT Remarks", "FN%", "FN Batch No", "FN Batch Status", "FN Weld Status", "FN Selected Date", "FN Exam Req date", "FN Acc/Rej", "FN Client Exam Req Y/N", "FN Remarks", "PADLT Y/N", "PADLT Weld Status", "PADLT Selected Date", "PADLT Exam Req date", "PADLT Date", "PADLT Report", "PADLT Acc/Rej", "PADLT Client Exam Req Y/N", "PADLT Remarks", "ORIF Y/N", "ORIF Weld Status", "ORIF Selected Date", "ORIF Exam Req date", "ORIF Date", "ORIF Report", "ORIF Acc/Rej", "ORIF Client Exam Req Y/N", "Matrl Traceability Y/N", "GROUP-1", "IDENT CODE-1", "TRAC NO-1", "GROUP-2", "IDENT CODE-2", "TRAC NO-2", "Revision Status", "Revision Comments", "Hold Status", "Hold Comments", "Piping Group", "RT Remarks", "Golden Weld Report Date", "Golden Weld Report No", "Custom3", "Custom4", "Custom5", "Custom6", "Custom7", "Custom8", "Custom9", "Custom10", "Custom11", "Custom12", "Custom13", "Custom14", "Subsystem Code"}),
    #"Removed Columns13" = Table.RemoveColumns(#"Reordered Columns47",{ "Latest Joint", "Pressure Level", "Material Spec", "Design Code", "Remarks"}),
    #"Changed Type9" = Table.TransformColumnTypes(#"Removed Columns13",{{"PWHT Selected Date", type date}, {"PWHT Exam Req date", type date}, {"Total No of films Acc", type number}, {"Total No of films Rej", type number}, {"RT Re-Shoot Data", type date}, {"Weld Length", type number}, {"Rej Length", type number}, {"PMI Selected Date", type date}, {"PMI Exam Req date", type date}, {"PT Selected Date", type date}, {"PT Exam Req date", type date}, {"PADLT Selected Date", type date}, {"PADLT Exam Req date", type date}, {"PADLT Date", type date}, {"ORIF Selected Date", type date}, {"ORIF Exam Req date", type date}, {"ORIF Date", type date}}),
    #"Removed Columns14" = Table.RemoveColumns(#"Changed Type9",{"Del Flag"}),
    #"Changed Type10" = Table.TransformColumnTypes(#"Removed Columns14",{{"Cutting Date", type date}, {"Beveling Date", type date}, {"Fitup Date", type date}, {"Preheat Date", type date}, {"MIR Date", type date}}),
    #"Changed Type11" = Table.TransformColumnTypes(#"Changed Type10",{{"MT Selected Date", type date}, {"MT Exam Req date", type date}}),
    #"FN Date" = Table.RenameColumns(#"Changed Type11",{{"FT Date", "FN Date"}, {"Iso Rev No", "Iso Rev No."}, {"Service Class", "Service class"}}),
    #"Changed Type12" = Table.TransformColumnTypes(#"FN Date",{{"UT%", Int64.Type}, {"HT%", Int64.Type}, {"PMI%", Int64.Type}, {"FN%", Int64.Type}}),
    #"Renamed Columns33" = Table.RenameColumns(#"Changed Type12",{{"Spool No", "Spool No."}})
in
    #"Renamed Columns33"
```

### `UT TRACKER (GAC)`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\UT TRACKER\UT TRACKER (GAC)_Master.xlsx"), null, true),
    MUT_Sheet = Source{[Item="MUT",Kind="Sheet"]}[Data],
    #"Changed Type2" = Table.TransformColumnTypes(MUT_Sheet,{{"Column1", type any}, {"Column2", type text}, {"Column3", type any}, {"Column4", type text}, {"Column5", type any}, {"Column6", type text}, {"Column7", type any}, {"Column8", type any}, {"Column9", type text}, {"Column10", type text}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type text}, {"Column18", type text}, {"Column19", type text}, {"Column20", type any}, {"Column21", type any}, {"Column22", type any}, {"Column23", type text}, {"Column24", type any}, {"Column25", type text}, {"Column26", type text}, {"Column27", type any}, {"Column28", type text}, {"Column29", type text}, {"Column30", type text}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Changed Type2",{{"Column1", type any}, {"Column2", type text}, {"Column3", type text}, {"Column4", type text}, {"Column5", type any}, {"Column6", type text}, {"Column7", type any}, {"Column8", type any}, {"Column9", type text}, {"Column10", type text}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type text}, {"Column18", type text}, {"Column19", type text}, {"Column20", type any}, {"Column21", type any}, {"Column22", type any}, {"Column23", type text}, {"Column24", type any}, {"Column25", type text}, {"Column26", type text}, {"Column27", type any}, {"Column28", type text}, {"Column29", type text}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",2),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers",{{"SL", Int64.Type}, {"DRAWING NUMBER", type text}, {"REV", type text}, {"SPOOL", type text}, {"RFI NO", Int64.Type}, {"JOINT", type text}, {"DIA", Int64.Type}, {" THICKNESS (mm)", type number}, {"LINE #(lf)CLASS", type text}, {"METERIAL", type text}, {"LOCATION#(lf)(Shop / Field)", type text}, {"Specific Location", type text}, {"WELDING #(lf)PROCESS", type text}, {"WPS", type text}, {"WELDER'S", type text}, {"PWHT Status", type text}, {"Request No", type text}, {"MUT REPORT NO", type text}, {"RESULT", type text}, {"Inspected#(lf)Length#(lf)(MM)", type number}, {"Defect #(lf)Length#(lf)(MM)", Int64.Type}, {"DATE OF EXAMINATION", type date}, {"WEEK", type text}, {"MUT TECHNICIAN NAME", type text}, {"MUT Technician ID", type text}, {"Cross Verification-by  CTJV (TPI) ", type text}, {"CTJV VERIFICATION#(lf)DATE", type date}, {"CTJV VERIFICATION#(lf)BY", type text}, {"Remarks", type text}}),
    #"Replaced Value" = Table.ReplaceValue(#"Changed Type1"," ","",Replacer.ReplaceText,{"SPOOL"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value"," ","",Replacer.ReplaceText,{"DRAWING NUMBER"}),
    #"Replaced Value3" = Table.ReplaceValue(#"Replaced Value1"," ","",Replacer.ReplaceText,{"JOINT"}),
    #"Replaced Value2" = Table.ReplaceValue(#"Replaced Value3","FBW-","",Replacer.ReplaceText,{"JOINT"}),
    #"Replaced Value4" = Table.ReplaceValue(#"Replaced Value2"," ","",Replacer.ReplaceText,{"JOINT"}),
    #"Joint ID" = Table.AddColumn(#"Replaced Value4", "Joint ID", each [DRAWING NUMBER]&"-"&[SPOOL]&"-"&[JOINT]),
    #"Cleaned Text" = Table.TransformColumns(#"Joint ID",{{"Joint ID", Text.Clean, type text}}),
    #"Reordered Columns" = Table.ReorderColumns(#"Cleaned Text",{"Joint ID", "SL", "DRAWING NUMBER", "REV", "SPOOL", "RFI NO", "JOINT", "DIA", " THICKNESS (mm)", "LINE #(lf)CLASS", "METERIAL", "LOCATION#(lf)(Shop / Field)", "Specific Location", "WELDING #(lf)PROCESS", "WPS", "WELDER'S", "PWHT Status", "Request No", "MUT REPORT NO", "RESULT", "Inspected#(lf)Length#(lf)(MM)", "Defect #(lf)Length#(lf)(MM)", "DATE OF EXAMINATION", "WEEK", "MUT TECHNICIAN NAME", "MUT Technician ID", "Cross Verification-by  CTJV (TPI) ", "CTJV VERIFICATION#(lf)DATE", "CTJV VERIFICATION#(lf)BY", "Remarks"}),
    #"Replaced Value5" = Table.ReplaceValue(#"Reordered Columns","ACCEPT","A",Replacer.ReplaceText,{"RESULT"}),
    #"Replaced Value6" = Table.ReplaceValue(#"Replaced Value5","REJECT","R",Replacer.ReplaceText,{"RESULT"}),
    #"Replaced 4785 to 4.785" = Table.ReplaceValue(#"Replaced Value6",4785.36,4.785,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value8" = Table.ReplaceValue(#"Replaced 4785 to 4.785",1435,1.435,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value7" = Table.ReplaceValue(#"Replaced Value8",1436,1.436,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value9" = Table.ReplaceValue(#"Replaced Value7",2073.65,2.073,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value10" = Table.ReplaceValue(#"Replaced Value9",2871,2.871,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value11" = Table.ReplaceValue(#"Replaced Value10",3190.24,3.19,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value12" = Table.ReplaceValue(#"Replaced Value11",2073.656,2.073,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value13" = Table.ReplaceValue(#"Replaced Value12",1595,1.595,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value14" = Table.ReplaceValue(#"Replaced Value13",1914,1.914,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value15" = Table.ReplaceValue(#"Replaced Value14",4147,4.147,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value16" = Table.ReplaceValue(#"Replaced Value15",4785,4.785,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value17" = Table.ReplaceValue(#"Replaced Value16",2074,2.074,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value18" = Table.ReplaceValue(#"Replaced Value17",3190,3.19,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Replaced Value19" = Table.ReplaceValue(#"Replaced Value18",3828,3.828,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Filtered Rows" = Table.SelectRows(#"Replaced Value19", each true),
    #"Replaced 45 to 0.045" = Table.ReplaceValue(#"Filtered Rows",45,0.045,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 83 to 0.083" = Table.ReplaceValue(#"Replaced 45 to 0.045",83,0.083,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced Value20" = Table.ReplaceValue(#"Replaced 83 to 0.083",35,0.035,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 29 to 0.029" = Table.ReplaceValue(#"Replaced Value20",29,0.029,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 37 to 0.037" = Table.ReplaceValue(#"Replaced 29 to 0.029",37,0.037,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 38 to 0.038" = Table.ReplaceValue(#"Replaced 37 to 0.037",38,0.038,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 148 to 0.148" = Table.ReplaceValue(#"Replaced 38 to 0.038",148,0.148,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 13 to 0.013" = Table.ReplaceValue(#"Replaced 148 to 0.148",13,0.013,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 24 to 0.024" = Table.ReplaceValue(#"Replaced 13 to 0.013",24,0.024,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 12 to 0.012" = Table.ReplaceValue(#"Replaced 24 to 0.024",12,0.012,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Reordered Columns1" = Table.ReorderColumns(#"Replaced 12 to 0.012",{"Joint ID", "SL", "DRAWING NUMBER", "REV", "SPOOL", "RFI NO", "JOINT", "DIA", " THICKNESS (mm)", "LINE #(lf)CLASS", "METERIAL", "LOCATION#(lf)(Shop / Field)", "Specific Location", "WELDING #(lf)PROCESS", "WPS", "WELDER'S", "PWHT Status", "Request No", "MUT REPORT NO", "RESULT", "Inspected#(lf)Length#(lf)(MM)", "Defect #(lf)Length#(lf)(MM)", "DATE OF EXAMINATION", "WEEK", "MUT TECHNICIAN NAME", "MUT Technician ID", "Cross Verification-by  CTJV (TPI) ", "CTJV VERIFICATION#(lf)DATE", "CTJV VERIFICATION#(lf)BY", "Remarks", "REPORT STATUS"}),
    #"Replaced 11 to 0.011" = Table.ReplaceValue(#"Reordered Columns1",11,0.011,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 14 to 0.014" = Table.ReplaceValue(#"Replaced 11 to 0.011",14,0.014,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"}),
    #"Replaced 48 to 0.048" = Table.ReplaceValue(#"Replaced 14 to 0.014",48,0.048,Replacer.ReplaceValue,{"Defect #(lf)Length#(lf)(MM)"})
in
    #"Replaced 48 to 0.048"
```

### `UT TRACKER (CCC)_Talisman`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\UT TRACKER\UT TRACKER (CCC)_Talisman.xlsx"), null, true),
    TalismanUT_update_Sheet = Source{[Item="TalismanUT_update",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(TalismanUT_update_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"QCISO NO", type text}, {"JOINT NO", type text}, {"SPOOL NO", type text}, {"SIZE", Int64.Type}, {"Wall Thickness", type number}, {"SERVICE CLASS", type text}, {"WELD TYPE", type text}, {"AREA", type text}, {"WELD DATE", type date}, {"Welder ID", type text}, {"WELDER ID 2", type text}, {"WELDER ID 3", type text}, {"WELDER ID 4", type text}, {"WPS CODE", type text}, {"UT1 DATE", type date}, {"UT1 REP NO", type text}, {"UT1 RESULT", type text}, {"UT OPE1", type text}, {"UT OPE2", type any}, {"WELDDEFECTLENGTH", type number}, {"PWHT DATE", type date}, {"PWHT REP NO", type text}}),
    #"Joint ID" = Table.AddColumn(#"Changed Type", "Joint ID", each [QCISO NO]&"-"&[SPOOL NO]&"-"&[JOINT NO]),
    #"Reordered Columns" = Table.ReorderColumns(#"Joint ID",{"Joint ID", "QCISO NO", "JOINT NO", "SPOOL NO", "SIZE", "Wall Thickness", "SERVICE CLASS", "WELD TYPE", "AREA", "WELD DATE", "Welder ID", "WELDER ID 2", "WELDER ID 3", "WELDER ID 4", "WPS CODE", "UT1 DATE", "UT1 REP NO", "UT1 RESULT", "UT OPE1", "UT OPE2", "WELDDEFECTLENGTH", "PWHT DATE", "PWHT REP NO"}),
    #"Renamed Columns" = Table.RenameColumns(#"Reordered Columns",{{"UT OPE1", "UT Operator ID."}, {"UT OPE2", "UT Operator ID 2"}, {"WELDDEFECTLENGTH", "Defect Lenght(MM)."}, {"QCISO NO", "ISO Number"}}),
    #"Null to 0" = Table.ReplaceValue(#"Renamed Columns",null,0,Replacer.ReplaceValue,{"Defect Lenght(MM)."})
in
    #"Null to 0"
```

### `Flange Progress`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Flange Managment\Flange Progress.xlsx"), null, true),
    FlangeJointProgress_Sheet = Source{[Item="FlangeJointProgress",Kind="Sheet"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(FlangeJointProgress_Sheet,{{"Column1", type text}, {"Column2", type text}, {"Column3", type text}, {"Column4", type text}, {"Column5", type text}, {"Column6", type text}, {"Column7", type text}, {"Column8", type text}, {"Column9", type text}, {"Column10", type text}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type text}, {"Column18", type text}, {"Column19", type text}, {"Column20", type text}, {"Column21", type text}, {"Column22", type text}, {"Column23", type text}, {"Column24", type text}, {"Column25", type text}, {"Column26", type text}, {"Column27", type text}, {"Column28", type text}, {"Column29", type text}, {"Column30", type text}, {"Column31", type text}, {"Column32", type text}, {"Column33", type text}, {"Column34", type text}, {"Column35", type text}, {"Column36", type text}, {"Column37", type text}, {"Column38", type text}, {"Column39", type text}, {"Column40", type text}, {"Column41", type text}, {"Column42", type text}, {"Column43", type text}, {"Column44", type text}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",5),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    Custom2 = #"Promoted Headers",
    #"Replaced Value 0024" = Table.ReplaceValue(Custom2,"02-Oct-0024","02-Oct-2024",Replacer.ReplaceText,{"Joint Date"}),
    #"Replaced Value 0024 2" = Table.ReplaceValue(#"Replaced Value 0024","05-Oct-0024","05-Oct-2024",Replacer.ReplaceText,{"Joint Date"}),
    #"Replaced Value 0024 3" = Table.ReplaceValue(#"Replaced Value 0024 2","06-Oct-0024","06-Oct-2024",Replacer.ReplaceText,{"Joint Date"}),
    #"Replaced Value 0024 4" = Table.ReplaceValue(#"Replaced Value 0024 3","07-Oct-0024","07-Oct-2024",Replacer.ReplaceText,{"Joint Date"}),
    #"Exlude 1M03 Iso & 0" = Table.SelectRows(#"Replaced Value 0024 4", each ([Iso Number] <> "0" and [Iso Number] <> "1M03")),
    #"Exlude Acciona" = Table.SelectRows(#"Exlude 1M03 Iso & 0", each ([Flange Subcontractor] <> "ACCIONA")),
    #"Replaced Timing null to TBN" = Table.ReplaceValue(#"Exlude Acciona",null,"TBN",Replacer.ReplaceValue,{"Joint Timing"}),
    #"Replaced CAT  null to TBN" = Table.ReplaceValue(#"Replaced Timing null to TBN",null,"TBN",Replacer.ReplaceValue,{"Cat."}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Replaced CAT  null to TBN",{{"Test Pack", type text}, {"System", type text}, {"SubSystem", type text}, {"Commissioning Package", type text}, {"Iso Number", type text}, {"Rev No.", type text}, {"Sheet No.", Int64.Type}, {"BT No.", type text}, {"Joint Point", type text}, {"Diam", type number}, {"Rating", Int64.Type}, {"Bolt Size", type number}, {"Bolt Qty", Int64.Type}, {"Bolt Length", Int64.Type}, {"Bolt Ident", type text}, {"Service Class", type text}, {"Bolt Desc.", type text}, {"Gasket Desc.", type text}, {"Lubricant Type", type text}, {"Service Type", type text}, {"UT", type text}, {"Joint Method", type text}, {"Jointing Value", Int64.Type}, {"Joint Timing", type text}, {"Cat.", type text}, {"Reason", type text}, {"Joint Date", type text}, {"Report Nbr", type text}, {"Jointer", type text}, {"Tag Nbr", type text}, {"Control %", Int64.Type}, {"Flange Batch No", type text}, {"Selected Date", type text}, {"Issued Date", type text}, {"Issue Request No", type text}, {"Batch Status", type text}, {"Flange Joint Status", type text}, {"Control Inspection Report No", type text}, {"Control Inspection Date", type text}, {"Status - A/R ", type text}, {"Client Requested", type text}, {"Hold Status", type text}, {"Flange Subcontractor", type text}, {"WITNESSED BY", type text}}),
    #"Added Joint ID" = Table.AddColumn(#"Changed Type1", "Joint ID", each [Iso Number]&"-"&[#"BT No."]),
    #"Added PDS Area" = Table.AddColumn(#"Added Joint ID", "PDS Area", each Text.BeforeDelimiter([Iso Number],"-")),
    #"Added Joint Method Original" = Table.AddColumn(#"Added PDS Area", "Joint Method Original", each [Joint Method]),
    #"Replaced Tensionning *" = Table.ReplaceValue(#"Added Joint Method Original","Tensionning","Tensioning",Replacer.ReplaceText,{"Joint Method Original"}),
    #"Replaced Tensionning to Tensioning" = Table.ReplaceValue(#"Replaced Tensionning *","Tensionning","Tensioning",Replacer.ReplaceText,{"Joint Method"}),
    #"Replaced Manual Torquing to Manual" = Table.ReplaceValue(#"Replaced Tensionning to Tensioning","Manual Torquing","Manual",Replacer.ReplaceText,{"Joint Method"}),
    #"Replaced Hydraulic Torquing to Torquing" = Table.ReplaceValue(#"Replaced Manual Torquing to Manual","Hydraulic Torquing","Torquing",Replacer.ReplaceText,{"Joint Method"}),
    #"Replaced Torquing Critical to Torquing" = Table.ReplaceValue(#"Replaced Hydraulic Torquing to Torquing","Torquing Critical","Torquing",Replacer.ReplaceText,{"Joint Method"}),
    #"Replaced Method null to TBN" = Table.ReplaceValue(#"Replaced Torquing Critical to Torquing",null,"TBN",Replacer.ReplaceValue,{"Joint Method"}),
    #"Replaced AC to A" = Table.ReplaceValue(#"Replaced Method null to TBN","AC","A",Replacer.ReplaceValue,{"ACC/REJ"}),
    #"Replaced ACC to A" = Table.ReplaceValue(#"Replaced AC to A","ACC","A",Replacer.ReplaceValue,{"ACC/REJ"}),
    #"Reordered Columns" = Table.ReorderColumns(#"Replaced ACC to A",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R ", "Client Requested", "Hold Status", "Flange Subcontractor", "WITNESSED BY"}),
    #"Renamed Status - A/R" = Table.RenameColumns(#"Reordered Columns",{{"Status - A/R ", "Status - A/R"}}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Renamed Status - A/R",{{"Joint Date", type date}, {"Selected Date", type date}, {"Issued Date", type date}, {"Control Inspection Date", type date}, {"De-Tightening Requested Date", type date}, {"UT", Int64.Type}}),
    #"Appended Query &ovAssets1381" = Table.Combine({#"Changed Type2", #"Flange ovAssets_1619"}),
    #"Added Index" = Table.AddIndexColumn(#"Appended Query &ovAssets1381", "Index", 1, 1, Int64.Type),
    Custom1 = #"Added Index",
    #"Exlude Dates" = Table.SelectRows(Custom1, each [Joint Date] <> #date(2026, 11, 20))
in
    #"Exlude Dates"
```

### `l2_ndt_list`

```m
let
    Source = Sql.Databases("CTJVSTSRV06"),
    QC_Database = Source{[Name="QC_Database"]}[Data],
    dbo_l2_ndt_list = QC_Database{[Schema="dbo",Item="l2_ndt_list"]}[Data],
    #"Changed Type1" = Table.TransformColumnTypes(dbo_l2_ndt_list,{{"HA", type text}, {"CWA", type text}, {"SCTR", type text}, {"EP_PIC_Testpack_No", type text}, {"Joint_ID", type text}, {"Report_Type", type text}, {"Report_No", type text}, {"Report_Date", type text}}),
    #"Replaced Value" = Table.ReplaceValue(#"Changed Type1","NULL","",Replacer.ReplaceText,{"Report_Date"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Replaced Value",{{"Report_Date", type date}}),
    #"Replaced Value2" = Table.ReplaceValue(#"Changed Type2","MEG","MEDGULF",Replacer.ReplaceText,{"SCTR"}),
    #"Replaced Value14" = Table.ReplaceValue(#"Replaced Value2","ING","Inco",Replacer.ReplaceText,{"SCTR"}),
    #"Replaced Value3" = Table.ReplaceValue(#"Replaced Value14","TFN","TEKFEN",Replacer.ReplaceText,{"SCTR"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value3","Field Daily Welding (VI) Report","VI",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value4" = Table.ReplaceValue(#"Replaced Value1","Hardness Test (HT) Report","HT",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value5" = Table.ReplaceValue(#"Replaced Value4","Liquid Penetrant Examination Report (PT) Report","PT",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value6" = Table.ReplaceValue(#"Replaced Value5","Magnetic Particle Examination Report (MT) Report","MT",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value7" = Table.ReplaceValue(#"Replaced Value6","Orifice flange internal grinding (ORIF) Report","ORIF",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value8" = Table.ReplaceValue(#"Replaced Value7","PAD Leak Testing (PADLT) Report","PADLT",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value9" = Table.ReplaceValue(#"Replaced Value8","Positive Material Identification (PMI) Report","PMI",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value10" = Table.ReplaceValue(#"Replaced Value9","Post Weld Heat Treatment (PWHT) Report","PWHT",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value11" = Table.ReplaceValue(#"Replaced Value10","Radiographic Examination Report (RT) Report","RT",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value12" = Table.ReplaceValue(#"Replaced Value11","Ultrasonic Examination Report (UT) Report","UT",Replacer.ReplaceText,{"Report_Type"}),
    #"Replaced Value13" = Table.ReplaceValue(#"Replaced Value12","Ferrite Testing (FN) Report","FN",Replacer.ReplaceText,{"Report_Type"}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Replaced Value13",{{"SPO Upload Date", type date}}),
    #"Reordered Columns" = Table.ReorderColumns(#"Changed Type3",{"HA", "CWA", "SCTR", "System_No", "EP_PIC_Testpack_No", "Joint_ID", "ISO_Number", "Report_Type", "Origin_Report_No", "Report_No", "Report_Date", "Result", "Comments", "SPO Upload Date", "SPO_URL"}),
    #"TBD to """"" = Table.ReplaceValue(#"Reordered Columns","TBD","",Replacer.ReplaceText,{"Origin_Report_No"}),
    Custom1 = #"TBD to """"",
    #"Filtered Rows By FN" = Table.SelectRows(Custom1, each ([Report_Type] = "FN"))
in
    #"Filtered Rows By FN"
```

### `Trend Active Welders`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\CUM Trend Active Welders\CUM Trend Active Welders.xlsx"), null, true),
    #"CUM Trend Active Welders_Sheet" = Source{[Item="CUM Trend Active Welders",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"CUM Trend Active Welders_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Week_End_Date", type date}, {"No. of Welders 'PR all""", Int64.Type}, {"Sub-Contractor", type text}})
in
    #"Changed Type"
```

### `UT TRACKER (TEK)`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\UT TRACKER\UT TRACKER (TEK).xlsx"), null, true),
    MUT_Sheet = Source{[Item="MUT",Kind="Sheet"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(MUT_Sheet,{{"Column1", type any}, {"Column2", type text}, {"Column3", type text}, {"Column4", type text}, {"Column5", type any}, {"Column6", type text}, {"Column7", type any}, {"Column8", type any}, {"Column9", type text}, {"Column10", type text}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type text}, {"Column18", type text}, {"Column19", type text}, {"Column20", type any}, {"Column21", type any}, {"Column22", type any}, {"Column23", type text}, {"Column24", type any}, {"Column25", type text}, {"Column26", type text}, {"Column27", type text}, {"Column28", type any}, {"Column29", type text}, {"Column30", type text}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",2),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers",{{"SL", Int64.Type}, {"DRAWING NUMBER", type text}, {"REV", type text}, {"SPOOL", type text}, {"RFI NO", Int64.Type}, {"JOINT", type text}, {"DIA", Int64.Type}, {" THICKNESS (mm)", Int64.Type}, {"LINE #(lf)CLASS", type text}, {"METERIAL", type text}, {"LOCATION#(lf)(Shop / Field)", type text}, {"Specific Location", type text}, {"WELDING #(lf)PROCESS", type text}, {"WPS", type text}, {"WELDER'S", type text}, {"PWHT Status", type text}, {"Request No", type text}, {"MUT REPORT NO", type text}, {"RESULT", type text}, {"Inspected#(lf)Length#(lf)(MM)", Int64.Type}, {"Defect #(lf)Length#(lf)(MM)", Int64.Type}, {"DATE OF EXAMINATION", type date}, {"WEEK", type text}, {"MUT TECHNICIAN NAME", type text}, {"MUT Technician ID", type text}, {"Cross Verification-by  CTJV (TPI) ", type text}, {"CTJV VERIFICATION#(lf)DATE", type date}, {"CTJV VERIFICATION#(lf)BY", type text}, {"Remarks", type text}}),
    #"Replaced Value" = Table.ReplaceValue(#"Changed Type1","FBW-","",Replacer.ReplaceText,{"JOINT"}),
    #"Joint ID" = Table.AddColumn(#"Replaced Value", "Joint ID", each [DRAWING NUMBER]&"-"&[SPOOL]&"-"&[JOINT]),
    #"Reordered Columns1" = Table.ReorderColumns(#"Joint ID",{"Joint ID", "SL", "DRAWING NUMBER", "REV", "SPOOL", "RFI NO", "JOINT", "DIA", " THICKNESS (mm)", "LINE #(lf)CLASS", "METERIAL", "LOCATION#(lf)(Shop / Field)", "Specific Location", "WELDING #(lf)PROCESS", "WPS", "WELDER'S", "PWHT Status", "Request No", "MUT REPORT NO", "RESULT", "Inspected#(lf)Length#(lf)(MM)", "Defect #(lf)Length#(lf)(MM)", "DATE OF EXAMINATION", "WEEK", "MUT TECHNICIAN NAME", "MUT Technician ID", "Cross Verification-by  CTJV (TPI) ", "CTJV VERIFICATION#(lf)DATE", "CTJV VERIFICATION#(lf)BY", "Remarks"}),
    #"Replace 3190 to 3.190" = Table.ReplaceValue(#"Reordered Columns1",3190,3.19,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Replace 3190 to 3.190",{{"Defect #(lf)Length#(lf)(MM)", type number}}),
    #"Replaced Value1" = Table.ReplaceValue(#"Changed Type2","ACCEPT","A",Replacer.ReplaceText,{"RESULT"}),
    #"Filtered Rows" = Table.SelectRows(#"Replaced Value1", each [Joint ID] <> null),
    #"Replaced 1835 to 1.835" = Table.ReplaceValue(#"Filtered Rows",1835,1.835,Replacer.ReplaceValue,{"Inspected#(lf)Length#(lf)(MM)"})
in
    #"Replaced 1835 to 1.835"
```

### `TALISMAN DATA`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\From Talisman\Joint.csv"),[Delimiter=",", Columns=62, Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Renamed Columns WELDER ID" = Table.RenameColumns(#"Promoted Headers",{{"WELDER ID 1", "WELDER ID-1"}, {"WELDER ID 2", "WELDER ID-2"}, {"WELDER ID 3", "WELDER ID-3"}, {"WELDER ID 4", "WELDER ID-4"}}),
    #"Renamed Columns1 WELDER ID" = Table.RenameColumns(#"Renamed Columns WELDER ID",{{"WELDER ID-2", "WELDER ID 2"}, {"WELDER ID-3", "WELDER ID 3"}, {"WELDER ID-4", "WELDER ID 4"}, {"WELDER ID-1", "WELDER ID 1"}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Renamed Columns1 WELDER ID",{{"SUBCON CODE", type text}, {"QCISO NO", type text}, {"SHEET NO", Int64.Type}, {"JOINT NO", type text}, {"ORIGINAL REPAIR DELETE FLAG", type text}, {"REV NO", type text}, {"SPOOL NO", type text}, {"WORK CATEGORY", type text}, {"ORIGINAL WORK CATEGORY", type text}, {"SIZE", Int64.Type}, {"2ND SIZE", Int64.Type}, {"WELD TYPE", type text}, {"AREA", type text}, {"SERVICE CLASS", type text}, {"TESTPACK NO", type text}, {"SUBSYSTEM NO", type text}, {"LINE NO", type text}, {"WELD DATE", type date}, {"WELDER ID 1", type text}, {"WELDER ID 2", type text}, {"WELDER ID 3", type text}, {"WELDER ID 4", type text}, {"WPS CODE", type text}, {"REWORK CODE", type text}, {"RT1 DATE", type date}, {"RT1 REP NO", type text}, {"RT1 RESULT", type text}, {"RT1 TOTAL FILM NO", Int64.Type}, {"RT1 REJECT FILM NO", Int64.Type}, {"RT1 DEFECT CODE", type text}, {"RT2 DATE", type date}, {"RT2 REP NO", type text}, {"RT2 RESULT", type text}, {"RT2 TOTAL FILM NO", type text}, {"RT2 REJECT FILM NO", type text}, {"RT2 DEFECT CODE", type text}, {"UT1 DATE", type date}, {"UT1 REP NO", type text}, {"UT1 RESULT", type text}, {"UT1 DEFECT CODE", type text}, {"UT2 DATE", type date}, {"UT2 REP NO", type text}, {"UT2 RESULT", type text}, {"UT2 DEFECT CODE", type text}, {"TRACER FLG", type text}, {"PT DATE", type date}, {"PT REP NO", type text}, {"MT DATE", type date}, {"MT REP NO", type text}, {"PWHT DATE", type date}, {"PWHT REP NO", type text}, {"HT DATE", type date}, {"HT REP NO", type text}, {"PMI DATE", type date}, {"PMI REP NO", type text}, {"PMI UP DATE", type date}, {"PMI UP REP NO", type text}, {"PMI DOWN DATE", type date}, {"PMI DOWN REP NO", type text}, {"FT DATE", type date}, {"FT REP NO", type text}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Changed Type",{{"JOINT NO", type text}}),
    #"JOINT ID" = Table.AddColumn(#"Changed Type1", "Joint ID", each [QCISO NO]&"-"&[SPOOL NO]&"-"&[JOINT NO]),
    #"Reordered Columns" = Table.ReorderColumns(#"JOINT ID",{"Joint ID", "SUBCON CODE", "QCISO NO", "SHEET NO", "JOINT NO", "ORIGINAL REPAIR DELETE FLAG", "REV NO", "SPOOL NO", "WORK CATEGORY", "ORIGINAL WORK CATEGORY", "SIZE", "2ND SIZE", "WELD TYPE", "AREA", "SERVICE CLASS", "TESTPACK NO", "SUBSYSTEM NO", "LINE NO", "WELD DATE", "WELDER ID 1", "WELDER ID 2", "WELDER ID 3", "WELDER ID 4", "WPS CODE", "REWORK CODE", "RT1 DATE", "RT1 REP NO", "RT1 RESULT", "RT1 TOTAL FILM NO", "RT1 REJECT FILM NO", "RT1 DEFECT CODE", "RT2 DATE", "RT2 REP NO", "RT2 RESULT", "RT2 TOTAL FILM NO", "RT2 REJECT FILM NO", "RT2 DEFECT CODE", "UT1 DATE", "UT1 REP NO", "UT1 RESULT", "UT1 DEFECT CODE", "UT2 DATE", "UT2 REP NO", "UT2 RESULT", "UT2 DEFECT CODE", "TRACER FLG", "PT DATE", "PT REP NO", "MT DATE", "MT REP NO", "PWHT DATE", "PWHT REP NO", "HT DATE", "HT REP NO", "PMI DATE", "PMI REP NO", "PMI UP DATE", "PMI UP REP NO", "PMI DOWN DATE", "PMI DOWN REP NO", "FT DATE", "FT REP NO"}),
    #"Filter ORIGINAL REPAIR DELETE FLAG" = Table.SelectRows(#"Reordered Columns", each ([ORIGINAL REPAIR DELETE FLAG] <> "D")),
    #"Split Column WELDER ID 4 by Delimiter" = Table.ExpandListColumn(Table.TransformColumns(#"Filter ORIGINAL REPAIR DELETE FLAG", {{"WELDER ID 4", Splitter.SplitTextByDelimiter("/", QuoteStyle.Csv), let itemType = (type nullable text) meta [Serialized.Text = true] in type {itemType}}}), "WELDER ID 4"),
    #"Changed Type2" = Table.TransformColumnTypes(#"Split Column WELDER ID 4 by Delimiter",{{"WELDER ID 4", type text}}),
    #"Split Column WELDER ID 1 by Delimiter1" = Table.ExpandListColumn(Table.TransformColumns(#"Changed Type2", {{"WELDER ID 1", Splitter.SplitTextByDelimiter("/", QuoteStyle.Csv), let itemType = (type nullable text) meta [Serialized.Text = true] in type {itemType}}}), "WELDER ID 1"),
    #"Changed Type3" = Table.TransformColumnTypes(#"Split Column WELDER ID 1 by Delimiter1",{{"WELDER ID 1", type text}}),
    #"Split Column WELDER ID 2 by Delimiter2" = Table.ExpandListColumn(Table.TransformColumns(#"Changed Type3", {{"WELDER ID 2", Splitter.SplitTextByDelimiter("/", QuoteStyle.Csv), let itemType = (type nullable text) meta [Serialized.Text = true] in type {itemType}}}), "WELDER ID 2"),
    #"Changed Type4" = Table.TransformColumnTypes(#"Split Column WELDER ID 2 by Delimiter2",{{"WELDER ID 2", type text}}),
    #"Split Column WELDER ID 3 by Delimiter3" = Table.ExpandListColumn(Table.TransformColumns(#"Changed Type4", {{"WELDER ID 3", Splitter.SplitTextByDelimiter("/", QuoteStyle.Csv), let itemType = (type nullable text) meta [Serialized.Text = true] in type {itemType}}}), "WELDER ID 3"),
    #"Changed Type5" = Table.TransformColumnTypes(#"Split Column WELDER ID 3 by Delimiter3",{{"WELDER ID 3", type text}}),
    #"Trimmed Text" = Table.TransformColumns(#"Changed Type5",{{"WELDER ID 1", Text.Trim, type text}, {"WELDER ID 2", Text.Trim, type text}, {"WELDER ID 3", Text.Trim, type text}, {"WELDER ID 4", Text.Trim, type text}}),
    #"WELDER ID ALL" = Table.AddColumn(#"Trimmed Text", "WELDER ID ALL", each if [WELDER ID 4] = "" then [WELDER ID 1] else [WELDER ID 4]),
    #"Joint ID+Welder ID" = Table.AddColumn(#"WELDER ID ALL", "Joint ID+Welder ID", each [Joint ID]&"-"&[WELDER ID ALL]),
    #"Added Index" = Table.AddIndexColumn(#"Joint ID+Welder ID", "Index", 1, 1, Int64.Type)
in
    #"Added Index"
```

### `CUM FILE Welders Performance 1 Month`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\CUM FILE Welders Performance For Graphic\CUM FILE Welders Performance.  Rejection Rate. Summary Status  1 Month Since RT Date .xlsx"), null, true),
    #"CUM FILE Welders Performance_Sheet" = Source{[Item="CUM FILE Welders Performance",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"CUM FILE Welders Performance_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Date", type date}, {"Row Index Column", type any}, {"Week_Start_Date", type date}, {"Weeknum", type text}, {"Week_End_Date", type date}, {"1 Month  Period", type text}, {"Last_RT Date ""PR all""", type date}, {"Sub-Contractor", type text}, {"STATUS", type text}, {"Welder ID", type text}, {"RT Film Ratio % ""PR all"" For Welder LAST 1 Month", Int64.Type}, {"Count of Welder ID", Int64.Type}})
in
    #"Changed Type"
```

### `Talisman Spool Dump`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\From Talisman\Spool.csv"),[Delimiter=",", Columns=22, Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"QCISO NO", type text}, {"SPOOL NO", type text}, {"WEIGHT", Int64.Type}, {"FABRICATION ORDER", type date}, {"MATERIAL ISSUE", type date}, {"CUT / FIT", type date}, {"SHOP WELD COMPLETE", type date}, {"QC SPOOL RELEASED TO NDT/PWHT", type date}, {"PWHT", type date}, {"SHOP NDE DONE", type date}, {"PAINT RELEASE", type date}, {"SENT TO LAYDOWN", type date}, {"PAINT COMPLETE", type date}, {"QC RELEASE FROM PAINTING", type date}, {"PAINTING REPORT DATE", type date}, {"PAINTING REPORT NO", type text}, {"LAYDOWN MOVE", type date}, {"LAYDOWN LOCATION", type text}, {"SITE MOVE", type date}, {"SPOOL ERECTION DONE", type date}, {"FIELD WELD COMPLETE", type date}, {"FIELD NDE DONE", type date}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"SPOOL NO", "Spool No."}}),
    #"Added Custom" = Table.AddColumn(#"Renamed Columns", "Spool ID", each [QCISO NO]&"-"&[#"Spool No."]),
    #"Reordered Columns" = Table.ReorderColumns(#"Added Custom",{"Spool ID", "QCISO NO", "Spool No.", "WEIGHT", "FABRICATION ORDER", "MATERIAL ISSUE", "CUT / FIT", "SHOP WELD COMPLETE", "QC SPOOL RELEASED TO NDT/PWHT", "PWHT", "SHOP NDE DONE", "PAINT RELEASE", "SENT TO LAYDOWN", "PAINT COMPLETE", "QC RELEASE FROM PAINTING", "PAINTING REPORT DATE", "PAINTING REPORT NO", "LAYDOWN MOVE", "LAYDOWN LOCATION", "SITE MOVE", "SPOOL ERECTION DONE", "FIELD WELD COMPLETE", "FIELD NDE DONE"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Reordered Columns",{{"PWHT", "PWHT Date Spool"}})
in
    #"Renamed Columns1"
```

### `TREND RT UT`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\CUM Trend RT% UT% RejRate\CUM Trend RT% UT% RejRate.xlsx"), null, true),
    #"TREND RT UT_Sheet" = Source{[Item="TREND RT UT",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"TREND RT UT_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Date", type date}, {"Sub-Contractor", type text}, {"RT% Rate", type number}, {"UT% Rate", type number}, {"Project RT % Rej Rate", type number}, {"Project UT % Rej Rate", type number}})
in
    #"Changed Type"
```

### `CUM FILE UT Welders Performance 2 Weeks`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\CUM FILE UT  Welders Performance For Graphic\UT CUM FILE Welders Performance.  Rejection Rate. Summary Status  2 Weeks Since UT Date .xlsx"), null, true),
    #"CUM FILE UT Welders Performance_Sheet" = Source{[Item="CUM FILE UT Welders Performance",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"CUM FILE UT Welders Performance_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Date", type date}, {"Row Index Column", type any}, {"Week_Start_Date", type date}, {"Weeknum", type text}, {"Week_End_Date", type date}, {"2 Weeks Period", type text}, {"Last_UT Date ""PR all""", type date}, {"Sub-Contractor", type text}, {"STATUS", type text}, {"Welder ID", type text}, {"UT Rej Length Ratio % For Welder LAST 2 WEEKS", type number}, {"Count of Welder ID", Int64.Type}})
in
    #"Changed Type"
```

### `WPS Status CUM`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\WPQ RECORD REGISTER\CUM WPS Status.xlsx"), null, true),
    #"WPS Status_Sheet" = Source{[Item="WPS Status",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"WPS Status_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Week_End_Date", type date}, {"WPS Submitted", Int64.Type}, {"WPS Approved", Int64.Type}})
in
    #"Changed Type"
```

### `CUM MPI Done`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\MPI Done\CUM MPI Done .xlsx"), null, true),
    #"MPI Done_Sheet" = Source{[Item="MPI Done",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"MPI Done_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Week_End_Date", type date}, {"MPI Done", Int64.Type}, {"MPI / PT Done", Int64.Type}})
in
    #"Changed Type"
```

### `CSVExport_Welder Record - (ACC  REJ )`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\PCI CCC  PBI WORK FILES\CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx"), null, true),
    #"Filtered Rows" = Table.SelectRows(Source, each ([Name] = "CSVExport_Welder Record - FOR P")),
    #"Expanded Data" = Table.ExpandTableColumn(#"Filtered Rows", "Data", {"Column1", "Column2", "Column3", "Column4", "Column5", "Column6", "Column7", "Column8", "Column9", "Column10", "Column11", "Column12", "Column13", "Column14", "Column15", "Column16", "Column17", "Column18", "Column19", "Column20", "Column21", "Column22", "Column23", "Column24", "Column25", "Column26", "Column27", "Column28", "Column29", "Column30", "Column31", "Column32", "Column33", "Column34", "Column35", "Column36", "Column37", "Column38", "Column39", "Column40", "Column41", "Column42", "Column43", "Column44", "Column45", "Column46", "Column47", "Column48", "Column49", "Column50", "Column51", "Column52", "Column53", "Column54", "Column55", "Column56", "Column57", "Column58", "Column59", "Column60", "Column61", "Column62", "Column63", "Column64", "Column65", "Column66", "Column67", "Column68", "Column69", "Column70", "Column71", "Column72", "Column73", "Column74", "Column75", "Column76", "Column77", "Column78", "Column79", "Column80", "Column81", "Column82", "Column83", "Column84", "Column85", "Column86", "Column87", "Column88", "Column89", "Column90", "Column91", "Column92", "Column93", "Column94", "Column95", "Column96", "Column97", "Column98", "Column99", "Column100", "Column101", "Column102", "Column103", "Column104", "Column105", "Column106", "Column107", "Column108", "Column109", "Column110", "Column111", "Column112", "Column113", "Column114", "Column115", "Column116", "Column117", "Column118", "Column119"}, {"Data.Column1", "Data.Column2", "Data.Column3", "Data.Column4", "Data.Column5", "Data.Column6", "Data.Column7", "Data.Column8", "Data.Column9", "Data.Column10", "Data.Column11", "Data.Column12", "Data.Column13", "Data.Column14", "Data.Column15", "Data.Column16", "Data.Column17", "Data.Column18", "Data.Column19", "Data.Column20", "Data.Column21", "Data.Column22", "Data.Column23", "Data.Column24", "Data.Column25", "Data.Column26", "Data.Column27", "Data.Column28", "Data.Column29", "Data.Column30", "Data.Column31", "Data.Column32", "Data.Column33", "Data.Column34", "Data.Column35", "Data.Column36", "Data.Column37", "Data.Column38", "Data.Column39", "Data.Column40", "Data.Column41", "Data.Column42", "Data.Column43", "Data.Column44", "Data.Column45", "Data.Column46", "Data.Column47", "Data.Column48", "Data.Column49", "Data.Column50", "Data.Column51", "Data.Column52", "Data.Column53", "Data.Column54", "Data.Column55", "Data.Column56", "Data.Column57", "Data.Column58", "Data.Column59", "Data.Column60", "Data.Column61", "Data.Column62", "Data.Column63", "Data.Column64", "Data.Column65", "Data.Column66", "Data.Column67", "Data.Column68", "Data.Column69", "Data.Column70", "Data.Column71", "Data.Column72", "Data.Column73", "Data.Column74", "Data.Column75", "Data.Column76", "Data.Column77", "Data.Column78", "Data.Column79", "Data.Column80", "Data.Column81", "Data.Column82", "Data.Column83", "Data.Column84", "Data.Column85", "Data.Column86", "Data.Column87", "Data.Column88", "Data.Column89", "Data.Column90", "Data.Column91", "Data.Column92", "Data.Column93", "Data.Column94", "Data.Column95", "Data.Column96", "Data.Column97", "Data.Column98", "Data.Column99", "Data.Column100", "Data.Column101", "Data.Column102", "Data.Column103", "Data.Column104", "Data.Column105", "Data.Column106", "Data.Column107", "Data.Column108", "Data.Column109", "Data.Column110", "Data.Column111", "Data.Column112", "Data.Column113", "Data.Column114", "Data.Column115", "Data.Column116", "Data.Column117", "Data.Column118", "Data.Column119"}),
    #"Removed Columns" = Table.RemoveColumns(#"Expanded Data",{"Name", "Item", "Kind", "Hidden"}),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Columns", [PromoteAllScalars=true]),
    #"Replaced Value Null to """"" = Table.ReplaceValue(#"Promoted Headers",null,"",Replacer.ReplaceValue,{"Repair Suffix"}),
    #"Exlude Blank and ""-""" = Table.SelectRows(#"Replaced Value Null to """"", each [#"RT/UT Report No."] <> "-" and [#"RT/UT Report No."] <> ""),
    #"Changed Type" = Table.TransformColumnTypes(#"Exlude Blank and ""-""",{{"Del Flag", type text}, {"Original Joint", type text}, {"Sub-Con Code", type text}, {"Welder No.", type text}, {"Welder Name", type text}, {"Weld Date", type date}, {"Serial No.", Int64.Type}, {"Weld Week", type text}, {"Weld Month", type text}, {"Area Code", type text}, {"Area Group-1", type text}, {"Area Group-2", type text}, {"Area Group-3", type text}, {"Area Group-4", type text}, {"Area Group-5", type text}, {"QC ISO DWG. No.", type text}, {"Sheet No.", Int64.Type}, {"Joint No.", type text}, {"Repair Suffix", type text}, {"Spool No.", type text}, {"Service Class", type text}, {"Pressure Level", type text}, {"Pipe Size", Int64.Type}, {"Wall Thickness", type number}, {"Dia Inch", Int64.Type}, {"Material Category", type text}, {"P No.", Int64.Type}, {"Work Category", type text}, {"Original Work Category", type text}, {"Weld Type", type text}, {"NDT Remarks", type text}, {"Weld Point Code", type text}, {"Welded(Weld Point)", Int64.Type}, {"Weld Remark", type text}, {"Joint Percent", Int64.Type}, {"Welding Process", type text}, {"Welding Position", type text}, {"Welding Rod Type", type text}, {"Tracer Shot", type text}, {"RT/UT", type text}, {"RT/UT Report No.", type text}, {"RT/UT Date", type date}, {"RT Film Total", type number}, {"RT Film Reject", type number}, {"RT/UT Result", type text}, {"RT/UT(%)", Int64.Type}, {"RT/UT Request Date", type text}, {"RT/UT Defect Code", type text}, {"RT/UT Defect Code Class", type text}, {"Reshoot-1 RT/UT Report No.", type text}, {"Reshoot-1 RT/UT Date", type text}, {"Reshoot-1 RT Film Total", type text}, {"Reshoot-1 RT Film Reject", type text}, {"Reshoot-1 RT/UT Result", type text}, {"Reshoot-1 RT/UT Defect Code", type text}, {"Reshoot-1 RT/UT Defect Code Class", type text}, {"Reshoot-2 RT/UT Report No.", type text}, {"Reshoot-2 RT/UT Date", type text}, {"Reshoot-2 RT Film Total", type text}, {"Reshoot-2 RT Film Reject", type text}, {"Reshoot-2 RT/UT Result", type text}, {"Reshoot-2 RT/UT Defect Code", type text}, {"Reshoot-2 RT/UT Defect Code Class", type text}, {"Reshoot-3 RT/UT Report No.", type text}, {"Reshoot-3 RT/UT Date", type text}, {"Reshoot-3 RT Film Total", type text}, {"Reshoot-3 RT Film Reject", type text}, {"Reshoot-3 RT/UT Result", type text}, {"Reshoot-3 RT/UT Defect Code", type text}, {"Reshoot-3 RT/UT Defect Code Class", type text}, {"Reshoot RT/UT Total", type text}, {"Reshoot RT/UT Film Total", type text}, {"Last Reshoot Date", type text}, {"Last Reshoot Report No", type text}, {"Last Reshoot Result", type text}, {"Last Reshoot RT/UT Defect Code", type text}, {"Last Reshoot RT/UT Defect Code Class", type text}, {"RT2/UT2", type text}, {"RT2/UT2 Report No.", type text}, {"RT2/UT2 Date", type text}, {"RT2 Film Total", type text}, {"RT2 Film Reject", type text}, {"RT2/UT2 Result", type text}, {"RT2/UT2(%)", Int64.Type}, {"RT2/UT2 Request Date", type text}, {"RT2/UT2 Defect Code", type text}, {"RT2/UT2 Defect Code Class", type text}, {"Reshoot-1 RT2/UT2 Report No.", type text}, {"Reshoot-1 RT2/UT2 Date", type text}, {"Reshoot-1 RT2 Film Total", type text}, {"Reshoot-1 RT2 Film Reject", type text}, {"Reshoot-1 RT2/UT2 Result", type text}, {"Reshoot-1 RT2/UT2 Defect Code", type text}, {"Reshoot-2 RT2/UT2 Report No.", type text}, {"Reshoot-2 RT2/UT2 Date", type text}, {"Reshoot-2 RT2 Film Total", type text}, {"Reshoot-2 RT2 Film Reject", type text}, {"Reshoot-1 RT2/UT2 Defect Code Class", type text}, {"Reshoot-2 RT2/UT2 Result", type text}, {"Reshoot-2 RT2/UT2 Defect Code", type text}, {"Reshoot-2 RT2/UT2 Defect Code Class", type text}, {"Reshoot-3 RT2/UT2 Report No.", type text}, {"Reshoot-3 RT2/UT2 Date", type text}, {"Reshoot-3 RT2 Film Total", type text}, {"Reshoot-3 RT2 Film Reject", type text}, {"Reshoot-3 RT2/UT2 Result", type text}, {"Reshoot-3 RT2/UT2 Defect Code", type text}, {"Reshoot-3 RT2/UT2 Defect Code Class", type text}, {"Reshoot RT2/UT2 Total", type text}, {"Reshoot RT2/UT2 Film Total", type text}, {"Last Reshoot Date_1", type text}, {"Last Reshoot Report No_2", type text}, {"Last Reshoot Result_3", type text}, {"Last Reshoot RT2/UT2 Defect Code", type text}, {"Last Reshoot RT2/UT2 Defect Code Class", type text}, {"VT Judge", type text}, {"Welding Inspection Identifier Date", type text}, {"Welding Inspection Identifier Client", type text}, {"Welding Inspection Identifier Chiyoda", type text}})
in
    #"Changed Type"
```

### `l3_ndt_spo_summary (2)`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\viktor.savin\OneDrive - Chiyoda Technip Joint Venture\Desktop\PCI Work File\WORK FILES\FRB\l3_ndt_spo_summary.csv"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Replaced Value" = Table.ReplaceValue(#"Promoted Headers","NULL","0",Replacer.ReplaceText,{"SPO_Uploaded_MinDays"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced Value",{{"COD", type date}, {"Sub_Contractor", type text}, {"Report_Type", type text}, {"EP_Total", Int64.Type}, {"Not_Uploaded", Int64.Type}, {"Not_Uploaded_MaxDays", Int64.Type}, {"SPO_Uploaded", Int64.Type}, {"SPO_Uploaded_MinDays", Int64.Type}, {"SPO_Matched_EP", Int64.Type}, {"SPO_Mismatched_EP", Int64.Type}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each ([COD] = #date(2023, 1, 6)))
in
    #"Filtered Rows"
```

### `Man_Power`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Man Power\NDE Man Power Template Query.xlsx"), null, true),
    Man_Power_Table = Source{[Item="Man_Power",Kind="Table"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(Man_Power_Table,{{"Sub", type text}, {"location", type text}, {"NDE", type text}, {"MP", Int64.Type}, {"Date", type date}, {"week", type text}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"location", "Weld Cat"}, {"week", "Week Numb"}})
in
    #"Renamed Columns"
```

### `l3_ndt_spo_summary`

```m
let
    Source = Sql.Databases("CTJVSTSRV06"),
    QC_Database = Source{[Name="QC_Database"]}[Data],
    dbo_l3_ndt_spo_summary = QC_Database{[Schema="dbo",Item="l3_ndt_spo_summary"]}[Data]
in
    dbo_l3_ndt_spo_summary
```

### `PWHT Status`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\WPQ RECORD REGISTER\WPS PWHT Status.xlsx"), null, true),
    #"PWHT Status_Sheet" = Source{[Item="PWHT Status",Kind="Sheet"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(#"PWHT Status_Sheet",{{"Column1", type text}, {"Column2", type text}}),
    #"Promoted Headers" = Table.PromoteHeaders(#"Changed Type", [PromoteAllScalars=true])
in
    #"Promoted Headers"
```

### `Flange ovAssets_1381`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Flange Managment\ovAssets_1381.csv"),[Delimiter=",", Columns=36, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Replaced Value ' for Date" = Table.ReplaceValue(#"Promoted Headers","'","",Replacer.ReplaceText,{"Tightening Date - Field027 (Custom)"}),
    #"Replaced Value   12:00:00 AM" = Table.ReplaceValue(#"Replaced Value ' for Date","12:00:00 AM","",Replacer.ReplaceText,{"Tightening Date - Field027 (Custom)"}),
    #"Replaced Value - to """"" = Table.ReplaceValue(#"Replaced Value   12:00:00 AM","-","",Replacer.ReplaceText,{"TorqueValue"}),
    #"Replaced ' to" = Table.ReplaceValue(#"Replaced Value - to """"","'","",Replacer.ReplaceText,{"Tightening Date - Field027 (Custom)"}),
    #"Replaced 0:00" = Table.ReplaceValue(#"Replaced ' to","0:00","",Replacer.ReplaceText,{"Tightening Date - Field027 (Custom)"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced 0:00",{{"FlangeJointName", type text}, {"WeldAreaName", type text}, {"PipingIsometricNum - Field026 (Custom)", type text}, {"Line No. - Field025 (Custom)", type text}, {"Test Pack No - Field029 (Custom)", type text}, {"Category for final tightening - Field030 (Custom)", type text}, {"Process Plant", type text}, {"Process Area", type text}, {"System", type text}, {"Subsystem", type text}, {"SpecNo", type text}, {"MaterialIDCode", type text}, {"JointSize", type number}, {"GasketType", type text}, {"GasketRating", type text}, {"StudNumber", Int64.Type}, {"StudDiameter", type number}, {"StudLength", type number}, {"TighteningMethod", type text}, {"TorqueValue", type text}, {"TorqueEU", type text}, {"Report Number - Field031 (Custom)", type text}, {"Tightening Date - Field027 (Custom)", type date}, {"Serial No of Field Tag - Field023 (Custom)", type text}, {"Verified Date - Field024 (Custom)", type date}, {"Flange Repair Record - Field032 (Custom)", type text}, {"Re-Tightening Date - Field028 (Custom)", type text}, {"Crew ID - Field034 (Custom)", type text}, {"Stud Material", type text}, {"Nut Material", type text}, {"Parent Asset", type text}, {"RecordLastModifiedBy", type text}, {"RecordLastModified", type datetime}, {"FL - Torque Value", type text}, {"FL - Tightening Method", type text}}),
    #"CCC Added Flange Subcontractor" = Table.AddColumn(#"Changed Type", "Flange Subcontractor", each "CCC"),
    #"Changed Type4" = Table.TransformColumnTypes(#"CCC Added Flange Subcontractor",{{"Re-Tightening Date - Field028 (Custom)", type date}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Changed Type4",{{"RecordLastModified", type date}}),
    #"Renamed to Joint ID" = Table.RenameColumns(#"Changed Type1",{{"FlangeJointName", "Joint ID"}}),
    #"Renamed to Iso Number" = Table.RenameColumns(#"Renamed to Joint ID",{{"PipingIsometricNum - Field026 (Custom)", "Iso Number"}}),
    #"Renamed Test Pack" = Table.RenameColumns(#"Renamed to Iso Number",{{"Test Pack No - Field029 (Custom)", "Test Pack"}}),
    #"Reordered Columns Test Pack" = Table.ReorderColumns(#"Renamed Test Pack",{"Joint ID", "Test Pack", "WeldAreaName", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "System", "Subsystem", "SpecNo", "MaterialIDCode", "JointSize", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "StudLength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed SubSystem" = Table.RenameColumns(#"Reordered Columns Test Pack",{{"Subsystem", "SubSystem"}}),
    #"Reordered Columns" = Table.ReorderColumns(#"Renamed SubSystem",{"Joint ID", "Test Pack", "System", "SubSystem", "WeldAreaName", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "SpecNo", "MaterialIDCode", "JointSize", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "StudLength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed JointSize to Diam" = Table.RenameColumns(#"Reordered Columns",{{"JointSize", "Diam"}}),
    #"Added Custom BT No." = Table.AddColumn(#"Renamed JointSize to Diam", "BT No.", each List.Last(Text.Split([Joint ID], "-"))),
    #"Reordered Columns1" = Table.ReorderColumns(#"Added Custom BT No.",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaName", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "SpecNo", "MaterialIDCode", "Diam", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "StudLength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed Service Class" = Table.RenameColumns(#"Reordered Columns1",{{"SpecNo", "Service Class"}}),
    #"Renamed StudNumber to Bolt Qty" = Table.RenameColumns(#"Renamed Service Class",{{"StudNumber", "Bolt Qty"}}),
    #"Renamed StudDiameter to Bolt Size" = Table.RenameColumns(#"Renamed StudNumber to Bolt Qty",{{"StudDiameter", "Bolt Size"}}),
    #"Renamed StudLength to Bolt Length" = Table.RenameColumns(#"Renamed StudDiameter to Bolt Size",{{"StudLength", "Bolt Length"}}),
    #"Renamed Joint Method" = Table.RenameColumns(#"Renamed StudLength to Bolt Length",{{"FL - Tightening Method", "Joint Method"}}),
    #"Renamed Jointing Value" = Table.RenameColumns(#"Renamed Joint Method",{{"FL - Torque Value", "Jointing Value"}}),
    #"Reordered Columns2" = Table.ReorderColumns(#"Renamed Jointing Value",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaName", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "GasketType", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Removed  ""TighteningMethod"", ""TorqueValue""" = Table.RemoveColumns(#"Reordered Columns2",{"TighteningMethod", "TorqueValue"}),
    #"Renamed Report Nbr" = Table.RenameColumns(#"Removed  ""TighteningMethod"", ""TorqueValue""",{{"Report Number - Field031 (Custom)", "Report Nbr"}}),
    #"Renamed  Joint Date" = Table.RenameColumns(#"Renamed Report Nbr",{{"Tightening Date - Field027 (Custom)", "Joint Date"}}),
    #"Reordered Columns3" = Table.ReorderColumns(#"Renamed  Joint Date",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaName", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "GasketType", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Renamed Tag Nbr" = Table.RenameColumns(#"Reordered Columns3",{{"Serial No of Field Tag - Field023 (Custom)", "Tag Nbr"}}),
    #"Renamed Stud Material Bolt Desc." = Table.RenameColumns(#"Renamed Tag Nbr",{{"Stud Material", "Bolt Desc."}}),
    #"Renamed Gasket Desc." = Table.RenameColumns(#"Renamed Stud Material Bolt Desc.",{{"GasketType", "Gasket Desc."}}),
    #"Added Commissioning Package" = Table.AddColumn(#"Renamed Gasket Desc.", "Commissioning Package", each ""),
    #"Reordered Columns4" = Table.ReorderColumns(#"Added Commissioning Package",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "BT No.", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Rev No." = Table.AddColumn(#"Reordered Columns4", "Rev No.", each ""),
    #"Reordered Columns5" = Table.ReorderColumns(#"Added Rev No.",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "BT No.", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Sheet No." = Table.AddColumn(#"Reordered Columns5", "Sheet No.", each ""),
    #"Reordered Columns6" = Table.ReorderColumns(#"Added Sheet No.",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Reordered Columns6",{{"Sheet No.", Int64.Type}}),
    #"Added Joint Point" = Table.AddColumn(#"Changed Type2", "Joint Point", each ""),
    #"Reordered Columns7" = Table.ReorderColumns(#"Added Joint Point",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Rating" = Table.AddColumn(#"Reordered Columns7", "Rating", each ""),
    #"Reordered Columns8" = Table.ReorderColumns(#"Added Rating",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Gasket Desc.", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Bolt Ident" = Table.AddColumn(#"Reordered Columns8", "Bolt Ident", each ""),
    #"Reordered Columns9" = Table.ReorderColumns(#"Added Bolt Ident",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Lubricant Type" = Table.AddColumn(#"Reordered Columns9", "Lubricant Type", each ""),
    #"Reordered Columns10" = Table.ReorderColumns(#"Added Lubricant Type",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Service Type" = Table.AddColumn(#"Reordered Columns10", "Service Type", each ""),
    #"Reordered Columns11" = Table.ReorderColumns(#"Added Service Type",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added UT" = Table.AddColumn(#"Reordered Columns11", "UT", each ""),
    #"Reordered Columns12" = Table.ReorderColumns(#"Added UT",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "WeldAreaName", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Renamed Cat." = Table.RenameColumns(#"Reordered Columns12",{{"Category for final tightening - Field030 (Custom)", "Cat."}}),
    #"Added Joint Timing" = Table.AddColumn(#"Renamed Cat.", "Joint Timing", each if [#"Cat."] = "X" then "Before Pressure Test" else if [#"Cat."] = "Y" then "Before Precom" else if [#"Cat."] = "Z" then "After Precom" else "TBN"),
    #"Reordered Columns13" = Table.ReorderColumns(#"Added Joint Timing",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "WeldAreaName", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Reason" = Table.AddColumn(#"Reordered Columns13", "Reason", each ""),
    #"Reordered Columns14" = Table.ReorderColumns(#"Added Reason",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "WeldAreaName", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Jointer" = Table.AddColumn(#"Reordered Columns14", "Jointer", each ""),
    #"Reordered Columns15" = Table.ReorderColumns(#"Added Jointer",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "WeldAreaName", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    Custom2 = #"Reordered Columns15",
    #"Added Tightening Tool Id" = Table.AddColumn(Custom2, "Tightening Tool Id", each ""),
    #"Added Control %" = Table.AddColumn(#"Added Tightening Tool Id", "Control %", each ""),
    #"Added Flange Batch No" = Table.AddColumn(#"Added Control %", "Flange Batch No", each ""),
    #"Added Selected Date" = Table.AddColumn(#"Added Flange Batch No", "Selected Date", each ""),
    #"Added Issued Date" = Table.AddColumn(#"Added Selected Date", "Issued Date", each ""),
    #"Added Issue Request No" = Table.AddColumn(#"Added Issued Date", "Issue Request No", each ""),
    #"Added Batch Status" = Table.AddColumn(#"Added Issue Request No", "Batch Status", each ""),
    #"Added Flange Joint Status" = Table.AddColumn(#"Added Batch Status", "Flange Joint Status", each ""),
    #"Added Control Inspection Report No" = Table.AddColumn(#"Added Flange Joint Status", "Control Inspection Report No", each ""),
    #"Added Control Inspection Date" = Table.AddColumn(#"Added Control Inspection Report No", "Control Inspection Date", each ""),
    #"Added Status - A/R" = Table.AddColumn(#"Added Control Inspection Date", "Status - A/R", each ""),
    #"Added Client Requested" = Table.AddColumn(#"Added Status - A/R", "Client Requested", each ""),
    #"Added Reason for De-Tightening" = Table.AddColumn(#"Added Client Requested", "Reason for De-Tightening", each ""),
    #"Added User requested for De-Tightening" = Table.AddColumn(#"Added Reason for De-Tightening", "User requested for De-Tightening", each ""),
    #"Added Hold Status" = Table.AddColumn(#"Added User requested for De-Tightening", "Hold Status", each ""),
    #"Added Hold Date" = Table.AddColumn(#"Added Hold Status", "Hold Date", each ""),
    #"Added Hold Comments" = Table.AddColumn(#"Added Hold Date", "Hold Comments", each ""),
    #"Renamed De-Tightening Requested Date" = Table.RenameColumns(#"Added Hold Comments",{{"Re-Tightening Date - Field028 (Custom)", "De-Tightening Requested Date"}}),
    #"Reordered Columns16" = Table.ReorderColumns(#"Renamed De-Tightening Requested Date",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "Tightening Tool Id", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Client Requested", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Hold Status", "Hold Date", "Hold Comments", "Flange Subcontractor", "WeldAreaName", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Added WITNESSED BY" = Table.AddColumn(#"Reordered Columns16", "WITNESSED BY", each ""),
    #"Added ACC/REJ" = Table.AddColumn(#"Added WITNESSED BY", "ACC/REJ", each ""),
    #"Added REMARKS" = Table.AddColumn(#"Added ACC/REJ", "REMARKS", each ""),
    #"Added BTC01" = Table.AddColumn(#"Added REMARKS", "BTC01", each ""),
    #"Added BT24" = Table.AddColumn(#"Added BTC01", "BT24", each ""),
    #"Renamed PDS Area" = Table.RenameColumns(#"Added BT24",{{"WeldAreaName", "PDS Area"}}),
    #"Reordered Columns17" = Table.ReorderColumns(#"Renamed PDS Area",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tightening Tool Id", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Client Requested", "Hold Date", "Hold Comments", "Hold Status", "Flange Subcontractor", "ACC/REJ", "REMARKS", "BTC01", "BT24", "WITNESSED BY", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Replaced torqueing to torquing" = Table.ReplaceValue(#"Reordered Columns17","Torqueing","Torquing",Replacer.ReplaceText,{"Joint Method"}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Replaced torqueing to torquing",{{"Joint Point", type text}, {"Rating", Int64.Type}, {"UT", Int64.Type}, {"Jointer", type text}, {"Control %", Int64.Type}, {"Selected Date", type date}, {"Issued Date", type date}, {"Control Inspection Date", type date}, {"Hold Date", type date}}),
    #"Reordered Columns18" = Table.ReorderColumns(#"Changed Type3",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tightening Tool Id", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Status - A/R", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Client Requested", "Hold Date", "Hold Comments", "Hold Status", "Flange Subcontractor", "PDS Area", "ACC/REJ", "REMARKS", "BTC01", "BT24", "WITNESSED BY", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Added Joint Method Original" = Table.AddColumn(#"Reordered Columns18", "Joint Method Original", each [Joint Method]),
    #"Replaced CAT null to TBN" = Table.ReplaceValue(#"Added Joint Method Original","","TBN",Replacer.ReplaceValue,{"Cat."}),
    Custom1 = #"Replaced CAT null to TBN",
    #"Removed Columns" = Table.RemoveColumns(Custom1,{"Jointer"}),
    #"Crew ID Jointer" = Table.RenameColumns(#"Removed Columns",{{"Crew ID - Field034 (Custom)", "Jointer"}}),
    #"Reordered Columns19" = Table.ReorderColumns(#"Crew ID Jointer",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Re-Tightening Report Number - Field032 (Custom)", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Tightening Tool Id", "Jointer", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Status - A/R", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Client Requested", "Hold Date", "Hold Comments", "Hold Status", "Flange Subcontractor", "PDS Area", "ACC/REJ", "REMARKS", "BTC01", "BT24", "WITNESSED BY", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Joint Method Original"}),
    #"Renamed Re to De-Tightening" = Table.RenameColumns(#"Reordered Columns19",{{"Re-Tightening Report Number - Field032 (Custom)", "De-Tightening Report Number"}}),
    #"Reordered Columns20" = Table.ReorderColumns(#"Renamed Re to De-Tightening",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Tightening Tool Id", "Jointer", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Status - A/R", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Report Number", "De-Tightening Requested Date", "Client Requested", "Hold Date", "Hold Comments", "Hold Status", "Flange Subcontractor", "PDS Area", "ACC/REJ", "REMARKS", "BTC01", "BT24", "WITNESSED BY", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Joint Method Original"}),
    #"Changed Type Jointing Value" = Table.TransformColumnTypes(#"Reordered Columns20",{{"Jointing Value", type text}, {"GasketRating", type text}}),
    #"Replaced Blank to TBN" = Table.ReplaceValue(#"Changed Type Jointing Value","","TBN",Replacer.ReplaceValue,{"Joint Method Original"}),
    #"Replaced Blank to TBN 2" = Table.ReplaceValue(#"Replaced Blank to TBN","","TBN",Replacer.ReplaceValue,{"Joint Method"}),
    Custom3 = #"Replaced Blank to TBN 2",
    #"Filtered Rows 1 joint" = Table.SelectRows(Custom3, each [Joint ID] = "11010P1-CV6206101A-J01")
in
    #"Filtered Rows 1 joint"
```

### `HA l0_abs_guide`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\HA\l0_abs_guide_202502191028.csv"),[Delimiter=",", Columns=13, Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Handover Area", type text}, {"Location Number", type text}, {"Location Name", type text}, {"Location Summary", type text}, {"Area Number", type text}, {"Area Name", type text}, {"Area Summary", type text}, {"Facility Number", type text}, {"Facility Name", type text}, {"Facility Summary", type text}, {"Project Number", type text}, {"Project Name", type text}, {"Project Summary", type text}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each true)
in
    #"Filtered Rows"
```

### `WPS Reg#`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\WPQ RECORD REGISTER\WPS-WPQT Record Register Rev_0 24-01-25.xls"), null, true),
    #"WPS Reg#1" = Source{[Name="WPS Reg#"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(#"WPS Reg#1",{{"Column1", type text}, {"Column2", type text}, {"Column3", type text}, {"Column4", type text}, {"Column5", type text}, {"Column6", type text}, {"Column7", type text}, {"Column8", type text}, {"Column9", type text}, {"Column10", type text}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type text}, {"Column18", type text}, {"Column19", type text}, {"Column20", type text}, {"Column21", type text}, {"Column22", type text}, {"Column23", type text}, {"Column24", type text}, {"Column25", type text}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",5),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers",{{"S.N", type text}, {"WPS NO.", type text}, {"WPS#(lf)Document No/Rev.#(lf)OLD DOC. NO", type text}, {"WPS Rev. No.", Int64.Type}, {"PQR #(lf)No/Rev.", type text}, {"WELDING PROCESS (ES)", type text}, {"Column7", type text}, {"PQR Material #(lf)Seamless / Welder Pipes & Plate", type text}, {"Column9", type text}, {"Actual PQR ", type text}, {"Column11", type text}, {"Column12", type text}, {"Design#(lf) Code", type text}, {"WELDING CONSUMABLES#(lf)API582", type text}, {"WELDING #(lf)POSITION", type text}, {"IMPACT", type text}, {"PWHT/#(lf)NACE  ", type text}, {"Qualified Material ", type text}, {"Qualified Range#(lf)min.", type text}, {"Qualified Range Max.", type text}, {"Qualified #(lf)welding #(lf)Position", type text}, {"Pre-Heat", type text}, {"Line Class", type text}, {"DocumentStatus", type text}, {"PREQUALIED /NEW PQR", type text}}),
    #"Added Material Type" = Table.AddColumn(#"Changed Type1", "Material Type", each if Text.Contains([#"WPS NO."], "CS/LTCS") then "CS/LTCS" else if Text.Contains([#"WPS NO."], "AL") then "CS Aluminized" else if Text.Contains([#"WPS NO."], "316-SS") then "STAINLESS STEEL 316L" else if Text.Contains([#"WPS NO."], "410-SS") then "STAINLESS STEEL 304L" else if Text.Contains([#"WPS NO."], "304-SS") then "STAINLESS STEEL 304L" else if Text.Contains([#"WPS NO."], "CU") then "CU NI" else if Text.Contains([#"WPS NO."], "LA") then "LALLOY" else if Text.Contains([#"WPS NO."], "DS") then "DISSIMILAR WELDING" else if Text.Contains([#"WPS NO."], "ST") then "STRUCTURAL STEEL AWS D1.1" else if Text.Contains([#"WPS NO."], "B") then "BRAZING" else null),
    #"Reordered Columns" = Table.ReorderColumns(#"Added Material Type",{"S.N", "Material Type", "WPS NO.", "WPS#(lf)Document No/Rev.#(lf)OLD DOC. NO", "WPS Rev. No.", "PQR #(lf)No/Rev.", "WELDING PROCESS (ES)", "Column7", "PQR Material #(lf)Seamless / Welder Pipes & Plate", "Column9", "Actual PQR ", "Column11", "Column12", "Design#(lf) Code", "WELDING CONSUMABLES#(lf)API582", "WELDING #(lf)POSITION", "IMPACT", "PWHT/#(lf)NACE  ", "Qualified Material ", "Qualified Range#(lf)min.", "Qualified Range Max.", "Qualified #(lf)welding #(lf)Position", "Pre-Heat", "Line Class", "DocumentStatus", "PREQUALIED /NEW PQR"}),
    #"Filtered Rows" = Table.SelectRows(#"Reordered Columns", each ([S.N] <> " CU NI" and [S.N] <> "BRAZING " and [S.N] <> "CS Aluminized" and [S.N] <> "CS/LTCS" and [S.N] <> "DISSIMILAR WELDING " and [S.N] <> "LALLOY" and [S.N] <> "STAINLESS STEEL  304L" and [S.N] <> "STAINLESS STEEL  316L  " and [S.N] <> "STRUCTURAL STEEL AWS D1.1")),
    #"Renamed Columns" = Table.RenameColumns(#"Filtered Rows",{{"PQR Material #(lf)Seamless / Welder Pipes & Plate", "PQR Material #(lf)Seamless / Welder Pipes & Plate Mat.1"}, {"Column9", "PQR Material Seamless / Welder Pipes & Plate Mat.2"}, {"Actual PQR ", "Actual PQR THICKNESS MM"}, {"Column11", "Actual PQR DIA MM"}, {"Column12", "Actual PQR DIA IN"}, {"WELDING #(lf)POSITION", "WELDING #(lf)POSITION/PROGRESSION"}, {"Column7", "WELDING PROCESS (ES)2"}}),
    #"Exlude 1 row" = Table.SelectRows(#"Renamed Columns", each ([#"PQR Material Seamless / Welder Pipes & Plate Mat.2"] <> "Mat. 2") and ([S.N] <> null)),
    #"Changed Type2" = Table.TransformColumnTypes(#"Exlude 1 row",{{"S.N", Int64.Type}}),
    #"Replaced Value3" = Table.ReplaceValue(#"Changed Type2","#(lf)"," ",Replacer.ReplaceText,{"PQR #(lf)No/Rev."}),
    #"Trimmed Text" = Table.TransformColumns(#"Replaced Value3",{{"WPS#(lf)Document No/Rev.#(lf)OLD DOC. NO", Text.Trim, type text}})
in
    #"Trimmed Text"
```

### `Flange ovAssets_1510`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Flange Managment\ovAssets_1510.csv"),[Delimiter=",", Columns=37, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    Custom3 = Source,
    #"Replaced Value 027 '" = Table.ReplaceValue(Custom3,"'","",Replacer.ReplaceText,{"Column24"}),
    #"Replaced Value 12:00:00 AM" = Table.ReplaceValue(#"Replaced Value 027 '","12:00:00 AM","",Replacer.ReplaceText,{"Column24"}),
    #"Promoted Headers" = Table.PromoteHeaders(#"Replaced Value 12:00:00 AM", [PromoteAllScalars=true]),
    #"Changed Type5" = Table.TransformColumnTypes(#"Promoted Headers",{{"Tightening Date - Field027 (Custom)", type date}}),
    #"Added Custom 027 New" = Table.AddColumn(#"Changed Type5", "Tightening Date - Field027 (Custom)NEW", each try Date.From([Column24]) 
otherwise 
try Date.From(
    // Если первая попытка (обычное преобразование) неудачна,
    // пытаемся принудительно изменить разделитель на универсальный формат.
    Text.Replace(
        Text.Replace(
            [Column24], 
            "/", 
            "-"
        ), 
        ".", 
        "-"
    )
)
otherwise 
null),
    #"Changed Type5 027 New" = Table.TransformColumnTypes(#"Added Custom 027 New",{{"Tightening Date - Field027 (Custom)NEW", type date}}),
    #"Changed Type5 027 New 2" = #"Changed Type5 027 New",
    #"Replaced Value - to """"" = Table.ReplaceValue(#"Changed Type5 027 New 2","-","",Replacer.ReplaceText,{"TorqueValue"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Replaced Value - to """"",{{"FlangeJointName", type text}, {"WeldAreaname", type text}, {"PipingIsometricNum - Field026(Custom)", type text}, {"Lineno. - Field025(Custom)", type text}, {"Test Pack No - Field029(Custom)", type text}, {"Category for final tightening - Field030(Custom)", type text}, {"Process Plant", type text}, {"Process Area", type text}, {"System", type text}, {"Subsystem", type text}, {"SpecNo", type text}, {"MateriallDCode", type text}, {"JointSize", type number}, {"GasketType", type text}, {"GasketRating", type text}, {"StudNumber", Int64.Type}, {"StudDiameter", type number}, {"Studlength", type number}, {"TighteningMethod", type text}, {"TorqueValue", type text}, {"TorqueEU", type text}, {"Report Number - Field031 (Custom)", type text}, {"Tightening Date - Field027 (Custom)", type date}, {"Serial No of Field Tag - Field023 (Custom)", type text}, {"Verified Date - Field024 (Custom)", type date}, {"Flange Repair Record - Field032 (Custom)", type text}, {"Re-Tightening Date - Field028 (Custom)", type text}, {"Crew ID - Field034 (Custom)", type text}, {"Stud Material", type text}, {"Nut Material", type text}, {"Parent Asset", type text}, {"RecordLastModifiedBy", type text}, {"RecordLastModified", type datetime}, {"FL - Torque Value", type text}, {"FL - Tightening Method", type text}}),
    #"Added Flange Subcontractor" = Table.AddColumn(#"Changed Type", "Flange Subcontractor", each ""),
    #"Changed Type4" = Table.TransformColumnTypes(#"Added Flange Subcontractor",{{"Re-Tightening Date - Field028 (Custom)", type date}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Changed Type4",{{"RecordLastModified", type date}}),
    #"Renamed to Joint ID" = Table.RenameColumns(#"Changed Type1",{{"FlangeJointName", "Joint ID"}}),
    #"Renamed to Iso Number" = Table.RenameColumns(#"Renamed to Joint ID",{{"PipingIsometricNum - Field026(Custom)", "Iso Number"}}),
    #"Renamed Test Pack" = Table.RenameColumns(#"Renamed to Iso Number",{{"Test Pack No - Field029(Custom)", "Test Pack"}}),
    #"Reordered Columns Test Pack" = Table.ReorderColumns(#"Renamed Test Pack",{"Joint ID", "Test Pack", "WeldAreaname", "Iso Number", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "System", "Subsystem", "SpecNo", "MateriallDCode", "JointSize", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "Studlength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed SubSystem" = Table.RenameColumns(#"Reordered Columns Test Pack",{{"Subsystem", "SubSystem"}}),
    #"Reordered Columns" = Table.ReorderColumns(#"Renamed SubSystem",{"Joint ID", "Test Pack", "System", "SubSystem", "WeldAreaname", "Iso Number", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "SpecNo", "MateriallDCode", "JointSize", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "Studlength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed JointSize to Diam" = Table.RenameColumns(#"Reordered Columns",{{"JointSize", "Diam"}}),
    #"Added Custom BT No." = Table.AddColumn(#"Renamed JointSize to Diam", "BT No.", each List.Last(Text.Split([Joint ID], "-"))),
    #"Reordered Columns1" = Table.ReorderColumns(#"Added Custom BT No.",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaname", "Iso Number", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "SpecNo", "MateriallDCode", "Diam", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "Studlength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed Service Class" = Table.RenameColumns(#"Reordered Columns1",{{"SpecNo", "Service Class"}}),
    #"Renamed StudNumber to Bolt Qty" = Table.RenameColumns(#"Renamed Service Class",{{"StudNumber", "Bolt Qty"}}),
    #"Renamed StudDiameter to Bolt Size" = Table.RenameColumns(#"Renamed StudNumber to Bolt Qty",{{"StudDiameter", "Bolt Size"}}),
    #"Renamed Studlength to Bolt Length" = Table.RenameColumns(#"Renamed StudDiameter to Bolt Size",{{"Studlength", "Bolt Length"}}),
    #"Renamed Joint Method" = Table.RenameColumns(#"Renamed Studlength to Bolt Length",{{"FL - Tightening Method", "Joint Method"}}),
    #"Renamed Jointing Value" = Table.RenameColumns(#"Renamed Joint Method",{{"FL - Torque Value", "Jointing Value"}}),
    #"Reordered Columns2" = Table.ReorderColumns(#"Renamed Jointing Value",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaname", "Iso Number", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "Service Class", "MateriallDCode", "Diam", "GasketType", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Renamed Report Nbr" = Table.RenameColumns(#"Reordered Columns2",{{"Report Number - Field031 (Custom)", "Report Nbr"}}),
    #"Renamed  Joint Date" = Table.RenameColumns(#"Renamed Report Nbr",{{"Tightening Date - Field027 (Custom)", "Joint Date"}}),
    #"Reordered Columns3" = Table.ReorderColumns(#"Renamed  Joint Date",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaname", "Iso Number", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "Service Class", "MateriallDCode", "Diam", "GasketType", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Renamed Tag Nbr" = Table.RenameColumns(#"Reordered Columns3",{{"Serial No of Field Tag - Field023 (Custom)", "Tag Nbr"}}),
    #"Renamed Stud Material Bolt Desc." = Table.RenameColumns(#"Renamed Tag Nbr",{{"Stud Material", "Bolt Desc."}}),
    #"Renamed Gasket Desc." = Table.RenameColumns(#"Renamed Stud Material Bolt Desc.",{{"GasketType", "Gasket Desc."}}),
    #"Added Commissioning Package" = Table.AddColumn(#"Renamed Gasket Desc.", "Commissioning Package", each ""),
    #"Reordered Columns4" = Table.ReorderColumns(#"Added Commissioning Package",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "BT No.", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "Service Class", "MateriallDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Rev No." = Table.AddColumn(#"Reordered Columns4", "Rev No.", each ""),
    #"Reordered Columns5" = Table.ReorderColumns(#"Added Rev No.",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "BT No.", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "Service Class", "MateriallDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Sheet No." = Table.AddColumn(#"Reordered Columns5", "Sheet No.", each ""),
    #"Reordered Columns6" = Table.ReorderColumns(#"Added Sheet No.",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "Service Class", "MateriallDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Reordered Columns6",{{"Sheet No.", Int64.Type}}),
    #"Added Joint Point" = Table.AddColumn(#"Changed Type2", "Joint Point", each ""),
    #"Reordered Columns7" = Table.ReorderColumns(#"Added Joint Point",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "Service Class", "MateriallDCode", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Rating" = Table.AddColumn(#"Reordered Columns7", "Rating", each ""),
    #"Reordered Columns8" = Table.ReorderColumns(#"Added Rating",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "Service Class", "MateriallDCode", "Gasket Desc.", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Bolt Ident" = Table.AddColumn(#"Reordered Columns8", "Bolt Ident", each ""),
    #"Reordered Columns9" = Table.ReorderColumns(#"Added Bolt Ident",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Lubricant Type" = Table.AddColumn(#"Reordered Columns9", "Lubricant Type", each ""),
    #"Reordered Columns10" = Table.ReorderColumns(#"Added Lubricant Type",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Service Type" = Table.AddColumn(#"Reordered Columns10", "Service Type", each ""),
    #"Reordered Columns11" = Table.ReorderColumns(#"Added Service Type",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added UT" = Table.AddColumn(#"Reordered Columns11", "UT", each ""),
    #"Reordered Columns12" = Table.ReorderColumns(#"Added UT",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "WeldAreaname", "Lineno. - Field025(Custom)", "Category for final tightening - Field030(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Renamed Cat." = Table.RenameColumns(#"Reordered Columns12",{{"Category for final tightening - Field030(Custom)", "Cat."}}),
    #"Added Joint Timing" = Table.AddColumn(#"Renamed Cat.", "Joint Timing", each if [#"Cat."] = "X" then "Before Pressure Test" else if [#"Cat."] = "Y" then "Before Precom" else if [#"Cat."] = "Z" then "After Precom" else "TBN"),
    #"Reordered Columns13" = Table.ReorderColumns(#"Added Joint Timing",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "WeldAreaname", "Lineno. - Field025(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Reason" = Table.AddColumn(#"Reordered Columns13", "Reason", each ""),
    #"Reordered Columns14" = Table.ReorderColumns(#"Added Reason",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "WeldAreaname", "Lineno. - Field025(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Jointer" = Table.AddColumn(#"Reordered Columns14", "Jointer", each ""),
    #"Reordered Columns15" = Table.ReorderColumns(#"Added Jointer",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "WeldAreaname", "Lineno. - Field025(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    Custom2 = #"Reordered Columns15",
    #"Added Tightening Tool Id" = Table.AddColumn(Custom2, "Tightening Tool Id", each ""),
    #"Added Control %" = Table.AddColumn(#"Added Tightening Tool Id", "Control %", each ""),
    #"Added Flange Batch No" = Table.AddColumn(#"Added Control %", "Flange Batch No", each ""),
    #"Added Selected Date" = Table.AddColumn(#"Added Flange Batch No", "Selected Date", each ""),
    #"Added Issued Date" = Table.AddColumn(#"Added Selected Date", "Issued Date", each ""),
    #"Added Issue Request No" = Table.AddColumn(#"Added Issued Date", "Issue Request No", each ""),
    #"Added Batch Status" = Table.AddColumn(#"Added Issue Request No", "Batch Status", each ""),
    #"Added Flange Joint Status" = Table.AddColumn(#"Added Batch Status", "Flange Joint Status", each ""),
    #"Added Control Inspection Report No" = Table.AddColumn(#"Added Flange Joint Status", "Control Inspection Report No", each ""),
    #"Added Control Inspection Date" = Table.AddColumn(#"Added Control Inspection Report No", "Control Inspection Date", each ""),
    #"Added Status - A/R" = Table.AddColumn(#"Added Control Inspection Date", "Status - A/R", each ""),
    #"Added Client Requested" = Table.AddColumn(#"Added Status - A/R", "Client Requested", each ""),
    #"Added Reason for De-Tightening" = Table.AddColumn(#"Added Client Requested", "Reason for De-Tightening", each ""),
    #"Added User requested for De-Tightening" = Table.AddColumn(#"Added Reason for De-Tightening", "User requested for De-Tightening", each ""),
    #"Added Hold Status" = Table.AddColumn(#"Added User requested for De-Tightening", "Hold Status", each ""),
    #"Added Hold Date" = Table.AddColumn(#"Added Hold Status", "Hold Date", each ""),
    #"Added Hold Comments" = Table.AddColumn(#"Added Hold Date", "Hold Comments", each ""),
    #"Renamed De-Tightening Requested Date" = Table.RenameColumns(#"Added Hold Comments",{{"Re-Tightening Date - Field028 (Custom)", "De-Tightening Requested Date"}}),
    #"Reordered Columns16" = Table.ReorderColumns(#"Renamed De-Tightening Requested Date",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "Tightening Tool Id", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Client Requested", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Hold Status", "Hold Date", "Hold Comments", "Flange Subcontractor", "WeldAreaname", "Lineno. - Field025(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Added WITNESSED BY" = Table.AddColumn(#"Reordered Columns16", "WITNESSED BY", each ""),
    #"Added ACC/REJ" = Table.AddColumn(#"Added WITNESSED BY", "ACC/REJ", each ""),
    #"Added REMARKS" = Table.AddColumn(#"Added ACC/REJ", "REMARKS", each ""),
    #"Added BTC01" = Table.AddColumn(#"Added REMARKS", "BTC01", each ""),
    #"Added BT24" = Table.AddColumn(#"Added BTC01", "BT24", each ""),
    #"Renamed PDS Area" = Table.RenameColumns(#"Added BT24",{{"WeldAreaname", "PDS Area"}}),
    #"Reordered Columns17" = Table.ReorderColumns(#"Renamed PDS Area",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tightening Tool Id", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Client Requested", "Hold Date", "Hold Comments", "Hold Status", "Flange Subcontractor", "ACC/REJ", "REMARKS", "BTC01", "BT24", "WITNESSED BY", "Lineno. - Field025(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Replaced torqueing to torquing" = Table.ReplaceValue(#"Reordered Columns17","Torqueing","Torquing",Replacer.ReplaceText,{"Joint Method"}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Replaced torqueing to torquing",{{"Joint Point", type text}, {"Rating", Int64.Type}, {"UT", Int64.Type}, {"Jointer", type text}, {"Control %", Int64.Type}, {"Selected Date", type date}, {"Issued Date", type date}, {"Control Inspection Date", type date}, {"Hold Date", type date}}),
    #"Removed Control Inspection Date" = Table.RemoveColumns(#"Changed Type3",{"Control Inspection Date"}),
    #"Renamed Verified Date to Control Inspection Date" = Table.RenameColumns(#"Removed Control Inspection Date",{{"Verified Date - Field024 (Custom)", "Control Inspection Date"}}),
    #"Reordered Columns18" = Table.ReorderColumns(#"Renamed Verified Date to Control Inspection Date",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tightening Tool Id", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Client Requested", "Hold Date", "Hold Comments", "Hold Status", "Flange Subcontractor", "PDS Area", "ACC/REJ", "REMARKS", "BTC01", "BT24", "WITNESSED BY", "Lineno. - Field025(Custom)", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Added Joint Method Original" = Table.AddColumn(#"Reordered Columns18", "Joint Method Original", each [Joint Method]),
    #"Replaced CAT null to TBN" = Table.ReplaceValue(#"Added Joint Method Original","","TBN",Replacer.ReplaceValue,{"Cat."}),
    #"Reordered Columns19" = Table.ReorderColumns(#"Replaced CAT null to TBN",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Lineno. - Field025(Custom)", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Client Requested", "Hold Status", "Flange Subcontractor", "WITNESSED BY", "REMARKS", "Tightening Tool Id", "ACC/REJ", "Hold Date", "Hold Comments", "BTC01", "BT24", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "PDS Area", "Joint Method Original", "Construction Responsible Company - Field021 (Custom)", "Commissioning Responsible Company - Field022 (Custom)"}),
    #"Replaced Errors" = Table.ReplaceErrorValues(#"Reordered Columns19", {{"Jointing Value", null}}),
    #"Reordered Columns20" = Table.ReorderColumns(#"Replaced Errors",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Lineno. - Field025(Custom)", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Crew ID - Field034 (Custom)", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Client Requested", "Hold Status", "Flange Subcontractor", "WITNESSED BY", "REMARKS", "Tightening Tool Id", "ACC/REJ", "Hold Date", "Hold Comments", "BTC01", "BT24", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Process Plant", "Process Area", "MateriallDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "PDS Area", "Joint Method Original", "Construction Responsible Company - Field021 (Custom)", "Commissioning Responsible Company - Field022 (Custom)"}),
    #"Removed Columns" = Table.RemoveColumns(#"Reordered Columns20",{"Jointer"}),
    #"Renamed Crew ID to Jointer" = Table.RenameColumns(#"Removed Columns",{{"Crew ID - Field034 (Custom)", "Jointer"}}),
    #"Replaced TighteningMethod" = Table.ReplaceValue(#"Renamed Crew ID to Jointer","Manual Torquing","Manual",Replacer.ReplaceText,{"TighteningMethod"}),
    #"Replaced TighteningMethod 2" = Table.ReplaceValue(#"Replaced TighteningMethod","Torqueing","Torquing",Replacer.ReplaceText,{"TighteningMethod"}),
    #"Replaced TighteningMethod 3" = Table.ReplaceValue(#"Replaced TighteningMethod 2","Torquing Critical","Torquing",Replacer.ReplaceText,{"TighteningMethod"}),
    #"Replaced TighteningMethod 4" = Table.ReplaceValue(#"Replaced TighteningMethod 3","Hydraulic Torquing","Torquing",Replacer.ReplaceText,{"TighteningMethod"}),
    #"Renamed ighteningMethod to Joint Method" = Table.RenameColumns(#"Replaced TighteningMethod 4",{{"TighteningMethod", "Joint Method*"}})
in
    #"Renamed ighteningMethod to Joint Method"
```

### `SCDB Data l0_scdb_task`

```m
let
    Source = Sql.Databases("CTJVSTSRV06"),
    QC_Database = Source{[Name="QC_Database"]}[Data],
    dbo_l0_scdb_task = QC_Database{[Schema="dbo",Item="l1_scdb_task"]}[Data],
    #"Added ""FWC""" = Table.AddColumn(dbo_l0_scdb_task, "FWC", each Text.BeforeDelimiter([fwc_description], " -")),
    #"Added ""Sub-Contractor""" = Table.AddColumn(#"Added ""FWC""", "Sub-Contractor", each if Text.Contains([Responsible_Company_Summary], "NFE_Consolidated Contractor Group - Consolidated Contractor Group - Doha W.L.L.") then "CCC" else if Text.Contains([Responsible_Company_Summary], "NFE_Gulf Asia Contracting - Gulf Asia Contracting LLC") then "GAC" else if Text.Contains([Responsible_Company_Summary], "NFE_Tekfen - Tekfen Construction & Installation Co. Inc.") then "TEKFEN" else if Text.Contains([Responsible_Company_Summary], "NFE_Medgulf CC WLL - Medgulf Construction Company WLL") then "MEDGULF" else if Text.Contains([Responsible_Company_Summary], "NFE_Hamad Bin Khalid CC WLL - Hamad Bin Khalid (HBK) Contracting Company WLL") then "HBK" else if Text.Contains([Responsible_Company_Summary], "NFE_Acciona Agua - Acciona Agua") then "Acciona" else null),
    #"Filtered Rows PIP-018-A" = Table.SelectRows(#"Added ""Sub-Contractor""", each ([ITR_form] = "PIP-018-A"))
in
    #"Filtered Rows PIP-018-A"
```

### `Testpack-wise Details Report`

```m
let
    // Загрузка данных из первого файла
    Source1 = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Flange Managment\1.GAC Testpack-wise Details Report.xlsx"), null, true),
    Table1 = Source1{[Item="Sheet1", Kind="Sheet"]}[Data],

    // Загрузка данных из второго файла
    Source2 = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Flange Managment\2.TKF+MED Testpack-wise Details Report.xlsx"), null, true),
    Table2 = Source2{[Item="Sheet1", Kind="Sheet"]}[Data],

    // Объединение таблиц
    Combined = Table.Combine({Table1, Table2}),
    #"Removed Top Rows" = Table.Skip(Combined,6),
    #"Removed Columns 45- 258" = Table.RemoveColumns(#"Removed Top Rows",{"Column45", "Column46", "Column47", "Column48", "Column49", "Column50", "Column51", "Column52", "Column53", "Column54", "Column55", "Column56", "Column57", "Column58", "Column59", "Column60", "Column61", "Column62", "Column63", "Column64", "Column65", "Column66", "Column67", "Column68", "Column69", "Column70", "Column71", "Column72", "Column73", "Column74", "Column75", "Column76", "Column77", "Column78", "Column79", "Column80", "Column81", "Column82", "Column83", "Column84", "Column85", "Column86", "Column87", "Column88", "Column89", "Column90", "Column91", "Column92", "Column93", "Column94", "Column95", "Column96", "Column97", "Column98", "Column99", "Column100", "Column101", "Column102", "Column103", "Column104", "Column105", "Column106", "Column107", "Column108", "Column109", "Column110", "Column111", "Column112", "Column113", "Column114", "Column115", "Column116", "Column117", "Column118", "Column119", "Column120", "Column121", "Column122", "Column123", "Column124", "Column125", "Column126", "Column127", "Column128", "Column129", "Column130", "Column131", "Column132", "Column133", "Column134", "Column135", "Column136", "Column137", "Column138", "Column139", "Column140", "Column141", "Column142", "Column143", "Column144", "Column145", "Column146", "Column147", "Column148", "Column149", "Column150", "Column151", "Column152", "Column153", "Column154", "Column155", "Column156", "Column157", "Column158", "Column159", "Column160", "Column161", "Column162", "Column163", "Column164", "Column165", "Column166", "Column167", "Column168", "Column169", "Column170", "Column171", "Column172", "Column173", "Column174", "Column175", "Column176", "Column177", "Column178", "Column179", "Column180", "Column181", "Column182", "Column183", "Column184", "Column185", "Column186", "Column187", "Column188", "Column189", "Column190", "Column191", "Column192", "Column193", "Column194", "Column195", "Column196", "Column197", "Column198", "Column199", "Column200", "Column201", "Column202", "Column203", "Column204", "Column205", "Column206", "Column207", "Column208", "Column209", "Column210", "Column211", "Column212", "Column213", "Column214", "Column215", "Column216", "Column217", "Column218", "Column219", "Column220", "Column221", "Column222", "Column223", "Column224", "Column225", "Column226", "Column227", "Column228", "Column229", "Column230", "Column231", "Column232", "Column233", "Column234", "Column235", "Column236", "Column237", "Column238", "Column239", "Column240", "Column241", "Column242", "Column243", "Column244", "Column245", "Column246", "Column247", "Column248", "Column249", "Column250", "Column251", "Column252", "Column253", "Column254", "Column255", "Column256", "Column257", "Column258"}),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Columns 45- 258", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"S. NO", Int64.Type}, {"Item No", Int64.Type}, {"SYSTEM #", type text}, {"SUB-SYSTEM #", type text}, {"Commissioning Package", type text}, {"TEST PACK", type text}, {"Testpack Location", type text}, {"PRIORITY", Int64.Type}, {"TEST MEDIUM", type text}, {"UT", Int64.Type}, {"Volume#(lf) (m3)", type number}, {"Linear Meter (M)", type number}, {"Test Pressure (Barg)", type number}, {"Line Service", type text}, {"Weight (KG)", type number}, {"Type (AG/UG/PKG)", type text}, {"Piping Group", type text}, {"Iso Number", type text}, {"Iso Wise Balance Work", type text}, {"Column20", type text}, {"Column21", type text}, {"Construction Completion %", Percentage.Type}, {"Line Check Request", type text}, {"Column24", type text}, {"Column25", type text}, {"Column26", type text}, {"Spool No", type text}, {"Punch raised By", type text}, {"Punch Code", type text}, {"Punch Description", type text}, {"Punch CAT", type text}, {"Punch Clearance Date", type date}, {"Punch Clearance Done By", type text}, {"Item Clearance Request", type text}, {"Column35", type text}, {"Column36", type text}, {"Column37", type text}, {"Test pack Clearance Date", type date}, {"Blinding Completed Date", type date}, {"Test Completed Date", type date}, {"Pre-Com Completed Date", type text}, {"Reinstatement Details", type text}, {"Column43", type text}, {"Reinstatement Completed Date", type date}}),
    #"Filtered Rows1" = Table.SelectRows(#"Changed Type", each ([Iso Wise Balance Work] <> "To be Welded")),
    #"Renamed Columns" = Table.RenameColumns(#"Filtered Rows1",{{"Column20", "To be Bolted"}, {"Column21", "To be NDE"}, {"Iso Wise Balance Work", "To be Welded"}, {"Line Check Request", "Line Check Request Request No"}, {"Column24", "Line Check Request Request Date"}, {"Column25", "Line Check Request Request Issued to"}, {"Column26", "Line Check Completed"}, {"Item Clearance Request", "Item Clearance Request Request No"}, {"Column35", "Item Clearance Request Date"}, {"Column36", "Item Clearance Request Issued to"}, {"Column37", "Item Clearance Completed"}, {"Column43", "Reinstatement Details No of joints Completed"}, {"Reinstatement Details", "Reinstatement Details No of joints to be Reinstated"}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Renamed Columns",{{"To be Welded", Int64.Type}, {"To be Bolted", Int64.Type}, {"To be NDE", Int64.Type}, {"Line Check Request Request Date", type date}, {"Line Check Completed", type date}, {"Item Clearance Request Date", type date}, {"Item Clearance Completed", type date}, {"Pre-Com Completed Date", type date}, {"Reinstatement Details No of joints to be Reinstated", Int64.Type}, {"Reinstatement Details No of joints Completed", Int64.Type}, {"Commissioning Package", type text}, {"Line Service", type text}, {"Piping Group", type text}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type1", each ([Commissioning Package] = null) and ([Testpack Location] <> "Sub-System:" and [Testpack Location] <> "TestPack:")),
    #"Filtered Rows2 Exlude Null" = Table.SelectRows(#"Filtered Rows", each [S. NO] <> null)
in
    #"Filtered Rows2 Exlude Null"
```

### `t_QOB_Log_SP`

```m
let
    Source = Excel.Workbook(Web.Contents("https://ctjvnfe.sharepoint.com/sites/CTJV-EPC-1QCM/Shared%20Documents/10_QC_App_files/05_Excel%20Logs/QC%20App%20Logs.xlsx"), null, true),
    t_QOB_Log_SP_Table = Source{[Item="t_QOB_Log_SP",Kind="Table"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(t_QOB_Log_SP_Table,{{"Observation Source Ref", type text}, {"QOB Reference", type text}, {"Observation Type", type text}, {"QOB Status", type text}, {"Issued By", type text}, {"Created By", type text}, {"Created By email", type text}, {"SCTR", type text}, {"Drafted date", type date}, {"Issued Date", type date}, {"QOB Discipline", type text}, {"Source discipline", type text}, {"Area", type text}, {"Precise location or TAG", type text}, {"Observation Description", type text}, {"Close out date", type date}, {"ChronoNumber", Int64.Type}, {"Observation source (WQWT or CQA)", type text}, {"Project Week Number", Int64.Type}, {"CQA CheckSheet Ident Code", type text}, {"CQA CheckSheet Description", type text}, {"Actions taken", type text}, {"Images", type any}, {"Comments", type text}, {"Attachments", type logical}, {"ID", Int64.Type}, {"Created", type datetime}, {"Modified", type datetime}, {"List", type text}})
in
    #"Changed Type"
```

### `Temporary`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\PCC temporary lines\PCC temporary lines - Medgulf Prefab Scope-Status as of 22Apr2025.xlsx"), null, true),
    Temporary_Sheet = Source{[Item="Temporary",Kind="Sheet"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(Temporary_Sheet,{{"Column1", type text}, {"Column2", type text}}),
    #"Promoted Headers" = Table.PromoteHeaders(#"Changed Type", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers",{{"Temporary", type text}, {"ISO Number", type text}})
in
    #"Changed Type1"
```

### `Flange BreakDown`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Flange Managment\CUM Trend Flange Progress Break Down Rate % .xlsx"), null, true),
    Fl.BreakDown_Sheet = Source{[Item="Fl.BreakDown",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Fl.BreakDown_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Date", type date}, {"Sub-Contractor", type text}, {"Fl.BreakDown % Rate", type number}, {"Project Fl.BreakDown  % Rej Rate", type number}})
in
    #"Changed Type"
```

### `WPQ WELDING PROCESS`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\WPQ RECORD REGISTER\WPQ RECORD REGISTER.xlsx"), null, true),
    #"WELDING PROCESS_Sheet" = Source{[Item="WELDING PROCESS",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"WELDING PROCESS_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Sn.", Int64.Type}, {"SCNTR", type text}, {"WPS No.", type text}, {"Welding process", type text}, {"Type of Welding Machine", type text}}),
    #"Replaced Value Null - TBN" = Table.ReplaceValue(#"Changed Type",null,"TBN",Replacer.ReplaceValue,{"Welding process"})
in
    #"Replaced Value Null - TBN"
```

### `Flange ovAssets_1619`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Flange Managment\ovAssets_1619.xlsx"), null, true),
    #"Exported from SC_Sheet" = Source{[Item="Exported from SC",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"Exported from SC_Sheet", [PromoteAllScalars=true]),
    #"Renamed Columns as 1381" = Table.RenameColumns(#"Promoted Headers",{{"Spec", "SpecNo"}, {"Material ID Code", "MaterialIDCode"}, {"Joint Size", "JointSize"}, {"Gasket Type", "GasketType"}, {"Gasket Rating", "GasketRating"}, {"Stud Number", "StudNumber"}, {"Stud Diameter", "StudDiameter"}, {"Stud Length", "StudLength"}, {"Tightening Method", "TighteningMethod"}, {"Torque Value", "TorqueValue"}, {"Torque EU", "TorqueEU"}, {"Record Modified By", "RecordLastModifiedBy"}, {"Record Modified Date", "RecordLastModified"}, {"Construction Responsible Company", "Construction Responsible Company - Field021 (Custom)"}, {"Commissioning Responsible Company", "Commissioning Responsible Company - Field022 (Custom)"}, {"WeldAreaName", "WeldAreaname"}}),
    #"Replaced Value ' for Date" = Table.ReplaceValue(#"Renamed Columns as 1381","'","",Replacer.ReplaceText,{"Tightening Date - Field027 (Custom)"}),
    #"Replaced Value   12:00:00 AM" = Table.ReplaceValue(#"Replaced Value ' for Date"," 12:00:00 AM","",Replacer.ReplaceText,{"Tightening Date - Field027 (Custom)"}),
    #"Replaced Value - to """"" = Table.ReplaceValue(#"Replaced Value   12:00:00 AM","-","",Replacer.ReplaceText,{"TorqueValue"}),
    #"Replaced ' to" = Table.ReplaceValue(#"Replaced Value - to """"","'","",Replacer.ReplaceText,{"Tightening Date - Field027 (Custom)"}),
    #"Replaced 0:00" = Table.ReplaceValue(#"Replaced ' to","0:00","",Replacer.ReplaceText,{"Tightening Date - Field027 (Custom)"}),
    #"Replaced  12:00:00 AM 039" = Table.ReplaceValue(#"Replaced 0:00"," 12:00:00 AM","",Replacer.ReplaceText,{"PCC Tightening Date#(lf)- Field039 (Custom)"}),
    #"Replaced 12:00:00 AM 041" = Table.ReplaceValue(#"Replaced  12:00:00 AM 039"," 12:00:00 AM","",Replacer.ReplaceText,{"PCC Verified Date - #(lf)Field041 (Custom)"}),
    #"Replaced  12:00:00 AM 042" = Table.ReplaceValue(#"Replaced 12:00:00 AM 041"," 12:00:00 AM","",Replacer.ReplaceText,{"PCC Re-Tightening Date - #(lf)Field042 (Custom)"}),
    Custom1 = #"Replaced  12:00:00 AM 042",
    #"Split Column by Delimiter" = Table.SplitColumn(Custom1, "Tightening Date - Field027 (Custom)", Splitter.SplitTextByDelimiter(" ", QuoteStyle.Csv), {"Tightening Date - Field027 (Custom).1", "Tightening Date - Field027 (Custom).2"}),
    #"Removed Columns1" = Table.RemoveColumns(#"Split Column by Delimiter",{"Tightening Date - Field027 (Custom).2"}),
    #"Renamed Tightening Date - Field027 (Custom)" = Table.RenameColumns(#"Removed Columns1",{{"Tightening Date - Field027 (Custom).1", "Tightening Date - Field027 (Custom)"}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Renamed Tightening Date - Field027 (Custom)",{{"FlangeJointName", type text}, {"WeldAreaname", type text}, {"PipingIsometricNum - Field026 (Custom)", type text}, {"Line No. - Field025 (Custom)", type text}, {"Test Pack No - Field029 (Custom)", type text}, {"Category for final tightening - Field030 (Custom)", type text}, {"Process Plant", type text}, {"Process Area", type text}, {"System", type text}, {"Subsystem", type text}, {"SpecNo", type text}, {"MaterialIDCode", type text}, {"JointSize", type number}, {"GasketType", type text}, {"GasketRating", type text}, {"StudNumber", Int64.Type}, {"StudDiameter", type number}, {"StudLength", type number}, {"TighteningMethod", type text}, {"TorqueValue", type text}, {"TorqueEU", type text}, {"Report Number - Field031 (Custom)", type text}, {"Tightening Date - Field027 (Custom)", type date}, {"Serial No of Field Tag - Field023 (Custom)", type text}, {"Verified Date - Field024 (Custom)", type date}, {"Flange Repair Record - Field032 (Custom)", type text}, {"Re-Tightening Date - Field028 (Custom)", type text}, {"Crew ID - Field034 (Custom)", type text}, {"Stud Material", type text}, {"Nut Material", type text}, {"Parent Asset", type text}, {"RecordLastModifiedBy", type text}, {"RecordLastModified", type datetime}, {"FL - Torque Value", type text}, {"FL - Tightening Method", type text}}),
    #"Replaced FLANGE LEAKAGE" = Table.ReplaceValue(#"Changed Type","Flange leaking","FLANGE LEAKAGE",Replacer.ReplaceText,{"PCC Remarks - #(lf)Field045 (Custom)"}),
    #"Replaced FLANGE LEAKAGE 2" = Table.ReplaceValue(#"Replaced FLANGE LEAKAGE","Flange leakage","FLANGE LEAKAGE",Replacer.ReplaceText,{"PCC Remarks - #(lf)Field045 (Custom)"}),
    #"Added Flange Subcontractor" = Table.AddColumn(#"Replaced FLANGE LEAKAGE 2", "Flange Subcontractor", each "CCC"),
    #"Changed Type4" = Table.TransformColumnTypes(#"Added Flange Subcontractor",{{"Re-Tightening Date - Field028 (Custom)", type date}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Changed Type4",{{"RecordLastModified", type date}}),
    #"Renamed to Joint ID" = Table.RenameColumns(#"Changed Type1",{{"FlangeJointName", "Joint ID"}}),
    #"Renamed to Iso Number" = Table.RenameColumns(#"Renamed to Joint ID",{{"PipingIsometricNum - Field026 (Custom)", "Iso Number"}}),
    #"Renamed Test Pack" = Table.RenameColumns(#"Renamed to Iso Number",{{"Test Pack No - Field029 (Custom)", "Test Pack"}}),
    #"Reordered Columns Test Pack" = Table.ReorderColumns(#"Renamed Test Pack",{"Joint ID", "Test Pack", "WeldAreaname", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "System", "Subsystem", "SpecNo", "MaterialIDCode", "JointSize", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "StudLength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed SubSystem" = Table.RenameColumns(#"Reordered Columns Test Pack",{{"Subsystem", "SubSystem"}}),
    #"Reordered Columns" = Table.ReorderColumns(#"Renamed SubSystem",{"Joint ID", "Test Pack", "System", "SubSystem", "WeldAreaname", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "SpecNo", "MaterialIDCode", "JointSize", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "StudLength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed JointSize to Diam" = Table.RenameColumns(#"Reordered Columns",{{"JointSize", "Diam"}}),
    #"Added Custom BT No." = Table.AddColumn(#"Renamed JointSize to Diam", "BT No.", each List.Last(Text.Split([Joint ID], "-"))),
    #"Reordered Columns1" = Table.ReorderColumns(#"Added Custom BT No.",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaname", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "SpecNo", "MaterialIDCode", "Diam", "GasketType", "GasketRating", "StudNumber", "StudDiameter", "StudLength", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "FL - Torque Value", "FL - Tightening Method", "Flange Subcontractor"}),
    #"Renamed Service Class" = Table.RenameColumns(#"Reordered Columns1",{{"SpecNo", "Service Class"}}),
    #"Renamed StudNumber to Bolt Qty" = Table.RenameColumns(#"Renamed Service Class",{{"StudNumber", "Bolt Qty"}}),
    #"Renamed StudDiameter to Bolt Size" = Table.RenameColumns(#"Renamed StudNumber to Bolt Qty",{{"StudDiameter", "Bolt Size"}}),
    #"Renamed StudLength to Bolt Length" = Table.RenameColumns(#"Renamed StudDiameter to Bolt Size",{{"StudLength", "Bolt Length"}}),
    #"Renamed Joint Method" = Table.RenameColumns(#"Renamed StudLength to Bolt Length",{{"FL - Tightening Method", "Joint Method"}}),
    #"Renamed Jointing Value" = Table.RenameColumns(#"Renamed Joint Method",{{"FL - Torque Value", "Jointing Value"}}),
    #"Reordered Columns2" = Table.ReorderColumns(#"Renamed Jointing Value",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaname", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "GasketType", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TighteningMethod", "TorqueValue", "TorqueEU", "Report Number - Field031 (Custom)", "Tightening Date - Field027 (Custom)", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Removed  ""TighteningMethod"", ""TorqueValue""" = Table.RemoveColumns(#"Reordered Columns2",{"TighteningMethod", "TorqueValue"}),
    #"Renamed Report Nbr" = Table.RenameColumns(#"Removed  ""TighteningMethod"", ""TorqueValue""",{{"Report Number - Field031 (Custom)", "Report Nbr"}}),
    #"Renamed  Joint Date" = Table.RenameColumns(#"Renamed Report Nbr",{{"Tightening Date - Field027 (Custom)", "Joint Date"}}),
    #"Reordered Columns3" = Table.ReorderColumns(#"Renamed  Joint Date",{"Joint ID", "Test Pack", "System", "SubSystem", "BT No.", "WeldAreaname", "Iso Number", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "GasketType", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Serial No of Field Tag - Field023 (Custom)", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Stud Material", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Renamed Tag Nbr" = Table.RenameColumns(#"Reordered Columns3",{{"Serial No of Field Tag - Field023 (Custom)", "Tag Nbr"}}),
    #"Renamed Stud Material Bolt Desc." = Table.RenameColumns(#"Renamed Tag Nbr",{{"Stud Material", "Bolt Desc."}}),
    #"Renamed Gasket Desc." = Table.RenameColumns(#"Renamed Stud Material Bolt Desc.",{{"GasketType", "Gasket Desc."}}),
    #"Added Commissioning Package" = Table.AddColumn(#"Renamed Gasket Desc.", "Commissioning Package", each ""),
    #"Reordered Columns4" = Table.ReorderColumns(#"Added Commissioning Package",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "BT No.", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Rev No." = Table.AddColumn(#"Reordered Columns4", "Rev No.", each ""),
    #"Reordered Columns5" = Table.ReorderColumns(#"Added Rev No.",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "BT No.", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Sheet No." = Table.AddColumn(#"Reordered Columns5", "Sheet No.", each ""),
    #"Reordered Columns6" = Table.ReorderColumns(#"Added Sheet No.",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Diam", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Reordered Columns6",{{"Sheet No.", Int64.Type}}),
    #"Added Joint Point" = Table.AddColumn(#"Changed Type2", "Joint Point", each ""),
    #"Reordered Columns7" = Table.ReorderColumns(#"Added Joint Point",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Gasket Desc.", "GasketRating", "Bolt Qty", "Bolt Size", "Bolt Length", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Rating" = Table.AddColumn(#"Reordered Columns7", "Rating", each ""),
    #"Reordered Columns8" = Table.ReorderColumns(#"Added Rating",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "Service Class", "MaterialIDCode", "Gasket Desc.", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Bolt Desc.", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Bolt Ident" = Table.AddColumn(#"Reordered Columns8", "Bolt Ident", each ""),
    #"Reordered Columns9" = Table.ReorderColumns(#"Added Bolt Ident",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Lubricant Type" = Table.AddColumn(#"Reordered Columns9", "Lubricant Type", each ""),
    #"Reordered Columns10" = Table.ReorderColumns(#"Added Lubricant Type",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Service Type" = Table.AddColumn(#"Reordered Columns10", "Service Type", each ""),
    #"Reordered Columns11" = Table.ReorderColumns(#"Added Service Type",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "Joint Method", "Jointing Value", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added UT" = Table.AddColumn(#"Reordered Columns11", "UT", each ""),
    #"Reordered Columns12" = Table.ReorderColumns(#"Added UT",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "WeldAreaname", "Line No. - Field025 (Custom)", "Category for final tightening - Field030 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Renamed Cat." = Table.RenameColumns(#"Reordered Columns12",{{"Category for final tightening - Field030 (Custom)", "Cat."}}),
    #"Added Joint Timing" = Table.AddColumn(#"Renamed Cat.", "Joint Timing", each if [#"Cat."] = "X" then "Before Pressure Test" else if [#"Cat."] = "Y" then "Before Precom" else if [#"Cat."] = "Z" then "After Precom" else "TBN"),
    #"Reordered Columns13" = Table.ReorderColumns(#"Added Joint Timing",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "WeldAreaname", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Joint Date", "Report Nbr", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Reason" = Table.AddColumn(#"Reordered Columns13", "Reason", each ""),
    #"Reordered Columns14" = Table.ReorderColumns(#"Added Reason",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "WeldAreaname", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Tag Nbr", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    #"Added Jointer" = Table.AddColumn(#"Reordered Columns14", "Jointer", each ""),
    #"Reordered Columns15" = Table.ReorderColumns(#"Added Jointer",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "WeldAreaname", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Re-Tightening Date - Field028 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "Flange Subcontractor"}),
    Custom2 = #"Reordered Columns15",
    #"Added Tightening Tool Id" = Table.AddColumn(Custom2, "Tightening Tool Id", each ""),
    #"Added Control %" = Table.AddColumn(#"Added Tightening Tool Id", "Control %", each ""),
    #"Added Flange Batch No" = Table.AddColumn(#"Added Control %", "Flange Batch No", each ""),
    #"Added Selected Date" = Table.AddColumn(#"Added Flange Batch No", "Selected Date", each ""),
    #"Added Issued Date" = Table.AddColumn(#"Added Selected Date", "Issued Date", each ""),
    #"Added Issue Request No" = Table.AddColumn(#"Added Issued Date", "Issue Request No", each ""),
    #"Added Batch Status" = Table.AddColumn(#"Added Issue Request No", "Batch Status", each ""),
    #"Added Flange Joint Status" = Table.AddColumn(#"Added Batch Status", "Flange Joint Status", each ""),
    #"Added Control Inspection Report No" = Table.AddColumn(#"Added Flange Joint Status", "Control Inspection Report No", each ""),
    #"Added Control Inspection Date" = Table.AddColumn(#"Added Control Inspection Report No", "Control Inspection Date", each ""),
    #"Added Status - A/R" = Table.AddColumn(#"Added Control Inspection Date", "Status - A/R", each ""),
    #"Added Client Requested" = Table.AddColumn(#"Added Status - A/R", "Client Requested", each ""),
    #"Added Reason for De-Tightening" = Table.AddColumn(#"Added Client Requested", "Reason for De-Tightening", each [#"PCC Remarks - #(lf)Field045 (Custom)"]),
    #"Added User requested for De-Tightening" = Table.AddColumn(#"Added Reason for De-Tightening", "User requested for De-Tightening", each ""),
    #"Added Hold Status" = Table.AddColumn(#"Added User requested for De-Tightening", "Hold Status", each ""),
    #"Added Hold Date" = Table.AddColumn(#"Added Hold Status", "Hold Date", each ""),
    #"Added Hold Comments" = Table.AddColumn(#"Added Hold Date", "Hold Comments", each ""),
    #"Renamed De-Tightening Requested Date" = Table.RenameColumns(#"Added Hold Comments",{{"Re-Tightening Date - Field028 (Custom)", "De-Tightening Requested Date"}}),
    #"Reordered Columns16" = Table.ReorderColumns(#"Renamed De-Tightening Requested Date",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "Tightening Tool Id", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Client Requested", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Hold Status", "Hold Date", "Hold Comments", "Flange Subcontractor", "WeldAreaname", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Added WITNESSED BY" = Table.AddColumn(#"Reordered Columns16", "WITNESSED BY", each ""),
    #"Added ACC/REJ" = Table.AddColumn(#"Added WITNESSED BY", "ACC/REJ", each ""),
    #"Added REMARKS" = Table.AddColumn(#"Added ACC/REJ", "REMARKS", each ""),
    #"Added BTC01" = Table.AddColumn(#"Added REMARKS", "BTC01", each ""),
    #"Added BT24" = Table.AddColumn(#"Added BTC01", "BT24", each ""),
    #"Renamed PDS Area" = Table.RenameColumns(#"Added BT24",{{"WeldAreaname", "PDS Area"}}),
    #"Reordered Columns17" = Table.ReorderColumns(#"Renamed PDS Area",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tightening Tool Id", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Client Requested", "Hold Date", "Hold Comments", "Hold Status", "Flange Subcontractor", "ACC/REJ", "REMARKS", "BTC01", "BT24", "WITNESSED BY", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Verified Date - Field024 (Custom)", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Replaced torqueing to torquing" = Table.ReplaceValue(#"Reordered Columns17","Torqueing","Torquing",Replacer.ReplaceText,{"Joint Method"}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Replaced torqueing to torquing",{{"Joint Point", type text}, {"Rating", Int64.Type}, {"UT", Int64.Type}, {"Jointer", type text}, {"Control %", Int64.Type}, {"Selected Date", type date}, {"Issued Date", type date}, {"Control Inspection Date", type date}, {"Hold Date", type date}}),
    #"Removed Control Inspection Date" = Table.RemoveColumns(#"Changed Type3",{"Control Inspection Date"}),
    #"Renamed Verified Date to Control Inspection Date" = Table.RenameColumns(#"Removed Control Inspection Date",{{"Verified Date - Field024 (Custom)", "Control Inspection Date"}}),
    #"Reordered Columns18" = Table.ReorderColumns(#"Renamed Verified Date to Control Inspection Date",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tightening Tool Id", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Client Requested", "Hold Date", "Hold Comments", "Hold Status", "Flange Subcontractor", "PDS Area", "ACC/REJ", "REMARKS", "BTC01", "BT24", "WITNESSED BY", "Line No. - Field025 (Custom)", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified"}),
    #"Added Joint Method Original" = Table.AddColumn(#"Reordered Columns18", "Joint Method Original", each [Joint Method]),
    #"Replaced CAT null to TBN" = Table.ReplaceValue(#"Added Joint Method Original","","TBN",Replacer.ReplaceValue,{"Cat."}),
    #"Reordered Columns19" = Table.ReorderColumns(#"Replaced CAT null to TBN",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Line No. - Field025 (Custom)", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Client Requested", "Hold Status", "Flange Subcontractor", "WITNESSED BY", "REMARKS", "Tightening Tool Id", "ACC/REJ", "Hold Date", "Hold Comments", "BTC01", "BT24", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Crew ID - Field034 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "PDS Area", "Joint Method Original", "Construction Responsible Company - Field021 (Custom)", "Commissioning Responsible Company - Field022 (Custom)"}),
    #"Replaced Errors" = Table.ReplaceErrorValues(#"Reordered Columns19", {{"Jointing Value", null}}),
    #"Reordered Columns20" = Table.ReorderColumns(#"Replaced Errors",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Line No. - Field025 (Custom)", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Crew ID - Field034 (Custom)", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Client Requested", "Hold Status", "Flange Subcontractor", "WITNESSED BY", "REMARKS", "Tightening Tool Id", "ACC/REJ", "Hold Date", "Hold Comments", "BTC01", "BT24", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "PDS Area", "Joint Method Original", "Construction Responsible Company - Field021 (Custom)", "Commissioning Responsible Company - Field022 (Custom)"}),
    #"Removed Columns" = Table.RemoveColumns(#"Reordered Columns20",{"Jointer"}),
    #"Renamed Crew ID to Jointer" = Table.RenameColumns(#"Removed Columns",{{"Crew ID - Field034 (Custom)", "Jointer"}}),
    #"Reordered Columns PPC" = Table.ReorderColumns(#"Renamed Crew ID to Jointer",{"Joint ID", "Test Pack", "System", "SubSystem", "Commissioning Package", "Iso Number", "Line No. - Field025 (Custom)", "Rev No.", "Sheet No.", "BT No.", "Joint Point", "Diam", "Rating", "Bolt Size", "Bolt Qty", "Bolt Length", "Bolt Ident", "Service Class", "Bolt Desc.", "Gasket Desc.", "Lubricant Type", "Service Type", "UT", "Re-Tightening Report Number - Field032 (Custom)", "Joint Method", "Jointing Value", "Joint Timing", "Cat.", "Reason", "Joint Date", "Report Nbr", "Jointer", "Tag Nbr", "Control %", "Flange Batch No", "Selected Date", "Issued Date", "Issue Request No", "Batch Status", "Flange Joint Status", "Control Inspection Report No", "Control Inspection Date", "Status - A/R", "Client Requested", "Hold Status", "Flange Subcontractor", "WITNESSED BY", "REMARKS", "Tightening Tool Id", "ACC/REJ", "Hold Date", "Hold Comments", "BTC01", "BT24", "Reason for De-Tightening", "User requested for De-Tightening", "De-Tightening Requested Date", "Process Plant", "Process Area", "MaterialIDCode", "GasketRating", "TorqueEU", "Flange Repair Record - Field032 (Custom)", "Nut Material", "Parent Asset", "RecordLastModifiedBy", "RecordLastModified", "PDS Area", "Joint Method Original", "Construction Responsible Company - Field021 (Custom)", "Commissioning Responsible Company - Field022 (Custom)", "PCC Serial No of Field Tag#(lf)- Field038 (Custom)", "PCC Tightening Date#(lf)- Field039 (Custom)", "PCC Report Number - #(lf)Field040 (Custom)", "PCC Verified Date - #(lf)Field041 (Custom)", "PCC Re-Tightening Date - #(lf)Field042 (Custom)", "PCC Re-Tightening Report Number - #(lf)Field043 (Custom)", "PCC Crew ID -#(lf)Field044 (Custom)", "PCC Remarks - #(lf)Field045 (Custom)"}),
    #"Replaced null Joint Method TBN" = Table.ReplaceValue(#"Reordered Columns PPC",null,"TBN",Replacer.ReplaceValue,{"Joint Method"}),
    #"Changed Type PCC Tightening Date" = Table.TransformColumnTypes(#"Replaced null Joint Method TBN",{{"PCC Tightening Date#(lf)- Field039 (Custom)", type date}, {"PCC Verified Date - #(lf)Field041 (Custom)", type date}, {"PCC Re-Tightening Date - #(lf)Field042 (Custom)", type date}, {"PCC Remarks - #(lf)Field045 (Custom)", type text}}),
    #"Replaced 2 CAT null to TBN" = Table.ReplaceValue(#"Changed Type PCC Tightening Date",null,"TBN",Replacer.ReplaceValue,{"Cat."})
in
    #"Replaced 2 CAT null to TBN"
```

### `Flg CCC_Flange Repair`

```m
let
    Source = Excel.Workbook(Web.Contents("https://chiyodacorp.sharepoint.com/teams/NFE_EPC1/CTJV/Shared%20Documents/35_QA/QFE%20-%20General/10%20-%20UISU/20%20-%20KPIs%20Dashbooard/30%20-%20BIT%20Data%20Sources/30%20-%20Repair%20Logs/10%20-%20CCC/CCC%20-%20Flange%20Repair%20Log%20-%20Consolidated.xlsx"), null, true),
    Concat_Sheet = Source{[Item="Concat",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Concat_Sheet, [PromoteAllScalars=true]),
    #"Renamed Columns1" = Table.RenameColumns(#"Promoted Headers",{{"ACCEPTED#(lf)/REJECTED", "ACCEPTED/REJECTED"}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Renamed Columns1",{{"Date", type date}, {"SN", Int64.Type}}),
    #"Replaced Value" = Table.ReplaceValue(#"Changed Type","REJECTED BY CTJV ","REJECTED",Replacer.ReplaceText,{"ACCEPTED/REJECTED"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value","Rejected","REJECTED",Replacer.ReplaceText,{"ACCEPTED/REJECTED"}),
    #"Added Conditional Column" = Table.AddColumn(#"Replaced Value1", "Site SN", each if [#"OSDR / PSO"] = "Site" then 1 else 0),
    #"Replaced Value2" = Table.ReplaceValue(#"Added Conditional Column","REJECTED ","REJECTED",Replacer.ReplaceText,{"ACCEPTED/REJECTED"}),
    #"Added Conditional Column1" = Table.AddColumn(#"Replaced Value2", "Vendor", each if [#"OSDR / PSO"] = "Vendor" then 1 else 0),
    #"Renamed Columns" = Table.RenameColumns(#"Added Conditional Column1",{{"Vendor", "Vendor SN"}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Renamed Columns",{{"Site SN", Int64.Type}, {"Vendor SN", Int64.Type}}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Changed Type1",{{"Action #(lf)Done", type text}}),
    #"Added Conditional Column2" = Table.AddColumn(#"Changed Type3", "Action Done", each if [#"Action #(lf)Done"] <> null then 1 else 0),
    #"Changed Type2" = Table.TransformColumnTypes(#"Added Conditional Column2",{{"Action Done", Int64.Type}}),
    #"Added Custom" = Table.AddColumn(#"Changed Type2", "Subcontractor", each "CCC"),
    #"Added Conditional Column3" = Table.AddColumn(#"Added Custom", "To be repaired", each if [#"Action #(lf)Done"] = null then 1 else 0),
    #"Added Conditional Column4" = Table.AddColumn(#"Added Conditional Column3", "Repaired", each if [#"Action #(lf)Done"] = null then 0 else 1),
    #"Changed Type4" = Table.TransformColumnTypes(#"Added Conditional Column4",{{"To be repaired", Int64.Type}, {"Repaired", Int64.Type}}),
    #"Renamed Columns2" = Table.RenameColumns(#"Changed Type4",{{"To be repaired", "To be Repaired"}, {"Action #(lf)Done", "Action"}})
in
    #"Renamed Columns2"
```

### `Flg GAC_Flange Repair`

```m
let
    Source = Excel.Workbook(Web.Contents("https://chiyodacorp.sharepoint.com/teams/NFE_EPC1/CTJV/Shared%20Documents/35_QA/QFE%20-%20General/10%20-%20UISU/20%20-%20KPIs%20Dashbooard/30%20-%20BIT%20Data%20Sources/30%20-%20Repair%20Logs/20%20-%20GAC/GAC%20-%20Flange%20Repair%20Log%20-%20Consolidated.xlsx"), null, true),
    Concat_Sheet = Source{[Item="Concat",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Concat_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Date", type date}}),
    #"Reordered Columns" = Table.ReorderColumns(#"Changed Type",{"SL No", "Date", "Vendor/Site", "Re-Machining Date"}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Reordered Columns",{{"SL No", Int64.Type}}),
    #"Filtered Rows1" = Table.SelectRows(#"Changed Type1", each ([SL No] <> null)),
    #"Changed Type4" = Table.TransformColumnTypes(#"Filtered Rows1",{{"Re-Machining Date", type date}}),
    #"Added Conditional Column" = Table.AddColumn(#"Changed Type4", "GAC_Vendor_SN", each if [#"Vendor/Site"] = "Vendor" then 1 else 0),
    #"Added Conditional Column1" = Table.AddColumn(#"Added Conditional Column", "GAC_Site_SN", each if [#"Vendor/Site"] = "Site" then 1 else 0),
    #"Added Conditional Column2" = Table.AddColumn(#"Added Conditional Column1", "Action_done", each if [#"Re-Machining Date"] = null then 0 else 1),
    #"Added Conditional Column3" = Table.AddColumn(#"Added Conditional Column2", "To be repaired", each if [#"Re-Machining Date"] = null then 1 else 0),
    #"Changed Type2" = Table.TransformColumnTypes(#"Added Conditional Column3",{{"GAC_Vendor_SN", Int64.Type}, {"GAC_Site_SN", Int64.Type}, {"Action_done", Int64.Type}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type2",{{"GAC_Site_SN", "GAC_Site SN"}, {"GAC_Vendor_SN", "GAC_Vendor SN"}}),
    #"Changed Type5" = Table.TransformColumnTypes(#"Renamed Columns",{{"To be repaired", Int64.Type}}),
    #"Added Custom" = Table.AddColumn(#"Changed Type5", "Subcontractor", each "GAC"),
    #"Renamed Columns1" = Table.RenameColumns(#"Added Custom",{{"GAC_Site SN", "Site SN"}, {"GAC_Vendor SN", "Vendor SN"}, {"Action_done", "Repaired"}, {"To be repaired", "To be Repaired"}}),
    #"Removed Columns2" = Table.RemoveColumns(#"Renamed Columns1",{"Delta Closure"}),
    #"Changed Type3" = Table.TransformColumnTypes(#"Removed Columns2",{{"To be Repaired", Int64.Type}}),
    #"Renamed Columns3" = Table.RenameColumns(#"Changed Type3",{{"To be Repaired", "To be Repaired"}, {"SL No", "SN"}}),
    #"Filtered Rows" = Table.SelectRows(#"Renamed Columns3", each ([SN] <> null)),
    #"Added Custom1" = Table.AddColumn(#"Filtered Rows", "ACCEPTED/REJECTED", each "Rejected")
in
    #"Added Custom1"
```

### `Flg TFN_Flange Repair`

```m
let
    Source = Excel.Workbook(Web.Contents("https://chiyodacorp.sharepoint.com/teams/NFE_EPC1/CTJV/Shared%20Documents/35_QA/QFE%20-%20General/10%20-%20UISU/20%20-%20KPIs%20Dashbooard/30%20-%20BIT%20Data%20Sources/30%20-%20Repair%20Logs/30%20-%20TFN/TFN%20-%20Flange%20Repair%20Log%20-%20Consolidated.xlsx"), null, true),
    Analysis_Sheet = Source{[Item="Analysis",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Analysis_Sheet, [PromoteAllScalars=true]),
    #"Filtered Rows" = Table.SelectRows(#"Promoted Headers", each ([Serial] <> null)),
    #"Merged Queries" = Table.NestedJoin(#"Filtered Rows", {"Serial"}, #"Flg tekfen repair log main log", {"#"}, "tekfen repair log main log", JoinKind.LeftOuter),
    #"Expanded tekfen repair log main log" = Table.ExpandTableColumn(#"Merged Queries", "tekfen repair log main log", {"Final Conclusion"}, {"tekfen repair log main log.Final Conclusion"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Expanded tekfen repair log main log",{{"Date", type date}, {"Flange Maching#(lf) Date", type date}}),
    #"Added Conditional Column" = Table.AddColumn(#"Changed Type", "Site SN", each if [#"Vendor/Site"] = "Site" then 1 else 0),
    #"Changed Type1" = Table.TransformColumnTypes(#"Added Conditional Column",{{"Site SN", Int64.Type}}),
    #"Added Conditional Column1" = Table.AddColumn(#"Changed Type1", "Vendor SN", each if [#"Vendor/Site"] = "Vendor" then 1 else 0),
    #"Changed Type2" = Table.TransformColumnTypes(#"Added Conditional Column1",{{"Vendor SN", Int64.Type}}),
    #"Added Conditional Column2" = Table.AddColumn(#"Changed Type2", "Repaired", each if Text.Contains([tekfen repair log main log.Final Conclusion], "Waiting Remachining") then 0 else 1),
    #"Added Conditional Column3" = Table.AddColumn(#"Added Conditional Column2", "To be Repaired", each if Text.Contains([tekfen repair log main log.Final Conclusion], "Waiting Remachining") then 1 else 0),
    #"Changed Type3" = Table.TransformColumnTypes(#"Added Conditional Column3",{{"Repaired", Int64.Type}, {"To be Repaired", Int64.Type}}),
    #"Added Custom" = Table.AddColumn(#"Changed Type3", "Subcontractor", each "TFN"),
    #"Added Conditional Column4" = Table.AddColumn(#"Added Custom", "Custom", each if [Repaire Request] = "Y" then "Rejected" else "Accepted"),
    #"Renamed Columns" = Table.RenameColumns(#"Added Conditional Column4",{{"To be Repaired", "To be Repaired"}, {"Serial", "SN"}, {"Flange Maching#(lf) Date", "Re-Machining Date"}, {"Custom", "Rej / Acc"}}),
    #"Removed Columns" = Table.RemoveColumns(#"Renamed Columns",{"Rej / Acc"}),
    #"Added Custom1" = Table.AddColumn(#"Removed Columns", "ACCEPTED/REJECTED", each "Rejected")
in
    #"Added Custom1"
```

### `Flg Medgulf_Flange Repair`

```m
let
    Source = Excel.Workbook(Web.Contents("https://chiyodacorp.sharepoint.com/teams/NFE_EPC1/CTJV/Shared%20Documents/35_QA/QFE%20-%20General/10%20-%20UISU/20%20-%20KPIs%20Dashbooard/30%20-%20BIT%20Data%20Sources/30%20-%20Repair%20Logs/40%20-%20MEG/MEG%20-%20Flange%20repair%20consolidated.xlsx"), null, true),
    Analysys_Sheet = Source{[Item="Analysys",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Analysys_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Flange Maching#(lf) Date", type date}, {"Discrepancy Observed Date ", type date}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"CDR/NCR Ref no", "Site/Vendor"}}),
    #"Added Conditional Column" = Table.AddColumn(#"Renamed Columns", "Site SN", each if [#"Site/Vendor"] = "Site" then 1 else 0),
    #"Added Conditional Column1" = Table.AddColumn(#"Added Conditional Column", "Vendor SN", each if [#"Site/Vendor"] = "Vendor" then 1 else 0),
    #"Added Conditional Column2" = Table.AddColumn(#"Added Conditional Column1", "Action done", each if [#"Flange Maching#(lf) Date"] = null then 0 else 1),
    #"Added Conditional Column3" = Table.AddColumn(#"Added Conditional Column2", "To be repaired", each if [#"Flange Maching#(lf) Date"] = null then 1 else 0),
    #"Changed Type1" = Table.TransformColumnTypes(#"Added Conditional Column3",{{"Site SN", Int64.Type}, {"Vendor SN", Int64.Type}, {"Action done", Int64.Type}, {"To be repaired", Int64.Type}}),
    #"Renamed Columns1" = Table.RenameColumns(#"Changed Type1",{{"Action done", "Repaired"}}),
    #"Added Custom" = Table.AddColumn(#"Renamed Columns1", "Subcontractor", each "MEDGULF"),
    #"Renamed Columns2" = Table.RenameColumns(#"Added Custom",{{"Discrepancy Observed Date ", "Date"}, {"To be repaired", "To be Repaired"}}),
    #"Removed Columns" = Table.RemoveColumns(#"Renamed Columns2",{"Subcontractor"}),
    #"Renamed Columns3" = Table.RenameColumns(#"Removed Columns",{{"Sub/Contractor", "Subcontractor"}}),
    #"Added Custom1" = Table.AddColumn(#"Renamed Columns3", "ACCEPTED/REJECTED", each "REJECTED"),
    #"Renamed Columns4" = Table.RenameColumns(#"Added Custom1",{{"To be Repaired", "To be Repaired"}, {"Site/Vendor", "Vendor/Site"}, {"Flange Maching#(lf) Date", "Re-Machining Date"}, {"Remark", "Action"}}),
    #"Added Custom2" = Table.AddColumn(#"Renamed Columns4", "ACCEPTED/REJECTED.1", each "Rejected")
in
    #"Added Custom2"
```

### `Flg tekfen repair log main log`

```m
let
    Source = Excel.Workbook(Web.Contents("https://chiyodacorp.sharepoint.com/teams/NFE_EPC1/CTJV/Shared%20Documents/35_QA/QFE%20-%20General/10%20-%20UISU/20%20-%20KPIs%20Dashbooard/30%20-%20BIT%20Data%20Sources/30%20-%20Repair%20Logs/30%20-%20TFN/TFN%20-%20Flange%20Repair%20Log%20-%20Consolidated.xlsx"), null, true),
    Data_Sheet = Source{[Item="Data",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Data_Sheet, [PromoteAllScalars=true]),
    #"Added Custom" = Table.AddColumn(#"Promoted Headers", "ACCEPTED/REJECTED", each "Rejected")
in
    #"Added Custom"
```

### `Flg Onepager_data`

```m
let
    Source = Table.Combine({#"Flg CCC_Flange Repair", #"Flg GAC_Flange Repair", #"Flg TFN_Flange Repair", #"Flg Medgulf_Flange Repair"}),
    #"Replaced Value" = Table.ReplaceValue(Source,"Rejected","REJECTED",Replacer.ReplaceText,{"ACCEPTED/REJECTED"}),
    #"Replaced Value1" = Table.ReplaceValue(#"Replaced Value","REJECTED BY CTJV ","REJECTED",Replacer.ReplaceText,{"ACCEPTED/REJECTED"}),
    #"Reordered Columns" = Table.ReorderColumns(#"Replaced Value1",{"Date", "Subcontractor", "Site SN", "Vendor SN", "Action Done",  "Repaired"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Reordered Columns",{{"To be Repaired", Int64.Type}}),
    #"Removed Columns1" = Table.RemoveColumns(#"Changed Type",{"Action Done"}),
    #"Replaced Value2" = Table.ReplaceValue(#"Removed Columns1","MEDGULF","MEG",Replacer.ReplaceText,{"Subcontractor"}),
    #"Appended Query" = Table.Combine({#"Replaced Value2", #"Flg Enova Flange Repair_W10"}),
    #"Removed Columns" = Table.RemoveColumns(#"Appended Query",{"Trac No."}),
    #"Removed Columns2" = Table.RemoveColumns(#"Removed Columns",{"Flange Maching#(lf) Report No.", "Flange Rating", "Ident Code", "Group", "OSDR / PSO", "Delay", "Repaire Request", "Flange Maching#(lf) Contractor", "ACCEPTED/REJECTED.1"})
in
    #"Removed Columns2"
```

### `Flg Enova Flange Repair_W10`

```m
let
    Source = Excel.Workbook(Web.Contents("https://chiyodacorp.sharepoint.com/teams/NFE_EPC1/CTJV/Shared%20Documents/35_QA/QFE%20-%20General/10%20-%20UISU/20%20-%20KPIs%20Dashbooard/30%20-%20BIT%20Data%20Sources/30%20-%20Repair%20Logs/50%20-%20Enova/Enova%20flange%20Repair_latest/Flange%20Face%20Re-Machining%20Log%20for%20CTJV%20Matls_latest.xlsx"), null, true),
    W10_Sheet = Source{[Item="W10 ",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(W10_Sheet, [PromoteAllScalars=true]),
    #"Promoted Headers1" = Table.PromoteHeaders(#"Promoted Headers", [PromoteAllScalars=true]),
    #"Removed Columns" = Table.RemoveColumns(#"Promoted Headers1",{"Column1"}),
    #"Added Custom" = Table.AddColumn(#"Removed Columns", "Location.1", each "W10"),
    #"Removed Columns1" = Table.RemoveColumns(#"Added Custom",{"Location"}),
    #"Renamed Columns" = Table.RenameColumns(#"Removed Columns1",{{"Location.1", "Location"}, {"Current Status", "Action"}}),
    #"Filtered Rows2" = Table.SelectRows(#"Renamed Columns", each ([SL No] <> null)),
    #"Appended Query" = Table.Combine({#"Filtered Rows2", #"Flg Enova Flange Repair_W17"}),
    #"Filtered Rows" = Table.SelectRows(#"Appended Query", each ([TAG ID] <> null)),
    #"Reordered Columns1" = Table.ReorderColumns(#"Filtered Rows",{"SL No", "TAG ID", "Affected Qty", "Flange Description", "Flange Size", "Heat No","Defect Description", "Disposition Plan",   "Re-Machining RFI No.", "Re-Machining Report No.", "Re-Machining Date", "ACC/REJ", "Current location", "Current Status_1", "Remark's", "Location"}),
    #"Removed Columns2" = Table.RemoveColumns(#"Reordered Columns1",{   "Remark's", "SL No", "Re-Machining RFI No.", "Current location"}),
    #"Reordered Columns" = Table.ReorderColumns(#"Removed Columns2",{"TAG ID", "Flange Size", "Heat No", "Flange Description", "Affected Qty", "OSD NO", "Defect Description", "Disposition Plan", "Shipment No", "Re-Machining Report No.", "Re-Machining Date", "ACC/REJ", "Current Status_1", "Location"}),
    #"Extracted Text Range" = Table.TransformColumns(#"Reordered Columns", {{"Flange Size", each Text.Middle(Text.From(_, "en-US"), 0, 3), type text}}),
    #"Reordered Columns2" = Table.ReorderColumns(#"Extracted Text Range",{"TAG ID", "Flange Size", "Affected Qty", "Heat No", "Flange Description", "OSD NO", "Defect Description", "Disposition Plan",  "Shipment No", "Re-Machining Report No.", "Re-Machining Date", "ACC/REJ", "Current Status_1", "Location"}),
    #"Merged Columns" = Table.CombineColumns(Table.TransformColumnTypes(#"Reordered Columns2", {{"Affected Qty", type text}}, "en-US"),{"TAG ID", "Flange Size", "Affected Qty"},Combiner.CombineTextByDelimiter("-", QuoteStyle.None),"Merged"),
    #"Removed Columns3" = Table.RemoveColumns(#"Merged Columns",{"Heat No", "Shipment No", "Current Status_1"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Removed Columns3",{{"Re-Machining Date", type date}, {"OSD Date", type date}}),
    #"Added Conditional Column1" = Table.AddColumn(#"Changed Type", "Vendor SN", each if [OSD NO] = null then 0 else 1),
    #"Replaced Value" = Table.ReplaceValue(#"Added Conditional Column1",0,1,Replacer.ReplaceValue,{"Vendor SN"}),
    #"Added Conditional Column2" = Table.AddColumn(#"Replaced Value", "Repaired", each if [#"Re-Machining Date"] = null then 0 else 1),
    #"Added Conditional Column3" = Table.AddColumn(#"Added Conditional Column2", "To be repaired", each if [#"Re-Machining Date"] = null then 1 else 0),
    #"Changed Type1" = Table.TransformColumnTypes(#"Added Conditional Column3",{ {"Vendor SN", Int64.Type}, {"Repaired", Int64.Type}, {"To be repaired", Int64.Type}}),
    #"Added Custom1" = Table.AddColumn(#"Changed Type1", "Subcontractor", each "Enova"),
    #"Added Custom2" = Table.AddColumn(#"Added Custom1", "ACCEPTED/REJECTED", each "REJECTED"),
    #"Renamed Columns1" = Table.RenameColumns(#"Added Custom2",{ {"Repaired", "Repaired flanges"}, {"To be repaired", "To be repaired flanges"}}),
    #"Removed Columns4" = Table.RemoveColumns(#"Renamed Columns1",{"Flange Description", "Merged", "Defect Description", "Disposition Plan", "Re-Machining Report No.", "ACC/REJ", "OSD NO", "Location"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Removed Columns4",{{"OSD Date", type date}}),
    #"Removed Columns5" = Table.RemoveColumns(#"Changed Type2",{"Column22", "Column23", "Column24", "Column25"}),
    #"Renamed Columns2" = Table.RenameColumns(#"Removed Columns5",{{"OSD Date", "Date"}, {"Repaired flanges", "Repaired"}, {"To be repaired flanges", "To be Repaired"}, {"Action", "Action"}}),
    #"Sorted Rows" = Table.Sort(#"Renamed Columns2",{{"Date", Order.Descending}}),
    #"Filtered Rows1" = Table.SelectRows(#"Sorted Rows", each ([Date] <> null))
in
    #"Filtered Rows1"
```

### `Flg Enova Flange Repair_W17`

```m
let
    Source = Excel.Workbook(Web.Contents("https://chiyodacorp.sharepoint.com/teams/NFE_EPC1/CTJV/Shared%20Documents/35_QA/QFE%20-%20General/10%20-%20UISU/20%20-%20KPIs%20Dashbooard/30%20-%20BIT%20Data%20Sources/30%20-%20Repair%20Logs/50%20-%20Enova/Enova%20flange%20Repair_latest/Flange%20Face%20Re-Machining%20Log%20for%20CTJV%20Matls_latest.xlsx"), null, true),
    W17_Sheet = Source{[Item="W17",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(W17_Sheet, [PromoteAllScalars=true]),
    #"Promoted Headers1" = Table.PromoteHeaders(#"Promoted Headers", [PromoteAllScalars=true]),
    #"Replaced Value" = Table.ReplaceValue(#"Promoted Headers1","19/11/2024 / 12/10/2024",#date(2024, 11, 19),Replacer.ReplaceValue,{"Re-Machining Date"}),
    #"Renamed Columns" = Table.RenameColumns(#"Replaced Value",{{"Tag/ Ident. Code No.", "TAG ID"}, {"OSD No.", "OSD NO"}}),
    #"Removed Columns" = Table.RemoveColumns(#"Renamed Columns",{"SL No"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Removed Columns",{{"Location", "Locations"}}),
    #"Added Custom" = Table.AddColumn(#"Renamed Columns1", "Location", each "W17"),
    #"Changed Type" = Table.TransformColumnTypes(#"Added Custom",{{"Re-Machining Date", type date}}),
    #"Renamed Columns2" = Table.RenameColumns(#"Changed Type",{{"OSD Date", "OSD Date"}}),
    #"Filtered Rows" = Table.SelectRows(#"Renamed Columns2", each ([TAG ID] <> null)),
    #"Removed Columns1" = Table.RemoveColumns(#"Filtered Rows",{"Remark's", "Column21", "Re-Machining RFI No.", "Re-Machining Report No.", "Shipment Number"}),
    #"Renamed Columns3" = Table.RenameColumns(#"Removed Columns1",{{"Current Status", "Action Done"}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Renamed Columns3",{{"Action Done", type text}}),
    #"Renamed Columns4" = Table.RenameColumns(#"Changed Type1",{{"Action Done", "Action"}}),
    #"Sorted Rows" = Table.Sort(#"Renamed Columns4",{{"OSD Date", Order.Descending}})
in
    #"Sorted Rows"
```

### `Bracing FE_Analysis`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\Bracing\Bracing List _Analysis Final.xlsx"), null, true),
    FE_Analysis_Sheet = Source{[Item="FE_Analysis",Kind="Sheet"]}[Data],
    #"Replaced Value" = Table.ReplaceValue(FE_Analysis_Sheet,"#N/A","",Replacer.ReplaceText,{"Column7"}),
    #"Changed Type2" = Table.TransformColumnTypes(#"Replaced Value",{{"Column7", type text}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Changed Type2",{{"Column1", type text}, {"Column2", type text}, {"Column3", type text}, {"Column4", type text}, {"Column5", type text}, {"Column6", type text}, {"Column7", type text}, {"Column8", type text}, {"Column9", type any}, {"Column10", type text}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type text}, {"Column18", type text}, {"Column19", type text}, {"Column20", type text}, {"Column21", type text}, {"Column22", type text}, {"Column23", type text}, {"Column24", type text}, {"Column25", type text}, {"Column26", type text}, {"Column27", type text}, {"Column28", type text}, {"Column29", type text}, {"Column30", type text}, {"Column31", type text}, {"Column32", type text}, {"Column33", type text}, {"Column34", type text}, {"Column35", type text}, {"Column36", type text}, {"Column37", type text}, {"Column38", type text}, {"Column39", type text}, {"Column40", type text}, {"Column41", type text}, {"Column42", type text}, {"Column43", type text}, {"Column44", type text}, {"Column45", type text}, {"Column46", type text}, {"Column47", type text}, {"Column48", type text}, {"Column49", type text}, {"Column50", type text}, {"Column51", type any}, {"Column52", type any}, {"Column53", type any}, {"Column54", type any}, {"Column55", type any}, {"Column56", type any}, {"Column57", type any}, {"Column58", type any}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each ([Column1] <> null)),
    #"Promoted Headers" = Table.PromoteHeaders(#"Filtered Rows", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers",{{"Project ID", type text}, {"MTO Stage", type text}, {"CWA", type text}, {"AREA", type text}, {"Line No", type text}, {"Line No(Plant Item)", type text}, {"Testpack", type any}, {"Test  Date", type text}, {"Isometric Number", type text}, {"ISO/SPOOL", type text}, {"L_DWG_REVNO", type text}, {"Issue Status", type text}, {"Issue Status (Highest Flag)", type text}, {"BOM Pos", Int64.Type}, {"FROM_POS", type text}, {"HOLD_STATUS", type text}, {"SPEC_CODE_REF", type text}, {"Field Discipline Code", type text}, {"Part Name", type text}, {"SHORT_CODE_REF", type text}, {"LOCATION", type text}, {"CWP", type text}, {"Size-1", Int64.Type}, {"Size-2", type number}, {"Size-3", type text}, {"Size-4", type text}, {"Size-5", type text}, {"Sch-1", type text}, {"Sch-2", type text}, {"Actual Thickness-1", Int64.Type}, {"Actual Thickness-2", Int64.Type}, {"Size Group", Int64.Type}, {"Quantity", Int64.Type}, {"Issued Quantity", Int64.Type}, {"Unit Code", type text}, {"Ident Code or Company Ident Code", type text}, {"Tag Number", type text}, {"Commodity Code", type text}, {"Part Division", type text}, {"Main Material for W.V. Suumary", type text}, {"Meterial Division", type text}, {"LS01P02 MAIN-MATL (Short Desc)", type text}, {"LS01P09 AUTH-CODE (Short Desc)", type text}, {"LS01P03 RATING (Short Desc)", type text}, {"LS01P06A CONNECTION-A (Short Desc)", type text}, {"LS01P06B CONNECTION-B (Short Desc)", type text}, {"Ident Description (According to Parameter ZCH_X_DESC)", type text}, {"GUID(LP_ID)", Int64.Type}, {"BOM Comment", type text}, {"Last Date", type date}, {"Two phase with Vibration", type any}, {"FIV", type any}, {"AIV", type any}, {"900# above", type any}, {"PRV", type text}, {"Rotating and reciprocating", type any}, {"Refer here for Bracing requirement", type text}, {"Subcontractor", type text}}),
    #"Replaced Errors" = Table.ReplaceErrorValues(#"Changed Type1", {{"Testpack", ""}}),
    #"Filtered Rows1" = Table.SelectRows(#"Replaced Errors", each ([Isometric Number] = "21010AA-A6132031R01"))
in
    #"Filtered Rows1"
```

### `Welding Progress (Project) Nov 2024 - Nov 2025`

```m
let
    Source = Csv.Document(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\1\Welding Progress (Project) Nov 2024 - Nov 2025 .csv"),[Delimiter=",", Columns=3, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Week_End_Date", type date}, {"Joint Uniq ""PR all"" Welded", Int64.Type}, {"Weld Qty", type text}})
in
    #"Changed Type"
```

### `PIC_vs_Talisman_2026_02_16`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\RT Films Master Register\PIC_vs_Talisman_2026_02_16.xlsx"), null, true),
    data_Sheet = Source{[Item="data",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(data_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Comparison_Result", type text}, {"Report_No", type text}, {"Talisman_Report_No", type any}, {"PIC_Report_No", type text}, {"Report_Type", type text}, {"Report_Date", type date}, {"ISO_Number", type text}, {"Joint_ID", type text}, {"Comments", type text}, {"Joint ID QC Data", type text}, {"Report QC Data", type any}})
in
    #"Changed Type"
```

### `RT Films Att RT_MI Master Register`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\RT Films Master Register\Source\RT Films Master Register for PBI.xlsx"), null, true),
    Att.RT_MI_Sheet = Source{[Item="Att.RT_MI",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Att.RT_MI_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"CPY Doc No:", type any}, {"Column2", type text}, {"Column3", type any}, {"Column4", type text}, {"Column5", type text}, {"Column6", type any}, {"Column7", type text}, {"Column8", type text}, {"CTR Doc No:", type text}, {"Column10", type any}, {"Column11", type text}, {"Column12", type text}, {"Column13", type text}, {"Column14", type text}, {"Column15", type text}, {"Column16", type text}, {"Column17", type any}, {"Column18", type any}}),
    #"Removed Top Rows" = Table.Skip(#"Changed Type",3),
    #"Promoted Headers1" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Promoted Headers1",{{"Sl.No.", Int64.Type}, {"Report No", type text}, {"Quantity of RT Films", Int64.Type}, {"ISO number", type text}, {"Weld Joint number", type text}, {"Date of exposure", type date}, {"Box No", type text}, {"Sub-Box No", type text}, {"HANDOVER AREA", type text}, {"SCTR", type text}, {"Column3", type text}, {" Seal # ", type text}, {"RT Films Register No.", type text}, {"Remarks", type text}, {"Column1", type text}, {"Column2", type text}, {"Remarks (Quantity of RT Films as per Viktor repor)", Int64.Type}, {"Column18", type any}}),
    #"Trimmed Text" = Table.TransformColumns(#"Changed Type1",{{"Report No", Text.Trim, type text}}),
    #"Removed Columns" = Table.RemoveColumns(#"Trimmed Text",{"Column18"}),
    #"Added RT Rep Number" = Table.AddColumn(#"Removed Columns", "RT Report No", each if [SCTR] = "CCC" then "NFE1-" & [Report No] else [Report No]),
    #"Reordered Columns" = Table.ReorderColumns(#"Added RT Rep Number",{"RT Report No", "Sl.No.", "Report No", "Quantity of RT Films", "ISO number", "Weld Joint number", "Date of exposure", "Box No", "Sub-Box No", "HANDOVER AREA", "SCTR", "Column3", " Seal # ", "RT Films Register No.", "Remarks", "Column1", "Column2", "Remarks (Quantity of RT Films as per Viktor repor)"}),
    #"Replaced Value ""_"" to """"" = Table.ReplaceValue(#"Reordered Columns"," ","",Replacer.ReplaceText,{"Report No"}),
    #"Replaced Value ""_"" to """" 2" = Table.ReplaceValue(#"Replaced Value ""_"" to """""," ","",Replacer.ReplaceText,{"RT Report No"})
in
    #"Replaced Value ""_"" to """" 2"
```

### `RT Films For PBI WD+WR`

```m
let
    Source = Excel.Workbook(File.Contents("C:\Users\meg19\OneDrive\Рабочий стол\PCI Work File\WORK FILES\RT Films Master Register\Source\RT Films data PBI For Update.xlsx"), null, true),
    #"For PBI WD+WR_Sheet" = Source{[Item="For PBI WD+WR",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"For PBI WD+WR_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Sub-Contractor", type text}, {"HA", type text}, {"RT Report", type text}, {"RT Total Films by Joint +""CCC RS""+ ""Talisman not found"" ""PR all""", type number}, {"RT Total Films +""CCC RS""", type number}, {"RT Total Films", type number}, {"Acc Films", type number}, {"REJ Films", Int64.Type}, {"First RT Acc/Rej", type text}, {"REJ Films ПРОБНЫЙ", Int64.Type}, {"RT Total Films RS", type number}, {"RT Total Films -""RS""", type number}, {"RT Total Films - ""RS"" ""A""", type number}, {"Count of RT Report", Int64.Type}}),
    #"Replaced Value" = Table.ReplaceValue(#"Changed Type"," ","",Replacer.ReplaceText,{"RT Report"})
in
    #"Replaced Value"
```

## From non-DataModel members

### `Version`

```
1.32
```

### `Settings`

```json
{"Version":4,"ReportSettings":{},"QueriesSettings":{"TypeDetectionEnabled":true,"RelationshipImportEnabled":true,"Version":"2.123.424.0"}}
```

### `Metadata`

```json
{"Version":5,"AutoCreatedRelationships":[],"CreatedFrom":"Cloud","CreatedFromRelease":"2026.08"}
```

### `Connections`

```json
{"Version":3,"RemoteArtifacts":[{"DatasetId":"50adc88f-c561-4d3e-ba0c-16147c58f50c","ReportId":"d33b4c26-c1d8-42f0-b9d0-9ace6ae8ee3c"}]}
```

`RemoteArtifacts` records that this .pbix is bound to a published Fabric/Power BI dataset 
(`DatasetId 50adc88f-c561-4d3e-ba0c-16147c58f50c`, `ReportId d33b4c26-c1d8-42f0-b9d0-9ace6ae8ee3c`). 
The local `DataModel` is still a full import model — the data is embedded, not DirectQuery.

### `DAXQueries/Query%201.dax` — verbatim

```dax
// Learn more about DAX queries at https://aka.ms/dax-queries
// Here is a sample DAX query from your model, click 'Run'
// Try other DAX queries by right clicking a table, column, or measure in the data pane and choosing one from 'Quick queries'
EVALUATE
FILTER (
    'Project WD+WR+INCO+Acciona',
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] ="TEKFEN"
        && 'Project WD+WR+INCO+Acciona'[RT Report] <> "" && 'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris]<>"Exclude Films:Debris"
)
```

Tab metadata (`DAXQueries/.pbi/daxQueries.json`):

```json
{"version":"1.0.0","tabOrder":["Query 1"],"defaultTab":"Query 1"}
```

### `DiagramLayout`

Version `1.1.0`, 1 diagram(s).

- diagram ordinal 0, name `All tables`: 63 nodes, 0 hidden-node entries, scrollPosition (42.2, 317.1), zoom 68.75583378229854

| table node | x | y | w | h |
|---|---|---|---|---|
| `TREND RT UT` | 926 | -10 | 234 | 224 |
| `Flange ovAssets_1619` | 5472 | 0 | 234 | 300 |
| `Flg GAC_Flange Repair` | 6180 | 0 | 234 | 300 |
| `Bracing FE_Analysis` | 6464 | 0 | 234 | 300 |
| `Welding Progress (Project) Nov 2024 - Nov 2025` | 6748 | 0 | 234 | 152 |
| `PIC_vs_Talisman_2026_02_16` | 7032 | 0 | 234 | 300 |
| `RT Films For PBI WD+WR` | 7600 | 0 | 234 | 300 |
| `RT Films Att RT_MI Master Register` | 7316 | 0 | 234 | 300 |
| `AllTrain_CSVExport_Joint Record` | 1286 | 111 | 234 | 357 |
| `CSVExport_Welder Record` | 1551 | 112 | 234 | 348 |
| `AllTrain_CSVExport_Joint Record NOT WELDED` | 1846 | 113 | 234 | 347 |
| `Trend Active Welders` | 338 | 158 | 234 | 152 |
| `Flange Progress` | 42 | 223 | 234 | 421 |
| `Flg CCC_Flange Repair` | 5756 | 261 | 234 | 300 |
| `Inco Weld Log` | 1012 | 275 | 234 | 300 |
| `Weld Dump` | 618 | 293 | 234 | 300 |
| `WELDERS_Qualification` | 2140 | 301 | 234 | 300 |
| `SCTR OVERALL APPLIED WELDERS` | 2418 | 303 | 234 | 300 |
| `Acciona_Query` | 2690 | 305 | 234 | 300 |
| `Inco of NDE Summary` | 1307 | 508 | 234 | 200 |
| `Project WD+WR+INCO+Acciona` | 963 | 653 | 234 | 300 |
| `Inco NDT Tracking` | 1857 | 655 | 288 | 370 |
| `Project WD+WR` | 600 | 685 | 234 | 300 |
| `CUM FILE Welders Performance 1 Month` | 0 | 720 | 234 | 300 |
| `l2_ndt_list` | 1583 | 770 | 234 | 300 |
| `l3_ndt_spo_summary (2)` | 2503 | 840 | 234 | 300 |
| `CSVExport_Welder Record - (ACC  REJ )` | 2240 | 844 | 234 | 300 |
| `l3_ndt_spo_summary` | 3200 | 904 | 234 | 300 |
| `Flange ovAssets_1381` | 3768 | 904 | 234 | 300 |
| `HA l0_abs_guide` | 4052 | 904 | 234 | 300 |
| `WPS Reg#` | 4336 | 904 | 234 | 300 |
| `Flange ovAssets_1510` | 4620 | 904 | 234 | 300 |
| `SCDB Data l0_scdb_task` | 4904 | 904 | 234 | 300 |
| `WPQ WELDING PROCESS` | 5188 | 954 | 234 | 200 |
| `PWHT Status` | 3484 | 990 | 234 | 128 |
| `CUM FILE UT Welders Performance 2 Weeks` | 1175 | 1003 | 234 | 300 |
| `WEEK #   STATUS` | 1925 | 1114 | 234 | 296 |
| `CUM WEEK # Status` | 1571 | 1115 | 234 | 300 |
| `Calendar` | 885 | 1186 | 234 | 300 |
| `Spool Dump` | 591 | 1186 | 234 | 300 |
| `Man_Power` | 2263 | 1228 | 234 | 224 |
| `CUM FILE Welders Performance 2 Weeks` | 159 | 1272 | 234 | 300 |
| `Flange BreakDown` | 2937 | 1399 | 234 | 176 |
| `Flg Onepager_data` | 1318 | 1400 | 234 | 300 |
| `Testpack-wise Details Report` | 3192 | 1400 | 234 | 300 |
| `t_QOB_Log_SP` | 3476 | 1400 | 234 | 300 |
| `UT TRACKER (TEK)` | 1561 | 1443 | 234 | 300 |
| `UT TRACKER (GAC)` | 1938 | 1444 | 234 | 300 |
| `Temporary` | 3760 | 1486 | 234 | 145 |
| `CUM MPI Done` | 1015 | 1545 | 234 | 128 |
| `TREND Report` | 781 | 1733 | 234 | 366 |
| `WPQ RECORD REGISTER` | 1210 | 1791 | 234 | 300 |
| `Acciona Joint Summary` | 1494 | 1791 | 234 | 300 |
| `UT TRACKER (CCC)_Talisman` | 2346 | 1791 | 234 | 300 |
| `TALISMAN DATA` | 2620 | 1794 | 234 | 300 |
| `Talisman Spool Dump` | 2916 | 1796 | 234 | 300 |
| `Flg Enova Flange Repair_W17` | 4370 | 1824 | 234 | 300 |
| `Flg Enova Flange Repair_W10` | 5217 | 1826 | 234 | 296 |
| `Weld Length` | 1778 | 1865 | 234 | 152 |
| `WPS Status CUM` | 487 | 1897 | 234 | 152 |
| `Flg TFN_Flange Repair` | 4086 | 2085 | 234 | 300 |
| `Flg Medgulf_Flange Repair` | 3236 | 2085 | 234 | 300 |
| `Flg tekfen repair log main log` | 3662 | 2085 | 234 | 300 |

`DiagramLayout` carries only node placement — it has **no** relationship lines of its own; 
relationship geometry is derived by Power BI from the model relationships listed above.

### `Report/LinguisticSchema`

2072 bytes of XML, `Language="en-US"`, `DynamicImprovement="Default"`. It contains 5 `<Entity>` 
elements, all `Source="Generated"`, and they name **report pages** (Q&A "pods"), not model tables:

- `Piping_Daily_Weld_Progress_EP`
- `Errors`
- `RT_UT_Progress_Project`
- `RT_UT_Progress_Project_Dia_Inch`
- `RT_UT_Films_Progress_Project`

No hand-authored synonyms, no phrasings — nothing here changes the calculation logic.

### Custom visual package

| field | value |
|---|---|
| guid | `dg5AAA90EFEFE747CB9357C4FC19B85A58` |
| name | `DialGauge` |
| displayName | DialGauge |
| version | `3.1.4` (package `3.1.4`) |
| author | CloudFronts Technologies LLP <support@cloudfronts.com> |

Registered in `report.json` under `publicCustomVisuals`. **It is not used by any visual in the 
report** — no `visual.json` carries this guid as its `visualType` (the 21 gauges on the pages are 
the built-in `gauge`). Nothing to reproduce.

### Themes and static resources

- base theme `CY23SU11` (`Report/StaticResources/SharedResources/BaseThemes/CY23SU11.json`)
- custom theme `CTJV7481341463700919.json` (`RegisteredResources`)
- images: `1_RT_24405066057455072.PNG`, `1_RT_385139286232012.PNG`, `1_UT_813978828605034.PNG`, `Flange47837927174365236.jpg`
- `SecurityBindings` (78,662 bytes, binary signature blob — not parsed, carries no calculation logic)

