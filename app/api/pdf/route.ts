/**
 * GET ?path=/welding/1?ha=…&theme=dark&mood=ten&density=… — the page as a PDF
 * (lib/page-pdf.ts), for the header's PDF button.
 */
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { pagePdf } from "@/lib/page-pdf";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAFE = /^[\w-]{0,32}$/;

async function GET_handler(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const path = sp.get("path") ?? "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/api")) {
    return Response.json({ error: "bad path" }, { status: 400 });
  }
  const pick = (k: string) => {
    const v = sp.get(k) ?? "";
    return SAFE.test(v) ? v : "";
  };
  try {
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    const { pdf, title } = await pagePdf({ path, theme: pick("theme"), mood: pick("mood"), density: pick("density"), session });
    const name = `${title || "Welding report"} - ${new Date().toISOString().slice(0, 10)}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// the activity log (lib/audit.ts)
export const GET = audited("Downloaded a PDF", GET_handler);
