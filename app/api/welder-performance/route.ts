/**
 * `GET /api/welder-performance?page=2-weeks&matrix=rt&level=welder&sub=CCC&…slicers`
 * — the children of one matrix row (a sub-contractor's welders, a welder's
 * joints, a joint's reports), fetched when the row is expanded.
 */
import type { NextRequest } from "next/server";

import { withAsOf } from "@/lib/db";
import { chartCutoff } from "@/lib/metrics/trend";
import { resolvePageSource } from "@/lib/page-source";
import { type Level, type Matrix, parseFilters, wpPage, wpRows } from "@/lib/pages/welder-performance";

export const dynamic = "force-dynamic";

const LEVELS: readonly Level[] = ["sub", "welder", "joint", "report"];

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") {
    return Response.json({ error: "welder performance needs PAGE_SOURCE=database" }, { status: 503 });
  }
  const sp = request.nextUrl.searchParams;
  const page = wpPage(sp.get("page") ?? "");
  const matrix = sp.get("matrix");
  const level = sp.get("level") as Level | null;
  if (!page || (matrix !== "rt" && matrix !== "ut") || !level || !LEVELS.includes(level)) {
    return Response.json({ error: "page, matrix (rt|ut) and level are required" }, { status: 400 });
  }
  const params: Record<string, string | undefined> = {};
  for (const [k, v] of sp) params[k] = v || undefined;
  const scope: { sub?: string; welder?: string; joint?: string } = {};
  for (const k of ["sub", "welder_scope", "joint_scope"] as const) {
    const v = sp.get(k);
    if (v !== null) scope[k === "sub" ? "sub" : k === "welder_scope" ? "welder" : "joint"] = v;
  }
  const { as_of } = await withAsOf(null);
  const { rows } = await wpRows(page, matrix as Matrix, level, parseFilters(params, page), scope, chartCutoff(as_of));
  return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
}
