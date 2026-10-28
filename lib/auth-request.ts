/** Route-handler helpers: the request's user, or the 401 / 403 answer. */
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, type User, userByToken } from "@/lib/auth";

export async function requestUser(req: NextRequest): Promise<User | null> {
  return userByToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export const unauthorized = () => Response.json({ error: "Sign in first" }, { status: 401 });
export const forbidden = () => Response.json({ error: "Administrators only" }, { status: 403 });
