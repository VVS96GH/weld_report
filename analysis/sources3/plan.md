# Build plan for the batch-3 sources

Evidence: `workbooks.md`, `acciona-column-map.md`, `inco-column-map.md`, `weld-length.md`,
`welders.md`. Every count from `uv run analysis/sources3/profile_xlsx.py`.

## Load order

1. `weld_length_by_dia` ← `Weld Length.xlsx` `Sheet1`: 728,550 rows collapsed to **98** distinct `(dia_inch, weld_length)`. Widen to `numeric(12,9)` first (R3-07).
2. `weld` ← **ACCIONA**: named Table `Acciona_Query` (sheet `ICS Quary`, `A1:BA13314`), **13,313** rows, `source/sub_contractor='ACCIONA'`, one row per joint.
3. `weld` ← **INCO**: sheet `Overall Weld Log Query`, **10,327** rows, `='INCO'`, grain = joint × RT-fragment (**7,238** distinct `joint_id`).
4. `weld.weld_length_m` UPDATE (one pass over 1-3), then `inspected_length_mm` / `defect_length_mm`.
5. `ref_qualified_welders` ← `SCTR NFE WELDERS APPLIED.xls`, **6** rows (M90 = **3,816**; CCC 2,045 / TEKFEN 773 / GAC 611 / INCO 239 / MEDGULF 121 / ACCIONA 27).
6. `ref_welder_qualification` ← Table `WELDERS_Qualification`, **5,484** rows.
7. `ref_welder_status_weekly` ← `CUM WEEK # Status` (**1,016**) + `WEEK #   STATUS` (**8**).
8. `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_joint` (+ `mv_joint_wps`) **once**, after 4. Batch 3 adds 23,640 `weld` rows (+0.4 %).
9. Optional (R3-08): `ref_code_label` ← `Rework code.xlsx`, 43 + 20 rows, display-only.

## Loaders

