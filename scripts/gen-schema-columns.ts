/**
 * Generates the two column-heavy migrations from the profiled column contract
 * (analysis/dump/columns.json -> scripts/weld-columns.ts).  223 staging columns
 * and 194 typed columns are not something anyone should hand-type.
 *
 *   node --import tsx scripts/gen-schema-columns.ts            # write the files
 *   node --import tsx scripts/gen-schema-columns.ts --check    # fail if committed != generated
 *
 * The generated SQL IS committed; this script exists so it can be regenerated
 * and so drift is detectable in CI.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./weld-columns";
import { buildStagingDdl, buildWeldDdl } from "./weld-sql";

const TARGETS: { file: string; build: () => string }[] = [
  { file: "db/migrations/0002_stg_weld_dump.sql", build: buildStagingDdl },
  { file: "db/migrations/0003_weld.sql", build: buildWeldDdl },
];

function main(): void {
  const check = process.argv.includes("--check");
  let drift = 0;
  for (const t of TARGETS) {
    const abs = path.join(REPO_ROOT, t.file);
    const next = `${t.build().trimEnd()}\n`;
    const current = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    if (check) {
      if (current !== next) {
        console.error(`DRIFT  ${t.file} differs from the generator output`);
        drift += 1;
      } else {
        console.log(`ok     ${t.file}`);
      }
      continue;
    }
    if (current === next) {
      console.log(`unchanged  ${t.file}`);
    } else {
      writeFileSync(abs, next, "utf8");
      console.log(`wrote      ${t.file} (${next.split("\n").length} lines)`);
    }
  }
  if (drift > 0) process.exitCode = 1;
}

main();
