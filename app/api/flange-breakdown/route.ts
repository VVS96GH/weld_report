/**
 * The "CUM Trend Flange Progress Break Down Rate %" workbook (lib/flange-breakdown-cum.ts):
 *   GET  ?action=csv      this week's rows, as they would go into the workbook
 *   GET  ?action=file     the workbook as it is in sources/
 *   POST ?action=insert   write this week's rows into the workbook (backup first) and the chart
 *   POST ?action=reload   re-read the workbook after a hand edit
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

import {
  FLANGE_CUM_FILE,
  computeFlangeWeek,
  flangeWeekCsv,
  insertFlangeWeek,
  reloadFlangeFromFile,
} from "@/lib/flange-breakdown-cum";
import { resolvePageSource } from "@/lib/page-source";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ error: "needs PAGE_SOURCE=database" }, { status: 503 });
  const action = request.nextUrl.searchParams.get("action");
  if (action === "csv") {
    const { week, rows } = await computeFlangeWeek();
    return new Response(flangeWeekCsv(week, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Flange Break Down Rate ${week}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (action === "file") {
    const file = FLANGE_CUM_FILE();
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,
        "Cache-Control": "no-store",
      },
    });
  }
  return Response.json({ error: "action must be csv or file" }, { status: 400 });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ error: "needs PAGE_SOURCE=database" }, { status: 503 });
  const action = request.nextUrl.searchParams.get("action");
  try {
    if (action === "insert") {
      const { week, rows } = await computeFlangeWeek();
      const res = await insertFlangeWeek(week, rows);
      return Response.json({ week, added: res.added, replaced: res.replaced, backup: path.basename(res.backup) });
    }
    if (action === "reload") return Response.json({ rows: await reloadFlangeFromFile() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return Response.json({ error: "action must be insert or reload" }, { status: 400 });
}
