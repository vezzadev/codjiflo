import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";

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

  /**
   * Helper to extract lasso height from SVG path
   *
   * The lasso path format from generateLassoPath is:
   *   M (LEFT_BAR_X + r) leftTop           -> coords[0], coords[1]
   *   L leftBarRight leftTop               -> coords[2], coords[3]
   *   L rightBarLeft rightTop              -> coords[4], coords[5]
   *   L (rightBarRight - r) rightTop       -> coords[6], coords[7]
   *   Q rightBarRight rightTop rightBarRight (rightTop + r)  -> coords[8-11]
   *   L rightBarRight (rightBottom - r)    -> coords[12], coords[13]
   *   Q rightBarRight rightBottom (rightBarRight - r) rightBottom  -> coords[14-17]
   *   L rightBarLeft rightBottom           -> coords[18], coords[19]
   *   L leftBarRight leftBottom            -> coords[20], coords[21]
   *   L (LEFT_BAR_X + r) leftBottom        -> coords[22], coords[23]
   *   Q LEFT_BAR_X leftBottom LEFT_BAR_X (leftBottom - r)  -> coords[24-27]
   *   L LEFT_BAR_X (leftTop + r)           -> coords[28], coords[29]
   *   Q LEFT_BAR_X leftTop (LEFT_BAR_X + r) leftTop  -> coords[30-33]
   *   Z
   *
   * We extract the LEFT bar lasso height (leftBottom - leftTop) specifically.
   * leftTop is at coords[1], leftBottom is at coords[21].
   */
  async function getLassoHeight(page: import("@playwright/test").Page): Promise<{ height: number; path: string; leftTop: number; leftBottom: number }> {
    const minimap = page.getByRole("img", { name: /minimap/i });
    const lasso = minimap.locator(".minimap-lasso");
    const pathD = await lasso.getAttribute("d");

    if (!pathD) return { height: 0, path: "", leftTop: 0, leftBottom: 0 };

    // Extract all numbers from the path
    const numbers = pathD.match(/[\d.]+/g);
    if (!numbers || numbers.length < 22) return { height: 0, path: pathD, leftTop: 0, leftBottom: 0 };

    // Convert to numbers
    const coords = numbers.map(Number);

    // leftTop is at index 1 (M x leftTop)
    const leftTop = coords[1] ?? 0;

    // leftBottom is at index 21 (L leftBarRight leftBottom)
    const leftBottom = coords[21] ?? 0;

    return { height: leftBottom - leftTop, path: pathD, leftTop, leftBottom };
  }

  /**
   * Helper to get the scroll container metrics for debugging
   * Finds the element with the largest scroll range (matching useMinimapScroll logic)
   */
  async function getScrollMetrics(page: import("@playwright/test").Page): Promise<{ scrollHeight: number; clientHeight: number; scrollTop: number }> {
    return page.evaluate(() => {
      // Find the react-window scroll container (element with largest scroll range)
      const candidates = document.querySelectorAll<HTMLElement>('[style*="overflow"]');
      let best: HTMLElement | null = null;
      let maxRange = 0;

      for (const el of candidates) {
        const range = el.scrollHeight - el.clientHeight;
        if (range > maxRange) {
          maxRange = range;
          best = el;
        }
      }

      if (!best || maxRange <= 100) {
        return { scrollHeight: 0, clientHeight: 0, scrollTop: 0 };
      }
      return {
        scrollHeight: best.scrollHeight,
        clientHeight: best.clientHeight,
        scrollTop: best.scrollTop,
      };
    });
  }

  /**
   * Wait for scroll container metrics to stabilize
   * React-window virtualization may update scrollHeight as content renders
   */
  async function waitForScrollStabilization(page: import("@playwright/test").Page): Promise<void> {
    await page.waitForFunction(() => {
      // Find scroll container
      const candidates = document.querySelectorAll<HTMLElement>('[style*="overflow"]');
      let best: HTMLElement | null = null;
      let maxRange = 0;

      for (const el of candidates) {
        const range = el.scrollHeight - el.clientHeight;
        if (range > maxRange) {
          maxRange = range;
          best = el;
        }
      }

      if (!best || maxRange <= 100) return false;

      // Store current scrollHeight and check again in next frame
      const currentHeight = best.scrollHeight;
      // Use a custom attribute to track previous measurement
      const prevHeight = best.getAttribute('data-prev-scroll-height');
      best.setAttribute('data-prev-scroll-height', String(currentHeight));

      // Stabilized when scrollHeight hasn't changed
      return prevHeight !== null && Number(prevHeight) === currentHeight;
    });
  }

  test("lasso maintains consistent height while scrolling within same file", async ({ page }) => {
    // Capture console logs from the browser for debugging
    page.on("console", (msg) => {
      if (msg.text().includes("[Minimap]") || msg.text().includes("[useMinimapScroll]")) {
        console.log("BROWSER:", msg.text());
      }
    });

    // This test verifies that the lasso height remains stable during scrolling
    // The viewportRatio (clientHeight/scrollHeight) should be constant for a given file
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Enable full file mode
    await page.keyboard.press("f");

    // Hide comments to show lasso
    await page.keyboard.press("d");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).toBeVisible();

    // Wait for scroll container to stabilize before measuring
    await waitForScrollStabilization(page);

    // Get lasso height and scroll metrics at top of file
    const topResult = await getLassoHeight(page);
    const topMetrics = await getScrollMetrics(page);
    const heightAtTop = topResult.height;
    expect(heightAtTop).toBeGreaterThan(0);

    // Log for debugging
    console.log("At TOP:", {
      lassoHeight: heightAtTop,
      leftTop: topResult.leftTop,
      leftBottom: topResult.leftBottom,
      scrollMetrics: topMetrics,
      viewportRatio: topMetrics.clientHeight / topMetrics.scrollHeight,
    });

    // Scroll to middle using minimap click
    const minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height * 0.5
    );

    // Wait for scroll to settle
    await page.waitForFunction(() => {
      const el = document.querySelector('[style*="overflow"]');
      return el !== null;
    });

    // Get lasso height and scroll metrics at middle
    const middleResult = await getLassoHeight(page);
    const middleMetrics = await getScrollMetrics(page);
    const heightAtMiddle = middleResult.height;

    console.log("At MIDDLE:", {
      lassoHeight: heightAtMiddle,
      leftTop: middleResult.leftTop,
      leftBottom: middleResult.leftBottom,
      scrollMetrics: middleMetrics,
      viewportRatio: middleMetrics.clientHeight / middleMetrics.scrollHeight,
    });

    // Scroll to bottom
    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height * 0.9
    );

    // Get lasso height and scroll metrics at bottom
    const bottomResult = await getLassoHeight(page);
    const bottomMetrics = await getScrollMetrics(page);
    const heightAtBottom = bottomResult.height;

    console.log("At BOTTOM:", {
      lassoHeight: heightAtBottom,
      leftTop: bottomResult.leftTop,
      leftBottom: bottomResult.leftBottom,
      scrollMetrics: bottomMetrics,
      viewportRatio: bottomMetrics.clientHeight / bottomMetrics.scrollHeight,
    });

    // The left bar lasso heights should be nearly identical (within 5% tolerance)
    // since viewportRatio is constant and we're measuring the same bar.
    // Minor differences may occur due to floating point precision.
    const tolerance = heightAtTop * 0.05;

    expect(Math.abs(heightAtMiddle - heightAtTop)).toBeLessThan(tolerance);
    expect(Math.abs(heightAtBottom - heightAtTop)).toBeLessThan(tolerance);
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

    // Enable full file mode
    await page.keyboard.press("f");

    // Hide comments to show lasso
    await page.keyboard.press("d");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).toBeVisible();

    // Get minimap bar height (approximately containerHeight - 2*PADDING_VERTICAL)
    const minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    const lassoResult = await getLassoHeight(page);
    const barHeight = minimapBox.height - 20; // Approximate: height - 2*PADDING_VERTICAL(10)

    // For a 500-line file with ~30-50 visible lines, viewportRatio should be ~0.06-0.10
    // So lasso should be roughly 6-10% of bar height
    const lassoRatio = lassoResult.height / barHeight;

    // Verify lasso is a reasonable proportion (between 2% and 50% of bar)
    // This is a sanity check that the lasso is sized proportionally
    expect(lassoRatio).toBeGreaterThan(0.02);
    expect(lassoRatio).toBeLessThan(0.5);
  });

  test("lasso position moves when scrolling but height stays constant", async ({ page }) => {
    // Verify that scroll changes lasso POSITION but not SIZE
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Enable full file mode
    await page.keyboard.press("f");

    // Hide comments to show lasso
    await page.keyboard.press("d");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).toBeVisible();

    // Get initial lasso path
    const initialPath = await lasso.getAttribute("d");
    if (!initialPath) throw new Error("Initial lasso path is null");
    const initialResult = await getLassoHeight(page);

    // Scroll down using keyboard
    await page.keyboard.press("j"); // Navigate to change

    // Get new lasso path
    const newResult = await getLassoHeight(page);

    // Path should change (position moved) - use negated toHaveAttribute with exact match
    await expect(lasso).not.toHaveAttribute("d", initialPath);

    // Left bar height should stay the same (within 5% tolerance for floating point)
    const tolerance = initialResult.height * 0.05;
    expect(Math.abs(newResult.height - initialResult.height)).toBeLessThan(tolerance);
  });
});
