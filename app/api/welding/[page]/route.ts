/**
 * `GET /api/welding/{1..44}?as_of=YYYY-MM-DD&ha=HA1&area=…&subco=GAC&wtype=BW&wcat=F` —
 * one `PageModel` as JSON. `ha` / `area` / `subco` / `wtype` / `wcat` are the page-1 slicers (raw column
 * values; omitted = All); other pages ignore them.
 *
 * `params` is a Promise in Next 16 (see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
 * → "context (optional)"). `as_of` overrides the reporting date that stands in
 * for the DAX `TODAY()`; the default is `max(weld_date)` of the current load
 * (see `lib/db.ts`).
 */

import type { NextRequest } from "next/server";
import { getWeldingPage, type WeldingFilters } from "@/lib/pages/welding";
import { FORECAST_FILTER_IDS, getForecastPage, type ForecastFilters } from "@/lib/page-source";
import { reportEntry, WELDING_TOTAL_PAGES as TOTAL_PAGES } from "@/lib/welding-pages";

const FILTER_PARAMS = ["ha", "area", "subco", "wtype", "wcat", "sclass", "pwht"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ page: string }> },
): Promise<Response> {
  const { page } = await params;
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_PAGES) {
    return Response.json(
      { error: `page must be an integer 1..${TOTAL_PAGES}`, page },
      { status: 404 },
    );
  }

  const asOf = request.nextUrl.searchParams.get("as_of");
  if (asOf !== null && !ISO_DATE.test(asOf)) {
    return Response.json(
      { error: "as_of must be YYYY-MM-DD", as_of: asOf },
      { status: 400 },
    );
  }

  try {
    const filters: WeldingFilters = {};
    for (const key of FILTER_PARAMS) {
      const value = request.nextUrl.searchParams.get(key)?.trim();
      if (value) filters[key] = value;
    }
    const entry = reportEntry(n)!;
    if (entry.kind === "link") {
      return Response.json({ error: `page ${n} is the ${entry.title} report, at ${entry.href}` }, { status: 404 });
    }
    if (entry.kind === "forecast") {
      const ff: ForecastFilters = {};
      for (const key of FORECAST_FILTER_IDS) {
        const value = request.nextUrl.searchParams.get(key)?.trim();
        if (value) ff[key] = value;
      }
      return Response.json(await getForecastPage(ff, asOf ? { as_of: asOf } : {}));
    }
    const model = await getWeldingPage(entry.data, { ...(asOf ? { as_of: asOf } : {}), filters, tmcp: entry.tmcp });
    return Response.json(model);
  } catch (err) {
    return Response.json(
      {
        error: "failed to build page",
        page: n,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
