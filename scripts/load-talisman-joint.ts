/**
 * `sources/Joint.csv` -> `ref_talisman_joint`: the pbix `TALISMAN DATA` table.
 *
 * 62 columns, 1,548,056 data rows, 322 MB. Only the six columns behind
 * `[RT BACKLOG RT100% Talisman]` and its provenance are stored (migration
 * 0029); widen the table when a measure needs more, not before.
 *
 * Rows whose `ORIGINAL REPAIR DELETE FLAG` is `D` are dropped, exactly as the
 * pbix M does. `Joint ID` is built `QCISO NO`-`SPOOL NO`-`JOINT NO`, the same
 * shape `load-ccc-joint-record.ts` uses, so it joins to `mv_joint` untranslated.
 *
 * RT% is deliberately NOT stored: the pbix's `RT% from Project WD+WR` is a
 * lookup of the union's RT% by Joint ID, and a stored copy could drift from
 * `mv_joint.rt_pct`. The measure joins it at read time.
 *
 * Safe to re-run: replaces the whole table, which it owns outright.
 */
import { Client } from "pg";
import path from "node:path";
import { openSync, readSync, closeSync, statSync } from "node:fs";
import {
  closeLoad, copyLine, copyRows, openLoad, parseDate,
  readDelimited, requireEnvUrl, sha256File, txt,
} from "./load-common";

const SOURCE = "TALISMAN_JOINT";
const FILE = process.env.TALISMAN_JOINT_PATH ?? "sources/Joint.csv";
const EXPECTED_LINES = 1_548_056;

/** The header line, read directly: `readDelimited` consumes it and needs the width. */
function readHeader(file: string): string[] {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const text = buf.subarray(0, n).toString("utf-8");
    const eol = text.indexOf("\n");
    return (eol < 0 ? text : text.slice(0, eol))
      .replace(/\r$/, "")
      .split(",")
      .map((c) => c.trim());
  } finally {
    closeSync(fd);
  }
}

const COLUMNS = [
  "joint_id", "load_id", "subcon_code", "weld_date",
  "rt1_date", "rt1_rep_no", "rt1_result", "orig_repair_delete_flag",
] as const;

async function main(): Promise<void> {
  const abs = path.resolve(FILE);
  const size = statSync(abs).size;
  const sha = await sha256File(abs);
  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();

  let lines = 0;
  let droppedDelete = 0;
  let blankJoint = 0;
  const flags = new Map<string, number>();

  try {
    const loadId = await openLoad(client, SOURCE, path.basename(abs), size, sha);
    console.log(`  load_id ${loadId}`);

    // `readDelimited` skips the header itself and needs the column count up
    // front, so read the first line directly to get both.
    const header = readHeader(abs);
    const idx: Record<string, number> = Object.fromEntries(
      header.map((c, i) => [c, i]),
    );
    for (const c of ["SUBCON CODE", "QCISO NO", "JOINT NO", "SPOOL NO",
                     "ORIGINAL REPAIR DELETE FLAG", "WELD DATE",
                     "RT1 DATE", "RT1 REP NO", "RT1 RESULT"]) {
      if (idx[c] === undefined) throw new Error(`missing column: ${c}`);
    }

    async function* rows(): AsyncGenerator<string> {
      for await (const line of readDelimited(abs, {
        delimiter: ",",
        encoding: "utf-8",
        width: header.length,
        // Six rows near the end of the sibling guide file have ragged widths;
        // truncate rather than fail, the way every other loader here does.
        mode: "truncate",
      })) {
        const f = line.fields;
        const g = (c: string) => (f[idx[c]!] ?? "").trim();
        // `readDelimited` yields the header line too, despite its doc comment.
        // Recognised by CONTENT, not position: no data row can have the literal
        // column name in its first field, and this stays correct whichever way
        // the reader changes.
        if (g("SUBCON CODE") === "SUBCON CODE") continue;
        lines += 1;
        const flag = g("ORIGINAL REPAIR DELETE FLAG");
        flags.set(flag === "" ? "(blank)" : flag, (flags.get(flag) ?? 0) + 1);
        // The M's own filter: deleted rows never reach the model.
        if (flag === "D") { droppedDelete += 1; continue; }
        const iso = g("QCISO NO");
        const joint = g("JOINT NO");
        if (iso === "" || joint === "") { blankJoint += 1; continue; }
        yield copyLine([
          `${iso}-${g("SPOOL NO")}-${joint}`,
          String(loadId),
          txt(g("SUBCON CODE")),
          parseDate(g("WELD DATE")),
          parseDate(g("RT1 DATE")),
          txt(g("RT1 REP NO")),
          txt(g("RT1 RESULT")),
          txt(flag),
        ]);
      }
    }

    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE tmp_talisman (
      joint_id text, load_id bigint, subcon_code text, weld_date date,
      rt1_date date, rt1_rep_no text, rt1_result text,
      orig_repair_delete_flag text) ON COMMIT DROP`);
    const t0 = Date.now();
    const copied = await copyRows(client, "tmp_talisman", [...COLUMNS], rows(), {
      label: "Joint.csv -> tmp_talisman",
      onProgress: (n) => console.log(`  ... ${n} rows`),
    });
    console.log(`  copy ${copied} rows in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

    await client.query("DELETE FROM ref_talisman_joint");
    // MAX() per joint, the same collapse the CCC joint record uses: the export
    // can carry several rows per joint (original + repairs) and the measure is
    // a DISTINCTCOUNT over joints.
    const collapsed = await client.query(`
      INSERT INTO ref_talisman_joint (
        joint_id, load_id, subcon_code, weld_date, rt1_date,
        rt1_rep_no, rt1_result, orig_repair_delete_flag, source_rows)
      SELECT joint_id, max(load_id), max(subcon_code), max(weld_date), max(rt1_date),
             max(rt1_rep_no), max(rt1_result), max(orig_repair_delete_flag), count(*)
        FROM tmp_talisman GROUP BY joint_id`);
    await client.query("COMMIT");

    const joints = collapsed.rowCount ?? 0;
    const dupes = await client.query<{ n: string }>(
      "SELECT count(*) AS n FROM ref_talisman_joint WHERE source_rows > 1",
    );
    console.log(`  physical data lines ${lines} (expected ${EXPECTED_LINES})`);
    console.log(`  flags ${[...flags].map(([k, v]) => `${k}->${v}`).join(", ")}`);
    console.log(`  dropped DELETE flag 'D' ${droppedDelete}`);
    if (blankJoint) console.log(`  skipped, blank ISO or JOINT NO ${blankJoint}`);
    console.log(`  distinct joints ${joints}, of which ${dupes.rows[0].n} had > 1 row`);

    await client.query("VACUUM (ANALYZE) ref_talisman_joint");
    await closeLoad(client, loadId, lines, joints, droppedDelete, {
      distinct_joints: joints,
      duplicated_joints: Number(dupes.rows[0].n),
    });
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
