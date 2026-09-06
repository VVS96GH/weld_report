# Batch 4 — `WPQ RECORD REGISTER/` mapped onto the model, the measures and our schema

Evidence: `analysis/sources4/workbooks.md` (every count measured by
`uv run analysis/sources4/profile.py`), `analysis/pbix/model.md` (the M and the
relationships), `analysis/pbix/measures.md`, `analysis/pbix/report-inventory.md`,
`analysis/calculation-logic.md` §M91 / §5 / §7, `db/README.md`, `lib/metrics/refs.ts`.
Join coverage measured against the live database (read-only), §6.

**Headline: this delivery closes R-01 row 15.** Five pbix tables are fed by four of the
five files, and **all five reproduce their stored pbix row count exactly** — 318 / 266 /
71 / 127 / 34. Nothing here needed a judgement call to reconcile.

---

## 0. The five files → the five pbix tables

| file | member the M asks for | pbix table | pbix rows | measured | verdict |
|---|---|---|---:|---:|---|
| `WPQ RECORD REGISTER.xlsx` | `[Name="CONSOLIDATED"]` (sheet) | `WPQ RECORD REGISTER` | 318 | **318** | ✅ |
| `WPQ RECORD REGISTER.xlsx` | `[Item="WELDING PROCESS",Kind="Sheet"]` | `WPQ WELDING PROCESS` | 266 | **266** | ✅ |
| `WPS PWHT Status.xlsx` | `[Item="PWHT Status",Kind="Sheet"]` | `PWHT Status` | 34 | **34** | ✅ |
| `CUM WPS Status.xlsx` | `[Item="WPS Status",Kind="Sheet"]` | `WPS Status CUM` | 127 | **127** | ✅ |
| `WPS-WPQT Record Register Rev_0 24-01-25.xls` | `[Name="WPS Reg#"]` | `WPS Reg#` | 71 | **71** | ✅ (but see R4-04) |
| `WPS (Welding Process).csv` | — | **none** | — | 266 | export, not a source |

---

## 1. `WPQ RECORD REGISTER` — M91 `WPS Approved` (the page-1 KPI)

### The M, step by step

```m
Source        = Excel.Workbook(File.Contents("…\WPQ RECORD REGISTER\WPQ RECORD REGISTER.xlsx"), null, true),
CONSOLIDATED1 = Source{[Name="CONSOLIDATED"]}[Data],          -- a SHEET, not a Table
#"Changed Type"      = … Column1..Column20 → type text,
#"Removed Top Rows"  = Table.Skip(#"Changed Type",3),          -- 3 banner rows
#"Promoted Headers"  = Table.PromoteHeaders(…, [PromoteAllScalars=true]),
#"Changed Type1"     = … {"S.N",Int64}, {"SCTR",text}, {"WPS NO.",text}, {"WPS Rev. No.",text},
                       {"PQR #(lf)No/Rev.",text}, {"WELDING PROCESS (ES)",text}, {"Column7",text},
                       {"PQR Material #(lf)Seamless / Welder Pipes & Plate",text}, {"Column9",text},
                       {"PWHT ",text}, {" DOCUMENT STATUS",text}, {"APPLICATION",text},
                       {"Column13".."Column18",text}, {"CODE ",Int64}, {"REMARKS",text},
#"Removed Columns"   = Table.RemoveColumns(…,{"Column13".."Column18","CODE ","REMARKS"}),
#"Filtered Rows"     = Table.SelectRows(…, each ([#"WPS NO."] <> null)),
#"Trimmed Text"      = Table.TransformColumns(…,{{"WPS NO.", Text.Trim, type text}})
```

No rename step. The header the M promotes is Excel row 4; rows 1–3 are the
`Project Title` / `APPLICABLE CODES` / `PQR FORECAST LIST` banners.

### ⚠️ The M is stale — the sheet gained a left-hand column

The delivered `CONSOLIDATED` is **21 columns wide with an all-blank column A**. After
`Skip(3) + PromoteHeaders` the header reads

