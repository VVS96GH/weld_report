import { redirect } from "next/navigation";

import { FORECAST_DISPLAY_PAGE } from "@/lib/welding-pages";

/** The RT Backlog Forecast is page 2 of the welding report (owner ruling 2026-09-08). */
export default async function ForecastAlias(props: PageProps<"/forecast">) {
  const params = await props.searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) qs.set(k, value);
  }
  const query = qs.toString();
  redirect(`/welding/${FORECAST_DISPLAY_PAGE}${query ? `?${query}` : ""}`);
}
