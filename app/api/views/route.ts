/**
 * Saved filter views (migration 0047), shared by everyone:
 *   GET    /api/views?page=/welding        the page's views, A→Z
 *   POST   /api/views {page, name, query}  save (same name replaces)
 *   DELETE /api/views?id=12                remove one
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { queryFresh as query } from "@/lib/db";
import { resolvePageSource } from "@/lib/page-source";

export const dynamic = "force-dynamic";

const Page = z.string().regex(/^\/[a-z0-9/-]{0,80}$/);
const Body = z.object({ page: Page, name: z.string().trim().min(1).max(60), query: z.string().max(4000) });
const Row = z.object({ id: z.coerce.number(), name: z.string(), query: z.string() });

const noDb = () => Response.json({ views: [], note: "saved views need PAGE_SOURCE=database" });

export async function GET(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return noDb();
  const page = Page.safeParse(request.nextUrl.searchParams.get("page") ?? "");
  if (!page.success) return Response.json({ error: "bad page" }, { status: 400 });
  const rows = await query(`SELECT id, name, query FROM saved_view WHERE page = $1 ORDER BY lower(name)`, [page.data]);
  return Response.json({ views: z.array(Row).parse(rows) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return noDb();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "page, name (1-60 chars) and query are required" }, { status: 400 });
  const q = new URLSearchParams(body.data.query).toString();
  const rows = await query(
    `INSERT INTO saved_view (page, name, query) VALUES ($1, $2, $3)
     ON CONFLICT (page, name) DO UPDATE SET query = EXCLUDED.query, created_at = now()
     RETURNING id, name, query`,
    [body.data.page, body.data.name, q],
  );
  return Response.json({ view: Row.parse(rows[0]) });
}

export async function DELETE(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return noDb();
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "bad id" }, { status: 400 });
  await query(`DELETE FROM saved_view WHERE id = $1`, [id]);
  return Response.json({ ok: true });
}