`Column1`, `S.N`, `SCTR`, `WPS NO.`, `WPS Rev. No.`, `PQR ⏎No/Rev.`,
`WELDING PROCESS (ES)`, **`Column8`**, `PQR Material ⏎Seamless / Welder Pipes & Plate`,
**`Column10`**, `PWHT `, ` DOCUMENT STATUS`, `APPLICATION`, `Column14`…`Column19`,
`CODE `, `REMARKS`

— every auto-named blank column is shifted by one against the M's `Column7`/`Column9`
and `Column13..Column18`. `Table.RemoveColumns` has no `MissingField.Ignore`, so the M
would **raise on refresh**. This is the same failure mode as ruling R3-09
(`SCTR NFE WELDERS APPLIED.xls`). Row count is unaffected: dropping the two blank
columns by name yields exactly the pbix's 12 columns and **318 rows**.

### The measure — verbatim

M91 is **not a stored DAX measure**. It is a visual-level aggregation with a
visual-level filter (`analysis/pbix/report-inventory.md`, card `eeee95e2e0e05229cd71`):

```
Values: DistinctCount(WPQ RECORD REGISTER[WPS NO.])   as "WPS Approved"
sort:   DistinctCount(WPQ RECORD REGISTER[WPS NO.]) Descending
filter [Categorical]: WPQ RECORD REGISTER[ DOCUMENT STATUS]
        -> WPQ RECORD REGISTER[ DOCUMENT STATUS] IN {WPS APPROVED BY CTJV/ CPY}
```

**"Approved" means exactly one thing: the text of `[ DOCUMENT STATUS]` equals
`WPS APPROVED BY CTJV/ CPY`** — note the leading space in the column name and the
space after the slash in the value. `lib/metrics/refs.ts` already pins that string as
`WPS_APPROVED_STATUS`; it is correct, character for character.

### The value

`[ DOCUMENT STATUS]` in the delivered register has **one distinct value**:

| ` DOCUMENT STATUS` | rows | distinct `WPS NO.` |
|---|---:|---:|
| `WPS APPROVED BY CTJV/ CPY` | 318 | 318 |

so **M91 = 318**, and the filter is a **no-op on today's file** — the analyst deletes a
WPS from the register rather than marking it un-approved. Corroborated independently by
`CUM WPS Status.xlsx`, whose latest week (`2026-08-28`) also reads `WPS Approved` = 318.

The mockup snapshot shows **294**. That is the value this same weekly series held from
`2025-10-17` to `2026-03-20`; it stepped to 318 on `2026-03-27`. The pbix was refreshed
in that window and the delivered register is simply newer — the two are consistent, not
contradictory. See R4-02.

### Report pages

| pbix page | binding |
|---|---|
| 17 `RT/UT Progress Project` | card "WPS Approved" |
| 18 `RT/UT Progress Project Dia Inch` | card "WPS Approved" |
| 19 `RT/UT Films Progress Project` | card "WPS Approved" |
| **21 `REP. Project Welding Progress +Inco+Acciona`** | card "WPS Approved" → **mockup page 1** (`analysis/calculation-logic.md` §2.2 line for page 1) |
| 105 `SCTR OVERALL APPLIED WELDERS / WPQ RECORD REGISTER` | pivot: SCTR × ( DOCUMENT STATUS, WPS NO., WPS Rev. No., PQR No/Rev., WELDING PROCESS (ES), PWHT ) with `DistinctCount(WPS NO.)` — an internal QA page, **not** one of the 44 mockup pages |

Only the page-1 KPI is in the mockup contract. `lib/pages/welding.ts:1273` already has
the `case "WPS Approved"` arm; `tests/metrics-batch3.test.ts:267` asserts it is an
em-dash *because the register was missing* — that test must flip with this load (R4-02).

### Schema

