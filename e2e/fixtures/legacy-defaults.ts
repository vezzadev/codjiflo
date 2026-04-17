/**
 * Legacy Defaults Fixture
 * 
 * Sets up localStorage with the old default values that E2E tests were written against.
 * This allows tests to continue working unchanged after we changed the application defaults.
 * 
 * New defaults (in code):
 * - diffColorScheme: 'codeflow-classic'
 * - showComments: false
 * - showFullFile: true  
 * - textWrap: 'wrap'
 * 
 * Old defaults (what tests expect):
 * - diffColorScheme: 'github'
 * - showComments: true
 * - showFullFile: false
 * - textWrap: 'nowrap'
 */

import { Page } from "@playwright/test";

/**
 * Sets up localStorage with the legacy default values that tests were written against.
 * Call this in beforeEach() before navigating to any pages.
 */
export async function setupLegacyDefaults(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Legacy theme defaults
    const legacyThemeStore = {
      state: {
        theme: "light",
        diffColorScheme: "github",
        useHighContrastDiff: false,
      },
      version: 0,
    };

    // Legacy diff view config defaults
    const legacyDiffStore = {
      state: {
        viewConfig: {
          mode: "inline",
          filter: "both",
          showFullFile: false,
          showWhitespace: false,
          showComments: true,
          textWrap: "nowrap",
        },
      },
      version: 0,
    };

    localStorage.setItem("codjiflo-theme", JSON.stringify(legacyThemeStore));
    localStorage.setItem("diff-store", JSON.stringify(legacyDiffStore));
  });
}
