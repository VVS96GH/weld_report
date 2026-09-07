/**
 * `GET /api/forecast?subco=&ha=&area=&byut=&wcat=&rt=&dia=&wy=&wm=&ry=&rm=&as_of=` — the
 * RT Backlog Forecast page (pbix page 20) as JSON. Omitted filters apply no predicate.
 */

import type { NextRequest } from "next/server";
import { FORECAST_FILTER_IDS, getForecastPage, type ForecastFilters } from "@/lib/page-source";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const filters: ForecastFilters = {};
  for (const id of FORECAST_FILTER_IDS) {
    const v = sp.get(id)?.trim();
    if (v) filters[id] = v;
  }
  const asOf = sp.get("as_of");
  if (asOf !== null && !ISO_DATE.test(asOf)) {
    return Response.json({ error: "as_of must be YYYY-MM-DD", as_of: asOf }, { status: 400 });
  }
  try {
    return Response.json(await getForecastPage(filters, asOf ? { as_of: asOf } : {}));
  } catch (err) {
    return Response.json(
      { error: "failed to build the forecast page", detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
