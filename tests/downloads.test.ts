import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { allowDownload, countDownload, LIMIT, stampXlsx, WINDOW_MS } from "@/lib/downloads";

describe("downloads (owner, 2026-11-11)", () => {
  it("stamps who exported an Excel file and keeps its sheets", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("A").getCell("A1").value = 42;
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const out = await stampXlsx(buf, "someone@example.com", "Welding Statistics Dashboard", "x.xlsx");
    const zip = await JSZip.loadAsync(out);
    const core = await zip.file("docProps/core.xml")!.async("string");
    expect(core).toContain("someone@example.com");
    expect(core).toContain("Exported by");
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(out);
    expect(back.getWorksheet("A")!.getCell("A1").value).toBe(42);
  });

  it("leaves bytes that are not a workbook alone", async () => {
    const raw = new TextEncoder().encode("a,b\n1,2\n").buffer as ArrayBuffer;
    expect(await stampXlsx(raw, "a", "b")).toBe(raw);
  });

  it("allows LIMIT files per user in the window", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < LIMIT; i++) {
      expect(allowDownload(key, 1000)).toBe(true);
      countDownload(key, 1000);
    }
    expect(allowDownload(key, 2000)).toBe(false);
    expect(allowDownload(key, 1000 + WINDOW_MS + 1)).toBe(true);
  });
});
