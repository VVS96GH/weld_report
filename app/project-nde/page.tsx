import type { Metadata } from "next";

import { ProjectNdeView } from "@/components/ProjectNdeView";
import { resolvePageSource } from "@/lib/page-source";
import { getProjectNdePage } from "@/lib/pages/project-nde";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Project NDE & PWHT Status — Welding Statistics Dashboard" };

// typed by hand: the generated route types (.next/types) do not know this route until the next build
export default async function ProjectNdePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (resolvePageSource() !== "database") {
    return <ProjectNdeView data={null} note="This page is computed from the database only." />;
  }
  const params = await props.searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) flat[k] = (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  return <ProjectNdeView data={await getProjectNdePage(flat)} />;
}