`ref_wps_register(wps_no text PK, document_status text, as_of date, notes text)` exists
and is empty (`db/migrations/0004_reference.sql:46`). `wps_no` **is** unique in the file
(318 distinct over 318 rows), so the PK holds. **Widen, do not replace** — the two extra
columns page 105 needs are cheap and the existing PK/shape is right:

```sql
ALTER TABLE ref_wps_register
  ADD COLUMN sctr                 text,   -- SCTR:  CCC 83 / TEKFEN 79 / GAC 61 / INCO 32
                                          --        MED GULF 29 / CCC (DANEM) 17 / ACCIONA-DJ 15 / ACCIONA-FD 2
  ADD COLUMN wps_rev_no           text,   -- '0','1','2','3','4','5','A','B','N/A' — TEXT, not int
  ADD COLUMN pqr_no_rev           text,
  ADD COLUMN welding_process_es   text,
  ADD COLUMN welding_process_mode text,   -- the M's blank-headed `Column7` (this file's `Column8`)
  ADD COLUMN pqr_material_1       text,
  ADD COLUMN pqr_material_2       text,   -- the M's `Column9` (this file's `Column10`)
  ADD COLUMN pwht                 text,   -- 'NO' 224 / 'YES' 84 / 'No' 9 / 1 blank — raw token, R-04 discipline
  ADD COLUMN application          text;   -- 18 blanks
```

**Columns the metrics need:** `wps_no` + `document_status` only (M91). Everything else is
for the page-105 pivot and for provenance; load it, wire it when that page is built.

**Do not join `ref_wps_register.wps_no` to `weld.wps_no`.** The pbix does not, and the
namespaces differ on purpose — see §6.

---

## 2. `WPQ WELDING PROCESS` — the three-relationship join table

### The M — verbatim

```m
let
    Source = Excel.Workbook(File.Contents("…\WPQ RECORD REGISTER\WPQ RECORD REGISTER.xlsx"), null, true),
    #"WELDING PROCESS_Sheet" = Source{[Item="WELDING PROCESS",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"WELDING PROCESS_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Sn.", Int64.Type}, {"SCNTR", type text},
        {"WPS No.", type text}, {"Welding process", type text}, {"Type of Welding Machine", type text}}),
    #"Replaced Value Null - TBN" = Table.ReplaceValue(#"Changed Type",null,"TBN",Replacer.ReplaceValue,{"Welding process"})
in
    #"Replaced Value Null - TBN"
```

Clean: no skip, no filter, no rename. **This M still matches the delivered sheet
exactly** — it is the one M in this batch that would refresh without error. The
`null → "TBN"` replace fires on **0** rows today (`Welding process` has no blanks; the
literal `TBN` that does appear sits in `Type of Welding Machine`, which the replace does
not touch). `SCNTR` is blank on **24** of 266 rows.

### The measures — verbatim

Two calculated columns on the union fact table (`analysis/pbix/measures.md:11292`,
`:11304`), no measures:

```dax
Project WD+WR+INCO+Acciona[Status WPQ Welding Process] =
MAXX(
    FILTER(
        ALL('WPQ WELDING PROCESS'),
        'WPQ WELDING PROCESS'[WPS No.] = 'Project WD+WR+INCO+Acciona'[WPS No.]
    ),
    'WPQ WELDING PROCESS'[Welding process]
)
```

```dax
Project WD+WR+INCO+Acciona[Status WPQ Type of Welding Machine] =
MAXX(
    FILTER(
        ALL('WPQ WELDING PROCESS'),
        'WPQ WELDING PROCESS'[WPS No.] = 'Project WD+WR+INCO+Acciona'[WPS No.]
    ),
    'WPQ WELDING PROCESS'[Type of Welding Machine]
)
```

Both are `ALL()`-scoped lookups on `WPS No.` — i.e. a plain `LEFT JOIN … ON wps_no`,
`MAXX` only because DAX needs a scalar. In SQL that is
`left join ref_wps_process p on p.wps_no = w.wps_no`.

