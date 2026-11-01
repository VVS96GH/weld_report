"use client";

import { useIsAdmin } from "@/lib/me";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Header button that runs `npm run db:refresh` (owner request 2026-10-14):
 * click → "Refresh all data?" → "Yes" starts it through POST /api/refresh.
 *
 * While it runs, the dialog shows the tail of the refresh log. Its last step
 * restarts the report server, so the status endpoint goes silent for a while;
 * that is expected and shown as such. When the server answers again and the
 * run has finished cleanly, the page reloads to show the new data.
 */

type Eta = { secondsLeft: number | null; stepIndex: number; steps: number; current: string | null };

type Status = {
  running: boolean;
  exitCode: number | null;
  finishedAt: string | null;
  log: string;
  eta?: Eta | null;
};

/** "≈ 12 min" / "less than a minute" */
function fmtLeft(s: number): string {
  if (s < 60) return "less than a minute";
  const m = Math.round(s / 60);
  return m < 60 ? `≈ ${m} min` : `≈ ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

type Phase = "idle" | "confirm" | "starting" | "running" | "restarting" | "done" | "failed";

const POLL_MS = 4000;

export function RefreshDataButton() {
  const admin = useIsAdmin();
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState("");
  const [eta, setEta] = useState<Eta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yesRef = useRef<HTMLButtonElement>(null);

  const stopPolling = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback(async function tick() {
    let s: Status | null = null;
    try {
      const r = await fetch("/api/refresh", { cache: "no-store" });
      if (r.ok) s = (await r.json()) as Status;
    } catch {
      s = null;
    }
    if (s === null) {
      // the server is restarting (the refresh's last step)
      setPhase("restarting");
    } else {
      setLog(s.log);
      setEta(s.eta ?? null);
      if (s.running) setPhase("running");
      else if (s.exitCode === 0) {
        setPhase("done");
        stopPolling();
        setTimeout(() => window.location.reload(), 1500);
        return;
      } else if (s.exitCode !== null) {
        setPhase("failed");
        stopPolling();
        return;
      }
    }
    timer.current = setTimeout(tick, POLL_MS);
  }, []);

  useEffect(() => stopPolling, []);

  useEffect(() => {
    if (phase === "confirm") yesRef.current?.focus();
  }, [phase]);

  async function open() {
    setError(null);
    try {
      const r = await fetch("/api/refresh", { cache: "no-store" });
      const s = (await r.json()) as Status;
      if (s.running) {
        setLog(s.log);
        setEta(s.eta ?? null);
        setPhase("running");
        stopPolling();
        timer.current = setTimeout(poll, POLL_MS);
        return;
      }
    } catch {
      // status unknown — still offer to start; the POST will tell
    }
    setPhase("confirm");
  }

  async function start() {
    setPhase("starting");
    setError(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const body = (await r.json()) as Status & { error?: string };
      if (!r.ok && r.status !== 409) {
        setError(body.error ?? `HTTP ${r.status}`);
        setPhase("failed");
        return;
      }
      setLog(body.log ?? "");
      setPhase("running");
      stopPolling();
      timer.current = setTimeout(poll, POLL_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("failed");
    }
  }

  function close() {
    stopPolling();
    setPhase("idle");
  }

  const busy = phase === "starting" || phase === "running" || phase === "restarting";
  const title: Record<Phase, string> = {
    idle: "",
    confirm: "Refresh all data?",
    starting: "Starting the refresh…",
    running: "Refreshing data…",
    restarting: "Restarting the report…",
    done: "Data refreshed",
    failed: "Refresh failed",
  };

  // Wrapped, not a bare sibling: `.header-right > button.header-btn` is the theme
  // toggle's selector (e2e/navigation.spec.ts), and it must stay unique.
  // refreshing the data: administrators only
  if (!admin) return null;
  return (
    <div className="refresh-data-wrapper">
      <button
        type="button"
        className={`header-btn${busy ? " is-running" : ""}`}
        aria-label="Refresh data"
        title="Refresh data"
        onClick={open}
      >
        <span aria-hidden="true">{"\u{1F504}"}</span>
      </button>
      {phase !== "idle" ? (
        <div
          className="refresh-dialog-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) close();
          }}
        >
          <div className="refresh-dialog" role="dialog" aria-modal="true" aria-labelledby="refresh-dialog-title">
            <h2 id="refresh-dialog-title">{title[phase]}</h2>
            {phase === "confirm" ? (
              <p>
                New files from the sources folder will be loaded into the database. Only changed files are loaded. This usually
                takes from a few minutes to half an hour. The report restarts at the end.
              </p>
            ) : null}
            {phase === "running" || phase === "restarting" ? (
              <p>You can close this window; the refresh will continue. Do not shut down the computer or let it sleep.</p>
            ) : null}
            {phase === "running" && eta && eta.secondsLeft !== null ? (
              <p className="refresh-eta" aria-live="polite">
                <strong>Time left {fmtLeft(eta.secondsLeft)}</strong>
                {eta.steps ? ` · step ${eta.stepIndex} of ${eta.steps}${eta.current ? ` (${eta.current})` : ""}` : ""}
              </p>
            ) : null}
            {phase === "done" ? <p>The page will reload now.</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {log && phase !== "confirm" ? <pre aria-live="polite">{log}</pre> : null}
            <div className="refresh-dialog-actions">
              {phase === "confirm" ? (
                <>
                  <button type="button" className="ms-btn" onClick={close}>
                    No
                  </button>
                  <button type="button" ref={yesRef} className="ms-btn ms-btn--primary" onClick={start}>
                    Yes
                  </button>
                </>
              ) : (
                <button type="button" className="ms-btn" onClick={close}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
