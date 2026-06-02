import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
  setupPRMock,
  setupFilesMock,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("PR Viewer Flow (S-1.5 keyboard + error handling)", () => {
  // Mock PR data - used in mock mode
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

  // Mode-keyed config for the standard PR used by the keyboard-nav test.
  const getTestConfig = () => {
    if (isMockMode()) {
      return {
        owner: "test",
        repo: "repo",
        prNumber: 123,
        keyboardNavUrl: "/test/repo/123",
      };
    }
    // Prod mode: PR #6 has multiple files for keyboard navigation testing.
    const { owner, repo, prNumber } = prodModeConfig.keyboardNavPR;
    return {
      owner,
      repo,
      prNumber,
      keyboardNavUrl: `/${owner}/${repo}/${String(prNumber)}`,
    };
  };

  // Mode-keyed config for the 404 test.
  const getNotFoundConfig = () => {
    if (isMockMode()) {
      return { owner: "test", repo: "repo", prNumber: 999, url: "/test/repo/999" };
    }
    const { owner, repo, prNumber } = prodModeConfig.notFoundPR;
    return {
      owner,
      repo,
      prNumber,
      url: `/${owner}/${repo}/${String(prNumber)}`,
    };
  };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    // Set up authentication state (uses real token in real mode)
    await setupAuthState(page);

    // Set up mocks for the standard keyboard-nav PR (no-op in prod mode).
    const config = getTestConfig();
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });

    // Arrange the 404 PR mocks (no-op in prod mode).
    const notFound = getNotFoundConfig();
    await setupPRMock(page, notFound.owner, notFound.repo, notFound.prNumber, { failWith: 404 });
    await setupFilesMock(page, notFound.owner, notFound.repo, notFound.prNumber, { failWith: 404 });
  });

  test("Keyboard navigation works", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.keyboardNavUrl);

    // Wait for page to fully stabilize
    await page.waitForLoadState("load");

    // Wait for the file navigation to be fully loaded
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Get PR Description button
    const prDescButton = fileNav.getByRole("row", { name: /Pull Request Description/i });
    await expect(prDescButton).toBeVisible();

    // Wait for file items to be visible
    const fileItems = fileNav.getByTestId("file-tree-item");
    await expect(fileItems.first()).toBeVisible();

    // PR Description should be selected by default
    await expect(prDescButton).toHaveAttribute("aria-selected", "true");

    // Click on the main content area to ensure keyboard shortcuts work without triggering navigation
    await page.getByRole("main").click();

    // [AC-1.5.1] Press s to go to first file (next file)
    // Note: keyboard navigation follows display order (folder-grouped, "/" first)
    // Issue #261: Changed from original index order to match visual tree order
    await page.keyboard.press("s");

    // The first file in display order should be selected
    // Both modes have vite.config.debug.ts in root "/" folder (comes first)
    const firstFileInDisplayOrder = fileNav.getByRole("row", { name: /vite\.config\.debug\.ts/ });
    await expect(firstFileInDisplayOrder).toHaveAttribute("aria-selected", "true");

    // [AC-1.5.1] Press w to go back to PR Description (previous file)
    await page.keyboard.press("w");
    await expect(prDescButton).toHaveAttribute("aria-selected", "true");
  });

  test("Shortcuts modal opens with ? button", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.keyboardNavUrl);

    // Wait for page to fully stabilize
    await page.waitForLoadState("load");

    // Wait for the shortcuts button to be visible and stable
    const shortcutsButton = page.getByRole("button", { name: /Show keyboard shortcuts/i });
    await expect(shortcutsButton).toBeVisible();

    // Wait for any re-renders to complete by checking button is stable
    await expect(shortcutsButton).toBeEnabled();

    // [AC-1.5.4] Click the shortcuts button to open modal
    await shortcutsButton.click();

    // Modal should be visible
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Keyboard Shortcuts")).toBeVisible();
    await expect(page.getByText("Next file")).toBeVisible();

    // Close modal by clicking the Close button
    await page.getByRole("button", { name: /Close/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Error handling for invalid PR URL", async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/dashboard");

    // Wait for page to be fully loaded
    await expect(page.getByRole("heading", { name: /View Pull Request/i })).toBeVisible();

    // Wait for hydration by ensuring the input is ready
    const input = page.getByLabel(/GitHub Pull Request URL/i);
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    // Enter invalid URL
    await input.fill("https://gitlab.com/owner/repo/pull/123");

    // Wait for form state to update by checking submit button is ready
    const submitButton = page.getByRole("button", { name: /Load Pull Request/i });
    await expect(submitButton).toBeEnabled();

    // Submit form
    await submitButton.click();

    // Should show error message
    await expect(page.getByText(/Invalid GitHub PR URL/i)).toBeVisible();
  });

  test("Error handling for 404 PR", async ({ page }) => {
    const notFound = getNotFoundConfig();
    await page.goto(notFound.url);

    // Should show error message (use first() since error may appear in multiple places)
    await expect(page.getByText(/Pull request not found/i).first()).toBeVisible();
  });
});
