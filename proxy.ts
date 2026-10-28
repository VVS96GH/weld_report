import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, userByToken } from "@/lib/auth";

/**
 * Sign-in gate (owner, 2026-10-28). Every page and API call needs a valid session (checked in the
 * database): a page without one goes to /login and comes back after; an API call answers 401.
 * Changes are for administrators (403 otherwise): data refresh, CUM inserts, shared settings
 * (Views, column preferences, graph layout, notes) and the users. Reading, the exports and the
 * PDFs are for everyone signed in.
 */
const OPEN = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/health"]);
// writes everyone signed in may do: their own password, and asking for a PDF report
const USER_WRITES = new Set(["/api/auth/password", "/api/pdf/report"]);

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (OPEN.has(pathname)) return NextResponse.next();
  const isApi = pathname.startsWith("/api/");
  const user = await userByToken(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (!user) {
    if (isApi) return Response.json({ error: "Sign in first" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  const write = req.method !== "GET" && req.method !== "HEAD";
  const adminOnly = pathname.startsWith("/api/admin/") || pathname === "/admin" || (isApi && write && !USER_WRITES.has(pathname));
  if (adminOnly && user.role !== "admin") {
    return isApi ? Response.json({ error: "Administrators only" }, { status: 403 }) : NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // everything but Next's own files and the public images / icons
  matcher: ["/((?!_next/|brand/|favicon|icons/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
