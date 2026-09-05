"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";

import type { ChartWidget } from "@/lib/page-model";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
);

// The mockup's mood palettes define between 8 (pastel/powerbi) and 12
// (upsidedown) `--color-N` variables; reading a fixed superset and dropping the
// unset ones lets each mood contribute its own count without a hardcoded table.
const PALETTE_VARS = Array.from({ length: 12 }, (_, i) => `--color-${i + 1}`);

type Palette = {
  colors: string[];
  primary: string;
  grid: string;
  text: string;
  /** Reserved "look here" colour for rejection/backlog series (T.EN `--chart-attention`); unset in legacy moods. */
  attention: string | null;
  /** Tick/legend font family; the T.EN mood sets `--font-mono` for tabular numerics. */
  font: string | undefined;
};

const FALLBACK_PALETTE: Palette = {
  colors: ["#ED7D31", "#70AD47", "#FFD966", "#F4B183", "#A9D18E"],
  primary: "#ED7D31",
  grid: "rgba(255,255,255,0.08)",
  text: "#cccccc",
  attention: null,
  font: undefined,
};

function readPalette(): Palette {
  if (typeof window === "undefined") return FALLBACK_PALETTE;
  const styles = getComputedStyle(document.documentElement);
  const colors = PALETTE_VARS.map((v) => styles.getPropertyValue(v).trim()).filter(Boolean);
  return {
    colors: colors.length > 0 ? colors : FALLBACK_PALETTE.colors,
    primary: styles.getPropertyValue("--accent-primary").trim() || FALLBACK_PALETTE.primary,
    grid: styles.getPropertyValue("--chart-grid").trim() || FALLBACK_PALETTE.grid,
    text: styles.getPropertyValue("--text-secondary").trim() || FALLBACK_PALETTE.text,
    attention: styles.getPropertyValue("--chart-attention").trim() || null,
    font: styles.getPropertyValue("--font-mono").trim() || undefined,
  };
}

// Coral is the highlighter (T.EN spec §1.4): rejection and backlog series take the
// reserved attention colour so the eye lands on them; everything else keeps its
// fixed palette slot (colour follows the entity, never its rank).
const ATTENTION_SERIES = /\b(rej|reject|rejected|backlog|b\.log|not done)\b|"R"/i;

function seriesColor(label: string, index: number, palette: Palette): string {
  if (palette.attention && ATTENTION_SERIES.test(label)) return palette.attention;
  return palette.colors[index % palette.colors.length] ?? palette.primary;
}

function toNum(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = v.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isCircular(type: string): boolean {
  return type === "doughnut" || type === "pie";
}

/**
 * Client component wrapping react-chartjs-2. Dataset colors are read live from the
 * current mood's CSS custom properties (`--color-N`, `--accent-primary`, etc.) rather
 * than a duplicated JS palette table, so ThemeMoodControls setting `data-mood`/
 * `data-theme` on <html> is the single source of truth. A MutationObserver watches
 * those attributes and bumps `version`, which remounts the underlying Chart.js
 * instance (via `key`) — the same "destroy and rebuild" behavior as the mockup's
 * `rebuildCharts()`.
 *
 * `chartjs-plugin-datalabels` is not an installed dependency (see AGENTS.md scope),
 * so charts whose `options_notes` mention "has datalabels plugin" render without
 * on-bar value labels.
 */
export function ChartCard({ widget }: { widget: ChartWidget }) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.attributeName === "data-mood" || m.attributeName === "data-theme")) {
        setVersion((v) => v + 1);
      }
    });
    observer.observe(target, { attributes: true, attributeFilter: ["data-mood", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the re-read trigger, not an input
  const palette = useMemo(() => readPalette(), [version]);

  const notes = widget.options_notes ?? "";
  const stackedX = notes.includes("stacked (x)");
  const stackedY = notes.includes("stacked (y)");
  const percentAxis = notes.includes("percent-axis");
  const horizontal = notes.toLowerCase().includes("indexaxis") && notes.toLowerCase().includes("y");
  const circular = isCircular(widget.chart_type);

  // Chart.js's ChartData/ChartOptions generics don't compose across a runtime-chosen
  // chart type, so the config objects are built loosely here and handed to a
  // per-type-literal <Chart type="..."> below, which is what keeps react-chartjs-2's
  // own types happy at the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = useMemo(() => {
    if (circular) {
      const ds = widget.datasets[0];
      return {
        labels: widget.labels,
        datasets: [
          {
            label: ds?.label || widget.title,
            data: (ds?.data ?? []).map(toNum),
            backgroundColor: widget.labels.map((_, i) => palette.colors[i % palette.colors.length]),
            borderColor: "transparent",
          },
        ],
      };
    }
    return {
      labels: widget.labels,
      datasets: widget.datasets.map((ds, i) => {
        const color = seriesColor(ds.label, i, palette);
        const base = { label: ds.label, data: ds.data.map(toNum), stack: ds.stack };
        if (widget.chart_type === "line") {
          return { ...base, borderColor: color, backgroundColor: color, tension: 0.3, pointRadius: 2 };
        }
        return { ...base, backgroundColor: color, borderColor: color };
      }),
    };
  }, [widget, palette, circular]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? "y" : "x",
      plugins: {
        legend: { display: true, labels: { color: palette.text, boxWidth: 12, font: { size: 10, family: palette.font } } },
        tooltip: { enabled: true },
      },
      scales: circular
        ? undefined
        : {
            x: {
              stacked: stackedX,
              ticks: { color: palette.text, font: { size: 10, family: palette.font } },
              grid: { color: palette.grid },
            },
            y: {
              stacked: stackedY,
              beginAtZero: true,
              ticks: {
                color: palette.text,
                font: { size: 10, family: palette.font },
                callback: percentAxis ? (value: number | string) => `${value}%` : undefined,
              },
              grid: { color: palette.grid },
            },
          },
    }),
    [palette, stackedX, stackedY, percentAxis, horizontal, circular],
  );

  // Trend charts fed by the not-yet-seeded weld_weekly_snapshot table (e.g. page 1's
  // RT/UT and PWHT backlog and rejection-rate charts) come back with every dataset
  // all-null. Mounting Chart.js on that draws a bare, misleading 0-1 axis, so render a
  // placeholder instead (same card/chart-container height, so the grid doesn't jump).
  const hasData = widget.datasets.some((ds) => ds.data.some((v) => toNum(v) !== null));
  if (!hasData) {
    // A second, smaller "source: ..." line was asked for only if the model carries a
    // hint for which source is empty — it doesn't today (that field isn't on
    // ChartWidget in lib/page-model.ts, out of scope for this fix), so just the one line.
    return (
      <div className="chart-empty">
        <span>No data loaded for this chart</span>
      </div>
    );
  }

  switch (widget.chart_type) {
    case "line":
      return <Chart key={version} type="line" data={data} options={options} />;
    case "doughnut":
      return <Chart key={version} type="doughnut" data={data} options={options} />;
    case "pie":
      return <Chart key={version} type="pie" data={data} options={options} />;
    case "bar":
    default:
      return <Chart key={version} type="bar" data={data} options={options} />;
  }
}
