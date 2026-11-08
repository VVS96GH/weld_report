/**
 * The live state of a data refresh, for the Sources page timer (owner request 2026-11-08).
 *
 * scripts/refresh-data.ts writes `.data-refresh-progress.json` when it has its plan, when each
 * step starts and ends, and when it finishes — however it was started (the header button, the
 * Sources page or `npm run db:refresh` in a terminal). The page reads it back and estimates the
 * time left from how long each step took last time (`durations` in .data-refresh-state.json).
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PROGRESS_FILE = ".data-refresh-progress.json";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface ProgressStep {
  id: string;
  title: string;
  reason: string;
  status: StepStatus;
  startedAt?: number;
  finishedAt?: number;
}

export interface Progress {
  pid: number;
  startedAt: number;
  finishedAt: number | null;
  /** null while it runs; false when a step failed. */
  ok: boolean | null;
  error: string | null;
  steps: ProgressStep[];
}

// ── writer (the refresh script) ────────────────────────────────────────────

let current: Progress | null = null;

function save(): void {
  if (!current) return;
  try {
    // write aside and rename: the page never reads half a file
    const tmp = `${PROGRESS_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(current));
    renameSync(tmp, PROGRESS_FILE);
  } catch {
    // the timer must never break a refresh
  }
}

export function progressStart(steps: { id: string; title: string; reason: string }[]): void {
  current = {
    pid: process.pid,
    startedAt: Date.now(),
    finishedAt: null,
    ok: null,
    error: null,
    steps: steps.map((s) => ({ ...s, status: "pending" })),
  };
  save();
}

export function progressStep(id: string, status: "running" | "done" | "failed"): void {
  const s = current?.steps.find((x) => x.id === id);
  if (!s) return;
  s.status = status;
  if (status === "running") s.startedAt = Date.now();
  else s.finishedAt = Date.now();
  save();
}

export function progressEnd(ok: boolean, error: string | null = null): void {
  if (!current) return;
  for (const s of current.steps) {
    if (s.status === "pending" || s.status === "running") s.status = s.status === "running" ? "failed" : "skipped";
  }
  current.finishedAt = Date.now();
  current.ok = ok;
  current.error = error;
  save();
}

// ── reader (the app) ───────────────────────────────────────────────────────

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The last refresh's progress; a run whose process died without finishing counts as failed. */
export function readProgress(root = process.cwd()): Progress | null {
  const file = path.join(root, PROGRESS_FILE);
  if (!existsSync(file)) return null;
  try {
    const p = JSON.parse(readFileSync(file, "utf8")) as Progress;
    if (p.finishedAt === null && !alive(p.pid)) {
      return { ...p, finishedAt: p.startedAt, ok: false, error: "the refresh process stopped without finishing" };
    }
    return p;
  } catch {
    return null;
  }
}

/** Typical seconds of a step never timed (lib/refresh-eta.ts has the same table). */
const DEFAULT_STEP_S = 60;
const RESTART_S = 60;

export interface ProgressView {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  ok: boolean | null;
  error: string | null;
  elapsedSeconds: number | null;
  remainingSeconds: number | null;
  current: string | null;
  steps: (ProgressStep & { seconds: number | null; estimateSeconds: number })[];
}

export function viewProgress(p: Progress | null, durationsMs: Record<string, number>, now = Date.now()): ProgressView {
  if (!p) {
    return {
      running: false, startedAt: null, finishedAt: null, ok: null, error: null,
      elapsedSeconds: null, remainingSeconds: null, current: null, steps: [],
    };
  }
  const running = p.finishedAt === null;
  const est = (id: string) => (durationsMs[id] !== undefined ? durationsMs[id] / 1000 : DEFAULT_STEP_S);
  let left = 0;
  let current: string | null = null;
  const steps = p.steps.map((s) => {
    const e = est(s.id);
    if (s.status === "pending") left += e;
    if (s.status === "running") {
      const spent = (now - (s.startedAt ?? now)) / 1000;
      left += Math.max(5, e - spent);
      current ??= s.title;
    }
    const seconds = s.startedAt ? ((s.finishedAt ?? now) - s.startedAt) / 1000 : null;
    return { ...s, seconds: seconds === null ? null : Math.round(seconds), estimateSeconds: Math.round(e) };
  });
  if (running) left += RESTART_S;
  return {
    running,
    startedAt: new Date(p.startedAt).toISOString(),
    finishedAt: p.finishedAt ? new Date(p.finishedAt).toISOString() : null,
    ok: p.ok,
    error: p.error,
    elapsedSeconds: Math.round(((p.finishedAt ?? now) - p.startedAt) / 1000),
    remainingSeconds: running ? Math.round(left) : null,
    current,
    steps,
  };
}
