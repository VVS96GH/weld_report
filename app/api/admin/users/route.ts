import type { NextRequest } from "next/server";

import { addUser, listUsers } from "@/lib/auth";
import { forbidden, requestUser, unauthorized } from "@/lib/auth-request";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const me = await requestUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  return Response.json({ users: await listUsers() }, { headers: { "Cache-Control": "no-store" } });
}

/** POST {email, name?, role?, password?}: without a password a temporary one is made and returned once. */
async function POST_handler(req: NextRequest): Promise<Response> {
  const me = await requestUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await addUser({
    email: String(b?.email ?? ""),
    name: typeof b?.name === "string" ? b.name : "",
    role: b?.role === "admin" ? "admin" : "user",
    password: typeof b?.password === "string" && b.password ? b.password : null,
  });
  return "error" in r ? Response.json({ error: r.error }, { status: r.status }) : Response.json(r);
}

// the activity log (lib/audit.ts)
export const POST = audited("Added a user", POST_handler);