### The relationships (model.md §relationships)

| from | to | cardinality | direction | active |
|---|---|---|---|---|
| `CSVExport_Welder Record[WPS No.]` | `WPQ WELDING PROCESS[WPS No.]` | M:1 | Single | yes |
| `PWHT Status[WPS No.]` | `WPQ WELDING PROCESS[WPS No.]` | **1:1** | **Both** | yes |
| `WPQ WELDING PROCESS[Sn.]` | `Flg CCC_Flange Repair[SN]` | 1:1 | Both | yes |

* the 1:1 on `WPS No.` is satisfiable on the file's side: **266 distinct over 266 rows,
  no duplicates**. It is *not* fully matched from the `PWHT Status` side — 3 of that
  table's 34 keys (`CS/LTCS-AUT-003`, `CS/LTCS-AUT-009`, `CS/LTCS-AUT-010`) have no row
  in `WELDING PROCESS`. In Power BI those land in the blank row; in SQL they are simply
  an outer-join miss. No action, but it means "1:1" is aspirational, not enforced.
* `WPQ WELDING PROCESS[Sn.] ↔ Flg CCC_Flange Repair[SN]` is a **1..266 row-number joined
  to a row-number** — a spurious auto-detected relationship between two unrelated tables
  (same trap as `WPQ RECORD REGISTER[S.N]` and `WPS Reg#[S.N]`, both also wired to
  `Flg CCC_Flange Repair[SN]`). **Never reproduce it.** Ruling R4-05.

### Report pages

`Status WPQ Welding Process` / `Status WPQ Type of Welding Machine` appear as table
columns on pbix pages **13** (`Project Weld Progress "PR all"`), **135**
(`WPS / Material for Managment`), **136** (`WPS for Managment`) and **137**
(`Material for Managment`) — all internal/management pages, none of them one of the 44
mockup pages. **Nothing in the mockup contract binds this table today**; it is loaded so
the two fact-side lookups exist when those pages are ported.

### Schema — new table

```sql
CREATE TABLE ref_wps_process (
  wps_no      text PRIMARY KEY,          -- 266 distinct / 266 rows
  sn          integer,                   -- the sheet's row number; NOT a join key (R4-05)
  sctr        text,                      -- 24 rows blank → NULL
  welding_process        text NOT NULL,  -- post `null → 'TBN'`; 17 distinct
  welding_machine_type   text            -- 12 distinct, incl. a literal 'TBN' on 1 row
);
```

Join: `ref_wps_process.wps_no = weld.wps_no` (and therefore `mv_joint.wps_no`).
**Columns the metrics need:** `wps_no`, `welding_process`, `welding_machine_type`.

---

## 3. `PWHT Status` — a 34-row WPS → Y/N rule table

### The M — verbatim

```m
let
    Source = Excel.Workbook(File.Contents("…\WPQ RECORD REGISTER\WPS PWHT Status.xlsx"), null, true),
    #"PWHT Status_Sheet" = Source{[Item="PWHT Status",Kind="Sheet"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(#"PWHT Status_Sheet",{{"Column1", type text}, {"Column2", type text}}),
    #"Promoted Headers" = Table.PromoteHeaders(#"Changed Type", [PromoteAllScalars=true])
in
    #"Promoted Headers"
```

Note the order: `Changed Type` **before** `PromoteHeaders`, and only two of the three
columns are typed — which is why the pbix table has three columns
(`WPS No.`, `PWHT(Y/N)`, `Thickness`) with the third arriving untyped. Matches the file.

### The measures

**None.** Grepping all 448 measures and all 145 report pages for `PWHT Status[` returns
nothing but the relationship row in `model.md:157`. The table is a pure lookup with one
active 1:1 edge into `WPQ WELDING PROCESS` and **no visual binds it**.

