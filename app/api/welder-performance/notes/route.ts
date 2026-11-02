/** `PUT /api/welder-performance/notes` {kind, sub, body} — one Notes box, at the current cut-off. */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { withAsOf } from "@/lib/db";
import { chartCutoff } from "@/lib/metrics/trend";
import { resolvePageSource } from "@/lib/page-source";
import { saveNote, SUMMARY_SUBS } from "@/lib/pages/welder-perf-summary";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["2w", "1m", "ut2w"]),
  sub: z.enum(SUMMARY_SUBS),
  body: z.string().max(20_000),
});

async function PUT_handler(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ error: "needs PAGE_SOURCE=database" }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "kind, sub and body are required" }, { status: 400 });
  const cutoff = chartCutoff((await withAsOf(null)).as_of);
  await saveNote(parsed.data.kind, cutoff, parsed.data.sub, parsed.data.body);
  return Response.json({ ok: true, cutoff });
}

// the activity log (lib/audit.ts)
export const PUT = audited("Welder notes", PUT_handler);
