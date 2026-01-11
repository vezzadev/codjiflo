import { test, expect } from "./fixtures/console-warnings";
import { isMockMode, prodModeConfig } from "./fixtures/mode";

// These tests don't set up iteration artifacts, so they run in degraded mode
test.use({ expectDegradedMode: true });
import {
  setupAuthState,
  setupFullPRMocks,
  setupPRMock,
  setupFilesMock,
  type MockPR,
  type MockFile,
} from "./fixtures/github-mocks";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("PR Viewer Flow (S-1.2, S-1.3, S-1.4, S-1.5)", () => {
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

  const mockFiles: MockFile[] = [
    {
      filename: "src/components/Button.tsx",
      status: "added",
      additions: 50,
      deletions: 0,
      changes: 50,
      patch:
        "@@ -0,0 +1,20 @@\n+import React from 'react';\n+\n+interface ButtonProps {\n+  label: string;\n+}\n+\n+export function Button({ label }: ButtonProps) {\n+  return <button>{label}</button>;\n+}",
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

  // Test configuration based on mode
  const getTestConfig = () => {
    if (isMockMode()) {
      return {
        owner: "test",
        repo: "repo",
        prNumber: 123,
        prUrl: "https://github.com/test/repo/pull/123",
        pageUrl: "/test/repo/123",
      };
    }
    // Prod mode uses a known public PR
    const { owner, repo, prNumber } = prodModeConfig.testRepo;
    return {
      owner,
      repo,
      prNumber,
      prUrl: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
      pageUrl: `/${owner}/${repo}/${String(prNumber)}`,
    };
  };

  test.beforeEach(async ({ page }) => {
    // Set up authentication state (uses real token in real mode)
    await setupAuthState(page);

    // Set up mocks (only applies in mock mode)
    const config = getTestConfig();
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Complete PR viewing journey", async ({ page }) => {
    const config = getTestConfig();

    // Navigate to dashboard
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /View Pull Request/i })).toBeVisible();

    // Enter PR URL
    const input = page.getByLabel(/GitHub Pull Request URL/i);
    await input.fill(config.prUrl);

    // Submit form
    await page.getByRole("button", { name: /Load Pull Request/i }).click();

    // [S-1.2] Verify PR metadata is displayed
    await expect(page).toHaveURL(new RegExp(`.*${escapeRegExp(config.pageUrl)}`));

    if (isMockMode()) {
      // Mock mode: verify exact mock data
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
    } else {
      // Real mode: verify structure exists (content will vary)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: /View on GitHub/i })).toBeVisible();
    }
  });

  test("PR Description is shown as first entry in file list", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // PR Description should be the first entry in the file list
    const prDescButton = fileNav.getByRole("listitem", { name: /Pull Request Description/i });
    await expect(prDescButton).toBeVisible();

    // PR Description should be selected by default
    await expect(prDescButton).toHaveAttribute("aria-current", "location");

    if (isMockMode()) {
      // Main panel should show the PR title and metadata
      await expect(page.getByRole("heading", { level: 1, name: /Add new feature: Button component/i })).toBeVisible();
      // Description content should be visible (rendered as markdown)
      await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    } else {
      // Real mode: verify PR title heading exists
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("Clicking file switches from PR Description to diff view", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Verify PR Description is selected initially
    const prDescButton = fileNav.getByRole("listitem", { name: /Pull Request Description/i });
    await expect(prDescButton).toHaveAttribute("aria-current", "location");

    if (isMockMode()) {
      // Click on a file to switch to diff view
      await fileNav.getByText("src/components/Button.tsx").click();

      // Diff view should show the file header
      await expect(page.getByRole("heading", { name: "src/components/Button.tsx" })).toBeVisible();

      // PR Description should no longer be selected
      await expect(prDescButton).not.toHaveAttribute("aria-current", "location");

      // Verify diff content is visible
      const diffRegion = page.getByRole("region", { name: /Diff content/i });
      await expect(diffRegion).toBeVisible();
    } else {
      // Real mode: click first actual file
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        // PR Description should no longer be selected
        await expect(prDescButton).not.toHaveAttribute("aria-current", "location");
      }
    }
  });

  test("File list displays correctly", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    if (isMockMode()) {
      // Click on a file first to show the diff (PR description is default)
      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await fileNav.getByText("src/components/Button.tsx").click();

      // Wait for specific mock file header
      await expect(page.getByRole("heading", { name: "src/components/Button.tsx" })).toBeVisible();

      // [S-1.3] Wait for files to load
      await expect(fileNav.getByText("src/components/Button.tsx")).toBeVisible();
      await expect(fileNav.getByText("src/index.ts")).toBeVisible();
      await expect(fileNav.getByText("src/old-file.ts")).toBeVisible();

      // [AC-1.3.3] Stats are displayed
      await expect(page.getByText("+50")).toBeVisible();
      await expect(page.getByText("−10")).toBeVisible();
    } else {
      // Real mode: verify file nav structure exists
      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible();
    }
  });

  test("Diff view renders correctly", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    // PR Description is now the default selection, so click a file first
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      // Click on a file to show diff
      await fileNav.getByText("src/components/Button.tsx").click();

      // [S-1.4] Diff region should be visible
      const diffRegion = page.getByRole("region", { name: /Diff content/i });
      await expect(diffRegion).toBeVisible();

      // Wait for content to load - check the diff view heading
      await expect(page.getByRole("heading", { name: "src/components/Button.tsx" })).toBeVisible();

      // [AC-1.4.1] Code is displayed
      await expect(page.getByText(/import React from/)).toBeVisible();
    } else {
      // Real mode: click first actual file
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible();
      }
    }
  });

  test("Keyboard navigation works", async ({ page }) => {
    // Navigate to appropriate PR based on mode
    if (isMockMode()) {
      await page.goto("/test/repo/123");
    } else {
      // Prod mode: use PR #6 which has multiple files
      const { owner, repo, prNumber } = prodModeConfig.keyboardNavPR;
      await page.goto(`/${owner}/${repo}/${String(prNumber)}`);
    }

    // Wait for page to fully stabilize
    await page.waitForLoadState("load");

    // Wait for the file navigation to be fully loaded
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Wait for at least 2 buttons to be visible (PR description + at least 1 file)
    const fileButtons = fileNav.getByRole("listitem");
    await expect(fileButtons.first()).toBeVisible();

    // Get all file buttons and verify we have at least 2 (PR description + 1 file)
    const allButtons = await fileButtons.all();
    if (allButtons.length < 2) {
      test.skip(true, "PR needs at least 1 file for keyboard navigation test");
      return;
    }

    // PR Description (first button) should be selected by default
    const prDescButton = fileButtons.first();
    await expect(prDescButton).toHaveAttribute("aria-current", "location", );

    // Focus on the page body to ensure keyboard events work
    await page.locator("body").click();
    // Wait for focus to settle by ensuring the body is focused
    await page.waitForFunction(() => document.activeElement === document.body);

    // [AC-1.5.1] Press s to go to first file (next file)
    await page.keyboard.press("s");

    // First file (second button) should be selected
    const firstFile = fileButtons.nth(1);
    await expect(firstFile).toHaveAttribute("aria-current", "location");

    // [AC-1.5.1] Press w to go back to PR Description (previous file)
    await page.keyboard.press("w");
    await expect(prDescButton).toHaveAttribute("aria-current", "location");
  });

  test("Shortcuts modal opens with ? button", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);

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
    if (isMockMode()) {
      // Mock 404 response
      await setupPRMock(page, "test", "repo", 999, { failWith: 404 });
      await setupFilesMock(page, "test", "repo", 999, { failWith: 404 });
      await page.goto("/test/repo/999");
    } else {
      // Prod mode: use non-existent PR #0
      const { owner, repo, prNumber } = prodModeConfig.notFoundPR;
      await page.goto(`/${owner}/${repo}/${String(prNumber)}`);
    }

    // Should show error message (use first() since error may appear in multiple places)
    await expect(page.getByText(/Pull request not found/i).first()).toBeVisible();
  });
});
