/** GET: the data version (latest load + applied migrations), for components/DataVersionWatch. */
import { currentDataVersion } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const v = await currentDataVersion().catch(() => null);
  return Response.json({ version: v }, { headers: { "Cache-Control": "no-store" } });
}
