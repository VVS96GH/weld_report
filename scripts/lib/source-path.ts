import { existsSync } from "node:fs";

/**
 * The first of `candidates` that exists, else the first: for sources whose
 * export name drifts by a space ("…Backlog .xlsx" vs "…Backlog.xlsx", 2026-10-18).
 */
export function firstExisting(...candidates: string[]): string {
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

export const TREND_RT_PWHT_FILE = firstExisting(
  "sources/CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog .xlsx",
  "sources/CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog.xlsx",
);
