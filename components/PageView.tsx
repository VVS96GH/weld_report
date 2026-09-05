"use client";

import type { ChartWidget, KpiWidget, PageModel, TableWidget, TextWidget, Widget } from "@/lib/page-model";
import { usePageSubtitle } from "@/components/ReportShell";
import { KpiCard } from "@/components/widgets/KpiCard";
import { DataTable } from "@/components/widgets/DataTable";
import { ChartCard } from "@/components/widgets/ChartCard";
import { TextNote } from "@/components/widgets/TextNote";

type Group =
  | { kind: "kpi"; items: KpiWidget[] }
  | { kind: "chart"; items: ChartWidget[] }
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
    } else {
      if (last?.kind === "text") last.items.push(w);
      else groups.push({ kind: "text", items: [w] });
    }
  }
  return groups;
}

export function PageView({ model, subtitle }: { model: PageModel; subtitle: string }) {
  usePageSubtitle(subtitle);
  const groups = groupWidgets(model.widgets);

  return (
    <section className="page-section active" aria-labelledby="page-heading">
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
                  <div className="card" key={j}>
                    <div className="card-header">{c.title}</div>
                    <div className="chart-container">
                      <ChartCard widget={c} />
                    </div>
                  </div>
                ))}
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
                  <DataTable widget={g.item} />
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
