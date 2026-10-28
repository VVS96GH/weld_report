/**
 * The activity log (owner, 2026-10-28): a route handler wrapped in `audited()` writes who did what,
 * the result, the IP and the request (passwords removed) after it answers. The user's e-mail
 * comes from proxy.ts (the `x-auth-email` header it sets after checking the session).
 */
import type { NextRequest } from "next/server";

import { queryFresh } from "@/lib/db";

export const AUTH_EMAIL_HEADER = "x-auth-email";
const SECRET = ["password", "current", "new", "token"];
const MAX = 2000;

export function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.slice(0, 50).map(scrub);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [
        k,
        SECRET.some((s) => k.toLowerCase().includes(s)) ? "***" : scrub(x),
      ]),
    );
  }
  return v;
}

function ipOf(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  // the last hop is the one this server saw (an earlier one can be typed by anybody)
  return (fwd.split(",").pop() ?? "").trim() || req.headers.get("x-real-ip") || "";
}

export function audited<C>(action: string, handler: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const raw = req.method === "GET" ? "" : await req.clone().text().catch(() => "");
    const res = await handler(req, ctx);
    let email = req.headers.get(AUTH_EMAIL_HEADER) ?? "";
    const detail: Record<string, unknown> = { path: req.nextUrl.pathname };
    if (req.nextUrl.search) detail.query = req.nextUrl.search.slice(0, 500);
    if (raw) {
      try {
        const body = JSON.parse(raw) as unknown;
        if (!email && body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string") {
          email = (body as { email: string }).email; // a sign-in: the e-mail typed
        }
        const clean = scrub(body);
        const text = JSON.stringify(clean);
        detail.body = text.length <= MAX ? clean : `${text.slice(0, MAX)}…`;
      } catch {
        detail.body_bytes = raw.length;
      }
    }
    void queryFresh("INSERT INTO audit_event (email, action, status, ip, detail) VALUES ($1, $2, $3, $4, $5)", [
      email.trim().toLowerCase(),
      action,
      res.status,
      ipOf(req),
      JSON.stringify(detail),
    ]).catch(() => {}); // the log never breaks the request
    return res;
  };
}

export type AuditRow = { id: number; at: string; email: string; action: string; status: number; ip: string; detail: Record<string, unknown> };

export async function recentEvents(limit = 500): Promise<AuditRow[]> {
  return queryFresh<AuditRow>(
    "SELECT id::int, at::text, email, action, status, ip, detail FROM audit_event ORDER BY at DESC, id DESC LIMIT $1",
    [limit],
  );
}

/** A request refused before it reached its handler (proxy.ts): no role, or a temporary password. */
export function logDenied(req: NextRequest, email: string, status: number, why: string): void {
  void queryFresh("INSERT INTO audit_event (email, action, status, ip, detail) VALUES ($1, $2, $3, $4, $5)", [
    email,
    `${req.method} ${req.nextUrl.pathname}`,
    status,
    ipOf(req),
    JSON.stringify({ path: req.nextUrl.pathname, denied: why }),
  ]).catch(() => {});
}
