/**
 * `GET /api/wps-material?tree=wps|mat&path=["MANUAL","CS-02"]&<slicers>` — the
 * child rows of one node of the WPS / Material matrices (lib/pages/wps-material.ts),
 * loaded when a + is opened.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { resolvePageSource } from "@/lib/page-source";
import { wmParamsFrom, wmRows, type WmTree } from "@/lib/pages/wps-material";

export const dynamic = "force-dynamic";

const Path = z.array(z.string().max(300)).max(5);

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ rows: [] });
  const sp = request.nextUrl.searchParams;
  const tree = sp.get("tree") === "mat" ? "mat" : ("wps" as WmTree);
  const path = Path.safeParse(JSON.parse(sp.get("path") ?? "[]"));
  if (!path.success) return Response.json({ error: "bad path" }, { status: 400 });
  try {
    const rows = await wmRows(wmParamsFrom(sp), tree, path.data);
    return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: "failed", detail: String((err as Error).message) }, { status: 500 });
  }
}
