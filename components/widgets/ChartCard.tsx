"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";

import type { ChartWidget } from "@/lib/page-model";

// The generic <Chart type=…> from react-chartjs-2 does not auto-register the
// controller for its `type` (the typed <Bar>/<Line> wrappers do), so every
// chart type the report uses must be registered here. Without the controllers
// the production bundle throws `"bar" is not a registered controller` on the
// client and Next swaps the whole page for its global error boundary.
ChartJS.register(
  BarController,
  LineController,
  DoughnutController,
  PieController,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  // Registered globally but OFF by default (see `datalabels: { display: false }` in the
  // chart defaults below); each chart opts in with the per-type config it needs.
  ChartDataLabels,
);
ChartJS.defaults.set("plugins.datalabels", { display: false });

// ── value labels (owner request 2026-09-07: "на графиках нужны итоговые числа") ──
// Segment values sit inside stacked bars and every stack carries its total above it,
// the way the pbix "Welding Progress (Project)" column chart is labelled. Lines get
// their point values, doughnuts their slice values outside the ring.

function fmtValue(v: unknown, percent: boolean): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  if (percent) return `${v.toFixed(2)}%`;
  return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Owner-specified acceptance thresholds for the cumulative rejection-rate lines
 * (pbix "% RT Rejection Rate by Film" / "% UT/PAUT Rejection Rate by Length",
 * owner screenshot 2026-09-07): an amber "Attention" line and a red "Unacceptable"
 * line drawn as constant series, the axis sized to the upper threshold so the
 * rate reads against its limits instead of against itself.
 */
const RATE_THRESHOLDS: { match: RegExp; attention: number; unacceptable: number }[] = [
  { match: /RT Rejection Rate by Film/i, attention: 1, unacceptable: 3 },
  { match: /UT(\/PAUT)? Rejection Rate by Length/i, attention: 1, unacceptable: 1.5 },
];

function thresholdsFor(title: string) {
  return RATE_THRESHOLDS.find((t) => t.match.test(title)) ?? null;
}

/** How many categories a long axis shows at once; the slider scrolls the rest. */
const VISIBLE_CATEGORIES = 24;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-07-24" → "24-Jul-26" (the pbix axis format); anything else passes through. */
function axisLabel(label: unknown): string {
  const m = typeof label === "string" ? ISO_DATE.exec(label) : null;
  if (!m) return String(label ?? "");
  return `${m[3]}-${MONTHS[Number(m[2]) - 1] ?? m[2]}-${m[1].slice(2)}`;
}

/**
 * Inline Chart.js plugin: for a stacked bar chart, write the per-index total of every
 * VISIBLE dataset above the top of the stack. Kept as a plugin (not a datalabels
 * formatter on the last dataset) so the total still shows when the last dataset is
 * null at that index or hidden through the legend.
 */
