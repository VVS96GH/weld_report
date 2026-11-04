"use client";

import { createContext, useContext } from "react";

import type { FilterWidget } from "@/lib/page-model";

/** The page's slicers, for tables whose column menu drives one (components/ColFilterMenu). */
export const PageFiltersContext = createContext<FilterWidget[]>([]);
export const usePageFilters = () => useContext(PageFiltersContext);
