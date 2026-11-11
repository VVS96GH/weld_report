/**
 * `GET /api/errors/<check>?subco=CCC,GAC` — one error check as a CSV download
 * (lib/pages/errors.ts), in the owner's column layout, for the e-mail to the
 * sub-contractor who must correct it.
 */
import type { NextRequest } from "next/server";
import { guardDownloads } from "@/lib/downloads";

import { resolvePageSource } from "@/lib/page-source";
import { checkById, errorCsv } from "@/lib/pages/errors";

export const dynamic = "force-dynamic";

async function GET_handler(request: NextRequest, ctx: RouteContext<"/api/errors/[check]">): Promise<Response> {
  if (resolvePageSource() !== "database") {
    return Response.json({ error: "error checks need PAGE_SOURCE=database" }, { status: 503 });
  }
  const { check: id } = await ctx.params;
  const check = checkById(id);
  if (!check) return Response.json({ error: `unknown check "${id}"` }, { status: 404 });
  const sp = request.nextUrl.searchParams;
  // The check's own slicers, by their plain ids (subco, rtr, rtj, joint, sclass…).
  const values: Record<string, string> = {};
  for (const f of check.filters) {
    for (const id of f.kind === "tree" ? [f.id, f.childId] : [f.id]) {
      const v = sp.get(id);
      if (v) values[id] = v;
    }
  }
  const csv = await errorCsv(check, values);
  const subco = values.subco;
  const day = new Date().toISOString().slice(0, 10);
  const who = subco ? `_${subco.replace(/[^A-Za-z0-9,-]/g, "").replace(/,/g, "+")}` : "";
  const name = `${check.title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}${who}_${day}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = guardDownloads("Downloaded an error check (CSV)", GET_handler);
