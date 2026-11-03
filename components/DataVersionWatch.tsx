"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The browser keeps pages it has shown (next.config staleTimes, owner 2026-11-03). Every 30 s
 * while the tab is visible this asks the data version; when a new load lands, the page on screen
 * is fetched again and the kept ones are dropped, so old figures never show.
 */
export function DataVersionWatch() {
  const router = useRouter();
  const seen = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const v = await fetch("/api/data-version", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ version: string | null }>) : null))
        .then((b) => b?.version ?? null)
        .catch(() => null);
      if (!live || !v) return;
      if (seen.current && v !== seen.current) router.refresh();
      seen.current = v;
    };
    void check();
    const t = setInterval(() => void check(), 30_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);
  return null;
}
