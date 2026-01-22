/**
 * E2E test for Find in All Files (Ctrl+Shift+F) feature
 *
 * Verifies the search modal functionality including:
 * - Opening with Ctrl+Shift+F (both lowercase and uppercase f)
 * - Modal content and controls
 * - Closing with Escape
 */

import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";

test.describe("Find in All Files (Ctrl+Shift+F)", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 789,
    title: "Test PR for all files search",
    body: "Testing find in all files",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/search-all", sha: "search789" },
    base: { ref: "main", sha: "base789" },
    html_url: "https://github.com/test/repo/pull/789",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const initialFiles = {
    "src/file1.ts": "",
    "src/file2.ts": "",
  };

  const patch1 = `diff --git a/src/file1.ts b/src/file1.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/file1.ts
@@ -0,0 +1,5 @@
+export function hello() {
+  return "hello world";
+}
+
+export const greeting = "hello";
`;

  const mockFiles: MockFile[] = [
    {
      filename: "src/file1.ts",
      status: "added",
      additions: 5,
      deletions: 0,
      changes: 5,
      patch: `@@ -0,0 +1,5 @@
+export function hello() {
+  return "hello world";
+}
+
+export const greeting = "hello";`,
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 789,
    pageUrl: "/test/repo/789",
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1],
    });

    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, config.owner, config.repo, config.prNumber, mockDb);
  });

  test("Ctrl+Shift+F opens find in all files modal (lowercase f)", async ({ page }) => {
    // This test verifies the fix for the bug where Ctrl+Shift+F with lowercase 'f'
    // was not detected because the handler only checked for uppercase 'F'
    await page.goto(config.pageUrl);

    // Wait for page to load
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Modal should not be visible initially
    await expect(page.getByRole("dialog", { name: /Find in All Files/i })).not.toBeVisible();

    // Press Ctrl+Shift+F (Playwright sends lowercase 'f' even with shift)
    await page.keyboard.press("Control+Shift+f");

    // Modal should now be visible
    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Verify modal title
    await expect(modal.getByRole("heading", { name: /Find in All Files/i })).toBeVisible();
  });

  test("modal contains all expected controls", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await page.keyboard.press("Control+Shift+f");

    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Verify search input
    await expect(modal.getByRole("textbox", { name: /Search/i })).toBeVisible();

    // Verify file filter input
    await expect(modal.getByRole("textbox", { name: /File filter/i })).toBeVisible();

    // Verify iteration range options
    await expect(modal.getByRole("radio", { name: /Current iteration only/i })).toBeVisible();
    await expect(modal.getByRole("radio", { name: /Current and previous/i })).toBeVisible();
    await expect(modal.getByRole("radio", { name: /Current and later/i })).toBeVisible();
    await expect(modal.getByRole("radio", { name: /Entire review/i })).toBeVisible();

    // Verify side filter dropdown
    await expect(modal.getByRole("combobox", { name: /Side/i })).toBeVisible();

    // Verify action buttons
    await expect(modal.getByRole("button", { name: /Cancel/i })).toBeVisible();
    await expect(modal.getByRole("button", { name: /Search/i })).toBeVisible();
  });

  test("search input has auto-focus when modal opens", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await page.keyboard.press("Control+Shift+f");

    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Search input should be focused
    const searchInput = modal.getByRole("textbox", { name: /Search/i });
    await expect(searchInput).toBeFocused();
  });

  test("Escape closes the modal", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await page.keyboard.press("Control+Shift+f");

    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Press Escape to close
    await page.keyboard.press("Escape");

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });

  test("Cancel button closes the modal", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await page.keyboard.press("Control+Shift+f");

    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Click Cancel button
    await modal.getByRole("button", { name: /Cancel/i }).click();

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });

  test("Search button is disabled when query is empty", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await page.keyboard.press("Control+Shift+f");

    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Search button should be disabled when input is empty
    await expect(modal.getByRole("button", { name: /Search/i })).toBeDisabled();

    // Type a query
    await modal.getByRole("textbox", { name: /Search/i }).fill("hello");

    // Search button should now be enabled
    await expect(modal.getByRole("button", { name: /Search/i })).toBeEnabled();
  });

  test("search executes and displays results in bottom panel", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Wait for page to fully load with files
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Select the first file to ensure it's loaded (it's a treeitem)
    await page.getByRole("treeitem", { name: /file1\.ts/i }).click();

    // Open search modal
    await page.keyboard.press("Control+Shift+f");

    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Type search query that exists in the mock file
    await modal.getByRole("textbox", { name: /Search/i }).fill("hello");

    // Click Search button
    await modal.getByRole("button", { name: /Search/i }).click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Search Results tab should appear in bottom panel with matches
    const searchResultsTab = page.getByRole("tab", { name: /Search Results/i });
    await expect(searchResultsTab).toBeVisible();

    // Click on the Search Results tab
    await searchResultsTab.click();

    // Verify results panel shows the query
    await expect(page.getByText(/Query:.*"hello"/i)).toBeVisible();

    // Verify the file appears in results with matches
    await expect(page.locator(".search-results-file-path")).toContainText("src/file1.ts");
  });

  test("search with no matches shows empty results", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Select the first file (it's a treeitem)
    await page.getByRole("treeitem", { name: /file1\.ts/i }).click();

    // Open search modal
    await page.keyboard.press("Control+Shift+f");

    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Type search query that doesn't exist
    await modal.getByRole("textbox", { name: /Search/i }).fill("xyznonexistent");

    // Click Search button
    await modal.getByRole("button", { name: /Search/i }).click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // No Search Results tab should appear (empty results don't show panel)
    await expect(page.getByRole("tab", { name: /Search Results/i })).not.toBeVisible();
  });

  test("clicking search result navigates to file", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Start on PR description - verify by checking heading
    await expect(page.getByRole("heading", { name: "Test PR for all files search" })).toBeVisible();

    // Open search modal
    await page.keyboard.press("Control+Shift+f");

    const modal = page.getByRole("dialog", { name: /Find in All Files/i });
    await expect(modal).toBeVisible();

    // Search for "hello"
    await modal.getByRole("textbox", { name: /Search/i }).fill("hello");
    await modal.getByRole("button", { name: /Search/i }).click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Click on Search Results tab
    const searchResultsTab = page.getByRole("tab", { name: /Search Results/i });
    await expect(searchResultsTab).toBeVisible();
    await searchResultsTab.click();

    // Click on a match result row (the line with "hello")
    // The result shows line number and content
    const matchRow = page.locator(".search-results-match").first();
    await expect(matchRow).toBeVisible();
    await matchRow.click();

    // Should navigate to file - verify file is now selected in file list
    // The treeitem gets aria-current="location" when selected
    await expect(page.getByRole("treeitem", { name: /file1\.ts/i })).toHaveAttribute("aria-current", "location");
  });
});
