import type { Metadata } from "next";

import { ErrorsView } from "@/components/ErrorsView";
import { resolvePageSource } from "@/lib/page-source";
import { getErrorsPage } from "@/lib/pages/errors";

// Errors are read live from the loaded data; nothing to prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Errors — Welding Statistics Dashboard" };

export default async function ErrorsPage(props: PageProps<"/errors">) {
  // The checks are computed from the database only; the fixture build (CI e2e) shows a note.
  if (resolvePageSource() !== "database") {
    return (
      <ErrorsView
        page={{ as_of: "—", checks: [] }}
        note="The error checks are computed from the database only; PAGE_SOURCE=fixture shows this note instead."
      />
    );
  }
  const params = await props.searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) flat[k] = (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const page = await getErrorsPage(flat);
  // Each check carries its own slicers inside its card; there is no page-wide bar.
  return <ErrorsView page={page} />;
}
