/**
 * `GET /api/refresh`  — is a data refresh running, and the tail of its log.
 * `POST /api/refresh` — start `npm run db:refresh` (owner request 2026-10-14:
 *                       the header's refresh button, after a "yes" in a dialog).
 *
 * Starting it: lib/refresh-run.ts (a transient systemd unit, same-origin only;
 * administrators only, proxy.ts).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { estimateRefresh } from "@/lib/refresh-eta";
import { REFRESH_LOG, refreshRunning, sameOrigin, startRefresh } from "@/lib/refresh-run";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

const LOG = REFRESH_LOG;
const STATE = path.join(process.cwd(), ".data-refresh-state.json");

function status() {
  const running = refreshRunning();
  let log = "";
  let full = "";
  let finishedAt: string | null = null;
  if (existsSync(LOG)) {
    full = readFileSync(LOG, "utf8");
    const lines = full.split("\n").filter((l) => l.trim() !== "");
    log = lines.slice(-25).join("\n");
    finishedAt = statSync(LOG).mtime.toISOString();
  }
  let durations: Record<string, number> = {};
  try {
    durations = (JSON.parse(readFileSync(STATE, "utf8")) as { durations?: Record<string, number> }).durations ?? {};
  } catch {
    // no state yet: typical durations
  }
  const m = /(?:^|\n)exit=(\d+)\s*$/.exec(log);
  return {
    running,
    exitCode: running || !m ? null : Number(m[1]),
    finishedAt: running ? null : finishedAt,
    log,
    eta: running ? estimateRefresh(full, durations, new Date()) : null,
  };
}

export async function GET(): Promise<Response> {
  return Response.json(status());
}

async function POST_handler(request: Request): Promise<Response> {
  if (!sameOrigin(request)) {
    return Response.json({ error: "cross-site request refused" }, { status: 403 });
  }
  if (refreshRunning()) {
    return Response.json({ ...status(), started: false, error: "a refresh is already running" }, { status: 409 });
  }
  startRefresh();
  return Response.json({ ...status(), running: true, started: true }, { status: 202 });
}

// the activity log (lib/audit.ts)
export const POST = audited("Refresh data", POST_handler);
