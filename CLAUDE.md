# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # next dev  → http://localhost:3000
npm run build    # next build
npm run start    # serve the production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npx eslint app/page.tsx        # lint a single file
npx tsc --noEmit               # typecheck only (tsconfig has noEmit)
```

npm test                       # vitest (integration tests need DATABASE_URL reachable)
npm run db:up / db:migrate / db:load   # Postgres 17 in Docker, migrations, load sources/Weld Dump.txt

**Python: `uv` only.** Analysis scripts under `analysis/` are stdlib-only and run with
`uv run analysis/<script>.py` (root `pyproject.toml`, no deps). Never call `python3`/`pip`
directly or hand-build venvs; a dependency is added with `uv add`. `uv` is at `~/.local/bin`.

`next dev` rewrites the `nextjs-agent-rules` block in `AGENTS.md`; commit that regenerated block with your work rather than reverting it.

## What this project is

A Next.js rebuild of a Power BI weld-progress report for a pipeline/plant construction
project. The repo currently holds three things:

- `app/` — an unmodified `create-next-app` scaffold (still the starter `page.tsx`, still
  `title: "Create Next App"` in `layout.tsx`). Nothing domain-specific has been built yet.
- `mockups/` — the **design + content target**: two large static HTML dashboards exported
  from earlier work. These define what the app must reproduce.
- `sources/` — the **data**: the raw weld dump and the original `.pbix`.

So most work here is: read a mockup page → find the corresponding columns in the weld dump →
build the equivalent computation + screen in the App Router.

## The mockups (design contract)

`mockups/welding-dashboard 1.html` (~360 KB) — 44 `.page-section` pages, one visible at a
time, driven by `currentPage` / `pageTitles` / `totalPages` with prev/next buttons and a
`<select>` jump. Page groups: project-level welding progress → per-subcontractor welding
status → NDE status split by RT coverage percentage (100/30/20/10/5 %) with the matching
PWHT status page after each → weld rejection detail per WPS.

`mockups/flange-dashboard 1.html` (~100 KB) — single page, filter-driven
(`filterHA`, `filterSubco`, `filterMethod`): flange inspection progress, leak timeline,
repaired vs to-be-repaired, site vs vendor repair.

Both share one design system worth preserving when porting:

- `data-theme` on `<html>`: `dark` (default) / `light`.
- `data-mood` on `<html>`: `powerbi`, `pastel`, `ocean`, `desert`, `upsidedown`. Each mood is
  a CSS-variable block (`--bg-*`, `--color-1..8`) **and** a JS entry in `palettes` giving
  `colors[]`, `primary`, `secondary`, icon and label. Charts read colors through
  `getColors()` / `getPrimary()` / `getSecondary()` and are destroyed and rebuilt
  (`rebuildCharts()`) on a mood switch.
- Charts are Chart.js (plus `chartjs-plugin-datalabels`) loaded from a CDN, with **all values
  hardcoded** into the chart configs and HTML tables — the mockups are static snapshots, not
  live queries. Porting means replacing those constants with values computed from the dump,
  and adding Chart.js as a real dependency.

## The data (`sources/`)

`Weld Dump.txt` — **~630 MB, 1,002,373 lines, 226 columns, semicolon-delimited**, header on
line 1. Never open it whole with a read tool; sample and aggregate with `head`, `sed -n`,
`awk -F';'`, or a streaming script.

One row = one weld. Key identity/scope columns: `ISO Number`, `Spool No.`, `Weld No.`,
`Weld Cat`, `Weld Type`, `Dia inch`, `Thickness`, `PDS Area`, `System no`, `Testpack No`,
`Sub-Contractor` (the four in the mockups: CCC, GAC, Tekfen, Medgulf), `WPS No.`, `Welder`,
`Weld Date`, `Fitup Date`, `Golden Weld`, `Rework Code`.

The bulk of the 226 columns is one **repeating block per inspection/treatment method** —
`PWHT`, `HT`, `RT`, `UT`, `MT`, `PMI`, `PT`, `FN`, `PADLT`, `ORIF` — each with the same shape:

```
<M>%            coverage percentage (RT 100/30/20/10/5 drives the mockup's page split)
<M> Batch No, <M> Batch Status, <M> Weld Status
<M> Selected Date / By, <M> Exam Req date / No / By
<M> Date, <M> Report, <M> Acc/Rej          ← acceptance drives rejection rates
<M> Client Exam Req Y/N, <M> Remarks
```

RT additionally carries film counts, defect code/location and re-shoot columns; `Weld Length`
and `Rej Length` back the rejection-percentage figures. Write extraction code against this
block pattern rather than against individual column names.

`1. ALL SUBCON ... (EP DATA) - Weld Progress +( Full Scope ).pbix` — ~1 GB Power BI file, the
original report. Reference only; it is not readable as text.

## Stack notes (Next.js 16 / React 19 / Tailwind 4)

- App Router only, TypeScript strict, `@/*` → repo root.
- Layout/page props come from the **generated global types** in `.next/types/routes.d.ts` —
  e.g. `export default function RootLayout({ children }: LayoutProps<"/">)`. Don't hand-write
  a props interface; these regenerate on `next dev`/`next build`.
- Tailwind v4 with no `tailwind.config`: configuration lives in `app/globals.css` via
  `@import "tailwindcss"` and the `@theme inline` block, and PostCSS is wired through
  `@tailwindcss/postcss`.
- The APIs in this Next.js version differ from older training data — read
  `node_modules/next/dist/docs/` before writing framework code (see `AGENTS.md`).

## Repo hygiene

- This directory is **not a git repository** yet. If you initialize one, note that
  `.gitignore` does not exclude `sources/` (~1.7 GB) or `mockups/` (~460 KB) — the source data
  must not be committed.
- `sonnet-orchestration-prompt.md` is the user's protocol for driving Opus/Sonnet subagents
  (routing by "can I pre-decide every ruling?", the R→P→G→I→V→C checkpoint format, one writer
  per lane). Read it before orchestrating multi-agent work here.
