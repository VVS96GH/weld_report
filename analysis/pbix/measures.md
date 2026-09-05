# DAX measures and calculated columns

Recovered from the 1,043,647,012-byte `DataModel` member (Xpress9-compressed VertiPaq / 
`metadata.sqlitedb`). Extraction path: pbixray 0.15.5 driving a locally built `libxpress9.so` 
(see `model.md` -> "How this was extracted").

## Counts

| item | count |
|---|---|
| measures | 448 |
| distinct home tables for measures | 1 (Calendar) |
| measures with a FormatString | 379 |
| measures with a DisplayFolder | 0 |
| calculated columns (DAX `Expression` on a column) | 2913 total, 291 on non-auto-date tables |
| calculated tables (DAX `Expression` on a table) | 438 total, 1 non-auto-date |

> The auto-date machinery inflates raw counts: the model holds 437 `LocalDateTable_*` / 
> `DateTableTemplate_*` tables that Power BI generates for every date column. They are 
> excluded below and are irrelevant to a Postgres rebuild.

## Reading guide

### The three fact tables and the name suffix convention

Measure names carry a suffix that says which fact table they read. This is a convention, not 
metadata — but it holds across the whole model. Counting how often each suffix co-occurs with 
each referenced table:

| name suffix | measures | dominant table referenced |
|---|---|---|
| `(none)` | 196 | `Project WD+WR+INCO+Acciona` (70), `Weld Dump` (32) |
| `"PR all"` | 158 | `Project WD+WR+INCO+Acciona` (119), `Calendar` (9) |
| `"EP"` | 39 | `Weld Dump` (26), `Calendar` (3) |
| `"PR"` | 31 | `Project WD+WR` (23), `Calendar` (1) |
| `"WD"` | 13 | `Weld Dump` (10), `Calendar` (2) |
| `"PR All"` | 11 | `Project WD+WR+INCO+Acciona` (11) |

So: **`"EP"` / `"WD"` -> `Weld Dump`**, **`"PR"` -> `Project WD+WR`**, 
**`"PR all"` / `"PR All"` -> `Project WD+WR+INCO+Acciona`**. The three are progressively wider 
scopes of the same weld population (EP only; EP + weld-repair; EP + weld-repair + INCO + Acciona 
subcontractors). A Postgres rebuild needs the same three scopes, not three tables.

### Measure dependency depth

| other measures referenced | measures |
|---|---|
| 0 | 341 |
| 1 | 49 |
| 2 | 55 |
| 3 | 3 |

341 of 448 measures are self-contained `CALCULATE(...)` expressions over one fact table — they 
translate to a single filtered SQL aggregate. The rest compose other measures.

### Dangling references (broken measures)

- `'Master Table'` is referenced by 4 measure(s) but **no such table exists in the model**: `[Total Scope Dia "BW","CLET","GW","MW" Master Table]`, `[Total Scope Dia Welded "BW","CLET","GW","MW" Master Table]`, `[Total Scope Dia All Types Master Table]`, `[Total Scope Dia Welded "All Types" Master Table]`

These measures cannot evaluate in the shipped model; do not port them without asking what 
`Master Table` was meant to be.

### Measure index by source table

<details><summary><code>Project WD+WR+INCO+Acciona</code> — 199 measures</summary>

- `[CUM Total No of films Rej "PR all"]`
- `[CUM Total Welded Dia WP1 "PR all"]`
- `[Cur_Date "PR all"]`
- `[Cur_Date RT DATE "PR all"]`
- `[Final_Welders_No_RT]`
- `[First_Weld Date "PR all"]`
- `[HT Progress All "PR all"]`
- `[INCO Length Ratio %]`
- `[Inco RT/UT Length Last 1 Month]`
- `[Inco RT/UT Length Last 2 weeks]`
- `[Inco RT/UT Length Overall]`
- `[Inco RT/UT Rej Length Last 1 Month]`
- `[Inco RT/UT Rej Length Last 2 weeks]`
- `[Inco RT/UT Rej Length Overall]`
- `[Joint Uniq "PR all" Total]`
- `[Joint Uniq "PR all" Total "BW","GW","CLET","MW"]`
- `[Joint Uniq "PR all" Total Welded "BW","GW","CLET","MW"]`
- `[Joint Uniq "PR all" Welded]`
- `[Joint Uniq "PR all" Welded "F"]`
- `[Joint Uniq "PR all" Welded & R/RW]`
- `[Joint Uniq R/RW not welded "PR all"]`
- `[Last 1 Month RT Total Films "A" "PR all"]`
- `[Last 1 Month RT Total Films "PR all"]`
- `[Last 1 Month RT Total Films "R" "PR all"]`
- `[Last 1 Month Welded Joint ID Uniq "PR all"]`
- `[Last 2 weeks RT Total Films "A" "PR all"]`
- `[Last 2 weeks RT Total Films "PR all"]`
- `[Last 2 weeks RT Total Films "R" "PR all"]`
- `[Last 2 weeks UT Total Length "PR all"]`
- `[Last 2 weeks UT Total Length "R" "PR all"]`
- `[Last 2 weeks Welded Joint ID Uniq "PR all"]`
- `[Last_Weld Date "PR all"]`
- `[MT + PT "PR all"]`
- `[MT Progress  CCC  "PR all"]`
- `[MT Progress All "PR all"]`
- `[MT Progress All "PR all" 2]`
- `[MT Progress All % Weld Status "PR_All"]`
- `[No Weld Done CCC]`
- `[No Weld Done GAC]`
- `[No Weld Done Inco]`
- `[No Weld Done MEDGULF]`
- `[No Weld Done TEKFEN]`
- `[No of Welders Active 7 Days "PR all"]`
- `[No of Welders NOT Active 180 Days  "PR all"]`
- `[No of Welders NOT Active 21 to 90 Days "PR all"]`
- `[No of Welders NOT Active 7 to 21 Days "PR all"]`
- `[No of Welders NOT Active 90 to 180 Days "PR all"]`
- `[No. of Welders 'PR all"]`
- `[Numb RT 2024 "PR all"]`
- `[Numb RT Last 1 Month "PR all"]`
- `[Numb RT Last 1 Month "PR all" "A"]`
- `[Numb RT Last 1 Month "PR all" "R"]`
- `[Numb RT Last 2 Weeks "PR all"]`
- `[Numb RT Last 2 Weeks "PR all" "R"]`
- `[Numb RT Last 2 weeks "PR all" "A"]`
- `[Numb RT/UT "PR all"]`
- `[Numb RT/UT "PR all" "A"]`
- `[Numb RT/UT "PR all" "R"]`
- `[Numb RT/UT "PR all" 2]`
- `[Numb RT/UT "PR all" TESTED]`
- `[Numb UT "A"  last 2 weeks "PR All"]`
- `[Numb UT "A" "PR All"]`
- `[Numb UT "A" "PR All" Tracker]`
- `[Numb UT "PR All"]`
- `[Numb UT "PR All" Tracker]`
- `[Numb UT "R" "PR All"]`
- `[Numb UT "R" "PR All" Tracker]`
- `[Numb UT "R" Last 2 Weeks "PR All"]`
- `[Numb UT Last 2 Weeks "PR all"]`
- `[ORIF Progress All "PR all"]`
- `[Open Punch X]`
- `[Open Punch Y]`
- `[Open Punch Z]`
- `[PADLT Progress All "PR all"]`
- `[PAUT "R" Progress All "PR all"]`
- `[PAUT Progress All "PR all"]`
- `[PMI Progress All "PR all"]`
- `[PT Progress All "PR all"]`
- `[PT Progress All "PR all" 2]`
- `[PWHT All BACKLOG "BW" "GW" "CLET" "PR all"]`
- `[PWHT All BACKLOG All WELD TYPE "PR all"]`
- `[PWHT All BACKLOG All WELD TYPE "PR all" (New PBI Rule)]`
- `[PWHT BACKLOG RT100% "PR all"]`
- `[PWHT Backlog "CCC"  "BW","GW","CLET" "PR all"]`
- `[PWHT Backlog RT100% "CCC" "PR all"]`
- `[PWHT Backlog Weld Status All Weld Types RT NOT Done "PR all"]`
- `[PWHT Backlog within 15 Days below 30 Days "PR all"]`
- `[PWHT Backlog within 3 Days "PR all"]`
- `[PWHT Backlog within 3 Days below 7 Days "PR all"]`
- `[PWHT Backlog within 7 Days below 15 Days "PR all"]`
- `[PWHT Backlog within Above 30 Days "PR all"]`
- `[PWHT Done "BW" "GW" "PR all"]`
- `[PWHT Done All Weld Types "PR all"]`
- `[QTY TestPacks]`
- `[QTY Welders & No RT Report]`
- `[QTY Welders & No RT Report %]`
- `[QTY Welders & RT Report]`
- `[RT 10% Forecast Backlog]`
- `[RT 100% Forecast Backlog]`
- `[RT 20% Forecast Backlog]`
- `[RT 30% Forecast Backlog]`
- `[RT 5 10 20 100% B.log Joints+NO PWHT Progress Weld Status "EP" "PR all"]`
- `[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP" "PR all"]`
- `[RT 5% Forecast Backlog]`
- `[RT Average Production 2024-2026 per Month]`
- `[RT BACKLOG Dia Total Project "PR all"]`
- `[RT BACKLOG INCO]`
- `[RT BACKLOG To be Remove "PR all"]`
- `[RT BACKLOG Total Project "PR all"]`
- `[RT BACKLOG Total Project & PWHT "Y" NOT Done "PR all"]`
- `[RT BACKLOG Total Project & PWHT"Y" NOT Done FABRICATED "PR all"]`
- `[RT Backlog & FABRICATED "PR All"]`
- `[RT Backlog & FABRICATED & PWHT Spool Date "PR All"]`
- `[RT Backlog within 15 Days below 30 "PR all"]`
- `[RT Backlog within 3 Days "PR all"]`
- `[RT Backlog within 3 Days below 7 "PR all"]`
- `[RT Backlog within 7 Days below 15 "PR all"]`
- `[RT Backlog within above 30 Days"PR all"]`
- `[RT Backlog+PWHT "N" "PR all"]`
- `[RT Backlog+PWHT Progress "Y" "PR all"]`
- `[RT Backlog+PWHT Progress "Y" Done + PWHT "N" FABRICATED "PR all"]`
- `[RT Dia Average Production 2024-26 per Month]`
- `[RT Dia Total Forecast Backlog]`
- `[RT Total Films "PR all"]`
- `[RT Total Films "PR all" "A"]`
- `[RT Total Films "PR all" "R"]`
- `[RT Total Films RS by Joint "PR all"]`
- `[RT Total Films by Joint "PR all"]`
- `[RT Total Films by Joint "PR all" "R"]`
- `[RT Total Films by Joint "PR all" "R" ПРОБНЫЙ]`
- `[RT Total Films by Joint "PR all" (2)]`
- `[RT Total Films by Joint +"CCC RS" "PR all"]`
- `[RT Total Films by Joint -"RS" "PR all"]`
- `[RT Total Films by Joint-"RS" "PR all" "A"]`
- `[RT Total Forecast Backlog]`
- `[RT/UT Rejection Rate by Joint "PR All"]`
- `[RT10% Backlog Joints "PRall" (One Formula)]`
- `[RT100% Backlog "PR all"]`
- `[RT100% Backlog & NO PWHT Req "CCC" "PR all"]`
- `[RT100% Backlog & PWHT Progress CCC  "PR all"]`
- `[RT100% Backlog Forecast "PR all"]`
- `[RT100% Backlog Joints "PRall" (One Formula)]`
- `[RT20% Backlog Joints "PRall" (One Formula)]`
- `[RT5% Backlog Joints "PRall" (One Formula)]`
- `[Remaining Joints for 10% Control]`
- `[Remaining Joints for 100% Control]`
- `[Remaining Joints for RT5% Control]`
- `[Total HT Reports Cross Check PRJ Data & FRB Match]`
- `[Total HT Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total MT Reports Cross Check PRJ Data & FRB Match]`
- `[Total MT Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total ORIF Reports Cross Check PRJ Data & FRB Match]`
- `[Total ORIF Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total PADLT Reports Cross Check PRJ Data & FRB Match]`
- `[Total PADLT Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total PMI Reports Cross Check PRJ Data & FRB Match]`
- `[Total PMI Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total PT Reports Cross Check PRJ Data & FRB Match]`
- `[Total PT Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total PWHT Reports Cross Check PRJ Data & FRB Match]`
- `[Total PWHT Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total RT Reports Cross Check PRJ Data & FRB Match]`
- `[Total RT Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total Reports Cross Check PRJ Data & FRB]`
- `[Total Reports Cross Check PRJ Data & FRB Match]`
- `[Total Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total Reports Project Data]`
- `[Total Scope Dia "BW" "PR all"]`
- `[Total Scope Dia "BW" "PR all" 2]`
- `[Total Scope Dia WP1 "BW","CLET","GW","MW" "PR all" (New)]`
- `[Total Scope Dia WP1 All Types "PR all" (New)]`
- `[Total Scope Joints Uniq "All Type" "PR all"]`
- `[Total Scope Joints Uniq "BW" "CLET" "GW" "PR all"]`
- `[Total Scope Joints Uniq "BW" "PR all"]`
- `[Total UT Reports Cross Check PRJ Data & FRB Match]`
- `[Total UT Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total VBT Reports Cross Check PRJ Data & FRB Match]`
- `[Total VBT Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total VI Reports Cross Check PRJ Data & FRB Match]`
- `[Total VI Reports Cross Check PRJ Data & FRB Not Found]`
- `[Total Welded Dia WP1 "BW","CLET","GW","MW" "PR all" (New)]`
- `[Total Welded Dia WP1 "PR all"]`
- `[Total Welded Dia WP1 All Types "PR all" (New)]`
- `[Total Welded RT Dia WP1 2024 "PR all"]`
- `[Tracer Shot "PR all"]`
- `[UT Defect Length by Joint "PR all"]`
- `[UT Defect Length by Welder "PR all"]`
- `[UT Inspected Length by Joint "PR all"]`
- `[UT Inspected Weld Length by Welder "PR all"]`
- `[UT Weld Length by Joint "PR all"]`
- `[UT Weld Length by Welder "PR all"]`
- `[UT Weld Length by Welder "PR all"2]`
- `[VBT Progress All "PR all"]`
- `[VI Progress All "PR all"]`
- `[Welder_ID_No_RT]`
- `[Welders_No_RT]`
- `[Welding Dia Average Production 2024-26 per Month]`
- `[Welding Dia Average Production Overall per Month]`
- `[Welding Dia Average Production per week]`

</details>

<details><summary><code>(no table reference — pure measure arithmetic)</code> — 97 measures</summary>

- `[% UT Unacceptable Limit "PR all"]`
- `[% UT Unacceptable Limit 1.5% "PR all"]`
- `[% UT of Target "PR all"]`
- `[% UT of Target "PR all" 1%]`
- `[% Unacceptable Limit "INCO"]`
- `[% Unacceptable Limit "PR"]`
- `[% Welding Complete]`
- `[% Welding Dia Complete]`
- `[% of Target "PR"]`
- `[CUM Flange BACKLOG]`
- `[CUM Flange Rejection Rate Project]`
- `[CUM INCO Length Ratio %]`
- `[CUM No. of Welders 'PR all"]`
- `[CUM PWHT All BACKLOG "BW" "GW" "PR all"]`
- `[CUM PWHT All BACKLOG All WELD TYPE "PR all"]`
- `[CUM PWHT Backlog Weld Status "BW" "GW" "EP"]`
- `[CUM PWHT Backlog Weld Status All WELD Types "EP"]`
- `[CUM RT 5 10 20 100% B.log Joints Weld Status "EP"]`
- `[CUM RT BACKLOG Total Project "PR all"]`
- `[CUM RT BACKLOG Total Project & PWHT NOT Done "PR all"]`
- `[CUM RT FILM Ratio % "PR all"]`
- `[CUM RT FILM Ratio % "PR"]`
- `[CUM RT FILM Ratio % "WD"]`
- `[CUM RT FILM Ratio % by Joint "WD"]`
- `[CUM RT FILM Ratio % by joint "PR all"]`
- `[CUM Rejection UT Rate Joint "PR all" Tracker]`
- `[CUM Rejection UT Rate Length by Sub-Con "PR all"]`
- `[CUM Repaired running total Calendar]`
- `[CUM To be Repaired running total Calendar]`
- `[Days Since First Weld]`
- `[Flange Break Down Rate %]`
- `[Flange ID De-Tightening Rate %]`
- `[Flanges ID Jointed %]`
- `[Inco Last 1 Month len Ratio% by Welder Mesure]`
- `[Inco Last 2 weeks len Ratio% by Welder Mesure]`
- `[Inco Overall Len Ratio% by Welder Mesure]`
- `[Joint Uniq "PR all" Balance]`
- `[Joint Uniq "PR all" Forecast Balance RT10%]`
- `[Joint Uniq "PR all" Forecast Balance RT5%]`
- `[Last 1 Month RT FILM Ratio % "PR all"]`
- `[Last 2 weeks RT FILM Ratio %]`
- `[Last 2 weeks RT FILM Ratio % "PR all"]`
- `[Last 2 weeks UT Rej Length Ratio % "PR all"]`
- `[Last_Friday_CutOff]`
- `[Last_Friday_CutOff_2_Weeks]`
- `[Last_Friday_CutOff_4_Weeks]`
- `[MT Progress All % Weld Status "PR all"]`
- `[Months to keep Dia RT Backlog]`
- `[Months to keep RT Backlog]`
- `[No Days Since Last Weld]`
- `[No Days Since Last Weld "PR all"]`
- `[No Weld Done Project "PR all"]`
- `[QTY Years for RT Backlog Forecast]`
- `[RT Backlog+PWHT "N" "PR"]`
- `[RT Backlog+PWHT Progress "Y" "PR"]`
- `[RT FILM Ratio %]`
- `[RT FILM Ratio % "PR"]`
- `[RT FILM Ratio % STATUS]`
- `[RT FILM Ratio % STATUS LAST 2 WEEKS]`
- `[RT FILM Ratio % by Joint "EP"]`
- `[RT FILM Ratio % by Joint "PR all"]`
- `[RT FILM Rej Ratio % "PR all"]`
- `[RT Ratio % A/RT]`
- `[RT Ratio % RT/ Welded Joint "BW","GW","CLET","MW" ID uniq "PR all"]`
- `[RT Ratio % RT/ Welded Joint ID uniq "PR all"]`
- `[RT Ratio % RT/ Welded Joint ID uniq "PR all" & R/RW]`
- `[RT Ratio % RT/ Welded Joint ID uniq "PR"]`
- `[RT Ratio % RT/ Welded Joint ID uniq "Talisman"]`
- `[RT Total Films by Joint "PR all" "A"]`
- `[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]`
- `[RT10% Backlog "EP"]`
- `[RT10% Backlog Joints "EP"]`
- `[RT20% Backlog "EP"]`
- `[RT20% Backlog Joints "EP"]`
- `[RT5% Backlog "EP"]`
- `[RT5% Backlog Joints "EP"]`
- `[Rejection Rate Joint "PR all"]`
- `[Rejection Rate Joint "PR"]`
- `[Rejection Rate Joint "WD"]`
- `[Rejection UT Rate Joint "EP"]`
- `[Rejection UT Rate Joint "PR all"]`
- `[Rejection UT Rate Joint "PR all" 2]`
- `[Rejection UT Rate Length by Sub-Con "PR all"]`
- `[Rejection UT Rate Length by Sub-Con "PR all" 2]`
- `[TP Complete "PR all"]`
- `[Tested Joints]`
- `[Tested Joints "PR all"]`
- `[Total FRB Reports]`
- `[Total FRB Reports SPO Not Upload]`
- `[Total FRB Reports SPO Upload]`
- `[Total Flanges Jointed % 1510]`
- `[Total_Approve in FRB]`
- `[Total_EP FRB]`
- `[UT Ratio % UT/ Welded Joint ID uniq "EP"]`
- `[UT Ratio % UT/ Welded Joint ID uniq "PR all"]`
- `[UT Ratio % UT/ Welded Joint ID uniq "PR all" Tracker]`
- `[WELDER ID]`

</details>

<details><summary><code>Weld Dump</code> — 68 measures</summary>

- `[CUM Total No of films Rej]`
- `[Count of Joints]`
- `[Count of Joints Welded]`
- `[Cumulative Dia Welded]`
- `[Cur_Date]`
- `[First_Weld Date]`
- `[Last 2 weeks Numb RT]`
- `[Last 2 weeks RT Total Films]`
- `[Last 2 weeks RT Total Films "A"]`
- `[Last 2 weeks RT Total Films "R"]`
- `[Last 2 weeks Welded Joint ID Uniq]`
- `[Last_Weld Date]`
- `[MT Progress All % Weld Status "EP"]`
- `[No of Welders Active 7 Days]`
- `[No of Welders NOT Active 180 Days]`
- `[No of Welders NOT Active 21 to 90 Days]`
- `[No of Welders NOT Active 7 to 21 Days]`
- `[No of Welders NOT Active 90 to 180 Days]`
- `[No. of Welders]`
- `[Numb RT/UT]`
- `[Numb RT/UT "A"]`
- `[Numb RT/UT "R"]`
- `[Numb UT "A" "EP"]`
- `[Numb UT "EP"]`
- `[Numb UT "R" "EP"]`
- `[PWHT BACKLOG RT100% "EP"]`
- `[PWHT Backlog Weld Status "BW" "GW" "EP"]`
- `[PWHT Backlog Weld Status All Weld Types "EP"]`
- `[PWHT Backlog Weld Status All Weld Types RT NOT Done "EP"]`
- `[PWHT Backlog above 15 Days below 30 "WD"]`
- `[PWHT Backlog above 3 Days below 7 "WD"]`
- `[PWHT Backlog above 30 Days "WD"]`
- `[PWHT Backlog above 7 Days below 15 "WD"]`
- `[PWHT Backlog within 3 Days "WD"]`
- `[PWHT Done "BW" "GW" "EP"]`
- `[PWHT Done All Weld Types "EP"]`
- `[RT 100% Backlog Joints Weld Status "EP"]`
- `[RT 5 10 20 100% B.log Joints Weld Status "EP"]`
- `[RT 5 10 20 100% B.log Joints Weld Status "EP" & FABRICATED]`
- `[RT 5 10 20 100% B.log Joints+NO PWHT Progress Weld Status "EP"]`
- `[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP"]`
- `[RT BACKLOG Total Project & PWHT NOT Done "EP"]`
- `[RT Backlog above 15 days below 30 "WD"]`
- `[RT Backlog above 3 days below 7 "WD"]`
- `[RT Backlog above 30 "WD"]`
- `[RT Backlog above 7 days below 15 "WD"]`
- `[RT Backlog within 3 days "WD"]`
- `[RT Total Films]`
- `[RT Total Films "A"]`
- `[RT Total Films "R"]`
- `[RT Total Films by Joint "A" "EP"]`
- `[RT Total Films by Joint "EP"]`
- `[RT Total Films by Joint "R" "EP"]`
- `[RT10% Backlog Joints Weld Status "EP"]`
- `[RT100% Backlog "EP"]`
- `[RT20% Backlog Joints Weld Status "EP"]`
- `[RT5% Backlog Joints Weld Status "EP"]`
- `[Rejection Ratio Dia]`
- `[Status Fabricated]`
- `[Total Joint ID]`
- `[Total Scope Dia]`
- `[Total Welded Dia]`
- `[Total Welded Dia Weld P 1]`
- `[Tracer Shot]`
- `[UT Weld Length by Joint "EP"]`
- `[UT Weld Length by welder "EP"]`
- `[Welded Joint ID]`
- `[Welded Joint ID Uniq "EP"]`

</details>

<details><summary><code>Flange Progress</code> — 25 measures</summary>

- `[Flange ID Status Tested]`
- `[Flanges Backlog "FH,FHS"]`
- `[Flanges ID BreakDown]`
- `[Flanges ID Complete "BTC01"]`
- `[Flanges ID De-Tightening]`
- `[Flanges ID Inspected]`
- `[Flanges ID Inspected "Acc"]`
- `[Flanges ID Inspected "Rej"]`
- `[Flanges ID Inspected 2]`
- `[Flanges ID PCC De-Tightening]`
- `[Flanges ID PCC Tightening]`
- `[Total Flanges ID]`
- `[Total Flanges ID 100% Control]`
- `[Total Flanges ID Jointed]`
- `[Total Flanges ID Reinstatement]`
- `[Total Flanges ID Reinstatement SCDB]`
- `[Total Flanges ID Reinstatement SCDB "Z"+"TBN"]`
- `[Total Flanges ID Reinstatement SCDB "Z"+"TBN" Tight-n Date]`
- `[Total Flanges ID Reinstatement SCDB Tight-g Date]`
- `[Total Flanges ID Remainder]`
- `[Total Flanges ID TBN]`
- `[Total Flanges ID Tightening Constraction]`
- `[Total Flanges ID Tightening Constraction "CCC no cat"]`
- `[Total Flanges ID Tightening PCC]`
- `[Total Flanges ID Tightening PCC "CCC no cat"]`

</details>

<details><summary><code>Project WD+WR</code> — 23 measures</summary>

- `[CUM Total Welded Dia WP1 "PR"]`
- `[Cur_Date "PR"]`
- `[Joint Uniq "PR" Total]`
- `[Joint Uniq "PR" Welded]`
- `[Numb RT/UT "PR"]`
- `[Numb RT/UT "PR" "A"]`
- `[Numb RT/UT "PR" "R"]`
- `[PWHT All BACKLOG "BW" "GW" "CLET" "PR"]`
- `[PWHT BACKLOG RT100% "PR"]`
- `[PWHT Backlog "CCC" "PR"]`
- `[RT 5 10 20 100% B.Log GAC TKF MED Joints Weld Status "EP" "PR"]`
- `[RT 5 10 20 100% B.log Joints+NO PWHT Progress Weld Status "EP" "PR"]`
- `[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP" "PR"]`
- `[RT BACKLOG Total Project "PR"]`
- `[RT Total Films "PR"]`
- `[RT Total Films "PR" "A"]`
- `[RT Total Films "PR" "R"]`
- `[RT100% Backlog "PR"]`
- `[RT100% Backlog & NO PWHT Req "CCC" "PR"]`
- `[RT100% Backlog & PWHT Progress CCC  "PR"]`
- `[RT100% Backlog CCC "PR"]`
- `[Total Welded Dia WP1 "PR"]`
- `[Tracer Shot "PR"]`

</details>

<details><summary><code>TALISMAN DATA</code> — 7 measures</summary>

- `[Numb RT/UT "Talisman"]`
- `[Numb RT/UT "Talisman" "R"]`
- `[RT BACKLOG RT100% Talisman]`
- `[RT Total Films Rej by Joint Talisman "PR all"]`
- `[RT Total Films by Joint Talisman "PR all"]`
- `[Total Joint ID Uniq Talisman]`
- `[Total Joint ID Uniq Talisman Welded]`

</details>

<details><summary><code>SCTR OVERALL APPLIED WELDERS</code> — 6 measures</summary>

- `[Qualified Welders CCC]`
- `[Qualified Welders GAC]`
- `[Qualified Welders Inco]`
- `[Qualified Welders MEDGULF]`
- `[Qualified Welders TEKFEN]`
- `[Total Qualified Welders "PR all"]`

</details>

<details><summary><code>Spool Dump</code> — 5 measures</summary>

- `[Paint Cumulative]`
- `[Progress Surface]`
- `[WF Field]`
- `[WF Paint]`
- `[WF Shop]`

</details>

<details><summary><code>Master Table</code> — 4 measures</summary>

- `[Total Scope Dia "BW","CLET","GW","MW" Master Table]`
- `[Total Scope Dia All Types Master Table]`
- `[Total Scope Dia Welded "All Types" Master Table]`
- `[Total Scope Dia Welded "BW","CLET","GW","MW" Master Table]`

</details>

<details><summary><code>Flange ovAssets_1510</code> — 4 measures</summary>

- `[Flange ID from SCDB 1510 VPR "Not Found"]`
- `[Total Flanges ID 1510]`
- `[Total Flanges ID Jointed 1510]`
- `[Total Flanges ID Report Nbr 1510]`

</details>

<details><summary><code>Testpack-wise Details Report</code> — 3 measures</summary>

- `[Open Punch X "TPWD"]`
- `[Open Punch Y "TPWD"]`
- `[Open Punch Z "TPWD"]`

</details>

<details><summary><code>AllTrain_CSVExport_Joint Record</code> — 2 measures</summary>

- `[Total Scope Dia CCC]`
- `[Total Scope Joints CCC]`

</details>

<details><summary><code>Flg Onepager_data</code> — 2 measures</summary>

- `[Repaired FLG]`
- `[To be Repaired FLG]`

</details>

<details><summary><code>Inco of NDE Summary</code> — 1 measures</summary>

- `[CUM RT BACKLOG Inco]`

</details>

<details><summary><code>l3_ndt_spo_summary (2)</code> — 1 measures</summary>

- `[Total_EP FRB 2]`

</details>

<details><summary><code>Project WD+WR+INCO+Acciona, TALISMAN DATA</code> — 1 measures</summary>

- `[RT Total Films by Joint +"CCC RS"+ "Talisman not found" "PR all"]`

</details>

## Measures (448), in model order

