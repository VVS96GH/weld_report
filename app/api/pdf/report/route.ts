/**
 * The PDF menu's "report" (lib/page-pdf.ts):
 *   POST {paths, theme, mood, density}  start; answers {id, total}
 *   GET  ?id=…                          progress {done, total, ready, error}
 *   GET  ?id=…&download=1               the merged PDF
 */
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { PDF_PATHS } from "@/lib/pdf-catalog";
import { reportJob, startReport } from "@/lib/page-pdf";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAFE = /^[\w-]{0,32}$/;

async function POST_handler(request: NextRequest): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const paths = Array.isArray(body?.paths) ? body.paths.map(String).filter((p) => PDF_PATHS.has(p)) : [];
  if (!paths.length) return Response.json({ error: "no pages chosen" }, { status: 400 });
  const pick = (k: string) => {
    const v = typeof body?.[k] === "string" ? (body[k] as string) : "";
    return SAFE.test(v) ? v : "";
  };
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const id = startReport(paths, { theme: pick("theme"), mood: pick("mood"), density: pick("density"), session });
  return Response.json({ id, total: paths.length });
}

export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const job = reportJob(sp.get("id") ?? "");
  if (!job) return Response.json({ error: "unknown or expired job" }, { status: 404 });
  if (sp.get("download")) {
    if (!job.pdf) return Response.json({ error: "not ready" }, { status: 409 });
    return new Response(new Uint8Array(job.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(job.name)}`,
        "Cache-Control": "no-store",
      },
    });
  }
  return Response.json(
    { done: job.done, total: job.total, ready: job.pdf !== null, error: job.error },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// the activity log (lib/audit.ts)
export const POST = audited("PDF report", POST_handler);
