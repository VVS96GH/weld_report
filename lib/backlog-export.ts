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
 * PWHT also takes, as a second check (owner, 2026-10-19), the CCC joints the
 * calculated column PWHT Y/N CCC (NEW) marks "Y" — the 16-branch rule, flag
 * pwht_backlog_ccc_new (migration 0034) — with a weld date and no PWHT Report No
 * CCC; joints only that rule finds are added. A leading "B.Log rule" column says
 * which rule(s) listed each joint.
 *
 * The scope is the table's own: the project (loaded sources less Inco) without
 * Weld Cat J, so the joint counts are the table's Total row.
 */
import { query } from "@/lib/db";
import { Params, projectScope, scopeWhere } from "@/lib/metrics/scope";
import ExcelJS from "exceljs";

import { gridCsv, gridMatrix, parseColumns } from "@/lib/pages/data-grid";

export type BacklogKind = "rt" | "pwht";

/** Each joint's rule, as the leading column reads it. */
const RULE: Record<BacklogKind, string> = {
  rt: `'RT BACKLOG Total Project "PR all"'`,
  pwht: `concat_ws(' + ',
           CASE WHEN w.pwht_backlog_ccc IS TRUE THEN 'PWHT Y/N CCC = Y, no PWHT Report No CCC' END,
           CASE WHEN w.pwht_backlog_ccc_new IS TRUE THEN 'PWHT Y/N CCC (NEW) = Y, no PWHT Report No CCC' END,
           CASE WHEN w.pwht_backlog_rest IS TRUE THEN 'PWHT Weld Status on hold, no PWHT Report' END)`,
};
const FLAG: Record<BacklogKind, string> = {
  rt: "w.rt_backlog_prall IS TRUE",
  pwht: "(w.pwht_backlog_ccc IS TRUE OR w.pwht_backlog_ccc_new IS TRUE OR w.pwht_backlog_rest IS TRUE)",
};

export async function backlogRules(kind: BacklogKind): Promise<Map<string, string>> {
  const p = new Params();
  const where = scopeWhere({ ...projectScope({ temporaryLines: false }), excludeWeldCats: ["J"] }, p);
  const rows = await query<{ joint_id: string; rule: string }>(
    `SELECT w.joint_id, string_agg(DISTINCT ${RULE[kind]}, ' | ') AS rule
       FROM mv_joint w WHERE ${where} AND ${FLAG[kind]} AND w.joint_id IS NOT NULL
      GROUP BY 1 ORDER BY 1`,
    p.list(),
  );
  return new Map(rows.map((r) => [r.joint_id, r.rule]));
}

/** WeldPoint No.1 WP1 (weldpoint_seq: the row's number within its Joint ID) leads, then every other column. */
const exportColumns = () => ["weldpoint_seq", ...parseColumns(null).filter((k) => k !== "weldpoint_seq")];
const WP1_LABEL = "WeldPoint No.1 WP1";

export async function backlogJoints(kind: BacklogKind): Promise<string[]> {
  return [...(await backlogRules(kind)).keys()];
}

/** Every weld row of those joints, every Data-page column (welders included). */
export async function* backlogCsv(kind: BacklogKind): AsyncGenerator<string> {
  const joints = await backlogJoints(kind);
  if (!joints.length) {
    yield "﻿No joints\r\n";
    return;
  }
  yield* gridCsv({ joint_id: { in: joints } }, exportColumns());
}

/** The same as an Excel workbook: one sheet, header frozen with filters, numbers and dates typed. */
export async function backlogXlsx(kind: BacklogKind): Promise<{ joints: number; rows: number; body: Buffer }> {
  const rules = await backlogRules(kind);
  const joints = [...rules.keys()];
  const { cols, rows } = joints.length
    ? await gridMatrix({ joint_id: { in: joints } }, exportColumns())
    : { cols: [], rows: [] };
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(kind === "rt" ? "RT B.Log" : "PWHT B.Log", { views: [{ state: "frozen", ySplit: 1 }] });
  const jointAt = cols.findIndex((c) => c.key === "joint_id");
  // WeldPoint No.1 WP1 first, then the rule that listed the joint (owner, 2026-10-19)
  ws.columns = [
    { header: WP1_LABEL, key: "weldpoint_seq", width: 12 },
    { header: "B.Log rule", key: "__rule", width: 46 },
    ...cols.slice(1).map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.min(40, Math.max(10, c.label.length + 2)),
    style: c.type === "date" ? { numFmt: "dd-mmm-yy" } : undefined,
    })),
  ];
  for (const r of rows) {
    const typed = r.map((v, i) => {
        if (v === null || v === "") return null;
        const t = cols[i]!.type;
        if (t === "num") {
          const n = Number(v);
          return Number.isFinite(n) ? n : v;
        }
        if (t === "date" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(`${v.slice(0, 10)}T00:00:00Z`);
        return v;
      });
    ws.addRow([typed[0], rules.get(String(r[jointAt] ?? "")) ?? null, ...typed.slice(1)]);
  }
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 30;
  if (cols.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length + 1 } };
  const body = Buffer.from(await wb.xlsx.writeBuffer());
  return { joints: joints.length, rows: rows.length, body };
}
