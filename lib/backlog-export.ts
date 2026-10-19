/**
 * The joint lists behind two cells of "Project RT & PWHT Status by Sub-Contractor"
 * (page Project Welding & NDE Status), exported with every weld row and column
 * of the Data page (owner, 2026-10-19):
 *
 *   rt    RT B.Log Total — RT BACKLOG Total Project "PR all" (flag rt_backlog_prall)
 *   pwht  PWHT B.Log All — PWHT All BACKLOG All WELD TYPE "PR all" (New PBI Rule):
 *         the CCC branch (PWHT Y/N CCC (NEW) = "Y", no PWHT Report No CCC) plus the
 *         rest (PWHT Weld Status on hold, no PWHT Report) — flags pwht_backlog_ccc / _rest
 *
 * The scope is the table's own: the project (loaded sources less Inco) without
 * Weld Cat J, so the joint counts are the table's Total row.
 */
import { query } from "@/lib/db";
import { Params, projectScope, scopeWhere } from "@/lib/metrics/scope";
import { gridCsv, parseColumns } from "@/lib/pages/data-grid";

export type BacklogKind = "rt" | "pwht";

const FLAG: Record<BacklogKind, string> = {
  rt: "w.rt_backlog_prall",
  pwht: "(w.pwht_backlog_ccc OR w.pwht_backlog_rest)",
};

export async function backlogJoints(kind: BacklogKind): Promise<string[]> {
  const p = new Params();
  const where = scopeWhere({ ...projectScope({ temporaryLines: false }), excludeWeldCats: ["J"] }, p);
  const rows = await query<{ joint_id: string }>(
    `SELECT DISTINCT w.joint_id FROM mv_joint w WHERE ${where} AND ${FLAG[kind]} AND w.joint_id IS NOT NULL ORDER BY 1`,
    p.list(),
  );
  return rows.map((r) => r.joint_id);
}

/** Every weld row of those joints, every Data-page column (welders included). */
export async function* backlogCsv(kind: BacklogKind): AsyncGenerator<string> {
  const joints = await backlogJoints(kind);
  if (!joints.length) {
    yield "﻿No joints\r\n";
    return;
  }
  yield* gridCsv({ joint_id: { in: joints } }, parseColumns(null));
}
