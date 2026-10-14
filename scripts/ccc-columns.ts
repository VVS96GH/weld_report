/**
 * CCC-specific transforms shared by the two CCC loaders.
 *
 * Every rule here is traced to `analysis/pbix/model.md` (the
 * `CSVExport_Welder Record` / `AllTrain_CSVExport_Joint Record NOT WELDED` M
 * queries), `analysis/pbix/project-wd-wr-inco-acciona.md` §2.2 (the union's
 * calculated columns) or `analysis/sources2/ccc-column-map.md`.
 */

/**
 * `Weld Type` normalisation — 17 ORDERED `Replacer.ReplaceText` steps, applied by
 * the union query AFTER the append, i.e. to every source (§5.5 Q7).
 *
 * ORDER IS LOAD-BEARING and this is why it cannot be a lookup map:
 * `RPDS -> RPD` runs before `RPDSA -> RPD`, so by the time the `RPDSA` step is
 * reached the value is already `RPDA`, which the later `RPDA -> RPD` step then
 * collapses. Re-ordering the list changes the result. These are substring
 * replacements, not whole-value ones.
 */
export const WELD_TYPE_STEPS: [string, string][] = [
  ["RPDS", "RPD"], ["RPDUA", "RPD"], ["RPD0", "RPD"], ["RPDF", "RPD"],
  ["RPDN", "RPD"], ["RPDNA", "RPD"], ["RPDSA", "RPD"], ["RPDHA", "RPD"],
  ["RPDA", "RPD"],
  ["SOB0", "SOB"], ["SOBF", "SOB"], ["SOBHA", "SOB"], ["SOBN", "SOB"],
  ["SOBS", "SOB"], ["SOBSA", "SOB"], ["SOBUA", "SOB"], ["SOBA", "SOB"],
];

export function normaliseWeldType(v: string): string {
  let s = v;
  for (const [from, to] of WELD_TYPE_STEPS) {
    if (s.indexOf(from) >= 0) s = s.split(from).join(to);
  }
  return s;
}

/** M `#"Dia Inch Factor"`: `if [Weld Type] = "BW" or [Weld Type] = "CLET" then "Y" else "N"`. */
export function diaInchFactor(weldType: string): boolean {
  return weldType === "BW" || weldType === "CLET";
}

/**
 * `RT/UT(%)` as the pbix reads it: a WHOLE number.
 *
 * The 2026-10 welder-record export writes every number as a float ("100.0",
 * "5.0", "0.0") where the 2026-08 one wrote "100", "5", "0" — same values, other
 * formatting. Left alone that breaks three things at once: `weld.rt_pct` is an
 * integer column (the COPY aborts), `synthRtWeldStatus` compares with "100"
 * (every "HS CCC" would silently vanish), and the service-class composite key
 * ends in this text. So a float with a zero fraction is folded back to the
 * integer text; anything else (a real fraction, a blank, a word) is returned
 * untouched and fails loudly downstream, as before.
 */
export function wholePct(raw: string): string {
  const t = raw.trim();
  const m = /^(-?\d+)\.0+$/.exec(t);
  return m ? m[1] : t;
}

/**
 * M `#"WELD Status"` for the welder record:
 *   if [RT Report] = "blank" then "HS"
 *   else if [RT%] = 100 then "HS CCC"
 *   else if [Tracer Shot] = "T" then "T"
 *   else ""
 * The first branch compares against the literal STRING "blank", which never
 * occurs, so it is dead — reproduced anyway (ruling R2-13). `HS CCC` is a token
 * the dump never uses and IS in the DAX's 16-code RT hold list.
 */
export function synthRtWeldStatus(rtReport: string, rtPct: string, tracerShot: string): string {
  if (rtReport === "blank") return "HS";
  if (rtPct.trim() === "100") return "HS CCC";
  if (tracerShot.trim() === "T") return "T";
  return "";
}

/**
 * `Project WD+WR+INCO+Acciona[Repair & Reweld "PR all"]`, verbatim.
 * Four categories — '', 'Repair', 'Reweld' and **'RS1'**, which is its own
 * category and NOT 'Repair' (ruling R2-12 as corrected by the orchestrator, and
 * by the model's stored cardinality of 4).
 */
export function repairRewaldPrAll(
  subContractor: string,
  jointId: string,
  repairSuffix: string,
): string {
  if (subContractor === "Inco") return "";
  const tail = jointId.slice(-2).toUpperCase();
  if (tail === "R1" || tail === "R2") return "Repair";
  if (tail === "RW") return "Reweld";
  if (repairSuffix === "RW1") return "Reweld";
  if (repairSuffix === "RS1") return "RS1";
  return "";
}

/**
 * `TMCP Pipe`, "PR all" flavour: `Service class = "9C3AQN" AND Dia inch IN (30,34,46)`.
 * The "WD" flavour tests `= 46` only; one column, the rule chosen by source
 * (orchestrator ruling D4).
 */
export function tmcpPipePrAll(serviceClass: string, diaInch: string | null): boolean {
  if (serviceClass !== "9C3AQN" || diaInch === null) return false;
  const d = Number(diaInch);
  return d === 30 || d === 34 || d === 46;
}

/** M `#"Replaced Value"`/`1`: `R01 -> R1`, `R02 -> R2` (substring replacement). */
export function normaliseRepairSuffix(v: string): string {
  return v.replace(/R01/g, "R1").replace(/R02/g, "R2");
}

/**
 * The four Joint IDs the union's last step removes — 16 rows in the pbix.
 * Kept in sync with `db/migrations/0012_lengths_and_manual_exclusion.sql`, which
 * seeds `weld_manual_exclusion` with the same list so the report owner can see it.
 */
export const EXCLUDED_JOINT_IDS = new Set<string>([
  "11040A1-DG6204061C-SP2-9",
  "11040A3-DB6204507-SP4-12",
  "11040A3-NG6204709-SP17-62",
  "11060A4-PR6206008-SP3-11",
]);

/**
 * M `#"Filtered Exlude RS1 RT B.log"` — the CCC welder-record query's LAST step
 * (after `#"Replaced Value # to CCC"`), added by the owner in the October pbix:
 * `Joint ID <> …` AND-ed over these RS1 joints, which sit in the RT backlog
 * without ever being shot. Five were listed by the owner on 2026-10-14; the
 * sixth (`11080A1-DB6208004A-SP2-14RS1`) is the clause visible in the owner's
 * screenshot of that step, truncated there to `11080A1-DB6208004A-SP2-` — it is
 * the only RS1 joint with that prefix. Removing the six takes CCC's RT backlog
 * from 386 to the pbix's 380 and its PWHT backlog from 255 to 254.
 * Only the welder record carries the step; the union-level list is above.
 */
export const EXCLUDED_RS1_RT_BLOG_JOINT_IDS = new Set<string>([
  "11060A4-MR6206036-SP2-3RS1",
  "11020A1-SV6202033-SP8-25RS1",
  "11060A4-DB6206011B-SP4-19RS1",
  "11040A3-NG6204704-SP14-43RS1",
  "11080A1-DB6208004A-SP2-14RS1",
  "11060A4-PR6206005-SP10A-33RS1",
]);
