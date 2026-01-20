/**
 * Minimap test helpers
 *
 * Provides utilities for E2E tests that interact with the minimap component.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Wait for the minimap lasso to become visible
 */
export async function waitForLasso(page: Page): Promise<void> {
  const minimap = page.getByRole("img", { name: /minimap/i });
  const lasso = minimap.locator(".minimap-lasso");
  await expect(lasso).toBeVisible();
}

/**
 * Wait for the minimap lasso to stabilize after an action.
 *
 * This waits until the lasso path attribute stops changing for 2 consecutive
 * checks (with a small delay between). This ensures we measure the final
 * settled state, not an intermediate render during React's update cycle.
 *
 * @param page - Playwright page
 * @param options - Optional configuration
 * @param options.timeout - Max time to wait (default 5000ms)
 * @param options.stableDelay - Delay between stability checks (default 50ms)
 */
export async function waitForLassoStable(
  page: Page,
  options?: { timeout?: number; stableDelay?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const stableDelay = options?.stableDelay ?? 50;

  const minimap = page.getByRole("img", { name: /minimap/i });
  const lasso = minimap.locator(".minimap-lasso");

  // First ensure lasso is visible
  await expect(lasso).toBeVisible({ timeout });

  // Wait for lasso path to stabilize (stop changing)
  await expect
    .poll(
      async () => {
        const path1 = await lasso.getAttribute("d");

        // Wait a small delay
        await page.waitForFunction(
          (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          stableDelay
        );

        const path2 = await lasso.getAttribute("d");

        // Return true if path is stable (unchanged)
        return path1 === path2;
      },
      {
        message: "Wait for lasso path to stabilize",
        timeout,
        intervals: [50, 100, 100, 200],
      }
    )
    .toBe(true);
}

/**
 * Scroll the diff viewer by a specific number of pixels
 */
export async function scrollDiffBy(page: Page, pixels: number): Promise<void> {
  await page.evaluate((px) => {
    // CodeMirror uses .cm-scroller for scrolling
    const cmScroller = document.querySelector('.cm-scroller');
    if (cmScroller) {
      cmScroller.scrollTop += px;
      return;
    }
    // Fallback for diff region
    const diffRegion = document.querySelector('[aria-label^="Diff content"]');
    if (!diffRegion) return;
    const listContainer = diffRegion.querySelector('[style*="overflow"]');
    if (listContainer) {
      listContainer.scrollTop += px;
    }
  }, pixels);
}

/**
 * Get the lasso's left side top Y position from the SVG path
 *
 * The lasso path format starts with:
 *   M (LEFT_BAR_X + r) leftTop
 * So leftTop is at coords[1]
 */
export async function getLassoLeftTopY(page: Page): Promise<number> {
  const minimap = page.getByRole("img", { name: /minimap/i });
  const lasso = minimap.locator(".minimap-lasso");
  const pathD = await lasso.getAttribute("d");

  if (!pathD) return 0;

  const numbers = pathD.match(/[\d.]+/g);
  if (!numbers || numbers.length < 2) return 0;

  return Number(numbers[1]);
}

/**
 * Lasso height measurements from SVG path
 */
export interface LassoHeights {
  leftHeight: number;
  rightHeight: number;
  path: string;
  leftTop: number;
  leftBottom: number;
  rightTop: number;
  rightBottom: number;
}

/**
 * Extract lasso heights from SVG path
 *
 * The lasso path format from generateLassoPath is:
 *   M (LEFT_BAR_X + r) leftTop           -> coords[0], coords[1]
 *   L leftBarRight leftTop               -> coords[2], coords[3]
 *   L rightBarLeft rightTop              -> coords[4], coords[5]
 *   ...
 *   L leftBarRight leftBottom            -> coords[20], coords[21]
 *   ...
 *   L rightBarLeft rightBottom           -> coords[18], coords[19]
 *
 * We extract both LEFT and RIGHT bar heights.
 * - leftTop at coords[1], leftBottom at coords[21]
 * - rightTop at coords[5], rightBottom at coords[19]
 */
export async function getLassoHeight(page: Page): Promise<LassoHeights> {
  const minimap = page.getByRole("img", { name: /minimap/i });
  const lasso = minimap.locator(".minimap-lasso");
  const pathD = await lasso.getAttribute("d");

  if (!pathD) {
    return {
      leftHeight: 0,
      rightHeight: 0,
      path: "",
      leftTop: 0,
      leftBottom: 0,
      rightTop: 0,
      rightBottom: 0,
    };
  }

  // Extract all numbers from the path
  const numbers = pathD.match(/[\d.]+/g);
  if (!numbers || numbers.length < 22) {
    return {
      leftHeight: 0,
      rightHeight: 0,
      path: pathD,
      leftTop: 0,
      leftBottom: 0,
      rightTop: 0,
      rightBottom: 0,
    };
  }

  // Convert to numbers
  const coords = numbers.map(Number);

  // Left bar: leftTop at index 1, leftBottom at index 21
  const leftTop = coords[1] ?? 0;
  const leftBottom = coords[21] ?? 0;

  // Right bar: rightTop at index 5, rightBottom at index 19
  const rightTop = coords[5] ?? 0;
  const rightBottom = coords[19] ?? 0;

  return {
    leftHeight: leftBottom - leftTop,
    rightHeight: rightBottom - rightTop,
    path: pathD,
    leftTop,
    leftBottom,
    rightTop,
    rightBottom,
  };
}
