import type { NextRequest } from "next/server";

import { requestUser, unauthorized } from "@/lib/auth-request";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const u = await requestUser(req);
  return u ? Response.json(u, { headers: { "Cache-Control": "no-store" } }) : unauthorized();
}
