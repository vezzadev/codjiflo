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
   *   M x1 leftTop L x2 leftTop L x3 rightTop L x4 rightTop
   *   Q x5 rightTop x5 rightTop+r L x5 rightBottom-r
   *   Q x5 rightBottom x4 rightBottom L x3 rightBottom
   *   L x2 leftBottom L x1 leftBottom
   *   Q x0 leftBottom x0 leftBottom-r L x0 leftTop+r
   *   Q x0 leftTop x1 leftTop Z
   *
   * We extract the lasso height by finding leftTop and leftBottom values.
   * leftTop appears after the first "M" command.
   * leftBottom appears after "L x1" near the end.
   */
  async function getLassoHeight(page: import("@playwright/test").Page): Promise<{ height: number; path: string }> {
    const minimap = page.getByRole("img", { name: /minimap/i });
    const lasso = minimap.locator(".minimap-lasso");
    const pathD = await lasso.getAttribute("d");

    if (!pathD) return { height: 0, path: "" };

    // The path structure has leftTop early and leftBottom later
    // Extract all numbers from the path
    const numbers = pathD.match(/[\d.]+/g);
    if (!numbers || numbers.length < 10) return { height: 0, path: pathD };

    // Convert to numbers
    const coords = numbers.map(Number);

    // Find leftBottom - it appears around 2/3 into the path
    // After "L x1 leftBottom" near the end
    // The pattern is: ... L x leftBottom Q x leftBottom ...
    // We can find it by looking at Y values in the latter half
    // A simpler approach: get all unique Y values and find min/max in first/second half

    // Extract Y coordinates (odd indices: 1, 3, 5, ...)
    const yCoords = coords.filter((_, i) => i % 2 === 1);

    // The lasso connects top to bottom, so find the extent
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    return { height: maxY - minY, path: pathD };
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

    // Get lasso height and scroll metrics at top of file
    const topResult = await getLassoHeight(page);
    const topMetrics = await getScrollMetrics(page);
    const heightAtTop = topResult.height;
    expect(heightAtTop).toBeGreaterThan(0);

    // Log for debugging
    console.log("At TOP:", {
      lassoHeight: heightAtTop,
      path: topResult.path.substring(0, 100) + "...",
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
      path: middleResult.path.substring(0, 100) + "...",
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
      path: bottomResult.path.substring(0, 100) + "...",
      scrollMetrics: bottomMetrics,
      viewportRatio: bottomMetrics.clientHeight / bottomMetrics.scrollHeight,
    });

    // The heights should be approximately equal (within 30% tolerance)
    // This accounts for minor rounding differences in SVG rendering
    // and asymmetric bar heights between left and right sides
    const tolerance = heightAtTop * 0.30;

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

    // Height should stay the same (within tolerance)
    // Using 30% tolerance to account for rounding and asymmetric bar heights
    const tolerance = initialResult.height * 0.30;
    expect(Math.abs(newResult.height - initialResult.height)).toBeLessThan(tolerance);
  });
});
