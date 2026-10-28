import type { NextRequest } from "next/server";

import { addUser, listUsers } from "@/lib/auth";
import { forbidden, requestUser, unauthorized } from "@/lib/auth-request";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const me = await requestUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  return Response.json({ users: await listUsers() }, { headers: { "Cache-Control": "no-store" } });
}

/** POST {email, name?, role?, password?}: without a password a temporary one is made and returned once. */
export async function POST(req: NextRequest): Promise<Response> {
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
