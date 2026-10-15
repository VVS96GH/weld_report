/**
 * `GET /api/welder-performance/joints?page=2-weeks&q=11090&…slicers` — one page
 * of the Joint ID slicer's options under the other slicers (lib/pages/
 * welder-performance.ts wpJointOptions).
 */
import type { NextRequest } from "next/server";

import { withAsOf } from "@/lib/db";
import { chartCutoff } from "@/lib/metrics/trend";
import { resolvePageSource } from "@/lib/page-source";
import { parseFilters, wpJointOptions, wpPage } from "@/lib/pages/welder-performance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") {
    return Response.json({ error: "welder performance needs PAGE_SOURCE=database" }, { status: 503 });
  }
  const sp = request.nextUrl.searchParams;
  const page = wpPage(sp.get("page") ?? "");
  if (!page) return Response.json({ error: "unknown page" }, { status: 400 });
  const params: Record<string, string | undefined> = {};
  for (const [k, v] of sp) params[k] = v || undefined;
  const { as_of } = await withAsOf(null);
  const out = await wpJointOptions(page, parseFilters(params, page), sp.get("q") ?? "", chartCutoff(as_of));
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
