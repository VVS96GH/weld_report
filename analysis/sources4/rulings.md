# Orchestrator rulings on the WPQ RECORD REGISTER delivery (2026-09-06)

All recommendations in `plan.md` (R4-01…R4-08) are ACCEPTED:

| # | Ruling |
|---|---|
| R4-01 | Load by header NAME, not column position/M step — two of the four Power Query definitions would fail on refresh (blank left column in `CONSOLIDATED`; the `.xls` sheet is `WPS Reg.`). |
| R4-02 | M91 `WPS Approved` = COUNT DISTINCT `WPS NO.` where `DOCUMENT STATUS = 'WPS APPROVED BY CTJV/ CPY'` over `CONSOLIDATED` → **318** today (mockup 294 = the 2025-10…2026-03 plateau of the same series). The page-1 card renders it; the em-dash pin flips to 318 with provenance = file date. |
| R4-03 | `ref_wps_register` (CONSOLIDATED, document numbers) is NEVER joined to `weld.wps_no` (site numbers); `ref_wps_process` (WELDING PROCESS) is the join table — 100.00 % coverage of in-scope joints with a WPS. |
| R4-04 | `WPS-WPQT Record Register Rev_0 24-01-25.xls` is not loaded (Rev. 0 of Jan-2025, different status vocabulary, backs a hidden page); no xlrd path in this loader. |
| R4-05 | The `S.N`/`Sn.` → `Flg CCC_Flange Repair[SN]` 1:1 relationships are row-number auto-detections — never reproduced. |
| R4-06 | `CUM WPS Status.xlsx` → `ref_wps_status_cum(week_end_date, metric, value)` (127 weeks), UPSERT like the weekly snapshot (history never cleared). |
| R4-07 | `WPS (Welding Process).csv` is a near-duplicate of the `WELDING PROCESS` sheet (unnamed 6th column, two spelling variants) — the sheet is canonical; the CSV is not loaded. |
| R4-08 | `WPS PWHT Status.xlsx` → `ref_wps_pwht_status` (34 rows) loaded as a rule sheet for display/lookup only; no measure reads it. |
