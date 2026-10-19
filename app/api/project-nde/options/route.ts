/**
 * `GET /api/project-nde/options?field=rtrep&q=RT-12&…slicers` — one page of a
 * searched row slicer's values on the Project NDE & PWHT page, under the other
 * slicers (lib/pages/project-nde.ts pnRowOptions).
 */
import type { NextRequest } from "next/server";

import { resolvePageSource } from "@/lib/page-source";
import { pnRowOptions } from "@/lib/pages/project-nde";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") {
    return Response.json({ error: "this page needs PAGE_SOURCE=database" }, { status: 503 });
  }
  const sp = request.nextUrl.searchParams;
  const params: Record<string, string | undefined> = {};
  for (const [k, v] of sp) params[k] = v || undefined;
  const out = await pnRowOptions(sp.get("field") ?? "", params, sp.get("q") ?? "");
  if (!out) return Response.json({ error: "unknown field" }, { status: 400 });
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
