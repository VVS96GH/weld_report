/**
 * Types and constants of the WPS / Material page shared by the server
 * (lib/pages/wps-material.ts) and the client view — no database import here.
 */
import type { FilterWidget } from "@/lib/page-model";

export type WmTree = "wps" | "mat";
export type WmLevel = "mach" | "wps" | "mat" | "welder" | "sclass";

export const WM_LEVELS: Record<WmTree, WmLevel[]> = {
  wps: ["mach", "wps", "mat", "welder", "sclass"],
  mat: ["mat", "wps", "welder", "sclass"],
};

export const WM_LEVEL_LABEL: Record<WmLevel, string> = {
  mach: "Type of Welding",
  wps: "WPS No.",
  mat: "Material Type",
  welder: "Welder ID",
  sclass: "Service Class",
};

export type WmColumn = { key: string; label: string; fmt: "int" | "pct" };
export const WM_COLUMNS: WmColumn[] = [
  { key: "welders", label: "Welder ID", fmt: "int" },
  { key: "total", label: "Total Joints", fmt: "int" },
  { key: "welded", label: "Joints Welded", fmt: "int" },
  { key: "tp", label: "TP % Welded", fmt: "pct" },
  { key: "film", label: "RT FILM Rej Ratio %", fmt: "pct" },
  { key: "tested", label: "Numb RT/UT", fmt: "int" },
  { key: "ratio", label: "RT/UT Ratio %", fmt: "pct" },
  { key: "acc", label: 'Numb RT/UT "A"', fmt: "int" },
  { key: "rej", label: 'Numb RT/UT "R"', fmt: "int" },
  { key: "rate", label: "Rejection Rate Joint", fmt: "pct" },
];

export type WmRow = { label: string; values: Record<string, number | null>; expandable: boolean };

export type WmPageData = {
  filters: FilterWidget[];
  cards: { film: number | null; wps: number; materials: number; welders: number };
  columns: WmColumn[];
  wps: { rows: WmRow[]; total: WmRow | null };
  mat: { rows: WmRow[]; total: WmRow | null };
  query: string;
};

