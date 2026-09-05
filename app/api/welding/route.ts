/**
 * `GET /api/welding` — the page index for the welding report.
 *
 * Static: it reads the mockup spec, not the database, so it works before a
 * load exists. Next 16 route handlers are uncached by default; no route
 * segment config is needed.
 */

import { weldingPageIndex, TOTAL_PAGES } from "@/lib/pages/welding";

export async function GET(): Promise<Response> {
  return Response.json({
    total_pages: TOTAL_PAGES,
    pages: weldingPageIndex(),
  });
}
