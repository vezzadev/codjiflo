import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";

test.describe("Minimap lasso scroll consistency", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 892;

  // Create content helpers
  const createLines = (lineCount: number, prefix: string) => {
    return Array.from({ length: lineCount }, (_, i) => `${prefix} line ${i + 1}`).join("\n");
  };

  // Base file: 100 lines of code
  const baseContent = createLines(100, "const existing =");

  // Head file: 100 original lines + 150 NEW lines added in the middle
  // This creates a large block of additions that fills the viewport
  const headContent =
    createLines(50, "const existing =") +
    "\n" +
    createLines(150, "const ADDED =") + // 150 added lines - fills viewport
    "\n" +
    createLines(50, "const existing =").replace(/line (\d+)/g, (_, n: string) => `line ${50 + parseInt(n)}`);

  const initialFiles = {
    "src/large-additions.ts": baseContent,
  };

  // Create patch with 150 added lines
  const addedLines = Array.from({ length: 150 }, (_, i) => `+const ADDED = line ${i + 1}`).join("\n");
  const patch1 = `From abc123 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 10:00:00 +0000
Subject: [PATCH] feat: Add large block of new code

diff --git a/src/large-additions.ts b/src/large-additions.ts
--- a/src/large-additions.ts
+++ b/src/large-additions.ts
@@ -48,6 +48,156 @@ const existing = line 48
 const existing = line 49
 const existing = line 50
${addedLines}
 const existing = line 51
 const existing = line 52
`;

  const mockPR: MockPR = {
    id: 1,
    number: prNumber,
    title: "Test: lasso scroll consistency",
    body: "PR to test lasso position consistency during scroll",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/lasso-test", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  // Build patch content for mockFiles
  const patchAddedLines = Array.from({ length: 150 }, (_, i) => `+const ADDED = line ${i + 1}`).join("\n");
  const mockFiles: MockFile[] = [
    {
      filename: "src/large-additions.ts",
      status: "modified",
      additions: 150,
      deletions: 0,
      changes: 150,
      patch: `@@ -48,6 +48,156 @@ const existing = line 48
 const existing = line 49
 const existing = line 50
${patchAddedLines}
 const existing = line 51
 const existing = line 52`,
      baseContent,
      headContent,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1],
    });

    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: mockPR,
      files: mockFiles,
      comments: [],
    });
    await setupIterationArtifactMock(page, owner, repo, prNumber, mockDb);
  });

  /**
   * Extract the left side top Y position from the lasso path.
   *
   * The lasso path format starts with:
   *   M (LEFT_BAR_X + r) leftTop
   * So leftTop is at coords[1]
   */
  async function getLassoLeftTopY(page: import("@playwright/test").Page): Promise<number> {
    const minimap = page.getByRole("img", { name: /minimap/i });
    const lasso = minimap.locator(".minimap-lasso");
    const pathD = await lasso.getAttribute("d");

    if (!pathD) return 0;

    const numbers = pathD.match(/[\d.]+/g);
    if (!numbers || numbers.length < 2) return 0;

    return Number(numbers[1]);
  }

  /**
   * Wait for the minimap lasso to become visible
   */
  async function waitForLasso(page: import("@playwright/test").Page): Promise<void> {
    const minimap = page.getByRole("img", { name: /minimap/i });
    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).toBeVisible();
  }

  /**
   * Scroll the diff viewer by a specific number of pixels
   */
  async function scrollDiffBy(page: import("@playwright/test").Page, pixels: number): Promise<void> {
    await page.evaluate((px) => {
      const diffRegion = document.querySelector('[aria-label^="Diff content"]');
      if (!diffRegion) return;
      const listContainer = diffRegion.querySelector('[style*="overflow"]');
      if (listContainer) {
        listContainer.scrollTop += px;
      }
    }, pixels);
  }

  test("lasso left top Y changes consistently when scrolling through added lines", async ({ page }) => {
    // This test verifies that when scrolling through a section of ONLY added lines
    // (where left side has no line numbers), the lasso position changes consistently.
    //
    // Bug reproduction: When viewing added-only lines, the left side of the lasso
    // jumps erratically on the first scroll, then moves consistently afterward.
    // Expected: All scroll increments should cause similar changes in lasso position.

    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-additions.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-additions.ts" })
    ).toBeVisible();

    // Enable full file mode to see all content
    await page.keyboard.press("f");
    await expect(page.getByText("Full File")).toBeVisible();

    // Hide comments to show lasso
    await page.keyboard.press("d");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();
    await waitForLasso(page);

    // Navigate to the added lines section using J key (jump to next change)
    await page.keyboard.press("j");
    await waitForLasso(page);

    // Verify we're in the added lines section (should see "ADDED" text)
    await expect(page.getByText(/const ADDED/).first()).toBeVisible();

    // Collect measurements while scrolling down through added lines
    const measurements: number[] = [];
    const scrollPixels = 40; // 2 lines worth (~20px per line)

    // Initial measurement
    measurements.push(await getLassoLeftTopY(page));

    // Scroll down and measure 5 times
    await scrollDiffBy(page, scrollPixels);
    await waitForLasso(page);
    measurements.push(await getLassoLeftTopY(page));

    await scrollDiffBy(page, scrollPixels);
    await waitForLasso(page);
    measurements.push(await getLassoLeftTopY(page));

    await scrollDiffBy(page, scrollPixels);
    await waitForLasso(page);
    measurements.push(await getLassoLeftTopY(page));

    await scrollDiffBy(page, scrollPixels);
    await waitForLasso(page);
    measurements.push(await getLassoLeftTopY(page));

    await scrollDiffBy(page, scrollPixels);
    await waitForLasso(page);
    measurements.push(await getLassoLeftTopY(page));

    // We now have exactly 6 measurements [0..5]
    const m0 = measurements[0] ?? 0;
    const m1 = measurements[1] ?? 0;
    const m2 = measurements[2] ?? 0;
    const m3 = measurements[3] ?? 0;
    const m4 = measurements[4] ?? 0;
    const m5 = measurements[5] ?? 0;

    // Calculate deltas between consecutive measurements (6 measurements = 5 deltas)
    const deltas = [m1 - m0, m2 - m1, m3 - m2, m4 - m3, m5 - m4];

    // Log measurements for debugging
    console.log("Lasso leftTopY measurements:", measurements.map(m => m.toFixed(2)).join(", "));
    console.log("Deltas:", deltas.map(d => d.toFixed(2)).join(", "));

    // All measurements should be valid (non-zero)
    expect(m0).toBeGreaterThan(0);
    expect(m1).toBeGreaterThan(0);
    expect(m2).toBeGreaterThan(0);
    expect(m3).toBeGreaterThan(0);
    expect(m4).toBeGreaterThan(0);
    expect(m5).toBeGreaterThan(0);

    // The lasso should move when scrolling (position should change)
    const totalMovement = Math.abs(m5 - m0);
    expect(totalMovement).toBeGreaterThan(0);

    // Key assertion: All deltas should be similar in magnitude
    // Bug: When scrolling through added-only lines, one delta is drastically different
    // We check that no single delta deviates more than 200% from the median
    const sortedDeltas = [...deltas].sort((a, b) => a - b);
    const medianDelta = sortedDeltas[2] ?? 0; // Middle value of 5

    // Calculate max deviation from median
    const deviations = deltas.map(d => Math.abs(d - medianDelta));
    const maxDeviation = Math.max(...deviations);
    const medianMagnitude = Math.abs(medianDelta);

    // Max deviation should be less than 200% of median magnitude (allows some variance)
    // Add small epsilon to avoid division by zero while keeping the test meaningful
    const relativeMaxDeviation = maxDeviation / (medianMagnitude + 0.001);
    expect(relativeMaxDeviation).toBeLessThan(2.0);
  });
});