Its content is the same rule the `PWHT RULE 14 01 2025.txt` / `CCC PWHT Y N … .txt` notes
spell out in DAX: 17 `Y`, 17 `N`, and `Thickness = '25mm to 38.1'` on exactly the two WPS
(`CS/LTCS-015`, `CS/LTCS-AUT-011`) that the `PWHT Y/N CCC (NEW)` column singles out with
`Thickness > 25 && Thickness <= 38`. It is the *reference sheet behind* that calculated
column, already reproduced in `analysis/calculation-logic.md` — **it does not supply a
new number** and must not silently override `weld.pwht_y_n` (R-04 / `PWHT_AMBIGUOUS_TOKEN`).

### Schema — new table

```sql
CREATE TABLE ref_wps_pwht_status (
  wps_no        text PRIMARY KEY,   -- 34 distinct / 34 rows
  pwht_yn       text NOT NULL,      -- 'Y' 17 / 'N' 17
  thickness_note text              -- '25mm to 38.1' on 2 rows, else NULL
);
```

**Columns the metrics need:** none today. Load it as documentation of the PWHT rule and
as the lookup the pbix's 1:1 edge implies; wire nothing to it without a ruling.

---

## 4. `WPS Status CUM` — the weekly WPS submitted/approved series

### The M — verbatim

```m
let
    Source = Excel.Workbook(File.Contents("…\WPQ RECORD REGISTER\CUM WPS Status.xlsx"), null, true),
    #"WPS Status_Sheet" = Source{[Item="WPS Status",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"WPS Status_Sheet", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",
        {{"Week_End_Date", type date}, {"WPS Submitted", Int64.Type}, {"WPS Approved", Int64.Type}})
in
    #"Changed Type"
```

Structurally identical to `CUM MPI Done` — same author, same shape, same
cumulative-running-total semantics (`db/README.md` note on `ref_mpi_done`). 127 weekly
rows, `2024-03-29` → `2026-08-28`, no sub-contractor column, no gaps, no blanks.

### The measures / visuals

No stored measures. Two `clusteredColumnChart` "WPS Status" visuals, both plotting
`Sum(WPS Status CUM[WPS Submitted])` and `Sum(WPS Status CUM[WPS Approved])` over
`Calendar[Week_End_Date]`, TopN 10 (page 78) / TopN 12 (page 105) by
`Max(WPS Status CUM[Week_End_Date]) DESC`:

* pbix page **78** `MPI Done`
* pbix page **105** `SCTR OVERALL APPLIED WELDERS / WPQ RECORD REGISTER`

Neither is one of the 44 mockup pages. `Sum(WPS Status CUM[WPS Approved])` also shows up
as an inert "no restriction set" advanced filter on the neighbouring MPI charts —
Power BI residue, not a filter.

### Schema — new table

```sql
CREATE TABLE ref_wps_status_cum (
  week_end_date  date PRIMARY KEY,   -- 127 distinct / 127 rows
  wps_submitted  integer NOT NULL,   -- 269 → 318, cumulative
  wps_approved   integer NOT NULL    -- 194 → 318, cumulative
);
```

Project-wide, no `sub_contractor` — exactly like `ref_mpi_done`. **Columns the metrics
need:** all three, but only when the MPI-Done page is ported. Its immediate value is as
the independent check on M91 (§1).

Follow `ref_mpi_done`'s precedent and *also* seed `weld_weekly_snapshot` as
`M91S`/`M91A` with `sub_contractor = 'PROJECT'`? **No** — R3-13 already ruled that
weekly reference series get their own table rather than new `weld_weekly_snapshot`
metric ids, and `ref_mpi_done`'s double-write is the exception that predates it.
Ruling R4-06.

---

## 5. `WPS Reg#` — the dated `.xls`, an older and narrower revision

### The M and why it would fail