### `[Total Scope Dia]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Weld Dump'[Dia inch]))
```

### `[Total Welded Dia]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Weld Dump'[Total Welded Dia]))
```

### `[Rejection Ratio Dia]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(SUM('Weld Dump'[Total Welded Dia]),'Weld Dump'[RT Acc/Rej]="R")
/CALCULATE(SUM('Weld Dump'[Total Welded Dia]),'Weld Dump'[RT Acc/Rej]<>"")
```

### `[Numb RT/UT]`

- home table: `Calendar`
- format string: `0`

```dax
COALESCE(
    CALCULATE(
        DISTINCTCOUNT('Weld Dump'[Joint ID]),
        'Weld Dump'[Weld Date] > 0,
        'Weld Dump'[RT Report] <> "",
        'Weld Dump'[RT Acc/Rej] <> "RS"
    ),
    0
)
```

### `[Rejection Rate Joint "WD"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "R"]/[Numb RT/UT]
```

### `[Numb RT/UT "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Acc/Rej]="R")
```

### `[Count of Joints]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(COUNT('Weld Dump'[Weld No.]))
```

### `[Count of Joints Welded]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(COUNT('Weld Dump'[Weld No.]),
'Weld Dump'[Repair & Reweld]="",
'Weld Dump'[Weld Date]>0)
```

### `[Cumulative Dia Welded]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(
	[Total Welded Dia],
	FILTER(
		ALLSELECTED('Weld Dump'[Weld Date]),
		ISONORAFTER('Weld Dump'[Weld Date], MAX('Weld Dump'[Weld Date]), DESC)
	)
)
```

### `[Progress Surface]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(sum('Spool Dump'[PAINTED SURFACE])/sum('Spool Dump'[Surface Area]))
```

### `[WF Paint]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Spool Dump'[Surface Area])-sum('Spool Dump'[PAINTED SURFACE]))
```

### `[WF Field]`

- home table: `Calendar`
- format string: `nan`

```dax
calculate(sum('Spool Dump'[Field Dia])-sum('Spool Dump'[Field DI Comp]))
```

### `[WF Shop]`

- home table: `Calendar`
- format string: `nan`

```dax
calculate(sum('Spool Dump'[Shop Dia])-sum('Spool Dump'[Shop DI Comp]))
```

### `[Paint Cumulative]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(
	SUM('Spool Dump'[Surface Area]),
	FILTER(
		ALLSELECTED('Spool Dump'[PAINTED]),
		ISONORAFTER('Spool Dump'[PAINTED], MAX('Spool Dump'[PAINTED]), DESC)
	)
)
```

### `[RT Total Films "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[Total No of films Acc]),
'Weld Dump'[RT Acc/Rej]<>"RS")
```

### `[RT Total Films "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[Total No of films Rej]))
```

### `[Welded Joint ID]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(COUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Repair & Reweld]="",
'Weld Dump'[Weld Date]>0)
```

### `[Total Joint ID]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(COUNT('Weld Dump'[Joint ID]))
```

### `[Numb RT/UT "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT Report]<>"",
'Weld Dump'[RT Acc/Rej]<>"RS")-
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Acc/Rej]="R")
```

### `[RT Total Films]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[RT Film Total]),
'Weld Dump'[RT Acc/Rej]<>"RS")
```

### `[RT FILM Ratio %]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[RT Total Films "R"]/[RT Total Films]
```

### `[RT5% Backlog "EP"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.05-[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]
```

### `[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT]/[Welded Joint ID Uniq "EP"]
```

### `[Welded Joint ID Uniq "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Repair & Reweld]="",
'Weld Dump'[Weld Date]>0)
```

### `[RT5% Backlog Joints "EP"]`

- home table: `Calendar`
- format string: `nan`

```dax
IF([RT5% Backlog "EP"]>0,[Welded Joint ID Uniq "EP"]*(0.05-[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]),"")
```

### `[RT10% Backlog "EP"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.1-[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]
```

### `[RT10% Backlog Joints "EP"]`

- home table: `Calendar`
- format string: `nan`

```dax
IF([RT10% Backlog "EP"]>0,[Welded Joint ID Uniq "EP"]*(0.1-[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]),"")
```

### `[RT20% Backlog "EP"]`

- home table: `Calendar`
- format string: `nan`

```dax
0.2-[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]
```

### `[RT20% Backlog Joints "EP"]`

- home table: `Calendar`
- format string: `nan`

```dax
IF([RT20% Backlog "EP"]>0,[Welded Joint ID Uniq "EP"]*(0.2-[RT/UT Ratio % RT/ Welded Joint ID uniq "EP"]),"")
```

### `[RT100% Backlog "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
'Weld Dump'[RT Weld Status]<>"NR",
'Weld Dump'[RT Report]="")
```

### `[RT Backlog within 3 days "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]="",
'Weld Dump'[No of Days "WD"]<=3)+
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
'Weld Dump'[RT Report] = "",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", ""} &&
        'Weld Dump'[No of Days "WD"] <=3
    )
)
```

### `[RT Backlog above 3 days below 7 "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]="",
'Weld Dump'[No of Days "WD"]>3,'Weld Dump'[No of Days "WD"]<=7)+
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
    'Weld Dump'[RT Report] = "",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", ""} &&
        'Weld Dump'[No of Days "WD"] > 3 &&
        'Weld Dump'[No of Days "WD"] <= 7
    )
)
```

### `[RT Backlog above 7 days below 15 "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]="",
'Weld Dump'[No of Days "WD"]>7,'Weld Dump'[No of Days "WD"]<=15)+
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
'Weld Dump'[RT Report] = "",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", ""} &&
        'Weld Dump'[No of Days "WD"] > 7 &&
        'Weld Dump'[No of Days "WD"] <= 15
    )
)
```

### `[RT Backlog above 15 days below 30 "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]="",
'Weld Dump'[No of Days "WD"]>15,'Weld Dump'[No of Days "WD"]<=30)+
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
    'Weld Dump'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Weld Dump'[Weld Date] > 0,
    'Weld Dump'[RT%] = 100,
    'Weld Dump'[RT Report] = "",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", ""} &&
        'Weld Dump'[No of Days "WD"] > 15 &&
        'Weld Dump'[No of Days "WD"] <= 30
    )
)
```

### `[RT Backlog above 30 "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]="",
'Weld Dump'[No of Days "WD"]>30)+
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
'Weld Dump'[RT Report] = "",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", ""} &&
        'Weld Dump'[No of Days "WD"] > 30
    )
)
```

### `[RT5% Backlog Joints Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})-CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]<>"")
```

### `[RT10% Backlog Joints Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})-CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]<>"")
```

### `[RT20% Backlog Joints Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})-CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]<>"")
```

### `[RT 5 10 20 100% B.log Joints Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
    'Weld Dump'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Weld Dump'[Weld Date] > 0,
    'Weld Dump'[RT Report] = "",
    'Weld Dump'[RT Weld Status] IN {"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"}
) +
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
'Weld Dump'[RT Report]="",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", "","S"}
    )
)
```

### `[RT 100% Backlog Joints Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[RT%]=100,
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT Report]="")
```

### `[Total Welded Dia Weld P 1]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Weld Dump'[Dia inch]),
'Weld Dump'[Repair & Reweld]="",
'Weld Dump'[Weld Date]>0,
'Weld Dump'[WeldPoint No.]=1)
```

### `[PWHT Backlog Weld Status All Weld Types "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Report]="")
```

### `[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Y/N]IN{"Y","25.01"},
'Weld Dump'[PWHT Report]<>"",
'Weld Dump'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]="")+
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Y/N]IN{"Y","25.01"},
'Weld Dump'[PWHT Report]<>"",
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
'Weld Dump'[RT Report]="",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", "","S"}
    )
)
```

### `[CUM RT FILM Ratio % "WD"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[RT FILM Ratio %],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[MT Progress All % Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[MT Weld Status]IN{"NR"},
'Weld Dump'[MT Report]<>"")
```

### `[PWHT Backlog within 3 Days "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Report]="",
'Weld Dump'[No of Days "WD"]<=3)
```

### `[PWHT Backlog above 3 Days below 7 "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Report]="",
'Weld Dump'[No of Days "WD"]>3,'Weld Dump'[No of Days "WD"]<=7)
```

### `[PWHT Backlog above 7 Days below 15 "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Report]="",
'Weld Dump'[No of Days "WD"]>7,'Weld Dump'[No of Days "WD"]<=15)
```

### `[PWHT Backlog above 15 Days below 30 "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Report]="",
'Weld Dump'[No of Days "WD"]>15,'Weld Dump'[No of Days "WD"]<=30)
```

### `[PWHT Backlog above 30 Days "WD"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-2","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Report]="",
'Weld Dump'[No of Days "WD"]>30)
```

### `[Last 2 weeks Welded Joint ID Uniq]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Repair & Reweld]="",
'Weld Dump'[Weld Date]>0,
'Weld Dump'[Days Since Last Weld]<=15)
```

### `[Last 2 weeks Numb RT]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Report]<>"",
'Weld Dump'[RT Acc/Rej]<>"RS",
'Calendar'[Date] > TODAY() - 14 && 'Calendar'[Date] <= TODAY())
```

### `[Last 2 weeks RT Total Films "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[Total No of films Acc]),
'Weld Dump'[RT Acc/Rej]<>"RS",
'Weld Dump'[Days Since Last RT "EP"]<=15)
```

### `[Last 2 weeks RT Total Films "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[Total No of films Rej]),
'Weld Dump'[Days Since Last RT "EP"]<=15)
```

### `[Last 2 weeks RT Total Films]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[RT Film Total]),
'Weld Dump'[RT Acc/Rej]<>"RS",
'Weld Dump'[Days Since Last RT "EP"]<=15)
```

### `[Last 2 weeks RT FILM Ratio %]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Last 2 weeks RT Total Films "R"]/[Last 2 weeks RT Total Films]
```

### `[RT 5 10 20 100% B.log Joints+NO PWHT Progress Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[PWHT Y/N]IN{"N","25.01"},
'Weld Dump'[PWHT Weld Status]="",
'Weld Dump'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]="")+
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[PWHT Y/N]IN{"N","25.01"},
'Weld Dump'[PWHT Weld Status]="",
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
'Weld Dump'[RT Report]="",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", "","S"}
    )
)
```

### `[CUM Total No of films Rej]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	SUM('Weld Dump'[Total No of films Rej]),
	FILTER(
		ALLSELECTED('Weld Dump'[Weld Date]),
		ISONORAFTER('Weld Dump'[Weld Date], MAX('Weld Dump'[Weld Date]), DESC)
	)
)
```

### `[Tracer Shot]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[RT Weld Status]IN{"T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})
```

### `[Status Fabricated]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Status FABRICATED]<>"")
```

### `[No of Welders Active 7 Days]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE('Weld Dump','Weld Dump'[Welder],
         "Days Since Last Weld",[No Days Since Last Weld]),
        [Days Since Last Weld]<=7))
```

### `[No of Welders NOT Active 7 to 21 Days]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE('Weld Dump','Weld Dump'[Welder],
        "Days Since Last Weld", [No Days Since Last Weld]),
        [Days Since Last Weld]>7 &&
        [Days Since Last Weld]<=21)) 
```

### `[No of Welders NOT Active 21 to 90 Days]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE('Weld Dump','Weld Dump'[Welder],
        "Days Since Last Weld", [No Days Since Last Weld]),
        [Days Since Last Weld]>21 &&
        [Days Since Last Weld]<=90))
```

### `[Last_Weld Date]`

- home table: `Calendar`
- format string: `d mmmm\, yyyy`

```dax
LASTDATE('Weld Dump'[Weld Date])
```

### `[No Days Since Last Weld]`

- home table: `Calendar`
- format string: `0`

```dax
IF(ISBLANK([Last_Weld Date]),BLANK(),
VALUE([Cur_Date]-[Last_Weld Date]))
```

### `[Cur_Date]`

- home table: `Calendar`
- format string: `dd-mmm-yy`

```dax
MAXX(ALL('Weld Dump'),'Weld Dump'[Weld Date])
```

### `[No of Welders NOT Active 90 to 180 Days]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE('Weld Dump','Weld Dump'[Welder],
        "Days Since Last Weld", [No Days Since Last Weld]),
        [Days Since Last Weld]>90 &&
        [Days Since Last Weld]<180))
```

### `[No of Welders NOT Active 180 Days]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE('Weld Dump','Weld Dump'[Welder],
        "Days Since Last Weld", [No Days Since Last Weld]),
        [Days Since Last Weld]>180))
```

### `[First_Weld Date]`

- home table: `Calendar`
- format string: `d mmmm\, yyyy`

```dax
FIRSTDATE('Weld Dump'[Weld Date])
```

### `[Tested Joints]`

- home table: `Calendar`
- format string: `0`

```dax
[Numb RT/UT "A"]+[Numb RT/UT "R"]
```

### `[No. of Welders]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Welder]))
```

### `[RT FILM Ratio % STATUS]`

- home table: `Calendar`
- format string: `nan`

```dax
IF (
    [RT Total Films "R"] / [RT Total Films] >= 0 && [RT Total Films "R"] / [RT Total Films] < 0.05,
    "0 to 5% - ok",
    IF([RT Total Films "R"] / [RT Total Films] >= 0.05 && [RT Total Films "R"] / [RT Total Films] < 0.075,
    "5 to 7.5%-monitor",
    IF([RT Total Films "R"] / [RT Total Films] >= 0.075 && [RT Total Films "R"] / [RT Total Films] < 0.10,
    "7.5 to 10%-Critical",
    IF([RT Total Films "R"] / [RT Total Films] >= 0.10 && [RT Total Films "R"] / [RT Total Films] <= 1,
    "10 to 100% - Disq.F",
    BLANK()
))))
```

### `[RT 5 10 20 100% B.log Joints Weld Status "EP" & FABRICATED]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
    'Weld Dump'[Status FABRICATED] = "Fabricated",
    'Weld Dump'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Weld Dump'[Weld Date] > 0,
    'Weld Dump'[RT Report] = "",
    'Weld Dump'[RT Weld Status] IN 
        {"H", "HS", "SS", "T", "T1", "T1S", "T1-1", "T1-1S", "T1-2S", "T1S", "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S"}
) +
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
    'Weld Dump'[Status FABRICATED] = "Fabricated",
    'Weld Dump'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Weld Dump'[Weld Date] > 0,
    'Weld Dump'[RT%] = 100,
'Weld Dump'[RT Report]="",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", "","S"}
    )
)
```

### `[Cur_Date "PR"]`

- home table: `Calendar`
- format string: `General Date`

```dax
MAXX(ALL('Project WD+WR'),'Project WD+WR'[Weld Date])
```

### `[Total Welded Dia WP1 "PR"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR'[Total Welded Dia "PR" Table]),
'Project WD+WR'[Repair & Reweld "PR"]="",
'Project WD+WR'[WeldPoint No.]=1)
```

### `[Joint Uniq "PR" Total]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[Repair & Reweld "PR"]="")
```

### `[Joint Uniq "PR" Welded]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[Repair & Reweld "PR"]="",
'Project WD+WR'[Weld Date]>0)
```

### `[CUM Total Welded Dia WP1 "PR"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(
	[Total Welded Dia WP1 "PR"],
	FILTER(
		ALLSELECTED('Project WD+WR'[Weld Date]),
		ISONORAFTER('Project WD+WR'[Weld Date], MAX('Project WD+WR'[Weld Date]), DESC)
	)
)
```

### `[Numb RT/UT "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[Weld Date]>0,
'Project WD+WR'[RT Report]<>"",
'Project WD+WR'[RT Acc/Rej]<>"RS")
```

### `[Numb RT/UT "PR" "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[Weld Date]>0,
'Project WD+WR'[RT Report]<>"",
'Project WD+WR'[RT Acc/Rej]<>"RS")-
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[RT Acc/Rej]="R")
```

### `[Numb RT/UT "PR" "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[RT Acc/Rej]="R")
```

### `[RT Total Films "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Project WD+WR'[RT Film Total]),
'Project WD+WR'[RT Acc/Rej]<>"RS")
```

### `[RT Total Films "PR" "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Project WD+WR'[Total No of films Acc]),
'Project WD+WR'[RT Acc/Rej]<>"RS")
```

### `[RT Total Films "PR" "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Project WD+WR'[Total No of films Rej]))
```

### `[RT FILM Ratio % "PR"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[RT Total Films "PR" "R"]/[RT Total Films "PR"]
```

### `[Rejection Rate Joint "PR"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "PR" "R"]/[Numb RT/UT "PR"]
```

### `[% of Target "PR"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.01
```

### `[% Unacceptable Limit "PR"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.03
```

### `[PWHT Backlog "CCC" "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[PWHT Y/N CCC]="Y",
'Project WD+WR'[Weld Type]IN{"BW","GW"},
'Project WD+WR'[PWHT Report No CCC]="")
```

### `[PWHT All BACKLOG "BW" "GW" "CLET" "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
[PWHT Backlog "CCC" "PR"]+
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR'[PWHT Report]="")
```

### `[RT100% Backlog CCC "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[Sub-Contractor]="CCC",
'Project WD+WR'[RT%]=100,
'Project WD+WR'[RT Report]="")
```

### `[RT 5 10 20 100% B.Log GAC TKF MED Joints Weld Status "EP" "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR'[Weld Date]>0,
'Project WD+WR'[RT Report]="",
'Project WD+WR'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})
```

### `[RT BACKLOG Total Project "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR'[Weld Date]>0,
'Project WD+WR'[RT Report]="",
'Project WD+WR'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})
```

### `[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP" "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[PWHT Y/N]IN{"Y","25.01"},
'Project WD+WR'[PWHT Report]<>"",
'Project WD+WR'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR'[RT Report]="")
```

### `[RT100% Backlog & PWHT Progress CCC  "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[PWHT Y/N CCC]="Y",
'Project WD+WR'[PWHT Report No CCC]<>"",
'Project WD+WR'[RT Report]="",
'Project WD+WR'[RT%]=100)
```

### `[RT Backlog+PWHT Progress "Y" "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP" "PR"]+[RT100% Backlog & PWHT Progress CCC  "PR"]
```

### `[RT 5 10 20 100% B.log Joints+NO PWHT Progress Weld Status "EP" "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR'[PWHT Y/N]="N",
'Project WD+WR'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR'[RT Report]="")
```

### `[RT100% Backlog & NO PWHT Req "CCC" "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[PWHT Y/N CCC]="N",
'Project WD+WR'[RT Report]="",
'Project WD+WR'[RT%]=100)
```

### `[RT Backlog+PWHT "N" "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
[RT100% Backlog & NO PWHT Req "CCC" "PR"]+[RT 5 10 20 100% B.log Joints+NO PWHT Progress Weld Status "EP" "PR"]
```

### `[RT100% Backlog "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[RT%]=100,
'Project WD+WR'[Weld Date]>0,
'Project WD+WR'[RT Weld Status]<>"NR",
'Project WD+WR'[RT Report]="")
```

### `[RT Ratio % RT/ Welded Joint ID uniq "PR"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "PR"]/[Joint Uniq "PR" Welded]
```

### `[Joint Uniq "PR all" Welded]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Weld Date]>0)
```

### `[Numb RT/UT "PR all" "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]<>"",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review")-
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]="R")
```

### `[Numb RT/UT "PR all" "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]="R")
```

### `[RT Total Films "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[RT Film Total]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris]<>"Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review")
```

### `[RT FILM Rej Ratio % "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[RT Total Films by Joint "PR all" "R"]/[RT Total Films by Joint "PR all"]
```

### `[RT Total Films "PR all" "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Total No of films Acc]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris]<>"Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review")
```

### `[RT Total Films "PR all" "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
)
```

### `[PWHT All BACKLOG "BW" "GW" "CLET" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="")
```

### `[RT BACKLOG Total Project "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    OR(
        'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {
            "H", "HS", "HS CCC", "SS", "T", "T1","T1-2", "T1S", "T1-1", "T1-1S", 
            "T1-2S", "T1S", "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S"
        },
        AND(
            'Project WD+WR+INCO+Acciona'[RT%] = 100,
            'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?","","S"}
        )
    )
)
```

### `[CUM RT BACKLOG Total Project "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[RT BACKLOG Total Project "PR all"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[CUM PWHT All BACKLOG "BW" "GW" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[PWHT All BACKLOG "BW" "GW" "CLET" "PR all"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[CUM RT FILM Ratio % "PR"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[RT FILM Ratio % "PR"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[CUM RT FILM Ratio % "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[RT FILM Rej Ratio % "PR all"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[Numb RT/UT "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
COALESCE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
    ),
    0
)
```

### `[RT100% Backlog "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date])), -- Weld Date не пуст
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Date]), -- RT Date пуст
    'Project WD+WR+INCO+Acciona'[RT%] = 100, -- RT% = 100
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S",
    "?","","S"},
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "CLET", "MW", "GW"}
)
```

### `[Cur_Date "PR all"]`

- home table: `Calendar`
- format string: `General Date`

```dax
MAXX(ALL('Project WD+WR+INCO+Acciona'),
'Project WD+WR+INCO+Acciona'[Weld Date])
```

### `[PWHT Backlog "CCC"  "BW","GW","CLET" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="")
```

### `[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Y/N]IN{"Y","25.01"},
'Project WD+WR+INCO+Acciona'[PWHT Report]<>"",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[RT Report]="")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Y/N]IN{"Y","25.01"},
'Project WD+WR+INCO+Acciona'[PWHT Report]<>"",
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[RT Report]="",
    FILTER(
        'Project WD+WR+INCO+Acciona',
        'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", ""}
    )
)
```

### `[RT Backlog+PWHT Progress "Y" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Y/N]IN{"Y","25.01"},
'Project WD+WR+INCO+Acciona'[PWHT Report]<>"",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[RT Report]="")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Y/N]IN{"Y","25.01"},
'Project WD+WR+INCO+Acciona'[PWHT Report]<>"",
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[RT Report] = "",
'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?","","S"}
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC] = "Y",
    'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] <> "",
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT%] = 100
)
```

### `[RT100% Backlog & PWHT Progress CCC  "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]<>"",
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT%]=100)
```

### `[RT100% Backlog & NO PWHT Req "CCC" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="N",
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT%]=100)
```

### `[RT 5 10 20 100% B.log Joints+NO PWHT Progress Weld Status "EP" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Y/N]="N",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[RT Report]="")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Y/N]="N",
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[RT Report]="",
    FILTER(
        'Project WD+WR+INCO+Acciona',
        'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", "","S"}
    )
)
```

### `[RT Backlog+PWHT "N" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Y/N]IN{"N","25.01"},
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[RT Report]="")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Y/N]IN{"N","25.01"},
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]="",
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[RT Report] = "",
'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?","","S"}
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC] = "N",
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT%] = 100
)
```

### `[CUM RT 5 10 20 100% B.log Joints Weld Status "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[RT 5 10 20 100% B.log Joints Weld Status "EP"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[CUM PWHT Backlog Weld Status All WELD Types "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[PWHT Backlog Weld Status All Weld Types "EP"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[PWHT Backlog RT100% "CCC" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="")
```

### `[PWHT BACKLOG RT100% "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
[PWHT Backlog RT100% "CCC" "PR all"]+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="")
```

### `[MT Progress All % Weld Status "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
[MT Progress  CCC  "PR all"]+[MT Progress All % Weld Status "PR_All"]
```

### `[MT Progress  CCC  "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[Sub-Contractor]="CCC",
'Project WD+WR+INCO+Acciona'[MT Report CCC]<>"")
```

### `[INCO Length Ratio %]`

- home table: `Calendar`
- format string: `nan`

```dax
DIVIDE(
    SUM('Project WD+WR+INCO+Acciona'[Repair Length (mm)]),
    SUM('Project WD+WR+INCO+Acciona'[Rej Length])
)*1
```

### `[CUM INCO Length Ratio %]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[INCO Length Ratio %],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[% Unacceptable Limit "INCO"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.02
```

### `[RT BACKLOG INCO]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
'Project WD+WR+INCO+Acciona'[Weld Type]="BW",
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]="")
```

### `[RT Ratio % RT/ Welded Joint ID uniq "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "PR all"]/[Joint Uniq "PR all" Welded]
```

### `[Rejection Rate Joint "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "PR all" "R"]/[Numb RT/UT "PR all"]
```

### `[RT Backlog within 3 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=3)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT%] = 100,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", "","S"},
    'Project WD+WR+INCO+Acciona'[No of Days "PR all"] <= 3
)
```

### `[RT Backlog within 3 Days below 7 "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>3,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=7)+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", "","S"},
'Project WD+WR+INCO+Acciona'[No of Days "PR all"] > 3,
'Project WD+WR+INCO+Acciona'[No of Days "PR all"] <= 7
)
```

### `[RT Backlog within 7 Days below 15 "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>7,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=15)+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", "","S"},
'Project WD+WR+INCO+Acciona'[No of Days "PR all"] > 7,
'Project WD+WR+INCO+Acciona'[No of Days "PR all"] <= 15
)
```

### `[RT Backlog within 15 Days below 30 "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>15,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=30)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT%] = 100,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", "","S"},
    'Project WD+WR+INCO+Acciona'[No of Days "PR all"] > 15,
    'Project WD+WR+INCO+Acciona'[No of Days "PR all"] <= 30
)
```

### `[RT Backlog within above 30 Days"PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>30)+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT%]=100,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", "","S"},
'Project WD+WR+INCO+Acciona'[No of Days "PR all"] >30
)
```

### `[PWHT Done "BW" "GW" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[PWHT Report "PR All"]<>"")
```

### `[PWHT Backlog within 3 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=3)+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=3)
```

### `[PWHT Backlog within 3 Days below 7 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>3,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=7)+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>3,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=7)
```

### `[PWHT Backlog within 7 Days below 15 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>7,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=15)+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>7,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=15)
```

### `[PWHT Backlog within 15 Days below 30 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>15,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=30)+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>15,'Project WD+WR+INCO+Acciona'[No of Days "PR all"]<=30)
```

### `[PWHT Backlog within Above 30 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>30)+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="",
'Project WD+WR+INCO+Acciona'[No of Days "PR all"]>30)
```

### `[Last 2 weeks Welded Joint ID Uniq "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[Days Since Last Weld]>=0,
'Project WD+WR+INCO+Acciona'[Days Since Last Weld]<=15)
```

### `[Last 2 weeks RT Total Films "A" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Total No of films Acc]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review",
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris]<>"Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 15)
```

### `[Last 2 weeks RT Total Films "R" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris]<>"Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 15)
```

### `[Last 2 weeks RT Total Films "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[RT Film Total]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review",
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris]<>"Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 15)
```

### `[Last 2 weeks RT FILM Ratio % "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Last 2 weeks RT Total Films "R" "PR all"]/[Last 2 weeks RT Total Films "PR all"]
```

### `[Last_Weld Date "PR all"]`

- home table: `Calendar`
- format string: `d mmmm\, yyyy`

```dax
LASTDATE('Project WD+WR+INCO+Acciona'[Weld Date])
```

### `[No Days Since Last Weld "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
IF(ISBLANK([Last_Weld Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[Last_Weld Date "PR all"]))
```

### `[No of Welders Active 7 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),
    'Project WD+WR+INCO+Acciona'[Days Since Last Weld] <= 7,
    'Project WD+WR+INCO+Acciona'[Weld Date]>0)
```

### `[No of Welders NOT Active 7 to 21 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE(
            'Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[Welder ID],
            "Days Since Last Weld", [No Days Since Last Weld "PR all"]
        ),
        [No Days Since Last Weld "PR all"] > 7 &&
        [No Days Since Last Weld "PR all"] <= 21
    )
)
```

### `[No of Welders NOT Active 21 to 90 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Welder ID],
        "Days Since Last Weld", [No Days Since Last Weld "PR all"]),
        [No Days Since Last Weld "PR all"]>21 &&
        [No Days Since Last Weld "PR all"]<=90))
```

### `[No of Welders NOT Active 90 to 180 Days "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Welder ID],
        "Days Since Last Weld", [No Days Since Last Weld "PR all"]),
        [No Days Since Last Weld "PR all"]>90 &&
        [No Days Since Last Weld "PR all"]<=180))
```

### `[No of Welders NOT Active 180 Days  "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
COUNTROWS(
    FILTER(
        SUMMARIZE('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Welder ID],
        "Days Since Last Weld", [No Days Since Last Weld "PR all"]),
        [No Days Since Last Weld "PR all"]>180))
```

### `[No. of Welders 'PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]))
```

### `[First_Weld Date "PR all"]`

- home table: `Calendar`
- format string: `d mmmm\, yyyy`

```dax
FIRSTDATE('Project WD+WR+INCO+Acciona'[Weld Date])
```

### `[Tested Joints "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
[Numb RT/UT "PR all" "A"]+[Numb RT/UT "PR all" "R"]
```

### `[Joint Uniq "PR all" Total]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="")
```

### `[WELDER ID]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT(WELDERS_Qualification[WELDER ID+NAME]))
```

### `[Total Welded Dia WP1 "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Total Welded Dia "PR all" Table]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","CLET","GW","MW"},
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1)
```

### `[CUM Total Welded Dia WP1 "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(
	[Total Welded Dia WP1 All Types "PR all" (New)],
	FILTER(
		ALLSELECTED('Project WD+WR+INCO+Acciona'[Weld Date]),
		ISONORAFTER('Project WD+WR+INCO+Acciona'[Weld Date], MAX('Project WD+WR+INCO+Acciona'[Weld Date]), DESC)
	)
)
```

### `[Total Scope Dia CCC]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('AllTrain_CSVExport_Joint Record'[Dia-Inch]),
'AllTrain_CSVExport_Joint Record'[Weld Type]IN{"BW","CLET","GW"},
'AllTrain_CSVExport_Joint Record'[Weld Point First]="#",
'AllTrain_CSVExport_Joint Record'[Original Joint]="#")
```

### `[Total Scope Joints CCC]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('AllTrain_CSVExport_Joint Record'[Joint ID "JR"]),
'AllTrain_CSVExport_Joint Record'[Weld Type]IN{"BW","CLET","GW"},
'AllTrain_CSVExport_Joint Record'[Weld Point First]="#",
'AllTrain_CSVExport_Joint Record'[Original Joint]="#")
```

### `[Total Scope Joints Uniq "BW" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","CLET","GW","MW"},
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Sub-Contractor]IN{"GAC","TEKFEN","MEDGULF","Acciona","Inco"})+[Total Scope Joints CCC]
```

### `[Total Scope Dia "BW" "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
'Project WD+WR+INCO+Acciona'[WeldPoint No.]=1,
'Project WD+WR+INCO+Acciona'[Dia Inch Factor]="Y",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","CLET","GW","MW"},
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Sub-Contractor]IN{"GAC","TEKFEN","MEDGULF","Acciona","Inco"})+[Total Scope Dia CCC]
```

### `[CUM Total No of films Rej "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
	FILTER(
		ALLSELECTED('Project WD+WR+INCO+Acciona'[Weld Date]),
		ISONORAFTER('Project WD+WR+INCO+Acciona'[Weld Date], MAX('Project WD+WR+INCO+Acciona'[Weld Date]), DESC)
	)
)
```

### `[CUM No. of Welders 'PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[No. of Welders 'PR all"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[Total Qualified Welders "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(SUM('SCTR OVERALL APPLIED WELDERS'[QUALIFIED  WELDERS]))
```

### `[No Weld Done Project "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
[Total Qualified Welders "PR all"]-[No. of Welders 'PR all"]
```

### `[Qualified Welders CCC]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(SUM('SCTR OVERALL APPLIED WELDERS'[QUALIFIED  WELDERS]),
'SCTR OVERALL APPLIED WELDERS'[Sub-Contractor]="CCC")
```

### `[No Weld Done CCC]`

- home table: `Calendar`
- format string: `0`

```dax
[Qualified Welders CCC]-CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),
'Project WD+WR+INCO+Acciona'[Sub-Contractor]="CCC")
```

### `[Qualified Welders GAC]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(SUM('SCTR OVERALL APPLIED WELDERS'[QUALIFIED  WELDERS]),
'SCTR OVERALL APPLIED WELDERS'[Sub-Contractor]="GAC")
```

### `[No Weld Done GAC]`

- home table: `Calendar`
- format string: `0`

```dax
[Qualified Welders GAC]-CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),'Project WD+WR+INCO+Acciona'[Sub-Contractor]="GAC")
```

### `[Qualified Welders TEKFEN]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(SUM('SCTR OVERALL APPLIED WELDERS'[QUALIFIED  WELDERS]),
'SCTR OVERALL APPLIED WELDERS'[Sub-Contractor]="TEKFEN")
```

### `[No Weld Done TEKFEN]`

- home table: `Calendar`
- format string: `0`

```dax
[Qualified Welders TEKFEN]-CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),
'Project WD+WR+INCO+Acciona'[Sub-Contractor]="TEKFEN")
```

### `[Qualified Welders MEDGULF]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(SUM('SCTR OVERALL APPLIED WELDERS'[QUALIFIED  WELDERS]),
'SCTR OVERALL APPLIED WELDERS'[Sub-Contractor]="MEDGULF")
```

### `[No Weld Done MEDGULF]`

- home table: `Calendar`
- format string: `0`

```dax
[Qualified Welders MEDGULF]-CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),
'Project WD+WR+INCO+Acciona'[Sub-Contractor]="MEDGULF")
```

### `[Qualified Welders Inco]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(SUM('SCTR OVERALL APPLIED WELDERS'[QUALIFIED  WELDERS]),
'SCTR OVERALL APPLIED WELDERS'[Sub-Contractor]="Inco")
```

### `[No Weld Done Inco]`

- home table: `Calendar`
- format string: `0`

```dax
[Qualified Welders Inco]-CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco")
```

### `[CUM RT BACKLOG Inco]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	SUM('Inco of NDE Summary'[RT BACKLOG]),
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[PWHT BACKLOG RT100% "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[PWHT Y/N CCC]="Y",
'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR'[RT%]=100,
'Project WD+WR'[PWHT Report No CCC]="")+
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),
'Project WD+WR'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR'[RT%]=100,
'Project WD+WR'[PWHT Report]="")
```

### `[Tracer Shot "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),                                 
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})
```

### `[Tracer Shot "PR"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]),                                 
'Project WD+WR'[RT Weld Status]IN{"T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})
```

### `[PWHT BACKLOG RT100% "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT%]=100,
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[PWHT Report]="")
```

### `[PWHT All BACKLOG All WELD TYPE "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="")
```

### `[CUM PWHT All BACKLOG All WELD TYPE "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[PWHT All BACKLOG All WELD TYPE "PR all"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[PWHT Backlog Weld Status "BW" "GW" "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Report]="")
```

### `[CUM PWHT Backlog Weld Status "BW" "GW" "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[PWHT Backlog Weld Status "BW" "GW" "EP"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[PWHT Done All Weld Types "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Report "PR All"]<>"")
```

### `[PWHT Done All Weld Types "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[PWHT Report]<>"")
```

### `[PWHT Done "BW" "GW" "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[PWHT Report]<>"")
```

### `[RT10% Backlog Joints "PRall" (One Formula)]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR NumberRT_PRall = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]), 
        'Project WD+WR+INCO+Acciona'[RT%] = 10,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",        
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        ALLEXCEPT(
            'Project WD+WR+INCO+Acciona', 
            'Project WD+WR+INCO+Acciona'[HA], 
            'Project WD+WR+INCO+Acciona'[Service Class], 
            'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
        ) 
    )

