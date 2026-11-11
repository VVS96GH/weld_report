/**
 * Downloads (owner, 2026-11-11: protect the site from copying). A route handler wrapped in
 * `guardDownloads()`:
 *   - logs every file it hands out (Excel, CSV, PDF) with who took it;
 *   - stamps an Excel file with who exported it and when (its document properties, File > Info);
 *   - lets one user take at most LIMIT files in WINDOW_MS, then answers 429.
 * A JSON answer of the same route (a mixed route such as /api/data) passes untouched.
 */
import JSZip from "jszip";
import type { NextRequest } from "next/server";

import { AUTH_EMAIL_HEADER, logEvent } from "@/lib/audit";

export const LIMIT = 30;
export const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();
const DOWNLOAD = /spreadsheetml|application\/pdf|text\/csv|application\/zip|octet-stream/;

function recent(key: string, now: number): number[] {
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.set(key, list);
  return list;
}

/** Room for one more file for this user (false: LIMIT taken in the window). */
export function allowDownload(key: string, now = Date.now()): boolean {
  return recent(key, now).length < LIMIT;
}

export function countDownload(key: string, now = Date.now()): void {
  recent(key, now).push(now);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The workbook with its document properties naming who exported it, when and from where. */
export async function stampXlsx(data: ArrayBuffer, who: string, site: string, title = ""): Promise<ArrayBuffer> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return data; // not a workbook: unchanged
  }
  const now = new Date();
  const at = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const day = now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const desc = `Exported by ${who || "unknown"} on ${day} UTC from ${site}`;
  const core =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${esc(title)}</dc:title><dc:creator>${esc(who || "unknown")}</dc:creator>` +
    `<cp:lastModifiedBy>${esc(who || "unknown")}</cp:lastModifiedBy>` +
    `<dc:description>${esc(desc)}</dc:description><cp:keywords>${esc(desc)}</cp:keywords>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${at}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${at}</dcterms:modified></cp:coreProperties>`;
  if (!zip.file("docProps/core.xml")) {
    const types = await zip.file("[Content_Types].xml")?.async("string");
    const rels = await zip.file("_rels/.rels")?.async("string");
    if (types)
      zip.file(
        "[Content_Types].xml",
        types.replace("</Types>", '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'),
      );
    if (rels)
      zip.file(
        "_rels/.rels",
        rels.replace(
          "</Relationships>",
          '<Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
        ),
      );
  }
  zip.file("docProps/core.xml", core);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

function fileName(disposition: string | null): string {
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)/.exec(disposition ?? "");
  return m ? decodeURIComponent(m[1] ?? m[2] ?? "") : "";
}

export function guardDownloads<C>(
  action: string,
  handler: (req: NextRequest, ctx: C) => Promise<Response>,
  /** a mixed route: which requests ask for a file (the limit only stops those) */
  asksFile: (req: NextRequest) => boolean = () => true,
) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const email = req.headers.get(AUTH_EMAIL_HEADER) ?? "";
    const key = email || "anonymous";
    if (asksFile(req) && !allowDownload(key)) {
      logEvent(req, email, action, 429, { path: req.nextUrl.pathname, denied: "too many downloads" });
      return Response.json({ error: "Too many downloads in a short time. Wait a few minutes, then try again." }, { status: 429 });
    }
    const res = await handler(req, ctx);
    const type = res.headers.get("content-type") ?? "";
    if (res.status !== 200 || !DOWNLOAD.test(type)) return res;
    countDownload(key);
    const name = fileName(res.headers.get("content-disposition"));
    const detail: Record<string, unknown> = { path: req.nextUrl.pathname, file: name };
    if (req.nextUrl.search) detail.query = req.nextUrl.search.slice(0, 500);
    logEvent(req, email, action, res.status, detail);
    if (!type.includes("spreadsheetml")) return res;
    const body = await stampXlsx(await res.arrayBuffer(), email, "Welding Statistics Dashboard", name);
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(body, { status: res.status, headers });
  };
}
