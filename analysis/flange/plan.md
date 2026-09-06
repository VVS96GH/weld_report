# Build plan — the flange dashboard

One page, three filters (HA / subco / method), 22 widgets. Evidence: `workbooks.md`,
`pbix-flange.md`, `mockup-vs-sources.md`, `metrics.json`. **Different grain from `weld` (a flanged
joint, not a weld) — nothing here touches `weld`.**

## Postgres — migration `0015_flange.sql`
`CREATE TYPE flange_source AS ENUM ('FLANGE_PROGRESS','OVASSETS_1619');` (room for 1510/1381).
`flange` — grain **one register line**, not one flange: `id`, `load_id`→`load(id)`, `source`,
`joint_id` (`iso||'-'||bt_no` / `FlangeJointName`), + `iso_number`, `bt_no`, `test_pack`, `system`,
`subsystem`, `pds_area`, `ha`, `flange_subcontractor`, `joint_method`(+`_original`), `joint_timing`,
`cat`, `diam`, `rating`, `service_class`, `control_pct`, `joint_date`, `control_inspection_date`,
`status_ar`, `flange_joint_status`, the four `pcc_*` columns, `reason_for_de_tightening`,
`report_nbr`, `jointer`, `joint_point`, `process_plant`, `process_area`. Indexes `(joint_id)`,
`(flange_subcontractor, ha, joint_method)`, `(joint_date)`, partial `(reason_for_de_tightening)
WHERE NOT NULL`. Plus `ref_ha (location_number PK, handover_area, …)`, created **empty** (`HA
l0_abs_guide` is absent). **No `flange_repair` table yet** — all five repair logs are absent and
`ovAssets_1619[Flange Repair Record]` is 0 non-blank of 226,504; ship it with the logs (RF-02).

## Loader — `scripts/load-flange.ts`
One script, two sheets, streaming via `scripts/lib/xlsx-stream.ts` (proven on a 728 k-row workbook;
these are 26/29 MB, 136,742 + 226,504 rows — 40 s in Python). Reproduce the M verbatim
(`pbix-flange.md` §3): `Table.Skip(5)`; drop `Iso Number IN ('0','1M03')`, `Flange
Subcontractor='ACCIONA'`, `Joint Date=2026-11-20`; four `dd-Mmm-0024`→`-2024` repairs; six `Joint
Method` replacements; `Cat.`/`Joint Timing` `NULL`→`TBN`; `ACC/REJ` `AC`/`ACC`→`A`; `Flange
Subcontractor := 'CCC'` for every `ovAssets_1619` row. Gotchas: `ovAssets_1619` headers carry
**embedded newlines** (`PCC Remarks -\n Field045`) — collapse whitespace before matching; dates are
text in three shapes (`15-Feb-2026`, `2025/10/28`, `2026/8/20`). Ledger row per source,
`--dry-run`/`--truncate` like the other loaders. **Acceptance pin: 136,741 + 226,504 = 363,245 rows,
the pbix `Flange Progress` count exactly.**

## Metrics — `lib/metrics/flange.ts`
Every measure is `COUNT(DISTINCT joint_id)`, **never `COUNT(*)`** (5,458 repeat rows). One optional
filter triple (`ha`, `subcontractor`, `method`) plus: `total` = no predicate · `inspected` =
`joint_date IS NOT NULL` · `remains` = `joint_date IS NULL` · `constn` = `joint_date IS NOT NULL AND
pcc_tightening_date IS NULL AND (flange_subcontractor='CCC' OR cat IN ('X','Y'))` · `pcc` =
`pcc_tightening_date IS NOT NULL OR (joint_date IS NOT NULL AND flange_subcontractor<>'CCC' AND cat
IN ('Z','A','B'))` · `leaked` = `upper(reason_for_de_tightening)='FLANGE LEAKAGE'` ·
`pct`/`leakedPct`. Use only the pbix `"CCC no cat"` variants — the plain `Cat.`-for-everyone trio
zeroes CCC (`ovAssets_1619[Cat.]` is 75.3 % filled). Group-bys: subco, HA, method, HA×subco,
HA×method, `date_trunc('month', joint_date)`.

## Page — `/flange`, `lib/pages/flange.ts`
Reuse `PageModel` + `components/PageView` for the 7 KPI, 3 table and 5 chart widgets. `PageModel`
has no filter kind; **smallest additive extension** in `lib/page-model.ts` — `export type
FilterWidget = { kind: "filter"; id: string; label: string; options: string[]; value: string }`
added to the `Widget` union, plus an optional `filters?: Record<string, string>` on `PageModel` for
the applied selection. Both optional, so all 44 welding pages keep type-checking.
`/flange?ha=HA1&subco=GAC&method=Manual` → server component reads `searchParams`, calls
`getFlangePage(filters)`. No client state, no port of `rawData`. **Honest-empty:** the repair trio
(widgets 16-18) shows "no source data", never a zero; the `(blank)` HA bucket (6,593 Joint IDs, 1.84
%) gets its own visible row, never folded into HA1. **19 of 22 widgets render real numbers today.**

## Tests — `tests/metrics-flange.test.ts`, pinned from `metrics.json`
rows `363,245` · `total 357,787` · `inspected 197,825` · `constn 187,756` · `pcc 16,880` · `leaked
386` · CCC `226,504/92,934` · TEKFEN `64,359/59,398` · GAC `54,306/36,171` · MEDGULF `12,617/9,322`
· HA1 `145,839` · methods `Manual 249,155 / Torquing 103,713 / Tensioning 2,913 / TBN 2,006` ·
distinct 131,283 ≠ rows 136,741 · source Joint-ID intersection **0**.

## Rulings
* **RF-01 — snapshot.** Delivered data is ~7 months newer than the mockup (`Joint Date` to 2026-08
  vs frozen mid-Jan-2026): inspected 197,825 vs 124,188, leaked 386 vs 44. The one fully-shared
  month, 2025-08, agrees to **+9 (0.1 %)**. Ship live, or pin a Jan-2026 as-of?
* **RF-02 — the five repair logs** (`CCC/GAC/TFN/MEG - Flange Repair Log - Consolidated.xlsx` +
  `Flange Face Re-Machining Log…xlsx`, SharePoint `…/30 - Repair Logs/`). Request, or accept 3 empty
  widgets?
* **RF-03 — `l0_abs_guide_202502191028.csv` (912 rows).** 6,593 Joint IDs have no HA without it.
  `ovAssets_1619[Process Plant]` carries the HA verbatim, agreeing with the DAX rule on
  226,438/226,504 rows with **0 disagreements** — use it as the CCC-side fallback (4,403 left
  unresolved), or wait for the guide?
* **RF-04 — leak timeline.** `CUM Trend Flange Progress Break Down Rate % .xlsx` (288 rows) absent.
  Recompute a *cumulative* series from `Flange Progress` (numbers differ from the as-reported weekly
  ones), or render honest-empty?
* **RF-05 — dirty rows** the pbix M does not filter: one `TBD` subcontractor, one `2027-02` `Joint
  Date`. Drop, or show as-is?
