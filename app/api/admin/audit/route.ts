import type { NextRequest } from "next/server";

import { recentEvents } from "@/lib/audit";
import { forbidden, requestUser, unauthorized } from "@/lib/auth-request";

export const dynamic = "force-dynamic";

/** The activity log, newest first (administrators only). */
export async function GET(req: NextRequest): Promise<Response> {
  const me = await requestUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const limit = Math.min(2000, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 500) || 500));
  return Response.json({ events: await recentEvents(limit) }, { headers: { "Cache-Control": "no-store" } });
}
