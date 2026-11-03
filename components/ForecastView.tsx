"use client";

import { relabelModel } from "@/lib/labels";
import type { ChartWidget, KpiWidget, PageModel, TextWidget, Widget } from "@/lib/page-model";
import { usePageSubtitle } from "@/components/ReportShell";
import { KpiCard } from "@/components/widgets/KpiCard";
import { ChartCard } from "@/components/widgets/ChartCard";
import { TextNote } from "@/components/widgets/TextNote";
import { DoneGauge, ForecastBars, ForecastRing, RT_PARTS } from "@/components/widgets/ForecastVisuals";
import { MonthlyBars } from "@/components/widgets/MonthlyBars";

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

const RIGHT_RT_CARDS = ["RT B.Log", "Numb RT/UT_", "RT Avrg Prod-on 2024-26 per Month", "Months to keep RT B.log", "PWHT B.Log PBI Rule"];
const RIGHT_DIA_CARDS = ["RT Dia B.Log", "Total Welded RT Dia", "RT Dia Avrg Prod-on", "Months to keep Dia RT B.log"];
const MIDDLE_CARDS = ["Total RT/UT Done", "RT B.Log Talisman", "RT Total Forecast B.log", "RT Dia Total Forecast B.log", "Numb RT/UT 2024", "RT Avrg Prod-on 2024-26 per Month", "QTY Years"];

/** A series of a chart widget by its label (the pbix's own), as numbers. */
function series(w: ChartWidget | undefined, label: string): number[] {
  const d = w?.datasets.find((x) => x.label.trim() === label)?.data ?? [];
  return d.map((v) => (typeof v === "number" ? v : Number(v) || 0));
}
/** A doughnut slice by its label. */
function slice(w: ChartWidget | undefined, label: string): number {
  const i = (w?.labels ?? []).findIndex((l) => String(l).trim().toLowerCase() === label.toLowerCase());
  const v = i < 0 ? 0 : w?.datasets[0]?.data[i];
  return typeof v === "number" ? v : Number(v) || 0;
}

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
  const bar = chart("forecast_bar");
  const donutDone = chart("forecast_donut_done");
  const donutBacklog = chart("forecast_donut_backlog");
  const joint = chart("forecast_joint_monthly");
  const dia = chart("forecast_dia_monthly");
  // F + S per month (owner, 2026-11-03: redrawn, components/widgets/MonthlyBars)
  const monthsOf = (w: ChartWidget) =>
    w.labels.map((l, i) => ({ label: String(l), f: series(w, "F")[i] ?? 0, s: series(w, "S")[i] ?? 0 }));
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
          {/* redrawn in the T.EN style (owner, 2026-11-03; components/widgets/ForecastVisuals):
              the RT % parts only, their total drawn once */}
          {bar ? (
            <div className="card forecast-bar">
              <div className="card-header">Total Forecast B.log by Sub-Contractor</div>
              <ForecastBars
                rows={bar.labels.map((name, i) => ({
                  name: String(name),
                  values: Object.fromEntries(RT_PARTS.map((p) => [p.key, series(bar, p.label)[i] ?? 0])),
                }))}
              />
            </div>
          ) : null}
          <div className="forecast-done-row">
            {donutDone ? (
              <div className="card forecast-donut-small">
                <div className="card-header">RT/UT Done / B.log</div>
                <DoneGauge
                  done={slice(donutDone, "Done")}
                  backlog={slice(donutDone, "RT Total Forecast B.Log") || slice(donutDone, "RT Total Forecast Backlog")}
                />
              </div>
            ) : null}
            {donutBacklog ? (
              <div className="card forecast-donut">
                <div className="card-header">Total Forecast B.log by RT %</div>
                <ForecastRing values={Object.fromEntries(RT_PARTS.map((p) => [p.key, slice(donutBacklog, p.label)]))} />
              </div>
            ) : null}
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
          {joint ? (
            <div className="card forecast-monthly">
              <div className="card-header">{joint.title}</div>
              <MonthlyBars months={monthsOf(joint)} unit="joints" height={120} />
            </div>
          ) : null}
          <div className="stats-row forecast-cards">
            {rightRt.map((k) => (
              <KpiCard key={k.label} widget={k} />
            ))}
          </div>
          {dia ? (
            <div className="card forecast-monthly">
              <div className="card-header">{dia.title}</div>
              <MonthlyBars months={monthsOf(dia)} unit="dia inch" height={120} />
            </div>
          ) : null}
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
