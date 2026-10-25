import { describe, expect, it } from "vitest";

import { estimateRefresh } from "@/lib/refresh-eta";

const LOG = [
  "[refresh] started 2026-10-25 09:16:16",
  "  RUN   weld-dump    Weld Dump",
  "  RUN   ccc          CCC welder record (~7 min)",
  "  skip  inco         Inco",
  "[refresh 09:16:22] ▶ weld-dump — changed: Weld Dump.txt",
].join("\n");

describe("estimateRefresh", () => {
  it("adds the steps not started, the rest of the current one, matviews and the restart", () => {
    const now = new Date(2026, 9, 25, 9, 18, 22); // 2 min into weld-dump
    const eta = estimateRefresh(LOG, {}, now);
    expect(eta.steps).toBe(3); // weld-dump, ccc, matviews (skipped steps do not count)
    expect(eta.stepIndex).toBe(1);
    expect(eta.current).toBe("weld-dump");
    // weld-dump 330 - 120 + ccc 650 + matviews 300 + restart 60
    expect(eta.secondsLeft).toBe(1220);
  });

  it("uses last run's durations and drops finished steps", () => {
    const log = `${LOG}\n[refresh 09:21:00] ✔ weld-dump in 4 min 38 s\n[refresh 09:21:00] ▶ ccc — changed`;
    const eta = estimateRefresh(log, { ccc: 400_000, matviews: 100_000 }, new Date(2026, 9, 25, 9, 22, 0));
    expect(eta.stepIndex).toBe(2);
    expect(eta.secondsLeft).toBe(400 - 60 + 100 + 60);
  });

  it("knows nothing before the plan is printed", () => {
    expect(estimateRefresh("[refresh] started", {}, new Date()).secondsLeft).toBeNull();
  });
});
