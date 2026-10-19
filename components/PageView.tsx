"use client";

import type { ReactNode } from "react";
import type { ChartWidget, KpiWidget, PageModel, TableWidget, TextWidget, Widget } from "@/lib/page-model";
import { usePageSubtitle } from "@/components/ReportShell";
import { relabelModel } from "@/lib/labels";
import { KpiCard } from "@/components/widgets/KpiCard";
import { DataTable } from "@/components/widgets/DataTable";
import { ChartCard } from "@/components/widgets/ChartCard";
import { TextNote } from "@/components/widgets/TextNote";

type Group =
  | { kind: "kpi"; items: KpiWidget[] }
  | { kind: "chart"; items: ChartWidget[]; kpis?: KpiWidget[] }
  | { kind: "text"; items: TextWidget[] }
  | { kind: "table"; item: TableWidget };

/**
 * Batches the model's flat widget list into the mockup's layout rhythm: a run of
 * consecutive KPIs becomes one `.stats-row`, a run of consecutive charts becomes one
 * `.dashboard-grid` of chart cards, a run of consecutive text widgets becomes one
 * `.dashboard-grid` of reference cards, and every table gets its own full-width
 * `.section-title` + table (tables are never batched — the mockup never grids them).
 *
 * The mockup groups charts into several 2-up `.dashboard-grid` rows (mixing full-size
 * and `.chart-small` cards); the PageModel doesn't carry that per-widget grouping or
 * size hint, so every consecutive chart run here renders as a single auto-fitting
 * grid of same-size cards instead — see the CHECKPOINT deviations note.
 */
function groupWidgets(widgets: Widget[]): Group[] {
  const groups: Group[] = [];
  for (const w of widgets) {
    const last = groups[groups.length - 1];
    if (w.kind === "table") {
      groups.push({ kind: "table", item: w });
    } else if (w.kind === "kpi") {
      if (last?.kind === "kpi") last.items.push(w);
      else groups.push({ kind: "kpi", items: [w] });
    } else if (w.kind === "chart") {
      if (last?.kind === "chart") last.items.push(w);
      else groups.push({ kind: "chart", items: [w] });
    } else if (w.kind === "text") {
      // methodology notes stay in the model, not on the page (TextWidget.note)
      if (w.note) continue;
      if (last?.kind === "text") last.items.push(w);
      else groups.push({ kind: "text", items: [w] });
    }
    // "filter" widgets are rendered by the page's filter bar, not in the grid.
  }
  // A long KPI run right before the charts becomes one 3-across card inside the
  // chart grid, in the first free slot (owner, 2026-10-15, as the pbix page shows
  // its cards), instead of a full-width strip above the charts.
  for (let i = 0; i + 1 < groups.length; i++) {
    const k = groups[i];
    const c = groups[i + 1];
    if (k.kind === "kpi" && k.items.length >= KPI_PANEL_FROM && c.kind === "chart") {
      c.kpis = k.items;
      groups.splice(i, 1);
    }
  }
  return groups;
}

/**
 * The weld-type pivots ("Cumulative Welding Status", "Welding Status for this
 * Week") show only the weld types the scope has, as the pbix matrix does
 * (owner, 2026-10-18): a column blank in every row goes. Display only.
 */
function dropEmptyTypeColumns(t: TableWidget): TableWidget {
  if (!/welding status/i.test(t.title)) return t;
  const keep = t.columns.map(
    (_, i) => i === 0 || i === t.columns.length - 1 || t.rows.some((r) => (r[i] ?? "").trim() !== ""),
  );
  if (keep.every(Boolean)) return t;
  const pick = (r: string[]) => r.filter((_, i) => keep[i]);
  return { ...t, columns: pick(t.columns), rows: t.rows.map(pick), total_row: t.total_row ? pick(t.total_row) : undefined };
}

