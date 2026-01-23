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
  getLassoHeight,
} from "../../fixtures/minimap-helpers";

test.describe("Minimap lasso sizing during scroll", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 891;

  // Create a large file to ensure meaningful scrolling
  const createLargeContent = (lineCount: number, prefix: string) => {
    return Array.from({ length: lineCount }, (_, i) => `${prefix} line ${i + 1}`).join("\n");
  };

  // 500-line file for testing lasso sizing
  const baseContent = createLargeContent(500, "const code =");
  const headContent =
    createLargeContent(250, "const code =") +
    "\nconst newLine = 'added';\n" +
    createLargeContent(249, "const code =");

  const initialFiles = {
    "src/large-file.ts": baseContent,
  };

  const patch1 = `From abc123 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 10:00:00 +0000
Subject: [PATCH] feat: Add new line

diff --git a/src/large-file.ts b/src/large-file.ts
--- a/src/large-file.ts
+++ b/src/large-file.ts
@@ -248,6 +248,7 @@ const code = line 248
 const code = line 249
 const code = line 250
+const newLine = 'added';
 const code = line 251
 const code = line 252
`;

  const mockPR: MockPR = {
    id: 1,
    number: prNumber,
    title: "Test: lasso sizing",
    body: "PR to test lasso sizing during scroll",
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

  const mockFiles: MockFile[] = [
    {
      filename: "src/large-file.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: `@@ -248,6 +248,7 @@ const code = line 248
 const code = line 249
 const code = line 250
+const newLine = 'added';
 const code = line 251
 const code = line 252`,
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

  test("lasso reflects visible content and moves when scrolling", async ({ page }) => {
    // This test verifies that:
    // 1. The lasso height reflects visible line counts (can vary based on visible content)
    // 2. The lasso position moves when scrolling (top/middle/bottom have different positions)
    // 3. Left and right heights can differ in diff regions (asymmetric lasso)
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Wait for iteration artifact to finish loading before measuring lasso positions
    // Without this, the diff data can change mid-test causing lasso positions to shift
    await expect(
      page.getByRole("button", { name: /Iteration \d+/ })
    ).toBeVisible();

    // Enable full file mode and wait for it to take effect
    await page.keyboard.press("f");
    await expect(page.getByText("Full File")).toBeVisible();

    // Hide comments to show lasso
    await page.keyboard.press("d");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();
    await waitForLasso(page);

    // Force react-window to calculate correct scrollHeight by scrolling
    let minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    // Scroll to middle to force height calculation
    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height * 0.5
    );
    await waitForLassoStable(page);

    // Scroll back to top - re-fetch bounding box in case layout shifted
    minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + 20
    );
    await waitForLassoStable(page);

    // Get lasso at top of file
    const topResult = await getLassoHeight(page);

    // Scroll to middle using minimap click - re-fetch bounding box
    minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height * 0.5
    );
    await waitForLassoStable(page);

    // Get lasso at middle
    const middleResult = await getLassoHeight(page);

    // Scroll to bottom - re-fetch bounding box
    minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height * 0.9
    );
    await waitForLassoStable(page);

    // Get lasso at bottom
    const bottomResult = await getLassoHeight(page);

    // All heights should be positive
    expect(topResult.leftHeight).toBeGreaterThan(0);
    expect(topResult.rightHeight).toBeGreaterThan(0);
    expect(middleResult.leftHeight).toBeGreaterThan(0);
    expect(middleResult.rightHeight).toBeGreaterThan(0);
    expect(bottomResult.leftHeight).toBeGreaterThan(0);
    expect(bottomResult.rightHeight).toBeGreaterThan(0);

    // Lasso position should move when scrolling (top position changes)
    // Top should be near the top of the minimap, bottom should be near the bottom
    expect(topResult.leftTop).toBeLessThan(middleResult.leftTop);
    expect(middleResult.leftTop).toBeLessThan(bottomResult.leftTop);

    // Heights can vary based on visible content (diff regions have different line counts)
    // At minimum, verify heights are within reasonable range (not zero, not absurdly large)
    const minReasonableHeight = 5; // At least 5px
    const maxReasonableHeight = 100; // At most 100px for this viewport
    expect(topResult.leftHeight).toBeGreaterThan(minReasonableHeight);
    expect(topResult.leftHeight).toBeLessThan(maxReasonableHeight);
    expect(middleResult.leftHeight).toBeGreaterThan(minReasonableHeight);
    expect(middleResult.leftHeight).toBeLessThan(maxReasonableHeight);
    expect(bottomResult.leftHeight).toBeGreaterThan(minReasonableHeight);
    expect(bottomResult.leftHeight).toBeLessThan(maxReasonableHeight);
  });

  test("lasso height reflects viewport-to-content ratio", async ({ page }) => {
    // This test verifies the lasso height is proportional to viewport/content ratio
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Wait for iteration artifact to finish loading
    await expect(
      page.getByRole("button", { name: /Iteration \d+/ })
    ).toBeVisible();

    // Enable full file mode and wait for it to take effect
    await page.keyboard.press("f");
    // Wait for toolbar to show "Full File" label (indicating full-file mode is active)
    await expect(page.getByText("Full File")).toBeVisible();

    // Hide comments to show lasso
    await page.keyboard.press("d");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    // Wait for lasso to appear
    await waitForLasso(page);

    // Get minimap bar height (approximately containerHeight - 2*PADDING_VERTICAL)
    const minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    const lassoResult = await getLassoHeight(page);
    const barHeight = minimapBox.height - 20; // Approximate: height - 2*PADDING_VERTICAL(10)

    // For a 500-line file with ~30-50 visible lines, viewportRatio should be ~0.06-0.10
    // So lasso should be roughly 6-10% of bar height
    const lassoRatio = lassoResult.leftHeight / barHeight;

    // Verify lasso is a reasonable proportion (between 2% and 50% of bar)
    // This is a sanity check that the lasso is sized proportionally
    expect(lassoRatio).toBeGreaterThan(0.02);
    expect(lassoRatio).toBeLessThan(0.5);
  });

  test("lasso path changes when navigating with keyboard", async ({ page }) => {
    // Verify that keyboard navigation (J/K) changes the lasso position
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Wait for iteration artifact to finish loading
    await expect(
      page.getByRole("button", { name: /Iteration \d+/ })
    ).toBeVisible();

    // Enable full file mode and wait for it to take effect
    await page.keyboard.press("f");
    await expect(page.getByText("Full File")).toBeVisible();

    // Hide comments to show lasso
    await page.keyboard.press("d");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();
    await waitForLasso(page);

    const lasso = minimap.locator(".minimap-lasso");

    // Force react-window to calculate correct scrollHeight by scrolling first
    let minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    // Scroll to middle to force height calculation
    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height * 0.5
    );
    await waitForLassoStable(page);

    // Scroll back to top - re-fetch bounding box
    minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + 20
    );
    await waitForLassoStable(page);

    // Get initial lasso path
    const initialPath = await lasso.getAttribute("d");
    if (!initialPath) throw new Error("Initial lasso path is null");
    const initialResult = await getLassoHeight(page);

    // Scroll down using keyboard
    await page.keyboard.press("j"); // Navigate to change
    await waitForLassoStable(page);

    // Get new lasso path
    const newResult = await getLassoHeight(page);

    // Path should change (position moved)
    await expect(lasso).not.toHaveAttribute("d", initialPath);

    // Both positions should have valid heights
    expect(initialResult.leftHeight).toBeGreaterThan(0);
    expect(newResult.leftHeight).toBeGreaterThan(0);

    // Position should have changed (leftTop is different)
    // Note: heights may vary based on visible content, which is correct behavior
    expect(newResult.leftTop).not.toEqual(initialResult.leftTop);
  });
});
