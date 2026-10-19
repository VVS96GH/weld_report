import type { Metadata } from "next";

import { DataGridView } from "@/components/DataGridView";
import { GRID_COLUMNS, GRID_DEFAULT_COLUMNS } from "@/lib/data-grid-columns";
import { resolvePageSource } from "@/lib/page-source";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Data — Welding Statistics Dashboard" };

/** The detailed weld table (owner, 2026-10-19): every row, filtered column by column. */
export default function DataPage() {
  if (resolvePageSource() !== "database") {
    return <p className="error-empty">The Data page reads the database only.</p>;
  }
  return <DataGridView columns={GRID_COLUMNS} defaults={GRID_DEFAULT_COLUMNS} />;
}
