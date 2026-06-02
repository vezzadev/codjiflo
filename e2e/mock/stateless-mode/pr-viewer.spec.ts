import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("PR Viewer Flow - mock mode (S-1.2, S-1.3, S-1.4)", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 123;
  const prUrl = "https://github.com/test/repo/pull/123";
  const pageUrl = "/test/repo/123";

  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Add new feature: Button component",
    body: "## Summary\n\nThis PR adds a new Button component.\n\n- Feature 1\n- Feature 2",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/button", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/123",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  // Mock files matching PR #6 structure for consistent display order testing
  // Display order: "/" (root) first, then folders alphabetically
  const mockFiles: MockFile[] = [
    {
      filename: "vite.config.debug.ts",
      status: "modified",
      additions: 21,
      deletions: 2,
      changes: 23,
      patch: "@@ -1,5 +1,24 @@\n import { defineConfig } from 'vite';\n+// Debug config",
    },
    {
      filename: "e2e/app.spec.ts",
      status: "modified",
      additions: 23,
      deletions: 5,
      changes: 28,
      patch:
        "@@ -1,10 +1,28 @@\n import { test, expect } from '@playwright/test';\n+\n+test('should work', async ({ page }) => {\n+  await page.goto('/');\n+});",
    },
    {
      filename: "src/index.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "@@ -1,3 +1,4 @@\n export { App } from './App';\n+export { Button } from './components/Button';",
    },
    {
      filename: "src/old-file.ts",
      status: "removed",
      additions: 0,
      deletions: 10,
      changes: 10,
      patch: "@@ -1,10 +0,0 @@\n-// Old code\n-const unused = true;",
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Complete PR viewing journey", async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /View Pull Request/i })).toBeVisible();

    // Enter PR URL
    const input = page.getByLabel(/GitHub Pull Request URL/i);
    await input.fill(prUrl);

    // Submit form
    await page.getByRole("button", { name: /Load Pull Request/i }).click();

    // [S-1.2] Verify PR metadata is displayed
    await expect(page).toHaveURL(new RegExp(`.*${escapeRegExp(pageUrl)}`));

    // [AC-1.2.1] Title is displayed
    await expect(page.getByRole("heading", { level: 1, name: /Add new feature: Button component/i })).toBeVisible();

    // [AC-1.2.3] Author is displayed
    await expect(page.getByText("testuser")).toBeVisible();

    // [AC-1.2.4] State badge is displayed
    await expect(page.getByText("Open")).toBeVisible();

    // [AC-1.2.5] Branches are displayed
    await expect(page.getByText("feature/button")).toBeVisible();
    await expect(page.getByText("main")).toBeVisible();

    // [AC-1.2.2] Description is rendered as markdown
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();

    // [AC-1.2.6] Link to GitHub exists
    await expect(page.getByRole("link", { name: /View on GitHub/i })).toHaveAttribute(
      "href",
      "https://github.com/test/repo/pull/123"
    );
  });

  test("PR Description is shown as first entry in file list", async ({ page }) => {
    await page.goto(pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // PR Description should be the first entry in the file list
    const prDescButton = fileNav.getByRole("row", { name: /Pull Request Description/i });
    await expect(prDescButton).toBeVisible();

    // PR Description should be selected by default
    await expect(prDescButton).toHaveAttribute("aria-selected", "true");

    // Main panel should show the PR title and metadata
    await expect(page.getByRole("heading", { level: 1, name: /Add new feature: Button component/i })).toBeVisible();
    // Description content should be visible (rendered as markdown)
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  });

  test("Clicking file switches from PR Description to diff view", async ({ page }) => {
    await page.goto(pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Verify PR Description is selected initially
    const prDescButton = fileNav.getByRole("row", { name: /Pull Request Description/i });
    await expect(prDescButton).toHaveAttribute("aria-selected", "true");

    // Click on a file to switch to diff view
    await fileNav.getByText("app.spec.ts").click();

    // Diff view should show the file header
    await expect(page.getByRole("heading", { name: "e2e/app.spec.ts" })).toBeVisible();

    // PR Description should no longer be selected
    await expect(prDescButton).not.toHaveAttribute("aria-selected", "true");

    // Verify diff content is visible
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();
  });

  test("File list displays correctly", async ({ page }) => {
    await page.goto(pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    // Click on a file first to show the diff (PR description is default)
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByText("app.spec.ts").click();

    // Wait for specific mock file header
    await expect(page.getByRole("heading", { name: "e2e/app.spec.ts" })).toBeVisible();

    // [S-1.3] Wait for files to load
    await expect(fileNav.getByText("app.spec.ts")).toBeVisible();
    await expect(fileNav.getByText("index.ts")).toBeVisible();
    await expect(fileNav.getByText("old-file.ts")).toBeVisible();

    // [AC-1.3.3] Stats are displayed
    await expect(page.getByText("+23")).toBeVisible();
    await expect(page.getByText("−5")).toBeVisible();
  });

  test("Diff view renders correctly", async ({ page }) => {
    await page.goto(pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    // PR Description is now the default selection, so click a file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Click on a file to show diff
    await fileNav.getByText("app.spec.ts").click();

    // [S-1.4] Diff region should be visible
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Wait for content to load - check the diff view heading
    await expect(page.getByRole("heading", { name: "e2e/app.spec.ts" })).toBeVisible();

    // [AC-1.4.1] Code is displayed
    await expect(page.getByText(/import { test, expect }/)).toBeVisible();
  });
});
