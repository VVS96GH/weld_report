"use client";

import { relabelModel } from "@/lib/labels";
import type { ChartWidget, KpiWidget, PageModel, TextWidget, Widget } from "@/lib/page-model";
import { usePageSubtitle } from "@/components/ReportShell";
import { KpiCard } from "@/components/widgets/KpiCard";
import { ChartCard } from "@/components/widgets/ChartCard";
import { TextNote } from "@/components/widgets/TextNote";

/**
 * The RT Backlog Forecast page laid out as the pbix page 20 is (owner request
 * 2026-09-08: "расположить графики как на этой странице"):
 *
 *   left   — the per-sub-contractor forecast bar, the Done / Backlog and the
 *            forecast-by-RT% doughnuts side by side beneath it
 *   middle — "Total RT/UT Done" and the six headline cards, stacked
 *   right  — the joint monthly chart, its row of RT cards, the dia monthly chart,
 *            its row of dia cards
 *
 * Widgets are picked by chart canvas_id / KPI label so the data layer's order does
 * not matter; anything the layout does not name falls through to a trailing grid,
 * so a new widget is never silently dropped. Below the md breakpoint the three
 * columns stack (app/globals.css .forecast-layout).
 */

const RIGHT_RT_CARDS = ["RT B.Log", "Numb RT/UT_", "RT Avrg Prod-on (week-end filtered)", "Months to keep RT B.log", "PWHT B.Log PBI Rule"];
const RIGHT_DIA_CARDS = ["RT Dia B.Log", "Total Welded RT Dia", "RT Dia Avrg Prod-on", "Months to keep Dia RT B.log"];
const MIDDLE_CARDS = ["Total RT/UT Done", "RT B.Log Talisman", "RT Total Forecast B.log", "RT Dia Total Forecast B.log", "Numb RT/UT 2024", "RT Avrg Prod-on 2024-26 per Month", "QTY Years"];

function Chart({ widget, className }: { widget: ChartWidget; className?: string }) {
  return (
    <div className={`card ${className ?? ""}`.trim()}>
      <div className="card-header">{widget.title}</div>
      <div className="chart-container">
        <ChartCard widget={widget} />
      </div>
    </div>
  );
}

export function ForecastView({ model: source, subtitle }: { model: PageModel; subtitle: string }) {
  const model = relabelModel(source);
  usePageSubtitle(subtitle);

  const charts = new Map<string, ChartWidget>();
  const kpis = new Map<string, KpiWidget>();
  const notes: TextWidget[] = [];
  // cards are looked up by their pbix label (MIDDLE_CARDS…), shown relabelled
  model.widgets.forEach((w, i) => {
    const orig = source.widgets[i];
    if (w.kind === "chart") charts.set(w.canvas_id, w);
    else if (w.kind === "kpi" && orig.kind === "kpi") kpis.set(orig.label, w);
    else if (w.kind === "text" && !w.note) notes.push(w);
  });
  const used = new Set<Widget>();
  const chart = (id: string) => {
    const c = charts.get(id);
    if (c) used.add(c);
    return c;
  };
  const kpi = (label: string) => {
    const k = kpis.get(label);
    if (k) used.add(k);
    return k;
  };
  const cards = (labels: string[]) => labels.map(kpi).filter((k): k is KpiWidget => Boolean(k));

  // one screen (owner, 2026-10-15): the monthly charts show the last 12 months,
  // the scrollbar reaches the rest; the doughnuts keep their legend below so
  // the outside labels never reach the title
  const hint = (w: ChartWidget | undefined, extra: string) =>
    w ? { ...w, options_notes: `${w.options_notes ?? ""} ${extra}`.trim() } : undefined;
  const bar = chart("forecast_bar");
  const donutDone = hint(chart("forecast_donut_done"), "legend-bottom");
  const donutBacklog = hint(chart("forecast_donut_backlog"), "legend-bottom");
  const joint = hint(chart("forecast_joint_monthly"), "window 12");
  const dia = hint(chart("forecast_dia_monthly"), "window 12");
  const middle = cards(MIDDLE_CARDS);
  const rightRt = cards(RIGHT_RT_CARDS);
  const rightDia = cards(RIGHT_DIA_CARDS);
  const rest = model.widgets.filter((w) => w.kind !== "filter" && w.kind !== "text" && !used.has(w));

  return (
    <section className="page-section active" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">{model.title}</h2>
      </div>

      <div className="forecast-layout">
        <div className="forecast-col forecast-col--left">
          {bar ? <Chart widget={bar} className="forecast-bar" /> : null}
          <div className="forecast-done-row">
            {donutDone ? <Chart widget={donutDone} className="forecast-donut-small" /> : null}
            {donutBacklog ? <Chart widget={donutBacklog} className="forecast-donut" /> : null}
          </div>
        </div>

        <div className="forecast-col forecast-col--middle">
          <div className="stats-row forecast-stack">
            {middle.map((k) => (
              <KpiCard key={k.label} widget={k} />
            ))}
          </div>
        </div>

        <div className="forecast-col forecast-col--right">
          {joint ? <Chart widget={joint} className="forecast-monthly" /> : null}
          <div className="stats-row forecast-cards">
            {rightRt.map((k) => (
              <KpiCard key={k.label} widget={k} />
            ))}
          </div>
          {dia ? <Chart widget={dia} className="forecast-monthly" /> : null}
          <div className="stats-row forecast-cards">
            {rightDia.map((k) => (
              <KpiCard key={k.label} widget={k} />
            ))}
          </div>
        </div>
      </div>

      {rest.length > 0 ? (
        <div className="dashboard-grid">
          {rest.map((w, i) =>
            w.kind === "chart" ? (
              <Chart key={i} widget={w} />
            ) : w.kind === "kpi" ? (
              <div className="stats-row" key={i}>
                <KpiCard widget={w} />
              </div>
            ) : null,
          )}
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="dashboard-grid">
          {notes.map((t, i) => (
            <TextNote key={i} widget={t} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
