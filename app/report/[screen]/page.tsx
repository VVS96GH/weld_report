import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { FilterWidget, PageModel, Widget } from "@/lib/page-model";
import { getPage, type WeldingFilters } from "@/lib/page-source";
import { screenById, screenValues, screenVariantLabel, SCREENS } from "@/lib/screens";
import { WELDING_REPORT_SUBTITLE } from "@/lib/welding-pages";
import { FilterBar } from "@/components/FilterBar";
import { PageView } from "@/components/PageView";

// Option A of the consolidation proposal: /report/<screen>?subco=…&rt=… renders the
// 44-page report's own PageModels for that combination (see lib/screens.ts). Data is
// per request; nothing to prerender.
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

function first(params: Params, key: string): string | undefined {
  const raw = params[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export async function generateMetadata(props: PageProps<"/report/[screen]">): Promise<Metadata> {
  const { screen } = await props.params;
  const def = screenById(screen);
  return { title: `${def?.title ?? "Report"} — Welding Statistics Dashboard` };
}

/** Two widgets are the same table/note if they render identically — pages 3 and 7 share tables. */
function widgetKey(w: Widget): string {
  switch (w.kind) {
    case "table":
      return `table:${w.title}:${w.columns.join("|")}:${JSON.stringify(w.rows)}`;
    case "text":
      return `text:${w.text}`;
    case "chart":
      return `chart:${w.canvas_id}`;
    case "kpi":
      return `kpi:${w.label}:${w.value}`;
    case "filter":
      return `filter:${w.id}`;
  }
}

/** Concatenate the pages' widgets in order, dropping exact duplicates and page-1's own filter bar. */
function mergeWidgets(models: PageModel[]): Widget[] {
  const seen = new Set<string>();
  const out: Widget[] = [];
  for (const m of models) {
    for (const w of m.widgets) {
      if (w.kind === "filter") continue;
      const key = widgetKey(w);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(w);
    }
  }
  return out;
}

export default async function ReportScreen(props: PageProps<"/report/[screen]">) {
  const { screen } = await props.params;
  const def = screenById(screen);
  if (!def) notFound();

  const params = await props.searchParams;
  const values = screenValues(def, Object.fromEntries(def.filters.map((f) => [f.id, first(params, f.id)])));
  const pages = def.pages(values);

  // Page 1 keeps its own slicers: forward them untouched.
  const passthrough: WeldingFilters = {};
  for (const key of def.passthrough ?? []) {
    const v = first(params, key);
    if (v) (passthrough as Record<string, string>)[key] = v;
  }

  const models = pages ? await Promise.all(pages.map((n) => getPage(n, undefined, { filters: passthrough }))) : [];
  const variant = screenVariantLabel(def, values);

  // Filters this screen owns (subco / rt) come first; page 1's own slicers follow as
  // the page emitted them, so the bar shows both kinds side by side.
  const own: FilterWidget[] = def.filters.map((f) => ({
    kind: "filter",
    id: f.id,
    label: f.label,
    options: f.options.map((o) => o.value),
    value: values[f.id],
  }));
  const forwarded = models.flatMap((m) => m.widgets.filter((w): w is FilterWidget => w.kind === "filter"));

  const widgets: Widget[] = pages
    ? mergeWidgets(models)
    : [
        {
          kind: "text",
          text: `No page in the report: the 44-page report has no "${variant}" combination for this screen — this is the report's own coverage, not missing data.`,
        },
      ];

  const model: PageModel = {
    page: 0,
    id: `screen-${def.id}`,
    title: variant ? `${def.title} — ${variant}` : def.title,
    widgets,
    filters: values,
    meta: models[0]?.meta,
  };
  const subtitle = model.meta?.source === "database" ? `Data as of ${model.meta.as_of ?? "unknown"}` : WELDING_REPORT_SUBTITLE;

  return (
    <>
      <FilterBar widgets={[...own, ...forwarded]} />
      <PageView model={model} subtitle={subtitle} />
    </>
  );
}

// Referenced so the registry is type-checked as part of this route.
void SCREENS;