VAR Joint_Uniq_PRall = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT%] = 10,
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        
        ALLEXCEPT(
            'Project WD+WR+INCO+Acciona', 
            'Project WD+WR+INCO+Acciona'[HA], 
            'Project WD+WR+INCO+Acciona'[Service Class], 
            'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
        ) 
    )

VAR RT_Ratio_PRall = DIVIDE(NumberRT_PRall, Joint_Uniq_PRall, 0)
VAR RT10_Backlog_PRall = 0.10 - RT_Ratio_PRall
VAR RT10_Backlog_Joints_PRall = 
    IF(
        RT10_Backlog_PRall > 0,  -- Если процент меньше 10%, считаем, сколько стыков нужно
        ROUNDUP(RT10_Backlog_PRall * Joint_Uniq_PRall, 0),  -- Округляем вверх до целого числа
        0  -- Если процент уже >= 10%, то 0 стыков нужно
    )

RETURN
RT10_Backlog_Joints_PRall
```

### `[RT5% Backlog Joints "PRall" (One Formula)]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR NumberRT_PRall = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]), 
        'Project WD+WR+INCO+Acciona'[RT%] = 5,
        'Project WD+WR+INCO+Acciona'[RT Report]<>"",        
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <>"RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <>"U/Review",
        ALLEXCEPT(
            'Project WD+WR+INCO+Acciona', 
            'Project WD+WR+INCO+Acciona'[HA], 
            'Project WD+WR+INCO+Acciona'[Service Class], 
            'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
        ) 
    )

VAR Joint_Uniq_PRall = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT%] = 5,
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
        
        ALLEXCEPT(
            'Project WD+WR+INCO+Acciona', 
            'Project WD+WR+INCO+Acciona'[HA], 
            'Project WD+WR+INCO+Acciona'[Service Class], 
            'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
        ) 
    )

VAR RT_Ratio_PRall = DIVIDE(NumberRT_PRall, Joint_Uniq_PRall, 0)
VAR RT5_Backlog_PRall = 0.05 - RT_Ratio_PRall
VAR RT5_Backlog_Joints_PRall = 
    IF(
        RT5_Backlog_PRall > 0,  -- Если процент меньше 5%, считаем, сколько стыков нужно
        ROUNDUP(RT5_Backlog_PRall * Joint_Uniq_PRall, 0),  -- Округляем вверх до целого числа
        0  -- Если процент уже >= 5%, то 0 стыков нужно
    )

RETURN
RT5_Backlog_Joints_PRall
```

### `[RT20% Backlog Joints "PRall" (One Formula)]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR NumberRT_PRall = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]), 
        'Project WD+WR+INCO+Acciona'[RT%] = 20,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",        
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        ALLEXCEPT(
            'Project WD+WR+INCO+Acciona', 
            'Project WD+WR+INCO+Acciona'[HA], 
            'Project WD+WR+INCO+Acciona'[Service Class], 
            'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
        ) 
    )

VAR Joint_Uniq_PRall = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT%] = 20,
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        
        ALLEXCEPT(
            'Project WD+WR+INCO+Acciona', 
            'Project WD+WR+INCO+Acciona'[HA], 
            'Project WD+WR+INCO+Acciona'[Service Class], 
            'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
        ) 
    )

VAR RT_Ratio_PRall = DIVIDE(NumberRT_PRall, Joint_Uniq_PRall, 0)
VAR RT20_Backlog_PRall = 0.20 - RT_Ratio_PRall
VAR RT20_Backlog_Joints_PRall = 
    IF(
        RT20_Backlog_PRall > 0,  -- Если процент меньше 20%, считаем, сколько стыков нужно
        ROUNDUP(RT20_Backlog_PRall * Joint_Uniq_PRall, 0),  -- Округляем вверх до целого числа
        0  -- Если процент уже >= 20%, то 0 стыков нужно
    )

RETURN
RT20_Backlog_Joints_PRall
```

### `[RT100% Backlog Joints "PRall" (One Formula)]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR NumberRT_PRall = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]), 
        'Project WD+WR+INCO+Acciona'[RT%] = 100,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",        
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        ALLEXCEPT(
            'Project WD+WR+INCO+Acciona', 
            'Project WD+WR+INCO+Acciona'[HA], 
            'Project WD+WR+INCO+Acciona'[Service Class], 
            'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
        ) 
    )

VAR Joint_Uniq_PRall = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT%] = 100,
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        
        ALLEXCEPT(
            'Project WD+WR+INCO+Acciona', 
            'Project WD+WR+INCO+Acciona'[HA], 
            'Project WD+WR+INCO+Acciona'[Service Class], 
            'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
        ) 
    )

VAR RT_Ratio_PRall = DIVIDE(NumberRT_PRall, Joint_Uniq_PRall, 0)
VAR RT100_Backlog_PRall = 1.00 - RT_Ratio_PRall
VAR RT100_Backlog_Joints_PRall = 
    IF(
        RT100_Backlog_PRall > 0,  -- Если процент меньше 100%, считаем, сколько стыков нужно
        ROUNDUP(RT100_Backlog_PRall * Joint_Uniq_PRall, 0),  -- Округляем вверх до целого числа
        0  -- Если процент уже >= 100%, то 0 стыков нужно
    )

RETURN
RT100_Backlog_Joints_PRall
```

### `[RT FILM Ratio % STATUS LAST 2 WEEKS]`

- home table: `Calendar`
- format string: `nan`

```dax
IF (
    [Last 2 weeks RT Total Films "R" "PR all"] / [Last 2 weeks RT Total Films "PR all"] >= 0 && [Last 2 weeks RT Total Films "R" "PR all"] / [Last 2 weeks RT Total Films "PR all"] < 0.05,
    "0 to 5% - ok",
    IF([Last 2 weeks RT Total Films "R" "PR all"] / [Last 2 weeks RT Total Films "PR all"] >= 0.05 && [Last 2 weeks RT Total Films "R" "PR all"] / [Last 2 weeks RT Total Films "PR all"] < 0.075,
    "5 to 7.5%-monitor",
    IF([Last 2 weeks RT Total Films "R" "PR all"] / [Last 2 weeks RT Total Films "PR all"] >= 0.075 && [Last 2 weeks RT Total Films "R" "PR all"] / [Last 2 weeks RT Total Films "PR all"] < 0.10,
    "7.5 to 10%-Critical",
    IF([Last 2 weeks RT Total Films "R" "PR all"] / [Last 2 weeks RT Total Films "PR all"] >= 0.10 && [Last 2 weeks RT Total Films "R" "PR all"] / [Last 2 weeks RT Total Films "PR all"] <= 1,
    "10 to 100% - Disq.F",
    BLANK()
))))
```

### `[Numb RT Last 2 Weeks "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"])),
NOT('Project WD+WR+INCO+Acciona'[RT Acc/Rej] IN {"RS", "U/Review"}),
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <=15)
```

### `[Numb RT Last 2 weeks "PR all" "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"])),
NOT('Project WD+WR+INCO+Acciona'[RT Acc/Rej] IN {"RS", "U/Review"}),
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 15)-
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"])),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]="R",
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 15)
```

### `[Numb RT Last 2 Weeks "PR all" "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]="R",
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"])),
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 15)
```

### `[Numb UT "PR All"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"")
```

### `[Numb UT "A" "PR All"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"")-
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[Manual UT Status.]="R")
```

### `[Numb UT "R" "PR All"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[Manual UT Status.]="R")
```

### `[Numb UT "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[UT Weld Status]IN{"NR"},
'Weld Dump'[UT Report]<>"")
```

### `[Numb UT "A" "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[UT Weld Status]IN{"NR"},
'Weld Dump'[UT Report]<>"",
'Weld Dump'[UT Acc/Rej]="A")
```

### `[Numb UT "R" "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[UT Weld Status]IN{"NR"},
'Weld Dump'[UT Report]<>"",
'Weld Dump'[UT Acc/Rej]="R")
```

### `[Cur_Date RT DATE "PR all"]`

- home table: `Calendar`
- format string: `General Date`

```dax
MAXX(ALL('Project WD+WR+INCO+Acciona'),
'Project WD+WR+INCO+Acciona'[RT Date])
```

### `[MT Progress All % Weld Status "PR_All"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[MT Weld Status]IN{"NR"},
'Project WD+WR+INCO+Acciona'[MT Report]<>"")
```

### `[UT Ratio % UT/ Welded Joint ID uniq "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb UT "PR All"]/[Joint Uniq "PR all" Welded]
```

### `[Rejection UT Rate Joint "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb UT "R" "PR All"]/[Numb UT "PR all"]
```

### `[Rejection UT Rate Joint "EP"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb UT "R" "EP"]/[Numb UT "EP"]
```

### `[UT Weld Length by Welder "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Weld Length "PR all"]),
'Project WD+WR+INCO+Acciona'[UT Report]<>"")+
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Weld Length "PR all"]),
'Project WD+WR+INCO+Acciona'[RT/UT]="UT")
```

### `[UT Weld Length by welder "EP"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Weld Dump'[Weld Length]),
'Weld Dump'[UT Report]<>"")
```

### `[TP Complete "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Joint Uniq "PR all" Welded]/[Joint Uniq "PR all" Total]
```

### `[Joint Uniq R/RW not welded "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] IN {"Repair", "Reweld"},
    'Project WD+WR+INCO+Acciona'[Weld Date] = BLANK()
)
```

### `[RT Total Films by Joint "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    'Project WD+WR+INCO+Acciona'[Exlude RT Films from UT] <> "Exclude UT Films",
    'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
)
+
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
-
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
```

### `[RT Total Films by Joint "PR all" "A"]`

- home table: `Calendar`
- format string: `0`

```dax
[RT Total Films by Joint "PR all"] - [RT Total Films by Joint "PR all" "R"]
```

### `[RT Total Films by Joint "PR all" "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
'Project WD+WR+INCO+Acciona'[Exlude RT Films from UT] <> "Exclude UT Films",            
'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
)
```

### `[RT FILM Ratio % by Joint "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[RT Total Films by Joint "PR all" "R"]/[RT Total Films by Joint "PR all"]
```

### `[RT Total Films by Joint "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[RT Film Total]),
'Weld Dump'[WeldPoint No.]=1,
'Weld Dump'[RT Acc/Rej]<>"RS")
```

### `[RT Total Films by Joint "A" "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[Total No of films Acc]),
'Weld Dump'[WeldPoint No.]=1,
'Weld Dump'[RT Acc/Rej]<>"RS")
```

### `[RT Total Films by Joint "R" "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Weld Dump'[Total No of films Rej]),
'Weld Dump'[WeldPoint No.]=1)
```

### `[RT FILM Ratio % by Joint "EP"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[RT Total Films by Joint "R" "EP"]/[RT Total Films by Joint "EP"]
```

### `[CUM RT FILM Ratio % by joint "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[RT FILM Ratio % by Joint "PR all"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[CUM RT FILM Ratio % by Joint "WD"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[RT FILM Ratio % by Joint "EP"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[UT Weld Length by Joint "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Weld Length "PR all"]),
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
'Project WD+WR+INCO+Acciona'[UT Report]<>"")+
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Weld Length "PR all"]),
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
'Project WD+WR+INCO+Acciona'[RT/UT]="UT")
```

### `[UT Weld Length by Joint "EP"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Weld Dump'[Weld Length]),
'Weld Dump'[WeldPoint No.]=1,
'Weld Dump'[UT Report]<>"")
```

### `[Total Scope Joints Uniq "BW" "CLET" "GW" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","CLET","GW","MW"},
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="")
```

### `[Numb UT "PR All" Tracker]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"")
```

### `[Numb UT "A" "PR All" Tracker]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"")-
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[Manual UT Status.]="R")
```

### `[Numb UT "R" "PR All" Tracker]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[Manual UT Status.]="R")
```

### `[UT Inspected Length by Joint "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[WeldPoint No.]=1)
```

### `[UT Inspected Weld Length by Welder "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"")
```

### `[UT Defect Length by Welder "PR all"]`

- home table: `Calendar`
- format string: `0.000`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
'Project WD+WR+INCO+Acciona'[Manual UT Status.]="R",
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"")
```

### `[UT Defect Length by Joint "PR all"]`

- home table: `Calendar`
- format string: `0.000`

```dax
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Manual UT Status.] = "R"
    )
```

### `[Rejection UT Rate Joint "PR all" 2]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb UT "R" "PR All" Tracker]/[Numb UT "PR All" Tracker]
```

### `[UT Ratio % UT/ Welded Joint ID uniq "PR all" Tracker]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb UT "PR All" Tracker]/[Joint Uniq "PR all" Welded]
```

### `[CUM Rejection UT Rate Joint "PR all" Tracker]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[Rejection UT Rate Joint "PR all" 2],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[Total Scope Dia "BW" "PR all" 2]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
'Project WD+WR+INCO+Acciona'[WeldPoint No.]=1,
'Project WD+WR+INCO+Acciona'[Dia Inch Factor]="Y",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","CLET","GW","MW"},
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Sub-Contractor]IN{"GAC","TEKFEN","MEDGULF","Acciona","Inco"})+
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","CLET","GW","MW"},
'Project WD+WR+INCO+Acciona'[Weld Point First]="#",
'Project WD+WR+INCO+Acciona'[Original Joint]="#")
```

### `[RT BACKLOG Total Project & PWHT "Y" NOT Done "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
VAR BacklogCount =
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            'Project WD+WR+INCO+Acciona'[PWHT Y/N] IN {"Y", "25.01"},
            'Project WD+WR+INCO+Acciona'[PWHT Weld Status] IN {"H","HS","NR"},
            'Project WD+WR+INCO+Acciona'[PWHT Report] = "",
            'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"H", "HS", "HS CCC", "SS", "T", "T1","T1-2", "T1S", "T1-1", "T1-1S", "T1-2S", "T1S", "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S"},
            'Project WD+WR+INCO+Acciona'[RT Report] = ""
        ) +
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            'Project WD+WR+INCO+Acciona'[PWHT Y/N] IN {"Y", "25.01"},
            'Project WD+WR+INCO+Acciona'[PWHT Weld Status] IN {"H", "HS","NR"},
            'Project WD+WR+INCO+Acciona'[PWHT Report] = "",
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            'Project WD+WR+INCO+Acciona'[RT%] = 100,
            'Project WD+WR+INCO+Acciona'[RT Report] = "",
            'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?","","S"}
        ) +
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"H", "HS", "HS CCC", "SS", "T", "T1","T1-2", "T1S", "T1-1", "T1-1S", "T1-2S", "T1S", "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S"},
            'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC] = "Y",
            'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] = "",
            'Project WD+WR+INCO+Acciona'[RT Report] = ""
        )
    RETURN
        IF(
            SELECTEDVALUE('Project WD+WR+INCO+Acciona'[Sub-Contractor]) = "CCC",
            BacklogCount - 0,
            BacklogCount
        )
```

### `[CUM RT BACKLOG Total Project & PWHT NOT Done "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[RT BACKLOG Total Project & PWHT "Y" NOT Done "PR all"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[Total Scope Joints Uniq "All Type" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="")
```

### `[Total Flanges ID]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID])
)
```

### `[Total Flanges ID Jointed]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Joint Date]>0)
```

### `[Flanges Backlog "FH,FHS"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Joint Date]>0,
'Flange Progress'[Flange Joint Status]IN{"FH","FHS"})
```

### `[CUM Flange BACKLOG]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
	[Flanges Backlog "FH,FHS"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[Flanges ID Inspected]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Joint Date]>0,
'Flange Progress'[Control Inspection Date]>0)
```

### `[Flanges ID Inspected "Acc"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Joint Date]>0,
'Flange Progress'[Control Inspection Date]>0,
'Flange Progress'[Status - A/R]="A")
```

### `[Flanges ID Inspected "Rej"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Joint Date]>0,
'Flange Progress'[Control Inspection Date]>0,
'Flange Progress'[Status - A/R]="R")
```

### `[Total Flanges ID 100% Control]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Control %]=100)
```

### `[Flange Break Down Rate %]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Flanges ID BreakDown]/[Total Flanges ID Jointed]
```

### `[CUM Flange Rejection Rate Project]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[Flange Break Down Rate %],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[RT BACKLOG Total Project & PWHT NOT Done "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[PWHT Y/N]IN{"Y","25.01"},
'Weld Dump'[PWHT Weld Status]IN{"H","HS"},
'Weld Dump'[PWHT Report]="",
'Weld Dump'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[RT Report]="")+
CALCULATE(
    DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Type]IN{"BW","GW","CLET","MW"},
'Weld Dump'[PWHT Y/N]IN{"Y","25.01"},
'Weld Dump'[PWHT Weld Status]IN{"H","HS"},
'Weld Dump'[PWHT Report]="",
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT%]=100,
'Weld Dump'[RT Report] = "",
    FILTER(
        'Weld Dump',
        'Weld Dump'[RT Weld Status] IN {"?", "","S"}))
```

### `[% UT Unacceptable Limit "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.05
```

### `[% UT of Target "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.03
```

### `[PWHT Backlog Weld Status All Weld Types RT NOT Done "EP"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Weld Dump'[Joint ID]),
'Weld Dump'[Weld Date]>0,
'Weld Dump'[RT Report]="",
'Weld Dump'[RT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Weld Status]IN{"H","HS","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Weld Dump'[PWHT Report]="")
```

### `[PWHT Backlog Weld Status All Weld Types RT NOT Done "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="",
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[Service Cat]="SG")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="",
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[Service Cat]="SG")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="",
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[TMCP Pipe]="TMCP Pipe")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="",
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[TMCP Pipe]="TMCP Pipe")
```

### `[Rejection UT Rate Length by Sub-Con "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[UT Defect Length by Joint "PR all"]/[UT Inspected Length by Joint "PR all"]
```

### `[CUM Rejection UT Rate Length by Sub-Con "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(
	[Rejection UT Rate Length by Sub-Con "PR all"],
	FILTER(
		ALLSELECTED('Calendar'[Date]),
		ISONORAFTER('Calendar'[Date], MAX('Calendar'[Date]), DESC)
	)
)
```

### `[% UT of Target "PR all" 1%]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.01
```

### `[% UT Unacceptable Limit 1.5% "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
0.015
```

### `[UT Ratio % UT/ Welded Joint ID uniq "EP"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb UT "EP"]/[Welded Joint ID Uniq "EP"]
```

### `[Last 1 Month Welded Joint ID Uniq "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[Days Since Last Weld]>=0,
'Project WD+WR+INCO+Acciona'[Days Since Last Weld]<=30)
```

### `[Numb RT Last 1 Month "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"])),
NOT('Project WD+WR+INCO+Acciona'[RT Acc/Rej] IN {"RS", "U/Review"}),
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 30)
```

### `[Numb RT Last 1 Month "PR all" "A"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"])),
NOT('Project WD+WR+INCO+Acciona'[RT Acc/Rej] IN {"RS", "U/Review"}),
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 30)-
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]="R",
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"])),
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 30)
```

### `[Numb RT Last 1 Month "PR all" "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]="R",
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"])),
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 30)
```

### `[Last 1 Month RT Total Films "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[RT Film Total]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review",
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 30)
```

### `[Last 1 Month RT Total Films "A" "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Total No of films Acc]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review",
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 30)
```

### `[Last 1 Month RT Total Films "R" "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris]<>"Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[Days Since Last RT] >= 0,
'Project WD+WR+INCO+Acciona'[Days Since Last RT] <= 30)
```

### `[Last 1 Month RT FILM Ratio % "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Last 1 Month RT Total Films "R" "PR all"]/[Last 1 Month RT Total Films "PR all"]
```

### `[RT/UT Rejection Rate by Joint "PR All"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]="R")/
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]<>"",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS")
```

### `[RT BACKLOG To be Remove "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[RT%]=0)
```

### `[RT Backlog & FABRICATED "PR All"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    OR(
        'Project WD+WR+INCO+Acciona'[RT Weld Status] IN 
        {"H", "HS", "HS CCC", "SS", "T", "T1", "T1S", "T1-1", "T1-1S", "T1-2S", "T1S", "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S"},
        
        AND(
            'Project WD+WR+INCO+Acciona'[RT%] = 100,
            'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?","","S"}
        )
    )
)
```

### `[Last 2 weeks UT Total Length "R" "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
'Project WD+WR+INCO+Acciona'[Days Since Last UT]>=0,
'Project WD+WR+INCO+Acciona'[Days Since Last UT]<=15)
```

### `[Last 2 weeks UT Total Length "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[Days Since Last UT]>=0,
'Project WD+WR+INCO+Acciona'[Days Since Last UT]<=15)
```

### `[Last 2 weeks UT Rej Length Ratio % "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Last 2 weeks UT Total Length "R" "PR all"]/[Last 2 weeks UT Total Length "PR all"]
```

### `[Numb UT Last 2 Weeks "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[Days Since Last UT]>=0,
'Project WD+WR+INCO+Acciona'[Days Since Last UT]<=15)
```

### `[Numb UT "A"  last 2 weeks "PR All"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_UT Date "PR all"])),
'Project WD+WR+INCO+Acciona'[Days Since Last UT]>=0,
'Project WD+WR+INCO+Acciona'[Days Since Last UT]<=15)-
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[Manual UT Status.]="R",
NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Last_UT Date "PR all"])),
'Project WD+WR+INCO+Acciona'[Days Since Last UT]>=0,
'Project WD+WR+INCO+Acciona'[Days Since Last UT]<=15)
```

### `[Numb UT "R" Last 2 Weeks "PR All"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Manual UT Report No.]<>"",
'Project WD+WR+INCO+Acciona'[Manual UT Status.]="R",
'Project WD+WR+INCO+Acciona'[Days Since Last UT]>=0,
'Project WD+WR+INCO+Acciona'[Days Since Last UT]<=15)
```

### `[QTY TestPacks]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]))
```

### `[Total Reports Project Data]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[HT Report "PR All"]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[MT Report "PR All"]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[ORIF Report]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PADLT Report]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PMI Report "PR All"]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PT Report "PR All"]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PWHT Report "PR All"]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT Report]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Manual UT Report No.]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[DWIR No.]))
```

### `[Total Reports Cross Check PRJ Data & FRB]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB]) +
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB]))
```

### `[Total HT Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total MT Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total ORIF Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total PADLT Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total PMI Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total PT Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total PWHT Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total RT Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total UT Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total VI Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB] <> ""
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total HT Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[HT Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total MT Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[MT Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total ORIF Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[ORIF Report]),
    'Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total PADLT Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PADLT Report]),
    'Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total PMI Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PMI Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total PT Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PT Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total PWHT Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PWHT Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total RT Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT Report]),
    'Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total UT Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Manual UT Report No.]),
    'Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total VI Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[DWIR Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[HT Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[HT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[MT Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[MT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[ORIF Report]),
    'Project WD+WR+INCO+Acciona'[ORIF CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PADLT Report]),
    'Project WD+WR+INCO+Acciona'[PADLT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PMI Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[PMI CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PT Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[PT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[PWHT Report "PR All"]),
    'Project WD+WR+INCO+Acciona'[PWHT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT Report]),
    'Project WD+WR+INCO+Acciona'[RT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Manual UT Report No.]),
    'Project WD+WR+INCO+Acciona'[UT CROSS CHECK PRJ Data & FRB] = "NOT Found"
)+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[DWIR No.]),
    'Project WD+WR+INCO+Acciona'[VI CROSS CHECK PRJ Data & FRB] = "NOT Found"
)
```

### `[Total FRB Reports]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT(l2_ndt_list[Origin_Report_No]),
l2_ndt_list[Origin_Report_No]<>"")
```

### `[Total FRB Reports SPO Upload]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT(l2_ndt_list[Origin_Report_No]),
l2_ndt_list[Origin_Report_No]<>"",
l2_ndt_list[SPO Upload Date]>0)
```

### `[Total FRB Reports SPO Not Upload]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT(l2_ndt_list[Origin_Report_No]),
l2_ndt_list[SPO_URL]="")
```

### `[RT Backlog & FABRICATED & PWHT Spool Date "PR All"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Spool ID Status]="Fabricated",
'Project WD+WR+INCO+Acciona'[Spool ID CCC PWHT Status]="Spool PWHT",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]="",
'Project WD+WR+INCO+Acciona'[RT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"})+
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Spool ID CCC PWHT Status] = "Spool PWHT",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT%] = 100,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    FILTER(
        'Project WD+WR+INCO+Acciona',
        'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", ""}
    )
)
```

### `[RT Backlog+PWHT Progress "Y" Done + PWHT "N" FABRICATED "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N] IN {"Y","25.01"},
    'Project WD+WR+INCO+Acciona'[PWHT Report] <> "",
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
    'Project WD+WR+INCO+Acciona'[RT Report] = ""
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N] IN {"Y","25.01"},
    'Project WD+WR+INCO+Acciona'[PWHT Report] <> "",
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT%] = 100,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", "", "S"}
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC] = "Y",
    'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] <> "",
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT%] = 100
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N] IN {"N","25.01"},
    'Project WD+WR+INCO+Acciona'[PWHT Weld Status] = "",
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
    'Project WD+WR+INCO+Acciona'[RT Report] = ""
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N] IN {"N","25.01"},
    'Project WD+WR+INCO+Acciona'[PWHT Weld Status] = "",
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT%] = 100,
    'Project WD+WR+INCO+Acciona'[RT Report]="",
    FILTER(
        'Project WD+WR+INCO+Acciona',
        'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", ""}
    )
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC] = "N",
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT%] = 100
)
```

### `[RT BACKLOG Total Project & PWHT"Y" NOT Done FABRICATED "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N] IN {"Y","25.01"},
    'Project WD+WR+INCO+Acciona'[PWHT Weld Status] IN {"H","HS"},
    'Project WD+WR+INCO+Acciona'[PWHT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
    'Project WD+WR+INCO+Acciona'[RT Report] = ""
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N] IN {"Y","25.01"},
    'Project WD+WR+INCO+Acciona'[PWHT Weld Status] IN {"H","HS"},
    'Project WD+WR+INCO+Acciona'[PWHT Report] = "",
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT%] = 100,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?","","S"}
) +
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Spool ID Status] = "Fabricated",
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
    'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC] = "Y",
    'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] = "",
    'Project WD+WR+INCO+Acciona'[RT Report] = ""
)
```

### `[Total VBT Reports Cross Check PRJ Data & FRB Match]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[VBT CROSS CHECK PRJ Data & FRB]),
    'Project WD+WR+INCO+Acciona'[VBT CROSS CHECK PRJ Data & FRB] <> "NOT Found",
    'Project WD+WR+INCO+Acciona'[VBT CROSS CHECK PRJ Data & FRB] <> ""
)
```

### `[Total VBT Reports Cross Check PRJ Data & FRB Not Found]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[VBT Report]),
    'Project WD+WR+INCO+Acciona'[VBT CROSS CHECK PRJ Data & FRB] = "NOT Found")
```

### `[Total Scope Dia "BW","CLET","GW","MW" Master Table]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Master Table'[Dia inch]),
'Master Table'[Weld Type]IN{"BW","CLET","GW","MW"},
'Master Table'[Repair & Reweld "PR all"]="")
```

### `[Total Scope Dia Welded "BW","CLET","GW","MW" Master Table]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Master Table'[Dia inch]),
'Master Table'[Weld Type]IN{"BW","CLET","GW","MW"},
'Master Table'[Weld Date]>0,
'Master Table'[Repair & Reweld "PR all"]="")
```

### `[Total Scope Dia All Types Master Table]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Master Table'[Dia inch]),
'Master Table'[Repair & Reweld "PR all"]="")
```

### `[Total Scope Dia Welded "All Types" Master Table]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Master Table'[Dia inch]),
'Master Table'[Weld Date]>0,
'Master Table'[Repair & Reweld "PR all"]="")
```

### `[Total_EP FRB]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM(l3_ndt_spo_summary[Not_Uploaded])+ 
    SUM(l3_ndt_spo_summary[SPO_Matched_EP])+
    SUM(l3_ndt_spo_summary[SPO_Mismatched_EP])
)
```

### `[RT Total Forecast Backlog]`

- home table: `Calendar`
- format string: `#,0`

```dax
VAR RT_100_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 100
    )
VAR RT_5_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 5
    ) * 0.05
VAR RT_10_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 10
    ) * 0.1
VAR RT_20_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 20
    ) * 0.2
VAR RT_30_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 30
    ) * 0.3
RETURN
RT_100_Joints + RT_5_Joints+RT_10_Joints+RT_20_Joints+RT_30_Joints
```

### `[RT 100% Forecast Backlog]`

- home table: `Calendar`
- format string: `0`

```dax
VAR RT_100_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 100
    )
RETURN
RT_100_Joints
```

### `[RT 5% Forecast Backlog]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR RT_5_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 5
    ) * 0.05
RETURN
RT_5_Joints
```

### `[RT 10% Forecast Backlog]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR RT_10_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 10
    ) * 0.1
RETURN
RT_10_Joints
```

### `[RT 20% Forecast Backlog]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR RT_20_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 20
    ) * 0.2
RETURN
RT_20_Joints
```

### `[RT 30% Forecast Backlog]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR RT_30_Joints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 30
    ) * 0.3
RETURN
RT_30_Joints
```

### `[QTY Years for RT Backlog Forecast]`

- home table: `Calendar`
- format string: `nan`

```dax
[RT Total Forecast Backlog]/[RT Average Production 2024-2026 per Month]/12
```

### `[Days Since First Weld]`

- home table: `Calendar`
- format string: `nan`

```dax
IF(ISBLANK([First_Weld Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[First_Weld Date "PR all"]))
```

### `[RT Average Production 2024-2026 per Month]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR FilteredData = 
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        YEAR('Project WD+WR+INCO+Acciona'[RT Date]) IN{2024,2025,2026}
    )
VAR NumRTUT = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        'Project WD+WR+INCO+Acciona'[RT Date]>1/1/2024,
        FilteredData
    )
VAR DaysSinceFirstday2024 = 
    DATEDIFF(
        DATE(2024, 1, 1),
        MAX('Project WD+WR+INCO+Acciona'[RT Date]),
        DAY
    )
RETURN 
IF(
    DaysSinceFirstday2024 > 0,
    (NumRTUT / DaysSinceFirstday2024) * 30,
    0
)
```

### `[Numb RT 2024 "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT Report] <> "",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    YEAR('Project WD+WR+INCO+Acciona'[RT Date]) IN{2024,2025}
)
```

### `[RT Dia Average Production 2024-26 per Month]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR FilteredData = 
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        YEAR('Project WD+WR+INCO+Acciona'[RT Date]) IN{2024,2025,2026}
    )
VAR DiaRTUT = 
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total Welded Dia "PR all" Table]),
        FilteredData,
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"},
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1] = 1,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",
        'Project WD+WR+INCO+Acciona'[RT Date] > DATE(2024, 1, 1)
    )
VAR DaysSinceFirstDay2024 = 
    DATEDIFF(
        DATE(2024, 1, 1),
        MAXX(FilteredData, 'Project WD+WR+INCO+Acciona'[RT Date]),
        DAY
    )
