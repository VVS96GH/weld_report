# Orchestrator rulings on the flange dashboard (2026-09-06)

Answers to `plan.md` RF-01…RF-05 plus build decisions. Binding for every lane.

| # | Ruling |
|---|---|
| RF-01 | **Ship live.** `as_of` = max `Joint Date`/inspection date in the loaded data, shown on the page; the mockup is a Jan-2026 snapshot and is not pinned. Tests pin the numbers `analysis/flange/metrics.json` computed from the delivered workbooks. |
| RF-02 | The five repair logs are requested from the report owner (`…/30 - Repair Logs/`). Until then the three repair widgets render honest-empty with a note naming the files. |
| RF-03 | `ovAssets_1619[Process Plant]` is used as the HA for the CCC side (0 disagreements on 226,438 rows vs the DAX rule); the 4,403 unresolved stay "(blank)"; a provenance note says the HA guide is missing and Process Plant was used. |
| RF-04 | The leak timeline is rendered as a **cumulative series recomputed from the records**, labelled exactly so ("recomputed from records — the as-reported weekly file is missing"); never presented as the reported series. |
| RF-05 | Keep the dirty rows (the pbix does not filter them); the loader counts them in the ledger notes (`TBD` sub-contractor, `2027-02` joint date). |
| RF-06 | Grain: one row per register row in `flange` (357,787 distinct joint ids over 363,245 rows); every joint metric is `count(DISTINCT joint_id)`; separate table, never `weld`. |
| RF-07 | The `"CCC no cat"` measure pair is the one the mockup uses — implement that pair, not the plain `Cat. IN {X,Y}` trio, and document why (75.3 % `Cat.` fill on the CCC side). |
| RF-08 | Contract: `lib/page-model.ts` gained `FilterWidget` and `PageModel.filters` (committed). `/flange` is one server-rendered page; filters travel as URL search params; `getFlangePage(filters)` returns the PageModel. |
| RF-09 | No materialised view unless a query exceeds 500 ms at 363k rows; measure first. |
