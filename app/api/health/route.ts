/**
 * `GET /api/health` — is the site up and its database reachable.
 *
 * Open without sign-in (scripts/serve.sh waits on it), so it says nothing else: no database
 * address, user, load or source file (owner, 2026-11-11: protect the site from copying).
 */

import { ping } from "@/lib/db";

export async function GET(): Promise<Response> {
  try {
    await ping();
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
