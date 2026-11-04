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

/**
 * The limit names (">1% - Attention", ">3% - Unacceptable") on the rate lines,
 * placed where they touch nothing (owner, 2026-10-20: a name crossed "0.99%").
 * Candidates: between two points, then on a point, above the dashed line, then
 * under it. A candidate is taken only when it stays inside the plot and clear of
 * every point's value label, of the rate line itself and of the other name.
 */
type Rect = { l: number; t: number; r: number; b: number };
const hit = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
function segHitsRect(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  for (let k = 0; k <= 24; k++) {
    const x = x1 + ((x2 - x1) * k) / 24;
    const y = y1 + ((y2 - y1) * k) / 24;
    if (x >= r.l && x <= r.r && y >= r.t && y <= r.b) return true;
  }
  return false;
}
const thresholdLabelPlugin = {
  id: "thresholdLabels",
  afterDatasetsDraw(chart: ChartJS) {
    const opts = (chart.options.plugins as Record<string, unknown> | undefined)?.thresholdLabels as
      // no functions here: Chart.js would call them as scriptable options
      | { family: string; size: number; dataSize: number; percent: boolean }
      | undefined;
    if (!opts) return;
    const { ctx, chartArea: area } = chart;
    const sets = chart.data.datasets as unknown as { threshold?: boolean; label?: string; borderColor?: string; data: unknown[] }[];
    const blocked: Rect[] = [];
    const lines: { x: number; y: number }[][] = [];
    ctx.save();
    // the value labels of the rate lines (datalabels: anchor end, align top, offset 3, padding 4)
    ctx.font = `600 ${opts.dataSize}px ${opts.family}`;
    sets.forEach((ds, i) => {
      if (ds.threshold || !chart.isDatasetVisible(i)) return;
      const pts = chart.getDatasetMeta(i).data as unknown as { x: number; y: number }[];
      lines.push(pts.filter((p) => Number.isFinite(p.y)).map((p) => ({ x: p.x, y: p.y })));
      pts.forEach((p, j) => {
        const v = ds.data[j];
        if (typeof v !== "number" || !Number.isFinite(p.y)) return;
        const w = ctx.measureText(fmtValue(v, opts.percent)).width;
        const h = opts.dataSize * 1.2;
        // the label box (padding 4) plus 8 px of clear space on each side
        blocked.push({ l: p.x - w / 2 - 12, r: p.x + w / 2 + 12, t: p.y - 3 - 8 - h - 2, b: p.y + 4 });
      });
    });
    ctx.font = `600 ${opts.size}px ${opts.family}`;
    ctx.textBaseline = "top";
    sets.forEach((ds, i) => {
      if (!ds.threshold || !chart.isDatasetVisible(i)) return;
      const pts = chart.getDatasetMeta(i).data as unknown as { x: number; y: number }[];
      if (pts.length === 0) return;
      const text = ds.label ?? "";
      const w = ctx.measureText(text).width;
      const h = opts.size * 1.2;
      const y0 = pts[0]!.y;
      const xs: number[] = [];
      for (let j = 0; j + 1 < pts.length; j++) xs.push((pts[j]!.x + pts[j + 1]!.x) / 2);
      for (const p of pts) xs.push(p.x);
      // the Attention name from the left, the Unacceptable name from the right
      if (!/attention/i.test(text)) xs.reverse();
      const fits = (r: Rect) =>
        r.l >= area.left + 2 &&
        r.r <= area.right - 2 &&
        r.t >= area.top &&
        r.b <= area.bottom &&
        !blocked.some((b) => hit(r, b)) &&
        !lines.some((ln) => ln.some((p, k) => k > 0 && segHitsRect(ln[k - 1]!.x, ln[k - 1]!.y, p.x, p.y, r)));
      let best: Rect | null = null;
      for (const side of ["above", "below"] as const) {
        for (const x of xs) {
          const t = side === "above" ? y0 - 3 - h : y0 + 3;
          const r = { l: x - w / 2 - 2, r: x + w / 2 + 2, t: t - 1, b: t + h + 1 };
          if (fits(r)) {
            best = r;
            break;
          }
        }
        if (best) break;
      }
      if (!best) return; // nowhere clear: the legend already names the line
      ctx.fillStyle = ds.borderColor ?? "#888";
      ctx.textAlign = "center";
      ctx.fillText(text, (best.l + best.r) / 2, best.t + 1);
      blocked.push(best);
    });
    ctx.restore();
  },
};