| loader | source → target | must do |
|---|---|---|
| `load-weld-length.ts` | `Sheet1` → `weld_length_by_dia` | assert the dia→length functional dependency (0 violations today) before collapsing; abort if it breaks |
| `load-acciona.ts` | named **Table**, not a sheet → `weld` | assert 53 cols / 13,313 rows; 27-col map + 12 constants + 4 derived; `dd-mm-yyyy` in an Acciona-only path; log, never drop, unparseable `RT Date` (the M's `RemoveRowsWithErrors` drops 0 today) |
| `load-inco.ts` | sheet → `weld` | assert 44 cols / 10,327 rows; 23-col map; `PT/MT Report` and `PT/MT Date` each feed **two** targets; dates are real date cells; `weld_length` stays in **mm**; `repair_reweld=''` |
| `load-qualified-welders.ts` | `.xls` + `.xlsx` → the three welder tables | **BIFF: `exceljs` cannot read it** — go via `uv run` + `xlrd` (R3-11), never a checked-in conversion |

## `TO BE EXLUDE FROM DATA.xlsx` — **no delta**; R-01 now **12 of 15 present**

Re-copied 2026-08-04 15:40; measured vs `analysis/sources2/workbooks.md`: 308,491 bytes / **596** rows / 124 fields / **161** distinct `RT Report + Welder` / **124** distinct `Joint ID`, `Sheet1` 20 rows — identical on every figure. sha256 `291386b94b28ad59ecfdbaed3f749754a207d873c353537a1ac7db35ee4b1a11` is the new baseline (batch 2 recorded none). **R2-02 stands: load unapplied into `ref_exclusion_list`.**

Present (12): R-01 rows 1-4, 7, 9, 12, 13 (batch 2) **+ 5 `Acciona_Latest Add to Query.xlsx`, 6 `Master Weld_Latest.xlsx`, 8 `Weld Length.xlsx`, 14 `SCTR NFE WELDERS APPLIED.xls`** (batch 3). Missing (3), each confirmed by recursive basename search of `sources/`: 10 `UT TRACKER (GAC)_Master.xlsx`, 11 `UT TRACKER (TEK).xlsx`, **15 `WPQ RECORD REGISTER.xlsx`** — which blocks **two** tables, `WPQ RECORD REGISTER` (318, M91) and `WPQ WELDING PROCESS` (266, three active relationships). New beyond R-01: `Welders Power Q for PBI .xlsx` and `Rework code.xlsx` (referenced by no query). Batch-2 extras unchanged.

## Risks (ranked)

1. **The `.xls` M is stale and would error on refresh** (R3-09): the sheet gained a left-hand column, so `RenameColumns({{"Column2","SUB CONTRACTOR"}})` targets a name that no longer exists, and its two `RemoveLastN` steps would cut 5 live rows. Our 16 come from the `TOTAL` filter alone. Build against the file, positionally.
2. **`Weld Length "PR all"` is BLANK for every Inco row** (R3-06): the DAX's Inco branch is gated on `Manual UT Report No. <> ""`, which the Inco M never fills, and the fallback `LOOKUPVALUE` needs `Dia inch`, which Inco leaves empty.
3. **Grain**: Inco is exploded, Acciona is not — every cross-source metric must already be DISTINCT-safe (R2-01); re-check.
4. `weld_length numeric(8,3)` truncates: `0.000797814 → 0.001`, `0.0669 → 0.067`.
5. **Acciona `repair_reweld` is always `''`** — `Weld No.` ends `RW1`/`RS1`, so `right(joint_id,2)` never matches `RW`/`R1`/`R2`. Acciona repairs are invisible.
6. **Acciona `tracer_shot` holds `FJ-49`, not `T`** — the M computes the flag, deletes it, then renames the raw `Tracer 1` over the top.
7. **Inco counts 441 `PAUT` rows as both RT and UT** (the M copies RT→UT without clearing RT); and `PMI Acc/Rej = 'ACCEPTED'` survives on 26 Acciona rows (case-sensitive replace).
8. Neither source has PWHT (Inco's `PWHT Report`/`Date` are 100 % empty, Acciona's are added blank) — the PWHT pages stay GAC/TEK/MED/CCC-only.
9. `Part 1`/`Part 2` and Acciona's `Column12` (`FOURTH DIMENSION`×8,593 / `DEBAJ`×4,720 — the Acciona sub-tier) reach the pbix union but have **no `weld` column**.

## Rulings needed

| # | recommendation |
|---|---|
| **R3-01** INCO default | **Load INCO, default-filter it out.** 69 visual/page filters exclude it; mockup p.2 has an Acciona row and no Inco row. But the exclusion is in the **filter layer, not DAX** — `[Total Scope Dia "BW" "PR all"]` includes Inco explicitly, so `sub_contractor <> 'INCO'` must be applied at query scope or totals over-count. 7 filters exclude Acciona too, on internal pages 13/76/82/87/113/114 — not a global invariant |
| **R3-02** grain | Acciona = one row per joint (13,313 = 13,313 joints); Inco = joint × RT-fragment (10,327 / 7,238) — DISTINCT-only |
| **R3-03** dates | **Do not** add `dd-mm-yyyy` to the shared `weld_to_date()` (ambiguous with `mm-dd-yyyy`); parse in an Acciona-only path |
| **R3-04** `Column12` | The Acciona **sub-tier** (`FOURTH DIMENSION`/`DEBAJ`), nowhere else in the model: add `weld.sub_contractor_tier`, or drop it deliberately |
| **R3-05** Joint Summary | **Not a fact source** — hand-typed, header dated `22-02-2024`, `Total No. of Joints`=0 on every row |
| **R3-06** Inco length | Reproduce the blank literally + flag to the owner, or rule the guard should be `[Weld Length] <> 0` |
| **R3-07** precision | Widen `weld_length_by_dia.weld_length` to `numeric(12,9)` |
| **R3-08** `Rework code.xlsx` | Load as `ref_code_label(domain, code, description)`, 63 rows, display-only — labels `rework_code`/`defect_code`/`weld_type`. An addition, not a pbix reproduction |
| **R3-09** stale `.xls` M | Build positionally against the file; record the M's staleness in `calculation-logic.md` |
| **R3-10** M90 table | Widen `ref_qualified_welders` with `active_welders` / `active_piping_welders`; `as_of` = file mtime `2026-08-23`, stated as such (the sheet carries no date) |
| **R3-11** BIFF | `uv run` + `xlrd` inside the loader; a checked-in conversion goes stale silently |
| **R3-12** welder register | New `ref_welder_qualification` (5,484), joined to `weld.welder_id` via `Welder ID Code+Sub`. Not a §2 metric — load now, wire when a welder page is built |
| **R3-13** weekly status | `ref_welder_status_weekly` (127 weeks × 8 categories × 6 parties), **not** 8 new `weld_weekly_snapshot` metric ids |
| **R3-14** canonical file | **The M-named ones**, on evidence: only `Acciona_Latest Add to Query.xlsx` holds the `Acciona_Query` Table and only `Master Weld_Latest.xlsx` (+ its `Back up/` twin) holds `Overall Weld Log Query`; the other 6 Acciona and 3 Inco copies would make the M fail. The `Link .txt` / `PUT IN FILE .txt` notes are only SharePoint download URLs — no workflow instructions |
| **R3-15** refresh | `mv_joint` once, `CONCURRENTLY`, after step 4; no index rebuild (R2-15) |
