/**
 * Table column preferences (migration 0048), shared by everyone:
 *   GET /api/col-prefs                              every saved width / header name
 *   PUT /api/col-prefs {table, col, label?, width?} set one column (null clears a field)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { queryFresh as query } from "@/lib/db";
import { resolvePageSource } from "@/lib/page-source";

export const dynamic = "force-dynamic";

const Body = z.object({
  table: z.string().min(1).max(4000),
  col: z.string().min(1).max(300),
  label: z.string().trim().max(120).nullable().optional(),
  width: z.number().int().min(24).max(1200).nullable().optional(),
});
const Row = z.object({ table_key: z.string(), col: z.string(), label: z.string().nullable(), width: z.coerce.number().nullable() });

const noDb = () => Response.json({ prefs: [], note: "column preferences need PAGE_SOURCE=database" });

export async function GET(): Promise<Response> {
  if (resolvePageSource() !== "database") return noDb();
  const rows = await query(`SELECT table_key, col, label, width FROM col_pref`);
  return Response.json({ prefs: z.array(Row).parse(rows) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest): Promise<Response> {
  if (resolvePageSource() !== "database") return noDb();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "table and col are required; label ≤120 chars, width 24–1200" }, { status: 400 });
  const { table, col } = body.data;
  const label = body.data.label === undefined ? undefined : body.data.label || null;
  const width = body.data.width;
  // Only the fields sent change; a row with nothing left is removed.
  await query(
    `INSERT INTO col_pref (table_key, col, label, width) VALUES ($1, $2, $3, $4)
     ON CONFLICT (table_key, col) DO UPDATE SET
       label = CASE WHEN $5 THEN EXCLUDED.label ELSE col_pref.label END,
       width = CASE WHEN $6 THEN EXCLUDED.width ELSE col_pref.width END,
       updated_at = now()`,
    [table, col, label ?? null, width ?? null, label !== undefined, width !== undefined],
  );
  await query(`DELETE FROM col_pref WHERE table_key = $1 AND col = $2 AND label IS NULL AND width IS NULL`, [table, col]);
  return Response.json({ ok: true });
}
