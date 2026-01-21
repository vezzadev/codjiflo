import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

test.describe("Scroll Preservation", () => {
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

  // Second file patch - similar structure
  const patch2 = `@@ -1,10 +1,10 @@
-old config 1
+new config 1
 config line 2
 config line 3
 config line 4
 config line 5
-old config 6
+new config 6
 config line 7
 config line 8
 config line 9
 config line 10`;

  const mockPR: MockPR = {
    id: 1,
    number: 1234,
    title: "Scroll Preservation Test PR",
    body: "Testing scroll state preservation",
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
    html_url: "https://github.com/test/repo/pull/1234",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/file1.ts",
      status: "modified",
      additions: 2,
      deletions: 2,
      changes: 4,
      patch,
      baseContent,
      headContent,
    },
    {
      filename: "src/file2.ts",
      status: "modified",
      additions: 2,
      deletions: 2,
      changes: 4,
      patch: patch2,
      baseContent: generateLines(100, "config"),
      headContent: generateLines(100, "config"),
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    await setupAuthMock(page);
    await setupFullPRMocks(page, "test", "repo", 1234, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("scroll position is preserved when switching files", async ({ page }) => {
    // Scroll position should be preserved per file and restored when returning

    await page.goto("/test/repo/1234");
    await page.waitForLoadState("load");

    // Click on the first file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("file1.ts").click();

    // Wait for diff to load
    await expect(page.getByRole("heading", { name: "src/file1.ts" })).toBeVisible();

    // Switch to full file mode to get enough content to scroll
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    const fileContentDropdown = toolbar.getByRole("button", { name: "File content" });
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Full File/i }).click();

    // Wait for full file content to load
    await expect(page.getByText("base line 20")).toBeVisible();

    // Get the scroll container
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    const scroller = diffRegion.locator(".cm-scroller");
    await expect(scroller).toBeVisible();

    // Scroll down to a specific position
    const targetScrollTop = 300;
    await scroller.evaluate((el, scrollPos) => {
      el.scrollTop = scrollPos;
      // Dispatch scroll event to ensure listeners are triggered
      el.dispatchEvent(new Event('scroll'));
    }, targetScrollTop);

    // Wait a moment for the scroll event to be processed and saved
    await page.waitForFunction(() => true, null, { timeout: 100 });

    // Verify scroll position was set
    const scrollAfterManualScroll = await scroller.evaluate((el) => el.scrollTop);
    expect(scrollAfterManualScroll).toBe(targetScrollTop);

    // Switch to second file using keyboard
    await page.locator("body").click();
    await page.keyboard.press("s");

    // Verify we're on the second file
    await expect(page.getByRole("heading", { name: "src/file2.ts" })).toBeVisible();

    // Switch back to first file
    await page.keyboard.press("w");
    await expect(page.getByRole("heading", { name: "src/file1.ts" })).toBeVisible();

    // Wait for content to load
    await expect(page.getByText("base line 20")).toBeVisible();

    // Wait for scroll position to be restored (happens async via requestAnimationFrame)
    await page.waitForFunction(
      (expectedScroll) => {
        const scroller = document.querySelector('[aria-label^="Diff content"] .cm-scroller');
        // Allow some tolerance (within 50px) since ratio-based restoration may not be exact
        return scroller && Math.abs(scroller.scrollTop - expectedScroll) < 50;
      },
      targetScrollTop,
      { timeout: 2000 }
    );

    // Check scroll position
    const scrollAfterReturn = await scroller.evaluate((el) => el.scrollTop);

    // Scroll should be restored to approximately the same position
    // Allow tolerance since we use ratio-based restoration
    expect(Math.abs(scrollAfterReturn - targetScrollTop)).toBeLessThan(50);
  });

  test("scroll position is preserved when switching view modes", async ({ page }) => {
    // Scroll position should be preserved when switching inline <-> sxs

    await page.goto("/test/repo/1234");
    await page.waitForLoadState("load");

    // Click on the first file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("file1.ts").click();

    // Wait for diff to load
    await expect(page.getByRole("heading", { name: "src/file1.ts" })).toBeVisible();

    // Switch to full file mode to get enough content to scroll
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    const fileContentDropdown = toolbar.getByRole("button", { name: "File content" });
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Full File/i }).click();

    // Wait for full file content to load
    await expect(page.getByText("base line 20")).toBeVisible();

    // Get the scroll container (inline mode)
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    const inlineScroller = diffRegion.locator(".cm-scroller");
    await expect(inlineScroller).toBeVisible();

    // Scroll down to a specific position
    const targetScrollTop = 300;
    await inlineScroller.evaluate((el, scrollPos) => {
      el.scrollTop = scrollPos;
      // Dispatch scroll event to ensure listeners are triggered
      el.dispatchEvent(new Event('scroll'));
    }, targetScrollTop);

    // Wait a moment for the scroll event to be processed and saved
    await page.waitForFunction(() => true, null, { timeout: 100 });

    // Verify scroll position was set
    const scrollBeforeModeSwitch = await inlineScroller.evaluate((el) => el.scrollTop);
    expect(scrollBeforeModeSwitch).toBe(targetScrollTop);

    // Switch to Side-by-Side view
    await page.locator("body").click();
    await page.keyboard.press("x");

    // Wait for split view to render
    const splitView = page.getByRole("region", { name: "Side-by-side diff view" });
    await expect(splitView).toBeVisible();

    // Switch back to inline view
    await page.keyboard.press("i");

    // Wait for inline view to render - check that split view is gone
    await expect(splitView).not.toBeVisible();
    // And inline scroller is back
    await expect(inlineScroller).toBeVisible();
    await expect(page.getByText("base line 20")).toBeVisible();

    // Wait for scroll position to be restored (happens async via requestAnimationFrame)
    await page.waitForFunction(
      (expectedScroll) => {
        const scroller = document.querySelector('[aria-label^="Diff content"] .cm-scroller');
        // Allow some tolerance (within 50px) since ratio-based restoration may not be exact
        return scroller && Math.abs(scroller.scrollTop - expectedScroll) < 50;
      },
      targetScrollTop,
      { timeout: 2000 }
    );

    // Check scroll position
    const scrollAfterReturn = await inlineScroller.evaluate((el) => el.scrollTop);

    // Scroll should be restored to approximately the same position
    // Allow tolerance since we use ratio-based restoration
    expect(Math.abs(scrollAfterReturn - targetScrollTop)).toBeLessThan(50);
  });

  test("scroll position preserved within same contents mode is expected (CONTROL)", async ({ page }) => {
    // This is a control test to verify that scroll position IS preserved
    // when staying on the same file with the same contents mode

    await page.goto("/test/repo/1234");
    await page.waitForLoadState("load");

    // Click on the first file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("file1.ts").click();

    // Wait for diff to load
    await expect(page.getByRole("heading", { name: "src/file1.ts" })).toBeVisible();

    // Switch to full file mode
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    const fileContentDropdown = toolbar.getByRole("button", { name: "File content" });
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Full File/i }).click();

    // Wait for full file content to load
    await expect(page.getByText("base line 20")).toBeVisible();

    // Get the scroll container
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    const scroller = diffRegion.locator(".cm-scroller");
    await expect(scroller).toBeVisible();

    // Scroll down
    const targetScrollTop = 300;
    await scroller.evaluate((el, scrollPos) => {
      el.scrollTop = scrollPos;
    }, targetScrollTop);

    // Verify scroll position was set
    const scrollAfterManualScroll = await scroller.evaluate((el) => el.scrollTop);
    expect(scrollAfterManualScroll).toBe(targetScrollTop);

    // Do something else without switching files (e.g., toggle whitespace)
    await page.locator("body").click();
    await page.keyboard.press("b"); // Toggle whitespace

    // Scroll position should still be preserved
    const scrollAfterToggle = await scroller.evaluate((el) => el.scrollTop);
    expect(scrollAfterToggle).toBe(targetScrollTop);
  });
});
