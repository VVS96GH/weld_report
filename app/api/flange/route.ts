/**
 * `GET /api/flange?ha=&subco=&method=` — the flange dashboard as JSON.
 *
 * The three filters travel as URL search params (RF-08); omitting one, or
 * passing `All`, applies no predicate. An unknown value is a 400 with the list
 * of valid options rather than a silently empty page — a filter that quietly
 * matches nothing looks exactly like "there is no data".
 *
 * Next 16 route handlers are uncached by default, so no segment config.
 */

import type { NextRequest } from "next/server";
import { FLANGE_ALL } from "@/lib/metrics/flange";
import { flangeFilterOptions, getFlangePage } from "@/lib/pages/flange";

const FILTER_IDS = ["ha", "subco", "method"] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const requested: Record<string, string> = {};
  for (const id of FILTER_IDS) {
    const v = sp.get(id);
    if (v !== null && v !== "") requested[id] = v;
  }

  try {
    const options = await flangeFilterOptions();
    const invalid = FILTER_IDS.filter(
      (id) =>
        requested[id] !== undefined &&
        requested[id] !== FLANGE_ALL &&
        !options[id].includes(requested[id]),
    );
    if (invalid.length > 0) {
      return Response.json(
        {
          error: "unknown filter value",
          invalid: Object.fromEntries(invalid.map((id) => [id, requested[id]])),
          options,
        },
        { status: 400 },
      );
    }

    const model = await getFlangePage(requested);
    return Response.json(model);
  } catch (err) {
    return Response.json(
      {
        error: "failed to build the flange page",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
