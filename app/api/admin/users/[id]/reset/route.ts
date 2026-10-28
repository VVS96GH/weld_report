import type { NextRequest } from "next/server";

import { resetPassword } from "@/lib/auth";
import { forbidden, requestUser, unauthorized } from "@/lib/auth-request";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

/** POST: a new temporary password, returned once; the user is signed out everywhere. */
async function POST_handler(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]/reset">): Promise<Response> {
  const me = await requestUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const id = Number((await ctx.params).id);
  const pw = Number.isInteger(id) ? await resetPassword(id) : null;
  return pw ? Response.json({ password: pw }) : Response.json({ error: `No user ${id}` }, { status: 404 });
}

// the activity log (lib/audit.ts)
export const POST = audited("Reset a password", POST_handler);
