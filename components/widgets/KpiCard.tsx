import type { KpiWidget } from "@/lib/page-model";

/**
 * One `.stat-box` tile, as used in the mockup's `.stats-row`. The value carries
 * `.num` (tabular figures) so columns of tiles line up; under the T.EN mood it is
 * the coral Poppins display number.
 */
export function KpiCard({ widget }: { widget: KpiWidget }) {
  return (
    <div className="stat-box">
      <div className="stat-value num">{widget.value}</div>
      <div className="stat-label">{widget.label}</div>
      {widget.sub ? <div className="stat-sub">{widget.sub}</div> : null}
    </div>
  );
}
