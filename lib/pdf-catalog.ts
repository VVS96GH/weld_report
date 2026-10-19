/**
 * The pages the PDF menu offers (owner, 2026-10-19), by section, in the
 * navigation's order. Client-safe: page lists only, no database code.
 * Errors and Data are offered but not ticked by default.
 */
import { SCREENS } from "@/lib/screens";
import { WP_NAV } from "@/lib/welder-perf-nav";
import { displayHref, WELDING_PAGE_TITLES } from "@/lib/welding-pages";
import { relabel } from "@/lib/labels";

export type PdfPage = { path: string; title: string };
export type PdfSection = { id: string; label: string; defaultOn: boolean; pages: PdfPage[] };

export const PDF_SECTIONS: readonly PdfSection[] = [
  {
    id: "welding",
    label: "Welding",
    defaultOn: true,
    // the report's own pages; the entries that only link to Flange, Welder
    // Performance or Errors are left to those sections
    pages: WELDING_PAGE_TITLES.map((t, i) => ({ path: displayHref(i + 1), title: `${i + 1}. ${relabel(t)}` })).filter(
      (p) => !/^\/(flange|welder-performance|errors|data)\b/.test(p.path),
    ),
  },
  { id: "flange", label: "Flange", defaultOn: true, pages: [{ path: "/flange", title: "Flange Inspection Dashboard" }] },
  {
    id: "screens",
    label: "Screens",
    defaultOn: true,
    pages: SCREENS.map((s) => ({ path: `/report/${s.id}${s.defaultQuery ? `?${s.defaultQuery}` : ""}`, title: relabel(s.nav) })),
  },
  {
    id: "welders",
    label: "Welder Performance",
    defaultOn: true,
    pages: WP_NAV.flatMap((g) => g.pages.map((p) => ({ path: `/welder-performance/${p.slug}`, title: relabel(p.label) }))),
  },
  { id: "errors", label: "Errors", defaultOn: false, pages: [{ path: "/errors", title: "Errors" }] },
  { id: "data", label: "Data", defaultOn: false, pages: [{ path: "/data", title: "Data" }] },
];

/** Every path the menu can ask for: the report job prints only these. */
export const PDF_PATHS: ReadonlySet<string> = new Set(PDF_SECTIONS.flatMap((s) => s.pages.map((p) => p.path)));
