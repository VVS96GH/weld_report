import type { Metadata } from "next";

import { SourcesView } from "@/components/SourcesView";
import { sourcesStatus } from "@/lib/sources-status";

// files and loads are read live
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sources — Welding Statistics Dashboard" };

/** The source files and their loads (owner request 2026-11-08), as on the platform's Data page. */
export default async function SourcesPage() {
  return <SourcesView initial={await sourcesStatus()} />;
}
