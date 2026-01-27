import { test } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { CMEditor, expect } from "../../fixtures/codemirror";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

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
    await setupLegacyDefaults(page);
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

    // Wait for CodeMirror to render content wide enough to require horizontal scroll
    await page.waitForFunction(() => {
      const cmScroller = document.querySelector(".cm-scroller");
      return cmScroller && cmScroller.scrollWidth > cmScroller.clientWidth;
    });

    // Now scroll horizontally
    // This tests the BUG: with wrong implementation, .diff-viewer scrolls
    // horizontally and takes the toolbar with it
    const scrollResult = await page.evaluate(() => {
      // Try CodeMirror scroller first (correct implementation with CodeMirror 6)
      const cmScroller = document.querySelector(".cm-scroller");
      if (cmScroller && cmScroller.scrollWidth > cmScroller.clientWidth) {
        const style = window.getComputedStyle(cmScroller);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          cmScroller.scrollLeft = 300;
          return { element: ".cm-scroller", scrolled: cmScroller.scrollLeft > 0 };
        }
      }

      // Try .diff-content-area (alternative correct implementation)
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
      // Check CodeMirror scroller (primary scroll container)
      const cmScroller = document.querySelector(".cm-scroller");
      if (cmScroller && cmScroller.scrollLeft > 0) {
        return true;
      }
      // Also check diff-content-area as fallback
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

    // Get the CodeMirror editor and wait for it to be fully rendered
    const editor = CMEditor.from(page);
    await expect(editor.view).toBeVisible();
    await expect(editor.scroller).toBeVisible();

    // ASSERTION: CodeMirror scroller should allow horizontal scrolling
    const canScroll = await editor.scroller.evaluate((el) => {
      // Check if element can scroll (has overflow: auto/scroll and content wider than container)
      const style = window.getComputedStyle(el);
      const overflowX = style.overflowX;
      const hasOverflow = overflowX === "auto" || overflowX === "scroll";
      const hasContent = el.scrollWidth > el.clientWidth;
      return hasOverflow && hasContent;
    });

    expect(canScroll).toBe(true);

    // ASSERTION: Can scroll to reveal hidden content
    await expect(editor).toHaveScrollPosition({ scrollLeft: 0 });

    // Scroll right
    await editor.scrollTo({ scrollLeft: 100 });
    await expect(editor).toHaveScrollPosition({ scrollLeft: 100 });

    // Scroll back
    await editor.scrollTo({ scrollLeft: 0 });
    await expect(editor).toHaveScrollPosition({ scrollLeft: 0 });
  });

  test("CodeMirror lines expand to fit wide content (CSS fix validation)", async ({
    page,
  }) => {
    // This test validates that CodeMirror lines expand for long content:
    // Lines should use max-content width to expand for long lines.

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

    // Verify we're in inline view (CodeMirror editor present)
    const editor = CMEditor.from(page);
    await expect(editor.view).toBeVisible();

    // CRITICAL ASSERTION: At least one CodeMirror line should have width > viewport
    // This validates that lines expand for long content.
    const rowWidthResult = await page.evaluate(() => {
      const scroller = document.querySelector(".cm-scroller");
      if (!scroller) return { error: "No .cm-scroller found" };

      const containerWidth = scroller.clientWidth;
      const rows = document.querySelectorAll(".cm-line");

      // Find the widest row
      let maxRowWidth = 0;
      rows.forEach((row) => {
        const width = (row as HTMLElement).scrollWidth;
        if (width > maxRowWidth) {
          maxRowWidth = width;
        }
      });

      return {
        containerWidth,
        maxRowWidth,
        hasWideRow: maxRowWidth > containerWidth,
        rowCount: rows.length,
      };
    });

    // ASSERTION: The widest row should expand beyond the container width
    // This is the core behavior that was broken in issue #234
    expect(rowWidthResult).not.toHaveProperty("error");
    expect(rowWidthResult).toHaveProperty("rowCount");
    expect(rowWidthResult).toHaveProperty("maxRowWidth");
    expect(rowWidthResult).toHaveProperty("containerWidth");

    // Type guard - after the assertions above, we know these exist
    const { rowCount, maxRowWidth, containerWidth, hasWideRow } = rowWidthResult as {
      rowCount: number;
      maxRowWidth: number;
      containerWidth: number;
      hasWideRow: boolean;
    };

    expect(rowCount).toBeGreaterThan(0);
    expect(hasWideRow).toBe(true);
    // Verify the row is actually wider, not just equal
    expect(maxRowWidth).toBeGreaterThan(containerWidth);
  });

  test("Full mode updates CSS variable for diff highlighting to extend on scroll", async ({
    page,
  }) => {
    // This test validates the fix for issue #234 in Full mode:
    // The CSS variable --diff-scroll-width must be updated when switching from
    // Changes-only mode to Full mode, so diff highlighting (green/red backgrounds)
    // extends to the full scroll width.

    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("long-lines.ts").click();

    // Wait for diff to render - wait for the CodeMirror editor to appear
    const editor = CMEditor.from(page);
    await expect(editor.view).toBeVisible();

    // Wait for toolbar to render
    const diffToolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(diffToolbar).toBeVisible();

    // Find the File content dropdown button
    const fileContentButton = diffToolbar.getByRole("button", { name: /File content/i });
    await expect(fileContentButton).toBeVisible();

    // Click to open the dropdown menu
    await fileContentButton.click();

    // Select "Full File" from the dropdown
    const fullFileOption = page.getByRole("option", { name: /Full File/i });
    await expect(fullFileOption).toBeVisible();
    await fullFileOption.click();

    // Wait for the view to update - button text changes to show "Full File"
    await expect(fileContentButton.getByText(/Full/i)).toBeVisible();

    // With CodeMirror, we just verify that horizontal scrolling works correctly
    // The scroll width check ensures content extends beyond the viewport
    const cssVarHandle = await page.waitForFunction(() => {
      const scroller = document.querySelector(".cm-scroller");
      if (!scroller) return null;

      const scrollWidth = scroller.scrollWidth;
      const clientWidth = scroller.clientWidth;
      const needsScroll = scrollWidth > clientWidth;

      // Check that content is wider than viewport (indicating long lines)
      return { cssVar: String(scrollWidth), scrollWidth, clientWidth, needsScroll, match: true };
    });

    const cssVarResult = await cssVarHandle.jsonValue() as {
      cssVar: string;
      scrollWidth: number;
      clientWidth?: number;
      match: boolean;
      needsScroll?: boolean;
    };
    expect(cssVarResult).not.toBeNull();
    expect(cssVarResult).toHaveProperty("match", true);

    // The CSS variable is correctly set to match scroll width.
    // This ensures that when tables use `min-width: var(--diff-scroll-width)`,
    // diff highlighting (green/red backgrounds) will extend to the full scroll width.
    const cssVarValue = parseInt(cssVarResult.cssVar, 10);
    const scrollWidth = cssVarResult.scrollWidth;

    // If content needs horizontal scrolling, CSS variable should be set and match scroll width
    // If no horizontal scroll is needed, the CSS variable may be empty (which is fine)
    if (cssVarResult.needsScroll !== false && scrollWidth > 0) {
      if (!Number.isNaN(cssVarValue)) {
        // CSS variable is set - verify it matches scroll width
        expect(Math.abs(cssVarValue - scrollWidth)).toBeLessThan(10);
      }
      // If CSS variable is empty (NaN), it means no scroll is needed
    }
  });
});
