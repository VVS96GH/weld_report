/**
 * Graph-page layout sizes (owner, 2026-10-20): the owner tunes them on one
 * page with the drag handles, they are saved to data/graph-layout.json, then
 * fixed into the CSS for every Graph page.
 */
export type GraphLayout = {
  /** left column width, % of the block */
  left: number;
  /** chart heights, px */
  status: number;
  rate1: number;
  rate2: number;
  blog: number;
  /** left B.Log chart width, % of the B.Log row */
  blogLeft: number;
  /** doughnut minimum height, px */
  donut: number;
  /** key-figure column width, px */
  kpi: number;
  /** tables scale, % */
  table: number;
};

export const GRAPH_LAYOUT_DEFAULT: GraphLayout = {
  left: 48,
  status: 250,
  rate1: 165,
  rate2: 165,
  blog: 230,
  blogLeft: 50,
  donut: 300,
  kpi: 170,
  table: 100,
};

export const GRAPH_LAYOUT_LIMITS: Record<keyof GraphLayout, [number, number, string]> = {
  left: [25, 75, "Ширина левой колонки, %"],
  status: [120, 600, "Welding Status, высота px"],
  rate1: [80, 400, "%RT Rej, высота px"],
  rate2: [80, 400, "%UT Rej, высота px"],
  blog: [120, 600, "B.Log графики, высота px"],
  blogLeft: [25, 75, "RT/UT B.Log ширина, %"],
  donut: [150, 800, "Бублик, мин. высота px"],
  kpi: [110, 400, "Карточки KPI, ширина px"],
  table: [60, 160, "Таблицы, масштаб %"],
};

export function clampLayout(v: Partial<Record<string, unknown>>): GraphLayout {
  const out = { ...GRAPH_LAYOUT_DEFAULT };
  for (const k of Object.keys(GRAPH_LAYOUT_DEFAULT) as (keyof GraphLayout)[]) {
    const n = Number(v[k]);
    if (Number.isFinite(n)) {
      const [lo, hi] = GRAPH_LAYOUT_LIMITS[k];
      out[k] = Math.round(Math.min(hi, Math.max(lo, n)) * 10) / 10;
    }
  }
  return out;
}
