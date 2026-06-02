import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

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
    await setupLegacyDefaults(page);
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

    // Switch to Side-by-Side view (click the file heading to neutralize focus
    // before the global "x" keyboard shortcut; the keydown handler is on document)
    await page.getByRole("heading", { name: "src/test-file.ts" }).click();
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
    const minimap = page.getByRole("img", { name: "Diff minimap navigation" });
    await expect(minimap).toBeVisible();

    // Open the View mode dropdown, which is positioned over the minimap region.
    const viewModeDropdown = toolbar.getByRole("button", { name: "View mode" });
    await viewModeDropdown.click();

    // The dropdown listbox should be visible
    const listbox = page.getByRole("listbox", { name: "View mode" });
    await expect(listbox).toBeVisible();

    // The dropdown must render above the minimap and be clickable. Playwright's
    // built-in actionability check enforces that the Inline option is the topmost
    // element at its click point: if the minimap were covering the dropdown (the
    // z-index regression), this click would fail with a pointer-interception error.
    const inlineOption = listbox.getByRole("option", { name: /Inline/i });
    await expect(inlineOption).toBeVisible();
    await inlineOption.click();

    // Selecting Inline switches the view mode, hiding the side-by-side region.
    await expect(splitView).toBeHidden();
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

    // Switch to Side-by-Side view (click the file heading to neutralize focus
    // before the global "x" keyboard shortcut; the keydown handler is on document)
    await page.getByRole("heading", { name: "src/test-file.ts" }).click();
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
    const minimap = page.getByRole("img", { name: "Diff minimap navigation" });
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
    const diffHeader = page.getByTestId("diff-header");
    const diffHeaderZIndex = await diffHeader.evaluate((el) => {
      return window.getComputedStyle(el).zIndex;
    });

    // The diff-header should have a higher z-index than the minimap
    // to ensure its dropdown children appear above the minimap
    expect(parseInt(diffHeaderZIndex, 10)).toBeGreaterThan(parseInt(minimapZIndex, 10));
  });
});
