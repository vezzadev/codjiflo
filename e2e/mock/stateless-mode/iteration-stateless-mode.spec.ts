import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupStatelessIterationMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Iteration Management - Stateless Mode", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR for Iterations",
    body: "Testing iteration management",
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
    {
      filename: "src/test.ts",
      status: "modified",
      additions: 10,
      deletions: 5,
      changes: 15,
      patch: "@@ -1,5 +1,10 @@\n+// New code\n const x = 1;",
    },
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

  test("Page loads with iteration selector showing commit-based iterations", async ({
    page,
  }) => {
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: [
          {
            sha: "commit-1",
            message: "First commit",
            author: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
          {
            sha: "commit-2",
            message: "Second commit",
            author: "testuser",
            date: "2024-01-02T10:00:00Z",
          },
          {
            sha: "commit-3",
            message: "Third commit",
            author: "testuser",
            date: "2024-01-03T10:00:00Z",
          },
        ],
      }
    );

    await page.goto(config.pageUrl);

    // Wait for iteration selector to appear
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Verify 3 iteration tabs
    await expect(page.getByTestId("iteration-tab-1")).toBeVisible();
    await expect(page.getByTestId("iteration-tab-2")).toBeVisible();
    await expect(page.getByTestId("iteration-tab-3")).toBeVisible();
  });

  test("Iteration selector shows collapsed group tab for force-pushed iterations", async ({
    page,
  }) => {
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: [
          {
            sha: "new-commit-1",
            message: "New first commit",
            author: "testuser",
            date: "2024-01-03T10:00:00Z",
          },
        ],
        timeline: [
          {
            id: 0,
            event: "committed",
            created_at: "2024-01-01T12:00:00Z",
            sha: "old-before-sha",
          },
          {
            id: 5001,
            event: "head_ref_force_pushed",
            created_at: "2024-01-02T12:00:00Z",
            commit_id: "new-after-sha",
          },
        ],
      }
    );

    // Mock compare API for discarded commit discovery
    await page.route(
      "https://api.github.com/repos/test/repo/compare/new-after-sha...old-before-sha",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            commits: [
              {
                sha: "discarded-1",
                commit: {
                  message: "Old discarded commit",
                  author: {
                    name: "testuser",
                    date: "2024-01-01T10:00:00Z",
                  },
                },
                author: { login: "testuser" },
              },
            ],
          }),
        });
      }
    );

    await page.goto(config.pageUrl);

    // Wait for iteration selector to appear
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Should have collapsed group tab
    const collapsedTab = page.getByTestId("collapsed-group-5001");
    await expect(collapsedTab).toBeVisible();
    await expect(collapsedTab).toHaveAttribute(
      "title",
      "1 iteration discarded"
    );

    // Should have the live iteration tab
    await expect(page.getByTestId("iteration-tab-2")).toBeVisible();
  });

  test("Iteration selector is hidden when no artifact and no commits", async ({
    page,
  }) => {
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      { commits: [] }
    );

    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for file list (indicates loading complete)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Iteration selector should NOT be visible (no commits)
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeHidden();
  });

  test("Console warning is emitted when using GitHub API as fallback (Issue #186)", async ({
    page,
  }) => {
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: [
          {
            sha: "commit-1",
            message: "Test",
            author: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
        ],
      }
    );

    // Set up promise BEFORE navigation
    const warningPromise = page.waitForEvent("console", {
      predicate: (msg) =>
        msg.type() === "warning" &&
        msg.text().includes("[CodjiFlo] Using GitHub API as fallback"),
    });

    await page.goto(config.pageUrl);

    const warningMsg = await warningPromise;
    const statelessWarning = warningMsg.text();

    expect(statelessWarning).toContain("Reason:");
    expect(statelessWarning).toContain("CodjiFlo artifact");
  });
});
