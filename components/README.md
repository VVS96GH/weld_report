# Components

Maps the mockup (`mockups/welding-dashboard 1.html`) onto this component tree.

- **ReportShell.tsx** — the mockup's `<header class="header">` + `<nav class="page-nav">`.
  Wraps every route from `app/layout.tsx`. Reads/writes the current page from the URL
  (`usePathname`), so prev/next/`<select>` navigate via `next/link` / `useRouter` to real
  `/welding/N` routes instead of toggling `.page-section.active` in place. Exposes
  `usePageSubtitle(text)` so a page can push its header subtitle up (static fixture
  wording, or `Data as of <meta.as_of>` once `PAGE_SOURCE=database`).
- **ThemeMoodControls.tsx** — the header's mood dropdown + theme toggle. Source of truth
  is the `data-theme`/`data-mood` attributes on `<html>` (read via `useSyncExternalStore`,
  not React state) so ChartCard's own DOM observer and this component never disagree.
  Persists to `localStorage` (guarded), applied post-mount only — never causes a
  hydration mismatch since the SSR defaults already match.
- **PageView.tsx** — the mockup's `.page-section`. Batches a PageModel's flat widget list
  into the mockup's rhythm: a run of KPIs → one `.stats-row`, a run of charts → one
  `.dashboard-grid` of `.card`s, a run of text widgets → one `.dashboard-grid` of
  reference cards, each table → its own `.section-title` + `.table-scroll`.
- **widgets/KpiCard, DataTable, TextNote** — plain `.stat-box` / `.data-table` /
  `.card` markup.
- **widgets/ChartCard.tsx** — `'use client'`; wraps `react-chartjs-2`'s generic `Chart`.
  Colors come from the live mood's CSS variables (`--color-N`, `--accent-primary`), not a
  duplicated JS palette; a `MutationObserver` remounts the chart on mood/theme change.

## Switching `PAGE_SOURCE`

`lib/page-source.ts` picks the data source from `PAGE_SOURCE` (`fixture` | `database`,
default `fixture`). Set `PAGE_SOURCE=database` once `lib/pages/welding.ts` (METRICS-LANE)
exports `getWeldingPage(n)`; until then, or if it's missing/broken, `database` mode throws
a clear error instead of failing the build (the import is dynamic and try/caught).
