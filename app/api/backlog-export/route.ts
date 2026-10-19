/**
 * GET ?kind=rt|pwht — the RT B.Log / PWHT B.Log joints of the project table,
 * every weld row and column, as CSV (lib/backlog-export.ts).
 */
import type { NextRequest } from "next/server";

import { backlogCsv, backlogJoints, type BacklogKind } from "@/lib/backlog-export";
import { resolvePageSource } from "@/lib/page-source";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ error: "needs PAGE_SOURCE=database" }, { status: 503 });
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "rt" && kind !== "pwht") return Response.json({ error: "kind must be rt or pwht" }, { status: 400 });
  const n = (await backlogJoints(kind as BacklogKind)).length;
  const name = `${kind === "rt" ? "RT B.Log" : "PWHT B.Log"} - ${n} joints - ${new Date().toISOString().slice(0, 10)}.csv`;
  const enc = new TextEncoder();
  const it = backlogCsv(kind as BacklogKind);
  const stream = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      const { value, done } = await it.next();
      if (done) ctrl.close();
      else ctrl.enqueue(enc.encode(value));
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
