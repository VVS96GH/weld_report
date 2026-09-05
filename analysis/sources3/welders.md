# The two welder workbooks

`sources/Welders/SCTR NFE WELDERS APPLIED.xls` (3.8 MB, legacy BIFF) and
`sources/Welders/Welders Power Q for PBI .xlsx` (1.1 MB).

Evidence: `analysis/sources3/workbooks.md`, `analysis/sources3/sctr-applied-welders.json`,
`welders-qualification.columns.json`, `week-status.json`, `cum-week-status.json`;
`analysis/pbix/model.md` §§ `SCTR OVERALL APPLIED WELDERS` (4596), `WELDERS_Qualification`
(4584), `WEEK #   STATUS` (4715), `CUM WEEK # Status` (4729); `analysis/pbix/measures.md`
2897-2995; `lib/metrics/refs.ts`; `db/migrations/0004_reference.sql`, `0010_batch2_schema.sql`.

---

## 1. `SCTR NFE WELDERS APPLIED.xls` → `SCTR OVERALL APPLIED WELDERS` → **M90**

### 1.1 What arrived

| | |
|---|---|
| format | **BIFF8 `.xls`**, read here with `xlrd` 2.0.2 (`uv add xlrd`) |
| sheets | 10; the M reads only `SCTR OVERALL APPLIED WELDERS` (the last one) |
| grid | 19 rows × **18 columns** |
| after `Table.Skip(1)` + `PromoteHeaders` | **17 data rows** |
| after the M's `[STRUCTURAL / PIPING] <> "TOTAL"` filter | **16** = the pbix's stored row count, **exactly** |

### 1.2 ⚠️ The file's shape has drifted from the M — the M would error on refresh

The stored M is:

```m
#"SCTR OVERALL APPLIED WELDERS1" = Source{[Name="SCTR OVERALL APPLIED WELDERS"]}[Data],
#"Changed Type" = Table.TransformColumnTypes(…,{{"Column1", type text}, … {"Column16", type text}}),
#"Removed Top Rows" = Table.Skip(#"Changed Type",1),
#"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
#"Removed Bottom Rows" = Table.RemoveLastN(#"Promoted Headers",4),
#"Removed Columns"  = Table.RemoveColumns(#"Removed Bottom Rows",{"SUB CONTRACTOR"}),
#"Renamed Columns"  = Table.RenameColumns(#"Removed Columns",{{"Column2", "SUB CONTRACTOR"}}),
#"Filled Down"      = Table.FillDown(#"Renamed Columns",{"SUB CONTRACTOR"}),
…
#"Removed Bottom Rows1" = Table.RemoveLastN(#"Renamed Columns1",1),
…
#"Filtered Rows" = Table.SelectRows(…, each ([#"STRUCTURAL / PIPING"] <> "TOTAL"))
```

Measured layout of the file as delivered (`xlrd`, 0-based rows):

```
row 0  : entirely blank                                    ← Table.Skip(1) removes this
row 1  : ['', 'SUB CONTRACTOR', '', 'STRUCTURAL / PIPING', 'WELDERS TESTED (APPLIED)', …]
row 2  : ['', '', 'CONSOLIDATED  CONTRACTORS COMPANY (CCC+EMKAN)', 'PIPING', 2868, …]
…
row 18 : ['', '', '', 'TOTAL', 5629, …]
```

Three contradictions with the M, each measurable:

1. **The M types `Column1`…`Column16`; the sheet has 18 columns.** Harmless
   (`TransformColumnTypes` ignores the extras) but it dates the M.
2. **The sub-contractor *names* are in column 3, and the M expects them in column 2.**
   After `PromoteHeaders`, the null-headed columns are named `Column1` and `Column3`;
   the M removes the column literally named `SUB CONTRACTOR` (column 2, which is
   **empty in every data row**) and then renames **`Column2`** — a name that no longer
   exists. **`Table.RenameColumns` raises on a missing column, so the query as stored
   fails against this file.** One column has been inserted at the left since the M was
   written.
3. **`RemoveLastN(4)` + `RemoveLastN(1)` would drop 5 of the 17 data rows**, leaving 12,
   not 16. The pbix's 16 is reproduced instead by the *final* `TOTAL` filter alone
   (17 − 1 = 16). Those two footer-trims were written for a vintage that had 5 footer
   rows; today's file has none.

