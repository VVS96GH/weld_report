/**
 * The presentation axes, each a data attribute on <html> (T.EN spec §2, mapped onto
 * this app's existing attributes — see docs/ten-design-system.md header):
 *
 *   data-mood     ten | pastel | ocean | desert | upsidedown | powerbi   (spec: data-theme)
 *   data-theme    dark | light                                          (spec: data-scheme)
 *   data-density  normal 16px | compact 14px | board 18px
 *
 * Persisted in localStorage under the keys below and applied PRE-PAINT by
 * PRE_PAINT_SCRIPT (inlined in app/layout.tsx) so there is no flash of the wrong
 * theme; components/ThemeMoodControls.tsx writes the same keys and attributes.
 */

export const MOOD_IDS = ["ten", "pastel", "ocean", "desert", "upsidedown", "powerbi"] as const;
export type MoodId = (typeof MOOD_IDS)[number];

export const THEME_IDS = ["dark", "light"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DENSITY_IDS = ["normal", "compact", "board"] as const;
export type DensityId = (typeof DENSITY_IDS)[number];

export const DEFAULT_MOOD: MoodId = "ten";
export const DEFAULT_THEME: ThemeId = "dark";
export const DEFAULT_DENSITY: DensityId = "normal";

/** localStorage keys. The first two predate the T.EN integration and are kept. */
export const THEME_KEY = "weld-report-theme";
export const MOOD_KEY = "weld-report-mood";
export const DENSITY_KEY = "ten.density";

/**
 * The dark-scheme background literal from tokens.css, repeated here ONLY so the
 * very first frame (before the stylesheet loads) is navy, never white. Keep in
 * sync with `--bg-gradient`'s final linear-gradient in app/styles/tokens.css.
 */
export const TEN_HTML_BACKGROUND = "linear-gradient(150deg, #0a2c4e 0%, #081f3a 55%, #06192c 100%)";

/** Inline, dependency-free, runs before hydration. Any failure keeps the SSR defaults. */
export const PRE_PAINT_SCRIPT = `(function(){try{var d=document.documentElement,ls=window.localStorage;
var m=ls.getItem(${JSON.stringify(MOOD_KEY)});if(m&&${JSON.stringify(MOOD_IDS)}.indexOf(m)>=0){d.setAttribute("data-mood",m);}
var t=ls.getItem(${JSON.stringify(THEME_KEY)});if(t==="dark"||t==="light"){d.setAttribute("data-theme",t);}
var n=ls.getItem(${JSON.stringify(DENSITY_KEY)});if(n&&${JSON.stringify(DENSITY_IDS)}.indexOf(n)>=0){d.setAttribute("data-density",n);}
if(d.getAttribute("data-mood")==="ten"&&d.getAttribute("data-theme")==="light"){d.style.background="#eef1f4";}
}catch(e){}})();`;
