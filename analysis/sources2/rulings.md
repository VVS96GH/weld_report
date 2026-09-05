# Orchestrator rulings on the batch-2 sources (2026-09-05)

Answers to `plan.md` "Rulings needed". Binding for every build lane.

| # | Ruling |
|---|---|
| R2-01 grain | **Weld-pass grain.** CCC rows go into `weld` one row per welder pass (5.43 M rows), exactly as the pbix stores them. Every metric must be `count(DISTINCT joint_id)` / DISTINCT-safe; the metrics lane re-audits every §2 measure and flags any `count(*)`. |
| R2-02 exclusion list | **Do not apply** (the pbix does not). Load `TO BE EXLUDE FROM DATA.xlsx` into `ref_exclusion_list(rt_report, welder, joint_id, reason, loaded_at)` unapplied; a later feature flag may use it. |
| R2-03 enum | **Fifth value `CCC_JOINT_RECORD`** for the 130,994 NOT-WELDED joint-record rows (migration adds it). Provenance must be honest. |
| R2-04 films | **Keep fractional** (`RT Film Total` is a weld-point share; DAX SUMs it). `rt_film_total`/`total_no_of_films_*` become `numeric(10,4)`; existing dump values are integers and unaffected. |
| R2-05 CCC aging | **Honest-empty**: `RT Selected Date` is empty on every CCC row; M51 buckets render "—" with a provenance note for CCC. No substitution. |
| R2-06 spool masters | **One `spool` table with a `source spool_source` column** (`SPOOL_DUMP`, `TALISMAN_SPOOL`); Talisman columns mapped onto the same milestone names, unmapped ones dropped with a documented list. |
| R2-07 Joint.csv | **Not loaded now.** QC cross-check table; revisit if a page needs it. |
| R2-08 vocabulary | **Normalise at load.** `weld_weekly_snapshot` gains `scope text NOT NULL DEFAULT 'ALL'` (`SG`, `NONSG`, `TMCP`…) and `sub_contractor` holds the canonical upper-case name (`GAC`, `TEKFEN`, `MEDGULF`, `CCC`, `INCO`, `ACCIONA`); the raw label is kept in `label_raw`. PK becomes (week_end_date, sub_contractor, scope, metric). |
| R2-09 dead RT Backlog | **Seed as-is** (zeros are what the report showed); the metrics lane marks the series `provisional` in the widget note until the first ETL-computed week lands. |
| R2-10 spec corrections | A Sonnet lane appends a "Corrections from batch-2 recon" section to `analysis/calculation-logic.md` (no rewriting of the original text) covering: `"#"→"CCC"` is a no-op on this export; 25 renames not 22 (+ the 3 reshoot renames); the 4 derived columns incl. `RT Weld Status` emitting `HS CCC` and `Total No of films Acc = RT Film Total − Rej`; `Original Joint` semantics; `PWHT Y/N = 25.01` is dump-only. |

Additional rulings:

- **R2-11 dates:** `weld_to_date()` gains `yyyy/mm/dd` and `yyyy-mm-dd` branches; stays non-raising.
- **R2-12 repairs:** `repair_reweld` for CCC is derived from `Repair Suffix` (blank → '', `RW*` → 'Reweld', `RS*`/`R0*` → 'Repair' — the lane verifies the exact DAX rule in `Project WD+WR+INCO+Acciona[Repair & Reweld]` and follows it, not this sketch).
- **R2-13 CCC RT status:** reproduce the M's synthesised `RT Weld Status` literally (including `HS CCC`); the metrics lane adds `HS CCC` to the hold list only where the DAX whitelist contains it (it does: `"HS CCC"` is in the 16-code list).
- **R2-14 UT tracker:** `ref_ut_tracker_ccc` table loaded from `UT TRACKER (CCC)_Talisman.xlsx` (all columns incl. the 2 new ones); metrics lane wires M32/M34 for CCC.
- **R2-15 load cost:** budget 15 min; loaders stream; indexes are NOT dropped/rebuilt (keep it simple); `VACUUM (ANALYZE)` after.
- **R2-16 ACC/REJ workbook:** the §1.4 split is mandatory — CSV rows with `RT/UT Report No. = ''` (4,791,434) + all 641,575 workbook rows = 5,433,009.