```m
Source     = Excel.Workbook(File.Contents("…\WPS-WPQT Record Register Rev_0 24-01-25.xls"), null, true),
#"WPS Reg#1" = Source{[Name="WPS Reg#"]}[Data],
… Column1..Column25 → text, Table.Skip(…,5), Table.PromoteHeaders,
… Table.AddColumn("Material Type", each if Text.Contains([#"WPS NO."],"CS/LTCS") then "CS/LTCS" else … ),
… Table.SelectRows(each [S.N] <> " CU NI" and … and [S.N] <> "STRUCTURAL STEEL AWS D1.1"),   -- 9 banner rows
… Table.RenameColumns({{"Column9","PQR Material Seamless / Welder Pipes & Plate Mat.2"},
                        {"Actual PQR ","Actual PQR THICKNESS MM"}, {"Column11","Actual PQR DIA MM"},
                        {"Column12","Actual PQR DIA IN"}, {"Column7","WELDING PROCESS (ES)2"}, …}),
… Table.SelectRows(each [Mat.2] <> "Mat. 2" and [S.N] <> null),
… Table.ReplaceValue("#(lf)"," ", …{"PQR No/Rev."}), Text.Trim on the doc-number column
```

The delivered workbook's **only** sheet is `WPS Reg.` — a **period**, not a `#` — and its
defined names are `_FilterDatabase`, `_xlfn._FV`, `Print_Area`, `Print_Titles`. There is
no member called `WPS Reg#`, so `Source{[Name="WPS Reg#"]}` returns no row and the step
**raises**. Everything after that matches: `Skip(5)` lands on the real header, the nine
material-band banner rows and the `Mat. 2` sub-header drop as written, and the result is
**71 rows — the pbix count exactly**.

### The measures

None. One pbix page binds it: **127 `WPS Reg#`**, a flat 26-column table plus slicers on
`Material Type` / `WPS NO.` / `PWHT/NACE  ` / `Line Class`. Not a mockup page.

### Is it the same register as `CONSOLIDATED`?

No — it is the **older, narrower Rev. 0 dated 24/01/2025** (the date is in cell F1/W1 of
the sheet). Measured overlap: 71 WPS numbers, **62 of them also in `CONSOLIDATED`**, 9 not;
`CONSOLIDATED` carries 256 that the `.xls` does not. Its `DocumentStatus` values read
`APPROVED BY CTJV/QG` — a *different* string from the register's
`WPS APPROVED BY CTJV/ CPY`, so it is **not** an alternate source for M91. What it adds
that nothing else has: PQR thickness/diameter ranges, welding position, impact, pre-heat,
consumables, line class.

**Recommendation: do not load it** (R4-04). It backs one hidden pbix page, it is 20
months stale, its M is broken, and every figure in the mockup contract is unaffected. If
the WPS-detail page is ever ported, load it then as
`ref_wps_qualification(wps_no, …)`, explicitly marked "Rev. 0, 2025-01-24".

---

## 6. Join coverage — `weld.wps_no` → `WPQ WELDING PROCESS[WPS No.]`

Measured on the live DB, read-only, at **joint grain** (`mv_joint`, 2,390,978 rows), the
266 register keys compared case-insensitively after `btrim` (exact and trimmed/CI give
identical counts — the keys are already clean on both sides):

| sub-contractor | joints | WPS blank | with WPS | distinct WPS | ∈ `WELDING PROCESS` | % of with-WPS | distinct hit | ∈ `CONSOLIDATED` | % | distinct hit |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `ACCIONA` | 13,312 | 0 | 13,312 | 9 | 13,308 | **99.97 %** | 8/9 | 8,592 | 64.54 % | 1/9 |
| `CCC` | 1,470,093 | 130,996 | 1,339,097 | 85 | 1,339,097 | **100.00 %** | 85/85 | 1,031,223 | 77.01 % | 64/85 |
| `GAC` | 443,368 | 30,579 | 412,789 | 82 | 412,783 | **100.00 %** | 80/82 | 306,007 | 74.13 % | 32/82 |
| `INCO` | 7,238 | 0 | 7,238 | 23 | 0 | **0.00 %** | 0/23 | 7,008 | 96.82 % | 13/23 |
| `MEDGULF` | 83,181 | 8,980 | 74,201 | 18 | 74,201 | **100.00 %** | 18/18 | 0 | 0.00 % | 0/18 |
| `TEKFEN` | 373,786 | 5,118 | 368,668 | 70 | 368,668 | **100.00 %** | 70/70 | 0 | 0.00 % | 0/70 |
| **ALL sources** | 2,390,978 | 175,673 | 2,215,305 | 287 | 2,208,057 | 99.67 % | 261/287 | 1,352,830 | 61.07 % | 110/287 |
| **in scope (≠ INCO)** | 2,383,740 | 175,673 | 2,208,067 | 264 | **2,208,057** | **100.00 %** | 261/264 | 1,345,822 | 60.95 % | 97/264 |

