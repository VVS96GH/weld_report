import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPage } from "@/lib/page-source";
import { WELDING_PAGE_TITLES, WELDING_REPORT_SUBTITLE, WELDING_TOTAL_PAGES } from "@/lib/welding-pages";
import { PageView } from "@/components/PageView";

// Data is loaded per-request (fixture file today, a live DB once METRICS-LANE lands),
// and there's no fixed set of params to prerender for it — so this route is dynamic
// rather than statically generated. No `generateStaticParams` on purpose.
export const dynamic = "force-dynamic";

function parsePageNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > WELDING_TOTAL_PAGES) return null;
  return n;
}

export async function generateMetadata(props: PageProps<"/welding/[page]">): Promise<Metadata> {
  const { page } = await props.params;
  const n = parsePageNumber(page);
  if (n === null) return { title: "Welding Statistics Dashboard" };
  // Titles come from the static list, not from getPage(): the page body already
  // loads the model, and a second getPage() here would double every DB query.
  return { title: `${WELDING_PAGE_TITLES[n - 1]} — Welding Statistics Dashboard` };
}

export default async function WeldingReportPage(props: PageProps<"/welding/[page]">) {
  const { page } = await props.params;
  const n = parsePageNumber(page);
  if (n === null) {
    notFound();
  }

  const model = await getPage(n);
  const subtitle =
    model.meta?.source === "database"
      ? `Data as of ${model.meta.as_of ?? "unknown"}`
      : WELDING_REPORT_SUBTITLE;

  return <PageView model={model} subtitle={subtitle} />;
}
