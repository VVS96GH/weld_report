import { describe, expect, it } from "vitest";

import { viewProgress, type Progress } from "@/lib/refresh-progress";
import { checkSteps } from "@/lib/refresh-run";

describe("refresh progress timer", () => {
  const t0 = Date.UTC(2026, 10, 8, 12, 0, 0);
  const p: Progress = {
    pid: 1,
    startedAt: t0,
    finishedAt: null,
    ok: null,
    error: null,
    steps: [
      { id: "weld-dump", title: "Weld Dump", reason: "", status: "done", startedAt: t0, finishedAt: t0 + 300_000 },
      { id: "ccc", title: "CCC", reason: "", status: "running", startedAt: t0 + 300_000 },
      { id: "matviews", title: "Views", reason: "", status: "pending" },
    ],
  };

  it("adds the running step's rest, the pending steps and the restart", () => {
    const now = t0 + 300_000 + 200_000; // CCC 200 s in
    const v = viewProgress(p, { ccc: 650_000, matviews: 300_000 }, now);
    expect(v.running).toBe(true);
    expect(v.current).toBe("CCC");
    expect(v.remainingSeconds).toBe(450 + 300 + 60);
    expect(v.elapsedSeconds).toBe(500);
  });

  it("a step past its estimate still has a few seconds left", () => {
    const v = viewProgress(p, { ccc: 10_000, matviews: 0 }, t0 + 900_000);
    expect(v.remainingSeconds).toBe(5 + 0 + 60);
  });

  it("nothing ran: no timer", () => {
    expect(viewProgress(null, {}).startedAt).toBeNull();
  });
});

describe("--only step ids", () => {
  it("accepts known steps only", () => {
    expect(checkSteps(["ccc", "flange"])).toEqual({ ok: true, ids: ["ccc", "flange"] });
    expect(checkSteps(["ccc; rm -rf /"]).ok).toBe(false);
    expect(checkSteps([]).ok).toBe(false);
    expect(checkSteps("ccc").ok).toBe(false);
  });
});
