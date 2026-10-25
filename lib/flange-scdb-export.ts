/**
 * The SCDB import form "14_SCDB_Import_Form_Flange_Progress_Template" filled from
 * Flange Progress (owner request 2026-10-25), as the owner's own 25-Oct workbook:
 *
 * - rows: Flange Progress (not ovAssets_1619), the rows the owner's calculated
 *   column "Joint ID Max Joint_Date" keeps — a Joint ID listed once; else its rows
 *   with a blank Joint Date if it has any; else its rows with the latest Joint Date —
 *   for GAC, MEDGULF and TEKFEN;
 * - a Joint ID that keeps two or more rows (equal blank / equal latest dates) is
 *   marked in Remarks and highlighted, not dropped (owner: show them);
 * - Cat. "TBN" goes out blank; a Report Number loses its leading spaces;
 * - P repeats the Tightening Date as text 'M/D/YYYY — the SCDB load format;
 * - N, O: SubSystem and PDS Area Final (the weld table's PDS Area of the same ISO,
 *   else the flange's own — the pbix column).
 */
import { PassThrough, Readable } from "node:stream";

import ExcelJS from "exceljs";

import { query } from "@/lib/db";

export const SCDB_SUBCONTRACTORS = ["GAC", "MEDGULF", "TEKFEN"] as const;

const LABELS = [
  "", "Serial No of Field Tag", "Tightening Date", "Test Pack No", "Report Number", "Verified Date",
  "Re-Tightening Date", "Category for final tightening", "Flange Repair Record",
  "Construction Responsible Company - Field021 (Custom)", "Commissioning Responsible Company - Field022 (Custom)",
  "Drawing No.", "Crew ID - Field034 (Custom)", "", "", "", "Remarks",
];
const FIELDS = [
  "Asset - Name/Tag", "Field023 (Custom)", "Field027 (Custom)", "Field029 (Custom)", "Field031 (Custom)",
  "Field024 (Custom)", "Field028 (Custom)", "Field030 (Custom)", "Field032 (Custom)", "Field021 (Custom)",
  "Field022 (Custom)", "Field033 (Custom)", "Field034 (Custom)", "SubSystem", "PDS Area Final", "Tightening Date",
  "Remarks",
];
const SOURCES = [
  "Joint ID", "", "Joint Date", "Test Pack", "Report Nbr", "", "", "Cat.", "", "Flange Subcontractor", "",
  "Iso Number", "Jointer", "SubSystem", "PDS Area Final", "", "",
];
const WIDTHS = [34, 12, 14, 24, 26, 12, 12, 12, 12, 18, 18, 26, 14, 14, 14, 14, 60];

type Row = {
  joint_id: string;
  joint_date: string | null;
  test_pack: string | null;
  report_nbr: string | null;
  cat: string | null;
  sub: string;
  iso: string | null;
  jointer: string | null;
  subsystem: string | null;
  pds_final: string | null;
  kept: string;
  blank_tie: boolean;
};

export async function scdbRows(): Promise<Row[]> {
  return query<Row>(
    `WITH f AS (
       SELECT fl.*, count(*) OVER w AS n, bool_or(joint_date IS NULL) OVER w AS has_blank,
              max(joint_date) OVER w AS mx
         FROM flange fl
        WHERE source = 'FLANGE_PROGRESS'
       WINDOW w AS (PARTITION BY joint_id)
     ), kept AS (
       SELECT f.*, count(*) OVER (PARTITION BY joint_id) AS k
         FROM f
        WHERE n = 1 OR (has_blank AND joint_date IS NULL) OR (NOT has_blank AND joint_date = mx)
     ), vpr AS (
       SELECT iso_number, max(pds_area) AS pds FROM weld
        WHERE iso_number IN (SELECT iso_number FROM kept) GROUP BY 1
     )
     SELECT k.joint_id, k.joint_date::text AS joint_date, k.test_pack,
            nullif(regexp_replace(k.report_nbr, '^\\s+', ''), '') AS report_nbr,
            nullif(nullif(k.cat, 'TBN'), '') AS cat, k.sub_contractor AS sub, k.iso_number AS iso,
            k.jointer, k.subsystem, coalesce(v.pds, k.pds_area) AS pds_final,
            k.k::text AS kept, (k.has_blank AND k.k > 1) AS blank_tie
       FROM kept k LEFT JOIN vpr v USING (iso_number)
      WHERE k.sub_contractor = ANY($1)
      ORDER BY k.sub_contractor, k.iso_number, k.joint_id, k.joint_date NULLS FIRST, k.report_nbr`,
    [[...SCDB_SUBCONTRACTORS]],
  );
}

const textDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `'${Number(m)}/${Number(d)}/${y}`;
};

const HIGHLIGHT: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };

/** The workbook, streamed: 130k rows are not built in memory. */
export async function scdbWorkbook(): Promise<{ rows: number; ties: number; stream: ReadableStream<Uint8Array> }> {
  const rows = await scdbRows();
  const pass = new PassThrough();
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: true });
  const ws = wb.addWorksheet("FLANGE PROGRESS", { views: [{ state: "frozen", ySplit: 3 }] });
  ws.columns = WIDTHS.map((width) => ({ width }));
  for (const [i, header] of [LABELS, FIELDS, SOURCES].entries()) {
    const r = ws.addRow(header);
    r.font = { bold: i < 2, italic: i === 2 };
    r.commit();
  }
  let ties = 0;
  for (const x of rows) {
    const k = Number(x.kept);
    const remark =
      k > 1
        ? x.blank_tie
          ? `Duplicate Joint ID: ${k} rows with a blank Joint Date — "Joint ID Max Joint_Date" keeps all of them`
          : `Duplicate Joint ID: ${k} rows with the same latest Joint Date — "Joint ID Max Joint_Date" keeps all of them`
        : null;
    const r = ws.addRow([
      x.joint_id,
      null,
      x.joint_date ? new Date(`${x.joint_date}T00:00:00Z`) : null,
      x.test_pack,
      x.report_nbr,
      null,
      null,
      x.cat,
      null,
      x.sub,
      null,
      x.iso,
      x.jointer,
      x.subsystem,
      x.pds_final,
      x.joint_date ? textDate(x.joint_date) : null,
      remark,
    ]);
    r.getCell(3).numFmt = "m/d/yyyy";
    if (remark) {
      ties += 1;
      for (let c = 1; c <= 17; c++) r.getCell(c).fill = HIGHLIGHT;
    }
    r.commit();
  }
  ws.commit();
  void wb.commit();
  return { rows: rows.length, ties, stream: Readable.toWeb(pass) as ReadableStream<Uint8Array> };
}
