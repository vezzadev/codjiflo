import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "./fixtures/mode";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "./fixtures/github-mocks";

test.describe("Diff Horizontal Scroll (Header Fixed)", () => {
  // Create a file with very long lines to trigger horizontal scrolling
  const longLine =
    "const veryLongVariableName = 'This is an extremely long string that will definitely cause horizontal scrolling in the diff view because it extends well beyond the normal viewport width and keeps going and going';";
  const contextLine1 = "// Context line 1 - should be visible above changes";
  const contextLine2 = "// Context line 2 - should be visible above changes";
  const contextLine3 = "// Context line 3 - should be visible above changes";

  // Generate many lines to ensure the file is tall enough to require scrolling
  const manyLines = Array.from(
    { length: 50 },
    (_, i) => `// Line ${String(i + 10)} - padding to make file tall`
  ).join("\n ");

  const mockPR: MockPR = {
    id: 1,
    number: 456,
    title: "Test: Horizontal Scroll",
    body: "Testing horizontal scroll behavior",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/scroll-test", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/456",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/long-lines.ts",
      status: "modified",
      additions: 52,
      deletions: 1,
      changes: 53,
      // Patch with context lines followed by changes with long lines
      // The many lines after the change ensure the file is tall enough to scroll
      patch: `@@ -1,6 +1,57 @@
 ${contextLine1}
 ${contextLine2}
 ${contextLine3}
-const old = 'short';
+${longLine}
+const anotherLine = 'test';
+${manyLines}
 const unchanged = 'value';`,
    },
  ];

  const getTestConfig = () => {
    if (isMockMode()) {
      return {
        owner: "test",
        repo: "repo",
        prNumber: 456,
        pageUrl: "/test/repo/456",
      };
    }
    const { owner, repo, prNumber } = prodModeConfig.testRepo;
    return {
      owner,
      repo,
      prNumber,
      pageUrl: `/${owner}/${repo}/${String(prNumber)}`,
    };
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    await setupAuthMock(page);
    const config = getTestConfig();
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });

    // Mock iteration artifact comment for iteration selector to appear
    if (isMockMode()) {
      await page.route(
        `**/repos/${config.owner}/${config.repo}/issues/${String(config.prNumber)}/comments*`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                id: 1,
                body: `<!-- codjiflo-data -->
Artifact ID: 12345
Run ID: 67890
Iterations: 2`,
                user: { login: "github-actions[bot]" },
                created_at: "2024-01-01T10:00:00Z",
              },
            ]),
          });
        }
      );
    }
  });

  test("Iteration selector and toolbar stay fixed when scrolling horizontally", async ({
    page,
  }) => {
    // Skip in prod mode - mock mode only test
    test.skip(!isMockMode(), "Horizontal scroll test runs in mock mode only");

    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("src/long-lines.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/long-lines.ts" })
    ).toBeVisible();

    // Get the diff toolbar (with view controls)
    const diffToolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(diffToolbar).toBeVisible();

    // Record initial toolbar position
    const toolbarBoxBefore = await diffToolbar.boundingBox();
    if (!toolbarBoxBefore) {
      throw new Error("Failed to get toolbar bounding box");
    }

    // Find which element allows horizontal scrolling and scroll it
    // This tests the BUG: with wrong implementation, .diff-viewer scrolls
    // horizontally and takes the toolbar with it
    const scrollResult = await page.evaluate(() => {
      // Try .diff-content-area first (correct implementation)
      const contentArea = document.querySelector(".diff-content-area");
      if (contentArea && contentArea.scrollWidth > contentArea.clientWidth) {
        const style = window.getComputedStyle(contentArea);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          contentArea.scrollLeft = 300;
          return { element: ".diff-content-area", scrolled: contentArea.scrollLeft > 0 };
        }
      }

      // Try .diff-viewer (incorrect implementation - scroll happens here)
      const viewer = document.querySelector(".diff-viewer");
      if (viewer && viewer.scrollWidth > viewer.clientWidth) {
        viewer.scrollLeft = 300;
        return { element: ".diff-viewer", scrolled: viewer.scrollLeft > 0 };
      }

      // No horizontal scroll possible
      return { element: null, scrolled: false };
    });

    // ASSERTION: Some element must be horizontally scrollable (content is wider than viewport)
    expect(scrollResult.scrolled).toBe(true);

    // Wait for scroll to settle by checking that scrollLeft has reached the expected value
    await page.waitForFunction(() => {
      const contentArea = document.querySelector(".diff-content-area");
      if (contentArea && contentArea.scrollLeft > 0) {
        return true;
      }
      const viewer = document.querySelector(".diff-viewer");
      return viewer && viewer.scrollLeft > 0;
    });

    // Get toolbar position after scroll
    const toolbarBoxAfter = await diffToolbar.boundingBox();
    if (!toolbarBoxAfter) {
      throw new Error("Failed to get toolbar bounding box after scroll");
    }

    // ASSERTION: Toolbar should NOT have moved horizontally
    // If the scroll happened on .diff-viewer (bug), toolbar moves with it
    // If the scroll happened on .diff-content-area (correct), toolbar stays fixed
    expect(toolbarBoxAfter.x).toBe(toolbarBoxBefore.x);
  });

  test("Autoscroll shows 3 context lines above first change", async ({
    page,
  }) => {
    // Skip in prod mode - mock mode only test
    test.skip(!isMockMode(), "Context lines test runs in mock mode only");

    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file to trigger autoscroll
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("src/long-lines.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/long-lines.ts" })
    ).toBeVisible();

    // Wait for autoscroll to complete by checking that context line is visible and positioned
    const contextLine1Row = page.locator("tr").filter({
      hasText: "Context line 1",
    });
    await expect(contextLine1Row).toBeVisible();
    // Wait for scroll position to stabilize by checking bounding box is ready
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const contextRow = rows.find((row) => row.innerText.includes("Context line 1"));
      if (!contextRow) return false;
      const box = contextRow.getBoundingClientRect();
      return box.y > 0 && box.height > 0;
    });

    // Get the header position (context lines should appear below it)
    const headerBox = await page.locator(".diff-header").boundingBox();
    if (!headerBox) {
      throw new Error("Failed to get header bounding box");
    }
    const contentStartY = headerBox.y + headerBox.height;

    // Find context line 1 - the first of 3 context lines above the change
    const contextLine1Row = page.locator("tr").filter({
      hasText: "Context line 1",
    });
    await expect(contextLine1Row).toBeVisible();

    const contextLine1Box = await contextLine1Row.boundingBox();
    if (!contextLine1Box) {
      throw new Error("Failed to get context line 1 bounding box");
    }

    // Find the first changed line (addition)
    const firstChangedLine = page.locator('[data-line-type="addition"]').first();
    await expect(firstChangedLine).toBeVisible();
    const firstChangeBox = await firstChangedLine.boundingBox();
    if (!firstChangeBox) {
      throw new Error("Failed to get first change bounding box");
    }

    // ASSERTION 1: Context line 1 should be visible BELOW the header
    // With proper autoscroll, context line 1 should be at the top of the content area
    // With buggy scrollIntoView, the first change would be at the top and context lines hidden
    const tolerance = 10;
    expect(contextLine1Box.y).toBeGreaterThanOrEqual(contentStartY - tolerance);

    // ASSERTION 2: Context line 1 should be near the TOP of content area
    // (within ~100px of where content starts - accounting for 3 context lines ~69px + some margin)
    // If scrollIntoView puts first change at top, context line 1 would be scrolled above header
    const maxDistanceFromTop = 120; // ~3 lines * 23px + some margin
    expect(contextLine1Box.y - contentStartY).toBeLessThan(maxDistanceFromTop);

    // ASSERTION 3: Context line should be above the first change
    expect(contextLine1Box.y).toBeLessThan(firstChangeBox.y);
  });

  test("Horizontal scrollbar is visible and functional", async ({ page }) => {
    // Skip in prod mode - mock mode only test
    test.skip(!isMockMode(), "Scrollbar test runs in mock mode only");

    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("src/long-lines.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/long-lines.ts" })
    ).toBeVisible();

    // Get the content area
    const contentArea = page.locator(".diff-content-area");
    await expect(contentArea).toBeVisible();

    // ASSERTION: Content area should allow horizontal scrolling
    const canScroll = await contentArea.evaluate((el) => {
      // Check if element can scroll (has overflow: auto/scroll and content wider than container)
      const style = window.getComputedStyle(el);
      const overflowX = style.overflowX;
      const hasOverflow = overflowX === "auto" || overflowX === "scroll";
      const hasContent = el.scrollWidth > el.clientWidth;
      return hasOverflow && hasContent;
    });

    expect(canScroll).toBe(true);

    // ASSERTION: Can scroll to reveal hidden content
    const initialScrollLeft = await contentArea.evaluate((el) => el.scrollLeft);
    expect(initialScrollLeft).toBe(0);

    // Scroll right
    await contentArea.evaluate((el) => {
      el.scrollLeft = 100;
    });

    const newScrollLeft = await contentArea.evaluate((el) => el.scrollLeft);
    expect(newScrollLeft).toBe(100);

    // Scroll back
    await contentArea.evaluate((el) => {
      el.scrollLeft = 0;
    });

    const resetScrollLeft = await contentArea.evaluate((el) => el.scrollLeft);
    expect(resetScrollLeft).toBe(0);
  });
});
