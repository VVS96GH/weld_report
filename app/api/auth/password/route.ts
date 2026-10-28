import type { NextRequest } from "next/server";

import { changePassword } from "@/lib/auth";
import { requestUser, unauthorized } from "@/lib/auth-request";

export const dynamic = "force-dynamic";

/** POST {current, new}: change my own password. */
export async function POST(req: NextRequest): Promise<Response> {
  const u = await requestUser(req);
  if (!u) return unauthorized();
  const b = (await req.json().catch(() => null)) as { current?: unknown; new?: unknown } | null;
  const err = await changePassword(u, String(b?.current ?? ""), String(b?.new ?? ""));
  return err ? Response.json({ error: err }, { status: 400 }) : new Response(null, { status: 204 });
}
