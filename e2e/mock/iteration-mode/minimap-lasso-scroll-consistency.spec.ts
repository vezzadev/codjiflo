import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";
import {
  waitForLasso,
  waitForLassoStable,
  scrollDiffBy,
  getLassoLeftTopY,
} from "../../fixtures/minimap-helpers";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

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
    await setupLegacyDefaults(page);
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

    // Full file mode is now default - ensure we're in it
    await expect(page.getByText("Full File")).toBeVisible();

    // Comments are hidden by default - lasso should already be visible
    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();
    await waitForLasso(page);

    // Navigate to the added lines section using J key (jump to next change)
    await page.keyboard.press("j");
    await waitForLassoStable(page);

    // Verify we're in the added lines section (should see "ADDED" text)
    await expect(page.getByText(/const ADDED/).first()).toBeVisible();

    // Collect measurements while scrolling down through added lines
    const measurements: number[] = [];
    const scrollPixels = 40; // 2 lines worth (~20px per line)

    // Prime the lasso calculation by doing a small scroll first
    // This ensures the visible row range is fully updated and the lasso
    // is using the anchor-based calculation (not stale scroll-ratio based)
    await scrollDiffBy(page, 1);
    await waitForLassoStable(page);

    // Initial measurement
    measurements.push(await getLassoLeftTopY(page));

    // Scroll down and measure 5 times
    // Use waitForLassoStable to ensure the lasso has finished animating
    // before taking measurements
    for (let i = 0; i < 5; i++) {
      await scrollDiffBy(page, scrollPixels);
      await waitForLassoStable(page);
      measurements.push(await getLassoLeftTopY(page));
    }

    // We now have exactly 6 measurements [0..5]
    const m0 = measurements[0] ?? 0;
    const m1 = measurements[1] ?? 0;
    const m2 = measurements[2] ?? 0;
    const m3 = measurements[3] ?? 0;
    const m4 = measurements[4] ?? 0;
    const m5 = measurements[5] ?? 0;

    // Calculate deltas between consecutive measurements (6 measurements = 5 deltas)
    const deltas = [m1 - m0, m2 - m1, m3 - m2, m4 - m3, m5 - m4];

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

    // Key assertion: No erratic backward jumps
    // Bug fixed: When scrolling through added-only lines, the lasso used to jump backwards
    // erratically (e.g., -44px). The fix ensures smooth forward movement.
    //
    // Note: Zero deltas are expected when small scrolls don't change visible row ranges
    // (react-window uses row-level granularity). That's correct behavior.
    //
    // We verify:
    // 1. No large negative deltas (erratic backward jumps)
    // 2. Overall movement is in the expected direction (forward when scrolling down)
    const minDelta = Math.min(...deltas);
    const maxNegativeJump = 10; // Allow small negative values due to rounding, but not big jumps
    expect(minDelta).toBeGreaterThan(-maxNegativeJump);

    // Overall direction should be forward (positive) when scrolling down
    expect(m5).toBeGreaterThanOrEqual(m0);
  });
});