RETURN 
IF(
    DaysSinceFirstDay2024 > 0,
    (DiaRTUT / DaysSinceFirstDay2024) * 30,
    0
)
```

### `[Total Welded RT Dia WP1 2024 "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Total Welded Dia "PR all" Table]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
'Project WD+WR+INCO+Acciona'[RT Report] <> "",
'Project WD+WR+INCO+Acciona'[RT Date]>1/1/2024)
```

### `[RT BACKLOG Dia Total Project "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1] = 1,
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"}
) +
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT%] = 100,
    'Project WD+WR+INCO+Acciona'[RT Report] = "",
    'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1] = 1,
    'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", ""}
)
```

### `[Total_EP FRB 2]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM('l3_ndt_spo_summary (2)'[Not_Uploaded])+
    SUM('l3_ndt_spo_summary (2)'[SPO_Matched_EP])+
    SUM('l3_ndt_spo_summary (2)'[SPO_Mismatched_EP])
)
```

### `[Months to keep RT Backlog]`

- home table: `Calendar`
- format string: `nan`

```dax
[RT BACKLOG Total Project "PR all"] / [RT Average Production 2024-2026 per Month]
```

### `[Months to keep Dia RT Backlog]`

- home table: `Calendar`
- format string: `nan`

```dax
[RT BACKLOG Dia Total Project "PR all"] / [RT Dia Average Production 2024-26 per Month]
```

### `[Total Welded Dia WP1 All Types "PR all" (New)]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Total Welded Dia "PR all" Table]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1)
```

### `[Total Scope Dia WP1 All Types "PR all" (New)]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="")
```

### `[Total Scope Dia WP1 "BW","CLET","GW","MW" "PR all" (New)]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","CLET","GW","MW"},
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="")
```

### `[Total Welded Dia WP1 "BW","CLET","GW","MW" "PR all" (New)]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Total Welded Dia "PR all" Table]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","CLET","GW","MW"},
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1)
```

### `[RT Total Films by Joint "PR all" (2)]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[RT Film Total]),
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review")+
CALCULATE(sum('Project WD+WR+INCO+Acciona'[RT Film Total]),
'Project WD+WR+INCO+Acciona'[Weld Point Code]IN{"R","H","F","C"},
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review")-
CALCULATE(sum('Project WD+WR+INCO+Acciona'[RT Film Total]),
'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
'Project WD+WR+INCO+Acciona'[Weld Point Code]IN{"R","H","F","C"},
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"U/Review")
```

### `[Welding Dia Average Production 2024-26 per Month]`

- home table: `Calendar`
- format string: `#,0`

```dax
VAR FilteredData = 
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        YEAR('Project WD+WR+INCO+Acciona'[Weld Date]) IN{2024,2025.2026}
    )
VAR DiaWelded = 
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total Welded Dia "PR all" Table]),
        FilteredData,
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1] = 1,
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[Weld Date] > DATE(2024, 1, 1)
    )
VAR DaysSinceFirstDay2024 = 
    DATEDIFF(
        DATE(2024, 1, 1),
        MAXX(FilteredData, 'Project WD+WR+INCO+Acciona'[Weld Date]),
        DAY
    )
RETURN 
IF(
    DaysSinceFirstDay2024 > 0,
    (DiaWelded / DaysSinceFirstDay2024) * 30,
    0
)
```

### `[RT Dia Total Forecast Backlog]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR RT_100_Joints = 
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 100
    )
VAR RT_5_Joints = 
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 5
    ) * 0.05
VAR RT_10_Joints = 
    CALCULATE(
         SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 10
    ) * 0.1
VAR RT_20_Joints = 
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 20
    ) * 0.2
VAR RT_30_Joints = 
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1]=1,
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
        ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
        'Project WD+WR+INCO+Acciona'[RT%] = 30
    ) * 0.3
RETURN
RT_100_Joints + RT_5_Joints+RT_10_Joints+RT_20_Joints+RT_30_Joints
```

### `[Welding Dia Average Production Overall per Month]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR FilteredData = 
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]))
    )
VAR DiaWelded = 
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total Welded Dia "PR all" Table]),
        FilteredData,
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1] = 1
    )
VAR DaysSinceFirstDay = 
    DATEDIFF(
        MINX(FilteredData, 'Project WD+WR+INCO+Acciona'[Weld Date]), 
        MAXX(FilteredData, 'Project WD+WR+INCO+Acciona'[Weld Date]), 
        DAY
    )
RETURN 
IF(
    DaysSinceFirstDay > 0,
    (DiaWelded / DaysSinceFirstDay) * 30,
    0
)
```

### `[Welding Dia Average Production per week]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR FilteredData = 
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        NOT(ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]))
    )
VAR DiaWelded = 
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total Welded Dia "PR all" Table]),
        FilteredData,
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1] = 1
    )
VAR DaysSinceFirstDay = 
    DATEDIFF(
        MINX(FilteredData, 'Project WD+WR+INCO+Acciona'[Weld Date]), 
        MAXX(FilteredData, 'Project WD+WR+INCO+Acciona'[Weld Date]), 
        DAY
    )
RETURN 
IF(
    DaysSinceFirstDay > 0,
    (DiaWelded / DaysSinceFirstDay*7),
    0
)
```

### `[% Welding Complete]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Joint Uniq "PR all" Welded]/[Joint Uniq "PR all" Total]
```

### `[% Welding Dia Complete]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Total Welded Dia WP1 All Types "PR all" (New)]/[Total Scope Dia WP1 All Types "PR all" (New)]
```

### `[Joint Uniq "PR all" Welded & R/RW]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0)
```

### `[RT Ratio % RT/ Welded Joint ID uniq "PR all" & R/RW]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "PR all"]/[Joint Uniq "PR all" Welded & R/RW]
```

### `[Welders_No_RT]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0, -- Учитываются только сварщики с датой сварки
    'Project WD+WR+INCO+Acciona'[RT Report]="", -- RT Report пуст
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS", -- Исключаем rejected сварки
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]) -- Группируем по Service Class + Service Cat + NDT Remarks
)
```

### `[Final_Welders_No_RT]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    [Welders_No_RT], -- Используем уже созданную меру
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]) -- Фильтруем по Service Class + Service Cat+NDT Remarks
)
```

### `[Welder_ID_No_RT]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR CurrentServiceClassCat = SELECTEDVALUE('Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks])
VAR CurrentWelderID = SELECTEDVALUE('Project WD+WR+INCO+Acciona'[Welder ID])
VAR CurrentWeldDate = MAX('Project WD+WR+INCO+Acciona'[Weld Date])  -- Используем MAX для получения одного значения
VAR Has_RT_Report = 
    CALCULATE(
        COUNTROWS('Project WD+WR+INCO+Acciona'),
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",
        'Project WD+WR+INCO+Acciona'[Welder ID] = CurrentWelderID,
        'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks] = CurrentServiceClassCat
    )

RETURN
    IF(
        CurrentWeldDate > 0,  -- Используем CurrentWeldDate
        IF(
            Has_RT_Report > 0, 
            BLANK(),  -- Если RT Report есть, возвращаем пустое значение
            CurrentWelderID  -- Если RT Report нет, возвращаем Welder ID
        ),
        BLANK()  -- Если Weld Date <= 0, возвращаем пустое значение
    )
```

### `[QTY Welders & RT Report]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks+Welder ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[RT Report]<>"",
'Project WD+WR+INCO+Acciona'[RT Report]<>"RS")
```

### `[QTY Welders & No RT Report]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks+Welder ID]),
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0
) - 
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks+Welder ID]),
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT Report] <> "",
    'Project WD+WR+INCO+Acciona'[RT Report] <> "RS"
)
```

### `[QTY Welders & No RT Report %]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
VAR TotalWelders = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks+Welder ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0
    )

VAR WeldersWithRT = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks+Welder ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",
        'Project WD+WR+INCO+Acciona'[RT Report] <> "RS"
    )

VAR WeldersWithoutRT = 
    TotalWelders - WeldersWithRT

RETURN
    DIVIDE(WeldersWithoutRT, TotalWelders)
```

### `[Inco RT/UT Length Last 2 weeks]`

- home table: `Calendar`
- format string: `nan`

```dax
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Rej Length]),  -- Все верно это RT Length Column
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
            )
        )
```

### `[Inco RT/UT Rej Length Last 2 weeks]`

- home table: `Calendar`
- format string: `0`

```dax
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Repair Length (mm)]),
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
            )
        )
```

### `[Inco Last 2 weeks len Ratio% by Welder Mesure]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Inco RT/UT Rej Length Last 2 weeks] / [Inco RT/UT Length Last 2 weeks]
```

### `[Inco RT/UT Rej Length Last 1 Month]`

- home table: `Calendar`
- format string: `0`

```dax
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Repair Length (mm)]),
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
            )
        )
```

### `[Inco RT/UT Length Last 1 Month]`

- home table: `Calendar`
- format string: `nan`

```dax
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Rej Length]),  -- Все верно это RT Length Column
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
            )
        )
```

### `[Inco Last 1 Month len Ratio% by Welder Mesure]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Inco RT/UT Rej Length Last 1 Month] / [Inco RT/UT Length Last 1 Month]
```

### `[Inco RT/UT Length Overall]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[Rej Length]),  -- Это RT Length Column
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
)
```

### `[Inco RT/UT Rej Length Overall]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[Repair Length (mm)]),
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
)
```

### `[Inco Overall Len Ratio% by Welder Mesure]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Inco RT/UT Rej Length Overall] / [Inco RT/UT Length Overall]
```

### `[RT BACKLOG RT100% Talisman]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('TALISMAN DATA'[Joint ID]),
    'TALISMAN DATA'[WELD DATE] > 0,
    'TALISMAN DATA'[RT% from Project WD+WR] = 100,
    'TALISMAN DATA'[RT1 REP NO] = ""
)
```

### `[Total Joint ID Uniq Talisman]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(
    DISTINCTCOUNT('TALISMAN DATA'[Joint ID]),
    'TALISMAN DATA'[ORIGINAL REPAIR DELETE FLAG]<>"R")
```

### `[Total Joint ID Uniq Talisman Welded]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(
    DISTINCTCOUNT('TALISMAN DATA'[Joint ID]),
    'TALISMAN DATA'[WELD DATE]>0,
    'TALISMAN DATA'[ORIGINAL REPAIR DELETE FLAG]<>"R")
```

### `[Numb RT/UT "Talisman" "R"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('TALISMAN DATA'[Joint ID]),
'TALISMAN DATA'[RT1 RESULT]="R")
```

### `[MT Progress All "PR all"]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[MT Report "PR All"]<>"")
```

### `[PT Progress All "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PT Report "PR All"]<>"")
```

### `[PMI Progress All "PR all"]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PMI Report "PR All"]<>"")
```

### `[HT Progress All "PR all"]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[HT Report "PR All"]<>"")
```

### `[ORIF Progress All "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[ORIF Report]<>"")
```

### `[PADLT Progress All "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PADLT Report]<>"")
```

### `[VI Progress All "PR all"]`

- home table: `Calendar`
- format string: `#,0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[DWIR Report "PR All"]<>"")
```

### `[VBT Progress All "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[VBT Report]<>"")
```

### `[PAUT Progress All "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT Report] <> "",
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[RT Report], "PAUT")
)
```

### `[UT Weld Length by Welder "PR all"2]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(sum('Project WD+WR+INCO+Acciona'[Weld Length "PR all"]),
'Project WD+WR+INCO+Acciona'[UT Report "PR All"]<>"")
```

### `[PWHT All BACKLOG All WELD TYPE "PR all" (New PBI Rule)]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0,
'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC (NEW)]="Y",
'Project WD+WR+INCO+Acciona'[PWHT Report No CCC]="")+
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[PWHT Weld Status]IN{"H","HS","HS CCC","SS","T","T1","T1-2","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"},
'Project WD+WR+INCO+Acciona'[PWHT Report]="")
```

### `[Flanges ID De-Tightening]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    CONTAINSSTRING('Flange Progress'[Joint Point], "FR")
)
```

### `[Flanges ID Jointed %]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Total Flanges ID Jointed]/[Total Flanges ID]
```

### `[Joint Uniq "PR all" Welded "F"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Weld Cat]="F",
'Project WD+WR+INCO+Acciona'[Weld Date]>0)
```

### `[PAUT "R" Progress All "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
    'Project WD+WR+INCO+Acciona'[RT Report] <> "",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] = "R",
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[RT Report], "PAUT")
)
```

### `[Numb RT/UT "PR all" 2]`

- home table: `Calendar`
- format string: `nan`

```dax
COALESCE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        USERELATIONSHIP('Project WD+WR+INCO+Acciona'[RT Date], 'Calendar'[Date])
    ),
    0
)
```

### `[MT Progress All "PR all" 2]`

- home table: `Calendar`
- format string: `nan`

```dax
COALESCE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[MT Report "PR All"] <> "",
        USERELATIONSHIP('Project WD+WR+INCO+Acciona'[MT Date "PR All"], Calendar[Date])
    ),
    0
)
```

### `[Flanges ID Complete "BTC01"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Joint Date]>0,
'Flange Progress'[BTC01]<>"")
```

### `[Flanges ID BreakDown]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Reason for De-Tightening]="FLANGE LEAKAGE")
```

### `[Flanges ID Inspected 2]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Joint Date]>0,
'Flange Progress'[Control Inspection Date]>0,       
    USERELATIONSHIP('Flange Progress'[Control Inspection Date], 'Calendar'[Date])  
)
```

### `[Joint Uniq "PR all" Balance]`

- home table: `Calendar`
- format string: `#,0`

```dax
[Joint Uniq "PR all" Total]-[Joint Uniq "PR all" Welded]
```

### `[Remaining Joints for RT5% Control]`

- home table: `Calendar`
- format string: `nan`

```dax
VAR TotalWeldedJoints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT%] = 5
    )

VAR TotalRequiredJoints = TotalWeldedJoints * 0.05

VAR RTTests = 
    COALESCE(
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            'Project WD+WR+INCO+Acciona'[RT Report] <> "",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[RT%] = 5
        ),
        0
    )

VAR RemainingJoints = TotalRequiredJoints - RTTests

RETURN 
    CEILING(IF(RemainingJoints < 0, 0, RemainingJoints), 1)
```

### `[Remaining Joints for 10% Control]`

- home table: `Calendar`
- format string: `0`

```dax
VAR TotalWeldedJoints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT%] = 10
    )

VAR TotalRequiredJoints = TotalWeldedJoints * 0.10

VAR RTTests = 
    COALESCE(
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            'Project WD+WR+INCO+Acciona'[RT Report] <> "",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[RT%] = 10
        ),
        0
    )

VAR RemainingJoints = TotalRequiredJoints - RTTests

RETURN 
    CEILING(IF(RemainingJoints < 0, 0, RemainingJoints), 1)
```

### `[Remaining Joints for 100% Control]`

- home table: `Calendar`
- format string: `0`

```dax
VAR TotalWeldedJoints = 
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"] = "",
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT%] = 100
    )

VAR TotalRequiredJoints = TotalWeldedJoints * 1.00

VAR RTTests = 
    COALESCE(
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            'Project WD+WR+INCO+Acciona'[RT Report] <> "",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[RT%] = 100
        ),
        0
    )

VAR RemainingJoints = TotalRequiredJoints - RTTests

RETURN 
    CEILING(IF(RemainingJoints < 0, 0, RemainingJoints), 1)
```

### `[Joint Uniq "PR all" Forecast Balance RT5%]`

- home table: `Calendar`
- format string: `0`

```dax
VAR RemainingJoints = [Joint Uniq "PR all" Total] - [Joint Uniq "PR all" Welded]
VAR RequiredRTJoints = RemainingJoints * 0.05
RETURN CEILING(IF(RequiredRTJoints < 0, 0, RequiredRTJoints), 1)
```

### `[Joint Uniq "PR all" Forecast Balance RT10%]`

- home table: `Calendar`
- format string: `0`

```dax
VAR RemainingJoints = [Joint Uniq "PR all" Total] - [Joint Uniq "PR all" Welded]
VAR RequiredRTJoints = RemainingJoints * 0.10
RETURN CEILING(IF(RequiredRTJoints < 0, 0, RequiredRTJoints), 1)
```

### `[Numb RT/UT "PR all" TESTED]`

- home table: `Calendar`
- format string: `0`

```dax
COALESCE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        NOT (
            RIGHT('Project WD+WR+INCO+Acciona'[Joint ID], 2) = "R1" ||
            RIGHT('Project WD+WR+INCO+Acciona'[Joint ID], 2) = "R2" ||
            RIGHT('Project WD+WR+INCO+Acciona'[Joint ID], 2) = "RW" ||
            RIGHT('Project WD+WR+INCO+Acciona'[Joint ID], 3) = "RW1" ||
            RIGHT('Project WD+WR+INCO+Acciona'[Joint ID], 3) = "RW2"
        )
    ),
    0
)
```

### `[Total_Approve in FRB]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM(l3_ndt_spo_summary[PIMS_transmitted]))
```

### `[RT100% Backlog Forecast "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Date]), -- RT Date пуст
    'Project WD+WR+INCO+Acciona'[RT%] = 100, -- RT% = 100
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "CLET", "MW", "GW"}
) - [RT100% Backlog "PR all"]
```

### `[Open Punch X]`

- home table: `Calendar`
- format string: `#,0`

```dax
SUMX (
    SUMMARIZE (
        'Project WD+WR+INCO+Acciona',
        'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"],
        "MaxOpen", MAX('Project WD+WR+INCO+Acciona'[Open_Punch_"X"])
    ),
    [MaxOpen]
)
```

### `[Open Punch Y]`

- home table: `Calendar`
- format string: `#,0`

```dax
SUMX (
    SUMMARIZE (
        'Project WD+WR+INCO+Acciona',
        'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"],
        "MaxOpen", MAX('Project WD+WR+INCO+Acciona'[Open_Punch_"Y"])
    ),
    [MaxOpen]
)
```

### `[Open Punch Z]`

- home table: `Calendar`
- format string: `0`

```dax
SUMX (
    SUMMARIZE (
        'Project WD+WR+INCO+Acciona',
        'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"],
        "MaxOpen", MAX('Project WD+WR+INCO+Acciona'[Open_Punch_"Z"])
    ),
    [MaxOpen]
)
```

### `[Open Punch X "TPWD"]`

- home table: `Calendar`
- format string: `0`

```dax
SUMX (
    SUMMARIZE (
        'Testpack-wise Details Report',
        'Testpack-wise Details Report'[TEST PACK],
        "MaxOpen", MAX('Testpack-wise Details Report'[Open_Punch "X"])
    ),
    [MaxOpen]
)
```

### `[Open Punch Y "TPWD"]`

- home table: `Calendar`
- format string: `0`

```dax
SUMX (
    SUMMARIZE (
        'Testpack-wise Details Report',
        'Testpack-wise Details Report'[TEST PACK],
        "MaxOpen", MAX('Testpack-wise Details Report'[Open_Punch "Y"])
    ),
    [MaxOpen]
)
```

### `[Open Punch Z "TPWD"]`

- home table: `Calendar`
- format string: `0`

```dax
SUMX (
    SUMMARIZE (
        'Testpack-wise Details Report',
        'Testpack-wise Details Report'[TEST PACK],
        "MaxOpen", MAX('Testpack-wise Details Report'[Open_Punch "Z"])
    ),
    [MaxOpen]
)
```

### `[PT Progress All "PR all" 2]`

- home table: `Calendar`
- format string: `0`

```dax
COALESCE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        'Project WD+WR+INCO+Acciona'[PT Report "PR All"] <> "",
        USERELATIONSHIP('Project WD+WR+INCO+Acciona'[PT Date "PR All"], Calendar[Date])
    ),
    0
)
```

### `[MT + PT "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
    COALESCE(
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            'Project WD+WR+INCO+Acciona'[MT Report "PR All"] <> "",
            USERELATIONSHIP('Project WD+WR+INCO+Acciona'[MT Date "PR All"], Calendar[Date])
        ),
        0
    )
    +
    COALESCE(
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            'Project WD+WR+INCO+Acciona'[PT Report "PR All"] <> "",
            USERELATIONSHIP('Project WD+WR+INCO+Acciona'[PT Date "PR All"], Calendar[Date])
        ),
        0
    )
```

### `[Rejection UT Rate Length by Sub-Con "PR all" 2]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[UT Defect Length by Joint "PR all"]/[UT Weld Length by Joint "PR all"]
```

### `[Flanges ID PCC Tightening]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[PCC Tightening Date- Field039 (Custom)]>0)
```

### `[Flanges ID PCC De-Tightening]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[PCC Re-Tightening Date - Field042 (Custom)]>0)
```

### `[Flange ID Status Tested]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Test Status]="Tested")
```

### `[Total Flanges ID Reinstatement]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Reinstatement Status]="Reinstatement")
```

### `[Total Flanges ID Tightening Constraction]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    'Flange Progress'[Joint Date] > 0,
    ISBLANK('Flange Progress'[PCC Tightening Date- Field039 (Custom)]), -- Использование ISBLANK
    'Flange Progress'[Cat.] IN {"X", "Y"}
)
```

### `[Total Flanges ID Tightening PCC]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    'Flange Progress'[Joint Date] > 0,
    'Flange Progress'[Cat.] IN {"Z", "A", "B"}
)
+
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    ('Flange Progress'[PCC Tightening Date- Field039 (Custom)] > 0)
)
```

### `[Total Flanges ID TBN]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    'Flange Progress'[Joint Date] > 0,
    ISBLANK('Flange Progress'[PCC Tightening Date- Field039 (Custom)]), -- Использование ISBLANK
    'Flange Progress'[Cat.] IN {"TBN"}
)
```

### `[Flange ID De-Tightening Rate %]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Flanges ID De-Tightening]/[Total Flanges ID Jointed]
```

### `[Total Flanges ID Remainder]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
ISBLANK('Flange Progress'[Joint Date]))
```

### `[Total Flanges ID Jointed 1510]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange ovAssets_1510'[Joint ID]),
'Flange ovAssets_1510'[Joint Date]>0)
```

### `[Total Flanges ID Report Nbr 1510]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange ovAssets_1510'[Joint ID]),
'Flange ovAssets_1510'[Report Nbr]<>"",
'Flange ovAssets_1510'[Joint Date]>0)
```

### `[Total Flanges ID Tightening Constraction "CCC no cat"]`

- home table: `Calendar`
- format string: `0`

```dax
VAR DateFilter = 
    FILTER(
        'Flange Progress',
        NOT ISBLANK('Flange Progress'[Joint Date]) && 
        ISBLANK('Flange Progress'[PCC Tightening Date- Field039 (Custom)])
    )

RETURN
    CALCULATE(
        DISTINCTCOUNT('Flange Progress'[Joint ID]),
        DateFilter, -- Общий фильтр по датам
        'Flange Progress'[Flange Subcontractor] = "CCC" -- Фильтр 1: sub-contractor = "CCC"
    ) 
    + 
    CALCULATE(
        DISTINCTCOUNT('Flange Progress'[Joint ID]),
        DateFilter, -- Общий фильтр по датам
        FILTER(
            'Flange Progress',
            'Flange Progress'[Flange Subcontractor] <> "CCC" &&
            'Flange Progress'[Cat.] IN {"X", "Y"} -- Фильтр 2: sub-contractor <> "CCC" И Cat. IN {"X", "Y"}
        )
    )
```

### `[Total Flanges ID Tightening PCC "CCC no cat"]`

- home table: `Calendar`
- format string: `0`

```dax
VAR CurrentSubcontractor = VALUES('Flange Progress'[Flange Subcontractor]) // Захватываем текущий субподрядчик из строки таблицы

VAR TighteningPCCCount = 
    CALCULATE(
        DISTINCTCOUNT('Flange Progress'[Joint ID]), 
        'Flange Progress'[PCC Tightening Date- Field039 (Custom)] > 0,
        CurrentSubcontractor // Применяем фильтр по текущему субподрядчику
    )

VAR NonCCCWeldedCount = 
    CALCULATE(
        DISTINCTCOUNT('Flange Progress'[Joint ID]),
        'Flange Progress'[Joint Date] > 0,
        CurrentSubcontractor, // Применяем фильтр по текущему субподрядчику
        'Flange Progress'[Flange Subcontractor] <> "CCC", // Дополнительное исключение CCC
        'Flange Progress'[Cat.] IN {"Z", "A", "B"}
    )

RETURN
    TighteningPCCCount + NonCCCWeldedCount
```

### `[Total Flanges ID Reinstatement SCDB]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Task_Status PIP-018-A "VPR"]<>"")
```

### `[Total Flanges ID Reinstatement SCDB "Z"+"TBN"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange Progress'[Joint ID]),
'Flange Progress'[Cat.] IN {"Z", "TBN"},
'Flange Progress'[Task_Status PIP-018-A "VPR"]<>"")
```

### `[Total Flanges ID Reinstatement SCDB Tight-g Date]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    'Flange Progress'[Joint Date]>0,
    'Flange Progress'[Task_Status PIP-018-A "VPR"]<>""
)
+
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    ISBLANK('Flange Progress'[Joint Date]), // <-- Исправлено: добавлена закрывающая скобка и запятая
    'Flange Progress'[PCC Tightening Date- Field039 (Custom)]>0,
    'Flange Progress'[Task_Status PIP-018-A "VPR"]<>""
)
```

### `[Total Flanges ID Reinstatement SCDB "Z"+"TBN" Tight-n Date]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    'Flange Progress'[Joint Date]>0,'Flange Progress'[Cat.] IN {"Z", "TBN"},
    'Flange Progress'[Task_Status PIP-018-A "VPR"]<>""
)
+
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[Joint ID]),
    ISBLANK('Flange Progress'[Joint Date]),
    'Flange Progress'[PCC Tightening Date- Field039 (Custom)]>0,'Flange Progress'[Cat.] IN {"Z", "TBN"},
    'Flange Progress'[Task_Status PIP-018-A "VPR"]<>""
)
```

### `[RT Total Films RS by Joint "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] = "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
)
+
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] = "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
-
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] = "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
+
CALCULATE( -- НОВОЕ УСЛОВИЕ: Добавление пленок, связанных с повторной съемкой (Re-Shoot)
    SUM('Project WD+WR+INCO+Acciona'[RT Re-Shoot Films]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[RT Re-Shoot Data] > 0
)
```

### `[Flange ID from SCDB 1510 VPR "Not Found"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange ovAssets_1510'[Joint ID]),
    'Flange ovAssets_1510'[Flange ID from EP VPR] = "Not Found" 
)
```

### `[RT Total Films by Joint -"RS" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
)
+
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
-
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
-
CALCULATE( -- НОВОЕ УСЛОВИЕ: Добавление пленок, связанных с повторной съемкой (Re-Shoot)
    SUM('Project WD+WR+INCO+Acciona'[RT Re-Shoot Films]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[RT Re-Shoot Data] > 0
)
```

### `[RT Total Films by Joint-"RS" "PR all" "A"]`

- home table: `Calendar`
- format string: `0`

```dax
[RT Total Films by Joint "PR all"] - [RT Total Films by Joint "PR all" "R"]
-
CALCULATE( -- НОВОЕ УСЛОВИЕ: Добавление пленок, связанных с повторной съемкой (Re-Shoot)
    SUM('Project WD+WR+INCO+Acciona'[RT Re-Shoot Films]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[RT Re-Shoot Data] > 0
)
```

### `[Total Flanges ID 1510]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Flange ovAssets_1510'[Joint ID]))
```

### `[Total Flanges Jointed % 1510]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Total Flanges ID Jointed 1510]/[Total Flanges ID 1510]
```

### `[Last_Friday_CutOff]`

- home table: `Calendar`
- format string: `dd-mmm-yy`

```dax
VAR CurrentDate = TODAY()
/* WEEKDAY(Date, 3) возвращает: 0=Понедельник, 1=Вторник, ..., 4=Пятница, 5=Суббота, 6=Воскресенье */
VAR CurrentDayIndex = WEEKDAY(CurrentDate, 3) 
VAR DaysSinceFriday = 
    IF(
        CurrentDayIndex >= 4, -- Если сегодня Пятница (4), Суббота (5), Воскресенье (6)
        CurrentDayIndex - 4, -- То вычитаем разницу, чтобы попасть на пятницу (0, 1, 2 дня)
        CurrentDayIndex + 3 -- Если сегодня Понедельник (0) до Четверга (3), то добавляем 3 дня до прошлой пятницы
    )

VAR LastFriday = CurrentDate - DaysSinceFriday
RETURN
    LastFriday // Возвращаем чистый тип данных DATE
```

### `[RT Total Films by Joint "PR all" "R" ПРОБНЫЙ]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
    -- Исправленное условие исключения списка (NOT + IN)
    NOT ( 'Project WD+WR+INCO+Acciona'[RT Remarks] IN { "Total have 1 reject film", "Total have 1 reject films", "Total have 2 reject films" } ),
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
)
```

### `[Last_Friday_CutOff_2_Weeks]`

- home table: `Calendar`
- format string: `dd-mmm-yy`

```dax
VAR CurrentDate = TODAY()
/* WEEKDAY(Date, 3) возвращает: 0=Понедельник, ..., 4=Пятница, 5=Суббота, 6=Воскресенье */
VAR CurrentDayIndex = WEEKDAY(CurrentDate, 3) 

VAR DaysSinceLastFriday = 
    IF(
        CurrentDayIndex >= 4, 
        CurrentDayIndex - 4, 
        CurrentDayIndex + 3
    )

-- Находим ближайшую прошлую пятницу и вычитаем еще 7 дней
VAR FridayTwoWeeksAgo = (CurrentDate - DaysSinceLastFriday) - 14

RETURN
    FridayTwoWeeksAgo
```

### `[Last_Friday_CutOff_4_Weeks]`

- home table: `Calendar`
- format string: `dd-mmm-yy`

```dax
VAR CurrentDate = TODAY()
/* WEEKDAY(Date, 3) возвращает: 0=Понедельник, ..., 4=Пятница, 5=Суббота, 6=Воскресенье */
VAR CurrentDayIndex = WEEKDAY(CurrentDate, 3) 

VAR DaysSinceLastFriday = 
    IF(
        CurrentDayIndex >= 4, 
        CurrentDayIndex - 4, 
        CurrentDayIndex + 3
    )

-- Находим ближайшую пятницу (9 янв) и вычитаем 3 недели, чтобы получить 4-ю (19 дек)
VAR FridayFourWeeksAgo = (CurrentDate - DaysSinceLastFriday) - 28

RETURN
    FridayFourWeeksAgo
```

### `[RT Total Films by Joint +"CCC RS" "PR all"]`

- home table: `Calendar`
- format string: `0.0`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    'Project WD+WR+INCO+Acciona'[Exlude RT Films from UT] <> "Exclude UT Films",
    'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
)
+
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
-
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
```

### `[RT Total Films by Joint Talisman "PR all"]`

- home table: `Calendar`
- format string: `nan`

```dax
CALCULATE(
    SUM('TALISMAN DATA'[RT1 TOTAL FILM NO]),
    'TALISMAN DATA'[WeldPoint No.1 WP1] = 1)
```

### `[RT Total Films by Joint +"CCC RS"+ "Talisman not found" "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
    'Project WD+WR+INCO+Acciona'[Exlude RT Films from UT] <> "Exclude UT Films",
    'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
)
+
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
-
CALCULATE(
    SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
    'Project WD+WR+INCO+Acciona'[WeldPoint No.] = 1,
    'Project WD+WR+INCO+Acciona'[Weld Point Code] IN {"R", "H", "F", "C"},
    'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review"
)
+
CALCULATE(
    SUM('TALISMAN DATA'[RT1 TOTAL FILM NO]),
    'TALISMAN DATA'[WeldPoint No.1 WP1] = 1,
    'TALISMAN DATA'[SUBCON CODE]="CCC",
    'TALISMAN DATA'[CROSS CHECK DATA JOINT ID]="NO")
