/**
 * `sources/HA.csv` -> `ref_ha_area`: the pbix's (HA, Area Classification)
 * slicer hierarchy.
 *
 * 41 pairs, UTF-8 with a BOM, CRLF line endings. The mapping is MANY-TO-MANY --
 * `Train-9 Process` sits under both HA2 and HA3 -- so the table is keyed on the
 * PAIR, not on the area.
 *
 * This supplies the slicer's child lists. It does NOT decide any joint's HA:
 * that still comes from migration 0027's label derivation, which stands in for
 * the absent `HA l0_abs_guide` PDS-Area lookup. The many-to-many shape is in
 * fact the proof that the stand-in must be an approximation -- a label alone
 * cannot choose between HA2 and HA3.
 *
 * Safe to re-run: replaces the whole table, which it owns outright.
 */
import { Client } from "pg";
import path from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { closeLoad, openLoad, requireEnvUrl, sha256File } from "./load-common";

const SOURCE = "HA_GUIDE";
const FILE = process.env.HA_GUIDE_PATH ?? "sources/HA.csv";
const EXPECTED_PAIRS = 41;

/** `sources/l0_abs_guide.csv` -> `ref_ha_guide`. */
const GUIDE_FILE = process.env.L0_ABS_GUIDE_PATH ?? "sources/l0_abs_guide.csv";
const GUIDE_COLUMNS = [
  "handover_area", "location_number", "location_name", "location_summary",
  "area_number", "area_name", "area_summary",
  "facility_number", "facility_name", "facility_summary",
  "project_number", "project_name", "project_summary",
] as const;

type GuideRow = {
  values: (string | null)[];
  malformed: boolean;
};

/**
 * Tolerant, quote-free parse — the pbix reads this file with QuoteStyle.None.
 *
 * The file is ASCII with mixed quoting: most rows plain, some fields quoted
 * because they contain commas, and six rows near the end with UNBALANCED
 * quotes. Handover Area and Location Number never contain a comma, so they are
 * always fields 0 and 1 and are always trustworthy. A row that does not split
 * into exactly 13 keeps those two, leaves the descriptive columns NULL, and is
 * flagged — marked rather than dropped, so the count stays visible.
 */
function parseGuide(text: string): GuideRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const header = lines.shift() ?? "";
  if (!header.toLowerCase().startsWith("handover area,location number")) {
    throw new Error(`unexpected header: ${header.slice(0, 80)}`);
  }
  const out: GuideRow[] = [];
  for (const line of lines) {
    const f = line.split(",");
    const ha = (f[0] ?? "").trim();
    const loc = (f[1] ?? "").trim();
    if (loc === "") continue;
    if (f.length === GUIDE_COLUMNS.length) {
      out.push({ values: f.map((v) => (v.trim() === "" ? null : v.trim())), malformed: false });
    } else {
      const values: (string | null)[] = new Array(GUIDE_COLUMNS.length).fill(null);
      values[0] = ha === "" ? null : ha;
      values[1] = loc;
      out.push({ values, malformed: true });
    }
  }
  return out;
}

async function loadGuide(client: Client): Promise<void> {
  const abs = path.resolve(GUIDE_FILE);
  const rows = parseGuide(readFileSync(abs, "utf-8"));
  const byLoc = new Map<string, GuideRow>();
  for (const r of rows) byLoc.set(String(r.values[1]), r);
  const malformed = rows.filter((r) => r.malformed).length;
  const withHa = rows.filter((r) => r.values[0] !== null).length;
  console.log(
    `  l0_abs_guide: ${rows.length} rows, ${byLoc.size} distinct Location Number, ` +
      `${withHa} with a Handover Area, ${malformed} malformed (kept, flagged)`,
  );
  const counts = new Map<string, number>();
  for (const r of rows) {
    const ha = r.values[0];
    if (ha) counts.set(ha, (counts.get(ha) ?? 0) + 1);
  }
  for (const ha of [...counts.keys()].sort()) console.log(`  ${ha}: ${counts.get(ha)}`);

  const size = statSync(abs).size;
  const loadId = await openLoad(
    client, "HA_L0_GUIDE", path.basename(abs), size, await sha256File(abs),
  );
  await client.query("BEGIN");
  await client.query("DELETE FROM ref_ha_guide");
  for (const r of byLoc.values()) {
    await client.query(
      `INSERT INTO ref_ha_guide (${GUIDE_COLUMNS.join(", ")}, is_malformed, load_id)` +
        ` VALUES (${GUIDE_COLUMNS.map((_, i) => `$${i + 1}`).join(", ")}, $14, $15)`,
      [...r.values, r.malformed, loadId],
    );
  }
  await client.query("COMMIT");
  await closeLoad(client, loadId, rows.length, byLoc.size, 0, { malformed });
}

function parse(text: string): Array<{ ha: string; area: string }> {
  // Strip the BOM, accept CRLF or LF, drop the header and any blank tail line.
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const header = lines.shift() ?? "";
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  if (cols[0] !== "ha" || !cols[1]?.startsWith("area")) {
    throw new Error(`unexpected header: ${header}`);
  }
  const out: Array<{ ha: string; area: string }> = [];
  for (const line of lines) {
    // Two columns, and no area label in the file contains a comma.
    const i = line.indexOf(",");
    if (i < 0) throw new Error(`unparseable row: ${line}`);
    const ha = line.slice(0, i).trim();
    const area = line.slice(i + 1).trim();
    if (ha === "" || area === "") throw new Error(`blank field in row: ${line}`);
    out.push({ ha, area });
  }
  return out;
}

async function main(): Promise<void> {
  const abs = path.resolve(FILE);
  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    // HA.csv is OPTIONAL. The owner replaced it with l0_abs_guide.csv, and
    // `ref_ha_area` (the 41 slicer pairs) is already loaded; skipping is
    // correct, wiping the table because the file went away is not.
    if (!existsSync(abs)) {
      console.log(`  ${FILE} absent — leaving ref_ha_area as loaded`);
      await loadGuide(client);
      return;
    }
    const pairs = parse(readFileSync(abs, "utf-8"));
    const unique = new Map(pairs.map((p) => [`${p.ha} ${p.area}`, p]));
    console.log(
      `  rows ${pairs.length}  distinct pairs ${unique.size}  (expected ${EXPECTED_PAIRS})`,
    );
    if (unique.size !== EXPECTED_PAIRS) {
      // Loud, not fatal: the file is the owner's and may legitimately grow.
      console.log(`  NOTE pair count differs from the ${EXPECTED_PAIRS} first delivered`);
    }
    for (const ha of [...new Set(pairs.map((p) => p.ha))].sort()) {
      const areas = pairs.filter((p) => p.ha === ha).map((p) => p.area);
      console.log(`  ${ha}: ${areas.length} areas`);
    }
    const size = statSync(abs).size;
    const loadId = await openLoad(
      client, SOURCE, path.basename(abs), size, await sha256File(abs),
    );

    await client.query("BEGIN");
    await client.query("DELETE FROM ref_ha_area");
    for (const p of unique.values()) {
      await client.query(
        "INSERT INTO ref_ha_area (ha, area_classification, load_id) VALUES ($1, $2, $3)",
        [p.ha, p.area, loadId],
      );
    }
    await client.query("COMMIT");
    await closeLoad(client, loadId, pairs.length, unique.size, 0, {
      distinct_ha: new Set(pairs.map((p) => p.ha)).size,
    });
    console.log(`  loaded ${unique.size} pairs`);

    // The full guide, in the same script: both files describe the same
    // hierarchy and are always delivered together.
    await loadGuide(client);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