const stackTotalsPlugin = {
  id: "stackTotals",
  afterDatasetsDraw(chart: ChartJS) {
    const meta0 = chart.getDatasetMeta(0);
    if (!meta0 || (chart.config as { type?: string }).type !== "bar") return;
    const opts = (chart.options.plugins as Record<string, unknown> | undefined)?.stackTotals as
      | { color: string; font: string; percent: boolean }
      | undefined;
    if (!opts) return;
    const { ctx } = chart;
    const count = chart.data.labels?.length ?? 0;
    ctx.save();
    ctx.fillStyle = opts.color;
    ctx.font = `600 10px ${opts.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let i = 0; i < count; i++) {
      let total = 0;
      let top = Number.POSITIVE_INFINITY;
      let x: number | null = null;
      let any = false;
      chart.data.datasets.forEach((ds, di) => {
        if (!chart.isDatasetVisible(di)) return;
        const v = ds.data[i];
        if (typeof v !== "number" || !Number.isFinite(v)) return;
        const el = chart.getDatasetMeta(di).data[i];
        if (!el) return;
        any = true;
        total += v;
        top = Math.min(top, el.y);
        x = el.x;
      });
      if (!any || x === null) continue;
      ctx.fillText(fmtValue(total, opts.percent), x, top - 3);
    }
    ctx.restore();
  },
};

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
  /** Foreground for value labels drawn on the card surface (totals, line points, doughnut). */
  fg: string;
  /** The pbix "Weld Qty" pair: F gold / S navy (`--series-f` / `--series-s`, T.EN mood). */
  seriesF: string | null;
  seriesS: string | null;
};

const FALLBACK_PALETTE: Palette = {
  colors: ["#ED7D31", "#70AD47", "#FFD966", "#F4B183", "#A9D18E"], // token-lint: allow-hex — legacy mood fallback
  primary: "#ED7D31", // token-lint: allow-hex — legacy mood fallback
  grid: "rgba(255,255,255,0.08)", // token-lint: allow-hex — legacy mood fallback
  text: "#cccccc", // token-lint: allow-hex — legacy mood fallback
  attention: null,
  font: undefined,
  fg: "#cccccc", // token-lint: allow-hex — legacy mood fallback
  seriesF: null,
  seriesS: null,
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
    fg: styles.getPropertyValue("--fg").trim() || styles.getPropertyValue("--text-primary").trim() || FALLBACK_PALETTE.fg,
    seriesF: styles.getPropertyValue("--series-f").trim() || null,
    seriesS: styles.getPropertyValue("--series-s").trim() || null,
  };
}

// Coral is the highlighter (T.EN spec §1.4): rejection and backlog series take the
// reserved attention colour so the eye lands on them; everything else keeps its
// fixed palette slot (colour follows the entity, never its rank).
const ATTENTION_SERIES = /\b(rej|reject|rejected|backlog|b\.log|not done)\b|"R"/i;

// The pbix "Weld Qty" legend: F is gold, S is navy (owner screenshot 2026-09-07). Matches
// the project trend's "F Weld" / "S Weld" and the sub-contractor charts' '"F" Weld only'
// and '"F"+"S" Weld Qty' series; everything else keeps its palette slot.
const F_SERIES = /^"?F"?( Weld( only)?)?$/i;
const S_SERIES = /^"?S"?( Weld)?$|^"F"\+"S"/i;

function seriesColor(label: string, index: number, palette: Palette): string {
  if (palette.attention && ATTENTION_SERIES.test(label)) return palette.attention;
  if (palette.seriesF && F_SERIES.test(label)) return palette.seriesF;
  if (palette.seriesS && S_SERIES.test(label)) return palette.seriesS;
  return palette.colors[index % palette.colors.length] ?? palette.primary;
}

type DatalabelCtx = { dataset: { data: unknown[] }; dataIndex: number; chart: ChartJS };

/** Per-type chartjs-plugin-datalabels config; `display: false` is the registered default. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function valueLabels(type: string, stacked: boolean, percent: boolean, circular: boolean, palette: Palette, seriesCount: number, categoryCount: number, horizontal = false): any {
  const font = { size: 10, family: palette.font, weight: 600 };
  if (circular) {
    // Slice values outside the ring; slivers under 2 % of the total stay unlabelled
    // (the legend and tooltip still carry them) so labels never pile up.
    return {
      display: (ctx: DatalabelCtx) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        const total = ctx.dataset.data.reduce<number>((a, b) => a + (typeof b === "number" ? b : 0), 0);
        return typeof v === "number" && total > 0 && v / total >= 0.02;
      },
      formatter: (v: unknown) => fmtValue(v, false),
      color: palette.fg,
      anchor: "end",
      align: "end",
      // adjacent small slices alternate near/far so their labels stagger instead of overlapping
      offset: (ctx: DatalabelCtx) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        const total = ctx.dataset.data.reduce<number>((a, b) => a + (typeof b === "number" ? b : 0), 0);
        const small = typeof v === "number" && total > 0 && v / total < 0.08;
        return small && ctx.dataIndex % 2 === 1 ? 20 : 2;
      },
      clamp: true,
      font,
    };
  }
  if (type === "line") {
    return {
      display: (ctx: DatalabelCtx) => {
        const ds = ctx.dataset as { threshold?: boolean; data: unknown[] };
        // the limit's name sits above the dashed line near its right end (second-to-last
        // point, so the text is never clipped by the chart edge)
        return ds.threshold ? ctx.dataIndex === Math.max(0, ds.data.length - 2) : true;
      },
      formatter: (v: unknown, ctx: DatalabelCtx) => {
        const ds = ctx.dataset as { threshold?: boolean; label?: string };
        return ds.threshold ? ds.label ?? "" : fmtValue(v, percent);
      },
      color: (ctx: DatalabelCtx) => {
        const ds = ctx.dataset as { threshold?: boolean; borderColor?: string };
        return ds.threshold ? ds.borderColor ?? palette.fg : palette.fg;
      },
      align: "top",
      anchor: "end",
      offset: 3,
      clamp: true,
      font,
    };
  }
  if (stacked) {
    // Segment value inside its bar, white on the fill, hidden when the segment is too
    // short to hold the text; the stack total is drawn by stackTotalsPlugin. With
    // eight or more categories the bars are narrow, so the label stands upright
    // (owner request 2026-09-07: "числа внутри колонки расположи вертикально").
    const upright = categoryCount >= 8;
    return {
      display: (ctx: DatalabelCtx) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        const scale = ctx.chart.scales.y;
        if (typeof v !== "number" || !scale) return false;
        const px = Math.abs(scale.getPixelForValue(v) - scale.getPixelForValue(0));
        return px >= (upright ? 40 : 14);
      },
      formatter: (v: unknown) => fmtValue(v, percent),
      color: "#ffffff", // token-lint: allow-hex — ink on a saturated bar fill, both schemes
      anchor: "center",
      align: "center",
      rotation: upright ? -90 : 0,
      clamp: true,
      font,
    };
  }
  // Grouped bars: the value above each bar — rotated upright when three or more series
  // share a category, because the bars are then too narrow for horizontal text.
  if (horizontal) {
    // value to the right of each bar; the 0.0 of an empty bar is noise, not data
    return {
      display: (ctx: DatalabelCtx) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        return typeof v === "number" && v !== 0;
      },
      formatter: (v: unknown) => fmtValue(v, percent),
      color: palette.fg,
      anchor: "end",
      align: "end",
      offset: 2,
      clamp: true,
      font: { ...font, size: 9 },
    };
  }
  const rotated = seriesCount > 2;
  return {
    display: true,
    formatter: (v: unknown) => fmtValue(v, percent),
    color: palette.fg,
    anchor: "end",
    align: rotated ? "end" : "top",
    rotation: rotated ? -90 : 0,
    offset: rotated ? 4 : 1,
    clamp: true,
    font: { ...font, size: 9 },
  };
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

  // Long category axes (the forecast's 32-month series) show a WINDOW of the last
  // VISIBLE_CATEGORIES points with a slider underneath to scroll back — the pbix
  // chart's own scrollbar (owner request 2026-09-08: "ползунок внизу графика,
  // чтоб отображалось 24 месяца"). Circular charts never window.
  const windowed = !isCircular(widget.chart_type) && widget.labels.length > VISIBLE_CATEGORIES;
  const maxStart = Math.max(0, widget.labels.length - VISIBLE_CATEGORIES);
  const [windowStart, setWindowStart] = useState(maxStart);
  const start = windowed ? Math.min(windowStart, maxStart) : 0;
  const end = windowed ? start + VISIBLE_CATEGORIES : widget.labels.length;

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
    const labels = widget.labels.slice(start, end);
    const slice = <T,>(arr: T[]) => arr.slice(start, end);
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
    const thresholds = widget.chart_type === "line" ? thresholdsFor(widget.title) : null;
    const datasets = widget.datasets.map((ds, i) => {
      // With threshold lines the rate itself is the neutral series (pbix: blue) and
      // the red is reserved for the "Unacceptable" limit.
      const color = thresholds ? palette.colors[0] ?? palette.primary : seriesColor(ds.label, i, palette);
      const base = { label: ds.label, data: slice(ds.data).map(toNum), stack: ds.stack };
      if (widget.chart_type === "line") {
        return { ...base, borderColor: color, backgroundColor: color, tension: thresholds ? 0 : 0.3, pointRadius: thresholds ? 3 : 2 };
      }
      return { ...base, backgroundColor: color, borderColor: color };
    });
    if (thresholds) {
      const flat = (v: number) => labels.map(() => v);
      const amber = palette.colors[2] ?? palette.primary;
      const red = palette.attention ?? palette.primary;
      datasets.push(
        { label: `>${thresholds.attention}% - Attention`, data: flat(thresholds.attention), borderColor: amber, backgroundColor: amber, borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, tension: 0, threshold: true } as never,
        { label: `>${thresholds.unacceptable}% - Unacceptable`, data: flat(thresholds.unacceptable), borderColor: red, backgroundColor: red, borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, tension: 0, threshold: true } as never,
      );
    }
    return { labels, datasets };
  }, [widget, palette, circular, start, end]);

  const thresholds = widget.chart_type === "line" ? thresholdsFor(widget.title) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? "y" : "x",
      // Room for the totals above the tallest stack / the labels outside the ring.
      layout: {
        padding: circular
          ? { top: 18, bottom: 18, left: 24, right: 24 }
          : horizontal
            ? { right: 48, top: 8 }
            : { top: widget.chart_type === "bar" && !(stackedX || stackedY) && widget.datasets.length > 2 ? 34 : 16 },
      },
      plugins: {
        legend: { display: true, labels: { color: palette.text, boxWidth: 12, font: { size: 10, family: palette.font } } },
        tooltip: { enabled: true },
        datalabels: valueLabels(widget.chart_type, stackedX || stackedY, percentAxis, circular, palette, widget.datasets.length, widget.labels.length, horizontal),
        stackTotals:
          widget.chart_type === "bar" && (stackedX || stackedY)
            ? { color: palette.fg, font: palette.font ?? "sans-serif", percent: percentAxis }
            : undefined,
      },
      scales: circular
        ? undefined
        : (() => {
            // The category axis is x for vertical charts and y for horizontal ones
            // ("indexAxis y", e.g. the forecast's per-sub-contractor bar); the value
            // axis is the other one.
            const category = {
              stacked: stackedX,
              ticks: {
                color: palette.text,
                font: { size: 10, family: palette.font },
                callback(this: { getLabelForValue(v: number): string }, value: number | string) {
                  return axisLabel(typeof value === "number" ? this.getLabelForValue(value) : value);
                },
              },
              grid: { color: palette.grid },
            };
            const value = {
              stacked: stackedY,
              beginAtZero: true,
              // headroom so stack totals / line-point labels never sit on the legend;
              // a thresholded rate is framed by its upper limit instead
              grace: thresholds ? 0 : "12%",
              suggestedMax: thresholds ? thresholds.unacceptable * 1.2 : undefined,
              ticks: {
                color: palette.text,
                font: { size: 10, family: palette.font },
                callback: percentAxis
                  ? (v: number | string) => `${v}%`
                  : (v: number | string) => (typeof v === "number" ? v.toLocaleString("en-US") : v),
              },
              grid: { color: palette.grid },
            };
            return horizontal ? { x: value, y: category } : { x: category, y: value };
          })(),
    }),
    [palette, stackedX, stackedY, percentAxis, horizontal, circular, widget.chart_type, widget.datasets.length, widget.labels.length, thresholds],
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

  let chart: React.ReactNode;
  switch (widget.chart_type) {
    case "line":
      chart = <Chart key={version} type="line" data={data} options={options} />;
      break;
    case "doughnut":
      chart = <Chart key={version} type="doughnut" data={data} options={options} />;
      break;
    case "pie":
      chart = <Chart key={version} type="pie" data={data} options={options} />;
      break;
    case "bar":
    default:
      chart = <Chart key={version} type="bar" data={data} options={options} plugins={[stackTotalsPlugin]} />;
  }
  if (!windowed) return chart;

  const first = axisLabel(widget.labels[start]);
  const last = axisLabel(widget.labels[end - 1]);
  return (
    <div className="chart-window">
      <div className="chart-window-canvas">{chart}</div>
      <div className="chart-window-bar">
        <span className="chart-window-range num">
          {first} – {last}
        </span>
        <input
          type="range"
          className="chart-window-slider"
          min={0}
          max={maxStart}
          step={1}
          value={start}
          aria-label={`Visible range: ${VISIBLE_CATEGORIES} of ${widget.labels.length} ${first} to ${last}`}
          aria-valuetext={`${first} – ${last}`}
          onChange={(e) => setWindowStart(Number(e.target.value))}
        />
        <span className="chart-window-count num">
          {VISIBLE_CATEGORIES} / {widget.labels.length}
        </span>
      </div>
    </div>
  );
}
