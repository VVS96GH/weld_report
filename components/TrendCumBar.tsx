"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dmy = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}-${MON[(m ?? 1) - 1]}-${String(y).slice(2)}`;
};

/**
 * The CUM bar of the RT/UT and PWHT B.Log charts (owner, 2026-10-19), as on the
 * Welder Performance summary: the week's rows into the "CUM Trend file RT and
 * PWHT Backlog" workbook with one click (app/api/backlog-trend).
 */
export function TrendCumBar({ lastWeek, cutoff }: { lastWeek: string | null; cutoff: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "insert" | "reload">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const base = "/api/backlog-trend";
  const pending = !lastWeek || lastWeek < cutoff;
  async function post(action: "insert" | "reload") {
    if (
      action === "insert" &&
      !window.confirm(
        pending
          ? `Insert the week ${dmy(cutoff)} (7 rows) into the CUM Trend file? A backup copy is saved first.`
          : `The week ${dmy(cutoff)} is already in the CUM Trend file. Overwrite its 7 rows with the values on the pages now? A backup copy is saved first.`,
      )
    )
      return;
    setBusy(action);
    setMsg(null);
    try {
      const r = await fetch(`${base}?action=${action}`, { method: "POST" });
      const body = (await r.json()) as { added?: number; replaced?: number; rows?: number; backup?: string; error?: string };
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setMsg(
        action === "insert"
          ? `Week ${dmy(cutoff)}: ${body.added ?? 0} rows added, ${body.replaced ?? 0} replaced; backup “${body.backup}”.`
          : `Re-read the CUM Trend file: ${body.rows} rows.`,
      );
      router.refresh();
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="card rs-cum">
      <div className="rs-cum-text">
        <strong>CUM Trend file</strong> (RT and PWHT B.Log): last week {lastWeek ? dmy(lastWeek) : "—"}.{" "}
        {pending ? `The week ${dmy(cutoff)} is not in it yet; the charts show it from the live data.` : `Up to date with the cut-off ${dmy(cutoff)}.`}
      </div>
      <div className="rs-cum-actions">
        <a className="ms-btn" href={`${base}?action=csv`} download>
          Download table (CSV)
        </a>
        <button type="button" className="ms-btn ms-btn--primary" disabled={busy !== null} onClick={() => post("insert")}>
          {busy === "insert" ? "Inserting…" : "Insert into CUM file"}
        </button>
        <a className="ms-btn" href={`${base}?action=file`} download>
          Download CUM file
        </a>
        <button type="button" className="ms-btn" disabled={busy !== null} onClick={() => post("reload")}>
          {busy === "reload" ? "Reading…" : "Re-read CUM file"}
        </button>
      </div>
      {msg ? (
        <p className="rs-cum-msg" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
