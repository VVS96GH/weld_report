"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Header button that runs `npm run db:refresh` (owner request 2026-10-14):
 * click → "Обновить все данные?" → "Да" starts it through POST /api/refresh.
 *
 * While it runs, the dialog shows the tail of the refresh log. Its last step
 * restarts the report server, so the status endpoint goes silent for a while;
 * that is expected and shown as such. When the server answers again and the
 * run has finished cleanly, the page reloads to show the new data.
 */

type Status = {
  running: boolean;
  exitCode: number | null;
  finishedAt: string | null;
  log: string;
};

type Phase = "idle" | "confirm" | "starting" | "running" | "restarting" | "done" | "failed";

const POLL_MS = 4000;

export function RefreshDataButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState("");
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
    confirm: "Обновить все данные?",
    starting: "Запуск обновления…",
    running: "Идёт обновление данных…",
    restarting: "Отчёт перезапускается…",
    done: "Данные обновлены",
    failed: "Обновление не удалось",
  };

  // Wrapped, not a bare sibling: `.header-right > button.header-btn` is the theme
  // toggle's selector (e2e/navigation.spec.ts), and it must stay unique.
  return (
    <div className="refresh-data-wrapper">
      <button
        type="button"
        className={`header-btn${busy ? " is-running" : ""}`}
        aria-label="Обновить данные"
        title="Обновить данные"
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
                Новые файлы из папки sources будут загружены в базу. Загружаются только изменившиеся файлы. Обычно это
                занимает от нескольких минут до получаса. В конце отчёт перезапустится.
              </p>
            ) : null}
            {phase === "running" || phase === "restarting" ? (
              <p>Можно закрыть это окно, обновление продолжится. Не выключайте компьютер и не давайте ему уснуть.</p>
            ) : null}
            {phase === "done" ? <p>Страница сейчас перезагрузится.</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {log && phase !== "confirm" ? <pre aria-live="polite">{log}</pre> : null}
            <div className="refresh-dialog-actions">
              {phase === "confirm" ? (
                <>
                  <button type="button" className="ms-btn" onClick={close}>
                    Нет
                  </button>
                  <button type="button" ref={yesRef} className="ms-btn ms-btn--primary" onClick={start}>
                    Да
                  </button>
                </>
              ) : (
                <button type="button" className="ms-btn" onClick={close}>
                  Закрыть
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
