import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

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
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("filter input is visible in header", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Filter input is in header
    const filterInput = page.getByPlaceholder("Filter by file name");
    await expect(filterInput).toBeVisible();
  });

  test("filtering shows matching files and hides non-matching", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Type in filter
    const filterInput = page.getByPlaceholder("Filter by file name");
    await filterInput.fill("auth");

    // Only auth files visible
    await expect(fileNav.getByRole("row", { name: /login\.ts/ })).toBeVisible();
    await expect(fileNav.getByRole("row", { name: /logout\.ts/ })).toBeVisible();

    // Non-matching files hidden
    await expect(fileNav.getByRole("row", { name: /helpers\.ts/ })).toBeHidden();
    await expect(fileNav.getByRole("row", { name: /README\.md/ })).toBeHidden();
  });

  test("clear button appears and clears filter", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    const filterInput = page.getByPlaceholder("Filter by file name");
    const clearButton = page.getByLabel("Clear filter");

    // Clear button not visible initially
    await expect(clearButton).toBeHidden();

    // Type in filter
    await filterInput.fill("auth");

    // Clear button now visible
    await expect(clearButton).toBeVisible();

    // Verify filter is active
    await expect(fileNav.getByRole("row", { name: /helpers\.ts/ })).toBeHidden();

    // Click clear
    await clearButton.click();

    // Filter cleared, all files visible
    await expect(filterInput).toHaveValue("");
    await expect(fileNav.getByRole("row", { name: /helpers\.ts/ })).toBeVisible();
  });

  test("Escape key clears filter", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    const filterInput = page.getByPlaceholder("Filter by file name");
    await filterInput.fill("auth");

    // Verify filter is active
    await expect(fileNav.getByRole("row", { name: /helpers\.ts/ })).toBeHidden();

    // Press Escape
    await filterInput.press("Escape");

    // Filter cleared
    await expect(filterInput).toHaveValue("");
    await expect(fileNav.getByRole("row", { name: /helpers\.ts/ })).toBeVisible();
  });

  test("PR description hidden when filter does not match", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    const prDescription = fileNav.getByRole("row", { name: /Pull Request Description/i });

    // PR description visible initially
    await expect(prDescription).toBeVisible();

    // Apply non-matching filter
    const filterInput = page.getByPlaceholder("Filter by file name");
    await filterInput.fill("auth");

    // PR description hidden when filter doesn't match
    await expect(prDescription).toBeHidden();

    // Clear filter
    await filterInput.press("Escape");

    // PR description visible again
    await expect(prDescription).toBeVisible();
  });

  test("PR description shown when filter matches", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    const prDescription = fileNav.getByRole("row", { name: /Pull Request Description/i });
    const filterInput = page.getByPlaceholder("Filter by file name");

    // Apply matching filter
    await filterInput.fill("pull");

    // PR description visible when filter matches
    await expect(prDescription).toBeVisible();

    // Also test partial match
    await filterInput.fill("description");
    await expect(prDescription).toBeVisible();
  });
});
