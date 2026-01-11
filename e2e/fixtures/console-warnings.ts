/**
 * Console Warning Detection Fixture
 *
 * Extends Playwright test to fail on unexpected console warnings.
 * This ensures that degraded mode warnings are only emitted when expected.
 *
 * Usage:
 *   import { test, expect } from './fixtures/console-warnings';
 *
 * For tests that expect degraded mode warnings:
 *   test.use({ expectDegradedMode: true });
 */

import { test as base, expect } from "@playwright/test";
import type { ConsoleMessage } from "@playwright/test";

// Extend the base test with our custom options
interface ConsoleWarningFixture {
  /** Set to true for tests that expect degraded mode (GitHub API fallback) */
  expectDegradedMode: boolean;
}

// Warning prefix used by CodjiFlo for degraded mode warnings
const CODJIFLO_DEGRADED_WARNING_PREFIX = "[CodjiFlo] Using GitHub API as fallback";

export const test = base.extend<ConsoleWarningFixture>({
  expectDegradedMode: [false, { option: true }],

  page: async ({ page, expectDegradedMode }, use) => {
    const unexpectedWarnings: string[] = [];

    // Listen for console warnings
    const handleConsoleMessage = (msg: ConsoleMessage) => {
      if (msg.type() === "warning") {
        const text = msg.text();

        // Check if this is a CodjiFlo degraded mode warning
        const isDegradedModeWarning = text.includes(CODJIFLO_DEGRADED_WARNING_PREFIX);

        // If it's a degraded mode warning but we don't expect it, record it
        if (isDegradedModeWarning && !expectDegradedMode) {
          unexpectedWarnings.push(text);
        }
      }
    };

    page.on("console", handleConsoleMessage);

    // Run the test (Playwright's use() is not a React hook, disable false positive)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);

    // After test completes, fail if there were unexpected warnings
    if (unexpectedWarnings.length > 0) {
      throw new Error(
        `Unexpected console warnings detected:\n\n${unexpectedWarnings.join("\n\n")}\n\n` +
        `If this test expects degraded mode, add:\n  test.use({ expectDegradedMode: true });`
      );
    }
  },
});

export { expect };
