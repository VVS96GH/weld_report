import { statSync } from "node:fs";

/**
 * The last weld date a load keeps (owner, 2026-10-18): the last Friday BEFORE
 * the day the export was taken. The pbix does the same by hand in its M
 * (`#"Exlude after 16 oct"` drops 17/18 Oct from Weld Dump and the CCC Welder
 * Record); here it follows the file's own date, so no list needs editing per
 * delivery. A Friday export keeps the previous Friday — that day is partial.
 * `WELD_CUTOFF=YYYY-MM-DD` overrides it.
 */
export function weldCutoff(file: string): string {
  const env = process.env.WELD_CUTOFF;
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  const m = statSync(file).mtime;
  const d = new Date(Date.UTC(m.getFullYear(), m.getMonth(), m.getDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - 5 + 7) % 7));
  return d.toISOString().slice(0, 10);
}