Query: aggregate `mv_joint` by `(sub_contractor, wps_no)` (295 groups) and match in
Python against `analysis/sources4/wpq-welding-process.json` — the correlated form over a
266-row `VALUES` list times out on 2.4 M joints and is not worth an index.

**Result: `ref_wps_process` covers the in-scope fact table essentially completely.**
Exactly **10 in-scope joints across 3 WPS values** miss:

* `GAC` `GAC-WPS-P-DIS-013` — 4 joints
* `ACCIONA` `WPS-183` — 4 joints
* `GAC` `DEIPL-WPS-P-DIS-003` — 2 joints

175,673 joints (7.3 %) carry **no** `wps_no` at all — they are outer-join misses, not
register gaps, and every CCC/GAC/MEDGULF blank is pre-existing.

**INCO is 0 %, and that is correct.** INCO's WPS namespace is `INQ-420-WPS-###` and
`WELDING PROCESS` contains none of it. But the *register* does: `CONSOLIDATED` holds all
32 `INQ-420-WPS-###` under `SCTR = 'INCO'`. So `WPQ WELDING PROCESS` is deliberately the
**in-scope** process lookup (R3-01 keeps INCO filtered out at the query layer), while
`CONSOLIDATED` is the project-wide document register.

**Why the `CONSOLIDATED` column is low, and why it does not matter.** The two sheets use
different naming conventions for the same WPS:

| | `weld.wps_no` / `WELDING PROCESS` | `CONSOLIDATED` |
|---|---|---|
| TEKFEN | `TEK-WPS-1.6.BW/T-E` | `383-TEK-WPS-1.6.BW/T-E` |
| MEDGULF | `MED-WPS-638-01` | `WPS-638-01` |

`CONSOLIDATED` carries the *document* number, `WELDING PROCESS` the *site* number — which
is precisely why the pbix builds two tables from one workbook and joins only the second.
`ref_wps_register` must not be joined to `weld` (R4-03).

---

## 7. What this delivery unblocks, and what it does not

| widget | page | status after this load |
|---|---|---|
| KPI `WPS Approved` | mockup **page 1** | **unblocked → 318** (mockup snapshot shows 294; R4-02) |
| KPI `Project_Welder` (M90) | mockup page 1 | already loaded (batch 3), unaffected |
| `Status WPQ Welding Process` / `… Type of Welding Machine` | pbix 13/135/136/137 | lookup now loadable; **no mockup page binds it** |
| "WPS Status" column chart | pbix 78, 105 | data now loadable; not a mockup page |
| `WPS Reg#` flat table | pbix 127 | not loaded by ruling R4-04 |
| pages 41–44 "Weld Rejection Detail as per WPS" | mockup 41–44 | **already computable** — they group `weld.wps_no` directly and never touch these tables |
| PWHT pages (13/15/17/20/22/24/…) | mockup | **unchanged** — `PWHT Status` is a rule sheet with no measure; `weld.pwht_y_n` stays the source (R-04) |

Remaining R-01 gaps after this batch: rows 10 `UT TRACKER (GAC)_Master.xlsx` and 11
`UT TRACKER (TEK).xlsx`. **R-01 becomes 13 of 15 present.**
