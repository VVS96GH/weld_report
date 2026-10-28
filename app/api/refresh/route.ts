/**
 * `GET /api/refresh`  — is a data refresh running, and the tail of its log.
 * `POST /api/refresh` — start `npm run db:refresh` (owner request 2026-10-14:
 *                       the header's refresh button, after a "yes" in a dialog).
 *
 * The refresh runs as its own transient systemd user unit, not as a child of
 * this server: its last step restarts the `weld-report` service (to drop the
 * read cache), and a child would be killed with the service's cgroup. Without
 * systemd (a bare `npm run dev`) it falls back to a detached process.
 *
 * Only `db:refresh` itself can be started — no parameter reaches the command
 * line. A cross-site POST is refused (Sec-Fetch-Site / Origin), so another web
 * page open in the same browser cannot trigger a reload. The report has no
 * login: anyone who can open it can press the button, which is acceptable while
 * it is served on this machine only.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { estimateRefresh } from "@/lib/refresh-eta";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const LOG = path.join(ROOT, ".data-refresh.log");
const PID = path.join(ROOT, ".data-refresh.pid");
const STATE = path.join(ROOT, ".data-refresh-state.json");
const UNIT = "weld-data-refresh";

const SCRIPT =
  `cd ${JSON.stringify(ROOT)} && ` +
  `{ [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null; } ; ` +
  `export PATH="$HOME/.local/bin:$PATH"; ` +
  `echo "[refresh] started $(date '+%F %T')" > .data-refresh.log; ` +
  `npm run --silent db:refresh >> .data-refresh.log 2>&1; ` +
  `echo "exit=$?" >> .data-refresh.log`;

function unitActive(): boolean {
  const r = spawnSync("systemctl", ["--user", "is-active", "--quiet", UNIT]);
  return r.status === 0;
}

function pidAlive(): boolean {
  if (!existsSync(PID)) return false;
  const pid = Number(readFileSync(PID, "utf8"));
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function status() {
  const running = unitActive() || pidAlive();
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
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const sameOrigin =
    site === "same-origin" || (origin !== null && host !== null && new URL(origin).host === host);
  if (!sameOrigin) {
    return Response.json({ error: "cross-site request refused" }, { status: 403 });
  }
  if (unitActive() || pidAlive()) {
    return Response.json({ ...status(), started: false, error: "a refresh is already running" }, { status: 409 });
  }

  const viaSystemd = spawnSync(
    "systemd-run",
    ["--user", `--unit=${UNIT}`, "--collect", "--quiet", `--working-directory=${ROOT}`, "/bin/bash", "-c", SCRIPT],
    { encoding: "utf8" },
  );
  if (viaSystemd.status !== 0) {
    // No systemd user manager: a detached process, tracked by its pid.
    const child = spawn("/bin/bash", ["-c", SCRIPT], { cwd: ROOT, detached: true, stdio: "ignore" });
    if (child.pid) writeFileSync(PID, String(child.pid));
    child.unref();
  }
  return Response.json({ ...status(), running: true, started: true }, { status: 202 });
}

// the activity log (lib/audit.ts)
export const POST = audited("Refresh data", POST_handler);
