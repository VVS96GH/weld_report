/**
 * One command to bring the database in line with the files in `sources/`:
 *
 *   npm run db:refresh                 # reload only what changed, in dependency order
 *   npm run db:refresh -- --check      # show the plan, load nothing
 *   npm run db:refresh -- --all        # reload every source
 *   npm run db:refresh -- --only ccc,flange
 *   npm run db:refresh -- --baseline   # record the current files as "loaded", load nothing
 *   npm run db:refresh -- --no-restart # leave the `weld-report` service alone
 *
 * Why it is faster than running the fifteen `db:load:*` scripts by hand:
 *
 *  1. A step runs only when one of its input files differs from the copy that was
 *     loaded last (size + mtime as a shortcut, sha256 as the verdict), or when a
 *     step it depends on ran. The fingerprints live in `.data-refresh-state.json`
 *     (git-ignored — it describes this machine's database, not the code).
 *  2. Every weld loader refreshes the three joint-grain matviews (~50 s). Here the
 *     children run with WELD_DEFER_MATVIEW_REFRESH=1 and the views are refreshed
 *     ONCE, after the last step that can move them.
 *
 * A step is marked done only when its loader exits 0, and the steps it forces are
 * remembered as `pending` first — so a failed or interrupted run is resumed by
 * running the same command again.
 *
 * The order is the README's quick-start order. `forces` is what a reload leaves
 * stale in ANOTHER loader's output:
 *   - any reload of `weld` rows drops their `weld_length_m` (set by weld-length);
 *   - the CCC welder record takes its PWHT/NDE overlay from `ccc_joint_pwht`, so a
 *     new joint record means the welder record is loaded again;
 *   - the exclusion loader reads four joints' RT% out of the welder-record CSV.
 */
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { formatRefreshes, refreshMatviews, requireEnvUrl } from "./load-common";

interface Step {
  id: string;
  /** npm script that loads it. */
  script: string;
  /** Input files, relative to the repo root. */
  files: string[];
  /** Inputs the loader itself treats as optional. */
  optional?: string[];
  /** Steps that must run again once this one has. */
  forces?: string[];
  /** true when the step changes a table the joint matviews read. */
  matviews?: boolean;
  /** Runs after the single matview refresh (it reads `mv_joint`). */
  afterMatviews?: boolean;
  about: string;
}

const WELD_DUMP = process.env.WELD_DUMP_PATH ?? "sources/Weld Dump.txt";