```

### `[RT Total Films Rej by Joint Talisman "PR all"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(
    SUM('TALISMAN DATA'[RT1 REJECT FILM NO]),
    'TALISMAN DATA'[WeldPoint No.1 WP1] = 1)
```

### `[CUM To be Repaired running total Calendar]`

- home table: `Calendar`
- format string: `0`

```dax
VAR MaxDate = MAX('Calendar'[Date])
VAR Result = 
    CALCULATE(
        [To be Repaired FLG],
        FILTER(
            ALLSELECTED('Calendar'),
            'Calendar'[Date] <= MaxDate
        )
    )
RETURN
    IF(ISBLANK([To be Repaired FLG]), BLANK(), Result)
```

### `[To be Repaired FLG]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(SUM('Flg Onepager_data'[To be Repaired]),
'Flg Onepager_data'[ACCEPTED/REJECTED]="REJECTED")
```

### `[Repaired FLG]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(SUM('Flg Onepager_data'[Repaired]),
'Flg Onepager_data'[ACCEPTED/REJECTED]="REJECTED")
```

### `[CUM Repaired running total Calendar]`

- home table: `Calendar`
- format string: `0`

```dax
VAR MaxDate = MAX('Calendar'[Date])
VAR Result = 
    CALCULATE(
        [Repaired FLG],
        FILTER(
            ALLSELECTED('Calendar'),
            'Calendar'[Date] <= MaxDate
        )
    )
RETURN
    IF(ISBLANK([Repaired FLG]), BLANK(), Result)
```

### `[Joint Uniq "PR all" Total "BW","GW","CLET","MW"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="")
```

### `[Joint Uniq "PR all" Total Welded "BW","GW","CLET","MW"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
'Project WD+WR+INCO+Acciona'[Weld Date]>0)
```

### `[RT Ratio % RT/ Welded Joint "BW","GW","CLET","MW" ID uniq "PR all"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "PR all"]/[Joint Uniq "PR all" Total Welded "BW","GW","CLET","MW"]
```

### `[RT Ratio % A/RT]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "PR all" "A"]/[Numb RT/UT "PR all"]
```

### `[Numb RT/UT "Talisman"]`

- home table: `Calendar`
- format string: `0`

```dax
CALCULATE(DISTINCTCOUNT('TALISMAN DATA'[Joint ID]),
'TALISMAN DATA'[RT1 REP NO]<>"",
'TALISMAN DATA'[RT1 RESULT]<>"RS")
```

### `[RT Ratio % RT/ Welded Joint ID uniq "Talisman"]`

- home table: `Calendar`
- format string: `0.00%;-0.00%;0.00%`

```dax
[Numb RT/UT "Talisman"]/[Total Joint ID Uniq Talisman Welded]
```

## Calculated columns on real tables (291)

### Table `AllTrain_CSVExport_Joint Record` (1 calculated columns)

#### `AllTrain_CSVExport_Joint Record[Joint ID "JR"]` — format `nan`

```dax
'AllTrain_CSVExport_Joint Record'[QC ISO DWG No]&"-"&'AllTrain_CSVExport_Joint Record'[Spool No.]&"-"&'AllTrain_CSVExport_Joint Record'[Joint No]&""&'AllTrain_CSVExport_Joint Record'[Repair Suffix]
```

### Table `CSVExport_Welder Record` (3 calculated columns)

#### `CSVExport_Welder Record[PWHT Y/N CCC]` — format `nan`

```dax
IF(
    'CSVExport_Welder Record'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR PWHT_Value = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = 'CSVExport_Welder Record'[Joint ID] &&
                'CSVExport_Welder Record'[Sub-Contractor] = "CCC"
            ),
            'AllTrain_CSVExport_Joint Record'[PWHT]
        )
    RETURN
        IF(
            ISBLANK(PWHT_Value),
            "N",
            PWHT_Value
        )
)
```

#### `CSVExport_Welder Record[PWHT Report No CCC]` — format `nan`

```dax
IF(
    'CSVExport_Welder Record'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR PWHT_Report = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = 'CSVExport_Welder Record'[Joint ID]
            ),
            'AllTrain_CSVExport_Joint Record'[PWHT Report No]
        )
    RETURN
        PWHT_Report
)
```

#### `CSVExport_Welder Record[Joint ID+Welder ID]` — format `nan`

```dax
'CSVExport_Welder Record'[Joint ID]&"-"&'CSVExport_Welder Record'[welder]
```

### Table `Calendar` (9 calculated columns)

#### `Calendar[Month]` — format `mmmm d`

```dax
FORMAT('Calendar'[Date],"MMM-yy")
```

#### `Calendar[Row Index Column]` — format `0`

```dax
CALCULATE(
    COUNTROWS('Calendar'),
    FILTER(All('Calendar'), 'Calendar'[Date] <= EARLIER('Calendar'[Date])))
```

#### `Calendar[Name_of_the_Month]` — format `nan`

```dax
FORMAT('Calendar'[Date],"YYYYMM")
```

#### `Calendar[Week_Start_Date]` — format `dd-mmm-yy`

```dax
CALCULATE(MIN('Calendar'[Date]),FILTER('Calendar',[Weekday]=1&&[Weeknum]=EARLIER('Calendar'[Weeknum])))
```

#### `Calendar[Weekday]` — format `0`

```dax
IF(WEEKDAY('Calendar'[Date])<=6,WEEKDAY('Calendar'[Date])+1,WEEKDAY('Calendar'[Date])-6)
```

#### `Calendar[Weeknum]` — format `0`

```dax
CALCULATE(COUNT('Calendar'[Weekday]),FILTER('Calendar',[Weekday]=1&&[Date]<=EARLIER('Calendar'[Date])))
```

#### `Calendar[Week_End_Date]` — format `dd-mmm-yy`

```dax
CALCULATE(MAX('Calendar'[Date]),FILTER('Calendar',[Weekday]=7&&[Weeknum]=EARLIER('Calendar'[Weeknum])))
```

#### `Calendar[YEAR]` — format `nan`

```dax
FORMAT('Calendar'[Date],"yyyy")
```

#### `Calendar[Date2]` — format `dd-mmm-yy`

```dax
'Calendar'[Date]
```

### Table `Flange Progress` (16 calculated columns)

#### `Flange Progress[PDS Area "VPR"]` — format `nan`

```dax
    VAR PDSAreaVPR = 
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona', 
                'Project WD+WR+INCO+Acciona'[ISO Number] = 'Flange Progress'[Iso Number]
            ),
            'Project WD+WR+INCO+Acciona'[PDS Area]
        )
    RETURN PDSAreaVPR
```

#### `Flange Progress[PDS Area Final]` — format `nan`

```dax
IF(
    ISBLANK('Flange Progress'[PDS Area "VPR"]),
    'Flange Progress'[PDS Area],  
    'Flange Progress'[PDS Area "VPR"]
)
```

#### `Flange Progress[HA]` — format `nan`

```dax
VAR SystemVal = 'Flange Progress'[System]
VAR SecondDigit = MID(SystemVal, 2, 1)

RETURN
IF (
    ISBLANK(SystemVal) || SystemVal = "System-NA - Not Applicable",
    -- Если пусто или NA, выполняем поиск
    LOOKUPVALUE(
        'HA l0_abs_guide'[Handover Area], 
        'HA l0_abs_guide'[Location Number], 'Flange Progress'[PDS Area Final]
    ),
    -- Если System заполнена, проверяем вторую цифру
    SWITCH (
        SecondDigit,
        "1", "HA1",
        "2", "HA2",
        "3", "HA3",
        "4", "HA4",
        -- Результат, если вторая цифра не 1-4 (опционально)
        LOOKUPVALUE(
            'HA l0_abs_guide'[Handover Area], 
            'HA l0_abs_guide'[Location Number], 'Flange Progress'[PDS Area Final]
        )
    )
)
```

#### `Flange Progress[Sub-Contractor From WD+WR]` — format `nan`

```dax
    VAR SubContractor = 
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona', 
                'Project WD+WR+INCO+Acciona'[PDS Area] = 'Flange Progress'[PDS Area Final]
            ),
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]
        )
    RETURN SubContractor
```

#### `Flange Progress[Dia Inch >60<]` — format `nan`

```dax
IF(
    'Flange Progress'[Diam] < 60, 
    "0-60",
    IF(
        'Flange Progress'[Diam] >= 60 && 'Flange Progress'[Diam] <= 200, 
        "60-199",
        "Greater than 199"
    )
)
```

#### `Flange Progress[Task_Status PIP-018-A "VPR"]` — format `nan`

```dax
VAR Task_Status = 
    MAXX(
        FILTER(
            'SCDB Data l0_scdb_task', 
            'SCDB Data l0_scdb_task'[TAG] = 'Flange Progress'[Test Pack]
        ),
        // Возвращаем "Closed" (1), только если статус действительно "closed"
        IF('SCDB Data l0_scdb_task'[Task_Status] = "Closed", 1, 0)
    )

RETURN 
    // Если MAXX нашла хотя бы одно "closed" (т.е. вернула 1), 
    // возвращаем текст "Closed", иначе BLANK()
    IF(Task_Status = 1, "Closed", BLANK())
```

#### `Flange Progress[Loose Bolts Description]` — format `nan`

```dax
VAR CurrentTestPack = 'Flange Progress'[Test Pack] // Получаем текущий Test Pack
VAR MatchingPunch =
    CALCULATE(
        // Нам нужен MAX, чтобы вернуть любую найденную строку-описание
        MAX('Testpack-wise Details Report'[Punch Description]),
        FILTER(
            ALL('Testpack-wise Details Report'), // Игнорируем внешние фильтры, кроме явно заданных
            'Testpack-wise Details Report'[TEST PACK] = CurrentTestPack
            && (
                // УСЛОВИЕ 1: ТОЧНОЕ СОВПАДЕНИЕ
                'Testpack-wise Details Report'[Punch Description] = "LOOSE BOLTS FLANGE"
                ||
                // УСЛОВИЕ 2: ЧАСТИЧНОЕ СОВПАДЕНИЕ
                CONTAINSSTRING('Testpack-wise Details Report'[Punch Description], "LOOSE BOLTS")
            )
        )
    )
RETURN
    // Возвращаем найденное описание, если оно не BLANK
    IF(
        NOT ISBLANK(MatchingPunch),
        MatchingPunch,
        BLANK()
    )
```

#### `Flange Progress[Test Completed Date]` — format `dd-mmm-yy`

```dax
    VAR TestDate = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Flange Progress'[Test Pack]
            ),
            'Testpack-wise Details Report'[Test Completed Date]
        )
    RETURN TestDate
```

#### `Flange Progress[Reinstatement Completed Date]` — format `dd-mmm-yy`

```dax
    VAR ReinstatementDate = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Flange Progress'[Test Pack]
            ),
            'Testpack-wise Details Report'[Reinstatement Completed Date]
        )
    RETURN ReinstatementDate
```

#### `Flange Progress[Test Status]` — format `nan`

```dax
IF(NOT(ISBLANK('Flange Progress'[Test Completed Date])), "Tested", BLANK())
```

#### `Flange Progress[Reinstatement Status]` — format `nan`

```dax
IF(NOT(ISBLANK('Flange Progress'[Reinstatement Completed Date])), "Reinstatement", BLANK())
```

#### `Flange Progress[WeldPoint No.1 WP1]` — format `0`

```dax
VAR CurrentWP = 'Flange Progress'[Index]
VAR CurrentJointID = 'Flange Progress'[Joint ID]
RETURN
    COUNTROWS(
        FILTER(
            'Flange Progress',
            'Flange Progress'[Joint ID] = CurrentJointID &&
            'Flange Progress'[Index] < CurrentWP
        )
    ) + 1
```

#### `Flange Progress[Joint ID Max Joint_Date]` — format `nan`

```dax
VAR CurrentID = 'Flange Progress'[Joint ID]
VAR CurrentDate = 'Flange Progress'[Joint Date]

-- 1. Находим максимальную дату для текущего Joint ID
VAR MaxDate =
    CALCULATE(
        MAX('Flange Progress'[Joint Date]),
        ALLEXCEPT('Flange Progress', 'Flange Progress'[Joint ID])
    )

-- 2. Проверяем, есть ли дубликаты (для Условия 3)
VAR IsDuplicate =
    CALCULATE(
        COUNTROWS('Flange Progress'),
        ALLEXCEPT('Flange Progress', 'Flange Progress'[Joint ID])
    ) > 1

-- 3. Проверяем, есть ли среди дубликатов запись с пустой датой (для Условия 2)
VAR HasBlankDate =
    CALCULATE(
        COUNTROWS('Flange Progress'),
        ALLEXCEPT('Flange Progress', 'Flange Progress'[Joint Date]),
        'Flange Progress'[Joint ID] = CurrentID,
        ISBLANK('Flange Progress'[Joint Date])
    ) > 0

-- 4. Определяем, является ли текущая строка ПРИОРИТЕТНОЙ (Условия 1 и 2)
VAR IsPriorityRow =
    IF(
        -- Если найдена BLANK (Условие 2), приоритет у строки, у которой BLANK
        HasBlankDate,
        ISBLANK(CurrentDate),

        -- Иначе (нет BLANK или нет дубликатов), приоритет у строки с MAX датой (Условие 1)
        CurrentDate = MaxDate
    )

-- 5. Возвращаем результат
RETURN
    IF(
        NOT IsDuplicate,
        CurrentID, -- Условие 3: Не дубликат, возвращаем Joint ID.
        IF(
            IsPriorityRow,
            CurrentID, -- Если дубликат И это приоритетная строка, возвращаем Joint ID.
            BLANK()    -- Если дубликат И это НЕ приоритетная строка, возвращаем BLANK.
        )
    )
```

#### `Flange Progress[Duplicate Joint ID]` — format `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Flange Progress'[WeldPoint No.1 WP1]),
    ALLEXCEPT('Flange Progress', 'Flange Progress'[Joint ID])
)
```

#### `Flange Progress[Flange ID from SCDB 1510 VPR]` — format `nan`

```dax
VAR CurrentFlangeSubcontractor = 'Flange Progress'[Flange Subcontractor]

VAR SearchResultID = 
    IF(
        CurrentFlangeSubcontractor <> "CCC", -- Если субподрядчик НЕ "CCC", выполняем поиск
        MAXX(
            FILTER(
                'Flange ovAssets_1510', 
                'Flange ovAssets_1510'[Joint ID] = 'Flange Progress'[Joint ID]
            ),
            'Flange ovAssets_1510'[Joint ID]
        )
    ) -- Если субподрядчик = "CCC", IF возвращает BLANK() (неявное значение else)

RETURN
    IF(
        CurrentFlangeSubcontractor = "CCC",
        BLANK(), -- ЕСЛИ "CCC", то возвращаем BLANK() (как вы и просили)
        IF(
            ISBLANK(SearchResultID),
            "Not Found", -- Если не "CCC", но поиск не дал результата, то "Not Found"
            SearchResultID -- Если не "CCC" и результат найден
        )
    )
```

#### `Flange Progress[HA CWA]` — format `nan`

```dax
    LOOKUPVALUE(
        'HA l0_abs_guide'[Handover Area], 
        'HA l0_abs_guide'[Location Number], 'Flange Progress'[PDS Area Final]
    )
```

### Table `Flange ovAssets_1510` (2 calculated columns)

#### `Flange ovAssets_1510[Flange ID from EP VPR]` — format `nan`

```dax
VAR ResultID = 
    MAXX(
        FILTER(
            'Flange Progress', 
            'Flange Progress'[Joint ID] = 'Flange ovAssets_1510'[Joint ID]
        ),
        'Flange Progress'[Joint ID]
    )

RETURN
    IF(
        ISBLANK(ResultID),
        "Not Found",
        ResultID
    )
```

#### `Flange ovAssets_1510[HA]` — format `nan`

```dax
VAR SystemVal = 'Flange ovAssets_1510'[System]
VAR SecondDigit = MID(SystemVal, 2, 1)

RETURN
IF (
    ISBLANK(SystemVal) || SystemVal = "System-NA - Not Applicable",
    -- Если пусто или NA, выполняем поиск
    LOOKUPVALUE(
        'HA l0_abs_guide'[Handover Area], 
        'HA l0_abs_guide'[Location Number], 'Flange ovAssets_1510'[PDS Area]
    ),
    -- Если System заполнена, проверяем вторую цифру
    SWITCH (
        SecondDigit,
        "1", "HA1",
        "2", "HA2",
        "3", "HA3",
        "4", "HA4",
        -- Результат, если вторая цифра не 1-4 (опционально)
        LOOKUPVALUE(
            'HA l0_abs_guide'[Handover Area], 
            'HA l0_abs_guide'[Location Number], 'Flange ovAssets_1510'[PDS Area]
        )
    )
)
```

### Table `Flg Onepager_data` (1 calculated columns)

#### `Flg Onepager_data[Week_End_Date from Calendar]` — format `dd-mmm-yy`

```dax
MAXX(
    FILTER(
        'Calendar', 
        'Calendar'[Date] = 'Flg Onepager_data'[Date]
    ),
    'Calendar'[Week_End_Date]
)
```

### Table `PIC_vs_Talisman_2026_02_16` (2 calculated columns)

#### `PIC_vs_Talisman_2026_02_16[Joint ID QC Data Project WD+WR+INCO+Acciona]` — format `nan`

```dax
VAR Result = 
    CALCULATE(
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = SELECTEDVALUE('PIC_vs_Talisman_2026_02_16'[Joint_ID])
                    && 'Project WD+WR+INCO+Acciona'[Joint ID] <> ""
            ),
            'Project WD+WR+INCO+Acciona'[Joint ID]
        )
    )
RETURN 
    IF(ISBLANK(Result), "Not Found", Result)
```

#### `PIC_vs_Talisman_2026_02_16[RT Report QC Data Project WD+WR+INCO+Acciona]` — format `nan`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[RT Report] = VALUES('PIC_vs_Talisman_2026_02_16'[Report_No])
                && 'Project WD+WR+INCO+Acciona'[RT Report] <>""
        ),
        'Project WD+WR+INCO+Acciona'[RT Report]
    )
)
```

### Table `Project WD+WR` (29 calculated columns)

#### `Project WD+WR[No of Days "PR"]` — format `0`

```dax
DATEDIFF([Weld Date], TODAY(), DAY)
```

#### `Project WD+WR[Last_Weld Date "PR"]` — format `d mmmm\, yyyy`

```dax
LASTDATE('Project WD+WR'[Weld Date])
```

#### `Project WD+WR[Days Since Last Weld "PR"]` — format `nan`

```dax
IF(ISBLANK([Last_Weld Date "PR"]),BLANK(),
VALUE([Cur_Date "PR"]-[Last_Weld Date "PR"]))
```

#### `Project WD+WR[RT Film Ratio % "PR" For Welder]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR', 'Project WD+WR'[Welder ID])
    ),
    CALCULATE(
        SUM('Project WD+WR'[RT Film Total]),'Project WD+WR'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR', 'Project WD+WR'[Welder ID])
    )
) * 1
```

#### `Project WD+WR[Repair & Reweld "PR"]` — format `nan`

```dax
if(right('Project WD+WR'[Joint ID],2)="R1","Repair",
if(right('Project WD+WR'[Joint ID],2)="R2","Repair",
if(right('Project WD+WR'[Joint ID],2)="RW","Reweld",
if('Project WD+WR'[Repair Suffix]="RW1","Reweld",
if('Project WD+WR'[Repair Suffix]="RS1","RS1")))))
```

#### `Project WD+WR[RT FILM Ratio % STATUS "PR"]` — format `nan`

```dax
 IF (
    'Project WD+WR'[RT Film Ratio % "PR" For Welder] >= 0 && 'Project WD+WR'[RT Film Ratio % "PR" For Welder] < 0.05,
    "1. 0 to 5% - ok",
    IF (
        'Project WD+WR'[RT Film Ratio % "PR" For Welder] >= 0.05 && 'Project WD+WR'[RT Film Ratio % "PR" For Welder] < 0.075,
        "2. 5 to 7.5%-monitor",
        IF (
            'Project WD+WR'[RT Film Ratio % "PR" For Welder] >= 0.075 && 'Project WD+WR'[RT Film Ratio % "PR" For Welder] < 0.10,
            "3. 7.5 to 10%-Critical",
            IF (
                'Project WD+WR'[RT Film Ratio % "PR" For Welder] >= 0.10 && 'Project WD+WR'[RT Film Ratio % "PR" For Welder] <= 1,
                "4. 10 to 100% - Disq.F",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR[PWHT Y/N CCC]` — format `nan`

```dax
IF(
    'Project WD+WR'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR PWHT_Value = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = 'Project WD+WR'[Joint ID] &&
                'Project WD+WR'[Sub-Contractor] = "CCC"
            ),
            'AllTrain_CSVExport_Joint Record'[PWHT]
        )
    RETURN
        IF(
            ISBLANK(PWHT_Value),
            "N",
            PWHT_Value
        )
)
```

#### `Project WD+WR[PWHT Report No CCC]` — format `nan`

```dax
IF(
    'Project WD+WR'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR PWHT_Report = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = 'Project WD+WR'[Joint ID]
            ),
            'AllTrain_CSVExport_Joint Record'[PWHT Report No]
        )
    RETURN
        PWHT_Report
)
```

#### `Project WD+WR[PWHT Date No CCC]` — format `d mmmm\, yyyy`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PWHT] = "Y"
        ),
        'AllTrain_CSVExport_Joint Record'[PWHT Date]
    )
)
```

#### `Project WD+WR[Joint Uniq "PR" Total]` — format `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR'[Joint ID]))
```

#### `Project WD+WR[MT Report CCC]` — format `nan`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root Report No]
    )
)
```

#### `Project WD+WR[MT Date CCC]` — format `dd-mmm-yy`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[MT Root Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root Date]
    )
)
```

#### `Project WD+WR[MT% CCC]` — format `0`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root(%)]
    )
)
```

#### `Project WD+WR[Total Welded Dia "PR" Table]` — format `nan`

```dax
CALCULATE(SUM('Project WD+WR'[Dia inch]),
'Project WD+WR'[Weld Date]>0)
```

#### `Project WD+WR[% of Total Reject]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    SUM('Project WD+WR'[Total No of films Rej]),
    SUM('Project WD+WR'[RT Film Total]))
```

#### `Project WD+WR[Last Spool Status "WD"]` — format `nan`

```dax
LOOKUPVALUE('Weld Dump'[Last Status],
'Weld Dump'[Joint ID],'Project WD+WR'[Joint ID])
```

#### `Project WD+WR[LINE]` — format `nan`

```dax
MID('Project WD+WR'[ISO Number], 9, LEN('Project WD+WR'[ISO Number]))
```

#### `Project WD+WR[RT Film Ratio % "PR" For SERVICE Class]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR', 'Project WD+WR'[Service Class + Service Cat+NDT Remarks])
    ),
    CALCULATE(
        SUM('Project WD+WR'[RT Film Total]),'Project WD+WR'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR', 'Project WD+WR'[Service Class + Service Cat+NDT Remarks])
    )
) * 1
```

#### `Project WD+WR[RT FILM Ratio % STATUS for Service Class "PR"]` — format `nan`

```dax
 IF (
    'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class] >= 0 && 'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class] < 0.02,
    "1. 0 to 2% - ok",
    IF (
        'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class] >= 0.02 && 'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class] < 0.04,
        "2. 2 to 4%-monitor",
        IF (
            'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class] >= 0.04 && 'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class] < 0.05,
            "3. 4 to 5%-Critical",
            IF (
                'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class] >= 0.05 && 'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class] <= 1,
                "4. 5 to 100% - Action",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR', 'Project WD+WR'[Service Class + Service Cat+NDT Remarks],'Project WD+WR'[Sub-Contractor])
    ),
    CALCULATE(
        SUM('Project WD+WR'[RT Film Total]),'Project WD+WR'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR', 'Project WD+WR'[Service Class + Service Cat+NDT Remarks],'Project WD+WR'[Sub-Contractor])
    )
) * 1
```

#### `Project WD+WR[RT FILM Ratio % STATUS for Service Class By SUBCON "PR"]` — format `nan`

```dax
 IF (
    'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"] >= 0 && 'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"] < 0.02,
    "1. 0 to 2% - ok",
    IF (
        'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"] >= 0.02 && 'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"] < 0.04,
        "2. 2 to 4%-monitor",
        IF (
            'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"] >= 0.04 && 'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"] < 0.05,
            "3. 4 to 5%-Critical",
            IF (
                'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"] >= 0.05 && 'Project WD+WR'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR"] <= 1,
                "4. 5 to 100% - Action",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR[RT Ratio % For Welder (<5% ; >5%) "PR"]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR'[Joint ID]),
        'Project WD+WR'[RT Report] <> "",'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR', 'Project WD+WR'[Welder])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR'[Joint ID]),
        'Project WD+WR'[Weld Date] > 0,'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR', 'Project WD+WR'[Welder])
    )
) * 1
```

#### `Project WD+WR[RT Ratio % STATUS for Welder Cover 5% "PR"]` — format `nan`

```dax
 IF (
    'Project WD+WR'[RT Ratio % For Welder (<5% ; >5%) "PR"] >= 0.05,
    "1. > 5% - ok",
    IF (
        'Project WD+WR'[RT Ratio % For Welder (<5% ; >5%) "PR"] < 0.05 && 'Project WD+WR'[RT Ratio % For Welder (<5% ; >5%) "PR"] > 0,
        "2. < 5% - Action",
        IF (
            ISBLANK('Project WD+WR'[RT Ratio % For Welder (<5% ; >5%) "PR"]),
            "3. No RT",
            BLANK()
        )
    )
)
```

#### `Project WD+WR[No of Days Fit-UP - TODAY "PR"]` — format `0`

```dax
IF(
    ISBLANK('Project WD+WR'[Weld Date]),
    DATEDIFF('Project WD+WR'[Fitup Date], TODAY(), DAY),
    BLANK()
)
```

#### `Project WD+WR[No Of Days Fit-UP - Today STATUS "PR"]` — format `nan`

```dax
 IF (
    'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] >= 1 && 'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] <= 7,
    "1. 7 Days",
    IF (
        'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] > 7 && 'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] <= 30,
        "2. 7 to 30 Days",
        IF (
            'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] >30 && 'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] <= 90,
            "3. 30 to 90 Days",
            IF (
                'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] > 90 && 'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] <= 180,
                "4. 90 to 180 Days",
                IF (
                'Project WD+WR'[No of Days Fit-UP - TODAY "PR"] > 180,
                "5. Above 180 Days",
                BLANK()
            )
        )
    )
))
```

#### `Project WD+WR[No of Days Weld Date - TODAY "PR"]` — format `0`

```dax
IF(
    ISBLANK('Project WD+WR'[RT Date]) && 
    'Project WD+WR'[Weld Type]IN{"BW","GW","CLET","MW"} && 
    CONTAINSROW({"H","HS","HS CCC","SS","T","T1","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"}, 'Project WD+WR'[RT Weld Status]),
    DATEDIFF('Project WD+WR'[Weld Date], TODAY(), DAY),
    BLANK()
)
```

#### `Project WD+WR[No Of Days Weld Date - Today RT STATUS "PR"]` — format `nan`

```dax
 IF (
    'Project WD+WR'[No of Days Weld Date - TODAY "PR"] >= 1 && 'Project WD+WR'[No of Days Weld Date - TODAY "PR"] <= 7,
    "1. 7 Days",
    IF (
        'Project WD+WR'[No of Days Weld Date - TODAY "PR"] > 7 && 'Project WD+WR'[No of Days Weld Date - TODAY "PR"] <= 30,
        "2. 7 to 30 Days",
        IF (
            'Project WD+WR'[No of Days Weld Date - TODAY "PR"] >30 && 'Project WD+WR'[No of Days Weld Date - TODAY "PR"] <= 90,
            "3. 30 to 90 Days",
            IF (
                'Project WD+WR'[No of Days Weld Date - TODAY "PR"] > 90 && 'Project WD+WR'[No of Days Weld Date - TODAY "PR"] <= 180,
                "4. 90 to 180 Days",
                IF (
                'Project WD+WR'[No of Days Weld Date - TODAY "PR"] > 180,
                "5. Above 180 Days",
                BLANK()
            )
        )
    )
))
```

#### `Project WD+WR[Service Class + Service Cat+NDT Remarks]` — format `nan`

```dax
'Project WD+WR'[Service class]&" "&'Project WD+WR'[Service Cat]&" "&'Project WD+WR'[NDT Remarks]
```

#### `Project WD+WR[Welder ID]` — format `nan`

```dax
'Project WD+WR'[Welder]&"-"&'Project WD+WR'[Sub-Contractor]
```

### Table `Project WD+WR+INCO+Acciona` (158 calculated columns)

#### `Project WD+WR+INCO+Acciona[Repair & Reweld "PR all"]` — format `nan`

```dax
  IF (
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "Inco",
    IF (
        RIGHT ( 'Project WD+WR+INCO+Acciona'[Joint ID], 2 ) = "R1",
        "Repair",
        IF (
            RIGHT ( 'Project WD+WR+INCO+Acciona'[Joint ID], 2 ) = "R2",
            "Repair",
            IF (
                RIGHT ( 'Project WD+WR+INCO+Acciona'[Joint ID], 2 ) = "RW",
                "Reweld",
                IF (
                    'Project WD+WR+INCO+Acciona'[Repair Suffix] = "RW1",
                    "Reweld", 
                    IF (
                        'Project WD+WR+INCO+Acciona'[Repair Suffix] = "RS1",
                        "RS1",
                
                        ""
                    )
                )
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[No of Days "PR all"]` — format `0`

```dax
DATEDIFF([Weld Date], TODAY(), DAY)
```

#### `Project WD+WR+INCO+Acciona[Last_Weld Date "PR all"]` — format `d mmmm\, yyyy`

```dax
LASTDATE('Project WD+WR+INCO+Acciona'[Weld Date])
```

#### `Project WD+WR+INCO+Acciona[Days Since Last Weld]` — format `nan`

```dax
IF(ISBLANK([Last_Weld Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[Last_Weld Date "PR all"]))
```

#### `Project WD+WR+INCO+Acciona[RT Film Ratio % "PR all" For Welder]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[RT FILM Ratio % STATUS "PR all"]` — format `nan`

```dax
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] >= 0 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] < 0.05,
        "1. 0 to 5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] >= 0.05 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] < 0.075,
            "2. 5 to 7.5% - monitor",
            IF (
                'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] >= 0.075 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] < 0.10,
                "3. 7.5 to 10% - Critical",
                IF (
                    'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] >= 0.10 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder] <= 1,
                    "4. 10 to 100% - Disq.F",
                    BLANK()
                )
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[PWHT Y/N CCC]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR PWHT_Value = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = 'Project WD+WR+INCO+Acciona'[Joint ID] &&
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC"
            ),
            'AllTrain_CSVExport_Joint Record'[PWHT]
        )
    RETURN
        IF(
            ISBLANK(PWHT_Value),
            "N",
            PWHT_Value
        )
)
```

#### `Project WD+WR+INCO+Acciona[PWHT Report No CCC]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR PWHT_Report = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = 'Project WD+WR+INCO+Acciona'[Joint ID]
            ),
            'AllTrain_CSVExport_Joint Record'[PWHT Report No]
        )
    RETURN
        PWHT_Report
)
```

#### `Project WD+WR+INCO+Acciona[PWHT Date No CCC]` — format `d mmmm\, yyyy`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
        ),
        'AllTrain_CSVExport_Joint Record'[PWHT Date]
    )
)
```

#### `Project WD+WR+INCO+Acciona[MT Report CCC]` — format `nan`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[MT Root Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root Report No]
    )
)
```

#### `Project WD+WR+INCO+Acciona[MT Date CCC]` — format `d mmmm\, yyyy`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[MT Root Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root Date]
    )
)
```

