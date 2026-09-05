import type { KpiWidget } from "@/lib/page-model";

/** One `.stat-box` tile, as used in the mockup's `.stats-row`. */
export function KpiCard({ widget }: { widget: KpiWidget }) {
  return (
    <div className="stat-box">
      <div className="stat-value">{widget.value}</div>
      <div className="stat-label">{widget.label}</div>
      {widget.sub ? <div className="stat-sub">{widget.sub}</div> : null}
    </div>
  );
}
