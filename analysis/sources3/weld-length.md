# `Weld Length.xlsx` and `Rework code.xlsx`

Evidence: `analysis/sources3/workbooks.md` (§ `sources/Weld Length/…`, § "`Weld Length` —
per joint, or per dia?"), `analysis/sources3/weld-length-by-dia.json`,
`analysis/pbix/model.md` § `Weld Length` (line 4741), `analysis/pbix/measures.md`
8788-8812 / 9280-9330, `lib/metrics/README.md` M33-M36, `lib/metrics/ut.ts`,
`db/migrations/0004_reference.sql` and `0012_lengths_and_manual_exclusion.sql`.

---

## 1. What the M reads

```m
Source = Excel.Workbook(File.Contents("…\Weld Length\Weld Length.xlsx"), null, true),
Sheet1_Sheet = Source{[Item="Sheet1",Kind="Sheet"]}[Data],
#"Promoted Headers" = Table.PromoteHeaders(Sheet1_Sheet, [PromoteAllScalars=true]),
#"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",
    {{"Weld Type", type text}, {"Dia inch", type number}, {"Weld Length", type number}})
```

Measured:

| | |
|---|---|
| sheet | `Sheet1` (of 2), dimension `A1:C728551` |
| columns | **3** — `Weld Type`, `Dia inch`, `Weld Length` — exactly as the M types them |
| data rows | **728,550** = the pbix's `Weld Length` row count, **exactly** |
| blanks | **none** in any of the three columns |

No filter, no skip, no rename. The pbix imports the sheet as-is.

---

## 2. Per joint, or per dia? — **per dia.** Measured, not assumed

| measurement | value |
|---|---:|
| distinct `Dia inch` | **98** |
| distinct `Weld Length` | **98** |
| distinct (`Weld Type`, `Dia inch`) pairs | 1,516 |
| `Dia inch` values mapping to more than one `Weld Length` | **0** |
| rows per (type, dia) pair | min 1, max 166,349 |

`Weld Length` is a **pure function of `Dia inch`**. `Weld Type` carries no information:
every row with `Dia inch = 1` has `Weld Length = 0.1049`, all 219,264 of them; every row
with `Dia inch = 0.75` has `0.0838`, all 94,230.

The 728,550 rows are an **exploded copy of a 98-row lookup** — one row per weld in some
population, with the length already looked up, plus a 19-weld-type × 98-dia grid
appended (the rare dia values each appear exactly 19 times, once per weld type). It is a
spreadsheet artefact, not a fact table. `Sheet2` (1,527 rows, same three columns, not
read by any query) is the same lookup at a smaller explosion.

The DAX agrees — it keys on `Dia inch` alone and ignores `Weld Type` entirely:

```dax
Project WD+WR+INCO+Acciona[Weld Length "PR all"] =
IF( [Sub-Contractor] = "Inco" && [Manual UT Report No.] <> "",
    [Weld Length] / 1000,
    IF( ISBLANK( LOOKUPVALUE('Weld Length'[Weld Length], 'Weld Length'[Dia inch], [Dia inch]) ),
        BLANK(),
        LOOKUPVALUE('Weld Length'[Weld Length], 'Weld Length'[Dia inch], [Dia inch]) ) )
```

(`LOOKUPVALUE` over a 728,550-row table with 98 distinct keys only works *because* the
functional dependency holds — otherwise it would raise. Our 98-row `weld_length_by_dia`
is behaviourally identical and 7,400× smaller.)

Units: metres. `Dia inch = 1 → 0.1049 m`, `24 → 1.9141 m`, `192 → 15.318 m`. The rare
dia values follow `length = dia × 0.0797814` exactly (`0.01 → 0.000797814`); the common
ones (`0.5 → 0.0669`, `0.75 → 0.0838`, `1 → 0.1049`, `2 → 0.1893`) are **bespoke,
measured values that do not follow that formula**. So the table cannot be replaced by a
formula — it must be loaded.

---

## 3. Mapping into our schema

### 3a. `weld_length_by_dia` — load 98 rows, not 728,550

`db/migrations/0004_reference.sql` already has the right shape:

```sql
CREATE TABLE IF NOT EXISTS weld_length_by_dia (
  dia_inch    numeric(6,2) PRIMARY KEY,
  weld_length numeric(8,3) NOT NULL
);
```

Two adjustments the data forces:

1. **`dia_inch numeric(6,2)` truncates real keys.** The measured dia values include
   `0.52`, `0.65`, `0.74`, `0.78` — fine — but the join is against `weld.dia_inch`, and
   a 2-decimal PK silently collapses any future 3-decimal dia. Low risk today (all 98
   values have ≤2 decimals); record it.
2. **`weld_length numeric(8,3)` truncates the values.** `0.000797814` → `0.001`,
   `0.0669` → `0.067`. Over 6.5 M rows that is a real drift in the length totals.
   **Widen to `numeric(12,9)`** (ruling R3-07). The workbook carries up to 15 significant
   digits (`5.9038236`, `6.063386400000001` — the last is float noise, round at load).

The 98 rows are in `analysis/sources3/weld-length-by-dia.json`
(`{dia_inch, weld_length, sheet1_rows}`), ready to seed without re-reading the 8.8 MB
workbook.

### 3b. `weld.weld_length_m` — a materialised column, per the existing plan

`0012_lengths_and_manual_exclusion.sql` already defines it and says exactly why it is
NULL today:

> `'Weld Length "PR all"` in metres. Needs `weld_length_by_dia`, which is EMPTY:
> `sources/Weld Length/Weld Length.xlsx` is still absent … NULL until it arrives —
> never 0.'

**That blocker is now cleared.** The loader materialises, reproducing the DAX literally:

```sql
UPDATE weld w SET weld_length_m =
  CASE
    WHEN w.sub_contractor = 'INCO' AND coalesce(w.manual_ut_report_no,'') <> ''
      THEN w.weld_length / 1000.0
    ELSE (SELECT l.weld_length FROM weld_length_by_dia l WHERE l.dia_inch = w.dia_inch)
  END;
```

Note what that means per source, measured:

| source | `dia_inch` | outcome |
|---|---|---|
| `WELD_DUMP` | sourced | resolves for every dia in the 98-row table; **BLANK for any dia not in it** — the DAX's explicit `ISBLANK → BLANK()` branch, never 0 |
| `CCC_WELDER_RECORD` | **`0.0` on 448,842 rows** (batch-2 finding) | `0` is *not* one of the 98 keys (the smallest is `0.01`) → those 448,842 rows get NULL. Correct, and worth a provenance note on the CCC length widgets |
| `CCC_JOINT_RECORD` | as CCC | as CCC |
| `ACCIONA` | 15 distinct values, `0.5`…`24`, never 0 or blank | **all 15 are present in the 98-row table** → every Acciona row resolves |
| `INCO` | **`''` → NULL for all 10,327 rows** | the lookup cannot resolve; the Inco branch is guarded by `Manual UT Report No. <> ''`, a column Inco never populates → **BLANK for every Inco row.** See `inco-column-map.md` §6 and ruling R3-06 |

### 3c. `inspected_length_mm` / `defect_length_mm`

Also already in migration 0012. The DAX (`measures.md` 9280-9330,
`[Inspected Length(MM).]`) is a four-way `Manual UT Report No. <> ""` cascade over
GAC / TEKFEN / CCC / others, each returning `Weld Length "PR all"`, i.e. it is
`weld_length_m` gated on a manual-UT report existing. So `inspected_length_mm`
becomes computable for GAC/TEKFEN/CCC **only to the extent the UT trackers are present**
— CCC's is (`ref_ut_tracker_ccc`, 9,419 rows, R2-14); GAC's and TEK's are **still
missing** (R-05). `defect_length_mm` reads `Rej Length` plus the CCC tracker
(`lib/metrics/ut.ts:185-188`), which already works.

---

## 4. What this unblocks — M33, M35, M36

`lib/metrics/README.md` currently records:

| id | measure | status before | status after this workbook |
|---|---|---|---|
| M33 | `[UT Weld Length by Joint "EP"]` → `ut.utStats().ut_weld_length_m` | computed at `"EP"`, **honest-empty at `"PR all"`** | **computable at both** — `weld_length_m` now materialises |
| M34 | `[UT Defect Length by Joint "PR all"]` → `ut.utStatsPrAll().ut_rej_length_m` | computed (`Rej Length` + CCC tracker) | unchanged, but its denominator partner arrives |
| M35 | `[UT Inspected Length by Joint "PR all"]` | **honest-empty (R-05)** | **partly unblocked**: computable for CCC (tracker present) and for any row where `manual_ut_report_no` is set; still honest-empty for GAC/TEKFEN until their trackers arrive |
| M36 | `[Rejection UT Rate Length by Sub-Con "PR all"]` = M34 / M35 | **honest-empty** | follows M35 — CCC yes, GAC/TEKFEN no |

`lib/metrics/README.md`'s own coverage line — *"5 still honest-empty with the missing
source named (M33/M35/M36 at `"PR all"` scope need the `Weld Length` workbook…)"* — is
the line this delivery changes. **M33 becomes fully computable; M35/M36 move from
"blocked by two things" to "blocked by the GAC/TEK UT trackers only."**

The honest-empty gate for M35/M36 must therefore become *per sub-contractor*, not
per metric. Rendering a project total that silently omits GAC and TEKFEN would be worse
than rendering "—".

---

## 5. `Rework code.xlsx` — read by nothing

Searched `analysis/pbix/model.md` (all 62 Power Query definitions) and
`analysis/pbix/measures.md` for `Rework code.xlsx`: **zero hits.** The only
`Rework Code` references are:

* the imported `Rework Code` column, which exists on `Weld Dump`,
  `AllTrain_CSVExport_Joint Record`, `CSVExport_Welder Record` and the union — sourced
  from those files, not from this workbook;
* the calculated column
  `Project WD+WR+INCO+Acciona[Rework Code "PR All"]` (`measures.md:11130`), which is
  `MAXX` over `'AllTrain_CSVExport_Joint Record'[Rework Code]` matched on `Joint ID`,
  falling back to the union's own `Rework Code`. **It reads the joint record, not this
  workbook.**

So: **`Rework code.xlsx` feeds no measure and no column. It is a code dictionary the
analyst keeps beside the data.** Contents, measured:

| sheet | rows | what it is |
|---|---:|---|
| `Rework code` | 43 | three side-by-side legends in one sheet: **(a)** `Code` / `Description` — 32 rework codes (`1A` = "ADDITIONAL JOINTS DUE TO ISOMETRIC REVISION", `1M` = "EXISTING JOINT CUT AND REWELD DUE TO ISOMETRIC REVISION", `STF` = "JOINT REPLACEMENT SHOP TO FIELD", `FAB1A`, `FLD1M`, `D1A`, `GJ`, …); **(b)** an NDE **defect-code** legend headed `BT` / `Burn Through` — 26 codes (`SC` Surface Concavity, `CR` Concave Root, `ER` Excess Root, `IP` Incomplete Penetration, `LF` Lack of Fusion, `P` Porosity, `C` Crack, `SL` Slag, `UC` Undercutting, `TI` Tungsten Inclusion, `XX` Others…); **(c)** a `WELD TYPE` legend — 14 entries (`BW : Buttweld`, `SW : Socket Weld`, `RPD : Reinforcing Pad`, `WPAD: Weld Pad`, `TRN : Trunnion`…) |
| `Sheet1` | 20 | a scratch list of the same defect codes, half as bare tokens (`C `, `CR `, `EP `, `LI `, `R/I `, `RI `) and half as `code:description` |

**Value, and it is real.** These are the human labels for three columns we already load
and currently render raw: `weld.rework_code`, `weld.defect_code`, `weld.weld_type`.
Inco's `Type of Repair` vocabulary (`LI`, `SLAG`, `R/I`, `LF`, `CP`) maps onto legend
(b); the dump's `Weld Type` tokens map onto (c).

**Ruling R3-08 asks whether to load it.** Recommendation: **yes, as three tiny label
tables** (`ref_rework_code`, `ref_defect_code`, `ref_weld_type_label`) or one
`ref_code_label(domain, code, description)`, used only for display. It is 43 + 20 rows,
it changes nothing computed, and it turns `SC` into "Surface Concavity" on every
tooltip. It is explicitly **not** a pbix behaviour — flag any UI that uses it as an
addition, not a reproduction.

Caveats if loaded: sheet (a) and sheets (b)/(c) sit in **different column ranges of the
same sheet** (`B`/`C`, `F`/`G`, `Q`), with their own header rows *inside* the data — a
loader must slice by column, not read rows. One cell in the `Burn Through` legend
contains a non-UTF-8-decodable character (rendered `�` by the profiler); read the
workbook as cell values, never as text.

---

## 6. Loader checklist

1. `scripts/load-weld-length.ts` — read `Weld Length.xlsx` `Sheet1`, assert 3 columns
   and 728,550 rows, **collapse to the 98 distinct `(dia_inch, weld_length)` pairs**,
   assert the functional dependency still holds (abort if any dia maps to two lengths —
   that would mean the DAX `LOOKUPVALUE` has started raising in the pbix too), insert
   into `weld_length_by_dia`. Or seed straight from
   `analysis/sources3/weld-length-by-dia.json`.
2. Widen `weld_length_by_dia.weld_length` to `numeric(12,9)` first (R3-07).
3. Run the `weld_length_m` UPDATE **after** the Acciona and Inco loads, so their rows
   are covered in one pass; then `inspected_length_mm` / `defect_length_mm`.
4. `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_joint`.
5. Flip M33's `"PR all"` honest-empty gate off; make M35/M36's gate **per
   sub-contractor** (CCC on, GAC/TEKFEN off until their trackers arrive).
6. `Rework code.xlsx`: only if R3-08 says yes; display-only, never a join key.
