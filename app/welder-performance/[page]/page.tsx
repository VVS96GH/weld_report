import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RejectionSummaryView } from "@/components/RejectionSummaryView";
import { WelderPerfView } from "@/components/WelderPerfView";
import { query, withAsOf } from "@/lib/db";
import { chartCutoff } from "@/lib/metrics/trend";
import { resolvePageSource } from "@/lib/page-source";
import { getSummaryPage } from "@/lib/pages/welder-perf-summary";
import { getWelderPerfPage, wpPage } from "@/lib/pages/welder-performance";
import { type CumKind, planAppend } from "@/lib/welder-perf-cum";

// Read live from the loaded data; nothing to prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Welder Performance — Welding Statistics Dashboard" };

/** The Rejection Summary pages of each section. */
const SUMMARY: Record<string, CumKind> = { "2-weeks-summary": "2w", "1-month-summary": "1m" };

export default async function WelderPerformancePage(props: PageProps<"/welder-performance/[page]">) {
  const { page: slug } = await props.params;
  const kind = SUMMARY[slug];
  const def = wpPage(slug);
  if (!def && !kind) notFound();
  // Computed from the database only; the fixture build (CI e2e) shows a note.
  if (resolvePageSource() !== "database") {
    const note = "Welder performance is computed from the database only; PAGE_SOURCE=fixture shows this note instead.";
    return kind ? <RejectionSummaryView data={null} note={note} /> : <WelderPerfView data={null} note={note} />;
  }
  if (kind) {
    const cutoff = chartCutoff((await withAsOf(null)).as_of);
    const plan = await planAppend((sql, params) => query(sql, params), kind, cutoff);
    const data = await getSummaryPage(kind, { lastDate: plan.lastDate, rows: plan.rows.length });
    return <RejectionSummaryView data={data} />;
  }
  const params = await props.searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) flat[k] = (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const data = await getWelderPerfPage(def!, flat);
  return <WelderPerfView data={data} />;
}
