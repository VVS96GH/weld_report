# Owner rulings — Welding Statistics Platform and Welding Statistics Dashboard

The owner's decisions on how a figure is counted, each with its date, an example and where it
lives in code. **Binding: do not re-decide them in code.** A change is a new ruling, written here
first, then in the code and `docs/metrics/*.md`. The same file sits in both repositories
(`weld_platform/RULINGS.md`, `weld_report/RULINGS.md`); keep them identical.

Before 2026-11-03 the rulings lived in commit messages marked "(owner)": `git log --grep owner`.

## A. Both sites

| # | Date | Ruling | Example / check | Code |
|---|---|---|---|---|
| A1 | 2026-10-21 | Report cut-off = the last Friday on or before today; figures count up to it. | 30-Oct-26 for 3-Nov-26. | platform `metrics/cutoff.py`; Dashboard `lib/metrics/trend.ts` chartCutoff |
| A2 | 2026-10-21 | The whole interface in English; Russian only in chat. | — | — |
| A3 | 2026-11-03 | Welder Performance, 2 weeks: the window is **Days Since 0..15** (cut-off − 15 .. cut-off, one day of margin, as the pbix measure); the header shows the Friday two weeks back. | Cut-off 30-Oct-26: data 15..30-Oct, header "Since 16-Oct-26". | platform `services/welder_perf.py` PERF_BACK / PERF_SINCE; Dashboard `lib/welder-perf-cum.ts` WINDOW_2W / SINCE_2W |
| A4 | 2026-11-03 | A welder's **RT FILM Ratio %** = rejected films ÷ RT Film Total **on the welder's own rows**, RT Acc/Rej not RS / U/Review (pbix `RT Film Ratio % "PR all" For Welder`). Weld Dump repeats the joint's films on each welder's row; CCC Welder Record holds the welder's share. | 33920A6-SCC7592020A01-SP10-048 (20", 6 films, GAC-PW-163 + GAC-PW-267): 6 each. GAC-PW-163 = 1/21 = 4.76 % ok. W-1464-CCC = 1/6 = 16.67 % Disq.F. | platform `core.welder_joint.w_films_all`; Dashboard `mv_welder_perf.films_w` |
| A5 | 2026-11-03 | Sub-contractor and project totals count each joint once (never a sum over welders). | GAC: SP10-048 counts 6 films, not 12. | platform `core.welder_joint.w_films`, `core.project_joint.rt_films` |
| A6 | 2026-11-02 | Rej.Summary status bands: RT 0–5 ok · 5–7.5 monitor · 7.5–10 Critical · 10–100 Disq.F; UT by length 0–1.5 Ok · 1.5–2 Monitor · 2–100 Action. | — | both |
| A7 | 2026-11-02 | Rej.Summary trends read the CUM FILE workbooks (each site its own copy); "Insert into CUM file" backs the workbook up first. | — | platform `data/cum`; Dashboard `sources/CUM FILE…` |
| A8 | 2026-11-02 | UT Rej.Summary: a welder whose UT joints have no weld length yet reads 0 %. | 9 CCC welders at 30-Oct-26. | both |
| A9 | 2026-11-03 | GAC Welding Status on two pages (Except SLG Service / SLG Service Only = Service Cat SG); TEKFEN on two (Except TMCP Pipe / TMCP Pipe "9C3AQN 46 inch"); each pair in a "+ <sub> Welding Status" folder. | GAC SLG: 1,804 joints welded. | platform `lib/sub-pages.ts`; Dashboard `lib/welding-pages.ts` |
| A10 | 2026-11-03 | Welder IDs in one spelling: trimmed, upper case. | w-1894-CCC → W-1894-CCC. | platform `core.welder_joint`, `core.joint_welder` (Dashboard: not yet — see C1) |
| A11 | 2026-10-31 | Backups weekly (Monday, after the Sunday update), the last two kept. | — | systemd timers |
| A12 | 2026-11-03 | Welding Status "Cumulative" / "this Week" tables: every RPD* code counts in RPD, every SOB* in SOB (as the pbix; on the platform since 2026-10-27, B6). | GAC RPD 922 + RPDF 551 = 1,473; TEKFEN 644 + 260 = 904. | platform `weld_type_grp`; Dashboard `lib/metrics/welding.ts` STATUS_TYPE |

## B. Platform (weld_platform) — computed from the owner's descriptions, never from the pbix

| # | Date | Ruling | Example / check |
|---|---|---|---|
| B1 | 2026-10-26 | Every metric is a selection of joints (ratios of selections allowed); the pbix formulas explain the logic only. | Joints Balance, Numb RT/UT "A". |
| B2 | 2026-10-21 | Total Joints = the whole project scope without R / RW / RS; RS2 counts; RW1RS1 / RW1GW stay out; GW = golden weld. | — |
| B3 | 2026-10-26 | RT Total Films by Joint: RS rows add no films; "R" = rejected films summed by weld point, UT films out; RT FILM Ratio % = films R ÷ films. | GAC "R" 617. |
| B4 | 2026-10-22 | RT Backlog row by row as the owner's DAX (NR = result updated); PWHT Backlog per the owner's formula. | RT backlog 633; PWHT 594. |
| B5 | 2026-10-22 | Numb UT "A"/"R": Weld Dump from the automatic UT Acc/Rej only; Numb PAUT includes CCC PAMUT. | 14,181 / 351; PAUT 1,538. |
| B6 | 2026-10-27 | Welding & NDE Status: RPD* counts as RPD, SOB* as SOB. | — |
| B7 | 2026-10-28 | Weld Rej. Detail keeps repairs in Joints Welded; THD and DMY out (2026-10-18). | — |
| B8 | 2026-11-02 | Welder Performance windows: 1 month = cut-off − 28 .. cut-off. Window welding includes repairs; cumulative welding does not; window "Numb RT/UT" = RT-only joints. | — |

## C. Dashboard (weld_report) — reproduces the owner's Power BI report

| # | Date | Ruling | Example / check |
|---|---|---|---|
| C1 | 2026-11-03 | Welder IDs keep the file's spelling **for now**: two CCC welders are written in lower case (w-1894, w-879) and W-879 would start matching its WPQ qualification record — a counted change, waiting for the owner. | — |
| C2 | 2026-10-25 | Weld Dump keeps the 19 Cancelled records Power Query splits at a line break. | — |
| C3 | 2026-10-25 | Welder Performance 1-month summary: status table and doughnut over 1..28 days. | CCC 260. |
| C4 | 2026-10-18 | Weld Rejection Detail: THD and DMY out on every party. | — |

## D. Known differences between the two sites (the reconciliation shows them as "known")

| Check | Why | Status |
|---|---|---|
| Rej.Summary 1 month (CUM snapshot) | The Dashboard lists RT dates 1..28 days back with the pbix 0..30-day ratio; the platform cut-off − 28 .. cut-off for both. | not ruled |
| Welding Status by Weld Type (CCC, GAC except SLG, TEKFEN except TMCP, MEDGULF) | Some Weld Type columns differ (GAC SW 161,115 vs 161,103; CCC BW 494,636 vs 494,666; TEKFEN TRN 1,706 vs 1,710). Present before 2026-11-03; cause not yet traced (one joint, one type on the platform). RPD fixed 2026-11-03 (A12). | found 2026-11-03 — shown as "diff" until traced and ruled |