#### `Project WD+WR+INCO+Acciona[MT% CCC]` — format `0`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[MT Root(%)]
    )
)
```

#### `Project WD+WR+INCO+Acciona[Total Welded Dia "PR all" Table]` — format `nan`

```dax
CALCULATE(SUM('Project WD+WR+INCO+Acciona'[Dia inch]),
'Project WD+WR+INCO+Acciona'[Weld Date]>0)
```

#### `Project WD+WR+INCO+Acciona[% of Total Reject]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]))
```

#### `Project WD+WR+INCO+Acciona[Service Class + Service Cat+NDT Remarks]` — format `nan`

```dax
'Project WD+WR+INCO+Acciona'[Service class]&" "&'Project WD+WR+INCO+Acciona'[Service Cat]&" "&'Project WD+WR+INCO+Acciona'[NDT Remarks]&" "&'Project WD+WR+INCO+Acciona'[RT%]
```

#### `Project WD+WR+INCO+Acciona[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks],'Project WD+WR+INCO+Acciona'[Sub-Contractor])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks],'Project WD+WR+INCO+Acciona'[Sub-Contractor])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[RT FILM Ratio % STATUS for Service Class By SUBCON "PR all"]` — format `nan`

```dax
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] >= 0 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] < 0.02,
        "1. 0 to 2% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] >= 0.02 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] < 0.04,
            "2. 2 to 4% - monitor",
            IF (
                'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] >= 0.04 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] < 0.05,
                "3. 4 to 5% - Critical",
                IF (
                    'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] >= 0.05 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR" For SERVICE Class BY SUBCON "PR all"] <= 1,
                    "4. 5 to 100% - Action",
                    BLANK()
                )
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[RT Ratio % For Welder (<5% ; >5%) "PR all"]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[RT Report] <> "",'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[RT Ratio % STATUS for Welder Cover 5% "PR all"]` — format `nan`

```dax
IF (
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Welder (<5% ; >5%) "PR all"] >= 0.05, 
    "1. > 5% - ok",
    IF (
        'Project WD+WR+INCO+Acciona'[RT Ratio % For Welder (<5% ; >5%) "PR all"] < 0.05 && 
        'Project WD+WR+INCO+Acciona'[RT Ratio % For Welder (<5% ; >5%) "PR all"] > 0, 
        "2. < 5% - Action",
        IF (
            ISBLANK('Project WD+WR+INCO+Acciona'[RT Ratio % For Welder (<5% ; >5%) "PR all"]) && 
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"} && 
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            "3. No RT",
            BLANK()
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[No of Days Fit-UP - TODAY "PR all"]` — format `0`

```dax
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[Weld Date]),
    DATEDIFF('Project WD+WR+INCO+Acciona'[Fitup Date], TODAY(), DAY),
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[No Of Days Fit-UP - Today STATUS "PR all"]` — format `nan`

```dax
 IF (
    'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] >= 1 && 'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] <= 7,
    "1. 7 Days",
    IF (
        'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] > 7 && 'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] <= 30,
        "2. 7 to 30 Days",
        IF (
            'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] >30 && 'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] <= 90,
            "3. 30 to 90 Days",
            IF (
                'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] > 90 && 'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] <= 180,
                "4. 90 to 180 Days",
                IF (
                'Project WD+WR+INCO+Acciona'[No of Days Fit-UP - TODAY "PR all"] > 180,
                "5. Above 180 Days",
                BLANK()
            )
        )
    )
))
```

#### `Project WD+WR+INCO+Acciona[No of Days Weld Date - TODAY "PR all"]` — format `0`

```dax
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Date]) && 
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"} && 
    CONTAINSROW(
        {"H","HS","HS CCC","SS","T","T1","T1S","T1-1","T1-1S","T1-2S","T1S","T2","T3","T2-1","T2-1S","T2-2S","T2S"}, 
        'Project WD+WR+INCO+Acciona'[RT Weld Status]
    ),
    DATEDIFF('Project WD+WR+INCO+Acciona'[Weld Date], TODAY(), DAY),
    IF(
        'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW","GW","CLET","MW"} &&
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0 &&
        'Project WD+WR+INCO+Acciona'[RT%] = 100 &&
        'Project WD+WR+INCO+Acciona'[RT Report] = "" &&
        'Project WD+WR+INCO+Acciona'[RT Weld Status] IN {"?", ""},
        DATEDIFF('Project WD+WR+INCO+Acciona'[Weld Date], TODAY(), DAY),
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[No Of Days Weld Date - Today RT STATUS "PR all"]` — format `nan`

```dax
 IF (
    'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] >= 1 && 'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] <= 7,
    "1. 7 Days",
    IF (
        'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] > 7 && 'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] <= 30,
        "2. 7 to 30 Days",
        IF (
            'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] >30 && 'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] <= 90,
            "3. 30 to 90 Days",
            IF (
                'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] > 90 && 'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] <= 180,
                "4. 90 to 180 Days",
                IF (
                'Project WD+WR+INCO+Acciona'[No of Days Weld Date - TODAY "PR all"] > 180,
                "5. Above 180 Days",
                BLANK()
            )
        )
    )
))
```

#### `Project WD+WR+INCO+Acciona[Welder ID]` — format `nan`

```dax
'Project WD+WR+INCO+Acciona'[Welder]&"-"&'Project WD+WR+INCO+Acciona'[Sub-Contractor]
```

#### `Project WD+WR+INCO+Acciona[Joint Uniq "PR all" Column]` — format `0`

```dax
CALCULATE(DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]))
```

#### `Project WD+WR+INCO+Acciona[Last_RT Date "PR all"]` — format `dd-mmm-yy`

```dax
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[Manual UT Date.]),
    LASTDATE('Project WD+WR+INCO+Acciona'[RT Date]),
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[Days Since Last RT]` — format `0`

```dax
IF(ISBLANK([Last_RT Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[Last_RT Date "PR all"]))
```

#### `Project WD+WR+INCO+Acciona[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}
        )
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[RT FILM Ratio % STATUS LAST 2 WEEKS]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.05,
        "1. 0 to 5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.05 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.075,
            "2. 5 to 7.5% - monitor",
            IF (
                'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.075 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.10,
                "3. 7.5 to 10% - Critical",
                IF (
                    'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.10 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 2 WEEKS] <= 1,
                    "4. 10 to 100% - Disq.F",
                    BLANK()
                )
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[2 weeks Period for RT]` — format `nan`

```dax
IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 07, 28), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 08, 11)
        ),
        "1. 28-Jul-23 to 11-Aug-23",
IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 08, 11), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 08, 25)
        ),
        "2. 11-Aug-23 to 25-Aug-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 08, 25), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 09, 8)
        ),
        "3. 25-Aug-23 to 8-Sep-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 09, 8), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 09, 22)
        ),
        "4. 8-Sep-23 to 22-Sep-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 09, 22), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 10, 6)
        ),
        "5. 22-Sep-23 to 6-Oct-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 10, 6), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 10, 20)
        ),
        "6. 6-Oct-23 to 20-Oct-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 10, 20), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 11, 3)
        ),
        "7. 20-Oct-23 to 3-Nov-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 11, 3), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 11, 17)
        ),
        "8. 3-Nov-23 to 17-Nov-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 11, 17), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 12, 1)
        ),
        "9. 17-Nov-23 to 1-Dec-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 12, 1), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 12, 15)
        ),
        "10. 1-Dec-23 to 15-Dec-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 12, 15), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2023, 12, 29)
        ),
        "11. 15-Dec-23 to 29-Dec-23",
  IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2023, 12, 29), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 1, 12)
        ),
        "12. 29-Dec-23 to 12-Jan-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 1, 12), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 1, 26)
        ),
        "13. 12-Jan-24 to 26-Jan-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 1, 26), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 2, 9)
        ),
        "14. 26-Jan-24 to 09-Feb-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 2, 9), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 2, 23)
        ),
        "15. 09-Feb-24 to 23-Feb-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 2, 23), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 3, 8)
        ),
        "16. 23-Feb-24 to 8-Mar-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 3, 8), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 3, 22)
        ),
        "17. 8-Mar-24 to 22-Mar-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 3, 22), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 4, 5)
        ),
        "18. 22-Mar-24 to 5-Apr-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 4, 5), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 4, 19)
        ),
        "19. 5-Apr-24 to 19-Apr-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 4, 19), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 5, 3)
        ),
        "20. 19-Apr-24 to 3-May-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 5, 3), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 5, 17)
        ),
        "21. 3-May-24 to 17-May-24",
    IF (
        AND(
            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 5, 17), 
            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 5, 31)
        ),
        "22. 17-May-24 to 31-May-24",
     IF (
            AND(
                'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 5, 31), 
                'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 6, 14)
            ),
            "23. 31-May-24 to 14-Jun-24",
            IF (
                AND(
                    'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 6, 14), 
                    'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 6, 28)
                ),
                "24. 14-Jun-24 to 28-Jun-24",
                IF (
                    AND(
                        'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 6, 28), 
                        'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 7, 12)
                    ),
                    "25. 28-Jun-24 to 12-Jul-24",
                    IF (
                        AND(
                            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 7, 12), 
                            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 7, 26)
                        ),
                        "26. 12-Jul-24 to 26-Jul-24",
                        IF (
                            AND(
                                'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 7, 26), 
                                'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 8, 9)
                            ),
                            "27. 26-Jul-24 to 9-Aug-24",
                            IF (
                                AND(
                                    'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 8, 9), 
                                    'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 8, 23)
                                ),
                                "28. 9-Aug-24 to 23-Aug-24",
                                IF (
                                    AND(
                                        'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 8, 23), 
                                        'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 9, 6)
                                    ),
                                    "29. 23-Aug-24 to 6-Sep-24",
                                    IF (
                                        AND(
                                            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 9, 6), 
                                            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 9, 20)
                                        ),
                                        "30. 6-Sep-24 to 20-Sep-24",
                                        IF (
                                            AND(
                                                'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 9, 20), 
                                                'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 10, 4)
                                            ),
                                            "31. 20-Sep-24 to 4-Oct-24",
                                            IF (
                                                AND(
                                                    'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 10, 4), 
                                                    'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 10, 18)
                                                ),
                                                "32. 4-Oct-24 to 18-Oct-24",
                                                IF (
                                                    AND(
                                                        'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 10, 18), 
                                                        'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 11, 1)
                                                    ),
                                                    "33. 18-Oct-24 to 1-Nov-24",
                                                    IF (
                                                        AND(
                                                            'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 11, 1), 
                                                            'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 11, 15)
                                                        ),
                                                        "34. 1-Nov-24 to 15-Nov-24",
                                                        IF (
                                                            AND(
                                                                'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 11, 15), 
                                                                'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 11, 29)
                                                            ),
                                                            "35. 15-Nov-24 to 29-Nov-24",
                                                            IF (
                                                                AND(
                                                                    'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 11, 29), 
                                                                    'Project WD+WR+INCO+Acciona'[RT Date] < date(2024, 12, 13)
                                                                ),
                                                                "36. 29-Nov-24 to 13-Dec-24",
                                                                IF (
                                                                    'Project WD+WR+INCO+Acciona'[RT Date] >= date(2024, 12, 13), 
                                                                    "37. 13-Dec-24 to 27-Dec-24")))))))))))))))))))))))))))))))))))))
```

#### `Project WD+WR+INCO+Acciona[Report TYPE]` — format `nan`

```dax
IF('Project WD+WR+INCO+Acciona'[RT Report] <> "" && 'Project WD+WR+INCO+Acciona'[RT/UT] <> "UT", "RT",
IF('Project WD+WR+INCO+Acciona'[UT Report]<>"","UT",
IF('Project WD+WR+INCO+Acciona'[RT/UT]="UT","UT",
IF('Project WD+WR+INCO+Acciona'[PT Report]<>"","PT",
IF('Project WD+WR+INCO+Acciona'[PMI Report]<>"","PMI",
IF('Project WD+WR+INCO+Acciona'[PWHT Report]<>"","PWHT",
IF('Project WD+WR+INCO+Acciona'[PWHT Report No CCC]<>"","PWHT",
IF('Project WD+WR+INCO+Acciona'[MT Report]<>"","MT",
IF('Project WD+WR+INCO+Acciona'[MT Report CCC]<>"","MT")))))))))
```

#### `Project WD+WR+INCO+Acciona[TMCP Pipe]` — format `nan`

```dax
    IF('Project WD+WR+INCO+Acciona'[Service class]="9C3AQN" &&
    'Project WD+WR+INCO+Acciona'[Dia inch]IN{30, 34, 46},
    "TMCP Pipe")
```

#### `Project WD+WR+INCO+Acciona[Weld Length "PR all"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco" &&
    'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
    'Project WD+WR+INCO+Acciona'[Weld Length] / 1000,
    IF(
        ISBLANK(
            LOOKUPVALUE(
                'Weld Length'[Weld Length],
                'Weld Length'[Dia inch], 
                'Project WD+WR+INCO+Acciona'[Dia inch]
            )
        ),
        BLANK(),
        LOOKUPVALUE(
            'Weld Length'[Weld Length],
            'Weld Length'[Dia inch], 
            'Project WD+WR+INCO+Acciona'[Dia inch]
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[PWHT Status PR ALL]` — format `nan`

```dax
    IF('Project WD+WR+INCO+Acciona'[PWHT Y/N]="Y","Y",
IF('Project WD+WR+INCO+Acciona'[PWHT Y/N]="N","N",
IF('Project WD+WR+INCO+Acciona'[PWHT Y/N]="25.01","25.01",
IF('Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="Y","Y",
IF('Project WD+WR+INCO+Acciona'[PWHT Y/N CCC]="N","N")))))
```

#### `Project WD+WR+INCO+Acciona[TESTPACK No "PR All"]` — format `nan`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR TPCCCID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record',
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = CurrentJointID
            ),
            'AllTrain_CSVExport_Joint Record'[Test Package No]
        )
    )

VAR MaxTestPackageNoOther = 
    MAXX(
        FILTER(
            'Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
        ),
        'Project WD+WR+INCO+Acciona'[Testpack No]
    )

RETURN
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        IF(
            ISBLANK(TPCCCID),
            BLANK(),
            TPCCCID
        ),
        IF(
            ISBLANK(MaxTestPackageNoOther),
            BLANK(),
            MaxTestPackageNoOther
        )
    )
```

#### `Project WD+WR+INCO+Acciona[TP Ratio % Complete "PR all"]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[TP Ratio % STATUS]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] >= 0 && 'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] < 0.5,
        "1. 0 to 50%",
        IF (
            'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] >= 0.5 && 'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] < 0.8,
            "2. 50 to 80%",
            IF (
                'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] >= 0.8 && 'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] < 0.99,
                "3. 80 to 99%",
                IF (
                    'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] >= 0.99 && 'Project WD+WR+INCO+Acciona'[TP Ratio % Complete "PR all"] <= 1,
                    "4. 100%",
                    BLANK()
                )
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[UT Report "PR All"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[UT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[UT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC", 
        LOOKUPVALUE(
            'UT TRACKER (CCC)_Talisman'[UT1 REP NO],
            'UT TRACKER (CCC)_Talisman'[Joint ID], 
            'Project WD+WR+INCO+Acciona'[Joint ID]
        ), 
        IF(
            'Project WD+WR+INCO+Acciona'[RT/UT] = "UT",
            'Project WD+WR+INCO+Acciona'[RT Report],
            BLANK()
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[UT Ratio % For Welder (<5% ; >5%) "PR all"]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Weld Date] > 0,'Project WD+WR+INCO+Acciona'[Weld Type]IN{"BW","GW","CLET","MW"},
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[UT Operator ID.]` — format `nan`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Operator ID]),
                'Project WD+WR+INCO+Acciona'[UT Operator ID],
                'Project WD+WR+INCO+Acciona'[UT Operator ID]
            )
        )
    )
VAR UTTrackerTEKID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Operator ID]),
                'Project WD+WR+INCO+Acciona'[UT Operator ID],
                'Project WD+WR+INCO+Acciona'[UT Operator ID]
            )
        )
    )
VAR UTTrackerINCOID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Operator ID]),
                'Project WD+WR+INCO+Acciona'[UT Operator ID],
                'Project WD+WR+INCO+Acciona'[UT Operator ID]
            )
        )
    )
VAR UTTrackerCCCID = 
CALCULATE(
        LOOKUPVALUE('UT TRACKER (CCC)_Talisman'[UT Operator ID.], 'UT TRACKER (CCC)_Talisman'[Joint ID], CurrentJointID),
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        'Project WD+WR+INCO+Acciona'[RT/UT] = "UT"
            )
RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            IF(
                NOT ISBLANK(UTTrackerINCOID),
                UTTrackerINCOID,
                IF(
                    NOT ISBLANK(UTTrackerCCCID),
                    UTTrackerCCCID,
                    BLANK()
                )
            )
        )
    )
```

#### `Project WD+WR+INCO+Acciona[Manual UT Date.]` — format `mmmm d\, yyyy`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Date "PR All"]),
                'Project WD+WR+INCO+Acciona'[Manual UT Date],
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"]
            )
        )
    )
VAR UTTrackerTEKID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Date "PR All"]),
                'Project WD+WR+INCO+Acciona'[Manual UT Date],
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"]
            )
        )
    )
VAR UTTrackerINCOID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Date "PR All"]),
                'Project WD+WR+INCO+Acciona'[UT Date],
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"]
            )
        )
    )
VAR UTTrackerCCCID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Date "PR All"]),
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"],
                'Project WD+WR+INCO+Acciona'[UT Date "PR All"]
            )
        )
    )

RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            IF(
                NOT ISBLANK(UTTrackerINCOID),
                UTTrackerINCOID,
                IF(
                    NOT ISBLANK(UTTrackerCCCID),
                    UTTrackerCCCID,
                    BLANK()
                )
            )
        )
    )
```

#### `Project WD+WR+INCO+Acciona[Manual UT Report No.]` — format `nan`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Report "PR All"]),
                'Project WD+WR+INCO+Acciona'[Manual UT Report No],
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"]
            )
        )
    )

VAR UTTrackerTEKID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Report "PR All"]),
                'Project WD+WR+INCO+Acciona'[Manual UT Report No],
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"]
            )
        )
    )

VAR UTTrackerINCOID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Report "PR All"]),
                'Project WD+WR+INCO+Acciona'[UT Report],
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"]
            )
        )
    )

VAR UTTrackerCCCID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        MAXX(
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            ),
            IF(
                ISBLANK('Project WD+WR+INCO+Acciona'[UT Report "PR All"]),
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"],
                'Project WD+WR+INCO+Acciona'[UT Report "PR All"]
            )
        )
    )

RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
                    IF(
            NOT ISBLANK(UTTrackerINCOID),
            UTTrackerINCOID,
            IF(
                NOT ISBLANK(UTTrackerCCCID),
                UTTrackerCCCID,
                BLANK()
            )
        )
    )
    )
```

#### `Project WD+WR+INCO+Acciona[Manual UT Status.]` — format `nan`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR CurrentWelderID = 'Project WD+WR+INCO+Acciona'[Welder ID]

VAR UTTrackerGACID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC",
        IF(
            ISBLANK(LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[Manual UT Status], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)
        )
    )

VAR UTTrackerTEKID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN",
        IF(
            ISBLANK(LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[Manual UT Status], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)
        )
    )

VAR UTTrackerINCOID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco",
        IF(
            ISBLANK(LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID),
            LOOKUPVALUE('Project WD+WR+INCO+Acciona'[UT Acc/Rej], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID, 'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID)
        )
    )

VAR UTTrackerCCCID =
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC" && 
        'Project WD+WR+INCO+Acciona'[RT/UT] = "UT",
        VAR RTAccRej = 
            LOOKUPVALUE(
                'Project WD+WR+INCO+Acciona'[RT Acc/Rej], 
                'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID,
                'Project WD+WR+INCO+Acciona'[Welder ID], CurrentWelderID,
                'Project WD+WR+INCO+Acciona'[Sub-Contractor], "CCC",
                'Project WD+WR+INCO+Acciona'[RT/UT], "UT"
            )
        RETURN
            IF(
                NOT ISBLANK(RTAccRej),
                RTAccRej,
                IF(
                    'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC" && 'Project WD+WR+INCO+Acciona'[RT Acc/Rej] = "",
                    LOOKUPVALUE(
                        'UT TRACKER (CCC)_Talisman'[UT1 RESULT], 
                        'UT TRACKER (CCC)_Talisman'[Joint ID], 'Project WD+WR+INCO+Acciona'[Joint ID], CurrentJointID
                    ),
                    BLANK()
                )
            )
    )

RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            IF(
                NOT ISBLANK(UTTrackerINCOID),
                UTTrackerINCOID,
                IF(
                    'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC", 
                    LOOKUPVALUE(
                        'UT TRACKER (CCC)_Talisman'[UT1 RESULT],
                        'UT TRACKER (CCC)_Talisman'[Joint ID], 
                        'Project WD+WR+INCO+Acciona'[Joint ID]
                    ),
                    BLANK()
                )
            )
        )
    )
```

#### `Project WD+WR+INCO+Acciona[Inspected Length(MM).]` — format `nan`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR MaxInspectedLengthFromGAC = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "GAC" && 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Weld Length "PR all"],
        BLANK()
    )
VAR MaxInspectedLengthFromTEK = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "TEKFEN" && 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Weld Length "PR all"],
        BLANK()
    )
VAR MaxInspectedLengthFromCCC = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC" && 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Weld Length "PR all"],
        BLANK()
    )
VAR MaxInspectedLengthFromOthers = 
    IF(
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        CALCULATE(
            MAX('Project WD+WR+INCO+Acciona'[Weld Length "PR all"]),
            FILTER(
                'Project WD+WR+INCO+Acciona',
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "GAC" &&
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "TEKFEN" &&
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC" &&
                'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID
            )
        ),
        BLANK()
    )
RETURN
    IF(
        NOT ISBLANK(MaxInspectedLengthFromGAC),
        MaxInspectedLengthFromGAC,
        IF(
            NOT ISBLANK(MaxInspectedLengthFromTEK),
            MaxInspectedLengthFromTEK,
            IF(
                NOT ISBLANK(MaxInspectedLengthFromCCC),
                MaxInspectedLengthFromCCC,
                MaxInspectedLengthFromOthers
            )
        )
    )
```

#### `Project WD+WR+INCO+Acciona[Defect Length(MM).]` — format `0.0000`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerCCCID = 
    CALCULATE(
        LOOKUPVALUE('UT TRACKER (CCC)_Talisman'[Defect Lenght(MM).],'UT TRACKER (CCC)_Talisman'[Joint ID], CurrentJointID),
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
        'Project WD+WR+INCO+Acciona'[RT/UT] = "UT"
    )
RETURN
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "Inco" && 
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        'Project WD+WR+INCO+Acciona'[Repair Length (mm)]/1000,
        IF(
            'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "" && 
            'Project WD+WR+INCO+Acciona'[By UT] = "Y",
            'Project WD+WR+INCO+Acciona'[Rej Length],
            IF(
                'Project WD+WR+INCO+Acciona'[Manual UT Status.] = "R" &&
                'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
                UTTrackerCCCID,
                0
            )
        )
    )
```

#### `Project WD+WR+INCO+Acciona[Cross Verification-by CTJV (TPI).]` — format `nan`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    CALCULATE(
        MAXX(
            FILTER(
                'UT TRACKER (GAC)',
                'UT TRACKER (GAC)'[Joint ID] = CurrentJointID
            ),
            'UT TRACKER (GAC)'[Cross Verification-by  CTJV (TPI) ]
        ),
        'UT TRACKER (GAC)'[Cross Verification-by  CTJV (TPI) ] <> BLANK()
    )
VAR UTTrackerTEKID = 
    CALCULATE(
        MAXX(
            FILTER(
                'UT TRACKER (TEK)',
                'UT TRACKER (TEK)'[Joint ID] = CurrentJointID
            ),
            'UT TRACKER (TEK)'[Cross Verification-by  CTJV (TPI) ]
        ),
        'UT TRACKER (TEK)'[Cross Verification-by  CTJV (TPI) ] <> BLANK()
    )
RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            BLANK()
        )
    )
```

#### `Project WD+WR+INCO+Acciona[CTJV VERIFICATION Date.]` — format `d mmmm\, yyyy`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'UT TRACKER (GAC)',
            'UT TRACKER (GAC)'[Joint ID] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
        ),
        'UT TRACKER (GAC)'[CTJV VERIFICATIONDATE]
    )+
    CALCULATE(
    MAXX(
        FILTER(
            'UT TRACKER (TEK)',
            'UT TRACKER (TEK)'[Joint ID] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
        ),
        'UT TRACKER (TEK)'[CTJV VERIFICATIONDATE]
)))
```

#### `Project WD+WR+INCO+Acciona[CTJV VERIFICATION BY.]` — format `nan`

```dax
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
VAR UTTrackerGACID = 
    CALCULATE(
        MAXX(
            FILTER(
                'UT TRACKER (GAC)',
                'UT TRACKER (GAC)'[Joint ID] = CurrentJointID
            ),
            'UT TRACKER (GAC)'[CTJV VERIFICATIONBY]
        ),
        'UT TRACKER (GAC)'[CTJV VERIFICATIONBY] <> BLANK()
    )
VAR UTTrackerTEKID = 
    CALCULATE(
        MAXX(
            FILTER(
                'UT TRACKER (TEK)',
                'UT TRACKER (TEK)'[Joint ID] = CurrentJointID
            ),
            'UT TRACKER (TEK)'[CTJV VERIFICATIONBY]
        ),
        'UT TRACKER (TEK)'[CTJV VERIFICATIONBY] <> BLANK()
    )
RETURN
    IF(
        NOT ISBLANK(UTTrackerGACID),
        UTTrackerGACID,
        IF(
            NOT ISBLANK(UTTrackerTEKID),
            UTTrackerTEKID,
            BLANK()
        )
    )
