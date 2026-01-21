import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

test.describe("Side-by-Side Scroll Sync", () => {
  // Generate a file with many lines to ensure scrolling is needed
  const generateLines = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, i) => `${prefix} line ${String(i + 1)}`).join("\n");

  const baseContent = generateLines(100, "base");
  const headContent = generateLines(100, "head");

  // Create a patch that shows changes throughout the file
  const patch = `@@ -1,10 +1,10 @@
-base line 1
+head line 1
 base line 2
 base line 3
 base line 4
 base line 5
-base line 6
+head line 6
 base line 7
 base line 8
 base line 9
 base line 10`;

  const mockPR: MockPR = {
    id: 1,
    number: 999,
    title: "Scroll Sync Test PR",
    body: "Testing scroll synchronization",
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
    html_url: "https://github.com/test/repo/pull/999",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/large-file.ts",
      status: "modified",
      additions: 2,
      deletions: 2,
      changes: 4,
      patch,
      baseContent,
      headContent,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    await setupAuthMock(page);
    await setupFullPRMocks(page, "test", "repo", 999, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("scrolling left pane synchronizes right pane scroll position", async ({ page }) => {
    await page.goto("/test/repo/999");
    await page.waitForLoadState("load");

    // Click on the file to view its diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff to load
    await expect(page.getByRole("heading", { name: "src/large-file.ts" })).toBeVisible();

    // Switch to Side-by-Side view
    await page.locator("body").click();
    await page.keyboard.press("x");

    // Wait for split view to render
    const splitView = page.getByRole("region", { name: "Side-by-side diff view" });
    await expect(splitView).toBeVisible();

    // Switch to full file mode to get enough content to scroll
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    const fileContentDropdown = toolbar.getByRole("button", { name: "File content" });
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Full File/i }).click();

    // Wait for full file content to load (look for content that confirms full file mode)
    await expect(page.getByText("base line 20")).toBeVisible();

    // Get the CodeMirror scroll containers
    const leftPane = page.getByRole("region", { name: "Original version" }).first();
    const rightPane = page.getByRole("region", { name: "Modified version" }).first();

    await expect(leftPane).toBeVisible();
    await expect(rightPane).toBeVisible();

    // Get the scroll containers (.cm-scroller elements)
    const leftScroller = leftPane.locator(".cm-scroller");
    const rightScroller = rightPane.locator(".cm-scroller");

    await expect(leftScroller).toBeVisible();
    await expect(rightScroller).toBeVisible();

    // Get initial scroll positions
    const initialLeftScroll = await leftScroller.evaluate((el) => el.scrollTop);
    const initialRightScroll = await rightScroller.evaluate((el) => el.scrollTop);

    // Both should start at 0
    expect(initialLeftScroll).toBe(0);
    expect(initialRightScroll).toBe(0);

    // Scroll the left pane down by 200 pixels
    await leftScroller.evaluate((el) => {
      el.scrollTop = 200;
    });

    // Give scroll sync a moment to fire
    await page.waitForFunction(
      (scrollTop) => {
        const rightScroller = document.querySelector('[aria-label="Modified version"] .cm-scroller');
        return rightScroller && rightScroller.scrollTop >= scrollTop - 10;
      },
      190
    ).catch(() => {
      // Expected to fail when bug is present - scroll sync not working
    });

    // Check that the right pane also scrolled
    const newRightScroll = await rightScroller.evaluate((el) => el.scrollTop);

    // The right pane should have synced to the same scroll position
    // Allow small tolerance for rounding
    expect(newRightScroll).toBeGreaterThan(150);
    expect(Math.abs(newRightScroll - 200)).toBeLessThan(10);
  });

  test("scrolling right pane synchronizes left pane scroll position", async ({ page }) => {
    await page.goto("/test/repo/999");
    await page.waitForLoadState("load");

    // Click on the file to view its diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff to load
    await expect(page.getByRole("heading", { name: "src/large-file.ts" })).toBeVisible();

    // Switch to Side-by-Side view
    await page.locator("body").click();
    await page.keyboard.press("x");

    // Wait for split view to render
    const splitView = page.getByRole("region", { name: "Side-by-side diff view" });
    await expect(splitView).toBeVisible();

    // Switch to full file mode to get enough content to scroll
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    const fileContentDropdown = toolbar.getByRole("button", { name: "File content" });
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Full File/i }).click();

    // Wait for full file content to load (check left pane has content)
    await expect(page.getByText("base line 20")).toBeVisible();

    // Get the CodeMirror scroll containers
    const leftPane = page.getByRole("region", { name: "Original version" }).first();
    const rightPane = page.getByRole("region", { name: "Modified version" }).first();

    await expect(leftPane).toBeVisible();
    await expect(rightPane).toBeVisible();

    // Get the scroll containers (.cm-scroller elements)
    const leftScroller = leftPane.locator(".cm-scroller");
    const rightScroller = rightPane.locator(".cm-scroller");

    await expect(leftScroller).toBeVisible();
    await expect(rightScroller).toBeVisible();

    // Scroll the RIGHT pane down by 200 pixels
    await rightScroller.evaluate((el) => {
      el.scrollTop = 200;
    });

    // Give scroll sync a moment to fire
    await page.waitForFunction(
      (scrollTop) => {
        const leftScroller = document.querySelector('[aria-label="Original version"] .cm-scroller');
        return leftScroller && leftScroller.scrollTop >= scrollTop - 10;
      },
      190
    ).catch(() => {
      // Expected to fail when bug is present - scroll sync not working
    });

    // Check that the left pane also scrolled
    const newLeftScroll = await leftScroller.evaluate((el) => el.scrollTop);

    // The left pane should have synced to the same scroll position
    // Allow small tolerance for rounding
    expect(newLeftScroll).toBeGreaterThan(150);
    expect(Math.abs(newLeftScroll - 200)).toBeLessThan(10);
  });
});
