"use client";

import { useEffect, useState } from "react";

export type Me = { id: number; email: string; name: string; role: "admin" | "user" };

// one request per page load, shared by every component; the shell stays mounted across pages,
// so a sign-in / sign-out tells every listener to ask again
let pending: Promise<Me | null> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<Me | null> {
  pending ??= fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .catch(() => null);
  return pending;
}

/** The signed-in user (null: not signed in / not known yet). */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () => void load().then((m) => alive && setMe(m));
    read();
    listeners.add(read);
    return () => {
      alive = false;
      listeners.delete(read);
    };
  }, []);
  return me;
}

/** Administrators refresh data and change shared settings; users only read and download. */
export function useIsAdmin(): boolean {
  return useMe()?.role === "admin";
}

export function resetMe(): void {
  pending = null;
  for (const f of listeners) f();
}
