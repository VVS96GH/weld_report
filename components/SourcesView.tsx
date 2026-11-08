"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

import { useIsAdmin } from "@/lib/me";
import type { ProgressView } from "@/lib/refresh-progress";
import type { SourcesOut, SourceStepOut } from "@/lib/sources-status";

const POLL_RUNNING_MS = 4000;
const POLL_IDLE_MS = 20000;
const SHOW_FINISHED_MS = 6 * 3600 * 1000;

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const fmtMb = (n: number | null) => (n === null ? "" : `${(n / 2 ** 20).toFixed(n < 10 * 2 ** 20 ? 1 : 0)} MB`);
const fmtInt = (n: number) => n.toLocaleString("en-US");
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
const minutes = (sec: number) => (sec < 60 ? `${Math.round(sec)} s` : `${Math.round(sec / 60)} min`);

/** The source files, their loads, a Load button each and the running refresh with its time left. */
export function SourcesView({ initial }: { initial: SourcesOut }) {
  const admin = useIsAdmin();
  const [data, setData] = useState(initial);
  const [at, setAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = data.progress.running;

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/sources", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as SourcesOut;
      const t = Date.now();
      setData(d);
      setAt(t);
      setNow(t);
    } catch {
      // the server restarts at the end of a refresh: the next poll gets through
    }
  }, []);

  useEffect(() => {
    const t = setInterval(reload, running ? POLL_RUNNING_MS : POLL_IDLE_MS);
    return () => clearInterval(t);
  }, [running, reload]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const start = async (only?: string[], label?: string) => {
    if (!window.confirm(only ? `Load ${label}?` : "Load every changed source?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(only ? { only } : {}),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) setMsg(j.error ?? `Could not start (HTTP ${r.status})`);
      // the refresh writes its plan within a few seconds
      setTimeout(reload, 1500);
      setTimeout(reload, 4000);
    } finally {
      setBusy(false);
    }
  };

  const changed = data.steps.filter((s) => (s.changed || s.pending) && !s.missing);
  const runningIds = new Set(
    running ? data.progress.steps.filter((s) => s.status === "pending" || s.status === "running").map((s) => s.id) : [],
  );

  return (
    <div className="src-page">
      <div className="src-head">
        <div>
          <h1 className="src-title">Sources</h1>
          <p className="src-note">
            The files in <code>sources/</code> and their loads. &quot;New version&quot; compares size and date with the
            copy loaded last; a file with the same content is skipped by the load.
            {data.lastRun ? ` Last refresh ${fmtDate(data.lastRun)}.` : ""}
          </p>
        </div>
        <div className="src-actions">
          <Timer p={data.progress} at={at} now={now} />
          {admin ? (
            <button
              type="button"
              className="src-btn src-btn-all"
              disabled={busy || running || changed.length === 0}
              title={changed.length ? changed.map((s) => s.title).join("\n") : "Every source is loaded"}
              onClick={() => start(undefined)}
            >
              Load all changed{changed.length ? ` (${changed.length})` : ""}
            </button>
          ) : null}
        </div>
      </div>
      {msg ? <p className="src-msg">{msg}</p> : null}

      <div className="src-scroll">
        <table className="src-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>File</th>
              <th>Modified</th>
              <th className="num">In database</th>
              <th>Last load</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.steps.map((s) => (
              <Row
                key={s.id}
                s={s}
                admin={admin}
                disabled={busy || running || s.missing}
                inRun={runningIds.has(s.id)}
                onLoad={() => start([s.id], s.title)}
                titles={Object.fromEntries(data.steps.map((x) => [x.id, x.title]))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  s,
  admin,
  disabled,
  inRun,
  onLoad,
  titles,
}: {
  s: SourceStepOut;
  admin: boolean;
  disabled: boolean;
  inRun: boolean;
  onLoad: () => void;
  titles: Record<string, string>;
}) {
  const files = s.files.filter((f) => f.state !== "optional-missing");
  return (
    <tr className={inRun ? "is-run" : undefined}>
      <td>
        <div className="src-name">{s.title}</div>
        <div className="src-sub">
          {[
            s.lastSeconds !== null ? `load takes ~${minutes(s.lastSeconds)}` : "",
            s.forces.length ? `then reloads ${s.forces.map((f) => titles[f] ?? f).join(", ")}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </td>
      <td>
        {files.map((f) => (
          <div key={f.file} className="src-file" title={f.file}>
            {f.state === "missing" ? <span className="src-bad">{f.name} — no file</span> : f.name}
            {f.size !== null ? <span className="src-sub"> {fmtMb(f.size)}</span> : null}
          </div>
        ))}
      </td>
      <td>
        {files.map((f) => (
          <div key={f.file} className="src-file">
            {fmtDate(f.modifiedAt)}
            {f.state === "new" ? <span className="src-new"> new version, not loaded</span> : null}
          </div>
        ))}
        {s.pending && !s.changed ? <div className="src-new">waiting from an interrupted refresh</div> : null}
      </td>
      <td className="num">
        {s.lastLoad ? (
          <>
            <div>{s.lastLoad.rows > 0 ? `${fmtInt(s.lastLoad.rows)} rows` : "updated in place"}</div>
            <div className="src-sub">load #{s.lastLoad.loadId}</div>
          </>
        ) : (
          <span className="src-sub">—</span>
        )}
      </td>
      <td>
        {inRun ? (
          <span className="src-badge is-run">in this refresh</span>
        ) : s.lastLoad ? (
          <span className={`src-badge ${s.changed ? "is-old" : "is-ok"}`}>{s.changed ? "older file" : "loaded"}</span>
        ) : null}
        <div className="src-sub">{s.lastLoad ? fmtDate(s.lastLoad.startedAt) : ""}</div>
      </td>
      <td className="src-load">
        {admin ? (
          <button type="button" className="src-btn" disabled={disabled} onClick={onLoad}>
            Load
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function Timer({ p, at, now }: { p: ProgressView; at: number; now: number }) {
  if (!p.startedAt) return null;
  if (!p.running) {
    const end = p.finishedAt ? new Date(p.finishedAt).getTime() : 0;
    if (!end || now - end > SHOW_FINISHED_MS) return null;
    return (
      <div className={`src-last ${p.ok === false ? "is-bad" : ""}`} title={p.error ?? undefined}>
        <span className="src-dot" />
        {p.ok === false ? "Last refresh failed" : "Last refresh finished"} {hhmm(end)} · took{" "}
        {minutes(p.elapsedSeconds ?? 0)}
      </div>
    );
  }
  const passed = (now - at) / 1000;
  const left = Math.max(0, (p.remainingSeconds ?? 0) - passed);
  const elapsed = (p.elapsedSeconds ?? 0) + passed;
  const pct = elapsed + left > 0 ? Math.min(99, (100 * elapsed) / (elapsed + left)) : 0;
  const done = p.steps.filter((s) => s.status === "done" || s.status === "failed").length;
  return (
    <details className="src-timer">
      <summary title="Estimate from how long each step took last time, plus the restart. Click for the steps.">
        <div className="src-timer-head">
          <span className="src-timer-label">Updating data</span>
          <span className="src-timer-left">{left > 0 ? `~${clock(left)} left` : "finishing…"}</span>
        </div>
        <div className="src-bar">
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="src-timer-sub">
          Ends ≈ {hhmm(now + left * 1000)} · step {Math.min(done + 1, p.steps.length)} of {p.steps.length}
          {p.current ? ` · ${p.current}` : ""}
        </div>
      </summary>
      <ol className="src-steps">
        {p.steps.map((s) => (
          <Fragment key={s.id}>
            <li className={`src-step is-${s.status}`}>
              <span>{s.title}</span>
              <span className="num">
                {s.status === "pending" ? `~${minutes(s.estimateSeconds)}` : s.seconds !== null ? minutes(s.seconds) : ""}
              </span>
            </li>
          </Fragment>
        ))}
        <li className="src-step is-pending">
          <span>Restart of the report (cache warm-up)</span>
          <span className="num">~1 min</span>
        </li>
      </ol>
    </details>
  );
}
