import type { NextRequest } from "next/server";

import { changePassword } from "@/lib/auth";
import { requestUser, unauthorized } from "@/lib/auth-request";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

/** POST {current, new}: change my own password. */
async function POST_handler(req: NextRequest): Promise<Response> {
  const u = await requestUser(req);
  if (!u) return unauthorized();
  const b = (await req.json().catch(() => null)) as { current?: unknown; new?: unknown } | null;
  const err = await changePassword(u, String(b?.current ?? ""), String(b?.new ?? ""));
  return err ? Response.json({ error: err }, { status: 400 }) : new Response(null, { status: 204 });
}

// the activity log (lib/audit.ts)
export const POST = audited("Changed own password", POST_handler);
