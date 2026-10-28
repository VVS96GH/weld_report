import type { NextRequest } from "next/server";

import { updateUser } from "@/lib/auth";
import { forbidden, requestUser, unauthorized } from "@/lib/auth-request";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

/** PATCH {name?, role?, active?}. */
async function PATCH_handler(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">): Promise<Response> {
  const me = await requestUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "bad id" }, { status: 400 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await updateUser(me, id, {
    name: typeof b?.name === "string" ? b.name : undefined,
    role: b?.role === "admin" || b?.role === "user" ? b.role : undefined,
    active: typeof b?.active === "boolean" ? b.active : undefined,
  });
  return "error" in r ? Response.json({ error: r.error }, { status: r.status }) : Response.json(r.user);
}

// the activity log (lib/audit.ts)
export const PATCH = audited("Changed a user", PATCH_handler);
