import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { clampLayout } from "@/lib/graph-layout";

import { audited } from "@/lib/audit";
/** Graph-page sizes the owner set with the handles: { [pageKey]: GraphLayout }. */
const FILE = path.join(process.cwd(), "data", "graph-layout.json");

async function readAll(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET() {
  return Response.json(await readAll());
}

async function POST_handler(req: Request) {
  const body = (await req.json().catch(() => null)) as { page?: string; layout?: Record<string, unknown> | null } | null;
  if (!body?.page || typeof body.page !== "string") return Response.json({ error: "page required" }, { status: 400 });
  const all = await readAll();
  if (body.layout) all[body.page] = { ...clampLayout(body.layout), savedAt: new Date().toISOString() };
  else delete all[body.page];
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(all, null, 2) + "\n");
  return Response.json({ ok: true });
}

// the activity log (lib/audit.ts)
export const POST = audited("Graph sizes", POST_handler);
