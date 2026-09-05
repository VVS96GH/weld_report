/**
 * Tests for scripts/token-lint.mjs, the T.EN design-system CI guard.
 *
 * Two kinds of coverage:
 *   - end-to-end: spawn the script against fixture files under
 *     tests/fixtures/token-lint/ and assert on exit code + stdout;
 *   - unit: import the exported `contrastRatio` (and friends) directly and
 *     check known WCAG pairs.
 *
 * Runs with no database and does not touch app/styles/tokens.css — the
 * theme lane may not have landed yet, so every path here is self-contained
 * fixtures under tests/fixtures/token-lint/.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts/token-lint.mjs");
const FIXTURES = path.join(ROOT, "tests/fixtures/token-lint");

function run(args: string[]) {
  const result = spawnSync("node", [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("token-lint CLI", () => {
  it("exits 0 on a fully-compliant tokens file and clean source", () => {
    const { status, stdout } = run([
      "--tokens",
      path.join(FIXTURES, "good.css"),
      "--src",
      `${path.join(FIXTURES, "src-clean")}/**/*.tsx`,
    ]);
    expect(stdout).not.toMatch(/^FAIL/m);
    expect(stdout).toMatch(/token-lint: \d+ checks, 0 failures/);
    expect(status).toBe(0);
  });

  it("exits 1 and names both violated rules on the planted-defect tokens file", () => {
    const { status, stdout } = run([
      "--tokens",
      path.join(FIXTURES, "defect.css"),
      "--src",
      `${path.join(FIXTURES, "src-clean")}/**/*.tsx`,
    ]);
    expect(status).toBe(1);
    // Rule 1: --muted vs --bg/--surface on light, contrast ~3.5-3.6 < 4.5.
    expect(stdout).toMatch(/FAIL 1 light --muted vs --(bg|surface)/);
    // Rule 3: --warn vs --on-warn, contrast ~3.0 < 4.5.
    expect(stdout).toMatch(/FAIL 3 \w+ --warn vs --on-warn/);
  });

  it("exits 2 with a clear message when the tokens file does not exist", () => {
    const { status, stderr } = run([
      "--tokens",
      path.join(FIXTURES, "does-not-exist.css"),
      "--src",
      `${path.join(FIXTURES, "src-clean")}/**/*.tsx`,
    ]);
    expect(status).toBe(2);
    expect(stderr).toMatch(/tokens file not found/i);
  });

  it("reports exactly three FAILs, with the right rule ids, on the mixed source fixture", () => {
    const { status, stdout } = run([
      "--tokens",
      path.join(FIXTURES, "good.css"),
      "--src",
      `${path.join(FIXTURES, "src-mixed")}/**/*.tsx`,
    ]);
    expect(status).toBe(1);
    const fails = stdout.split("\n").filter((l) => l.startsWith("FAIL"));
    expect(fails).toHaveLength(3);

    const byRule = Object.fromEntries(fails.map((l) => [l.split(" ")[1], l]));
    expect(byRule["4"]).toMatch(/HexColor\.tsx:\d+/);
    expect(byRule["4"]).toMatch(/#123456/);
    expect(byRule["6"]).toMatch(/AlphaTrap\.tsx:\d+/);
    expect(byRule["6"]).toMatch(/bg-accent\/20/);
    expect(byRule["7"]).toMatch(/Physical\.tsx:\d+/);
    expect(byRule["7"]).toMatch(/pl-4/);
  });

  it("--json produces machine-readable output with the same failure count", () => {
    const { status, stdout } = run([
      "--tokens",
      path.join(FIXTURES, "defect.css"),
      "--src",
      `${path.join(FIXTURES, "src-clean")}/**/*.tsx`,
      "--json",
    ]);
    expect(status).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.failures).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(parsed.results)).toBe(true);
    const rules = new Set(
      parsed.results.filter((r: { pass: boolean }) => r.pass === false).map((r: { rule: string }) => r.rule),
    );
    expect(rules.has("1")).toBe(true);
    expect(rules.has("3")).toBe(true);
  });
});

describe("contrastRatio (unit)", () => {
  it("computes known WCAG pairs within tolerance", async () => {
    const { contrastRatio } = await import("../scripts/token-lint.mjs");
    expect(contrastRatio("white", "black")).toBeCloseTo(21, 5);
    expect(contrastRatio("#0070ef", "white")).toBeCloseTo(4.6, 1);
    expect(contrastRatio("#004c84", "white")).toBeCloseTo(8.87, 1);
  });
});
