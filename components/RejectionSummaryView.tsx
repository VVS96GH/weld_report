"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { usePageSubtitle } from "@/components/ReportShell";
import { ChartCard } from "@/components/widgets/ChartCard";
import type { ChartWidget } from "@/lib/page-model";
import type { SummaryPage, SummarySub } from "@/lib/pages/welder-perf-summary";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dmy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}-${MON[m - 1]}-${String(y).slice(2)}`;
}
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "" : `${(v * 100).toFixed(2)}%`);

/** Status rank 1..4 → the theme's status token (ok / monitor / critical / disqualified). */
const STATUS_VARS = ["--wp-status-ok", "--wp-status-monitor", "--wp-status-critical", "--wp-status-disq"];
const rank = (status: string) => Math.max(0, Math.min(3, Number(status.trim()[0]) - 1 || 0));

function useStatusColors(): string[] {
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => {
    const read = () => {
      const st = getComputedStyle(document.documentElement);
      setColors(STATUS_VARS.map((v) => st.getPropertyValue(v).trim()).filter(Boolean));
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mood", "data-theme"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}

function StatusTable({ sub, title }: { sub: SummarySub; title: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="rs-table">
      <h4 className="rs-head">{title}</h4>
      <table className="data-table rs-status">
        <thead>
          <tr>
            <th scope="col">STATUS</th>
            <th scope="col">QTY Wld.ID</th>
            <th scope="col">RT FILM Ratio %</th>
          </tr>
        </thead>
        <tbody>
          {sub.statuses.map((s) => (
            <StatusRows key={s.status} s={s} open={Boolean(open[s.status])} toggle={() => setOpen((o) => ({ ...o, [s.status]: !o[s.status] }))} />
          ))}
          <tr className="row-header">
            <th scope="row">Total</th>
            <td className="num">{sub.total.qty || ""}</td>
            <td className="num">{pct(sub.total.ratio)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function StatusRows({ s, open, toggle }: { s: SummarySub["statuses"][number]; open: boolean; toggle: () => void }) {
  return (
    <>
      <tr>
        <th scope="row">
          <button type="button" className="error-expand" aria-expanded={open} onClick={toggle}>
            <span aria-hidden="true">{open ? "−" : "+"}</span>{" "}
            <span className={`rs-dot rs-dot--${rank(s.status) + 1}`} aria-hidden="true" /> {s.status}
          </button>
        </th>
        <td className="num">{s.qty}</td>
        <td className="num">{pct(s.ratio)}</td>
      </tr>
      {open
        ? s.welders.map((w) => (
            <tr key={w.welder} className="rs-welder">
              <th scope="row">
                {w.welder} <span className="rs-wratio">({pct(w.welderRatio)})</span>
              </th>
              <td className="num">1</td>
              <td className="num">{pct(w.ratio)}</td>
            </tr>
          ))
        : null}
    </>
  );
}

/**
 * Notes: typed by hand (owner, 2026-10-14). An empty box starts with the
 * Disq.F welders' IDs, one per line, ready for the comment after the colon.
 */
function Notes({ kind, sub }: { kind: SummaryPage["kind"]; sub: SummarySub }) {
  const initial = sub.note ?? sub.disq.map((w) => `${w}: `).join("\n");
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = text !== (sub.note ?? initial);
  async function save() {
    setState("saving");
    try {
      const r = await fetch("/api/welder-performance/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, sub: sub.sub, body: text }),
      });
      setState(r.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }
  return (
    <div className="rs-notes">
      <h4 className="rs-head rs-head--center">{sub.sub === "TEKFEN" ? "TKF" : sub.sub} - Notes</h4>
      <textarea
        className="rs-notes-text"
        aria-label={`${sub.sub} notes`}
        value={text}
        placeholder="No welder in 4. 10 to 100% - Disq.F. Type notes here."
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
      />
      <div className="rs-notes-bar">
        <span className="rs-notes-state">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Not saved" : dirty ? "Unsaved changes" : ""}
        </span>
        <button type="button" className="ms-btn ms-btn--primary" disabled={!dirty && state !== "error"} onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

function SubRow({ kind, sub, colors, periodWord }: { kind: SummaryPage["kind"]; sub: SummarySub; colors: string[]; periodWord: string }) {
  const statusColor = (st: string) => colors[rank(st)] ?? colors[0];
  const donut: ChartWidget = {
    kind: "chart",
    canvas_id: `rs-donut-${sub.sub}`,
    title: `Rejection Rate.by Status. Report ${periodWord}`,
    chart_type: "doughnut",
    labels: sub.donut.map((d) => d.status),
    datasets: [{ label: "Welders", data: sub.donut.map((d) => d.qty) }],
  };
  const trend: ChartWidget = {
    kind: "chart",
    canvas_id: `rs-trend-${sub.sub}`,
    title: `Welders Performance. Rejection Rate. Status Report. ${periodWord}`,
    chart_type: "line",
    labels: sub.trend.periods.map((p) => p.replace(/\s+to\s+.*/, "").replace(/\.\s+/, ". ")),
    datasets: sub.trend.series.map((s) => ({ label: s.status, data: s.data })),
    options_notes: "area stacked (y)",
  };
  const subTitle = sub.sub === "TEKFEN" ? "TEKFEN" : sub.sub;
  return (
    <section className="card rs-row" aria-label={`${sub.sub} rejection summary`}>
      <StatusTable sub={sub} title={`${subTitle} - Welders Performance. Rejection Rate. Summary Status ${periodWord} Since RT Date`} />
      <Notes kind={kind} sub={sub} />
      <div className="rs-chart">
        <h4 className="rs-head">{donut.title}</h4>
        {sub.donut.length ? (
          <div className="rs-chart-box rs-chart-box--donut">
            <ChartCard widget={donut} paletteOverride={{ colors: sub.donut.map((d) => statusColor(d.status)) }} />
          </div>
        ) : (
          <p className="error-empty">No RT in this period.</p>
        )}
      </div>
      <div className="rs-chart rs-chart--trend">
        <h4 className="rs-head">{trend.title}</h4>
        {sub.trend.periods.length ? (
          <div className="rs-chart-box">
            <ChartCard widget={trend} paletteOverride={{ colors: sub.trend.series.map((s) => statusColor(s.status)) }} />
          </div>
        ) : (
          <p className="error-empty">No period in the CUM file yet.</p>
        )}
      </div>
    </section>
  );
}

/** The CUM workbook bar: export the hidden table, paste it into the workbook, re-read it. */
function CumBar({ data }: { data: SummaryPage }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "append" | "reload">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const base = `/api/welder-performance/cum?kind=${data.kind}`;
  async function post(action: "append" | "reload") {
    if (action === "append" && !window.confirm(`Insert ${data.cum.pending} new rows into the CUM file? A backup copy is saved first.`)) return;
    setBusy(action);
    setMsg(null);
    try {
      const r = await fetch(`${base}&action=${action}`, { method: "POST" });
      const body = (await r.json()) as { added?: number; rows?: number; backup?: string; error?: string };
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setMsg(
        action === "append"
          ? `Inserted ${body.added ?? 0} rows; backup “${body.backup}”. The charts now read ${body.rows} rows.`
          : `Re-read the CUM file: ${body.rows} rows.`,
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
        <strong>CUM file</strong> ({data.kind === "2w" ? "2 Weeks" : "1 Month"}): last RT date{" "}
        {data.cum.lastDate ? dmy(data.cum.lastDate) : "—"}.{" "}
        {data.cum.pending > 0
          ? `${data.cum.pending} new rows up to the cut-off ${dmy(data.cutoff)} are not in it yet.`
          : `Up to date with the cut-off ${dmy(data.cutoff)}.`}
      </div>
      <div className="rs-cum-actions">
        <a className="ms-btn" href={`${base}&action=csv`} download>
          Download table (CSV)
        </a>
        <button type="button" className="ms-btn ms-btn--primary" disabled={busy !== null || data.cum.pending === 0} onClick={() => post("append")}>
          {busy === "append" ? "Inserting…" : "Insert into CUM file"}
        </button>
        <a className="ms-btn" href={`${base}&action=file`} download>
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

export function RejectionSummaryView({ data, note }: { data: SummaryPage | null; note?: string }) {
  usePageSubtitle(data ? `Cut-off ${dmy(data.cutoff)}` : "Welder Performance");
  const colors = useStatusColors();
  const periodWord = data?.kind === "1m" ? "1 Month" : "2 Weeks";
  const subs = useMemo(() => data?.subs ?? [], [data]);
  return (
    <section className="page-section active wp-page rs-page" aria-labelledby="page-heading">
      <div className="page-header wp-banner">
        <h2 id="page-heading">
          Project Welders Performance. Cumulative Rejection Rate. Summary Report {data?.kind === "1m" ? "Last 1 Month" : "Last 2 weeks"}
          {data ? <span className="wp-since"> Since {dmy(data.since)}</span> : null}
        </h2>
      </div>
      {note ? <p className="error-empty">{note}</p> : null}
      {data ? (
        <>
          <CumBar data={data} />
          {subs.map((s) => (
            <SubRow key={s.sub} kind={data.kind} sub={s} colors={colors} periodWord={periodWord} />
          ))}
        </>
      ) : null}
    </section>
  );
}
