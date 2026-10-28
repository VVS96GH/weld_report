import type { NextRequest } from "next/server";

import { resetPassword } from "@/lib/auth";
import { forbidden, requestUser, unauthorized } from "@/lib/auth-request";

export const dynamic = "force-dynamic";

/** POST: a new temporary password, returned once; the user is signed out everywhere. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]/reset">): Promise<Response> {
  const me = await requestUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const id = Number((await ctx.params).id);
  const pw = Number.isInteger(id) ? await resetPassword(id) : null;
  return pw ? Response.json({ password: pw }) : Response.json({ error: `No user ${id}` }, { status: 404 });
}
