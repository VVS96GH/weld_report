/**
 * GET — the SCDB import form "14_SCDB_Import_Form_Flange_Progress_Template" filled
 * from Flange Progress (GAC / MEDGULF / TEKFEN, one row per Joint ID by the owner's
 * "Joint ID Max Joint_Date" rule) — lib/flange-scdb-export.ts.
 */
import { scdbWorkbook } from "@/lib/flange-scdb-export";
import { resolvePageSource } from "@/lib/page-source";

import { audited } from "@/lib/audit";
export const dynamic = "force-dynamic";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

async function GET_handler(): Promise<Response> {
  if (resolvePageSource() !== "database") return Response.json({ error: "needs PAGE_SOURCE=database" }, { status: 503 });
  const { stream } = await scdbWorkbook();
  const t = new Date();
  // "… Template 25 oct-26.xlsx", as the owner names it
  const day = `${t.getDate()} ${MONTHS[t.getMonth()]}-${String(t.getFullYear()).slice(2)}`;
  const name = `14_SCDB_Import_Form_Flange_Progress_Template ${day}.xlsx`;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

// the activity log (lib/audit.ts)
export const GET = audited("Downloaded the SCDB form", GET_handler);
