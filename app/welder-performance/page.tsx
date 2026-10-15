import { redirect } from "next/navigation";

import { WP_FIRST } from "@/lib/welder-perf-nav";

/** The tab opens on its first page (Last 2 Weeks). */
export default function WelderPerformanceIndex() {
  redirect(`/welder-performance/${WP_FIRST}`);
}