Per the brief's honesty rule, this item **stops here** and goes to the orchestrator as
**ruling R3-09**. The data itself is unambiguous (§1.3), so the recommendation is: build
our loader against the **file**, positionally — take the sub-contractor name from the
first non-empty of columns 2/3 with fill-down, and drop the `TOTAL` row — and record in
`calculation-logic.md` that the pbix's stored M is stale. Do **not** try to reproduce a
query that errors.

### 1.3 The data, and what M90 is

`M90 Project_Welder` (`measures.md` 2897-2995) is six measures, all
`CALCULATE(SUM('SCTR OVERALL APPLIED WELDERS'[QUALIFIED  WELDERS]))` — project total,
plus one each filtered to `Sub-Contractor = "CCC" / "GAC" / "TEKFEN" / "MEDGULF"`, plus
`[Qualified Welders Inco]` filtered to `"Inco"`. Note the **two spaces** in
`QUALIFIED  WELDERS`.

Measured values (column 17 of the sheet, `QUALIFIED  WELDERS`; the register carries the
number only on each party's `PIPING` row):

| raw `SUB CONTRACTOR` | M's normalisation chain | canonical | STRUCTURAL / PIPING | QUALIFIED WELDERS | ACTIVE WELDERS | ACTIVE PIPING |
|---|---|---|---|---:|---:|---:|
| `CONSOLIDATED  CONTRACTORS COMPANY (CCC+EMKAN)` | `…(CCC+EMKAN)`→`CCC` | **CCC** | PIPING | 1,990 | 1,960 | 1,147 |
| " | | CCC | STRUCTURAL | — | 95 | — |
| `CONSOLIDATED  CONTRACTORS COMPANY (CCC) (DANEM)` | `…(CCC)`→`CCC`, then `CCC (DANEM)`→`CCC` | **CCC** | PIPING | 55 | 0 | 0 |
| " | | CCC | STRUCTURAL | — | 0 | — |
| `MEDGULF` | — | **MEDGULF** | PIPING | 121 | 54 | 54 |
| " | | MEDGULF | STRUCTURAL | — | 39 | — |
| `ACCIONA (DEBAJ+FD)` | `Acciona (DEBAJ+FD)`→`Acciona` | **ACCIONA** | PIPING | 27 | 0 | 0 |
| " | | ACCIONA | STRUCTURAL | — | 6 | — |
| `INCO` | `INCO`→`Inco` | **INCO** | **PIPING / TANK** | 239 | 0 | 0 |
| " | | INCO | STRUCTURAL | — | 0 | — |
| `TEKFEN` | — | **TEKFEN** | PIPING | 723 | 161 | 20 |
| " | | TEKFEN | STRUCTURAL | — | 0 | — |
| `TEKFEN                        (BLACK CAT)` | `TEKFEN (BLACK CAT)`→`TEKFEN` | **TEKFEN** | PIPING | 50 | 0 | 0 |
| " | | TEKFEN | STRUCTURAL | — | 7 | — |
| `GAC` | — | **GAC** | PIPING | 611 | 454 | 487 |
| " | | GAC | STRUCTURAL | — | 79 | — |
| _(filtered out)_ | | | **TOTAL** | 3,816 | 2,855 | 1,708 |

Verified by script: **Σ `QUALIFIED  WELDERS` over the 16 kept rows = 3,816**, which is
the value the sheet's own `TOTAL` row carries. So **M90 project = 3,816**, and per party:
**CCC 2,045** (1,990 + 55), **TEKFEN 773** (723 + 50), **GAC 611**, **INCO 239**,
**MEDGULF 121**, **ACCIONA 27**.

Note the M's normalisation chain has a **bug that does not bite**: two of the eight
replacement rules (`CONSOLIDATED  CONTRACTORS COMPANY (CCC)`→`CCC` and
`ACCIONA (DEBAJ)`→`ACCIONA`) are supersets/subsets of later ones, and the
`ACCIONA`→`Acciona` / `INCO`→`Inco` case-folding runs after. The net result on today's
values is the six canonical names above; reproduce the outcome, not the chain.

Other columns available and currently unmapped: `WELDERS TESTED (APPLIED)`,
`VISUAL ACCEPTED `, ` VISUAL REJECTED `, `RT ACCEPTED `, `RT REJECTED`,
`DISQUALIFIED DUE TO MEDICAL REASON / BEHAVIOUR / HIGH REPAIR`,
`NOT MOBILIZED / DISQUALIFIED DUE TO 6 MONTH VALIDITY EXPIRED`, `TRANSFER / PROMOTED  `,
`RESIGNATION`, `ACTIVE WELDERS`, `ACTIVE PIPING WELDERS`, `REMARKS`, plus one unnamed
column holding two free-text notes (`278 welders data not available`,
`19 welders used for tack welding`). Note the **leading/trailing spaces** in several
header names — they are part of the name in the pbix and must be matched exactly if
anyone re-derives the M.

### 1.4 Mapping → `ref_qualified_welders`

`db/migrations/0004_reference.sql`:

```sql
CREATE TABLE IF NOT EXISTS ref_qualified_welders (
  sub_contractor    text    PRIMARY KEY,
  qualified_welders integer NOT NULL,
  as_of             date,
  notes             text
);
```

Six rows, exactly as tabulated above. `lib/metrics/refs.ts:23-33`
(`qualifiedWelders()` → `SELECT sum(r.qualified_welders) …`) then works unchanged and
M90 stops returning `null`. **The PK is `sub_contractor`, so the two CCC rows and the
two TEKFEN rows must be summed at load** — that is what the DAX does
(`SUM(…)` under a `[Sub-Contractor]="CCC"` filter over both rows).

`as_of`: the file has **no date anywhere in the sheet**. Use the file mtime
(**2026-08-23 07:53**) and say so in `notes`; do not invent a reporting date.

Two further columns are worth keeping — **recommend widening the table** (R3-10):
`active_welders` (CCC 2,055 = 1,960 + 95, TEKFEN 168, GAC 533, MEDGULF 93, ACCIONA 6,
INCO 0; TOTAL row 2,855) and `active_piping_welders`. `ref_active_welders` is a
*different* thing — see §3.

### 1.5 Reading a BIFF `.xls` from the Node loaders

**`exceljs` cannot read BIFF at all.** Its `readFile` handles `.xlsx`/`.csv` only;
handed an `.xls` it throws (`Can't find end of central directory` — it looks for a zip).
Every other loader in `scripts/` uses `exceljs`. Three options:

| option | cost | verdict |
|---|---|---|
| **(a) one-off conversion to `.xlsx`/CSV, checked in beside the source** | trivial; but the artefact goes stale silently when the analyst re-downloads the `.xls` | **rejected** — a stale 16-row register is worse than none |
| **(b) `uv run` a tiny Python step from the loader** (`xlrd` → CSV → `COPY`) | one extra runtime dependency on the box; `uv` and `xlrd` are already present and pre-approved | **recommended (R3-11)**. `analysis/sources3/sctr-applied-welders.json` is exactly this output, already produced |
| (c) a JS BIFF reader (`xlsx`/SheetJS) | new npm dependency, licence + supply-chain review, for one 19×18 sheet | not worth it |

Recommendation: `scripts/load-qualified-welders.ts` shells out to
`uv run analysis/sources3/profile_xlsx.py`-style extraction, or simply reads the
committed `analysis/sources3/sctr-applied-welders.json` **regenerated as part of the
load**, never as a stale checked-in artefact.

---

## 2. `Welders Power Q for PBI .xlsx` — three pbix tables

12 sheets, 10 named Tables. Three queries read it.

### 2.1 `WELDERS_Qualification` — the per-welder register (5,484 rows)

```m
WELDERS_Qualification_Table = Source{[Item="WELDERS_Qualification",Kind="Table"]}[Data],
… #"Renamed Columns" = Table.RenameColumns(…,{{"WELDER ID", "WELDER ID+NAME"}})
```

A **named Table**, on sheet `WELDERS Qualification`, range `A1:S5485`, **19 columns**,
**5,484 data rows = the pbix exactly**. (The M types 18 of the 19; the extra
`Welder ID Code+Sub` is newer than the M and is imported untyped — harmless.)

| column | measured |
|---|---|
| `SL No.` | 1,999 distinct over 5,484 rows — a per-sub-contractor counter, not a key |
| `PIP -PIPING … STR- STRUCTURAL WELDERS` | `PIP`×5,021, `STR`×301, `PIPE / TANK`×155, `PIP+STR`×7 |
| `Welder Name` | 3,607 distinct |
| `WQT NO #` | 3,631 distinct; 44 blank; `_`×208, `N/A`×13 |
| `Welder No.` | **3,200 distinct**; `N/A`×200, `-`×156, 42 blank |
| `WPS No` | 116 distinct |
| `Date of Test` | real dates, 482 distinct, 2022-06 … ; 107 blank |
| `Welding Process` | 24 distinct (`GTAW`, `GTAW/SMAW`, `GTAW+#(lf)SMAW`…) — embedded newlines |
| `Filler Materials`, `Base Material`, `Type of Joint` | 70 / 75 / 3 distinct |
| `WORKING LOCATION` | 56 distinct incl. `NOT MOBILIZED`×772, `Qualified in India `×226 |
| `VT RESULT` | `ACCEPTED`×4,726, `REJECTED`×727 |
| `RT RESULT` | `ACCEPTED`×4,657, `REJECTED`×480, `N/A`×303, `-`×13 |
| `STATUS` | **14 distinct** — `QUALIFIED FOR PIPING`×2,986, `DISQUALIFIED FOR PIPING`×1,412, `QUALIFIED FOR PIPING IN INDIA ( SEP 2023)`×243, `QUALIFIED FOR STR`×225, `QUALIFIED FOR TANK`×140, … |
| `REMARKS` | 54 distinct, 3,040 blank |
| `Sub-Contractor` | **`CCC`×2,372, `TEKFEN`×2,033, `GAC`×732, `Inco`×155, `MEDGULF`×143, `Acciona`×49** — 6 values, already close to canonical (`Inco`/`Acciona` need upper-casing) |
| `WELDER ID` → renamed `WELDER ID+NAME` | `NAME-BADGE-SUBCON`, 3,803 distinct, 42 blank |
| `Welder ID Code+Sub` | `BADGE-SUBCON`, 3,268 distinct — **this is the same key shape as `weld.welder_id`** (`db/README.md:311`: `welder || '-' || sub_contractor`) |

**This is the register that turns a badge number into a name, a qualification status and
a WPS.** `weld.welder_id` is `W-034-CCC`; this table's `Welder ID Code+Sub` is
`W-034-CCC`. The join is direct — modulo the 143 `--CCC` and 200 `N/A-TEKFEN`
degenerate keys, which must be excluded, and modulo the **one-to-many** relation (a
welder holds several qualifications: 5,484 rows over 3,268 distinct keys).

**Target: a new `ref_qualified_welder_register` table**, not `ref_qualified_welders`
(which is the 6-row M90 summary and must stay a summary). Suggested shape — ruling R3-12:

```sql
CREATE TABLE ref_welder_qualification (
  id                 bigserial PRIMARY KEY,
  welder_id          text,          -- `Welder ID Code+Sub`, nullif degenerate
  welder_no          text,
  welder_name        text,
  sub_contractor     text,          -- canonical upper-case
  discipline         text,          -- PIP / STR / PIPE / TANK / PIP+STR
  wqt_no             text,
  wps_no             text,
  date_of_test       date,
  welding_process    text,
  filler_materials   text,
  base_material      text,
  type_of_joint      text,
  working_location   text,
  vt_result          text,
  rt_result          text,
  status             text,
  remarks            text,
  welder_id_and_name text,
  load_id            bigint REFERENCES load(id) ON DELETE SET NULL
);
CREATE INDEX ON ref_welder_qualification (welder_id);
```

Nothing in `lib/metrics` reads it yet — **it is not one of the 58 §2 metric ids.** It
unlocks the *welder-status* pages (pbix 104 `Rep. Acciona Welder Status` and siblings)
and welder tooltips, which the mockup does not currently show. Load it as a reference
table; wire it when a page asks.

### 2.2 `WEEK #   STATUS` — 8 rows

Sheet (not Table), `Table.Skip(1)` → `PromoteHeaders` → `RemoveLastN(1)`.
Measured **8 data rows = the pbix exactly**, 10 columns (the first unnamed and empty):
`S.No`, `Welders Qualification Status Summary Report`, `GAC`, `MEDGULF`, `TEKFEN`,
`CCC`, `ACCIONA`, `INCO`, `TOTAL`.

The 8 status categories: `Under Qualification `, `Qualification Failed (Overall)`,
`Qualified , Production Performance Test (First 3 joints) to …`,
`Qualified , including first 3 production joints passed) `, `Re-Qualified 1st time`,
`Disqualified due to po…`, `Disqualified due to qu…`, `Resignation & Terminat…`.
This is the **current-week snapshot**. `ACCIONA` and `INCO` are `0` in all 8 rows.

### 2.3 `CUM WEEK # Status` — 1,016 rows, the history of the same 8 categories

Sheet, `PromoteHeaders`, no skip. **1,016 = the pbix exactly**; 12 columns:
`PERIOD`, `WEEK`, `S.No`, `Welders Qualification Status Summary Report`, the six
sub-contractors, `TOTAL ` (trailing space), `%` (**100 % empty**).

**127 weeks × 8 categories = 1,016.** `PERIOD` is `"1. 23-Feb-24 to 1-Mar-24"` …
(127 distinct), `WEEK` is `"147 week"` … (127 distinct). The pbix relates
`CUM WEEK # Status[Welders Qualification Status Summary Report]` →
`WEEK #   STATUS[…]` M:1 (`model.md` relationships) — history joined to the current
snapshot by category name. **Caution: the category strings differ between the two
sheets** — `CUM WEEK # Status` prefixes them (`1. Under Qualification `,
`2. Qualification Failed`), `WEEK #   STATUS` does not. The relationship therefore
matches on almost nothing; treat both as independent tables.

**Target: `weld_weekly_snapshot`** (R2-08's canonical shape, PK
`(week_end_date, sub_contractor, scope, metric)`) with `metric = 'M90Q1'`…`'M90Q8'` for
the 8 categories, `scope='ALL'`, `label_raw` holding the workbook's category string.
1,016 rows × 6 parties, minus blanks. `PERIOD`'s end date parses to `week_end_date`
(`"1. 23-Feb-24 to 1-Mar-24"` → `2024-03-01`); it is a **Friday** series, consistent with
the other trend workbooks. Ruling R3-13 confirms whether the 8 categories are wanted as
8 metric ids or as one `ref_welder_status_weekly` table — recommend the latter, since
they are a category breakdown, not a KPI series.

---

## 3. What is *not* here: `ref_active_welders` vs M90

Already loaded from batch 2 (`db/migrations/0010_batch2_schema.sql:453`):
`ref_active_welders` ← `CUM Trend Active Welders.xlsx`, 576 rows, weekly active-welder
count per party, metric id **`M90W`**. `db/README.md:440` is explicit that it is **not**
M90.

With `SCTR NFE WELDERS APPLIED.xls` in hand, the three welder counts are now all
distinguishable, and they must not be conflated:

| id | source | grain | value |
|---|---|---|---|
| **M90** `Project_Welder` | `SCTR …APPLIED.xls` `QUALIFIED  WELDERS` | one number per party, undated | 3,816 project |
| **M90W** active welders | `CUM Trend Active Welders.xlsx` | weekly per party | 576 rows |
| _(new)_ | `SCTR …APPLIED.xls` `ACTIVE WELDERS` | one number per party, undated | 2,855 project |

The last two disagree on purpose — one is a maintained weekly series, the other a
point-in-time register. Show one, cite the other.

---

## 4. `WPQ RECORD REGISTER.xlsx` — **still absent**, so M91 is still blocked

Confirmed by recursive basename search of `sources/` (`workbooks.md` § "R-01 files
confirmed still absent"). It feeds **two** pbix tables, not one:

* `WPQ RECORD REGISTER` (318 rows) — sheet `CONSOLIDATED`, `Table.Skip(3)`,
  `PromoteHeaders`, drop `Column13`…`Column18` + `CODE ` + `REMARKS`, keep
  `[WPS NO.] <> null`, `Text.Trim` the WPS number. → **M91** `WPS Approved` =
  `DistinctCount(WPQ RECORD REGISTER[WPS NO.])` → `ref_wps_register`.
* `WPQ WELDING PROCESS` (**266 rows**) — sheet `WELDING PROCESS`, `PromoteHeaders`,
  `null`→`TBN` on `Welding process`. It carries **three active relationships**
  (`CSVExport_Welder Record[WPS No.]` M:1, `PWHT Status[WPS No.]` 1:1,
  `Flg CCC_Flange Repair[SN]` 1:1) — so it is a real dimension, not a footnote.

Both are blocked by the same missing 12-column workbook. `lib/metrics/refs.ts:50`
(`approvedWpsCount()`) keeps returning `null`. **Ask for it again — it is the single
smallest remaining unlock in the R-01 list.**

---

## 5. Back-ups

`Welders/Back up/Welders Power Q for PBI .xlsx` and `… - Copy.xlsx`: **identical sheet
list, identical named Tables, identical ranges** to the live file
(`workbooks.md`, back-ups table). `Back up/SCTR NFE WELDERS APPLIED.xls` and
`… - Copy.xls`: same 10 sheets. Provenance only; ignore.
`From Manimurugan Kaliyamoorthy LINK .txt` is a SharePoint URL to
`…/Welding Register/NFE CONSOLIDATED APPLIED WELDERS LIST` — where the `.xls` comes from,
and **who owns it**, which is the useful part when asking for a refresh.
