/**
 * Starting `npm run db:refresh` from the app (the header button, the Sources page).
 *
 * The refresh runs as its own transient systemd user unit, not as a child of this server: its
 * last step restarts the `weld-report` service (to drop the read cache), and a child would be
 * killed with the service's cgroup. Without systemd (a bare `npm run dev`) it falls back to a
 * detached process. Only `db:refresh` can be started, with `--only` limited to known step ids.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readProgress } from "./refresh-progress";
import { STEPS } from "./refresh-steps";

const ROOT = process.cwd();
export const REFRESH_LOG = path.join(ROOT, ".data-refresh.log");
const PID = path.join(ROOT, ".data-refresh.pid");
const UNIT = "weld-data-refresh";

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

/** A refresh runs: started here, or in a terminal (it writes its progress file). */
export function refreshRunning(): boolean {
  return unitActive() || pidAlive() || readProgress()?.finishedAt === null;
}

/** Step ids for `--only`, or an error naming the unknown ones. */
export function checkSteps(ids: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "no steps" };
  const known = new Set(STEPS.map((s) => s.id));
  const bad = ids.filter((x) => typeof x !== "string" || !known.has(x));
  if (bad.length) return { ok: false, error: `unknown step(s): ${bad.join(", ")}` };
  return { ok: true, ids: [...new Set(ids as string[])] };
}

export function startRefresh(only?: string[]): void {
  // the ids were checked against STEPS: letters, digits and '-' only
  const arg = only?.length ? ` -- --only ${only.join(",")}` : "";
  const script =
    `cd ${JSON.stringify(ROOT)} && ` +
    `{ [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null; } ; ` +
    `export PATH="$HOME/.local/bin:$PATH"; ` +
    `echo "[refresh] started $(date '+%F %T')" > .data-refresh.log; ` +
    `npm run --silent db:refresh${arg} >> .data-refresh.log 2>&1; ` +
    `echo "exit=$?" >> .data-refresh.log`;
  const viaSystemd = spawnSync(
    "systemd-run",
    ["--user", `--unit=${UNIT}`, "--collect", "--quiet", `--working-directory=${ROOT}`, "/bin/bash", "-c", script],
    { encoding: "utf8" },
  );
  if (viaSystemd.status !== 0) {
    // No systemd user manager: a detached process, tracked by its pid.
    const child = spawn("/bin/bash", ["-c", script], { cwd: ROOT, detached: true, stdio: "ignore" });
    if (child.pid) writeFileSync(PID, String(child.pid));
    child.unref();
  }
}

/** A cross-site POST is refused: another page open in the browser cannot start a reload. */
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return site === "same-origin" || (origin !== null && host !== null && new URL(origin).host === host);
}
