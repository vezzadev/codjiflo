import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

test.describe("File Filter in Header", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR with multiple files",
    body: "Testing file filter",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/test", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/123",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    { filename: "src/auth/login.ts", status: "added", additions: 10, deletions: 0, changes: 10, patch: "@@ +1,10 @@\n+code" },
    { filename: "src/auth/logout.ts", status: "modified", additions: 5, deletions: 2, changes: 7, patch: "@@ -1,2 +1,5 @@\n-old\n+new" },
    { filename: "src/utils/helpers.ts", status: "modified", additions: 2, deletions: 1, changes: 3, patch: "@@ -1,1 +1,2 @@" },
    { filename: "README.md", status: "modified", additions: 1, deletions: 0, changes: 1, patch: "@@ -1 +1 @@" },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 123,
    pageUrl: "/test/repo/123",
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("filter input is visible in header with file count", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Header shows Files label and count within the file navigation
    const header = fileNav.locator(".file-explorer-header");
    await expect(header.getByText("Files")).toBeVisible();
    await expect(header.getByText("(4)")).toBeVisible();

    // Filter input is in header
    const filterInput = page.getByPlaceholder("Filter...");
    await expect(filterInput).toBeVisible();
  });

  test("filtering shows matching files and updates count", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Type in filter
    const filterInput = page.getByPlaceholder("Filter...");
    await filterInput.fill("auth");

    // Count updates to filtered/total
    await expect(page.getByText("(2/4)")).toBeVisible();

    // Only auth files visible
    await expect(fileNav.getByRole("treeitem", { name: /login\.ts/ })).toBeVisible();
    await expect(fileNav.getByRole("treeitem", { name: /logout\.ts/ })).toBeVisible();

    // Non-matching files hidden
    await expect(fileNav.getByRole("treeitem", { name: /helpers\.ts/ })).not.toBeVisible();
    await expect(fileNav.getByRole("treeitem", { name: /README\.md/ })).not.toBeVisible();
  });

  test("clear button appears and clears filter", async ({ page }) => {
    await page.goto(config.pageUrl);

    const filterInput = page.getByPlaceholder("Filter...");
    const clearButton = page.getByLabel("Clear filter");

    // Clear button not visible initially
    await expect(clearButton).not.toBeVisible();

    // Type in filter
    await filterInput.fill("auth");
    await expect(page.getByText("(2/4)")).toBeVisible();

    // Clear button now visible
    await expect(clearButton).toBeVisible();

    // Click clear
    await clearButton.click();

    // Filter cleared, all files visible
    await expect(page.getByText("(4)")).toBeVisible();
    await expect(filterInput).toHaveValue("");
  });

  test("Escape key clears filter", async ({ page }) => {
    await page.goto(config.pageUrl);

    const filterInput = page.getByPlaceholder("Filter...");
    await filterInput.fill("auth");
    await expect(page.getByText("(2/4)")).toBeVisible();

    // Press Escape
    await filterInput.press("Escape");

    // Filter cleared
    await expect(page.getByText("(4)")).toBeVisible();
    await expect(filterInput).toHaveValue("");
  });

  test("PR description hidden when filter is active", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    const prDescription = fileNav.getByRole("treeitem", { name: /Pull Request Description/i });

    // PR description visible initially
    await expect(prDescription).toBeVisible();

    // Apply filter
    const filterInput = page.getByPlaceholder("Filter...");
    await filterInput.fill("auth");

    // PR description hidden
    await expect(prDescription).not.toBeVisible();

    // Clear filter
    await filterInput.press("Escape");

    // PR description visible again
    await expect(prDescription).toBeVisible();
  });
});
