/**
 * `GET /api/health` — database ping plus the current load summary.
 *
 * Reports honestly when the database is unreachable or the `load` table does
 * not exist yet (DB-LANE owns the migrations); it never invents a load.
 */

import { currentLoad, databaseUrl, ping, withAsOf } from "@/lib/db";

function redact(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

export async function GET(): Promise<Response> {
  const target = redact(databaseUrl());
  try {
    const latency_ms = await ping();
    const [load, asOf] = await Promise.all([
      currentLoad(),
      withAsOf(null).catch(() => null),
    ]);
    return Response.json({
      status: "ok",
      database: target,
      latency_ms,
      load,
      as_of: asOf?.as_of ?? null,
      as_of_origin: asOf?.origin ?? null,
    });
  } catch (err) {
    return Response.json(
      {
        status: "unavailable",
        database: target,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
