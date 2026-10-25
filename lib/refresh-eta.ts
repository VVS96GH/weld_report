/**
 * Time left of a running data refresh (owner request 2026-10-25), read from its log.
 *
 * The log lists the plan ("  RUN   <step>"), then "[refresh HH:MM:SS] ▶ <step>" when a
 * step starts and "✔ <step> in …" when it ends. Each step is expected to take as long
 * as it took last time (`durations` in .data-refresh-state.json, written by
 * scripts/refresh-data.ts); a step never timed yet takes its typical duration below,
 * taken from the `load` table history (median, rounded up for the step's overhead).
 */

/** Seconds; the step ids of scripts/refresh-data.ts. */
const TYPICAL_S: Record<string, number> = {
  "weld-dump": 330,
  snapshot: 15,
  spool: 60,
  "ccc-joints": 200,
  ccc: 650,
  "ut-ccc": 40,
  "ut-trackers": 20,
  exclusions: 20,
  acciona: 90,
  inco: 120,
  "weld-length": 360,
  welders: 90,
  "ha-guide": 10,
  wps: 15,
  "welder-cum": 15,
  flange: 40,
  "flange-breakdown": 10,
  talisman: 40,
  matviews: 300,
};
const DEFAULT_STEP_S = 60;
/** The report restarts and warms its cache at the end. */
const RESTART_S = 60;

export type RefreshEta = {
  /** Seconds left, never below 0; null when it cannot be told. */
  secondsLeft: number | null;
  stepIndex: number;
  steps: number;
  current: string | null;
};

const TIME = /^\[refresh (\d\d):(\d\d):(\d\d)\]/;

function secondsOfDay(h: string, m: string, s: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function estimateRefresh(log: string, durationsMs: Record<string, number>, now: Date): RefreshEta {
  const lines = log.split("\n");
  const plan = lines.map((l) => /^\s+RUN\s+(\S+)/.exec(l)?.[1]).filter((x): x is string => !!x);
  if (plan.length === 0) return { secondsLeft: null, stepIndex: 0, steps: 0, current: null };
  const steps = [...plan, "matviews"];
  const expect = (id: string) =>
    durationsMs[id] !== undefined ? durationsMs[id] / 1000 : (TYPICAL_S[id] ?? DEFAULT_STEP_S);

  const done = new Set<string>();
  let current: string | null = null;
  let currentStart: number | null = null;
  for (const l of lines) {
    const started = /▶ (\S+)/.exec(l);
    if (started) {
      current = started[1];
      const t = TIME.exec(l);
      currentStart = t ? secondsOfDay(t[1], t[2], t[3]) : null;
    }
    const ended = /✔ (\S+?)[:\s]/.exec(l);
    if (ended) {
      done.add(ended[1]);
      if (ended[1] === current) current = null;
    }
  }

  let left = RESTART_S;
  for (const id of steps) if (!done.has(id) && id !== current) left += expect(id);
  if (current) {
    let elapsed = 0;
    if (currentStart !== null) {
      const nowS = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      elapsed = (nowS - currentStart + 86400) % 86400;
    }
    // a step running longer than expected is assumed to be nearly done
    left += Math.max(expect(current) - elapsed, 15);
  }
  const stepIndex = Math.min(done.size + (current ? 1 : 0), steps.length);
  return { secondsLeft: Math.round(left), stepIndex, steps: steps.length, current };
}