/** A reference list ("Defect Code Reference: BT: Burn Through C: Crack …") as a code | meaning table. */
const REF_RE = /^\s*(Defect Code Reference|WELD TYPE Reference)\s*:\s*/i;
function referenceTable(text: string): TableWidget | null {
  const m = REF_RE.exec(text);
  if (!m) return null;
  const body = text.slice(m[0].length);
  // a code is a short upper-case token followed by ":" (BT, R/I, SLAG, L4, WPAD)
  const parts = body.split(/(?:^|\s)([A-Z][A-Z0-9/]{0,5}):\s/).slice(1);
  const rows: string[][] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) rows.push([parts[i]!, parts[i + 1]!.trim()]);
  if (!rows.length) return null;
  const isDefect = /defect/i.test(m[1]!);
  return {
    kind: "table",
    title: isDefect ? "Defect Code Reference" : "Weld Type Reference",
    columns: [isDefect ? "Defect Code" : "Weld Type", "Description"],
    rows,
  };
}

/** KPI runs at least this long go into the chart grid as one card. */
const KPI_PANEL_FROM = 6;

export function PageView({ model: source, subtitle, top }: { model: PageModel; subtitle: string; top?: ReactNode }) {
  const model = relabelModel(source);
  usePageSubtitle(subtitle);
  // "Defect Code Reference: BT: Burn Through C: Crack …" → a two-column table
  const refs: TableWidget[] = [];
  const widgets = model.widgets.filter((w) => {
    const t = w.kind === "text" ? referenceTable(w.text) : null;
    if (t) refs.push(t);
    return !t;
  });
  const refAt = model.widgets.findIndex((w) => w.kind === "text" && referenceTable(w.text));
  // what comes before the reference lists renders as usual; what follows sits beside them
  const cut = refAt < 0 ? widgets.length : model.widgets.slice(0, refAt).filter((w) => !(w.kind === "text" && referenceTable(w.text))).length;
  const before = groupWidgets(widgets.slice(0, cut));
  const after = groupWidgets(widgets.slice(cut));

  return (
    <section className="page-section active pv-page" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">{model.title}</h2>
      </div>
      {model.subtitle ? <p className="page-subtitle">{model.subtitle}</p> : null}
      {top}

      {before.map((g, i) => renderGroup(g, i))}
      {refs.length ? (
        // the reference lists as two code | meaning tables beside the tables that
        // follow them (owner, 2026-10-18: Project Welding & NDE Status)
        <div className="pv-with-refs">
          <div className="pv-with-refs-main">{after.map((g, i) => renderGroup(g, i))}</div>
          <div className="pv-refs">
            {refs.map((t) => (
              <div key={t.title}>
                <div className="section-title">{t.title}</div>
                <div className="table-scroll">
                  <DataTable widget={t} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        after.map((g, i) => renderGroup(g, i + before.length))
      )}
    </section>
  );
}

function renderGroup(g: Group, i: number) {
        switch (g.kind) {
          case "kpi":
            return (
              <div className="stats-row" key={i}>
                {g.items.map((k, j) => (
                  <KpiCard key={j} widget={k} />
                ))}
              </div>
            );
          case "chart":
            return (
              <div className="dashboard-grid" key={i}>
                {g.items.map((c, j) => (
                  // A trend with many categories (the 14-week welding progress) needs
                  // two grid tracks so its value labels don't collide (owner request
                  // 2026-09-07: totals on every chart).
                  // Doughnuts never widen: page 1's lists every weld type (2026-10-18)
                  // and must keep its size and place.
                  <div className={c.labels.length >= 10 && !/doughnut|pie/.test(c.chart_type) ? "card card--wide" : "card"} key={j}>
                    <div className="card-header">{c.title}</div>
                    <div className="chart-container">
                      <ChartCard widget={c} />
                    </div>
                  </div>
                ))}
                {g.kpis ? (
                  <div className="card kpi-panel" role="group" aria-label="Key figures">
                    <div className="kpi-panel-grid">
                      {g.kpis.map((k, j) => (
                        <KpiCard key={j} widget={k} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          case "text":
            return (
              <div className="dashboard-grid" key={i}>
                {g.items.map((t, j) => (
                  <TextNote key={j} widget={t} />
                ))}
              </div>
            );
          case "table":
            return (
              <div key={i}>
                <div className="section-title">{g.item.title}</div>
                <div className="table-scroll">
                  {/* a table with indented detail rows opens them under + (owner, 2026-10-15) */}
                  <DataTable widget={dropEmptyTypeColumns(g.item)} collapsible={g.item.rows.some((r) => /^\s{2}/.test(r[0] ?? ""))} />
                </div>
              </div>
            );
          default:
            return null;
        }
}
