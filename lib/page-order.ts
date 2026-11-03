import { GAC_SLG_STATUS_TITLE, PROJECT_NDE_TITLE, TEKFEN_TMCP_STATUS_TITLE, TEKFEN_TMCP_TITLE, WELDING_PAGE_TITLES, WPS_MATERIAL_TITLE } from "@/lib/welding-pages";

/**
 * The page menu's order (owner, 2026-10-15): pages are grouped (Project, Welder
 * Performance, the four sub-contractors with RT % sub-groups, then the rest) and
 * shown without numbers; Prev / Next and the arrow keys walk this order, and the
 * page indicator counts positions in it. Pure: used by the client nav and e2e.
 */
/** Pages 10..51 grouped by sub-contractor in the jump list (owner, 2026-10-15; 48-51,
 *  "Weld Rejection Detail - <sub>", join their sub-contractor too). */
const GROUPED_FROM = 10;
const GROUPED_TO = WELDING_PAGE_TITLES.length;

/** Pages appended at the end of the report that the menu shows after another one. */
const MENU_AFTER = new Map<number, number>([
  // the TEKFEN TMCP graph page follows the TEKFEN graph page
  [WELDING_PAGE_TITLES.indexOf(TEKFEN_TMCP_TITLE) + 1, WELDING_PAGE_TITLES.indexOf("TEKFEN WELDING STATUS Graph") + 1],
  // the GAC SLG status page follows the GAC (Except SLG) one
  [WELDING_PAGE_TITLES.indexOf(GAC_SLG_STATUS_TITLE) + 1, WELDING_PAGE_TITLES.indexOf("GAC WELDING STATUS (Except SLG Service)") + 1],
  [WELDING_PAGE_TITLES.indexOf(TEKFEN_TMCP_STATUS_TITLE) + 1, WELDING_PAGE_TITLES.indexOf("TEKFEN WELDING STATUS (Except TMCP Pipe)") + 1],
]);

/** `pages` with every MENU_AFTER page moved right behind its anchor. */
function placeAfter(pages: number[]): number[] {
  const out = pages.filter((n) => !MENU_AFTER.has(n));
  for (const n of pages) {
    const anchor = MENU_AFTER.get(n);
    if (anchor === undefined) continue;
    const at = out.indexOf(anchor);
    out.splice(at < 0 ? out.length : at + 1, 0, n);
  }
  return out;
}
const GROUP_ORDER = ["CCC", "GAC", "TEKFEN", "MEDGULF"];

/** The Welder Performance pages (4-7) are one group too (owner, 2026-10-15). */
const WP_GROUP = "Welder Performance";
const isWpPage = (title: string) =>
  /^(UT )?(Performance|Rej\.Summary) Last /i.test(title);

export type PageOption = { page: number } | { group: string; pages: number[] };

/** The project-wide pages make the first group (owner, 2026-10-15). */
const PROJECT_GROUP = "Project";
// Project Welding & NDE Status second, after page 1 (owner, 2026-10-19). By title, not number: a
// page added before it shifts the numbers (the UT Rej.Summary page put Errors there, 2026-11-03)
const PROJECT_NDE_STATUS_TITLE = "Project Welding & NDE Status";
const PROJECT_PAGES = [
  1,
  ...[PROJECT_NDE_STATUS_TITLE].map((t) => WELDING_PAGE_TITLES.indexOf(t) + 1),
  2,
  3,
  ...[PROJECT_NDE_TITLE, WPS_MATERIAL_TITLE].map((t) => WELDING_PAGE_TITLES.indexOf(t) + 1),
].filter((n) => n > 0);

/**
 * The jump list, top to bottom: Project, Welder Performance, the four
 * sub-contractors, then every page no group takes (Errors, at the bottom for now).
 */
export function pageOptions(): PageOption[] {
  const subs = new Map<string, number[]>(GROUP_ORDER.map((g) => [g, []]));
  const wp: number[] = [];
  const loose: PageOption[] = [];
  WELDING_PAGE_TITLES.forEach((t, i) => {
    const n = i + 1;
    if (PROJECT_PAGES.includes(n)) return;
    if (isWpPage(t)) {
      wp.push(n);
      return;
    }
    const up = t.toUpperCase();
    const sub = GROUP_ORDER.find(
      (g) => up.startsWith(g) || up.endsWith(`- ${g}`),
    );
    if (n >= GROUPED_FROM && n <= GROUPED_TO && sub) {
      subs.get(sub)!.push(n);
      return;
    }
    loose.push({ page: n });
  });
  return [
    {
      group: PROJECT_GROUP,
      pages: PROJECT_PAGES.filter((n) => n <= WELDING_PAGE_TITLES.length),
    },
    ...(wp.length ? [{ group: WP_GROUP, pages: wp }] : []),
    ...GROUP_ORDER.filter((g) => subs.get(g)!.length).map((g) => ({
      group: g,
      pages: placeAfter(subs.get(g)!),
    })),
    ...loose,
  ];
}


/**
 * Inside a sub-contractor group, the RT % pages come in sub-groups ("RT 100%"
 * holds its NDE status and its PWHT status page); in Welder Performance the
 * window ("Last 2 Weeks"); pages without one stay at the group's level.
 */
export function rtSplit(
  pages: number[],
): (number | { rt: string; pages: number[] })[] {
  const out: (number | { rt: string; pages: number[] })[] = [];
  for (const n of pages) {
    const title = WELDING_PAGE_TITLES[n - 1] ?? "";
    const pct = /\bRT\s*(\d+)\s*%/i.exec(title)?.[1];
    // GAC's two status pages share a folder (owner, 2026-11-03)
    const status = /^(GAC|TEKFEN) WELDING STATUS \((Except|SLG|TMCP)/i.exec(title)?.[1];
    const rt = status
      ? `${status} Welding Status`
      : pct
        ? `RT ${pct}%`
        : /\b(Last \d+ (?:Weeks?|Months?))\b/i.exec(title)?.[1];
    if (!rt) {
      out.push(n);
      continue;
    }
    const sub = out.find(
      (x): x is { rt: string; pages: number[] } =>
        typeof x !== "number" && x.rt === rt,
    );
    if (sub) sub.pages.push(n);
    else out.push({ rt, pages: [n] });
  }
  return out;
}

/** Every display page in menu order. */
export const MENU_ORDER: readonly number[] = pageOptions().flatMap((o) =>
  "group" in o
    ? rtSplit(o.pages).flatMap((x) => (typeof x === "number" ? [x] : x.pages))
    : [o.page],
);

/** The pages before and after `n` in the menu order. */
export function menuNeighbours(n: number): {
  prev: number | null;
  next: number | null;
} {
  const i = MENU_ORDER.indexOf(n);
  return {
    prev: i > 0 ? MENU_ORDER[i - 1]! : null,
    next: i >= 0 && i < MENU_ORDER.length - 1 ? MENU_ORDER[i + 1]! : null,
  };
}

/** 1-based position of display page `n` in the menu order. */
export function menuPosition(n: number): number {
  return MENU_ORDER.indexOf(n) + 1;
}
