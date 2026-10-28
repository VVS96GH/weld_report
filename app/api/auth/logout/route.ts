import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, logout } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  await logout(req.cookies.get(SESSION_COOKIE)?.value);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
