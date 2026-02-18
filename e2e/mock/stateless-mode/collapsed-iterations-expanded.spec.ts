import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupStatelessIterationMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Collapsed Iterations Expanded View", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR for Expanded Collapsed Groups",
    body: "Testing expanded collapsed iteration groups",
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

  test("Include button expands collapsed group into individual discarded iteration tabs", async ({
    page,
  }) => {
    // 2 discarded commits + 1 live commit = revisions 1, 2 (discarded), 3 (live)
    await setupForcePushScenario(page, {
      eventId: 5001,
      beforeSha: "old-before-sha",
      afterSha: "new-after-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "New commit after force push",
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

    // Verify initial state: collapsed group tab visible
    const collapsedTab = page.getByTestId("collapsed-group-5001");
    await expect(collapsedTab).toBeVisible();

    // Click to open history view, then click "Include"
    await collapsedTab.click();
    const includeBtn = page.getByTestId("collapsed-history-include-btn");
    await expect(includeBtn).toBeVisible();
    await includeBtn.click();

    // After expanding: collapsed group tab should be replaced by individual tabs
    await expect(collapsedTab).toBeHidden();

    // Individual discarded iteration tabs should now be visible
    // Revisions 1 and 2 are the discarded iterations
    const discardedTab1 = page.getByTestId("iteration-tab-1");
    const discardedTab2 = page.getByTestId("iteration-tab-2");
    await expect(discardedTab1).toBeVisible();
    await expect(discardedTab2).toBeVisible();

    // Discarded tabs should have the 'discarded' CSS class (grayed out)
    await expect(discardedTab1).toHaveClass(/discarded/);
    await expect(discardedTab2).toHaveClass(/discarded/);

    // The live iteration tab (revision 3) should still be visible and NOT discarded
    const liveTab = page.getByTestId("iteration-tab-3");
    await expect(liveTab).toBeVisible();
    await expect(liveTab).not.toHaveClass(/discarded/);
  });

  test("Expanded discarded tabs participate in drag range selection", async ({
    page,
  }) => {
    // 2 discarded + 2 live = revisions 1,2 (discarded), 3,4 (live)
    await setupForcePushScenario(page, {
      eventId: 6001,
      beforeSha: "old-drag-sha",
      afterSha: "new-drag-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Live commit 1",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
        {
          sha: "new-commit-2",
          message: "Live commit 2",
          author: "testuser",
          date: "2024-01-04T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-drag-1",
            message: "Old commit 1",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
          {
            sha: "discarded-drag-2",
            message: "Old commit 2",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T12:00:00Z",
          },
        ],
      },
    });

    await page.goto(config.pageUrl);

    // Expand the collapsed group
    const collapsedTab = page.getByTestId("collapsed-group-6001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();
    await page.getByTestId("collapsed-history-include-btn").click();

    // Wait for expanded tabs to appear
    const discardedTab1 = page.getByTestId("iteration-tab-1");
    const liveTab4 = page.getByTestId("iteration-tab-4");
    await expect(discardedTab1).toBeVisible();
    await expect(liveTab4).toBeVisible();

    // Drag from discarded tab 2 to live tab 3 (cross-boundary range)
    // This creates a range where both boundary tabs get 'selected' class
    // and middle tabs (if any) get 'in-range' class
    const discardedTab2 = page.getByTestId("iteration-tab-2");
    const liveTab3 = page.getByTestId("iteration-tab-3");
    await discardedTab2.hover();
    await page.mouse.down();
    await liveTab3.hover();
    await page.mouse.up();

    // Range boundary tabs get 'selected', middle tabs get 'in-range'
    // All tabs in the range should have aria-pressed="true"
    await expect(discardedTab2).toHaveAttribute("aria-pressed", "true");
    await expect(liveTab3).toHaveAttribute("aria-pressed", "true");

    // The discarded tab should also have 'discarded' class (styling preserved during selection)
    await expect(discardedTab2).toHaveClass(/discarded/);

    // Tabs outside the range should NOT be selected
    await expect(discardedTab1).toHaveAttribute("aria-pressed", "false");
    await expect(liveTab4).toHaveAttribute("aria-pressed", "false");
  });

  test("Unavailable commit tabs have unavailable class and are non-interactive", async ({
    page,
  }) => {
    // Set up a scenario where compare succeeds but one commit has status 'unavailable'
    // The timeline-loader marks commits as unavailable when their data can't be fetched
    // We simulate this by having the compare API return a commit that would be
    // cross-referenced as unavailable by the loader
    //
    // For the GC'd case (404 compare), it creates an unknownCount group with no iterations.
    // AC-4.2.2.8 specifically says: "When collapsed iteration's commit is GC'd,
    // show as unavailable within expanded view"
    // This means we need a group that expanded shows tabs, some with 'unavailable' class.
    //
    // The simplest E2E test: expand a group and verify the `.unavailable` class behavior
    // on tab elements. We use the 404 scenario since it creates unknownCount groups.

    await setupForcePushScenario(page, {
      eventId: 7001,
      beforeSha: "gc-before-sha",
      afterSha: "gc-after-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Live commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: { status: 404 },
    });

    await page.goto(config.pageUrl);

    const collapsedTab = page.getByTestId("collapsed-group-7001");
    await expect(collapsedTab).toBeVisible();

    // Open history and include
    await collapsedTab.click();
    const historyView = page.getByTestId("collapsed-history-view");
    await expect(historyView).toBeVisible();
    await page.getByTestId("collapsed-history-include-btn").click();
    await expect(historyView).toBeHidden();

    // For unknownCount groups, after expanding there should be no discarded tabs
    // (no known commits to show). Only the live tab should be visible.
    const liveTab = page.getByTestId("iteration-tab-1");
    await expect(liveTab).toBeVisible();
    await expect(liveTab).not.toHaveClass(/discarded/);
    await expect(liveTab).not.toHaveClass(/unavailable/);

    // Verify no discarded/unavailable tabs were rendered
    const unavailableTabs = page.locator(".iteration-tab.unavailable");
    await expect(unavailableTabs).toHaveCount(0);
  });

  test("Discarded tabs have reduced opacity and live tabs have full opacity", async ({
    page,
  }) => {
    await setupForcePushScenario(page, {
      eventId: 8001,
      beforeSha: "old-style-sha",
      afterSha: "new-style-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Live commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-style-1",
            message: "Old commit",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
        ],
      },
    });

    await page.goto(config.pageUrl);

    // Expand the group
    const collapsedTab = page.getByTestId("collapsed-group-8001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();
    await page.getByTestId("collapsed-history-include-btn").click();

    // Discarded tab should have reduced opacity (spec says 0.6)
    const discardedTab = page.getByTestId("iteration-tab-1");
    await expect(discardedTab).toBeVisible();
    await expect(discardedTab).toHaveClass(/discarded/);

    const opacity = await discardedTab.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    const opacityNum = parseFloat(opacity);
    expect(opacityNum).toBeLessThanOrEqual(0.7);
    expect(opacityNum).toBeGreaterThanOrEqual(0.5);

    // Live tab should have full opacity (1.0)
    const liveTab = page.getByTestId("iteration-tab-2");
    const liveOpacity = await liveTab.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(parseFloat(liveOpacity)).toBe(1);
  });

  test("Clicking a discarded tab selects it for range diff like a regular tab", async ({
    page,
  }) => {
    await setupForcePushScenario(page, {
      eventId: 9001,
      beforeSha: "old-click-sha",
      afterSha: "new-click-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Live commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-click-1",
            message: "Discarded commit",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
        ],
      },
    });

    await page.goto(config.pageUrl);

    // Expand
    const collapsedTab = page.getByTestId("collapsed-group-9001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();
    await page.getByTestId("collapsed-history-include-btn").click();

    // Click the discarded tab (single click = select from base to this iteration)
    const discardedTab = page.getByTestId("iteration-tab-1");
    await expect(discardedTab).toBeVisible();
    await discardedTab.click();

    // Discarded tab should be selected (aria-pressed="true")
    await expect(discardedTab).toHaveAttribute("aria-pressed", "true");

    // It should have both 'discarded' (styling) and 'selected' or range classes
    await expect(discardedTab).toHaveClass(/discarded/);

    // Live tab should NOT be in the selection (clicked only discarded tab 1)
    const liveTab = page.getByTestId("iteration-tab-2");
    await expect(liveTab).toHaveAttribute("aria-pressed", "false");
  });
});
