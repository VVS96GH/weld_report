/**
 * The pages of the "WELDER PERFORMANCE" tab, for the header navigation (a
 * client component, so it must not import the pages' database code). Two
 * sections, each a drop-down of the performance matrices and the rejection
 * summary (owner, 2026-10-14).
 */
export const WP_NAV = [
  {
    group: "Last 2 Weeks",
    pages: [
      { slug: "2-weeks", label: "Performance Last 2 Weeks" },
      { slug: "2-weeks-summary", label: "Rej.Summary Last 2 Weeks" },
      { slug: "ut-2-weeks-summary", label: "UT Rej.Summary Last 2 Weeks" },
    ],
  },
  {
    group: "Last 1 Month",
    pages: [
      { slug: "1-month", label: "Performance Last 1 Month" },
      { slug: "1-month-summary", label: "Rej.Summary Last 1 Month" },
    ],
  },
] as const;

export const WP_FIRST = WP_NAV[0].pages[0].slug;
