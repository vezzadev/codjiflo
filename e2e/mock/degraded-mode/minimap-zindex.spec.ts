import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

test.describe("Minimap Z-Index Bug", () => {
  // Generate a file with many lines to ensure minimap is visible
  const generateLines = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, i) => `${prefix} line ${String(i + 1)}`).join("\n");

  const baseContent = generateLines(100, "base");
  const headContent = generateLines(100, "head");

  // Create a patch with some changes
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
    number: 777,
    title: "Z-Index Test PR",
    body: "Testing minimap z-index",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/zindex-test", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/777",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/test-file.ts",
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
    await setupFullPRMocks(page, "test", "repo", 777, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("toolbar dropdown should render above minimap in side-by-side mode", async ({ page }) => {
    await page.goto("/test/repo/777");
    await page.waitForLoadState("load");

    // Click on the file to view its diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("test-file.ts").click();

    // Wait for diff to load
    await expect(page.getByRole("heading", { name: "src/test-file.ts" })).toBeVisible();

    // Switch to Side-by-Side view
    await page.locator("body").click();
    await page.keyboard.press("x");

    // Wait for split view to render
    const splitView = page.getByRole("region", { name: "Side-by-side diff view" });
    await expect(splitView).toBeVisible();

    // Switch to full file mode to show the minimap
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    const fileContentDropdown = toolbar.getByRole("button", { name: "File content" });
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Full File/i }).click();

    // Wait for full file content to load
    await expect(page.getByText("base line 20")).toBeVisible();

    // Verify the minimap is visible
    const minimap = page.locator(".minimap");
    await expect(minimap).toBeVisible();

    // Open a dropdown that should appear above the minimap
    // The view mode dropdown is in the middle of the toolbar
    const viewModeDropdown = toolbar.getByRole("button", { name: "View mode" });
    await viewModeDropdown.click();

    // The dropdown listbox should be visible
    const listbox = page.getByRole("listbox", { name: "View mode" });
    await expect(listbox).toBeVisible();

    // Get positions of both elements
    const minimapBox = await minimap.boundingBox();
    const listboxBox = await listbox.boundingBox();

    expect(minimapBox).not.toBeNull();
    expect(listboxBox).not.toBeNull();

    // The dropdown is positioned near the minimap (center of screen in sxs mode)
    // If there's overlap, we need to verify the dropdown is rendered above the minimap
    if (minimapBox && listboxBox) {
      const horizontalOverlap =
        listboxBox.x < minimapBox.x + minimapBox.width &&
        listboxBox.x + listboxBox.width > minimapBox.x;
      const verticalOverlap =
        listboxBox.y < minimapBox.y + minimapBox.height &&
        listboxBox.y + listboxBox.height > minimapBox.y;

      if (horizontalOverlap && verticalOverlap) {
        // If elements overlap, verify the dropdown is clickable (on top)
        // Try to click an option in the dropdown
        const inlineOption = listbox.getByRole("option", { name: /Inline/i });
        await expect(inlineOption).toBeVisible();

        // This click should work if the dropdown is above the minimap
        // If the minimap is covering it, this will fail
        await inlineOption.click();

        // Verify the view mode changed to inline
        await expect(splitView).toBeHidden();
      }
    }

    // Additional verification: Take a screenshot for visual debugging
    // (Commented out for CI, but useful for local debugging)
    // await page.screenshot({ path: 'test-results/minimap-zindex.png' });
  });

  test("toolbar dropdown receives pointer events when overlapping minimap", async ({ page }) => {
    await page.goto("/test/repo/777");
    await page.waitForLoadState("load");

    // Click on the file to view its diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("test-file.ts").click();

    // Wait for diff to load
    await expect(page.getByRole("heading", { name: "src/test-file.ts" })).toBeVisible();

    // Switch to Side-by-Side view
    await page.locator("body").click();
    await page.keyboard.press("x");

    // Wait for split view to render
    const splitView = page.getByRole("region", { name: "Side-by-side diff view" });
    await expect(splitView).toBeVisible();

    // Switch to full file mode to show the minimap
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    const fileContentDropdown = toolbar.getByRole("button", { name: "File content" });
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Full File/i }).click();

    // Wait for full file content to load
    await expect(page.getByText("base line 20")).toBeVisible();

    // Verify the minimap is visible
    const minimap = page.locator(".minimap");
    await expect(minimap).toBeVisible();

    // Get the computed z-index values to verify the fix
    const minimapZIndex = await minimap.evaluate((el) => {
      return window.getComputedStyle(el).zIndex;
    });

    // Open a dropdown
    const viewModeDropdown = toolbar.getByRole("button", { name: "View mode" });
    await viewModeDropdown.click();

    const listbox = page.getByRole("listbox", { name: "View mode" });
    await expect(listbox).toBeVisible();

    // The dropdown's effective z-index should be higher than the minimap's
    // Since they're in different stacking contexts, we need to check the parent contexts
    const diffHeader = page.locator(".diff-header");
    const diffHeaderZIndex = await diffHeader.evaluate((el) => {
      return window.getComputedStyle(el).zIndex;
    });

    // The diff-header should have a higher z-index than the minimap
    // to ensure its dropdown children appear above the minimap
    expect(parseInt(diffHeaderZIndex, 10)).toBeGreaterThan(parseInt(minimapZIndex, 10));
  });
});
