"use client";

import type { ChartWidget, KpiWidget, PageModel, TableWidget, TextWidget, Widget } from "@/lib/page-model";
import { usePageSubtitle } from "@/components/ReportShell";
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

/** KPI runs at least this long go into the chart grid as one card. */
const KPI_PANEL_FROM = 6;

export function PageView({ model, subtitle }: { model: PageModel; subtitle: string }) {
  usePageSubtitle(subtitle);
  const groups = groupWidgets(model.widgets);

  return (
    <section className="page-section active pv-page" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">{model.title}</h2>
      </div>
      {model.subtitle ? <p className="page-subtitle">{model.subtitle}</p> : null}

      {groups.map((g, i) => {
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
                  <div className={c.labels.length >= 10 ? "card card--wide" : "card"} key={j}>
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
                  <DataTable widget={g.item} collapsible={g.item.rows.some((r) => /^\s{2}/.test(r[0] ?? ""))} />
                </div>
              </div>
            );
          default:
            return null;
        }
      })}
    </section>
  );
}
