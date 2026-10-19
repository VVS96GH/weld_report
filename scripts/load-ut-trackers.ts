/**
 * Loads `sources/UT TRACKER (GAC)_Master.xlsx` and `sources/UT TRACKER (TEK).xlsx`,
 * sheet MUT, into `ut_tracker_ctjv`, replacing what was there — the pbix queries
 * `UT TRACKER (GAC)` / `UT TRACKER (TEK)`:
 *   - two title rows skipped, the third is the header;
 *   - Joint ID = DRAWING NUMBER & "-" & SPOOL & "-" & JOINT, "FBW-" taken out of
 *     JOINT; GAC also drops every space from the three parts and cleans control
 *     characters; TEK keeps only rows with a Joint ID (any blank part blanks it).
 *
 *   node --import tsx scripts/load-ut-trackers.ts [--dry-run]
 */
import ExcelJS from "exceljs";
import { Client } from "pg";

const FILES = [
  { tracker: "GAC", file: "sources/UT TRACKER (GAC)_Master.xlsx" },
  { tracker: "TEK", file: "sources/UT TRACKER (TEK).xlsx" },
] as const;

type Row = [string, number | null, string | null, string | null, string | null, string | null, string | null, string | null, string | null];

const val = (v: ExcelJS.CellValue): unknown => {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
  }
  return v;
};
const txt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  return s.trim() === "" ? null : s;
};
const iso = (v: unknown): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  return null;
};
const norm = (h: unknown) => String(h ?? "").replace(/\s+/g, " ").trim().toUpperCase();

async function read(tracker: "GAC" | "TEK", file: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet("MUT");
  if (!ws) throw new Error(`${file}: no sheet MUT`);
  const head = (ws.getRow(3).values as unknown[]).map(norm);
  const col = (name: string) => {
    const i = head.indexOf(norm(name));
    if (i < 0) throw new Error(`${file}: no column "${name}"`);
    return i;
  };
  const c = {
    sl: col("SL"), drawing: col("DRAWING NUMBER"), spool: col("SPOOL"), joint: col("JOINT"),
    report: col("MUT REPORT NO"), result: col("RESULT"), exam: col("DATE OF EXAMINATION"),
    cross: col("Cross Verification-by CTJV (TPI)"), vdate: col("CTJV VERIFICATION DATE"), vby: col("CTJV VERIFICATION BY"),
  };
  const out: Row[] = [];
  ws.eachRow((r, n) => {
    if (n <= 3) return;
    const v = (i: number) => val(r.getCell(i).value);
    let drawing = txt(v(c.drawing));
    let spool = txt(v(c.spool));
    let joint = txt(v(c.joint));
    if (tracker === "GAC") {
      drawing = drawing?.replace(/ /g, "") ?? null;
      spool = spool?.replace(/ /g, "") ?? null;
      joint = joint?.replace(/ /g, "") ?? null;
    }
    joint = joint?.replace(/FBW-/g, "") ?? null;
    if (tracker === "GAC") joint = joint?.replace(/ /g, "") ?? null;
    let jointId = drawing !== null && spool !== null && joint !== null ? `${drawing}-${spool}-${joint}` : null;
    if (tracker === "GAC" && jointId) jointId = jointId.replace(/[\u0000-\u001f\u007f]/g, "");
    if (tracker === "TEK" && !jointId) return;
    const sl = Number(txt(v(c.sl)));
    if (tracker === "GAC" && !jointId && !Number.isFinite(sl)) return; // blank trailing rows
    let result = txt(v(c.result));
    result = result?.replace(/ACCEPT/g, "A") ?? null;
    if (tracker === "GAC") result = result?.replace(/REJECT/g, "R") ?? null;
    out.push([tracker, Number.isFinite(sl) ? sl : null, jointId, txt(v(c.report)), result, iso(v(c.exam)), txt(v(c.cross)), iso(v(c.vdate)), txt(v(c.vby))]);
  });
  return out;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const rows: Row[] = [];
  for (const f of FILES) {
    const r = await read(f.tracker, f.file);
    console.log(`${f.tracker}: ${r.length} rows, ${new Set(r.map((x) => x[2]).filter(Boolean)).size} joints`);
    rows.push(...r);
  }
  if (dry) return;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query("DELETE FROM ut_tracker_ctjv");
    for (const r of rows) {
      await db.query(
        `INSERT INTO ut_tracker_ctjv (tracker, sl, joint_id, mut_report_no, result, date_of_exam, cross_verification, verification_date, verification_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        r,
      );
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