const STEPS: Step[] = [
  { id: "weld-dump", script: "db:load", files: [WELD_DUMP],
    forces: ["weld-length"], matviews: true, about: "Weld Dump (GAC / TEKFEN / MEDGULF)" },
  { id: "snapshot", script: "db:seed:snapshot", files: [
      "sources/CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog .xlsx",
      "sources/CUM Trend RT% UT% RejRate/CUM Trend RT% UT% RejRate.xlsx",
      "sources/CUM Trend Active Welders/CUM Trend Active Welders.xlsx",
      "sources/CUM MPI Done .xlsx",
    ], about: "weekly trend workbooks" },
  { id: "spool", script: "db:load:spool", files: ["sources/Spool Dump.txt", "sources/Spool.csv"],
    matviews: true, about: "spool masters" },
  { id: "ccc-joints", script: "db:load:ccc-joints",
    files: ["sources/AllTrain_CSVExport_Joint Record.csv"],
    forces: ["ccc"], matviews: true, about: "CCC joint record" },
  { id: "ccc", script: "db:load:ccc", files: [
      "sources/CSVExport_Welder Record.csv",
      "sources/CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx",
    ], forces: ["weld-length", "exclusions"], matviews: true, about: "CCC welder record (~7 min)" },
  { id: "ut-ccc", script: "db:load:ut-ccc", files: ["sources/UT TRACKER (CCC)_Talisman.xlsx"],
    matviews: true, about: "CCC UT tracker + overlay" },
  { id: "exclusions", script: "db:load:exclusions", files: ["sources/TO BE EXLUDE FROM DATA.xlsx"],
    about: "exclusion list" },
  { id: "acciona", script: "db:load:acciona",
    files: ["sources/Acciona/Acciona_Latest Add to Query.xlsx"],
    forces: ["weld-length"], matviews: true, about: "Acciona" },
  { id: "inco", script: "db:load:inco", files: ["sources/Inco/Master Weld_Latest.xlsx"],
    forces: ["weld-length"], matviews: true, about: "Inco" },
  { id: "weld-length", script: "db:load:weld-length", files: [
      "sources/Weld Length/Weld Length.xlsx", "sources/Weld Length/Rework code.xlsx",
    ], matviews: true, about: "dia -> weld length, weld_length_m" },
  { id: "welders", script: "db:load:welders", files: [
      "sources/Welders/SCTR NFE WELDERS APPLIED.xls",
      "sources/Welders/Welders Power Q for PBI .xlsx",
    ], about: "welder registers" },
  { id: "ha-guide", script: "db:load:ha-guide", files: ["sources/l0_abs_guide.csv"],
    optional: ["sources/HA.csv"], matviews: true, about: "HA guide" },
  { id: "wps", script: "db:load:wps", files: [
      "sources/WPQ RECORD REGISTER/WPQ RECORD REGISTER.xlsx",
      "sources/WPQ RECORD REGISTER/CUM WPS Status.xlsx",
      "sources/WPQ RECORD REGISTER/WPS PWHT Status.xlsx",
    ], afterMatviews: true, about: "WPQ register" },
  { id: "flange", script: "db:load:flange",
    files: ["sources/Flange Progress.xlsx", "sources/ovAssets_1619.xlsx"],
    afterMatviews: true, about: "flange register" },
  { id: "talisman", script: "db:load:talisman", files: ["sources/Joint.csv"],
    afterMatviews: true, about: "Talisman joints" },
];

// ── state ───────────────────────────────────────────────────────────────────

interface Fingerprint { size: number; mtimeMs: number; sha256: string }
interface State {
  files: Record<string, Fingerprint>;
  /** Steps forced by an earlier step and not yet run. */
  pending: string[];
  /** A matview-moving step ran and the views have not been refreshed since. */
  matviewsStale: boolean;
  lastRun?: string;
}

const STATE_FILE = ".data-refresh-state.json";

function readState(): State {
  if (!existsSync(STATE_FILE)) return { files: {}, pending: [], matviewsStale: false };
  const s = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<State>;
  return { files: s.files ?? {}, pending: s.pending ?? [], matviewsStale: s.matviewsStale ?? false, lastRun: s.lastRun };
}

function writeState(s: State): void {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n");
}

function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file, { highWaterMark: 4 << 20 })
      .on("data", (c) => h.update(c))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}

type FileStatus = "same" | "changed" | "new" | "missing";
interface FileCheck { file: string; status: FileStatus; print: Fingerprint | null }

async function checkFile(file: string, state: State): Promise<FileCheck> {
  if (!existsSync(file)) return { file, status: "missing", print: null };
  const st = statSync(file);
  const old = state.files[file];
  if (old && old.size === st.size && old.mtimeMs === st.mtimeMs) {
    return { file, status: "same", print: old };
  }
  const print = { size: st.size, mtimeMs: st.mtimeMs, sha256: await sha256(file) };
  if (!old) return { file, status: "new", print };
  return { file, status: old.sha256 === print.sha256 ? "same" : "changed", print };
}

// ── helpers ─────────────────────────────────────────────────────────────────

const t0 = Date.now();
const fmtSecs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
};
const say = (msg: string) => console.log(`[refresh ${new Date().toTimeString().slice(0, 8)}] ${msg}`);
const mb = (n: number) => `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`;

function run(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", "--silent", script], {
      stdio: "inherit",
      env: { ...process.env, WELD_DEFER_MATVIEW_REFRESH: "1", WELD_REFRESH: "1" },
    });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    child.on("error", () => resolve(1));
  });
}

