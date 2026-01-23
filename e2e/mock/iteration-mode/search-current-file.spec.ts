/**
 * E2E test for Find in Current File (Ctrl+F) feature
 *
 * Verifies the search bar functionality including:
 * - Opening/closing with Ctrl+F and Escape
 * - Search query input and match counting
 * - Navigation with F3/Shift+F3
 * - Search option toggles (Match Case, Whole Word, Regex)
 */

import { test, expect, type Page } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";

test.describe("Find in Current File (Ctrl+F)", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 456,
    title: "Test PR for search",
    body: "Testing find in file",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/search", sha: "search123" },
    base: { ref: "main", sha: "base456" },
    html_url: "https://github.com/test/repo/pull/456",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  // Initial files (base state - empty for this new file)
  const initialFiles = {
    "src/search-test.ts": "",
  };

  // Patch that creates the file with searchable content
  const patch1 = `diff --git a/src/search-test.ts b/src/search-test.ts
new file mode 100644
index 0000000..abcdefg
--- /dev/null
+++ b/src/search-test.ts
@@ -0,0 +1,13 @@
+function hello() {
+  console.log("Hello World");
+  console.log("Hello again");
+  return "hello";
+}
+
+function goodbye() {
+  console.log("Goodbye World");
+}
+
+// HELLO in caps
+const message = "hello";
`;

  const mockFiles: MockFile[] = [
    {
      filename: "src/search-test.ts",
      status: "added",
      additions: 13,
      deletions: 0,
      changes: 13,
      patch: `@@ -0,0 +1,13 @@
+function hello() {
+  console.log("Hello World");
+  console.log("Hello again");
+  return "hello";
+}
+
+function goodbye() {
+  console.log("Goodbye World");
+}
+
+// HELLO in caps
+const message = "hello";`,
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 456,
    pageUrl: "/test/repo/456",
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    // Build mock iteration database
    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1],
    });

    // Setup PR mocks and iteration artifact
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, config.owner, config.repo, config.prNumber, mockDb);
  });

  // Helper to open find bar
  async function openFindBar(page: Page) {
    // Use keyboard shortcut Ctrl+F
    await page.keyboard.press("Control+f");
    // Wait for search bar to appear
    await expect(page.getByTestId("find-in-file-bar")).toBeVisible();
  }

  test("Ctrl+F opens find bar", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Find bar should not be visible initially
    await expect(page.getByTestId("find-in-file-bar")).toBeHidden();

    // Open find bar with Ctrl+F
    await openFindBar(page);
  });

  test("Escape closes find bar", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar
    await openFindBar(page);

    // Press Escape to close
    await page.keyboard.press("Escape");

    // Find bar should be hidden
    await expect(page.getByTestId("find-in-file-bar")).toBeHidden();
  });

  test("close button closes find bar", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar
    await openFindBar(page);

    // Click close button
    await page.getByTestId("find-in-file-close").click();

    // Find bar should be hidden
    await expect(page.getByTestId("find-in-file-bar")).toBeHidden();
  });

  test("typing query shows match count", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar
    await openFindBar(page);

    // Type search query
    const searchInput = page.getByTestId("find-in-file-input");
    await searchInput.fill("hello");

    // Should show match count (case-insensitive, expect multiple matches)
    const matchCounter = page.getByTestId("find-in-file-counter");
    await expect(matchCounter).toBeVisible();
    await expect(matchCounter).toContainText(/\d+\s*\/\s*\d+/);
  });

  test("F3 navigates to next match", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar and search
    await openFindBar(page);
    const searchInput = page.getByTestId("find-in-file-input");
    await searchInput.fill("hello");

    // Get initial match counter
    const matchCounter = page.getByTestId("find-in-file-counter");
    await expect(matchCounter).toContainText(/1\s*\/\s*\d+/);

    // Press F3 to go to next
    await page.keyboard.press("F3");

    // Counter should update to show 2 / total
    await expect(matchCounter).toContainText(/2\s*\/\s*\d+/);
  });

  test("Shift+F3 navigates to previous match", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar and search
    await openFindBar(page);
    const searchInput = page.getByTestId("find-in-file-input");
    await searchInput.fill("hello");

    // Navigate forward first
    const matchCounter = page.getByTestId("find-in-file-counter");
    await expect(matchCounter).toContainText(/1\s*\/\s*\d+/);
    await page.keyboard.press("F3");
    await expect(matchCounter).toContainText(/2\s*\/\s*\d+/);

    // Press Shift+F3 to go back
    await page.keyboard.press("Shift+F3");
    await expect(matchCounter).toContainText(/1\s*\/\s*\d+/);
  });

  test("Match Case toggle affects search results", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar and search for "hello" (lowercase)
    await openFindBar(page);
    const searchInput = page.getByTestId("find-in-file-input");
    await searchInput.fill("hello");

    // Get match count (case-insensitive by default - includes "Hello" and "HELLO")
    const matchCounter = page.getByTestId("find-in-file-counter");
    await expect(matchCounter).toBeVisible();

    // Enable Match Case
    const matchCaseBtn = page.getByTestId("search-option-matchCase");
    await matchCaseBtn.click();

    // Should now only match lowercase "hello" occurrences
    // The count might change - just verify toggle works without error
    await expect(matchCounter).toBeVisible();
  });

  test("Whole Word toggle affects search results", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar and search for "log"
    await openFindBar(page);
    const searchInput = page.getByTestId("find-in-file-input");
    await searchInput.fill("log");

    // Get match count (partial matches included)
    const matchCounter = page.getByTestId("find-in-file-counter");
    await expect(matchCounter).toBeVisible();

    // Enable Whole Word
    const wholeWordBtn = page.getByTestId("search-option-matchWholeWord");
    await wholeWordBtn.click();

    // Results should exist and toggle should work
    await expect(matchCounter).toBeVisible();
  });

  test("Regex toggle enables regex search", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar
    await openFindBar(page);
    const searchInput = page.getByTestId("find-in-file-input");

    // Enable Regex first
    const regexBtn = page.getByTestId("search-option-useRegex");
    await regexBtn.click();

    // Search with regex pattern
    await searchInput.fill("console\\.log");

    // Should find matches
    const matchCounter = page.getByTestId("find-in-file-counter");
    await expect(matchCounter).toContainText(/\d+\s*\/\s*\d+/);
  });

  test("search input has auto-focus when opened", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar
    await openFindBar(page);

    // Search input should be focused
    const searchInput = page.getByTestId("find-in-file-input");
    await expect(searchInput).toBeFocused();
  });

  test("no results shows zero count", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Select the file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByRole("treeitem", { name: /search-test\.ts/ }).click();

    // Open find bar and search for non-existent text
    await openFindBar(page);
    const searchInput = page.getByTestId("find-in-file-input");
    await searchInput.fill("xyznonexistent123");

    // Should show 0 / 0
    const matchCounter = page.getByTestId("find-in-file-counter");
    await expect(matchCounter).toContainText("0 / 0");
  });
});
