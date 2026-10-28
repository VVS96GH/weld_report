"use client";

import { useEffect, useState } from "react";


type Event = { id: number; at: string; email: string; action: string; status: number; ip: string; detail: Record<string, unknown> };

// weld_report logs the action already in words (lib/audit.ts); a refused one as METHOD path
const label = (a: string) => a;
const result = (s: number) => (s < 300 ? "ok" : s === 401 ? "wrong / no sign-in" : s === 403 ? "denied" : `error ${s}`);
const when = (v: string) => new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" });
const detailOf = (d: Record<string, unknown>) => {
  const { path, ...rest } = d;
  const s = Object.keys(rest).length ? JSON.stringify(rest) : String(path ?? "");
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
};

/** The activity log: who signed in, loaded data, changed settings or users, downloaded exports. */
export function ActivityLog() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/audit?limit=500", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ events: Event[] }>) : { events: [] }))
      .then((b) => alive && setEvents(b.events ?? []))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, []);
  const shown = (events ?? []).filter((e) =>
    q ? `${e.email} ${label(e.action)} ${e.ip} ${JSON.stringify(e.detail)}`.toLowerCase().includes(q.toLowerCase()) : true,
  );
  return (
    <div className="card mt-6">
      <div className="card-header flex items-center justify-between gap-4">
        <span>Activity (last 500)</span>
        <input className="activity-search" placeholder="Search: e-mail, action, IP…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="table-scroll" style={{ maxHeight: 520 }}>
        <table className="data-table admin-users">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Result</th>
              <th>IP</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events === null ? (
              <tr>
                <td colSpan={6}>Loading…</td>
              </tr>
            ) : null}
            {shown.map((e) => (
              <tr key={e.id} className={e.status >= 400 ? "activity-bad" : ""}>
                <td>{when(e.at)}</td>
                <td>{e.email || "—"}</td>
                <td>{label(e.action)}</td>
                <td>{result(e.status)}</td>
                <td>{e.ip}</td>
                <td className="activity-detail" title={JSON.stringify(e.detail)}>
                  {detailOf(e.detail)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
