import type { Page } from "@playwright/test";

// Mirrors the private constants in components/ThemeMoodControls.tsx (THEME_KEY /
// MOOD_KEY). Not exported from that module, so duplicated here — if you rename
// the keys there, update these too.
export const THEME_STORAGE_KEY = "weld-report-theme";
export const MOOD_STORAGE_KEY = "weld-report-mood";

export type Scheme = "dark" | "light";

/**
 * Seed localStorage with a theme preference before the app's own scripts run,
 * so ThemeMoodControls' mount effect picks it up and sets data-theme
 * accordingly. Must be called before page.goto().
 */
export async function setStoredTheme(page: Page, scheme: Scheme): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: THEME_STORAGE_KEY, value: scheme },
  );
}
