import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, logout } from "@/lib/auth";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

async function POST_handler(req: NextRequest): Promise<Response> {
  await logout(req.cookies.get(SESSION_COOKIE)?.value);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

// the activity log (lib/audit.ts)
export const POST = audited("Sign out", POST_handler);
