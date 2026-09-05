# Orchestrator rulings on the batch-3 sources (2026-09-05)

Answers to `plan.md` "Rulings needed". Binding for every build lane. Every recommendation
in plan.md is ACCEPTED; specifics below.

| # | Ruling |
|---|---|
| R3-01 | Load INCO into `weld` (`source='INCO'`). The default exclusion lives in the QUERY layer (`sub_contractor <> 'INCO'` in every project-scope metric/page, exactly where the pbix puts its 69 filters), never in the loader. Acciona is IN the project scope (mockup p.2 has its row). |
| R3-02 | Grain as delivered: Acciona one row per joint, Inco joint × RT-fragment; all joint metrics go through `mv_joint` (DISTINCT by construction). |
| R3-03 | Acciona `dd-mm-yyyy` dates are parsed in the Acciona loader only; `weld_to_date()` is NOT extended (ambiguous with mm-dd-yyyy). |
| R3-04 | Add `weld.sub_contractor_tier text` (Acciona `Column12`: FOURTH DIMENSION / DEBAJ); NULL for every other source. |
| R3-05 | `Acciona Joint Summary` is not loaded (hand-typed, dated 22-02-2024, zero joints). |
| R3-06 | Reproduce the Inco blank weld length literally (the DAX guard never fires); the metrics README flags it for the report owner. No substitution. |
| R3-07 | `weld_length_by_dia.weld_length` → `numeric(12,9)`; load the 98 distinct (dia → length) rows, not the 728,550 exploded ones; keep the exploded count in the load ledger notes. |
| R3-08 | `ref_code_label(domain, code, description)` — 63 rows from `Rework code.xlsx`, display-only, marked "not a pbix reproduction" in its COMMENT. |
| R3-09 | The welders `.xls` loader is built POSITIONALLY against the delivered file (the pbix M is stale and would fail); the staleness is recorded as correction C-14 in `analysis/calculation-logic.md` §7 (additive) and in db/README.md. |
| R3-10 | `ref_qualified_welders` gains `active_welders`, `active_piping_welders`, `as_of date`, `source_note`; `as_of` = the file's mtime (2026-08-23), stated as such in the widget provenance. M90 total 3,816. |
| R3-11 | `.xls` is read at load time through `uv run scripts/py/xls_to_csv.py` (xlrd, dependency already added) spawned from the Node loader; no checked-in conversion. |
| R3-12 | New `ref_welder_qualification` (5,484 rows) keyed to `weld.welder_id` via `Welder ID Code+Sub`; loaded now, wired when a welder page exists. |
| R3-13 | New `ref_welder_status_weekly(week_end_date, sub_contractor, category, value)` for CUM WEEK # Status (1,016 rows); NOT new metric ids in `weld_weekly_snapshot`. |
| R3-14 | Canonical files = the M-named ones only: `Acciona/Acciona_Latest Add to Query.xlsx`, `Inco/Master Weld_Latest.xlsx`, `Weld Length/Weld Length.xlsx`, `Welders/SCTR NFE WELDERS APPLIED.xls`, `Welders/Welders Power Q for PBI .xlsx`. Back-ups and dated copies are never read. |
| R3-15 | The existing `refreshMatviews()` (all three views, CONCURRENTLY) runs after each of these loads; no index rebuild. |
