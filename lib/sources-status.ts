/**
 * The Sources page (owner request 2026-11-08): each refresh step with its files, whether a file
 * is newer than the copy loaded last, the rows the last load wrote, and the running refresh.
 *
 * "New version" compares size + modified time with `.data-refresh-state.json`, the shortcut
 * the refresh itself takes first; the refresh then checks the sha256, so a file only touched
 * (same content) is listed as new here and skipped by the refresh.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { getPool } from "./db";
import { readProgress, viewProgress, type ProgressView } from "./refresh-progress";
import { STEPS } from "./refresh-steps";

const STATE_FILE = ".data-refresh-state.json";

interface Fingerprint {
  size: number;
  mtimeMs: number;
}

interface RefreshState {
  files?: Record<string, Fingerprint>;
  pending?: string[];
  durations?: Record<string, number>;
  lastRun?: string;
}

export type FileState = "loaded" | "new" | "missing" | "optional-missing";

export interface SourceFileOut {
  file: string;
  name: string;
  size: number | null;
  modifiedAt: string | null;
  state: FileState;
}

export interface SourceLoadOut {
  source: string;
  loadId: number;
  startedAt: string;
  finishedAt: string | null;
  rows: number;
}

export interface SourceStepOut {
  id: string;
  title: string;
  files: SourceFileOut[];
  /** A file is newer than the loaded copy, or the step waits from an interrupted run. */
  changed: boolean;
  pending: boolean;
  missing: boolean;
  lastLoad: SourceLoadOut | null;
  lastSeconds: number | null;
  /** Steps a load of this one runs too (they read its output). */
  forces: string[];
}

export interface SourcesOut {
  steps: SourceStepOut[];
  lastRun: string | null;
  progress: ProgressView;
}

export function readRefreshState(root = process.cwd()): RefreshState {
  try {
    return JSON.parse(readFileSync(path.join(root, STATE_FILE), "utf8")) as RefreshState;
  } catch {
    return {};
  }
}

function fileOut(file: string, state: RefreshState, optional: boolean): SourceFileOut {
  const name = path.basename(file);
  if (!existsSync(file)) {
    return { file, name, size: null, modifiedAt: null, state: optional ? "optional-missing" : "missing" };
  }
  const st = statSync(file);
  const old = state.files?.[file];
  const same = old !== undefined && old.size === st.size && old.mtimeMs === st.mtimeMs;
  return { file, name, size: st.size, modifiedAt: st.mtime.toISOString(), state: same ? "loaded" : "new" };
}

async function lastLoads(): Promise<Map<string, SourceLoadOut>> {
  const out = new Map<string, SourceLoadOut>();
  try {
    const r = await getPool().query<{
      source: string; id: string; started_at: Date; finished_at: Date | null; records_loaded: string;
    }>(
      `SELECT DISTINCT ON (source) source, id, started_at, finished_at, records_loaded
         FROM load ORDER BY source, id DESC`,
    );
    for (const x of r.rows) {
      out.set(x.source, {
        source: x.source,
        loadId: Number(x.id),
        startedAt: x.started_at.toISOString(),
        finishedAt: x.finished_at ? x.finished_at.toISOString() : null,
        rows: Number(x.records_loaded),
      });
    }
  } catch {
    // no database: the files are still listed
  }
  return out;
}

export async function sourcesStatus(): Promise<SourcesOut> {
  const state = readRefreshState();
  const loads = await lastLoads();
  const durations = state.durations ?? {};
  const steps = STEPS.map((s): SourceStepOut => {
    const files = [
      ...s.files.map((f) => fileOut(f, state, false)),
      ...(s.optional ?? []).map((f) => fileOut(f, state, true)),
    ];
    // the newest load among the sources the step writes
    const mine = s.loads.map((l) => loads.get(l)).filter((x): x is SourceLoadOut => !!x);
    const last = mine.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
    const first = s.loads.length ? loads.get(s.loads[0]) : undefined;
    return {
      id: s.id,
      title: s.title,
      files,
      changed: files.some((f) => f.state === "new"),
      pending: (state.pending ?? []).includes(s.id),
      missing: files.some((f) => f.state === "missing"),
      // rows: the step's main table; time: its newest load
      lastLoad: last ? { ...last, rows: first?.rows ?? last.rows } : null,
      lastSeconds: durations[s.id] !== undefined ? Math.round(durations[s.id] / 1000) : null,
      forces: s.forces ?? [],
    };
  });
  return {
    steps,
    lastRun: state.lastRun ?? null,
    progress: viewProgress(readProgress(), durations),
  };
}
