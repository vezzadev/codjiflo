import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

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
    // Mock mode only test

    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("long-lines.ts").click();

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

      // With virtualized rendering (react-window), scroll happens inside the List component
      // which is a child of .diff-content-area - this is also correct behavior
      const reactWindowContainer = contentArea?.firstElementChild as HTMLElement | null;
      if (reactWindowContainer && reactWindowContainer.scrollWidth > reactWindowContainer.clientWidth) {
        const style = window.getComputedStyle(reactWindowContainer);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          reactWindowContainer.scrollLeft = 300;
          return { element: ".diff-content-area > div", scrolled: reactWindowContainer.scrollLeft > 0 };
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
      // Also check react-window container (child of .diff-content-area)
      const reactWindowContainer = contentArea?.firstElementChild as HTMLElement | null;
      if (reactWindowContainer && reactWindowContainer.scrollLeft > 0) {
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

  test("Horizontal scrollbar is visible and functional", async ({ page }) => {
    // Mock mode only test

    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("long-lines.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/long-lines.ts" })
    ).toBeVisible();

    // Get the content area
    const contentArea = page.locator(".diff-content-area");
    await expect(contentArea).toBeVisible();

    // ASSERTION: Content area (or react-window child) should allow horizontal scrolling
    const canScroll = await contentArea.evaluate((el) => {
      // Check if element can scroll (has overflow: auto/scroll and content wider than container)
      const style = window.getComputedStyle(el);
      const overflowX = style.overflowX;
      const hasOverflow = overflowX === "auto" || overflowX === "scroll";
      const hasContent = el.scrollWidth > el.clientWidth;
      if (hasOverflow && hasContent) return true;

      // Also check react-window container (child of .diff-content-area)
      const reactWindowContainer = el.firstElementChild as HTMLElement | null;
      if (reactWindowContainer) {
        const childStyle = window.getComputedStyle(reactWindowContainer);
        const childOverflow = childStyle.overflowX === "auto" || childStyle.overflowX === "scroll";
        const childContent = reactWindowContainer.scrollWidth > reactWindowContainer.clientWidth;
        return childOverflow && childContent;
      }
      return false;
    });

    expect(canScroll).toBe(true);

    // ASSERTION: Can scroll to reveal hidden content
    // With virtualized rendering, scroll may happen on contentArea or its react-window child
    const initialScrollLeft = await contentArea.evaluate((el) => {
      const child = el.firstElementChild as HTMLElement | null;
      const container = el.scrollWidth > el.clientWidth ? el : (child ?? el);
      return container.scrollLeft;
    });
    expect(initialScrollLeft).toBe(0);

    // Scroll right
    await contentArea.evaluate((el) => {
      const child = el.firstElementChild as HTMLElement | null;
      const container = el.scrollWidth > el.clientWidth ? el : (child ?? el);
      container.scrollLeft = 100;
    });

    const newScrollLeft = await contentArea.evaluate((el) => {
      const child = el.firstElementChild as HTMLElement | null;
      const container = el.scrollWidth > el.clientWidth ? el : (child ?? el);
      return container.scrollLeft;
    });
    expect(newScrollLeft).toBe(100);

    // Scroll back
    await contentArea.evaluate((el) => {
      const child = el.firstElementChild as HTMLElement | null;
      const container = el.scrollWidth > el.clientWidth ? el : (child ?? el);
      container.scrollLeft = 0;
    });

    const resetScrollLeft = await contentArea.evaluate((el) => {
      const child = el.firstElementChild as HTMLElement | null;
      const container = el.scrollWidth > el.clientWidth ? el : (child ?? el);
      return container.scrollLeft;
    });
    expect(resetScrollLeft).toBe(0);
  });
});