const centerTotalPlugin = {
  id: "centerTotal",
  afterDraw(chart: ChartJS) {
    const opts = (chart.options.plugins as Record<string, unknown> | undefined)?.centerTotal as
      | { color: string; font: string; value?: number }
      | undefined;
    if (!opts) return;
    const ds = chart.data.datasets[0];
    if (!ds) return;
    // the widget's own centre figure ("centre = N" / "total = N" in options_notes)
    // when it has one — the pbix shows a measure there, not the slice sum
    const total =
      opts.value ?? (ds.data as unknown[]).reduce<number>((a, v) => a + (typeof v === "number" ? v : 0), 0);
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
  /** The hover card's background (the theme's raised surface). */
  tipBg: string;
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
  tipBg: "#0c2540", // token-lint: allow-hex — fallback hover card
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
      tipBg: read("--surface-2") ?? read("--bg-elevated") ?? FALLBACK_PALETTE.tipBg,
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
 * The Weld Type doughnuts in one T.EN tone on every page (owner, 2026-11-03, replacing the pbix's
 * red / black / grey of 2026-10-19): the largest types in T.EN blue, teal and gold, the smaller in
 * light blues, lime and slates; coral only for repairs (RPD*), the "look here" colour.
 */
const WELD_TYPE_COLORS: Record<string, string> = {
  SW: "#3D98B7", // token-lint: allow-hex — T.EN teal
  BW: "#0070EF", // token-lint: allow-hex — T.EN blue
  FW: "#E0B84E", // token-lint: allow-hex — gold
  THD: "#7FB8E8", // token-lint: allow-hex — light blue
  WPAD: "#A2C61C", // token-lint: allow-hex — T.EN lime
  LET: "#8A9BB0", // token-lint: allow-hex — slate
  SOF: "#1F5FBF", // token-lint: allow-hex — deep blue
  SP: "#5B6B80", // token-lint: allow-hex — dark slate
  SOB: "#6EC3D6", // token-lint: allow-hex — light teal
  "FW.": "#C9A03A", // token-lint: allow-hex — dark gold
  TRN: "#4FB3A0", // token-lint: allow-hex — sea green
  RPD: "#EE7766", // token-lint: allow-hex — T.EN coral: repairs
  RPDF: "#F2A094", // token-lint: allow-hex — light coral
  RPD0: "#E05A48", // token-lint: allow-hex — deep coral
  L4: "#B9C6D6", // token-lint: allow-hex — pale slate
  MW: "#9DB86A", // token-lint: allow-hex — olive
  LUG: "#C7D36F", // token-lint: allow-hex — pale lime
  CLET: "#F0CF6A", // token-lint: allow-hex — light gold
  DMY: "#6F7D8F", // token-lint: allow-hex — grey slate
  BON: "#2A86C9", // token-lint: allow-hex — mid blue
  GW: "#A9C4EC", // token-lint: allow-hex — pale blue
  SLW: "#5FA8D3", // token-lint: allow-hex — sky
  SOB0: "#12487E", // token-lint: allow-hex — navy
  SOBUA: "#D9B44A", // token-lint: allow-hex — ochre
};
/** The colour set of a Weld Type doughnut: one set for the project and every party. */
const weldTypeColors = (title: string) => {
  void title;
  return WELD_TYPE_COLORS;
};

/**
 * The RT B.Log Forecast page in one tone with the Welding Progress page (owner, 2026-11-03,
 * replacing the pbix's red / yellow / green of 2026-10-19 and 2026-10-27): the total gold, the RT %
 * parts in blues from deep to pale, then bronze and slate; Done blue against the gold backlog.
 */
const FC_PARTS = {
  "RT Total Forecast B.log": "#E0B84E", // token-lint: allow-hex — Welding Progress gold (--series-f)
  "RT 100%": "#2F6FD6", // token-lint: allow-hex — Welding Progress blue (--series-s)
  "RT 5%": "#6E9FDB", // token-lint: allow-hex — light blue (RT/UT Only)
  "RT 10%": "#A9C4EC", // token-lint: allow-hex — pale blue
  "RT 20%": "#9A6614", // token-lint: allow-hex — bronze (PWHT+RT/UT)
  "RT 30%": "#7C8FA6", // token-lint: allow-hex — slate
};
const FORECAST_COLORS: Record<string, Record<string, string>> = {
  forecast_bar: FC_PARTS,
  forecast_donut_backlog: FC_PARTS,
  forecast_donut_done: {
    Done: "#2F6FD6", // token-lint: allow-hex — Welding Progress blue
    "RT Total Forecast Backlog": "#E0B84E", // token-lint: allow-hex — gold
    "RT Total Forecast B.Log": "#E0B84E", // token-lint: allow-hex — gold
  },
};
const forecastColor = (id: string, label: unknown) => FORECAST_COLORS[id]?.[String(label ?? "").trim()];

function seriesColor(label: string, index: number, palette: Palette, canvasId = ""): string {
  const fc = forecastColor(canvasId, label);
  if (fc) return fc;
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
        // a limit's name is placed by thresholdLabelPlugin, clear of every number;
        // a point value that would cover its neighbour (narrow screens) is left to the hover card
        return ds.threshold ? false : "auto";
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
    // modern style (owner, 2026-11-03): no turned numbers — a segment shows its value only
    // when the text fits level inside it; the total above the stack and the hover card stay
    void categoryCount;
    return {
      display: (ctx: DatalabelCtx) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        const scale = horizontal ? ctx.chart.scales.x : ctx.chart.scales.y;
        if (typeof v !== "number" || !scale) return false;
        const px = Math.abs(scale.getPixelForValue(v) - scale.getPixelForValue(0));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const el = (ctx.chart.getDatasetMeta((ctx as AreaCtx).datasetIndex).data[ctx.dataIndex] as any) ?? {};
        const across = horizontal ? Number(el.height ?? 0) : Number(el.width ?? 0);
        const text = fmtValue(v, percent).length * 7 * palette.scale + 6;
        return horizontal ? px >= text && across >= 14 : px >= 16 && across >= text;
      },
      formatter: (v: unknown) => fmtValue(v, percent),
      color: "#ffffff", // token-lint: allow-hex — ink on a saturated bar fill, both schemes
      anchor: "center",
      align: "center",
      rotation: 0,
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
    // "auto": on a narrow screen (phone) a label that would cover its neighbour is left to the
    // hover card; on a wide one every label fits and shows (owner, 2026-11-04)
    display: "auto",
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
/** A label that names a period: 30-Oct-26, Oct 2026, Nov 2025, Q1 24, 2026-10, W44 … */
const PERIOD_LABEL =
  /^((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?|\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{2,4}|[A-Za-z]{3,9}\.?[-\s]?'?\d{2,4}|Q[1-4][-\s]?'?\d{2,4}|\d{4}[-/]\d{1,2}([-/]\d{1,2})?|W(eek)?\s?\d{1,2}|\d{1,3}\.\s.*\d{2})$/;

/** The series a grouped chart's period header follows: the "F"+"S" (all joints) one, else the first. */
function headSeries(widget: ChartWidget): number {
  const i = widget.datasets.findIndex((d) => /"?F"?\s*\+\s*"?S"?|total/i.test(d.label));
  return i >= 0 ? i : 0;
}

/**
 * The period header (owner, 2026-11-03, as the RT B.Log Forecast monthly charts): a vertical bar
 * chart over periods, stacked or of one series, shows its last period against the one before, the
 * average of the periods shown (also a dashed line) and 6 / 12 / 24 / All with arrows.
 */
function isPeriodBar(widget: ChartWidget): boolean {
  const notes = (widget.options_notes ?? "").toLowerCase();
  if (widget.chart_type !== "bar" || (notes.includes("indexaxis") && notes.includes("y"))) return false;
  if (widget.labels.length < 4) return false;
  return widget.labels.every((l) => PERIOD_LABEL.test(String(l).trim()));
}

const avgLinePlugin = {
  id: "avgLine",
  afterDatasetsDraw(chart: ChartJS) {
    const o = (chart.options.plugins as Record<string, unknown> | undefined)?.avgLine as { value: number; color: string } | undefined;
    const y = chart.scales.y;
    if (!o || !y || !Number.isFinite(o.value) || o.value <= 0) return;
    const py = y.getPixelForValue(o.value);
    const { left, right } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = o.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(right, py);
    ctx.stroke();
    ctx.restore();
  },
};

export function ChartCard({ widget, paletteOverride }: { widget: ChartWidget; paletteOverride?: Partial<Palette> }) {
  const [version, setVersion] = useState(0);

  // Long category axes (the forecast's 32-month series) show a WINDOW of the last
  // VISIBLE_CATEGORIES points with a slider underneath to scroll back — the pbix
  // chart's own scrollbar (owner request 2026-09-08: "ползунок внизу графика,
  // чтоб отображалось 24 месяца"). Circular charts never window.
  // "window N" in options_notes narrows the visible span (the flange monthly chart
  // shows its last five months, as the pbix does; owner request 2026-09-08).
  const baseVisible = Number(/\bwindow (\d+)\b/.exec(widget.options_notes ?? "")?.[1]) || VISIBLE_CATEGORIES;
  const periodBar = isPeriodBar(widget);
  // 6 / 12 / 24 / All on a period chart (null: the chart's own span, 0: all)
  const [range, setRange] = useState<number | null>(null);
  const visible = range === null ? baseVisible : range === 0 ? widget.labels.length : range;
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
  // the period header's figures: each period's total (the stack), the average of those shown,
  // the last period against the one before
  const periodTotals = periodBar
    ? widget.labels.map((_, i) =>
        stackedX || stackedY
          ? widget.datasets.reduce((a, d) => a + (toNum(d.data[i] ?? null) ?? 0), 0)
          : (toNum(widget.datasets[headSeries(widget)]?.data[i] ?? null) ?? 0),
      )
    : [];
  const shownTotals = periodTotals.slice(start, end);
  const periodAvg = shownTotals.length ? shownTotals.reduce((a, b) => a + b, 0) / shownTotals.length : 0;
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
              forecastColor(widget.canvas_id, l) ??
              (/weld type/i.test(widget.title) ? weldTypeColors(widget.title)[String(l).trim()] : undefined) ??
              palette.colors[i % palette.colors.length],
            ),
            borderColor: "transparent",
            borderWidth: 0,
            spacing: 2,
            borderRadius: 4,
            hoverOffset: 8,
          },
        ],
      };
    }
    const thresholds = widget.chart_type === "line" ? thresholdsFor(widget.title) : null;
    const area = (widget.options_notes ?? "").includes("area");
    const datasets = widget.datasets.map((ds, i) => {
      // With threshold lines the rate itself is the neutral series (pbix: blue) and
      // the red is reserved for the "Unacceptable" limit.
      const color = thresholds ? palette.colors[0] ?? palette.primary : seriesColor(ds.label, i, palette, widget.canvas_id);
      // forecast bars: a value under 0.5 draws no bar and takes no slot (skipNull), so
      // the remaining bars of a party spread out and their numbers stay clear
      const gap = widget.canvas_id === "forecast_bar";
      const base = {
        label: ds.label,
        data: slice(ds.data).map(toNum).map((v) => (gap && typeof v === "number" && Math.abs(v) < 0.5 ? null : v)),
        stack: ds.stack,
      };
      if (widget.chart_type === "line") {
        // "area" (Welder Performance trends, the pbix stacked-area visual): each series
        // fills down to the one below it, translucent so the stack stays readable
        if (area) {
          return { ...base, borderColor: color, backgroundColor: withAlpha(color, 0.3), fill: i === 0 ? "origin" : "-1", tension: 0.25, pointRadius: 3 };
        }
        return {
          ...base,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2.5,
          tension: thresholds ? 0 : 0.3,
          pointRadius: thresholds ? 3.5 : 3,
          pointHoverRadius: 6,
          pointBorderColor: "#ffffff", // token-lint: allow-hex — the point's ring on any fill
          pointBorderWidth: 1.5,
        };
      }
      // modern T.EN bars (owner, 2026-11-03): rounded, no border, a thickness cap
      const stk = (widget.options_notes ?? "").includes("stacked");
      return {
        ...base,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        borderRadius: stk ? 3 : 6,
        borderSkipped: stk ? false : "start",
        maxBarThickness: 46,
      };
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
      ...(widget.canvas_id === "forecast_bar" ? { skipNull: true } : {}),
      // a doughnut with its total in the hole gets a wider hole, so the number fits (owner, 2026-10-19)
      ...(circular && notes.includes("center-total") ? { cutout: "64%" } : {}),
      // the forecast page's two doughnuts: a thin ring and smaller labels (owner, 2026-10-19)
      ...(SMALL_RINGS.has(widget.canvas_id) ? { cutout: "73%" } : {}),
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
            ? { top: 32, bottom: SMALL_RINGS.has(widget.canvas_id) ? 24 : 4, left: 30, right: 30 } // value + % on two lines
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
        legend: { display: !(circular && notes.includes("label-name-pct")) && !notes.includes("legend-none"), position: notes.includes("legend-bottom") ? "bottom" : widget.canvas_id === "chart1_weldtype" || notes.includes("legend-right") ? "right" : "top",
          labels: { usePointStyle: true, pointStyle: "rectRounded", padding: notes.includes("legend-bottom") ? 18 : 10, color: palette.text, boxWidth: 12, font: { size: Math.round(10 * palette.scale), family: palette.font },
          // a doughnut with many slices (page 1 lists every weld type) keeps its
          // legend to the 7 largest so the chart keeps its size; the rest show on hover
          ...(circular ? { filter: (item: { index?: number }) => (item.index ?? 0) < 7 } : {}) } },
        // the hover card in the theme's colours (owner, 2026-11-03)
        tooltip: {
          enabled: true,
          backgroundColor: palette.tipBg,
          borderColor: palette.grid,
          borderWidth: 1,
          titleColor: palette.fg,
          bodyColor: palette.fg,
          footerColor: palette.text,
          padding: 10,
          cornerRadius: 8,
          caretSize: 6,
          usePointStyle: true,
          boxPadding: 4,
          titleFont: { weight: 700, family: palette.font },
          bodyFont: { family: palette.font },
          callbacks: {
            label: (c: { dataset: { label?: string }; formattedValue: string; label?: string }) =>
              ` ${c.dataset.label || c.label || ""}: ${c.formattedValue}`,
          },
        },
        datalabels: smallRing(widget.canvas_id, palette.scale, notes.includes("area") ? areaLabels(palette) : valueLabels(widget.chart_type, stackedX || stackedY, percentAxis, circular, palette, widget.datasets.length, end - start, horizontal, notes.includes("label-name-pct"))),
        centerTotal:
          circular && notes.includes("center-total")
            ? {
                color: palette.fg,
                font: palette.font ?? "sans-serif",
                value: (() => {
                  const m = /(?:centre|total) = ([\d,]+)/.exec(notes);
                  return m ? Number(m[1].replace(/,/g, "")) : undefined;
                })(),
              }
            : undefined,
        thresholdLabels: thresholds
          ? {
              family: palette.font ?? "sans-serif",
              size: 11,
              dataSize: Math.round(12 * palette.scale),
              percent: percentAxis,
            }
          : undefined,
        barLegendGap: {
          px: widget.chart_type === "bar" && !(stackedX || stackedY) && !horizontal && widget.datasets.length > 2 ? Math.round(26 * palette.scale) : 0,
        },
        avgLine: periodBar ? { value: periodAvg, color: palette.seriesF ?? "#e0b84e" } : undefined, // token-lint: allow-hex — gold fallback
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
              grid: { display: false },
              border: { color: palette.grid },
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
              grid: { color: palette.grid, drawTicks: false },
              border: { display: false, dash: [3, 4] },
            };
            return horizontal ? { x: value, y: category } : { x: category, y: value };
          })(),
    }),
    [palette, stackedX, stackedY, percentAxis, horizontal, circular, widget.chart_type, widget.datasets.length, widget.canvas_id, start, end, thresholds, notes, yearAxis, yearTitle, yCenter, visibleMax, rotation, periodBar, periodAvg],
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
      chart = <Chart key={version} type="line" data={data} options={options} plugins={[thresholdLabelPlugin]} />;
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
      chart = <Chart key={version} type="bar" data={data} options={options} plugins={[stackTotalsPlugin, barLegendGapPlugin, avgLinePlugin]} />;
  }
  if (periodBar) {
    const n = widget.labels.length;
    const lastT = periodTotals[n - 1] ?? 0;
    const prevT = periodTotals[n - 2] ?? 0;
    const delta = prevT ? ((lastT - prevT) / prevT) * 100 : null;
    const ranges = [6, 12, 24, 0].filter((r) => r === 0 || r < n);
    const size = Math.min(visible, n);
    const step = Math.max(1, Math.round(size / 3));
    const pick = (r: number) => {
      setRange(r);
      setWindowStart(Math.max(0, n - (r === 0 ? n : r)));
    };
    return (
      <div className="pb">
        <div className="mb-head pb-head">
          <div className="mb-last">
            <span className="fc-muted">{axisLabel(widget.labels[n - 1])}</span>
            <b className="num">{fmtValue(lastT, percentAxis)}</b>
            {!(stackedX || stackedY) && widget.datasets.length > 1 ? (
              <span className="fc-muted">{widget.datasets[headSeries(widget)]?.label}</span>
            ) : null}
            {delta !== null ? (
              <span className={`mb-delta ${delta >= 0 ? "is-up" : "is-down"}`}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs {axisLabel(widget.labels[n - 2])}
              </span>
            ) : null}
          </div>
          <div className="mb-tools">
            <span className="mb-key mb-key--avg">
              <i /> avg <b className="num">{fmtValue(percentAxis ? periodAvg : Math.round(periodAvg), percentAxis)}</b>
            </span>
            {n > 6 ? (
              <div className="mb-range" role="group" aria-label="Periods shown" title={`${axisLabel(widget.labels[start])} – ${axisLabel(widget.labels[end - 1])}: ${end - start} of ${n}`}>
                <button type="button" className="mb-btn" disabled={start <= 0} aria-label="Earlier" onClick={() => setWindowStart(Math.max(0, start - step))}>
                  ◀
                </button>
                {ranges.map((r) => {
                  const on = (r === 0 ? n : r) === size && (r === 0 || r < n);
                  return (
                    <button key={r} type="button" className={`mb-btn${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => pick(r)}>
                      {r === 0 ? "All" : r}
                    </button>
                  );
                })}
                <button type="button" className="mb-btn" disabled={end >= n} aria-label="Later" onClick={() => setWindowStart(Math.min(n - size, start + step))}>
                  ▶
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="pb-canvas">{chart}</div>
      </div>
    );
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

/** Doughnuts drawn with a thin ring and labels a size down (owner, 2026-10-19). */
const SMALL_RINGS = new Set(["forecast_donut_done", "forecast_donut_backlog"]);
/** Charts whose value labels show whole numbers, no decimals (owner, 2026-10-19). */
const WHOLE_NUMBERS = new Set(["forecast_donut_done", "forecast_donut_backlog", "forecast_bar"]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function smallRing(id: string, scale: number, labels: any): any {
  if (!labels) return labels;
  let out = labels;
  if (SMALL_RINGS.has(id) && out.font && typeof out.font === "object") out = { ...out, font: { ...out.font, size: Math.round(10 * scale) } };
  // the Graph pages' Weld Type doughnut: its numbers a little smaller (owner, 2026-10-20)
  if (/^chart(7|8|9|10|11)_weldtype$/.test(id) && out.font && typeof out.font === "object") out = { ...out, font: { ...out.font, size: Math.round(10.5 * scale) } };
  // the forecast bars: a number per bar, a size down so they fit the bar's height
  if (id === "forecast_bar" && out.font && typeof out.font === "object") out = { ...out, font: { ...out.font, size: Math.round(10 * scale) } };
  const fmt = out.formatter;
  if (WHOLE_NUMBERS.has(id) && typeof fmt === "function") {
    // a doughnut's share is still taken of the exact values
    out = { ...out, formatter: (v: unknown, ctx: unknown) => fmt(typeof v === "number" ? Math.round(v) : v, ctx) };
    // a value that rounds to 0 has no label
    const disp = out.display;
    out = {
      ...out,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      display: (ctx: any) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        if (typeof v === "number" && Math.round(v) === 0) return false;
        const d = typeof disp === "function" ? disp(ctx) : (disp ?? true);
        // the forecast bars stand apart now: every number is drawn, none dropped as a collision
        return id === "forecast_bar" && d === "auto" ? true : d;
      },
    };
  }
  return out;
}
