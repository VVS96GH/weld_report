/**
 * The cumulative "CUM FILE Welders Performance" workbooks (lib/welder-perf-cum.ts):
 *   GET  ?kind=2w&action=csv     the hidden pbix table at the cut-off, as the owner's CSV export
 *   GET  ?kind=2w&action=file    the workbook as it is in sources/
 *   POST ?kind=2w&action=append  paste the new RT dates into the workbook (backup first), reload
 *   POST ?kind=2w&action=reload  re-read the workbook after a hand edit
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

import { queryFresh, withAsOf } from "@/lib/db";
import { chartCutoff } from "@/lib/metrics/trend";
import { resolvePageSource } from "@/lib/page-source";
import {
  appendToWorkbook, csvDate, CUM_FILES, type CumKind, planAppend, reloadTable, type Run, snapshotCsv, snapshotRows,
} from "@/lib/welder-perf-cum";

export const dynamic = "force-dynamic";

// the CUM table changes between refreshes ("Insert into CUM file"): read it fresh
const run: Run = (sql, params) => queryFresh(sql, params);

function kindOf(request: NextRequest): CumKind | null {
  const k = request.nextUrl.searchParams.get("kind");
  return k === "2w" || k === "1m" ? k : null;
}

async function cutoff(): Promise<string> {
  return chartCutoff((await withAsOf(null)).as_of);
}

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ error: "needs PAGE_SOURCE=database" }, { status: 503 });
  const kind = kindOf(request);
  if (!kind) return Response.json({ error: "kind must be 2w or 1m" }, { status: 400 });
  const action = request.nextUrl.searchParams.get("action");
  if (action === "csv") {
    const c = await cutoff();
    const csv = snapshotCsv(kind, await snapshotRows(run, kind, c));
    const name = `${kind === "2w" ? "Last 2 weeks" : "Last 1 Month"} CUM - Welders Performance. for Table ${csvDate(c)}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (action === "file") {
    const file = path.resolve(CUM_FILES[kind]);
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${path.basename(file)}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return Response.json({ error: "action must be csv or file" }, { status: 400 });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ error: "needs PAGE_SOURCE=database" }, { status: 503 });
  const kind = kindOf(request);
  if (!kind) return Response.json({ error: "kind must be 2w or 1m" }, { status: 400 });
  const action = request.nextUrl.searchParams.get("action");
  try {
    if (action === "append") {
      const plan = await planAppend(run, kind, await cutoff());
      const res = await appendToWorkbook(kind, plan);
      const rows = await reloadTable(run, kind);
      return Response.json({ added: res.added, backup: path.basename(res.backup), rows, after: plan.lastDate });
    }
    if (action === "reload") {
      const rows = await reloadTable(run, kind);
      return Response.json({ rows });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return Response.json({ error: "action must be append or reload" }, { status: 400 });
}
