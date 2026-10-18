/**
 * Display wording the owner set over the pbix names (2026-10-18: "Backlog" reads
 * "B.Log" on every page). Display only — the models, tests and filter values keep
 * the original words.
 */
import type { PageModel, Widget } from "@/lib/page-model";

export const relabel = (s: string): string => s.replace(/\bback\s?log\b/gi, "B.Log");

export function relabelWidget(w: Widget): Widget {
  switch (w.kind) {
    case "kpi":
      return { ...w, label: relabel(w.label), sub: w.sub === undefined ? undefined : relabel(w.sub) };
    case "table":
      return {
        ...w,
        title: relabel(w.title),
        columns: w.columns.map(relabel),
        rows: w.rows.map((r) => r.map(relabel)),
        total_row: w.total_row?.map(relabel),
      };
    case "chart":
      return {
        ...w,
        title: relabel(w.title),
        labels: w.labels.map(relabel),
        datasets: w.datasets.map((d) => ({ ...d, label: relabel(d.label) })),
      };
    default:
      // filters keep their values (they go back to the server); notes are prose
      return w;
  }
}

export function relabelModel(model: PageModel): PageModel {
  return {
    ...model,
    title: relabel(model.title),
    subtitle: model.subtitle === undefined ? undefined : relabel(model.subtitle),
    widgets: model.widgets.map(relabelWidget),
  };
}
