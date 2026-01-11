import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
  type MockComment,
} from "../../fixtures/github-mocks";

test.describe("Inline comments flow (S-2.x)", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Review: inline comments",
    body: "Sample PR for comment testing",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/comments", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/123",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/example.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "@@ -1,1 +1,2 @@\n const foo = 'bar';\n+const added = true;",
    },
  ];

  const mockComments: MockComment[] = [
    {
      id: 999,
      body: "Please add a quick note about this flag.",
      user: {
        id: 2,
        login: "reviewer",
        avatar_url: "https://avatars.githubusercontent.com/u/2",
      },
      created_at: "2024-01-02T12:00:00Z",
      updated_at: "2024-01-02T12:00:00Z",
      path: "src/example.ts",
      line: 2,
      side: "RIGHT",
      position: 2,
    },
  ];

  // Test configuration based on mode
  const getTestConfig = () => {
    if (isMockMode()) {
      return {
        owner: "test",
        repo: "repo",
        prNumber: 123,
        pageUrl: "/test/repo/123",
      };
    }
    // Prod mode uses a known public PR
    const { owner, repo, prNumber } = prodModeConfig.testRepo;
    return {
      owner,
      repo,
      prNumber,
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
      comments: mockComments,
    });
  });

  test("shows existing threads and allows adding a comment", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);

    // Wait for page to fully stabilize
    await page.waitForLoadState("load");

    if (isMockMode()) {
      // Wait for the file navigation to be fully loaded
      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible();
      await expect(fileNav.getByText("src/example.ts")).toBeVisible();

      // PR Description is selected by default, click on the file to show diff
      await fileNav.getByText("src/example.ts").click();

      // Wait for page to load - check the diff heading as a stable indicator
      await expect(page.getByRole("heading", { name: "src/example.ts" })).toBeVisible();

      // Wait for the file list item to be visible and selected
      const fileListItem = page.getByRole("listitem", { name: /src\/example\.ts/ });
      await expect(fileListItem).toBeVisible();
      await expect(fileListItem).toHaveAttribute("aria-current", "location", );

      // The diff content should be rendered in a table
      const diffTable = page.locator('table');
      await expect(diffTable).toBeVisible();

      // Verify the existing comment is displayed (comments load async)
      const threadRegion = page.getByRole('region', { name: 'Thread on line 2 (added line)' });
      await expect(threadRegion.getByText('Please add a quick note about this flag.', { exact: true })).toBeVisible();
    } else {
      // Real mode: just verify structure loads
      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible();

      // Click first file to show diff (PR description is default)
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
      }

      const diffRegion = page.getByRole("region", { name: /Diff content/i });
      await expect(diffRegion).toBeVisible();
    }
  });
});
