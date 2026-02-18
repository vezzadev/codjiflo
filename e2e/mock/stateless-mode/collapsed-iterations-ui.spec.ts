import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupStatelessIterationMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Collapsed Iterations UI", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR for Collapsed History",
    body: "Testing collapsed iteration history view",
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
    updated_at: "2024-01-05T15:00:00Z",
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

  /**
   * Helper: set up a force-push scenario with mock compare API.
   * Returns the force-push event ID for collapsed group tab targeting.
   */
  async function setupForcePushScenario(
    page: import("@playwright/test").Page,
    options: {
      eventId: number;
      beforeSha: string;
      afterSha: string;
      liveCommits: {
        sha: string;
        message: string;
        author: string;
        date: string;
      }[];
      compareResponse:
        | {
            status: 200;
            commits: {
              sha: string;
              message: string;
              authorName: string;
              authorLogin: string;
              date: string;
            }[];
          }
        | { status: 404 };
    }
  ): Promise<void> {
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: options.liveCommits,
        timeline: [
          {
            id: options.eventId,
            event: "head_ref_force_pushed",
            created_at: "2024-01-02T12:00:00Z",
            before_commit: { sha: options.beforeSha },
            after_commit: { sha: options.afterSha },
          },
        ],
      }
    );

    await page.route(
      `https://api.github.com/repos/${config.owner}/${config.repo}/compare/${options.afterSha}...${options.beforeSha}`,
      async (route) => {
        if (options.compareResponse.status === 404) {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ message: "Not Found" }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            commits: options.compareResponse.commits.map((c) => ({
              sha: c.sha,
              commit: {
                message: c.message,
                author: { name: c.authorName, date: c.date },
              },
              author: { login: c.authorLogin },
            })),
          }),
        });
      }
    );
  }

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Click collapsed tab shows history view with commit details and iteration selector stays visible", async ({
    page,
  }) => {
    await setupForcePushScenario(page, {
      eventId: 5001,
      beforeSha: "old-before-sha",
      afterSha: "new-after-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "New first commit after force push",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
        {
          sha: "new-commit-2",
          message: "Second commit after force push",
          author: "testuser",
          date: "2024-01-04T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-aaa111",
            message: "Old WIP commit that was squashed",
            authorName: "alice",
            authorLogin: "alice",
            date: "2024-01-01T10:00:00Z",
          },
          {
            sha: "discarded-bbb222",
            message: "Another discarded commit with fixes",
            authorName: "bob",
            authorLogin: "bob",
            date: "2024-01-01T14:00:00Z",
          },
        ],
      },
    });

    await page.goto(config.pageUrl);

    // Wait for iteration selector to appear
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Collapsed group tab must be a <button> (not static <div>), without role="img"
    const collapsedTab = page.getByTestId("collapsed-group-5001");
    await expect(collapsedTab).toBeVisible();
    const tagName = await collapsedTab.evaluate((el) =>
      el.tagName.toLowerCase()
    );
    expect(tagName).toBe("button");
    await expect(collapsedTab).not.toHaveAttribute("role", "img");

    // Click the collapsed group tab
    await collapsedTab.click();

    // History view should appear
    const historyView = page.getByTestId("collapsed-history-view");
    await expect(historyView).toBeVisible();

    // Iteration selector must still be visible above the history view
    await expect(selector).toBeVisible();

    // Verify header shows "Discarded Iterations" (exact match to avoid matching button text)
    await expect(historyView.getByText("Discarded Iterations", { exact: true })).toBeVisible();

    // Verify commit 1: sha, message (first line only), author
    const commit1 = page.getByTestId(
      "collapsed-history-commit-discarded-aaa111"
    );
    await expect(commit1).toBeVisible();
    await expect(commit1).toContainText("Old WIP commit that was squashed");
    await expect(commit1).toContainText("alice");

    // Verify commit 2: sha, message, author
    const commit2 = page.getByTestId(
      "collapsed-history-commit-discarded-bbb222"
    );
    await expect(commit2).toBeVisible();
    await expect(commit2).toContainText("Another discarded commit with fixes");
    await expect(commit2).toContainText("bob");

    // Multi-line commit message edge case: only first line shown
    // (commit1 message is single-line, so this is a positive check —
    //  the dedicated multi-line test below covers the negative assertion)

    // "Include discarded iterations" button must be present
    const includeBtn = page.getByTestId("collapsed-history-include-btn");
    await expect(includeBtn).toBeVisible();
    await expect(includeBtn).toContainText("Include discarded iterations");
  });

  test("Click Include discarded iterations button dismisses history view", async ({
    page,
  }) => {
    await setupForcePushScenario(page, {
      eventId: 6001,
      beforeSha: "old-expand-sha",
      afterSha: "new-expand-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "New commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-exp-1",
            message: "Discarded commit 1",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
          {
            sha: "discarded-exp-2",
            message: "Discarded commit 2",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T12:00:00Z",
          },
        ],
      },
    });

    await page.goto(config.pageUrl);

    // Open history view
    const collapsedTab = page.getByTestId("collapsed-group-6001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();

    const historyView = page.getByTestId("collapsed-history-view");
    await expect(historyView).toBeVisible();

    // Click "Include discarded iterations"
    const includeBtn = page.getByTestId("collapsed-history-include-btn");
    await includeBtn.click();

    // History view should be dismissed (activeCollapsedGroupId cleared)
    await expect(historyView).toBeHidden();

    // The iteration selector should still be visible (no crash)
    await expect(page.getByTestId("iteration-selector")).toBeVisible();
  });

  test("Unknown count group shows 'Unknown iterations were discarded' message", async ({
    page,
  }) => {
    // Compare API returns 404 → unknownCount group (GC'd before SHA)
    await setupForcePushScenario(page, {
      eventId: 7001,
      beforeSha: "gc-before-sha",
      afterSha: "gc-after-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Post force-push commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: { status: 404 },
    });

    await page.goto(config.pageUrl);

    const collapsedTab = page.getByTestId("collapsed-group-7001");
    await expect(collapsedTab).toBeVisible();

    // Tooltip should indicate unknown count
    await expect(collapsedTab).toHaveAttribute(
      "title",
      "Unknown iterations discarded"
    );

    // Click the collapsed tab to open history view
    await collapsedTab.click();

    const historyView = page.getByTestId("collapsed-history-view");
    await expect(historyView).toBeVisible();

    // Should show "Unknown iterations were discarded" message (no individual commits)
    await expect(historyView).toContainText(
      "Unknown iterations were discarded"
    );

    // Should NOT have any individual commit rows (there are none to show)
    const commitRows = page.locator('[data-testid^="collapsed-history-commit-"]');
    await expect(commitRows).toHaveCount(0);
  });

  test("Selecting a regular iteration tab dismisses the history view", async ({
    page,
  }) => {
    await setupForcePushScenario(page, {
      eventId: 8001,
      beforeSha: "old-dismiss-sha",
      afterSha: "new-dismiss-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "New commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-dismiss",
            message: "Discarded commit",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
        ],
      },
    });

    await page.goto(config.pageUrl);

    // Open history view
    const collapsedTab = page.getByTestId("collapsed-group-8001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();

    const historyView = page.getByTestId("collapsed-history-view");
    await expect(historyView).toBeVisible();

    // Click a regular live iteration tab to dismiss
    const liveTab = page.getByTestId("iteration-tab-2");
    await expect(liveTab).toBeVisible();
    await liveTab.click();

    // History view should be dismissed
    await expect(historyView).toBeHidden();
  });

  test("History view shows only the first line of multi-line commit messages", async ({
    page,
  }) => {
    await setupForcePushScenario(page, {
      eventId: 9001,
      beforeSha: "old-sha-multi",
      afterSha: "new-sha-multi",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Commit after force push",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-multi",
            message:
              "Fix: handle edge case in parser\n\nThis commit addresses the issue where\nmultiline strings would break the parser.\n\nFixes #42",
            authorName: "charlie",
            authorLogin: "charlie",
            date: "2024-01-01T10:00:00Z",
          },
        ],
      },
    });

    await page.goto(config.pageUrl);

    const collapsedTab = page.getByTestId("collapsed-group-9001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();

    const historyView = page.getByTestId("collapsed-history-view");
    await expect(historyView).toBeVisible();

    // Should show only first line of commit message
    const commitItem = page.getByTestId(
      "collapsed-history-commit-discarded-multi"
    );
    await expect(commitItem).toContainText(
      "Fix: handle edge case in parser"
    );
    // Must NOT show subsequent lines from the multi-line message
    await expect(commitItem).not.toContainText("This commit addresses");
    await expect(commitItem).not.toContainText("Fixes #42");
  });
});
