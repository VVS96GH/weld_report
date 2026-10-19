/**
 * The Data page's server side (lib/pages/data-grid.ts):
 *   GET ?action=rows&f=&c=&s=&offset=   one page of rows
 *   GET ?action=count&f=                 how many rows match
 *   GET ?action=values&col=&q=&f=        a column's values under the other filters
 *   GET ?action=csv&f=&c=                the filtered rows as CSV (load order, up to 1,000,000)
 */
import type { NextRequest } from "next/server";

import { resolvePageSource } from "@/lib/page-source";
import { gridCount, gridCsv, gridRows, gridValues, parseColumns, parseFilters, parseSort } from "@/lib/pages/data-grid";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ error: "needs PAGE_SOURCE=database" }, { status: 503 });
  const sp = request.nextUrl.searchParams;
  const filters = parseFilters(sp.get("f"));
  const action = sp.get("action");
  try {
    if (action === "rows") {
      const cols = parseColumns(sp.get("c"));
      const out = await gridRows(filters, cols, parseSort(sp.get("s")), Number(sp.get("offset") ?? 0) || 0);
      return Response.json({ cols, ...out }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "count") {
      return Response.json({ count: await gridCount(filters) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "values") {
      const out = await gridValues(sp.get("col") ?? "", filters, sp.get("q") ?? "");
      if (!out) return Response.json({ error: "unknown column" }, { status: 400 });
      return Response.json(out, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "csv") {
      const cols = parseColumns(sp.get("c"));
      const it = gridCsv(filters, cols);
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async pull(ctrl) {
          const { value, done } = await it.next();
          if (done) ctrl.close();
          else ctrl.enqueue(enc.encode(value));
        },
        async cancel() {
          await it.return(undefined);
        },
      });
      const stamp = new Date().toISOString().slice(0, 10);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Weld data ${stamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return Response.json({ error: "action must be rows, count, values or csv" }, { status: 400 });
}
