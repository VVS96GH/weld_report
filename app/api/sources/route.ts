/**
 * `GET /api/sources`  — the Sources page: every refresh step with its files, the last load
 *                       and the running refresh with its time left (lib/sources-status.ts).
 * `POST /api/sources` — start a refresh: `{ "only": ["ccc", …] }` loads those steps (and what
 *                       they force), no body loads every changed file. Administrators only
 *                       (proxy.ts), same-origin only.
 */
import { audited } from "@/lib/audit";
import { checkSteps, refreshRunning, sameOrigin, startRefresh } from "@/lib/refresh-run";
import { sourcesStatus } from "@/lib/sources-status";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(await sourcesStatus(), { headers: { "cache-control": "no-store" } });
}

async function POST_handler(request: Request): Promise<Response> {
  if (!sameOrigin(request)) {
    return Response.json({ error: "cross-site request refused" }, { status: 403 });
  }
  let only: string[] | undefined;
  const text = await request.text();
  if (text.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return Response.json({ error: "the body is not JSON" }, { status: 400 });
    }
    const raw = (body as { only?: unknown } | null)?.only;
    if (raw !== undefined) {
      const c = checkSteps(raw);
      if (!c.ok) return Response.json({ error: c.error }, { status: 400 });
      only = c.ids;
    }
  }
  if (refreshRunning()) {
    return Response.json({ error: "a refresh is already running" }, { status: 409 });
  }
  startRefresh(only);
  return Response.json({ started: true, only: only ?? null }, { status: 202 });
}

// the activity log (lib/audit.ts)
export const POST = audited("Load sources", POST_handler);
