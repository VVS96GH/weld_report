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
  | { kind: "chart"; items: ChartWidget[]; kpis?: KpiWidget[]; sideKpis?: KpiWidget[] }
  | { kind: "text"; items: TextWidget[] }
  | { kind: "table"; item: TableWidget }
  /** The Graph pages: the rate and B.Log charts 2 × 2 on the left, the tables beside them (owner, 2026-10-19). */
  | { kind: "split"; tables: TableWidget[]; charts: ChartWidget[] }
  /**
   * The whole Graph page as the pbix lays it out (owner, 2026-10-19): left the
   * welding status, the rate lines and the two B.Log charts; right the Weld Type
   * doughnut with the key figures beside it, the tables under it.
   */
  | { kind: "graph"; status: ChartWidget; donut: ChartWidget; kpis: KpiWidget[]; rates: ChartWidget[]; blogs: ChartWidget[]; tables: TableWidget[] };

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
  // A short KPI run right before a chart row with a Weld Type doughnut (the Graph
  // pages) goes beside that doughnut, as a column (owner, 2026-10-19).
  for (let i = 0; i + 1 < groups.length; i++) {
    const k = groups[i];
    const c = groups[i + 1];
    if (k.kind === "kpi" && k.items.length < KPI_PANEL_FROM && c.kind === "chart" && !c.kpis
        && c.items.some((x) => /doughnut|pie/.test(x.chart_type) && /weld type/i.test(x.title))) {
      c.sideKpis = k.items;
      groups.splice(i, 1);
    }
  }
  // A run of tables followed by the four rate / B.Log charts (the Graph pages)
  // becomes one block: the two rejection-rate charts over the two B.Log charts on
  // the left, the tables stacked on the right.
  for (let i = 0; i < groups.length; i++) {
    let j = i;
    while (groups[j]?.kind === "table") j++;
    const c = groups[j];
    if (j - i < 2 || c?.kind !== "chart" || c.kpis || c.items.length < 3 || c.items.length > 4) continue;
    const rate = c.items.filter((x) => /rej/i.test(x.title));
    const blog = c.items.filter((x) => /b\.log|backlog/i.test(x.title) && !/rej/i.test(x.title));
    // MEDGULF has the RT rate chart only: three charts
    if (rate.length < 1 || blog.length !== 2 || rate.length + blog.length !== c.items.length) continue;
    const tables = groups.slice(i, j).map((g) => (g as { kind: "table"; item: TableWidget }).item);
    groups.splice(i, j - i + 1, { kind: "split", tables, charts: [...rate, ...blog] });
  }
  // The doughnut row (with its key figures) right before the split block: the
  // pbix's two-column page.
  for (let i = 0; i + 1 < groups.length; i++) {
    const a = groups[i];
    const b = groups[i + 1];
    if (a.kind !== "chart" || !a.sideKpis || a.items.length !== 2 || b.kind !== "split") continue;
    const donut = a.items.find((x) => /doughnut|pie/.test(x.chart_type));
    const status = a.items.find((x) => x !== donut);
    if (!donut || !status) continue;
    const rates = b.charts.filter((x) => /rej/i.test(x.title));
    const blogs = b.charts.filter((x) => !/rej/i.test(x.title));
    groups.splice(i, 2, { kind: "graph", status, donut, kpis: a.sideKpis, rates, blogs, tables: b.tables });
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
      {/* the CUM bar shares the title's row, one line for both (owner, 2026-10-19) */}
      <div className={top ? "page-header pv-header-with-top" : "page-header"}>
        <h2 id="page-heading">{model.title}</h2>
        {top}
      </div>
      {model.subtitle ? <p className="page-subtitle">{model.subtitle}</p> : null}

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
          case "chart": {
            // Page 1 only (owner, 2026-10-19): trend, RT/UT B.Log, a wider Weld Type
            // doughnut on top; the two rate lines, PWHT B.Log and the key figures under them.
            const P1 = ["chart1_progress", "chart1_rtbacklog", "chart1_weldtype", "chart1_rtrej", "chart1_utrej", "chart1_pwhtbacklog"];
            const page1 = g.kpis && P1.every((id) => g.items.some((c) => c.canvas_id === id));
            const items = page1 ? P1.map((id) => g.items.find((c) => c.canvas_id === id)!) : g.items;
            return (
              <div className={g.sideKpis ? "dashboard-grid pv-compact" : page1 ? "dashboard-grid pv-page1" : "dashboard-grid"} key={i}>
                {items.map((c, j) => (
                  // A trend with many categories (the 14-week welding progress) needs
                  // two grid tracks so its value labels don't collide (owner request
                  // 2026-09-07: totals on every chart).
                  // Doughnuts never widen: page 1's lists every weld type (2026-10-18)
                  // and must keep its size and place.
                  <div
                    className={
                      page1
                        ? `card pv-p1-${c.canvas_id.replace("chart1_", "")}`
                        : c.labels.length >= 10 && !/doughnut|pie/.test(c.chart_type)
                          ? "card card--wide"
                          : "card"
                    }
                    key={j}
                  >
                    <div className="card-header">{c.title}</div>
                    {g.sideKpis && /doughnut|pie/.test(c.chart_type) ? (
                      <div className="pv-donut-kpis">
                        <div className="chart-container">
                          <ChartCard widget={c} />
                        </div>
                        <div className="pv-side-kpis" role="group" aria-label="Key figures">
                          {g.sideKpis.map((k, n) => (
                            <KpiCard key={n} widget={k} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="chart-container">
                        <ChartCard widget={c} />
                      </div>
                    )}
                  </div>
                ))}
                {g.kpis ? (
                  <div className={page1 ? "card kpi-panel pv-p1-kpi" : "card kpi-panel"} role="group" aria-label="Key figures">
                    <div className="kpi-panel-grid">
                      {g.kpis.map((k, j) => (
                        <KpiCard key={j} widget={k} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          }
          case "text":
            return (
              <div className="dashboard-grid" key={i}>
                {g.items.map((t, j) => (
                  <TextNote key={j} widget={t} />
                ))}
              </div>
            );
          case "graph": {
            const card = (c: ChartWidget, cls: string) => (
              <div className={`card ${cls}`}>
                <div className="card-header">{c.title}</div>
                <div className="chart-container">
                  <ChartCard widget={c} />
                </div>
              </div>
            );
            return (
              <div className="pv-graph" key={i}>
                <div className="pv-graph-left">
                  {card(g.status, "pv-graph-status")}
                  {g.rates.map((c, j) => (
                    <div key={j}>{card(c, "pv-graph-rate")}</div>
                  ))}
                  <div className="pv-graph-blogs">
                    {g.blogs.map((c, j) => (
                      <div key={j}>{card(c, "pv-graph-blog")}</div>
                    ))}
                  </div>
                </div>
                <div className="pv-graph-right">
                  <div className="pv-graph-top">
                    {card(g.donut, "pv-graph-donut")}
                    <div className="pv-graph-kpis" role="group" aria-label="Key figures">
                      {g.kpis.map((k, n) => (
                        <KpiCard key={n} widget={k} />
                      ))}
                    </div>
                  </div>
                  {g.tables.map((t, j) => (
                    <div key={j}>
                      <div className="section-title">{t.title}</div>
                      <div className="table-scroll">
                        <DataTable widget={dropEmptyTypeColumns(t)} collapsible={t.rows.some((r) => /^\s{2}/.test(r[0] ?? ""))} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          case "split":
            return (
              <div className="pv-split" key={i}>
                <div className="pv-split-charts">
                  {g.charts.map((c, j) => (
                    <div className="card" key={j}>
                      <div className="card-header">{c.title}</div>
                      <div className="chart-container">
                        <ChartCard widget={c} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pv-split-tables">
                  {g.tables.map((t, j) => (
                    <div key={j}>
                      <div className="section-title">{t.title}</div>
                      <div className="table-scroll">
                        <DataTable widget={dropEmptyTypeColumns(t)} collapsible={t.rows.some((r) => /^\s{2}/.test(r[0] ?? ""))} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          case "table":
            return (
              <div key={i}>
                {/^Project RT & PWHT Status by Sub-Contractor$/i.test(g.item.title) ? (
                  // the joints behind the RT B.Log / PWHT B.Log totals, every weld row and welder (owner, 2026-10-19)
                  <div className="section-title section-title--actions">
                    <span>{g.item.title}</span>
                    <span className="section-actions">
                      <a className="ms-btn blog-btn blog-btn--rt" href="/api/backlog-export?kind=rt" download title="Every joint of RT B.Log Total, with all weld rows, columns and welders (CSV)">
                        RT B.Log ⤓
                      </a>
                      <a className="ms-btn blog-btn blog-btn--pwht" href="/api/backlog-export?kind=pwht" download title="Every joint of PWHT B.Log All, with all weld rows, columns and welders (CSV)">
                        PWHT B.Log ⤓
                      </a>
                    </span>
                  </div>
                ) : (
                  <div className="section-title">{g.item.title}</div>
                )}
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
