import type { Metadata } from "next";

import { WpsMaterialView } from "@/components/WpsMaterialView";
import { resolvePageSource } from "@/lib/page-source";
import { getWpsMaterialPage } from "@/lib/pages/wps-material";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "WPS No / Type of Material — Welding Statistics Dashboard" };

// typed by hand: the generated route types (.next/types) do not know this route until the next build
export default async function WpsMaterialPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (resolvePageSource() !== "database") {
    return <WpsMaterialView data={null} note="The WPS / Material page is computed from the database only." />;
  }
  const params = await props.searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) flat[k] = (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  return <WpsMaterialView data={await getWpsMaterialPage(flat)} />;
}