```

#### `Project WD+WR+INCO+Acciona[UT Rej Length Rate % "PR all" For Welder]` — format `0.00%;-0.00%;0.00%`

```dax
IF (
    NOT ISBLANK('Project WD+WR+INCO+Acciona'[Manual UT Date.]),
    DIVIDE(
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
        ),
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID])
        )
    ) * 1,
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[UT Rej Rate % STATUS for Welder by Length]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] < 0.015,
        "1. Ok: 0 to 1.5%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] >= 0.015 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] < 0.02,
            "2. Monitor: 1.5% to 2%",
            IF (
                'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] >= 0.02 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Rate % "PR all" For Welder] <= 1,
                "3. Action: 2% to 100%",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[UT Rej Rate % "PR all" For Welder by Joint]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"",'Project WD+WR+INCO+Acciona'[Manual UT Status.]= "R",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Welder ID])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Welder ID])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[UT Rej Rate % STATUS for Welder by Joint]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint] < 0.1,
        "1. 0 to 10%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint] >= 0.1 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % "PR all" For Welder by Joint] <= 1,
            "2. 10 to 100%",
            BLANK()
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[UT Rej Rate % by joint "PR all" For Sub-Con]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"",'Project WD+WR+INCO+Acciona'[Manual UT Status.]= "R",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Sub-Contractor])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[Sub-Contractor])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[UT Rej Rate % STATUS for Sub-Con by Joint]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] < 0.03,
        "1. ok-0 to 3%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] >= 0.03 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] < 0.05,
            "2. Monitor-3% to 5%",
            IF (
                'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] >= 0.05 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by joint "PR all" For Sub-Con] <= 1,
                "3. Not Accept-5% to 100%",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"]` — format `0.00%;-0.00%;0.00%`

```dax
COALESCE(
    DIVIDE(
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[RT Report] <> "",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks])
        ),
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date] > 0,
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks])
        )
    ),
    0
)
```

#### `Project WD+WR+INCO+Acciona[PWHT Report "PR All"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[PWHT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[PWHT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[PWHT Report No CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[PWHT Date "PR All"]` — format `dd-mmm-yy`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[PWHT Date]>0, 
    'Project WD+WR+INCO+Acciona'[PWHT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[PWHT Date No CCC]>0, 
        'Project WD+WR+INCO+Acciona'[PWHT Date No CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[UT Date "PR All"]` — format `d mmmm\, yyyy`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[UT Date]>0, 
    'Project WD+WR+INCO+Acciona'[UT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC", 
        LOOKUPVALUE(
            'UT TRACKER (CCC)_Talisman'[UT1 DATE],
            'UT TRACKER (CCC)_Talisman'[Joint ID], 
            'Project WD+WR+INCO+Acciona'[Joint ID]
        ), 
        IF(
            'Project WD+WR+INCO+Acciona'[RT/UT] = "UT",
            'Project WD+WR+INCO+Acciona'[RT Date],
            BLANK()
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[MT Report "PR All"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[MT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[MT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[MT Report CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[MT Report CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[MT Date "PR All"]` — format `d mmmm\, yyyy`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[MT Date]>0, 
    'Project WD+WR+INCO+Acciona'[MT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[MT Date CCC]>0, 
        'Project WD+WR+INCO+Acciona'[MT Date CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[MT % "PR All"]` — format `0`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    IF(
        'Project WD+WR+INCO+Acciona'[MT%] >= 0, 
        'Project WD+WR+INCO+Acciona'[MT%], 
        BLANK()
    ),
    IF(
        'Project WD+WR+INCO+Acciona'[MT% CCC] >= 0, 
        'Project WD+WR+INCO+Acciona'[MT% CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[PMI Report CCC]` — format `nan`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PMI Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[PMI Report No]
    )
)
```

#### `Project WD+WR+INCO+Acciona[PMI Date CCC]` — format `d mmmm\, yyyy`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PMI Date]>0
        ),
        'AllTrain_CSVExport_Joint Record'[PMI Date]
    )
)
```

#### `Project WD+WR+INCO+Acciona[PMI% CCC]` — format `0`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[PMI(%)]
    )
)
```

#### `Project WD+WR+INCO+Acciona[PMI % "PR All"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    IF(
        'Project WD+WR+INCO+Acciona'[PMI%] >= 0, 
        'Project WD+WR+INCO+Acciona'[PMI%], 
        BLANK()
    ),
    IF(
        'Project WD+WR+INCO+Acciona'[PMI% CCC] >= 0, 
        'Project WD+WR+INCO+Acciona'[PMI% CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[PMI Report "PR All"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[PMI Report] <> "", 
    'Project WD+WR+INCO+Acciona'[PMI Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[PMI Report CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[PMI Report CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[PMI Date "PR All"]` — format `d mmmm\, yyyy`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[PMI Date]>0, 
    'Project WD+WR+INCO+Acciona'[PMI Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[PMI Date CCC]>0, 
        'Project WD+WR+INCO+Acciona'[PMI Date CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[PT% CCC]` — format `0`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[PT Root(%)]
    )
)
```

#### `Project WD+WR+INCO+Acciona[PT Report CCC]` — format `nan`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PT Root Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[PT Root Report No]
    )
)
```

#### `Project WD+WR+INCO+Acciona[PT Date CCC]` — format `d mmmm\, yyyy`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[PT Root Date]>0
        ),
        'AllTrain_CSVExport_Joint Record'[PT Root Date]
    )
)
```

#### `Project WD+WR+INCO+Acciona[PT % "PR All"]` — format `0`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    IF(
        'Project WD+WR+INCO+Acciona'[PT%]>=0, 
        'Project WD+WR+INCO+Acciona'[PT%], 
        BLANK()
    ),
    IF(
        'Project WD+WR+INCO+Acciona'[PT% CCC]>=0, 
        'Project WD+WR+INCO+Acciona'[PT% CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[PT Report "PR All"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[PT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[PT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[PT Report CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[PT Report CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[PT Date "PR All"]` — format `d mmmm\, yyyy`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[PT Date]>0, 
    'Project WD+WR+INCO+Acciona'[PT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[PT Date CCC]>0, 
        'Project WD+WR+INCO+Acciona'[PT Date CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[HT Report CCC]` — format `nan`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[HT Report No] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[HT Report No]
    )
)
```

#### `Project WD+WR+INCO+Acciona[HT Date CCC]` — format `d mmmm\, yyyy`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[HT Date]>0
        ),
        'AllTrain_CSVExport_Joint Record'[HT Date]
    )
)
```

#### `Project WD+WR+INCO+Acciona[HT% CCC]` — format `0`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'AllTrain_CSVExport_Joint Record',
            'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
                && 'AllTrain_CSVExport_Joint Record'[Service Class] <>""
        ),
        'AllTrain_CSVExport_Joint Record'[HT(%)]
    )
)
```

#### `Project WD+WR+INCO+Acciona[HT % "PR All"]` — format `0`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    IF(
        'Project WD+WR+INCO+Acciona'[HT%]>=0, 
        'Project WD+WR+INCO+Acciona'[HT%], 
        BLANK()
    ),
    IF(
        'Project WD+WR+INCO+Acciona'[HT% CCC]>=0, 
        'Project WD+WR+INCO+Acciona'[HT% CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[HT Report "PR All"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[HT Report] <> "", 
    'Project WD+WR+INCO+Acciona'[HT Report], 
    IF(
        'Project WD+WR+INCO+Acciona'[HT Report CCC] <>"", 
        'Project WD+WR+INCO+Acciona'[HT Report CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[HT Date "PR All"]` — format `d mmmm\, yyyy`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[HT Date]>0, 
    'Project WD+WR+INCO+Acciona'[HT Date], 
    IF(
        'Project WD+WR+INCO+Acciona'[HT Date CCC]>0, 
        'Project WD+WR+INCO+Acciona'[HT Date CCC], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[UT Rej Rate % by Length "PR all" For Sub-Con]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Sub-Contractor])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Sub-Contractor])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[UT Rej Rate % STATUS for Sub-Con by Length]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] < 0.01,
        "1.ok: 0 to 1%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] >= 0.01 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] < 0.015,
            "2.Monitor: 1% to 1.5%",
            IF (
                'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] >= 0.015 && 'Project WD+WR+INCO+Acciona'[UT Rej Rate % by Length "PR all" For Sub-Con] <= 1,
                "3.Not Accept: 1.5% to 100%",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[RT Film Ratio % "PR all" For Welder LAST 1 MONTH]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
        )
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
        'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[RT FILM Ratio % STATUS LAST 1 Month]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] >= 0 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] < 0.05,
        "1. 0 to 5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] >= 0.05 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] < 0.075,
            "2. 5 to 7.5%-monitor",
            IF (
                'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] >= 0.075 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] < 0.10,
                "3. 7.5 to 10%-Critical",
                IF (
                    'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] >= 0.10 && 'Project WD+WR+INCO+Acciona'[RT Film Ratio % "PR all" For Welder LAST 1 MONTH] <= 1,
                    "4. 10 to 100% - Disq.F",
                    BLANK()
                )
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[CROSS CHECK DATA & Talisman JOINT ID]` — format `nan`

```dax
VAR TalismanJointID = 
    IF(
        'Project WD+WR+INCO+Acciona'[Sub-contractor] = "CCC",
        LOOKUPVALUE(
            'TALISMAN DATA'[Joint ID],
            'TALISMAN DATA'[Joint ID],
            'Project WD+WR+INCO+Acciona'[Joint ID]
        ),
        BLANK()
    )
RETURN
IF(
    'Project WD+WR+INCO+Acciona'[Sub-contractor] = "CCC",
    IF(
        ISBLANK(TalismanJointID),
        "NO",
        TalismanJointID
    ),
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[RT CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR RTReport = 'Project WD+WR+INCO+Acciona'[RT Report]
RETURN
    IF (
        'Project WD+WR+INCO+Acciona'[RT/UT] <> "UT" && 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] = "" &&
        RTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = RTReport &&
                'l2_ndt_list'[Report_Type] = "RT"
            )
        RETURN
            IF (
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ),
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[MT CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR MTReport = 'Project WD+WR+INCO+Acciona'[MT Report "PR All"]
RETURN
    IF (
        MTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = MTReport &&
                'l2_ndt_list'[Report_Type] = "MT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ),
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[PWHT CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR PWHTReport = 'Project WD+WR+INCO+Acciona'[PWHT Report "PR All"]
RETURN
    IF (
        PWHTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = PWHTReport &&
                'l2_ndt_list'[Report_Type] = "PWHT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[UT CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR UTReport = 'Project WD+WR+INCO+Acciona'[Manual UT Report No.]
RETURN
    IF (
        UTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = UTReport &&
                'l2_ndt_list'[Report_Type] = "UT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[PMI CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR PMIReport = 'Project WD+WR+INCO+Acciona'[PMI Report "PR All"]
RETURN
    IF (
        PMIReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = PMIReport &&
                'l2_ndt_list'[Report_Type] = "PMI"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[PT CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR PTReport = 'Project WD+WR+INCO+Acciona'[PT Report "PR All"]
RETURN
    IF (
        PTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = PTReport &&
                'l2_ndt_list'[Report_Type] = "PT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[HT CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR HTReport = 'Project WD+WR+INCO+Acciona'[HT Report "PR All"]
RETURN
    IF (
        HTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = HTReport &&
                'l2_ndt_list'[Report_Type] = "HT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[ORIF CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR ORIFReport = 'Project WD+WR+INCO+Acciona'[ORIF Report]
RETURN
    IF (
        ORIFReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = ORIFReport &&
                'l2_ndt_list'[Report_Type] = "ORIF"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[PADLT CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR PADLTReport = 'Project WD+WR+INCO+Acciona'[PADLT Report]
RETURN
    IF (
        PADLTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = PADLTReport &&
                'l2_ndt_list'[Report_Type] = "PADLT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[UT Status TR/FL]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[UT Acc/Rej] = 'Project WD+WR+INCO+Acciona'[Manual UT Status],
    "TRUE",
    "FALSE"
)
```

#### `Project WD+WR+INCO+Acciona[Spool ID Status]` — format `nan`

```dax
VAR CurrentSpoolID = 'Project WD+WR+INCO+Acciona'[Spool ID]
VAR SubContractor = 'Project WD+WR+INCO+Acciona'[Sub-Contractor]

RETURN
    IF(
        SubContractor = "CCC",
        MAXX(
            FILTER(
                'Talisman Spool Dump',
                'Talisman Spool Dump'[Spool ID] = CurrentSpoolID
            ),
            'Talisman Spool Dump'[Status Released]
        ),
        MAXX(
            FILTER(
                'Weld Dump',
                'Weld Dump'[Spool ID] = CurrentSpoolID &&
                (
                    SubContractor <> "CCC" || 'Weld Dump'[Sub-Contractor] <> "CCC"
                )
            ),
            'Weld Dump'[Status FABRICATED]
        )
    )
```

#### `Project WD+WR+INCO+Acciona[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Defect Length(MM).]),
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last UT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}
        )
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Inspected Length(MM).]),'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <> "",
        FILTER(
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Days Since Last UT] IN {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[UT Rej Rate % STATUS for Welder by Length Last 2 Weeks]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.015,
        "1.Ok: 0 to 1.5%",
        IF (
            'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.015 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.02,
            "2.Monitor: 1.5% to 2%",
            IF (
                'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.02 && 'Project WD+WR+INCO+Acciona'[UT Rej Length Ratio % "PR all" For Welder LAST 2 WEEKS] <= 1,
                "3.Action: 2% to 100%",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[Last_UT Date "PR all"]` — format `dd-mmm-yy`

```dax
    LASTDATE('Project WD+WR+INCO+Acciona'[Manual UT Date.])
```

#### `Project WD+WR+INCO+Acciona[Days Since Last UT]` — format `nan`

```dax
IF(ISBLANK([Last_UT Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[Last_UT Date "PR all"]))
```

#### `Project WD+WR+INCO+Acciona[VI CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR VIReport = 'Project WD+WR+INCO+Acciona'[DWIR Report "PR All"]
RETURN
    IF (
        VIReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = VIReport &&
                'l2_ndt_list'[Report_Type] = "VI"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[Spool ID CCC PWHT Status]` — format `nan`

```dax
VAR CurrentSpoolID = 'Project WD+WR+INCO+Acciona'[Spool ID]
VAR SubContractor = 'Project WD+WR+INCO+Acciona'[Sub-Contractor]
RETURN
    IF(
        SubContractor = "CCC",
        MAXX(
            FILTER(
                'Talisman Spool Dump',
                'Talisman Spool Dump'[Spool ID] = CurrentSpoolID
            ),
            'Talisman Spool Dump'[Status PWHT Spool Date]
        ))
```

#### `Project WD+WR+INCO+Acciona[VBT CROSS CHECK PRJ Data & FRB]` — format `nan`

```dax
VAR VBTReport = 'Project WD+WR+INCO+Acciona'[VBT Report]
RETURN
    IF (
        VBTReport <> "",
        VAR FilteredReportList = 
            FILTER(
                'l2_ndt_list',
                'l2_ndt_list'[Origin_Report_No] = VBTReport &&
                'l2_ndt_list'[Report_Type] = "VBT"
            )
        RETURN
            IF(
                ISEMPTY(FilteredReportList),
                "NOT Found",
                MAXX(
                    FilteredReportList,
                    'l2_ndt_list'[Origin_Report_No]
                )
            ), 
        BLANK()
    )
```

#### `Project WD+WR+INCO+Acciona[LINE]` — format `nan`

```dax
MID('Project WD+WR+INCO+Acciona'[ISO Number], 9, LEN('Project WD+WR+INCO+Acciona'[ISO Number]))
```

#### `Project WD+WR+INCO+Acciona[First_Weld Date "PR all"]` — format `dd-mmm-yy`

```dax
FIRSTDATE('Project WD+WR+INCO+Acciona'[Weld Date])
```

#### `Project WD+WR+INCO+Acciona[Days Since First Weld]` — format `nan`

```dax
IF(ISBLANK([First_Weld Date "PR all"]),BLANK(),
VALUE([Cur_Date "PR all"]-[First_Weld Date "PR all"]))
```

#### `Project WD+WR+INCO+Acciona[Dia Inch >20<]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Dia inch] <= 20, 
    "0-20",
    IF(
        'Project WD+WR+INCO+Acciona'[Dia inch] > 20 && 'Project WD+WR+INCO+Acciona'[Dia inch] <= 200, 
        "20-199",
        "Greater than 199"
    )
)
```

#### `Project WD+WR+INCO+Acciona[WeldPoint No.1 WP1]` — format `0`

```dax
VAR CurrentWP = 'Project WD+WR+INCO+Acciona'[Index]
VAR CurrentJointID = 'Project WD+WR+INCO+Acciona'[Joint ID]
RETURN
    COUNTROWS(
        FILTER(
            'Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJointID &&
            'Project WD+WR+INCO+Acciona'[Index] < CurrentWP
        )
    ) + 1
```

#### `Project WD+WR+INCO+Acciona[Duplicate Weld Date]` — format `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Weld Date]),
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Joint ID])
)
```

#### `Project WD+WR+INCO+Acciona[Duplicate RT Date]` — format `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT Date]),
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Joint ID])
)
```

#### `Project WD+WR+INCO+Acciona[TP Complete %]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",'Project WD+WR+INCO+Acciona'[Weld Date]>0,
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"])
    ),
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all" STATUS]` — format `nan`

```dax
IF (
    'Project WD+WR+INCO+Acciona'[RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"] < 0.05, 
    "1. < 5% - CHECK", 
    IF (
        'Project WD+WR+INCO+Acciona'[RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"] >= 0.05 && 
        'Project WD+WR+INCO+Acciona'[RT/UT Ratio % For Service Class + Service Cat+NDT Remarks Cover "PR all"] < 0.1, 
        "2. 5% > 10%",
        BLANK() 
    )
)
```

#### `Project WD+WR+INCO+Acciona[BATCH QTY Joints]` — format `0`

```dax
    CALCULATE(
        DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
        'Project WD+WR+INCO+Acciona'[Repair & Reweld "PR all"]="",
        'Project WD+WR+INCO+Acciona'[Weld Date]>0,
        ALLEXCEPT('Project WD+WR+INCO+Acciona','Project WD+WR+INCO+Acciona'[RT Batch No])
    )
```

#### `Project WD+WR+INCO+Acciona[QTY Welder ID & No RT by Service Class + Service Cat+NDT Remarks]` — format `0`

```dax
        CALCULATE(
            DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Welder ID]),
            'Project WD+WR+INCO+Acciona'[Weld Date]>0,
            'Project WD+WR+INCO+Acciona'[RT Report] = "",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"},
            ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks],'Project WD+WR+INCO+Acciona'[Sub-Contractor]))
```

#### `Project WD+WR+INCO+Acciona[Has_RT_Report]` — format `0`

```dax
CALCULATE(
    COUNTROWS('Project WD+WR+INCO+Acciona'),
    'Project WD+WR+INCO+Acciona'[RT Report] <> "",
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID], 'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks])
)
```

#### `Project WD+WR+INCO+Acciona[Service Class + Service Cat+NDT Remarks+Welder ID]` — format `nan`

```dax
'Project WD+WR+INCO+Acciona'[Service class]&" "&'Project WD+WR+INCO+Acciona'[Service Cat]&" "&'Project WD+WR+INCO+Acciona'[NDT Remarks]&" "&'Project WD+WR+INCO+Acciona'[RT%]&" "&'Project WD+WR+INCO+Acciona'[Welder ID]
```

#### `Project WD+WR+INCO+Acciona[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS]` — format `0.00%;-0.00%;0.00%`

```dax
IF(
    NOT ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"]),
    
    VAR RepairLength = 
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Repair Length (mm)]),
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
            )
        )

    VAR WeldLength = 
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Rej Length]), --Все верно это RT Length Column
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
            )
        )

    RETURN
        DIVIDE(RepairLength, WeldLength),

    BLANK()  -- Возвращает пустое значение, если Last_RT Date "PR all" пустое
)
```

#### `Project WD+WR+INCO+Acciona[Inco Rej Rate % STATUS for Welder by Length Last 2 Weeks]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.015,
        "1. 0 to 1.5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.015 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] < 0.02,
            "2.Monitor: 1.5% to 2%",
            IF (
                'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] >= 0.02 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 2 WEEKS] <= 1,
                "3.Action: 2% to 100%",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[Inco Length Ratio % "PR all" For Welder LAST 1 Month]` — format `0.00%;-0.00%;0.00%`

```dax
IF(
    NOT ISBLANK('Project WD+WR+INCO+Acciona'[Last_RT Date "PR all"]),
    
    VAR RepairLength = 
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Repair Length (mm)]),
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
            )
        )

    VAR WeldLength = 
        CALCULATE(
            SUM('Project WD+WR+INCO+Acciona'[Rej Length]), --Все верно это RT Length Column
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
            'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
            'Project WD+WR+INCO+Acciona'[Sub-Contractor]="Inco",
            FILTER(
                ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Welder ID]),
                'Project WD+WR+INCO+Acciona'[Days Since Last RT] IN {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}
            )
        )

    RETURN
        DIVIDE(RepairLength, WeldLength),

    BLANK()  -- Возвращает пустое значение, если Last_RT Date "PR all" пустое
)
```

#### `Project WD+WR+INCO+Acciona[Inco Rej Rate % STATUS for Welder by Length Last 1 Month]` — format `nan`

```dax
IF (
    ISBLANK('Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month]),
    BLANK(),
    IF (
        'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] >= 0 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] < 0.015,
        "1. 0 to 1.5% - ok",
        IF (
            'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] >= 0.015 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] < 0.02,
            "2.Monitor: 1.5% to 2%",
            IF (
                'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] >= 0.02 && 'Project WD+WR+INCO+Acciona'[Inco Length Ratio % "PR all" For Welder LAST 1 Month] <= 1,
                "3.Action: 2% to 100%",
                BLANK()
            )
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[Status Fabricated from "WD"]` — format `nan`

```dax
MAXX(
    FILTER(
        ALL('Weld Dump'),
        'Weld Dump'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
    ),
    'Weld Dump'[Status FABRICATED]
)
```

#### `Project WD+WR+INCO+Acciona[Status Spool NDE from "WD"]` — format `nan`

```dax
MAXX(
    FILTER(
        ALL('Weld Dump'),
        'Weld Dump'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
    ),
    'Weld Dump'[Status Spool NDE]
)
```

#### `Project WD+WR+INCO+Acciona[Last Spool Status from "WD"]` — format `nan`

```dax
MAXX(
    FILTER(
        ALL('Weld Dump'),
        'Weld Dump'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
    ),
    'Weld Dump'[Last Status]
)
```

#### `Project WD+WR+INCO+Acciona[Weld CAT (NEW)]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Weld Type] = "SW" && 'Project WD+WR+INCO+Acciona'[Weld Cat] = "F", 
    "S", 
    'Project WD+WR+INCO+Acciona'[Weld Cat]
)
```

#### `Project WD+WR+INCO+Acciona[Duplicate RT Report]` — format `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[RT Report]),
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Joint ID])
)
```

#### `Project WD+WR+INCO+Acciona[By UT All]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[By UT] = "Y", 
    "BY UT", 
    IF(
        'Project WD+WR+INCO+Acciona'[RT/UT] = "UT", 
        "BY UT",     
    IF(
        'Project WD+WR+INCO+Acciona'[HT Remarks] = "PAUT", 
        "BY UT",    
    IF(
        'Project WD+WR+INCO+Acciona'[Manual UT Report No.] <>"", 
        "BY UT",
        BLANK()  -- Это значение по умолчанию, если оба условия ложны
    )
)))
```

#### `Project WD+WR+INCO+Acciona[PWHT Y/N CCC (NEW)]` — format `nan`

```dax
IF (
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] = "CCC",
    IF (
        'Project WD+WR+INCO+Acciona'[Joint ID] IN { 
            "11090A1-SV6209181-SP4-12RS1", 
            "11040A1-HHS6292141-SP30-258RS1", 
            "11020P5-NG6202001-SP5-12",
            "11020P5-NG6202001-SP6-16",
            "11040A1-HHS6292143-SP1A-3RS1",
            "11090A1-SV6209066-SP3-10",
            "11090A1-N6209106A-SP2-7",
            "11010P4-SF6284102-SP6-11",
            "11020P5-SV6202157-SP1-5",
            "11020A1-SV6202193A-SP1-4",
            "11020A1-AG6202007-SP10-701", 
            "11020A1-SV6202064B-SP4-701",
            "11060A3-NR6206006-SP2-3"
        },
        "N", -- АБСОЛЮТНЫЙ ПРИОРИТЕТ
        IF (
            'Project WD+WR+INCO+Acciona'[Weld Type] IN { "THD" },
            "N",
            IF (
                'Project WD+WR+INCO+Acciona'[WPS No.] IN { "CS/LTCS-015", "CS/LTCS-017" } && 
                'Project WD+WR+INCO+Acciona'[Weld Type] IN { "SP" },
                "N",
                IF (
                    'Project WD+WR+INCO+Acciona'[Weld Type] IN { "SP" } &&
                    'Project WD+WR+INCO+Acciona'[Service class] IN { "3R1B3", "6P1A", "6P1AB", "6R1B", "9P1A", "9S1A" },
                    "N",
                    IF (
                        'Project WD+WR+INCO+Acciona'[Weld Type] IN { "LET" } && 
                        'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] <> "",
                        "Y",
                        IF (
                            'Project WD+WR+INCO+Acciona'[Weld Type] IN { "RPD" } && 
                            'Project WD+WR+INCO+Acciona'[PWHT Report No CCC] <> "",
                            "Y",
                            IF (
                                'Project WD+WR+INCO+Acciona'[WPS No.] IN { "CS/LTCS-015", "CS/LTCS-AUT-011", "CS/LTCS-017" } &&
                                'Project WD+WR+INCO+Acciona'[Service class] IN {
                                    "1A1A", "1P1A", "1P1AR", "1P1AW", "1P3A", "1R1B", "1R1B7", "1S1A", "1T3AJ", "1T3AO", "1T6ASO", "1W0WG",
                                    "3P1A", "3P1AB", "3P3A", "3R1B1", "3R1B2", "3R1B3", "3S1A", "3S1A4", "3S1AU", "3T3AJ", "6P1A", "6P1AB", "6P3A", "6R1B", "6S1A", "6S1AU",
                                    "9P1A", "9S1A", "9S1AU", "9R1B", "1P1A7", "1R1B7", "3R1B7", "3P1A7", "1G3A", "1M1A", "1N1A", "6G3A", "1H3AJ6M1A", "1T3AZ", "3T3AZ", "1H3AZ", "3L1B2"
                                } &&
                                'Project WD+WR+INCO+Acciona'[Thickness] > 25 &&
                                'Project WD+WR+INCO+Acciona'[Thickness] <= 38,
                                "N",
                                -- ПРИОРИТЕТНОЕ ИСКЛЮЧЕНИЕ: Сначала проверяем DS-04 для SS
                                IF (
                                    'Project WD+WR+INCO+Acciona'[Material Type] IN { "SS" } && 'Project WD+WR+INCO+Acciona'[WPS No.] IN { "DS-04" },
                                    "Y",
                                    -- Если это не DS-04, проверяем общую группу SS/DSS
                                    IF (
                                        'Project WD+WR+INCO+Acciona'[Material Type] IN { "SS", "SS304L", "SS304", "SS304/304L", "SS 316L", "DSS", "SDSS" },
                                        "N",                                
                                        IF (
                                            'Project WD+WR+INCO+Acciona'[WPS No.] IN {
                                                "CS/LTCS-001", "CS/LTCS-003", "CS/LTCS-005", "CS/LTCS-007", "CS/LTCS-010", 
                                                "CS/LTCS-012", "CS/LTCS-014", "CS/LTCS-AUT-001", "CS/LTCS-AUT-003", 
                                                "CS/LTCS-AUT-005", "CS/LTCS-AUT-007", "CS/LTCS-AUT-009",
                                                "CS/LTCS-002", "CS/LTCS-004", "CS/LTCS-006", "CS/LTCS-008", 
                                                "CS/LTCS-009", "CS/LTCS-011", "CS/LTCS-013", "CS/LTCS-AUT-002", 
                                                "CS/LTCS-AUT-006", "CS/LTCS-AUT-008", "CS/LTCS-AUT-010", 
                                                "DEW-CS/LTCS-002", "DEW-CS/LTCS-004", "DEW-CS/LTCS-008"
                                            } &&
                                            'Project WD+WR+INCO+Acciona'[Thickness] > 25,
                                            "Y",
                                            IF (
                                                'Project WD+WR+INCO+Acciona'[Service class] IN { "1P3A", "1R1B", "1R1B7", "1W3AX", "3R1B2", "3R1B3", "6PIA", "6P1AB", "6R1B" } &&
                                                'Project WD+WR+INCO+Acciona'[Thickness] > 25,
                                                "Y",
                                                IF (
                                                    'Project WD+WR+INCO+Acciona'[Service class] IN {
                                                        "6C3AS", "1B6AS", "3B6AS", "1C3AS", "1C4AS", "1C3ASR", "3D3AS", "1C6AS", "1C3AS7",
                                                        "1D3AS", "6D3AS", "3C3AS", "3E3AS", "1E3AS", "1B3AS", "9D3AS", "6C3ASB", "6C6AS", "1C4AS7", 
                                                        "9C3AS", "6C4AS", "3C6AS", "9C3AS0", "9C3ASW", "6C3ASN", "3C3ASN", "1C3ASW", "3C6ASN", 
                                                        "3C3ASW", "3C4AS", "6C6ASN", "9C3ASM", "3C4ASW", "1C4ASW", 
                                                        "1H3AZS", "1L3BS", "1R3BS", "1R3BS7", "1R3BSR", "1T3AJS", "1T3AZS", "3L3BS", "3R3BS", "6K3BS", "6R3BS"
                                                    },
                                                    "Y",
                                                    IF (
                                                        'Project WD+WR+INCO+Acciona'[WPS No.] IN {
                                                            "304-SS-01", "304-SS-04", "304-SS-03", "304-SS-02", "304-SS-06", "304-SS-06A",
                                                            "304-SS-AUT-001", "304-SS-AUT-003", "316-SS-01", "304-SS-09", "304-SS-AUT-001A",
                                                            "304-SS-AUT-002", "304-SS-AUT-004", "304-SS-010", "DEW-304-SS-002", "304-SS-04A",
                                                            "304-SS-02A", "316-SS-03", "316-SS-02"
                                                        },
                                                        "N",
                                                        IF (
                                                            'Project WD+WR+INCO+Acciona'[WPS No.] IN { "LA-01", "LA-02", "LA-05", "DS-03", "DS-04" },
                                                            "Y",
                                                            IF (
                                                                'Project WD+WR+INCO+Acciona'[Thickness] > 25,
                                                                "Y",
                                                                "N" 
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    ),
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[PWHT Y/N CCC True/False Status]` — format `nan`

```dax
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[PWHT Y/N CCC (NEW)]),
    "",  -- Если ' пустое, возвращаем строку ""
    IF(
        'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC (NEW)] = 'Project WD+WR+INCO+Acciona'[PWHT Y/N CCC],
        "TRUE",  -- Если равны, возвращаем строку "TRUE"
        "FALSE"  -- Если не равны, возвращаем строку "FALSE"
    )
)
```

#### `Project WD+WR+INCO+Acciona[Thickness From "JR"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR ThiknessFromJR = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
            ),
            'AllTrain_CSVExport_Joint Record'[Wall Thickness]
        )
    RETURN ThiknessFromJR
)
```

#### `Project WD+WR+INCO+Acciona[Thickness from "JR" True/False Status]` — format `nan`

```dax
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[Thickness From "JR"]),
    "",  -- Если ' пустое, возвращаем строку ""
    IF(
        'Project WD+WR+INCO+Acciona'[Thickness From "JR"] = 'Project WD+WR+INCO+Acciona'[Thickness],
        "TRUE",  -- Если равны, возвращаем строку "TRUE"
        "FALSE"  -- Если не равны, возвращаем строку "FALSE"
    )
)
```

#### `Project WD+WR+INCO+Acciona[WPS From "Talisman"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR WPSFromTalisman = 
        MAXX(
            FILTER(
                'TALISMAN DATA', 
                'TALISMAN DATA'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
            ),
            'TALISMAN DATA'[WPS CODE]
        )
    RETURN WPSFromTalisman
)
```

#### `Project WD+WR+INCO+Acciona[WPS from "Talisman" True/False Status]` — format `nan`

```dax
IF(
    ISBLANK('Project WD+WR+INCO+Acciona'[WPS From "Talisman"]),
    "",  -- Если ' пустое, возвращаем строку ""
    IF(
        'Project WD+WR+INCO+Acciona'[WPS From "Talisman"] = 'Project WD+WR+INCO+Acciona'[WPS No.],
        "TRUE",  -- Если равны, возвращаем строку "TRUE"
        "FALSE"  -- Если не равны, возвращаем строку "FALSE"
    )
)
```

#### `Project WD+WR+INCO+Acciona[DWIR CCC From "JR"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "CCC",
    BLANK(),
    VAR DWIRFromJR = 
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record', 
                'AllTrain_CSVExport_Joint Record'[Joint ID] = 'Project WD+WR+INCO+Acciona'[Joint ID]
            ),
            'AllTrain_CSVExport_Joint Record'[Weld Report No]
        )
    RETURN DWIRFromJR
)
```

#### `Project WD+WR+INCO+Acciona[DWIR Report "PR All"]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[DWIR No.] <> "", 
    'Project WD+WR+INCO+Acciona'[DWIR No.], 
    IF(
        'Project WD+WR+INCO+Acciona'[DWIR CCC From "JR"] <>"", 
        'Project WD+WR+INCO+Acciona'[DWIR CCC From "JR"], 
        BLANK()
    )
)
```

#### `Project WD+WR+INCO+Acciona[HA]` — format `nan`

```dax
VAR SubsystemVal = 'Project WD+WR+INCO+Acciona'[Subsystem Code]
VAR SystemVal = 'Project WD+WR+INCO+Acciona'[System No]

-- Извлекаем вторые цифры для обоих столбцов
VAR DigitSub = MID(SubsystemVal, 2, 1)
VAR DigitSys = MID(SystemVal, 2, 1)

-- Условие "невалидности" (пусто, NA или NON)
VAR SubIsInvalid = ISBLANK(SubsystemVal) || SubsystemVal = "System-NA - Not Applicable" || CONTAINSSTRING(SubsystemVal, "NON")
VAR SysIsInvalid = ISBLANK(SystemVal) || SystemVal = "System-NA - Not Applicable" || CONTAINSSTRING(SystemVal, "NON")

RETURN
IF (
    -- 1. Сначала проверяем Subsystem Code
    NOT(SubIsInvalid) && DigitSub IN {"1", "2", "3", "4"},
    "HA" & DigitSub,
    
    IF (
        -- 2. Если Subsystem не подошел, проверяем System No
        NOT(SysIsInvalid) && DigitSys IN {"1", "2", "3", "4"},
        "HA" & DigitSys,
        
        -- 3. Если оба столбца пустые/NON/NA, выполняем поиск по справочнику
        LOOKUPVALUE(
            'HA l0_abs_guide'[Handover Area], 
            'HA l0_abs_guide'[Location Number], 'Project WD+WR+INCO+Acciona'[PDS Area]
        )
    )
)
```

#### `Project WD+WR+INCO+Acciona[Days Between RT Selected and RT Date]` — format `0`

```dax
DATEDIFF(
    'Project WD+WR+INCO+Acciona'[RT Selected Date], 
    'Project WD+WR+INCO+Acciona'[RT Date], 
    DAY
)
```

#### `Project WD+WR+INCO+Acciona[Duplicate RT Report by Joint]` — format `0`

```dax
CALCULATE(
    DISTINCTCOUNT('Project WD+WR+INCO+Acciona'[Joint ID]),
    ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[RT Report]))
```

#### `Project WD+WR+INCO+Acciona[Week_End_Date from Calendar]` — format `dd-mmm-yy`

```dax
MAXX(
    FILTER(
        'Calendar', 
        'Calendar'[Date] = 'Project WD+WR+INCO+Acciona'[RT Date]
    ),
    'Calendar'[Week_End_Date]
)
```

#### `Project WD+WR+INCO+Acciona[MonthRT]` — format `mmmm d`

```dax
'Project WD+WR+INCO+Acciona'[RT Date]
```

#### `Project WD+WR+INCO+Acciona[YearRT]` — format `nan`

```dax
FORMAT('Project WD+WR+INCO+Acciona'[RT Date],"YYYY")
```

#### `Project WD+WR+INCO+Acciona[Exlude Full Cut & Debris]` — format `nan`

```dax
IF (
    'Project WD+WR+INCO+Acciona'[RT Re-Shoot Status] = "Full Cut" && 
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[RT Re-Shoot Reason], "Debris") &&
    'Project WD+WR+INCO+Acciona'[Defect Code] = "XX",
    "Exclude Films:Debris",
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[Service Class + Service Cat+NDT Remarks+Sub-Contractor]` — format `nan`

```dax
'Project WD+WR+INCO+Acciona'[Service class]&" "&'Project WD+WR+INCO+Acciona'[Service Cat]&" "&'Project WD+WR+INCO+Acciona'[NDT Remarks]&" "&'Project WD+WR+INCO+Acciona'[RT%]&" "&'Project WD+WR+INCO+Acciona'[Sub-Contractor]
```

#### `Project WD+WR+INCO+Acciona[Rework Code "PR All"]` — format `nan`

```dax
VAR ReworkFromAllTrain = 
    CALCULATE(
        MAXX(
            FILTER(
                'AllTrain_CSVExport_Joint Record',
                'AllTrain_CSVExport_Joint Record'[Joint ID "JR"] = VALUES('Project WD+WR+INCO+Acciona'[Joint ID])
            ),
            'AllTrain_CSVExport_Joint Record'[Rework Code]
        )
    )

RETURN 
    IF(
        ISBLANK(ReworkFromAllTrain),
        'Project WD+WR+INCO+Acciona'[Rework Code],
        ReworkFromAllTrain
    )
```

#### `Project WD+WR+INCO+Acciona[Temporary Lines]` — format `nan`

```dax
IF (
    RIGHT('Project WD+WR+INCO+Acciona'[ISO Number], 4) = "-PCC",
    "Temporary Lines",
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[Train SG]` — format `nan`

```dax
IF(
    'Project WD+WR+INCO+Acciona'[Service Cat] IN{ "SG","SGCS"},
    MID('Project WD+WR+INCO+Acciona'[Joint ID], 4, 3),
    BLANK() // Вернет пусто, если условие не выполнено
)
```

#### `Project WD+WR+INCO+Acciona[Open_Punch_"X"]` — format `0`

```dax
    VAR Open_Punch_X = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
            ),
            'Testpack-wise Details Report'[Open_Punch "X"]
        )
    RETURN Open_Punch_X
```

#### `Project WD+WR+INCO+Acciona[Reinstatement_Date]` — format `dd-mmm-yy`

```dax
    VAR Reinstatement_Date = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
            ),
            'Testpack-wise Details Report'[Reinstatement Completed Date]
        )
    RETURN Reinstatement_Date
```

#### `Project WD+WR+INCO+Acciona[Open_Punch_"Y"]` — format `nan`

```dax
    VAR Open_Punch_Y = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
            ),
            'Testpack-wise Details Report'[Open_Punch "Y"]
        )
    RETURN Open_Punch_Y
