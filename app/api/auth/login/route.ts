import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, login } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST {email, password}: sets the session cookie. */
export async function POST(req: NextRequest): Promise<Response> {
  const b = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof b?.email === "string" ? b.email : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!email || !password) return Response.json({ error: "E-mail and password, please" }, { status: 400 });
  const r = await login(email, password);
  if (!r.ok) return Response.json({ error: r.message }, { status: 401 });
  const res = NextResponse.json(r.user);
  res.cookies.set(SESSION_COOKIE, r.token, { httpOnly: true, sameSite: "lax", path: "/", expires: r.expires, secure: false });
  return res;
}
