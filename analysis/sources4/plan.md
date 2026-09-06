# Build plan for the batch-4 sources (`sources/WPQ RECORD REGISTER/`)

Evidence: `workbooks.md`, `mapping.md` (full DDL + M-step detail). Counts from
`uv run analysis/sources4/profile.py`; join coverage from the live DB, read-only. **All five
pbix row counts reproduce exactly** (318 / 266 / 71 / 127 / 34) — no judgement call was needed
to reconcile any of them. R-01 goes from 12 to **13 of 15 present**.

## M91 — the number the page-1 "WPS Approved" card must show: **318**

`CONSOLIDATED` → `Skip(3)` → `PromoteHeaders` → drop blank/`CODE`/`REMARKS` columns →
`[WPS NO.] <> null` = **318 rows**; all 318 carry `[ DOCUMENT STATUS] = 'WPS APPROVED BY CTJV/
CPY'`; `DistinctCount(WPS NO.)` = **318** (all distinct). Corroborated by `CUM WPS Status.xlsx`
week `2026-08-28` = 318. The mockup's **294** is that same series' `2025-10-17 → 2026-03-20`
plateau — the pbix snapshot is older, not wrong.

## Load order — one migration, one loader, 745 rows

1. `0022_wps_register.sql` (0021 is taken by an in-flight UT-length migration): widen
   `ref_wps_register` (+`sctr`, `wps_rev_no` **text**, `pqr_no_rev`, `welding_process_es/_mode`,
   `pqr_material_1/2`, `pwht`, `application`); create
   `ref_wps_process(wps_no PK, sn, sctr, welding_process NOT NULL, welding_machine_type)`,
   `ref_wps_status_cum(week_end_date PK, wps_submitted, wps_approved)` — cumulative, project-wide —
   and `ref_wps_pwht_status(wps_no PK, pwht_yn, thickness_note)`; extend the `load.source` CHECK
   with `WPS_PROCESS`, `WPS_STATUS_CUM`, `WPS_PWHT_STATUS` (`WPS_REGISTER` already exists).
2. `scripts/load-wps-register.ts` (`npm run db:load:wps`): one loader, four tables, four `load`
   ledger rows. **`exceljs` only, no `xlrd` path** — the BIFF file is not loaded (R4-04). Asserts
   then aborts on 318 / 266 / 127 / 34 rows and all four keys 100 % distinct. Header read **by
   name** (`' DOCUMENT STATUS'` keeps its leading space) — never by position, never by the M.
3. No matview refresh: nothing lands in `weld`.

## Unblocked / not

* **Unblocked:** mockup page-1 KPI `WPS Approved` → **318**; `tests/metrics-batch3.test.ts:267`
  ("M91 stays an em-dash") flips to `318`; `lib/pages/welding.ts` `REGISTER_NOTE` drops its M91
  clause. `approvedWpsCount()` itself needs no change.
* **Loaded but unbound:** `ref_wps_process` (pbix 13/135/136/137), `ref_wps_status_cum` (pbix
  78/105), `ref_wps_pwht_status` (no measure reads it) — none is a mockup page. **Untouched:**
  mockup 41–44 group `weld.wps_no` directly; the PWHT pages keep `weld.pwht_y_n` (R-04).
  **No number moves but M91.**

## Risks (ranked)

1. **Two of the four M queries would fail on refresh** — `CONSOLIDATED` gained a blank column A so
   `RemoveColumns({"Column13".."Column18"})` names absent fields; the `.xls` sheet is `WPS Reg.`,
   not `WPS Reg#`. R3-09's trap → build by header name (R4-01).
2. **M91's filter is a no-op today** (one distinct `DOCUMENT STATUS`) — keep it anyway; and
   **318 ≠ the mockup's 294** is a data-currency delta, not a bug fix (R4-02).
3. `ref_wps_register` must never join `weld.wps_no`: it holds *document* numbers (`383-TEK-…`,
   `WPS-638-…`), `weld` the *site* numbers (`TEK-…`, `MED-WPS-638-…`) — 61 % match, plausibly (R4-03).
4. Three `PWHT Status` keys (`CS/LTCS-AUT-003/-009/-010`) have no `WELDING PROCESS` row (the pbix's
   "1:1" edge is aspirational — no FK); and the `.csv` differs from the sheet by an unnamed 6th
   column (`1228-CS-00#`, 8 GAC rows) and two space-spelled `Welding process` values.

## Rulings needed

| # | recommendation |
|---|---|
| **R4-01** stale M | Load **by header name** against the delivered files; record both staleness findings (`CONSOLIDATED` +1 left column; `WPS Reg.` ≠ `WPS Reg#`) in `calculation-logic.md` §7, extending R3-09 |
| **R4-02** M91 = 318 | Render **318**; flip `tests/metrics-batch3.test.ts:267` from `—` to `318`, and say in the provenance that 294 is the same series' 2025-10→2026-03 value |
| **R4-03** register join | Widen `ref_wps_register`, do not replace, and **never** join it to `weld.wps_no`. `ref_wps_process` is the only WPS↔fact join — 100.00 % of in-scope joints that carry a WPS (2,208,057 / 2,208,067; 10 joints over 3 WPS miss) |
| **R4-04** the `.xls` | **Do not load** `WPS-WPQT Record Register Rev_0 24-01-25.xls` — Rev. 0 of 24-01-2025, 71 rows, a different `DocumentStatus` vocabulary, one hidden pbix page. Deliberate exclusion, like R3-05/R3-08; hence no `xlrd` path |
| **R4-05** `Sn.`/`S.N` | The three 1:1 edges into `Flg CCC_Flange Repair[SN]` are row-number-to-row-number auto-detections. **Never reproduce**; `sn` is provenance only |
| **R4-06** weekly series | `ref_wps_status_cum` is its own table (R3-13 precedent) — **no** new `weld_weekly_snapshot` metric ids, unlike `ref_mpi_done`'s legacy double-write |
| **R4-07** the CSV | The `WELDING PROCESS` sheet is canonical (R3-14: the M-named file wins); the `.csv` is an export, not read. Its unnamed 6th column is a GAC document-number alias — one owner question |
| **R4-08** PWHT rule sheet | `ref_wps_pwht_status` is documentation only; it must not override `weld.pwht_y_n` or `PWHT_AMBIGUOUS_TOKEN` (R-04) without a separate ruling |
