"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  // titles reach here relabelled ("Rejection" reads "Rej.", lib/labels.ts)
  { match: /RT Rej(ection|\.) Rate by Film/i, attention: 1, unacceptable: 3 },
  { match: /UT(\/PAUT)? Rej(ection|\.) Rate by Length/i, attention: 1, unacceptable: 1.5 },
];

function thresholdsFor(title: string) {
  return RATE_THRESHOLDS.find((t) => t.match.test(title)) ?? null;
}

/** How many categories a long axis shows at once; the scrollbar scrolls the rest. */
const VISIBLE_CATEGORIES = 24;

/**
 * The pbix-style scrollbar under a windowed chart: a track whose thumb is as wide as
 * the visible share of the axis, dragged left/right with the pointer (owner request
 * 2026-09-08), moved one step with ← → and a page with PageUp/PageDown, or jumped by
 * clicking the track. `start` is the index of the first visible category.
 */
function WindowScrollbar({
  total,
  visible,
  start,
  label,
  onChange,
}: {
  total: number;
  visible: number;
  start: number;
  label: string;
  onChange: (start: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerX: number; startAt: number } | null>(null);
  const maxStart = Math.max(0, total - visible);
  const clamp = (n: number) => Math.min(maxStart, Math.max(0, Math.round(n)));
  const thumbPct = (visible / total) * 100;
  const leftPct = (start / total) * 100;

  function categoriesPerPixel(): number {
    const width = track.current?.clientWidth ?? 0;
    return width > 0 ? total / width : 0;
  }

  return (
    <div
      ref={track}
      className="chart-scrollbar"
      onPointerDown={(e) => {
        // click on the track (not the thumb) centres the window there
        if (e.target !== track.current) return;
        const rect = track.current!.getBoundingClientRect();
        const at = ((e.clientX - rect.left) / rect.width) * total - visible / 2;
        onChange(clamp(at));
      }}
    >
      <div
        className="chart-scrollbar-thumb"
        role="scrollbar"
        tabIndex={0}
        aria-controls={undefined}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={maxStart}
        aria-valuenow={start}
        aria-valuetext={label}
        aria-label="Visible range"
        // the thumb never runs past the track end (its 24px minimum width used to cover the count)
        style={{
          width: `${thumbPct}%`,
          insetInlineStart:
            total > visible ? `calc((100% - max(${thumbPct}%, 24px)) * ${start / (total - visible)})` : `${leftPct}%`,
        }}
        onPointerDown={(e) => {
          drag.current = { pointerX: e.clientX, startAt: start };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.stopPropagation();
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const delta = (e.clientX - drag.current.pointerX) * categoriesPerPixel();
          onChange(clamp(drag.current.startAt + delta));
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(e) => {
          const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -visible, PageDown: visible, Home: -total, End: total }[e.key];
          if (step === undefined) return;
          e.preventDefault();
          onChange(clamp(start + step));
        }}
      />
    </div>
  );
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** A trailing " 2026" on a month label ("May 2026") — see "year-axis-title". */
const YEAR_SUFFIX = /\s+(\d{4})$/;

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
/**
 * Inline plugin: writes the dataset total in the middle of a doughnut when the
 * widget's options_notes carry "center-total" (the pbix flange doughnuts show
 * 197980 / 148091 in the hole).
 */
/**
 * Room between a doughnut's legend and its ring, so the value labels above the
 * ring never run into the legend (owner, 2026-10-19).
 */
const legendGapPlugin = {
  id: "legendGap",
  beforeInit(chart: ChartJS) {
    const legend = chart.legend as unknown as { fit: () => void; height: number } | undefined;
    if (!legend) return;
    const fit = legend.fit;
    legend.fit = function (this: { height: number }) {
      fit.call(this);
      this.height += 14;
    };
  },
};

/**
 * The same room under the legend for bar charts, sized by `plugins.barLegendGap.px`:
 * the upright value labels over tall grouped bars (Welding Status) reach above the
 * plot, so the legend moves up out of their way (owner, 2026-10-19).
 */
const barLegendGapPlugin = {
  id: "barLegendGap",
  beforeInit(chart: ChartJS) {
    const legend = chart.legend as unknown as { fit: () => void; height: number } | undefined;
    if (!legend) return;
    const fit = legend.fit;
    legend.fit = function (this: { height: number }) {
      fit.call(this);
      const px = ((chart.options.plugins as Record<string, unknown> | undefined)?.barLegendGap as { px?: number } | undefined)?.px ?? 0;
      this.height += px;
    };
  },
};

const centerTotalPlugin = {
  id: "centerTotal",
  afterDraw(chart: ChartJS) {
    const opts = (chart.options.plugins as Record<string, unknown> | undefined)?.centerTotal as
      | { color: string; font: string }
      | undefined;
    if (!opts) return;
    const ds = chart.data.datasets[0];
    if (!ds) return;
    const total = (ds.data as unknown[]).reduce<number>((a, v) => a + (typeof v === "number" ? v : 0), 0);
    const meta = chart.getDatasetMeta(0);
    const arc = meta.data[0] as unknown as { x: number; y: number } | undefined;
    if (!arc) return;
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = opts.color;
    ctx.font = `700 16px ${opts.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(total.toLocaleString("en-US"), arc.x, arc.y);
    ctx.restore();
  },
};

const stackTotalsPlugin = {
  id: "stackTotals",
  afterDatasetsDraw(chart: ChartJS) {
    const meta0 = chart.getDatasetMeta(0);
    if (!meta0 || (chart.config as { type?: string }).type !== "bar") return;
    const opts = (chart.options.plugins as Record<string, unknown> | undefined)?.stackTotals as
      | { color: string; font: string; percent: boolean; size?: number }
      | undefined;
    if (!opts) return;
    const { ctx } = chart;
    const count = chart.data.labels?.length ?? 0;
    ctx.save();
    ctx.fillStyle = opts.color;
    ctx.font = `600 ${opts.size ?? 12}px ${opts.font}`;
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

export type Palette = {
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
  /** MT+PT series: red, as in the pbix Welding Status charts (`--color-danger`). */
  seriesMtPt: string | null;
  /**
   * Text size factor: the page zoom (components/ZoomControl.tsx) shrinks the
   * charts with the page, so their labels grow back by up to a third to stay
   * readable at 75 % (owner, 2026-10-19). 1 at 100 %.
   */
  scale: number;
};

const FALLBACK_PALETTE: Palette = {
  colors: ["#ED7D31", "#70AD47", "#FFD966", "#F4B183", "#A9D18E"], // token-lint: allow-hex — legacy mood fallback
  primary: "#ED7D31", // token-lint: allow-hex — legacy mood fallback
  grid: "rgba(255,255,255,0.08)", // token-lint: allow-hex — legacy mood fallback
  text: "#cccccc", // token-lint: allow-hex — legacy mood fallback
  attention: null,
  seriesMtPt: null,
  font: undefined,
  fg: "#cccccc", // token-lint: allow-hex — legacy mood fallback
  seriesF: null,
  seriesS: null,
  scale: 1,
};

/**
 * A colour token as the canvas can draw it, or null. The token is resolved
 * through the browser (a probe element's computed `color`, always rgb/rgba)
 * and then checked on a canvas: a colour syntax the browser cannot draw —
 * a colleague's browser on 2026-10-15 drew every flange chart black — falls
 * back instead of turning black.
 */
function canvasColor(raw: string, probe: HTMLElement | null, ctx: CanvasRenderingContext2D | null): string | null {
  const v = raw.trim();
  if (!v) return null;
  let resolved = v;
  if (probe) {
    probe.style.color = "";
    probe.style.color = v;
    if (probe.style.color) resolved = getComputedStyle(probe).color || v;
  }
  if (!ctx) return resolved;
  const sentinel = "#010203"; // token-lint: allow-hex — a marker no token uses
  ctx.fillStyle = sentinel;
  ctx.fillStyle = resolved;
  const drawn = String(ctx.fillStyle);
  return drawn === sentinel && resolved.toLowerCase() !== sentinel ? null : drawn;
}

/**
 * An override keeps only what can be drawn: an empty string, an empty colour
 * list or a colour the browser cannot parse would otherwise replace a good
 * default and paint the chart black (a page that read its tokens too early).
 */
function usableOverride(o: Partial<Palette> | undefined): Partial<Palette> {
  if (!o || typeof window === "undefined") return {};
  const ctx = document.createElement("canvas").getContext("2d");
  const ok = (c: unknown): c is string => typeof c === "string" && canvasColor(c, null, ctx) !== null;
  const out: Partial<Palette> = {};
  for (const [k, v] of Object.entries(o) as [keyof Palette, unknown][]) {
    if (k === "colors") {
      const colors = Array.isArray(v) ? v.filter(ok) : [];
      if (colors.length) out.colors = colors;
    } else if (k === "font") {
      if (typeof v === "string" && v.trim()) out.font = v;
    } else if (ok(v)) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

function readPalette(): Palette {
  if (typeof window === "undefined") return FALLBACK_PALETTE;
  const styles = getComputedStyle(document.documentElement);
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const ctx = document.createElement("canvas").getContext("2d");
  const read = (name: string) => canvasColor(styles.getPropertyValue(name), probe, ctx);
  try {
    const colors = PALETTE_VARS.map(read).filter((c): c is string => c !== null);
    return {
      colors: colors.length > 0 ? colors : FALLBACK_PALETTE.colors,
      primary: read("--accent-primary") ?? FALLBACK_PALETTE.primary,
      grid: read("--chart-grid") ?? FALLBACK_PALETTE.grid,
      text: read("--text-secondary") ?? FALLBACK_PALETTE.text,
      attention: read("--chart-attention"),
      font: styles.getPropertyValue("--font-mono").trim() || undefined,
      fg: read("--fg") ?? read("--text-primary") ?? FALLBACK_PALETTE.fg,
      seriesF: read("--series-f"),
      seriesS: read("--series-s"),
      seriesMtPt: read("--color-danger"),
      scale: 1,
    };
  } finally {
    probe.remove();
  }
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
// Owner, 2026-10-18: MT+PT is red on every Welding Status chart, as in the pbix.
const MT_PT_SERIES = /^MT ?\+ ?PT( Qty)?$/i;

/** `color` at `alpha`, whatever CSS colour syntax the token uses (the canvas normalises it). */
function withAlpha(color: string, alpha: number): string {
  if (typeof document === "undefined") return color;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return color;
  ctx.fillStyle = color;
  const norm = String(ctx.fillStyle);
  const hex = /^#([0-9a-f]{6})$/i.exec(norm);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return norm.replace(/rgba?\(([^)]+?)(,\s*[\d.]+)?\)/, (_m, rgb: string) => `rgba(${rgb.split(",").slice(0, 3).join(",")}, ${alpha})`);
}

/**
 * The B.Log bars in the pbix's own colours (owner, 2026-10-19): RT/UT+PWHT dark
 * blue under RT/UT Only light blue; PWHT Only sand yellow, PWHT+RT/UT brown.
 */
const FIXED_SERIES: Record<string, string> = {
  "RT/UT+PWHT": "#2E62B8",
  "RT/UT Only": "#6E9FDB",
  "PWHT Only": "#E2D375",
  "PWHT+RT/UT": "#9A6614",
  "PWHT+RT": "#9A6614",
};

/**
 * The Weld Type doughnuts in the pbix's own colours, read off the pbix visuals'
 * dataPoint fills (owner, 2026-10-19). The project doughnut and the party ones
 * ("Weld Type-CCC", "-GAC", …) carry two different sets: FW is grey on the
 * first, red on the others.
 */
const WELD_TYPE_COLORS_PROJECT: Record<string, string> = {
  BW: "#0E4E9C", WPAD: "#6D6E71", LET: "#EC2326", SOF: "#2F899B", FW: "#939598", SOB: "#3599B8", "FW.": "#DFBFBF",
  TRN: "#4AC5BB", RPD: "#169FDA", L4: "#5F6B6D", SW: "#D1D3D4", MW: "#FB8281", LUG: "#7F898A", CLET: "#FDAB89",
  RPDF: "#A4DDEE", SP: "#000000", DMY: "#B687AC", RPD0: "#118DFF", SOB0: "#12239E", SOBUA: "#E66C37",
};
const WELD_TYPE_COLORS_PARTY: Record<string, string> = {
  BW: "#0E4E9C", WPAD: "#EC2326", LET: "#6D6E71", SOF: "#2F899B", FW: "#EC2326", SOB: "#D1D3D4", "FW.": "#000000",
  TRN: "#169FDA", RPD: "#939598", L4: "#DFBFBF", SW: "#3599B8", MW: "#5F6B6D", LUG: "#FB8281", CLET: "#2F899B",
  RPDF: "#7F898A", SP: "#169FDA", SOBUA: "#F4FF57",
};
/** The colour set of a Weld Type doughnut by its title: "Weld Type-<party>" or the project one. */
const weldTypeColors = (title: string) =>
  /weld type\s*[-–]/i.test(title) || /weld type\s+(ccc|gac|tekfen|medgulf)/i.test(title) ? WELD_TYPE_COLORS_PARTY : WELD_TYPE_COLORS_PROJECT;

function seriesColor(label: string, index: number, palette: Palette): string {
  const fixed = FIXED_SERIES[label.trim()];
  if (fixed) return fixed;
  if (palette.seriesMtPt && MT_PT_SERIES.test(label)) return palette.seriesMtPt;
  if (palette.attention && ATTENTION_SERIES.test(label)) return palette.attention;
  if (palette.seriesF && F_SERIES.test(label)) return palette.seriesF;
  if (palette.seriesS && S_SERIES.test(label)) return palette.seriesS;
  return palette.colors[index % palette.colors.length] ?? palette.primary;
}

type DatalabelCtx = { dataset: { data: unknown[] }; dataIndex: number; chart: ChartJS };

type AreaCtx = DatalabelCtx & { datasetIndex: number };

/**
 * Stacked-area labels (the pbix "Status Report" trends): the stack total above
 * the top line and the first series (ok) under its own line — nothing for the
 * thin middle series, whose labels would sit on top of each other (owner,
 * 2026-10-14). The tooltip still gives every series.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function areaLabels(palette: Palette): any {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const at = (ctx: AreaCtx) => ctx.chart.data.datasets.map((d) => num(d.data[ctx.dataIndex]));
  const topIndex = (ctx: AreaCtx) => {
    const vals = at(ctx);
    for (let i = vals.length - 1; i >= 0; i -= 1) if (vals[i] !== null && vals[i] !== 0) return i;
    return 0;
  };
  const total = (ctx: AreaCtx) => at(ctx).reduce<number>((a, b) => a + (b ?? 0), 0);
  return {
    display: (ctx: AreaCtx) => {
      if (num(ctx.dataset.data[ctx.dataIndex]) === null) return false;
      const top = topIndex(ctx);
      if (ctx.datasetIndex === top) return true;
      // the ok line gets its own label only when something is stacked above it
      return ctx.datasetIndex === 0 && total(ctx) !== num(ctx.dataset.data[ctx.dataIndex]);
    },
    formatter: (v: unknown, ctx: AreaCtx) => fmtValue(ctx.datasetIndex === topIndex(ctx) ? total(ctx) : v, false),
    align: (ctx: AreaCtx) => (ctx.datasetIndex === topIndex(ctx) ? "top" : "bottom"),
    anchor: (ctx: AreaCtx) => (ctx.datasetIndex === topIndex(ctx) ? "end" : "start"),
    offset: 4,
    clamp: true,
    color: palette.fg,
    font: { size: Math.round(12 * palette.scale), family: palette.font, weight: 600 },
  };
}

/** Per-type chartjs-plugin-datalabels config; `display: false` is the registered default. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function valueLabels(type: string, stacked: boolean, percent: boolean, circular: boolean, palette: Palette, seriesCount: number, categoryCount: number, horizontal = false, namePct = false, pctDigits = 1): any {
  // value labels a size up (owner, 2026-10-19: 10 px hard to read)
  const font = { size: Math.round(12 * palette.scale), family: palette.font, weight: 600 };
  if (circular) {
    // Slice values outside the ring; slivers under 2 % of the total stay unlabelled
    // (the legend and tooltip still carry them) so labels never pile up. With
    // "label-name-pct" in options_notes the label reads "Torquing 57,483 (29.03%)",
    // the pbix flange doughnut's own format.
    return {
      display: (ctx: DatalabelCtx) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        const total = ctx.dataset.data.reduce<number>((a, b) => a + (typeof b === "number" ? b : 0), 0);
        // "auto": a label that would collide with another is not drawn (tooltip keeps it)
        return typeof v === "number" && total > 0 && v / total >= 0.02 ? "auto" : false;
      },
      formatter: (v: unknown, ctx: DatalabelCtx) => {
        const total = ctx.dataset.data.reduce<number>((a, b) => a + (typeof b === "number" ? b : 0), 0);
        const share = typeof v === "number" && total > 0 ? `${((v / total) * 100).toFixed(pctDigits)}%` : "";
        if (!namePct) {
          // every doughnut shows the slice's share too (owner, 2026-10-19): value, then % under it
          return share ? [fmtValue(v, false), share] : fmtValue(v, false);
        }
        const name = (ctx.chart.data.labels?.[ctx.dataIndex] as string | undefined) ?? "";
        return `${name} ${fmtValue(v, false)}${share ? ` (${share})` : ""}`;
      },
      textAlign: "center",
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
      // doughnut values a size up (owner, 2026-10-19: hard to read at 10)
      font: { ...font, size: Math.round(13 * palette.scale) },
    };
  }
  if (type === "line") {
    return {
      display: (ctx: DatalabelCtx) => {
        const ds = ctx.dataset as { threshold?: boolean; data: unknown[] };
        // the limit's name sits above the dashed line near its right end (second-to-last
        // point, so the text is never clipped by the chart edge)
        if (!ds.threshold) return true;
        // "Attention" near the left end, "Unacceptable" near the right: apart (owner, 2026-10-19)
        const attention = /attention/i.test((ds as { label?: string }).label ?? "");
        return ctx.dataIndex === (attention ? Math.min(1, ds.data.length - 1) : Math.max(0, ds.data.length - 2));
      },
      formatter: (v: unknown, ctx: DatalabelCtx) => {
        const ds = ctx.dataset as { threshold?: boolean; label?: string };
        return ds.threshold ? ds.label ?? "" : fmtValue(v, percent);
      },
      color: (ctx: DatalabelCtx) => {
        const ds = ctx.dataset as { threshold?: boolean; borderColor?: string };
        return ds.threshold ? ds.borderColor ?? palette.fg : palette.fg;
      },
      // a limit's name sits UNDER its dashed line, so the two names and the
      // point values above the line near 0 % never touch (owner, 2026-10-19)
      align: (ctx: DatalabelCtx) => {
        const ds = ctx.dataset as { threshold?: boolean; label?: string };
        if (!ds.threshold) return "top";
        return /attention/i.test(ds.label ?? "") ? "top" : "bottom";
      },
      anchor: "end",
      offset: 3,
      clamp: true,
      // a limit's name keeps its size: the rate lines are short, a larger name would cross the other line
      font: (ctx: DatalabelCtx) => ((ctx.dataset as { threshold?: boolean }).threshold ? { ...font, size: 11 } : font),
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
        // thin bars sit closer than a line of text: "auto" drops a label that would
        // overlap its neighbour (owner, 2026-10-15) — the tooltip still has it
        return typeof v === "number" && v !== 0 ? "auto" : false;
      },
      formatter: (v: unknown) => fmtValue(v, percent),
      color: palette.fg,
      anchor: "end",
      align: "end",
      offset: 2,
      clamp: true,
      font,
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
    font,
  };
}

/** Round an axis end up to 1, 2, 2.5 or 5 x 10^n (0.46 -> 0.5), so the top tick is a round one. */
function niceCeil(x: number): number {
  const mag = 10 ** Math.floor(Math.log10(x));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * mag >= x - 1e-12) ?? 10;
  return Number((step * mag).toPrecision(3));
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
export function ChartCard({ widget, paletteOverride }: { widget: ChartWidget; paletteOverride?: Partial<Palette> }) {
  const [version, setVersion] = useState(0);

  // Long category axes (the forecast's 32-month series) show a WINDOW of the last
  // VISIBLE_CATEGORIES points with a slider underneath to scroll back — the pbix
  // chart's own scrollbar (owner request 2026-09-08: "ползунок внизу графика,
  // чтоб отображалось 24 месяца"). Circular charts never window.
  // "window N" in options_notes narrows the visible span (the flange monthly chart
  // shows its last five months, as the pbix does; owner request 2026-09-08).
  const visible = Number(/\bwindow (\d+)\b/.exec(widget.options_notes ?? "")?.[1]) || VISIBLE_CATEGORIES;
  const windowed = !isCircular(widget.chart_type) && widget.labels.length > visible;
  const maxStart = Math.max(0, widget.labels.length - visible);
  const [windowStart, setWindowStart] = useState(maxStart);
  const start = windowed ? Math.min(windowStart, maxStart) : 0;
  const end = windowed ? start + visible : widget.labels.length;

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

  const zoom = usePageZoom();
  const palette = useMemo(
    () => ({ ...readPalette(), ...usableOverride(paletteOverride), scale: Math.min(1.35, Math.max(1, 1 / zoom)) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the re-read trigger, not an input
    [version, paletteOverride, zoom],
  );

  const notes = widget.options_notes ?? "";
  const stackedX = notes.includes("stacked (x)");
  const stackedY = notes.includes("stacked (y)");
  const percentAxis = notes.includes("percent-axis");
  // "y-center" (owner, 2026-10-15, the leak-rate line): the value axis runs to
  // twice the highest visible point, so a near-flat line sits mid-height and its
  // labels clear the axis ticks; the points stand off the plot edges.
  const yCenter = notes.includes("y-center");
  const visibleMax = yCenter
    ? Math.max(0, ...widget.datasets.flatMap((d) => d.data.slice(start, end).map((v) => toNum(v) ?? 0)))
    : 0;
  const horizontal = notes.toLowerCase().includes("indexaxis") && notes.toLowerCase().includes("y");
  const circular = isCircular(widget.chart_type);
  // "year-axis-title" (flange Monthly Inspection, 2026-10-14): labels are
  // "May 2026"; the ticks show the month only and the year goes ONCE under the
  // axis, as the pbix Year ▸ Month hierarchy draws it ("2025 – 2026" if the
  // visible window spans two years).
  const yearAxis = notes.includes("year-axis-title");
  const visibleYears = yearAxis
    ? [...new Set(widget.labels.slice(start, end).map((l) => YEAR_SUFFIX.exec(l)?.[1]).filter(Boolean))]
    : [];
  const yearTitle = visibleYears.length > 1 ? `${visibleYears[0]} – ${visibleYears.at(-1)}` : (visibleYears[0] ?? "");

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
            backgroundColor: widget.labels.map((l, i) =>
              (/weld type/i.test(widget.title) ? weldTypeColors(widget.title)[String(l).trim()] : undefined) ?? palette.colors[i % palette.colors.length],
            ),
            borderColor: "transparent",
          },
        ],
      };
    }
    const thresholds = widget.chart_type === "line" ? thresholdsFor(widget.title) : null;
    const area = (widget.options_notes ?? "").includes("area");
    const datasets = widget.datasets.map((ds, i) => {
      // With threshold lines the rate itself is the neutral series (pbix: blue) and
      // the red is reserved for the "Unacceptable" limit.
      const color = thresholds ? palette.colors[0] ?? palette.primary : seriesColor(ds.label, i, palette);
      const base = { label: ds.label, data: slice(ds.data).map(toNum), stack: ds.stack };
      if (widget.chart_type === "line") {
        // "area" (Welder Performance trends, the pbix stacked-area visual): each series
        // fills down to the one below it, translucent so the stack stays readable
        if (area) {
          return { ...base, borderColor: color, backgroundColor: withAlpha(color, 0.3), fill: i === 0 ? "origin" : "-1", tension: 0.25, pointRadius: 3 };
        }
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

  // Doughnuts start turned so their smallest labelled slice points right, where its
  // outside label has the most room; a drag turns the ring by hand, a double click
  // puts it back (owner, 2026-10-15: "возможность ротации … изначально максимально
  // удобно для восприятия").
  const startRotation = useMemo(() => {
    if (!circular) return 0;
    const vals = (widget.datasets[0]?.data ?? []).map((v) => Math.max(0, toNum(v) ?? 0));
    const total = vals.reduce((a, b) => a + b, 0);
    if (total <= 0) return 0;
    if (notes.includes("label-name-pct")) {
      // long "Name value (share)" labels: the largest slice points down, so the
      // labels sit above and below the ring, where they are not cut at the sides
      const big = vals.indexOf(Math.max(...vals));
      const before = vals.slice(0, big).reduce((a, b) => a + b, 0);
      return 180 - ((before + vals[big]! / 2) / total) * 360;
    }
    let best = -1;
    vals.forEach((v, i) => {
      const share = v / total;
      if (share >= 0.02 && share < 0.12 && (best < 0 || v < vals[best]!)) best = i;
    });
    if (best < 0) return 0;
    const before = vals.slice(0, best).reduce((a, b) => a + b, 0);
    const mid = ((before + vals[best]! / 2) / total) * 360;
    return 90 - mid;
  }, [circular, notes, widget.datasets]);
  // A ring turned by hand keeps its angle across reloads (owner, 2026-10-19),
  // per chart, in this browser; a double click forgets it.
  const rotKey = `ring-rotation:${widget.canvas_id}|${widget.title}`;
  const [savedRotation, setSavedRotation] = useState<number | null>(null);
  useEffect(() => {
    if (!circular) return;
    const t = setTimeout(() => {
      try {
        const v = window.localStorage.getItem(rotKey);
        const n = v === null ? NaN : Number(v);
        setSavedRotation(Number.isFinite(n) ? n : null);
      } catch {
        /* storage blocked: the default angle */
      }
    });
    return () => clearTimeout(t);
  }, [circular, rotKey]);
  const rotation = savedRotation ?? startRotation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  const spin = useRef<{ angle: number; rotation: number } | null>(null);
  const pointerAngle = (e: React.PointerEvent) => {
    const c = chartRef.current;
    const arc = c?.getDatasetMeta(0)?.data?.[0];
    if (!c || !arc) return null;
    const r = c.canvas.getBoundingClientRect();
    return (Math.atan2(e.clientY - r.top - arc.y, e.clientX - r.left - arc.x) * 180) / Math.PI;
  };
  const spinHandlers = circular
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          const a = pointerAngle(e);
          if (a === null) return;
          spin.current = { angle: a, rotation: chartRef.current.options.rotation ?? 0 };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (!spin.current) return;
          const a = pointerAngle(e);
          if (a === null) return;
          chartRef.current.options.rotation = spin.current.rotation + (a - spin.current.angle);
          chartRef.current.update("none");
        },
        onPointerUp: () => {
          if (spin.current && chartRef.current) {
            const r = Number(chartRef.current.options.rotation ?? 0) % 360;
            try {
              window.localStorage.setItem(rotKey, String(r));
            } catch {
              /* not kept */
            }
            setSavedRotation(r);
          }
          spin.current = null;
        },
        onDoubleClick: () => {
          if (!chartRef.current) return;
          chartRef.current.options.rotation = startRotation;
          chartRef.current.update();
          try {
            window.localStorage.removeItem(rotKey);
          } catch {
            /* nothing kept */
          }
          setSavedRotation(null);
        },
      }
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = useMemo(
    () => ({
      responsive: true,
      ...(circular ? { rotation } : {}),
      // a doughnut with its total in the hole gets a wider hole, so the number fits (owner, 2026-10-19)
      ...(circular && notes.includes("center-total") ? { cutout: "64%" } : {}),
      maintainAspectRatio: false,
      // drawn at no less than 2x the CSS size: canvas text stays crisp at any
      // browser zoom or display scaling (owner, 2026-10-15: "числа слегка размыты")
      devicePixelRatio: typeof window === "undefined" ? 2 : Math.max(2, Math.ceil(window.devicePixelRatio || 1)),
      // a smaller ring leaves the outside labels room inside the chart, so they
      // reach neither the card title nor the legend below (owner, 2026-10-15)
      ...(circular && notes.includes("legend-bottom") ? { radius: "72%" } : {}),
      // a ring with "name value (pct)" labels outside leaves them room on both sides
      ...(circular && notes.includes("label-name-pct") ? { radius: "78%" } : {}),
      indexAxis: horizontal ? "y" : "x",
      // Room for the totals above the tallest stack / the labels outside the ring.
      layout: {
        // the room for labels grows with them (palette.scale, the page zoom)
        padding: scalePad(palette.scale, circular
          ? notes.includes("legend-bottom")
            ? { top: 32, bottom: 4, left: 30, right: 30 } // value + % on two lines
            : notes.includes("label-name-pct")
              ? { top: 18, bottom: 18, left: 24, right: 24 } // "Torquing 60,030 (28.81%)" is not cut at the edge
              : notes.includes("legend-none")
                ? { top: 30, bottom: 30, left: 26, right: 26 } // the page's legend is above the canvas
                : { top: 32, bottom: 32, left: 26, right: 26 } // value + % on two lines
          : horizontal
            ? { right: 48, top: 8 }
            : notes.includes("area")
              ? { top: 16, right: 18 } // the last point's total is not clipped by the edge
              : yCenter
                ? { top: 12, left: 8, right: 22 }
              : { top: widget.chart_type === "bar" && !(stackedX || stackedY) && widget.datasets.length > 2 ? 34 : 16 }),
      },
      plugins: {
        // pbix-style named slice labels already name every slice, so the legend goes
                // "legend-none": the page draws its own legend (Rej. summary doughnuts)
        legend: { display: !(circular && notes.includes("label-name-pct")) && !notes.includes("legend-none"), position: notes.includes("legend-bottom") ? "bottom" : widget.canvas_id === "chart1_weldtype" ? "right" : "top",
          labels: { padding: notes.includes("legend-bottom") ? 18 : 10, color: palette.text, boxWidth: 12, font: { size: Math.round(10 * palette.scale), family: palette.font },
          // a doughnut with many slices (page 1 lists every weld type) keeps its
          // legend to the 7 largest so the chart keeps its size; the rest show on hover
          ...(circular ? { filter: (item: { index?: number }) => (item.index ?? 0) < 7 } : {}) } },
        tooltip: { enabled: true },
        datalabels: notes.includes("area") ? areaLabels(palette) : valueLabels(widget.chart_type, stackedX || stackedY, percentAxis, circular, palette, widget.datasets.length, end - start, horizontal, notes.includes("label-name-pct")),
        centerTotal: circular && notes.includes("center-total") ? { color: palette.fg, font: palette.font ?? "sans-serif" } : undefined,
        barLegendGap: {
          px: widget.chart_type === "bar" && !(stackedX || stackedY) && !horizontal && widget.datasets.length > 2 ? Math.round(26 * palette.scale) : 0,
        },
        stackTotals:
          widget.chart_type === "bar" && (stackedX || stackedY)
            ? { color: palette.fg, font: palette.font ?? "sans-serif", percent: percentAxis, size: Math.round(12 * palette.scale) }
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
              // only the y-center line sets it: an explicit undefined reads as
              // `offset: false` and cut the first and last bars in half
              // the points stand off the plot edges, so the first value label clears the y ticks
              ...(yCenter || thresholds ? { offset: true } : {}),
              ticks: {
                color: palette.text,
                font: { size: Math.round(10 * palette.scale), family: palette.font },
                callback(this: { getLabelForValue(v: number): string }, value: number | string) {
                  const label = typeof value === "number" ? this.getLabelForValue(value) : value;
                  return yearAxis ? label.replace(YEAR_SUFFIX, "") : axisLabel(label);
                },
              },
              grid: { color: palette.grid },
              title: yearAxis && yearTitle
                ? { display: true, text: yearTitle, color: palette.text, font: { size: 11, family: palette.font } }
                : undefined,
            };
            const value = {
              stacked: stackedY,
              beginAtZero: true,
              // headroom so stack totals / line-point labels never sit on the legend;
              // a thresholded rate is framed by its upper limit instead
              grace: thresholds || yCenter
                ? 0
                : // upright labels over grouped bars need more headroom once they grow with the page zoom
                  palette.scale > 1 && widget.chart_type === "bar" && !(stackedX || stackedY) && widget.datasets.length > 2
                  ? "28%"
                  : "12%",
              // the axis tops out at the upper limit rounded up (RT 3 %, UT 2 %; owner,
              // 2026-10-19), higher only when a point is above it
              suggestedMax: thresholds ? Math.ceil(thresholds.unacceptable) : undefined,
              max: yCenter && visibleMax > 0 ? niceCeil(visibleMax * 2) : undefined,
              ticks: {
                color: palette.text,
                font: { size: Math.round(10 * palette.scale), family: palette.font },
                callback: percentAxis
                  ? (v: number | string) => `${v}%`
                  : (v: number | string) => (typeof v === "number" ? v.toLocaleString("en-US") : v),
              },
              grid: { color: palette.grid },
            };
            return horizontal ? { x: value, y: category } : { x: category, y: value };
          })(),
    }),
    [palette, stackedX, stackedY, percentAxis, horizontal, circular, widget.chart_type, widget.datasets.length, widget.canvas_id, start, end, thresholds, notes, yearAxis, yearTitle, yCenter, visibleMax, rotation],
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
      chart = (
        <div className="chart-spin" title="Drag to turn the ring · double-click to reset" {...spinHandlers}>
          <Chart ref={chartRef} key={version} type="doughnut" data={data} options={options} plugins={[centerTotalPlugin, legendGapPlugin]} />
        </div>
      );
      break;
    case "pie":
      chart = (
        <div className="chart-spin" title="Drag to turn the pie · double-click to reset" {...spinHandlers}>
          <Chart ref={chartRef} key={version} type="pie" data={data} options={options} plugins={[centerTotalPlugin, legendGapPlugin]} />
        </div>
      );
      break;
    case "bar":
    default:
      chart = <Chart key={version} type="bar" data={data} options={options} plugins={[stackTotalsPlugin, barLegendGapPlugin]} />;
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
        <WindowScrollbar
          total={widget.labels.length}
          visible={visible}
          start={start}
          label={`${first} – ${last}`}
          onChange={setWindowStart}
        />
        <span className="chart-window-count num">
          {visible} / {widget.labels.length}
        </span>
      </div>
    </div>
  );
}

/** The page zoom (0.3–2) the ZoomControl applies, kept in <html data-zoom>. */
function usePageZoom(): number {
  const [z, setZ] = useState(1);
  useEffect(() => {
    const read = () => {
      const v = Number(document.documentElement.dataset.zoom ?? "1");
      setZ(Number.isFinite(v) && v > 0 ? v : 1);
    };
    const t = setTimeout(read, 0);
    window.addEventListener("page-zoom", read);
    return () => {
      clearTimeout(t);
      window.removeEventListener("page-zoom", read);
    };
  }, []);
  return z;
}

/** Chart padding scaled with the label size factor (1 at 100 % page zoom). */
function scalePad(k: number, p: Partial<Record<"top" | "bottom" | "left" | "right", number>>) {
  if (k === 1) return p;
  const out: Partial<Record<"top" | "bottom" | "left" | "right", number>> = {};
  for (const [side, v] of Object.entries(p) as ["top" | "bottom" | "left" | "right", number][]) out[side] = Math.round(v * k);
  return out;
}
