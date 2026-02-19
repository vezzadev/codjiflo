/**
 * Force-Push Detection with Real GitHub API Shape
 *
 * The real GitHub Timeline API's `head_ref_force_pushed` event provides:
 * - `commit_id`: string — the new HEAD SHA after the force-push
 *
 * It does NOT provide `before_commit`/`after_commit` nested objects.
 * The "before" SHA must be inferred by tracking `committed` events
 * that precede the force-push in the timeline.
 *
 * These tests verify that the mock infrastructure sends the correct
 * API shape AND that the TimelineLoader correctly processes it to
 * produce collapsed iteration groups.
 *
 * Spec references: AC-4.2.1.4, AC-4.2.1.5, AC-4.2.1.8
 */

import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupStatelessIterationMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Force-Push Detection with Real GitHub API Shape", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 456,
    title: "PR with force-push history",
    body: "Testing real API shape for force-push events",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/force-push-test", sha: "head-sha-456" },
    base: { ref: "main", sha: "base-sha-456" },
    html_url: "https://github.com/test/repo/pull/456",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-05T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/app.ts",
      status: "modified",
      additions: 5,
      deletions: 2,
      changes: 7,
      patch: "@@ -1,2 +1,5 @@\n+// Force push test\n const x = 1;",
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 456,
    pageUrl: "/test/repo/456",
  };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Collapsed group tab appears when timeline has real API shape (commit_id + committed events)", async ({
    page,
  }) => {
    // Mock timeline with the REAL GitHub API shape:
    // - `committed` events track the current HEAD via `sha` field
    // - `head_ref_force_pushed` events provide only `commit_id` (the new HEAD)
    // - The "before" SHA is inferred from the most recent `committed` event
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: [
          {
            sha: "new-commit-after-fp",
            message: "New commit after force push",
            author: "testuser",
            date: "2024-01-03T10:00:00Z",
          },
        ],
        timeline: [
          // committed event establishes the HEAD before the force-push
          {
            id: 1,
            event: "committed",
            created_at: "2024-01-01T12:00:00Z",
            sha: "old-head-before-fp",
          },
          // Force-push event with ONLY commit_id (real API shape)
          {
            id: 3001,
            event: "head_ref_force_pushed",
            created_at: "2024-01-02T12:00:00Z",
            commit_id: "new-head-after-fp",
          },
        ],
      }
    );

    // Mock compare API: afterSha...beforeSha discovers discarded commits
    await page.route(
      `https://api.github.com/repos/${config.owner}/${config.repo}/compare/new-head-after-fp...old-head-before-fp`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            commits: [
              {
                sha: "discarded-real-api-1",
                commit: {
                  message: "Old commit before force push",
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

    // The iteration selector should appear
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // A collapsed group tab should appear for force-push event 3001
    const collapsedTab = page.getByTestId("collapsed-group-3001");
    await expect(collapsedTab).toBeVisible();

    // Tooltip should show "1 iteration discarded"
    await expect(collapsedTab).toHaveAttribute(
      "title",
      "1 iteration discarded"
    );

    // Click the collapsed tab to see the history view
    await collapsedTab.click();

    const historyView = page.getByTestId("collapsed-history-view");
    await expect(historyView).toBeVisible();

    // Verify the discarded commit details are shown
    const commit = page.getByTestId(
      "collapsed-history-commit-discarded-real-api-1"
    );
    await expect(commit).toBeVisible();
    await expect(commit).toContainText("Old commit before force push");
    await expect(commit).toContainText("testuser");
  });

  test("Multiple force-pushes with committed events produce correct collapsed groups", async ({
    page,
  }) => {
    // Scenario: Two force-pushes in sequence, each preceded by committed events
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: [
          {
            sha: "final-live-commit",
            message: "Final commit on branch",
            author: "testuser",
            date: "2024-01-10T10:00:00Z",
          },
        ],
        timeline: [
          // First committed event → establishes HEAD for first force-push
          {
            id: 10,
            event: "committed",
            created_at: "2024-01-01T10:00:00Z",
            sha: "first-old-head",
          },
          // First force-push
          {
            id: 4001,
            event: "head_ref_force_pushed",
            created_at: "2024-01-02T10:00:00Z",
            commit_id: "first-new-head",
          },
          // Second committed event → establishes HEAD for second force-push
          {
            id: 20,
            event: "committed",
            created_at: "2024-01-05T10:00:00Z",
            sha: "second-old-head",
          },
          // Second force-push
          {
            id: 4002,
            event: "head_ref_force_pushed",
            created_at: "2024-01-06T10:00:00Z",
            commit_id: "second-new-head",
          },
        ],
      }
    );

    // Mock compare API for first force-push
    await page.route(
      `https://api.github.com/repos/${config.owner}/${config.repo}/compare/first-new-head...first-old-head`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            commits: [
              {
                sha: "discarded-fp1",
                commit: {
                  message: "Discarded in first force push",
                  author: { name: "alice", date: "2024-01-01T08:00:00Z" },
                },
                author: { login: "alice" },
              },
            ],
          }),
        });
      }
    );

    // Mock compare API for second force-push (GC'd / 404)
    await page.route(
      `https://api.github.com/repos/${config.owner}/${config.repo}/compare/second-new-head...second-old-head`,
      async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Not Found" }),
        });
      }
    );

    await page.goto(config.pageUrl);

    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // First collapsed group: discoverable commits
    const collapsedTab1 = page.getByTestId("collapsed-group-4001");
    await expect(collapsedTab1).toBeVisible();
    await expect(collapsedTab1).toHaveAttribute(
      "title",
      "1 iteration discarded"
    );

    // Second collapsed group: GC'd (unknown count)
    const collapsedTab2 = page.getByTestId("collapsed-group-4002");
    await expect(collapsedTab2).toBeVisible();
    await expect(collapsedTab2).toHaveAttribute(
      "title",
      "Unknown iterations discarded"
    );

    // Live iteration tab should also be present
    // Revision numbering: 1 discarded + 1 live = tab for revision 2 (or higher)
    // The exact revision depends on chronological ordering
    const liveTabs = page.getByTestId(/^iteration-tab-/);
    const liveTabCount = await liveTabs.count();
    expect(liveTabCount).toBeGreaterThanOrEqual(1);
  });

  test("Force-push without preceding committed event produces unknown-count group", async ({
    page,
  }) => {
    // When there's no committed event before the force-push, the before SHA
    // cannot be inferred, resulting in an unknownCount collapsed group
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: [
          {
            sha: "post-fp-commit",
            message: "Commit after mysterious force push",
            author: "testuser",
            date: "2024-01-03T10:00:00Z",
          },
        ],
        timeline: [
          // Force-push with no preceding committed event
          {
            id: 5001,
            event: "head_ref_force_pushed",
            created_at: "2024-01-02T12:00:00Z",
            commit_id: "new-head-no-before",
          },
        ],
      }
    );

    await page.goto(config.pageUrl);

    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Should show unknown-count collapsed group
    const collapsedTab = page.getByTestId("collapsed-group-5001");
    await expect(collapsedTab).toBeVisible();
    await expect(collapsedTab).toHaveAttribute(
      "title",
      "Unknown iterations discarded"
    );

    // Click to see history view
    await collapsedTab.click();
    const historyView = page.getByTestId("collapsed-history-view");
    await expect(historyView).toBeVisible();
    await expect(historyView).toContainText(
      "Unknown iterations were discarded"
    );
  });
});
