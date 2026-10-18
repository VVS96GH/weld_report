/**
 * Display wording the owner set over the pbix names (2026-10-18: "Backlog" reads
 * "B.Log" on every page). Display only — the models, tests and filter values keep
 * the original words.
 */
import type { PageModel, Widget } from "@/lib/page-model";

export const relabel = (text: string): string => text.replace(/\bback\s?log\b/gi, "B.Log");

export function relabelWidget(widget: Widget): Widget {
  switch (widget.kind) {
    case "kpi":
      return { ...widget, label: relabel(widget.label), sub: widget.sub === undefined ? undefined : relabel(widget.sub) };
    case "table":
      return {
        ...widget,
        title: relabel(widget.title),
        columns: widget.columns.map(relabel),
        rows: widget.rows.map((r) => r.map(relabel)),
        total_row: widget.total_row?.map(relabel),
      };
    case "chart":
      return {
        ...widget,
        title: relabel(widget.title),
        labels: widget.labels.map(relabel),
        datasets: widget.datasets.map((d) => ({ ...d, label: relabel(d.label) })),
      };
    default:
      // filters keep their values (they go back to the server); notes are prose
      return widget;
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