async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    return await fn(client);
  } finally {
    await client.end();
  }
}

function restartService(): void {
  const active = spawnSync("systemctl", ["--user", "is-active", "--quiet", "weld-report"]);
  if (active.status !== 0) {
    say("the weld-report service is not running — restart `npm run dev` / `npm run start` "
      + "yourself so the read cache is dropped");
    return;
  }
  // The read cache keys on the latest load id, which moves BEFORE the single
  // matview refresh — a page opened in between would be remembered stale. A
  // restart drops the cache, and serve.sh warms it again.
  const r = spawnSync("systemctl", ["--user", "restart", "weld-report"], { stdio: "inherit" });
  say(r.status === 0
    ? "weld-report restarted — it warms the cache itself (about a minute)"
    : "could not restart weld-report: run `systemctl --user restart weld-report`");
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const known = ["--check", "--all", "--baseline", "--no-restart", "--only"];
  const has = (f: string) => argv.includes(f);
  const onlyArg = has("--only") ? argv[argv.indexOf("--only") + 1] : undefined;
  for (const a of argv) {
    if (a.startsWith("--") && !known.includes(a)) throw new Error(`unknown flag ${a}`);
  }
  const only = onlyArg?.split(",").map((s) => s.trim()).filter(Boolean);
  if (has("--only") && !only?.length) throw new Error("--only needs a comma-separated list of steps");
  for (const id of only ?? []) {
    if (!STEPS.some((s) => s.id === id)) {
      throw new Error(`unknown step "${id}". Steps: ${STEPS.map((s) => s.id).join(", ")}`);
    }
  }

  const state = readState();

  // 1. fingerprint every input
  say("comparing sources/ with the last load…");
  const checks = new Map<string, FileCheck>();
  for (const step of STEPS) {
    for (const f of [...step.files, ...(step.optional ?? [])]) {
      if (!checks.has(f)) checks.set(f, await checkFile(f, state));
    }
  }

  if (has("--baseline")) {
    for (const c of checks.values()) if (c.print) state.files[c.file] = c.print;
    state.pending = [];
    state.matviewsStale = false;
    state.lastRun = new Date().toISOString();
    writeState(state);
    say(`baseline recorded for ${Object.keys(state.files).length} files — nothing was loaded`);
    return;
  }

  // An empty fact table means the state file describes another database.
  const weldRows = await withDb(async (c) =>
    Number((await c.query<{ n: string }>("SELECT count(*) AS n FROM (SELECT 1 FROM weld LIMIT 1) x")).rows[0].n));
  const forceAll = has("--all") || weldRows === 0;
  if (weldRows === 0 && !has("--all")) say("`weld` is empty — loading every source");

  // 2. plan
  const plan = new Map<string, string>(); // step id -> reason
  const skipped: string[] = [];
  for (const step of STEPS) {
    const mine = step.files.map((f) => checks.get(f)!);
    const opt = (step.optional ?? []).map((f) => checks.get(f)!);
    const missing = mine.filter((c) => c.status === "missing");
    const moved = [...mine, ...opt].filter((c) => c.status === "changed" || c.status === "new");
    if (only && !only.includes(step.id)) continue;
    if (missing.length > 0) {
      skipped.push(`${step.id}: missing ${missing.map((c) => path.basename(c.file)).join(", ")}`);
      continue;
    }
    if (only) plan.set(step.id, "asked for");
    else if (forceAll) plan.set(step.id, "full reload");
    else if (moved.length > 0) plan.set(step.id, `changed: ${moved.map((c) => path.basename(c.file)).join(", ")}`);
    else if (state.pending.includes(step.id)) plan.set(step.id, "pending from an earlier run");
  }
  // forced steps, in order (STEPS is topologically sorted, so one pass is enough)
  for (const step of STEPS) {
    if (!plan.has(step.id)) continue;
    for (const dep of step.forces ?? []) {
      const target = STEPS.find((s) => s.id === dep)!;
      if (plan.has(dep)) continue;
      if (target.files.some((f) => checks.get(f)!.status === "missing")) continue;
      plan.set(dep, `needed after ${step.id}`);
    }
  }

  console.log("");
  for (const step of STEPS) {
    const reason = plan.get(step.id);
    const size = step.files.reduce((n, f) => n + (checks.get(f)!.print?.size ?? 0), 0);
    console.log(`  ${reason ? "RUN " : "skip"}  ${step.id.padEnd(12)} ${step.about.padEnd(36)} `
      + `${mb(size).padStart(8)}  ${reason ?? ""}`);
  }
  for (const s of skipped) console.log(`  !!    ${s} — step skipped`);
  const order = STEPS.filter((s) => plan.has(s.id));
  const needMatviews = state.matviewsStale || order.some((s) => s.matviews);
  console.log("");

  if (order.length === 0 && !needMatviews) {
    say("nothing changed — the database already matches sources/");
    return;
  }
  if (has("--check")) {
    say(`plan only (--check): ${order.length} step(s)${needMatviews ? " + one matview refresh" : ""}`);
    return;
  }

  // 3. run
  const timings: [string, number][] = [];
  const runStep = async (step: Step): Promise<void> => {
    const t = Date.now();
    say(`▶ ${step.id} — ${plan.get(step.id)}`);
    // Remember the consequences BEFORE the loader touches anything: if it dies
    // halfway, the next run must still redo what it would have forced.
    for (const dep of step.forces ?? []) if (!state.pending.includes(dep)) state.pending.push(dep);
    if (!state.pending.includes(step.id)) state.pending.push(step.id);
    if (step.matviews) state.matviewsStale = true;
    writeState(state);

    const code = await run(step.script);
    if (code !== 0) {
      throw new Error(`step "${step.id}" failed (exit ${code}). Fix the file and run `
        + "`npm run db:refresh` again — it resumes from this step.");
    }
    for (const f of [...step.files, ...(step.optional ?? [])]) {
      const c = checks.get(f)!;
      if (c.print) state.files[f] = c.print;
    }
    state.pending = state.pending.filter((id) => id !== step.id);
    writeState(state);
    timings.push([step.id, Date.now() - t]);
    say(`✔ ${step.id} in ${fmtSecs(Date.now() - t)}`);
  };

  for (const step of order.filter((s) => !s.afterMatviews)) await runStep(step);

  if (needMatviews) {
    const t = Date.now();
    say("▶ matviews — one refresh for the whole run");
    const res = await withDb((c) => refreshMatviews(c));
    state.matviewsStale = false;
    writeState(state);
    timings.push(["matviews", Date.now() - t]);
    say(`✔ matviews: ${formatRefreshes(res)}`);
  }

  for (const step of order.filter((s) => s.afterMatviews)) await runStep(step);

  state.lastRun = new Date().toISOString();
  writeState(state);

  // 4. report
  // The same rule as lib/db.ts withAsOf(): welds dated after the load are typos.
  const dates = await withDb(async (c) => (await c.query<{ d: string | null; future: string }>(
    `SELECT max(weld_date) FILTER (WHERE weld_date <= l.day)::text AS d,
            count(*) FILTER (WHERE weld_date > l.day)::text AS future
       FROM weld, (SELECT coalesce(max(started_at)::date, current_date) AS day FROM load) l`)).rows[0]);
  const asOf = dates.d;
  console.log("");
  for (const [id, ms] of timings) console.log(`  ${id.padEnd(12)} ${fmtSecs(ms).padStart(12)}`);
  console.log(`  ${"total".padEnd(12)} ${fmtSecs(Date.now() - t0).padStart(12)}`);
  console.log("");
  say(`done — report date (max weld date) is now ${asOf ?? "unknown"}`);
  if (Number(dates.future) > 0) {
    say(`note: ${dates.future} weld row(s) are dated AFTER the load — a typo in the source; `
      + "they do not move the report date");
  }
  if (!has("--no-restart")) restartService();
}

main().catch((err) => {
  console.error(`\n[refresh] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