```

#### `Project WD+WR+INCO+Acciona[Open_Punch_"Z"]` — format `0`

```dax
    VAR Open_Punch_Z = 
        MAXX(
            FILTER(
                'Testpack-wise Details Report', 
                'Testpack-wise Details Report'[TEST PACK] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
            ),
            'Testpack-wise Details Report'[Open_Punch "Z"]
        )
    RETURN Open_Punch_Z
```

#### `Project WD+WR+INCO+Acciona[RT Ratio % For WPS "PR all"]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[WPS No.])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[WPS No.])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[RT Ratio % STATUS for WPS]` — format `nan`

```dax
SWITCH(TRUE(),
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] = 0, "0%",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] <= 0.01, "1. <1% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0.01 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] <= 0.02, "2. 1% - 2% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0.02 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] <= 0.05, "3. 2% - 5% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0.05 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] <= 0.10, "4. 5% - 10% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"] > 0.10, "5. > 10% ",
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Ratio % For WPS "PR all"]) &&
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"} &&
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0, "6. No RT",
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[RT Ratio % For Material Type "PR all"]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Material Type])
    ),
    CALCULATE(
        SUM('Project WD+WR+INCO+Acciona'[RT Film Total]),'Project WD+WR+INCO+Acciona'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Project WD+WR+INCO+Acciona', 'Project WD+WR+INCO+Acciona'[Material Type])
    )
) * 1
```

#### `Project WD+WR+INCO+Acciona[RT Ratio % STATUS for Material Type]` — format `nan`

```dax
SWITCH(TRUE(),
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] = 0, "0%",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] <= 0.01, "1. <1% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0.01 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] <= 0.02, "2. 1% - 2% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0.02 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] <= 0.05, "3. 2% - 5% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0.05 && 'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] <= 0.10, "4. 5% - 10% ",
    'Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"] > 0.10, "5. > 10% ",
    ISBLANK('Project WD+WR+INCO+Acciona'[RT Ratio % For Material Type "PR all"]) &&
    'Project WD+WR+INCO+Acciona'[Weld Type] IN {"BW", "GW", "CLET", "MW"} &&
    'Project WD+WR+INCO+Acciona'[Weld Date] > 0, "6. No RT",
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[Status WPQ Welding Process]` — format `nan`

```dax
MAXX(
    FILTER(
        ALL('WPQ WELDING PROCESS'),
        'WPQ WELDING PROCESS'[WPS No.] = 'Project WD+WR+INCO+Acciona'[WPS No.]
    ),
    'WPQ WELDING PROCESS'[Welding process]
)
```

#### `Project WD+WR+INCO+Acciona[Status WPQ Type of Welding Machine]` — format `nan`

```dax
MAXX(
    FILTER(
        ALL('WPQ WELDING PROCESS'),
        'WPQ WELDING PROCESS'[WPS No.] = 'Project WD+WR+INCO+Acciona'[WPS No.]
    ),
    'WPQ WELDING PROCESS'[Type of Welding Machine]
)
```

#### `Project WD+WR+INCO+Acciona[Bracing]` — format `nan`

```dax
    VAR Bracing = 
        MAXX(
            FILTER(
                'Bracing FE_Analysis', 
                'Bracing FE_Analysis'[ISO/SPOOL] = 'Project WD+WR+INCO+Acciona'[Spool ID]
            ),
            'Bracing FE_Analysis'[ISO/SPOOL]
        )
    RETURN Bracing
```

#### `Project WD+WR+INCO+Acciona[Task_Status PIP-018-A "VPR"]` — format `nan`

```dax
VAR Task_Status = 
    MAXX(
        FILTER(
            'SCDB Data l0_scdb_task', 
            'SCDB Data l0_scdb_task'[TAG] = 'Project WD+WR+INCO+Acciona'[TESTPACK No "PR All"]
        ),
        // Возвращаем "Closed" (1), только если статус действительно "closed"
        IF('SCDB Data l0_scdb_task'[Task_Status] = "Closed", 1, 0)
    )

RETURN 
    // Если MAXX нашла хотя бы одно "closed" (т.е. вернула 1), 
    // возвращаем текст "Closed", иначе BLANK()
    IF(Task_Status = 1, "Closed", BLANK())
```

#### `Project WD+WR+INCO+Acciona[Stainless steel]` — format `nan`

```dax
IF (
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[Material Type], "SS") ||
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[Material Type], "DSS") ||
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[Material Type], "SDSS"),
    "Stainless Steel",
    BLANK()
)
```

#### `Project WD+WR+INCO+Acciona[Exlude RT Films from UT]` — format `nan`

```dax
IF (
    // 1. Общие условия (должны выполняться всегда)
    'Project WD+WR+INCO+Acciona'[By UT] = "Y" && 
    'Project WD+WR+INCO+Acciona'[Sub-Contractor] <> "Inco" &&
    CONTAINSSTRING('Project WD+WR+INCO+Acciona'[RT Report], "UT") &&
    
    // 2. Условие "ИЛИ" (скобки обязательны!)
    (
        'Project WD+WR+INCO+Acciona'[Total No of films Rej] > 0 || 
        'Project WD+WR+INCO+Acciona'[RT Film Total] > 0
    ),
    
    "Exclude UT Films",
    BLANK()
)
```

### Table `RT Films Att RT_MI Master Register` (5 calculated columns)

#### `RT Films Att RT_MI Master Register[Report Match]` — format `nan`

```dax
VAR CurrentReport = 'RT Films Att RT_MI Master Register'[RT Report No]
VAR FoundCount = 
    CALCULATE(
        COUNTROWS('Project WD+WR+INCO+Acciona'),
        REMOVEFILTERS('Project WD+WR+INCO+Acciona'),
        'Project WD+WR+INCO+Acciona'[RT Report] = CurrentReport || 
        'Project WD+WR+INCO+Acciona'[RT Re-Shoot Rep] = CurrentReport
    )
RETURN 
    IF(FoundCount > 0, CurrentReport, "Not Found")
```

#### `RT Films Att RT_MI Master Register[Report Match 2]` — format `nan`

```dax
VAR CurrentReport = 'RT Films Att RT_MI Master Register'[RT Report No]
VAR FoundCount = 
    CALCULATE(
        COUNTROWS('RT Films For PBI WD+WR'),
        REMOVEFILTERS('RT Films For PBI WD+WR'),
        'RT Films For PBI WD+WR'[RT Report] = CurrentReport
    )
RETURN 
    IF(FoundCount > 0, CurrentReport, "Not Found")
```

#### `RT Films Att RT_MI Master Register[VPR RT Films]` — format `0`

```dax
VAR CurrentReport = 'RT Films Att RT_MI Master Register'[RT Report No]
VAR ResultValue = 
    CALCULATE(
        MAX('RT Films For PBI WD+WR'[RT Total Films +"CCC RS"]),
        REMOVEFILTERS('RT Films For PBI WD+WR'),
        'RT Films For PBI WD+WR'[RT Report] = CurrentReport
    )
RETURN 
    ResultValue
```

#### `RT Films Att RT_MI Master Register[RT Films Difference]` — format `nan`

```dax
VAR Quantity = 'RT Films Att RT_MI Master Register'[Quantity of RT Films]
VAR VPR = 'RT Films Att RT_MI Master Register'[VPR RT Films]
VAR Result = COALESCE(Quantity, 0) - COALESCE(VPR, 0)
RETURN 
    ROUND(Result, 2)
```

#### `RT Films Att RT_MI Master Register[RT Films Diff <1>]` — format `nan`

```dax
VAR Diff = ABS('RT Films Att RT_MI Master Register'[RT Films Difference])
RETURN 
    SWITCH(
        TRUE(),
        ISBLANK(Diff), BLANK(),
        Diff = 0, "0",
        Diff < 1, "<1",
        Diff > 1, ">1",
        "1" 
    )
```

### Table `SCTR OVERALL APPLIED WELDERS` (1 calculated columns)

#### `SCTR OVERALL APPLIED WELDERS[Total Qualified Welders TXT]` — format `nan`

```dax
CONCATENATEX(
    {1},
    "Total Qualified Welders= " &
    SUM('SCTR OVERALL APPLIED WELDERS'[QUALIFIED  WELDERS]))
```

### Table `Spool Dump` (3 calculated columns)

#### `Spool Dump[PAINTED SURFACE]` — format `nan`

```dax
IF('Spool Dump'[PAINTED]<>0,'Spool Dump'[Surface Area],0)
```

#### `Spool Dump[Spools Straight]` — format `nan`

```dax
if('Spool Dump'[Shop Dia]=0,"Straight Length","Spool")
```

#### `Spool Dump[SPOOL ID]` — format `nan`

```dax
'Spool Dump'[ISO Number]&"-"&'Spool Dump'[Spool No.]
```

### Table `TALISMAN DATA` (22 calculated columns)

#### `TALISMAN DATA[CROSS CHECK DATA JOINT ID]` — format `nan`

```dax
VAR CheckJointID = LOOKUPVALUE(
    'Project WD+WR+INCO+Acciona'[Joint ID],
    'Project WD+WR+INCO+Acciona'[Joint ID],
    'TALISMAN DATA'[Joint ID]
)
RETURN
IF(ISBLANK(CheckJointID), "NO", CheckJointID)
```

#### `TALISMAN DATA[Area Classification]` — format `nan`

```dax
VAR CurrentJoint = 'TALISMAN DATA'[Joint ID]
VAR Result = 
    CALCULATE(
        MAX('Project WD+WR+INCO+Acciona'[Area Classification]),
        REMOVEFILTERS('Project WD+WR+INCO+Acciona'),
        'Project WD+WR+INCO+Acciona'[Joint ID] = CurrentJoint
    )
RETURN 
    Result
```

#### `TALISMAN DATA[Weld Date from Welder Record]` — format `dd-mmm-yy`

```dax
MAXX(
    FILTER(
        'CSVExport_Welder Record', 
        'CSVExport_Welder Record'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'CSVExport_Welder Record'[Weld Date]
)
```

#### `TALISMAN DATA[Weld Date TR/F Talisman & Welder Record]` — format `"TRUE";"TRUE";"FALSE"`

```dax
IF(
    'TALISMAN DATA'[WELD DATE] = 'TALISMAN DATA'[Weld Date from Welder Record], 
    TRUE(), 
    FALSE()
)
```

#### `TALISMAN DATA[Weld Date from Joint Record]` — format `dd-mmm-yy`

```dax
MAXX(
    FILTER(
        'AllTrain_CSVExport_Joint Record', 
        'AllTrain_CSVExport_Joint Record'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'AllTrain_CSVExport_Joint Record'[Weld Date]
)
```

#### `TALISMAN DATA[Weld date TR/F Talisman & Joint Record]` — format `"TRUE";"TRUE";"FALSE"`

```dax
IF(
    'TALISMAN DATA'[WELD DATE] = 'TALISMAN DATA'[Weld Date from Joint Record], 
    TRUE(), 
    FALSE()
)
```

#### `TALISMAN DATA[RT Date from Welder Record]` — format `dd-mmm-yy`

```dax
MAXX(
    FILTER(
        'CSVExport_Welder Record', 
        'CSVExport_Welder Record'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'CSVExport_Welder Record'[RT Date]
)
```

#### `TALISMAN DATA[RT Date TR/F Talisman & Welder Record]` — format `"TRUE";"TRUE";"FALSE"`

```dax
IF(
    'TALISMAN DATA'[RT1 DATE] = 'TALISMAN DATA'[RT Date from Welder Record], 
    TRUE(), 
    FALSE()
)
```

#### `TALISMAN DATA[RT Date from Joint Record]` — format `dd-mmm-yy`

```dax
MAXX(
    FILTER(
        'AllTrain_CSVExport_Joint Record', 
        'AllTrain_CSVExport_Joint Record'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'AllTrain_CSVExport_Joint Record'[RT/UT Date]
)
```

#### `TALISMAN DATA[RT date TR/F Talisman & Joint Record]` — format `"TRUE";"TRUE";"FALSE"`

```dax
IF( 
    'TALISMAN DATA'[RT1 DATE] = 'TALISMAN DATA'[RT Date from Joint Record], 
    TRUE(), 
    FALSE() 
) 
```

#### `TALISMAN DATA[RT Report from Welder Record]` — format `nan`

```dax
MAXX(
    FILTER(
        'CSVExport_Welder Record', 
        'CSVExport_Welder Record'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'CSVExport_Welder Record'[RT Report]
)
```

#### `TALISMAN DATA[RT Report TR/F Talisman & Welder Record]` — format `"TRUE";"TRUE";"FALSE"`

```dax
IF(
    'TALISMAN DATA'[RT1 REP NO] = 'TALISMAN DATA'[RT Report from Welder Record], 
    TRUE(), 
    FALSE()
)
```

#### `TALISMAN DATA[RT Report from Joint Record]` — format `nan`

```dax
MAXX(
    FILTER(
        'AllTrain_CSVExport_Joint Record', 
        'AllTrain_CSVExport_Joint Record'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'AllTrain_CSVExport_Joint Record'[RT/UT Report No]
)
```

#### `TALISMAN DATA[RT Report TR/F Talisman & Joint Record]` — format `"TRUE";"TRUE";"FALSE"`

```dax
IF( 
    'TALISMAN DATA'[RT1 REP NO] = 'TALISMAN DATA'[RT Report from Joint Record], 
    TRUE(), 
    FALSE() 
) 
```

#### `TALISMAN DATA[Joint ID+Welder ID from Welder Record]` — format `nan`

```dax
MAXX(
    FILTER(
        'CSVExport_Welder Record', 
        'CSVExport_Welder Record'[Joint ID+Welder ID] = 'TALISMAN DATA'[Joint ID+Welder ID]
    ),
    'CSVExport_Welder Record'[Joint ID+Welder ID]
)
```

#### `TALISMAN DATA[Joint ID+Welder ID TR/F Talisman & Welder Record]` — format `nan`

```dax
IF( 
    'TALISMAN DATA'[WELDER ID ALL] <> "",  -- Проверка на заполненность Welder ID All
    IF( 
        'TALISMAN DATA'[Joint ID+Welder ID] = 'TALISMAN DATA'[Joint ID+Welder ID from Welder Record],
        "TRUE",  -- Если Joint ID+Welder ID равны, возвращаем строку "TRUE"
        "FALSE"  -- Если не равны, возвращаем строку "FALSE"
    ),
    "No Welder"  -- Если Welder ID All пустое, возвращаем строку "BLANK"
)
```

#### `TALISMAN DATA[RT% from Project WD+WR]` — format `0`

```dax
MAXX(
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        'Project WD+WR+INCO+Acciona'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'Project WD+WR+INCO+Acciona'[RT%]
)
```

#### `TALISMAN DATA[Service Class from Project WD+WR.]` — format `nan`

```dax
MAXX(
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        'Project WD+WR+INCO+Acciona'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'Project WD+WR+INCO+Acciona'[Service class]
)
```

#### `TALISMAN DATA[NDT Remarks from Project WD+WR]` — format `nan`

```dax
MAXX(
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        'Project WD+WR+INCO+Acciona'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'Project WD+WR+INCO+Acciona'[NDT Remarks]
)
```

#### `TALISMAN DATA[Service Class + Service Cat+NDT Remarks from Project WD+WR]` — format `nan`

```dax
MAXX(
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        'Project WD+WR+INCO+Acciona'[Joint ID] = 'TALISMAN DATA'[Joint ID]
    ),
    'Project WD+WR+INCO+Acciona'[Service Class + Service Cat+NDT Remarks]
)
```

#### `TALISMAN DATA[Area Classification from WD+WR]` — format `nan`

```dax
MAXX(
    FILTER(
        'Project WD+WR+INCO+Acciona', 
        'Project WD+WR+INCO+Acciona'[PDS Area] = 'TALISMAN DATA'[AREA]
    ),
    'Project WD+WR+INCO+Acciona'[Area Classification]
)
```

#### `TALISMAN DATA[WeldPoint No.1 WP1]` — format `0`

```dax
VAR CurrentWP = 'TALISMAN DATA'[Index]
VAR CurrentJointID = 'TALISMAN DATA'[Joint ID]
RETURN
    COUNTROWS(
        FILTER(
            'TALISMAN DATA',
            'TALISMAN DATA'[Joint ID] = CurrentJointID &&
            'TALISMAN DATA'[Index] < CurrentWP
        )
    ) + 1
```

### Table `Talisman Spool Dump` (3 calculated columns)

#### `Talisman Spool Dump[Status Released]` — format `nan`

```dax
IF(
    'Talisman Spool Dump'[QC SPOOL RELEASED TO NDT/PWHT]>0,"Fabricated","")
```

#### `Talisman Spool Dump[Sub-Contractor]` — format `nan`

```dax
"CCC"
```

#### `Talisman Spool Dump[Status PWHT Spool Date]` — format `nan`

```dax
IF(
    'Talisman Spool Dump'[PWHT Date Spool]>0,"Spool PWHT","")
```

### Table `Testpack-wise Details Report` (4 calculated columns)

#### `Testpack-wise Details Report[Open_Punch "X"]` — format `0`

```dax
CALCULATE (
    COUNTROWS ( 'Testpack-wise Details Report' ), // Считаем строки
    ALLEXCEPT ( 'Testpack-wise Details Report', 'Testpack-wise Details Report'[TEST PACK] ), // Учитываем только текущий TestPack
    'Testpack-wise Details Report'[Punch CAT] = "X", // Фильтр по категории "X"
    ISBLANK ( 'Testpack-wise Details Report'[Punch Clearance Date] ) // Фильтр по пустой дате
)
```

#### `Testpack-wise Details Report[Open_Punch "Y"]` — format `0`

```dax
CALCULATE (
    COUNTROWS ( 'Testpack-wise Details Report' ), // Считаем строки
    ALLEXCEPT ( 'Testpack-wise Details Report', 'Testpack-wise Details Report'[TEST PACK] ), // Учитываем только текущий TestPack
    'Testpack-wise Details Report'[Punch CAT] = "Y", // Фильтр по категории "Y"
    ISBLANK ( 'Testpack-wise Details Report'[Punch Clearance Date] ) // Фильтр по пустой дате
)
```

#### `Testpack-wise Details Report[Open_Punch "Z"]` — format `0`

```dax
CALCULATE (
    COUNTROWS ( 'Testpack-wise Details Report' ), // Считаем строки
    ALLEXCEPT ( 'Testpack-wise Details Report', 'Testpack-wise Details Report'[TEST PACK] ), // Учитываем только текущий TestPack
    'Testpack-wise Details Report'[Punch CAT] = "Z", // Фильтр по категории "Y"
    ISBLANK ( 'Testpack-wise Details Report'[Punch Clearance Date] ) // Фильтр по пустой дате
)
```

#### `Testpack-wise Details Report[Stasus in Punch Description]` — format `nan`

```dax
SWITCH (
    TRUE (),
    CONTAINSSTRING ( 'Testpack-wise Details Report'[Punch Description], "Heat" ), "Heat",
    CONTAINSSTRING ( 'Testpack-wise Details Report'[Punch Description], "material" ), "material",
    CONTAINSSTRING ( 'Testpack-wise Details Report'[Punch Description], "batch" ), "batch",
    CONTAINSSTRING ( 'Testpack-wise Details Report'[Punch Description], "traceability" ), "traceability",
    BLANK ()
)
```

### Table `WELDERS_Qualification` (2 calculated columns)

#### `WELDERS_Qualification[Welder ID in System]` — format `nan`

```dax
LOOKUPVALUE('Project WD+WR+INCO+Acciona'[Welder ID],
'Project WD+WR+INCO+Acciona'[Welder ID],
WELDERS_Qualification[Welder ID Code+Sub],"Not found")
```

#### `WELDERS_Qualification[Dublicate Welders]` — format `nan`

```dax
VAR CurrentWelderNo = 'WELDERS_Qualification'[Welder No.]
VAR DistinctSubContractorsCount = 
    CALCULATE(
        DISTINCTCOUNT('WELDERS_Qualification'[Sub-Contractor]),
        ALLEXCEPT('WELDERS_Qualification', 'WELDERS_Qualification'[Welder No.])
    )
RETURN
    IF(
        DistinctSubContractorsCount > 1,
        CurrentWelderNo,
        BLANK()
    )
```

### Table `Weld Dump` (26 calculated columns)

#### `Weld Dump[Welded Dia]` — format `0`

```dax
     var weld = 'Weld Dump'[Joint ID]

     var Outcome = CALCULATE(COUNT('Weld Dump'[Joint ID]),FILTER('Weld Dump','Weld Dump'[Joint ID]= weld))

Return

'Weld Dump'[Dia inch]/Outcome
```

#### `Weld Dump[Total Welded Dia]` — format `nan`

```dax
IF('Weld Dump'[Weld Date]<>0,'Weld Dump'[Dia inch],0)
```

#### `Weld Dump[Repair & Reweld]` — format `nan`

```dax
if(right('Weld Dump'[Weld No.],2)="R1","Repair",
if(right('Weld Dump'[Weld No.],2)="R2","Repair",
if(right('Weld Dump'[Weld No.],2)="RW","Reweld","")))
```

#### `Weld Dump[No of Days "WD"]` — format `0`

```dax
DATEDIFF([Weld Date], TODAY(), DAY)
```

#### `Weld Dump[Fabricated Date]` — format `d mmmm\, yyyy`

```dax
LOOKUPVALUE('Spool Dump'[FABRICATED],
'Spool Dump'[SPOOL ID],'Weld Dump'[Spool ID])
```

#### `Weld Dump[Status FABRICATED]` — format `nan`

```dax
IF('Weld Dump'[Fabricated Date]>0,"Fabricated","")
```

#### `Weld Dump[QC Release Date]` — format `d mmmm\, yyyy`

```dax
LOOKUPVALUE('Spool Dump'[QC RELEASE],
'Spool Dump'[SPOOL ID],'Weld Dump'[Spool ID])
```

#### `Weld Dump[Status QC Release]` — format `nan`

```dax
IF('Weld Dump'[QC Release Date]>0,"QC RELEASE","")
```

#### `Weld Dump[PAINTED Date]` — format `d mmmm\, yyyy`

```dax
LOOKUPVALUE('Spool Dump'[PAINTED],
'Spool Dump'[SPOOL ID],'Weld Dump'[Spool ID])
```

#### `Weld Dump[Status PAINTED]` — format `nan`

```dax
IF('Weld Dump'[PAINTED Date]>0,"PAINTED","")
```

#### `Weld Dump[Status Spool NDE]` — format `nan`

```dax
LOOKUPVALUE('Spool Dump'[Spool Nde Status],
'Spool Dump'[SPOOL ID],'Weld Dump'[Spool ID])
```

#### `Weld Dump[To Site Date]` — format `nan`

```dax
LOOKUPVALUE('Spool Dump'[TO SITE],
'Spool Dump'[SPOOL ID],'Weld Dump'[Spool ID])
```

#### `Weld Dump[Status To Site]` — format `nan`

```dax
IF('Weld Dump'[ERECTED Date]>0,"TO SITE","")
```

#### `Weld Dump[ERECTED Date]` — format `nan`

```dax
LOOKUPVALUE('Spool Dump'[ERECTED],
'Spool Dump'[SPOOL ID],'Weld Dump'[Spool ID])
```

#### `Weld Dump[Status ERECTED]` — format `nan`

```dax
IF('Weld Dump'[ERECTED Date]>0,"ERECTED","")
```

#### `Weld Dump[Last Status]` — format `nan`

```dax
    IF('Weld Dump'[Status ERECTED]<>"","ERECTED",
IF('Weld Dump'[Status To Site]<>"","TO SITE",
IF('Weld Dump'[Status PAINTED]<>"","PAINTED",
IF('Weld Dump'[Status Spool NDE]="Not Released","NOT Released",
IF('Weld Dump'[Status Spool NDE]="Released","RELEASED",
IF('Weld Dump'[Status QC Release]<>"","QC Release",
IF('Weld Dump'[Status FABRICATED]<>"","Fabricated")))))))
```

#### `Weld Dump[Last_Weld Date]` — format `dd-mmm-yy`

```dax
LASTDATE('Weld Dump'[Weld Date])
```

#### `Weld Dump[Days Since Last Weld]` — format `0`

```dax
IF(ISBLANK([Last_Weld Date]),BLANK(),
VALUE([Cur_Date]-[Last_Weld Date]))
```

#### `Weld Dump[RT Film Ratio % "WD" For Welder]` — format `0.00%;-0.00%;0.00%`

```dax
DIVIDE(
    CALCULATE(
        SUM('Weld Dump'[Total No of films Rej]),
        ALLEXCEPT('Weld Dump', 'Weld Dump'[Welder])
    ),
    CALCULATE(
        SUM('Weld Dump'[Total No Films A+R]),'Weld Dump'[RT Acc/Rej]<>"RS",
        ALLEXCEPT('Weld Dump', 'Weld Dump'[Welder])
    )
) * 1
```

#### `Weld Dump[Total No Films A+R]` — format `0`

```dax
'Weld Dump'[Total No of films Acc]+'Weld Dump'[Total No of films Rej]
```

#### `Weld Dump[RT FILM Ratio % STATUS "WD"]` — format `nan`

```dax
 IF (
    'Weld Dump'[RT Film Ratio % "WD" For Welder] >= 0 && 'Weld Dump'[RT Film Ratio % "WD" For Welder] < 0.05,
    "1. 0 to 5% - ok",
    IF (
        'Weld Dump'[RT Film Ratio % "WD" For Welder] >= 0.05 && 'Weld Dump'[RT Film Ratio % "WD" For Welder] < 0.075,
        "2. 5 to 7.5%-monitor",
        IF (
            'Weld Dump'[RT Film Ratio % "WD" For Welder] >= 0.075 && 'Weld Dump'[RT Film Ratio % "WD" For Welder] < 0.10,
            "3. 7.5 to 10%-Critical",
            IF (
                'Weld Dump'[RT Film Ratio % "WD" For Welder] >= 0.10 && 'Weld Dump'[RT Film Ratio % "WD" For Welder] <= 1,
                "4. 10 to 100% - Disq.F",
                BLANK()
            )
        )
    )
)
```

#### `Weld Dump[Service Class+Service Cat "WD"]` — format `nan`

```dax
'Weld Dump'[Service class]&" "&'Weld Dump'[Service Cat]
```

#### `Weld Dump[Last_RT Date "EP"]` — format `dd-mmm-yy`

```dax
LASTDATE('Weld Dump'[RT Date])
```

#### `Weld Dump[Days Since Last RT "EP"]` — format `nan`

```dax
IF(ISBLANK([Last_RT Date "EP"]),BLANK(),
VALUE([Cur_Date]-[Last_RT Date "EP"]))
```

#### `Weld Dump[TMCP Pipe]` — format `nan`

```dax
    IF('Weld Dump'[Service class]="9C3AQN" &&
    'Weld Dump'[Dia inch]=46,
    "TMCP Pipe")
```

#### `Weld Dump[Temporary Lines "WD"]` — format `nan`

```dax
IF (
    RIGHT('Weld Dump'[ISO Number], 4) = "-PCC",
    "Temporary Lines",
    BLANK()
)
```

### Table `l2_ndt_list` (4 calculated columns)

#### `l2_ndt_list[REPORTS All DataBase]` — format `nan`

```dax
VAR JointID = 'l2_ndt_list'[Joint_ID]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    SWITCH (
        TRUE (),
        ReportType = "RT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[RT Report] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "PWHT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[PWHT Report "PR All"] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "MT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[MT Report "PR All"] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "UT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[Manual UT Report No.] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "PMI", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[PMI Report "PR All"] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "HT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[HT Report "PR All"] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "PT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[PT Report "PR All"] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "ORIF", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[ORIF Report] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "PADLT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[PADLT Report] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "VI", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[DWIR Report "PR All"] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "VBT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[VBT Report] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        ReportType = "OPT", CALCULATE ( MAX ( 'Project WD+WR+INCO+Acciona'[OPT Report] ), 'Project WD+WR+INCO+Acciona'[Joint ID] = JointID ),
        BLANK ()
    )
```

#### `l2_ndt_list[Joint ID AllData "Pr all"]` — format `nan`

```dax
CALCULATE(
    MAXX(
        FILTER(
            'Project WD+WR+INCO+Acciona',
            'Project WD+WR+INCO+Acciona'[Joint ID] = VALUES('l2_ndt_list'[Joint_ID])
                && 'Project WD+WR+INCO+Acciona'[Joint ID] <>""
        ),
        'Project WD+WR+INCO+Acciona'[Joint ID]
    )
)
```

#### `l2_ndt_list[CROSS CHECK FRB DATA REPORTS & PRJ]` — format `nan`

```dax
VAR RTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "RT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[RT Report] = RTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[RT Report] = RTReport
                ),
                'Project WD+WR+INCO+Acciona'[RT Report]
            )
        ),
VAR MTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "MT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[MT Report "PR All"] = MTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[MT Report "PR All"] = MTReport
                ),
                'Project WD+WR+INCO+Acciona'[MT Report "PR All"]
            )
        ),
VAR PWHTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "PWHT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[PWHT Report "PR All"] = PWHTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[PWHT Report "PR All"] = PWHTReport
                ),
                'Project WD+WR+INCO+Acciona'[PWHT Report "PR All"]
            )
        ),
VAR UTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "UT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[Manual UT Report No.] = UTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[Manual UT Report No.] = UTReport
                ),
                'Project WD+WR+INCO+Acciona'[Manual UT Report No.]
            )
        ),
VAR PMIReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "PMI",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[PMI Report "PR All"] = PMIReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[PMI Report "PR All"] = PMIReport
                ),
                'Project WD+WR+INCO+Acciona'[PMI Report "PR All"]
            )
        ),
VAR PTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "PT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[PT Report "PR All"] = PTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[PT Report "PR All"] = PTReport
                ),
                'Project WD+WR+INCO+Acciona'[PT Report "PR All"]
            )
        ),
VAR HTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "HT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[HT Report "PR All"] = HTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[HT Report "PR All"] = HTReport
                ),
                'Project WD+WR+INCO+Acciona'[HT Report "PR All"]
            )
        ),
VAR ORIFReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "ORIF",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[ORIF Report] = ORIFReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[ORIF Report] = ORIFReport
                ),
                'Project WD+WR+INCO+Acciona'[ORIF Report]
            )
        ),
VAR PADLTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "PADLT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[PADLT Report] = PADLTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[PADLT Report] = PADLTReport
                ),
                'Project WD+WR+INCO+Acciona'[PADLT Report]
            )
        ),
VAR DWIRReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "VI",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[DWIR Report "PR All"] = DWIRReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[DWIR Report "PR All"] = DWIRReport
                ),
                'Project WD+WR+INCO+Acciona'[DWIR Report "PR All"]
            )
        ),
VAR VBTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "VBT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[VBT Report] = VBTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[VBT Report] = VBTReport
                ),
                'Project WD+WR+INCO+Acciona'[VBT Report]
            )
        ),
VAR OPTReport = 'l2_ndt_list'[Origin_Report_No]
VAR ReportType = 'l2_ndt_list'[Report_Type]
RETURN
    IF (
        ReportType = "OPT",
        IF (
            ISEMPTY (
                FILTER (
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[OPT Report] = OPTReport
                )
            ),
            "Not Found",
            MAXX(
                FILTER(
                    'Project WD+WR+INCO+Acciona',
                    'Project WD+WR+INCO+Acciona'[OPT Report] = OPTReport
                ),
                'Project WD+WR+INCO+Acciona'[OPT Report]
            )
        ),
        BLANK()
    ))))))))))))
```

#### `l2_ndt_list[Uniq Report]` — format `nan`

```dax
l2_ndt_list[Origin_Report_No] & "-" & l2_ndt_list[SCTR] & "-" & l2_ndt_list[Report_Type]
```

## Calculated tables on real tables (1)

### `Calendar`

```dax
CALENDAR("5/8/2021","31/12/2026")
```

