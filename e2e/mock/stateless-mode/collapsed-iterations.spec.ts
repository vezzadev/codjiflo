import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupStatelessIterationMocks,
  type MockPR,
  type MockFile,
  type MockCommit,
  type MockTimelineEvent,
  type MockUser,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Collapsed Iteration Groups - Stateless Mode", () => {
  // Mock PR data for iteration tests
  const mockUser: MockUser = {
    id: 1,
    login: "testuser",
    avatar_url: "https://avatars.githubusercontent.com/u/1",
  };

  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR for Collapsed Iterations",
    body: "Testing collapsed iteration groups",
    state: "open",
    merged: false,
    draft: false,
    user: mockUser,
    head: { ref: "feature/test", sha: "live3sha" },
    base: { ref: "main", sha: "basesha" },
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

  // Mock commits: only the live commit (after force-push)
  const mockCommits: MockCommit[] = [
    {
      sha: "live3sha",
      message: "Final implementation",
      author: { login: "testuser", date: "2024-01-15T14:00:00Z" },
      parentSha: "basesha",
    },
  ];

  // Force-push event that discarded commits 1 and 2
  const forcePushEvents: MockTimelineEvent[] = [
    {
      event: "head_ref_force_pushed",
      before: "commit2sha",
      after: "live3sha",
      actor: mockUser,
      created_at: "2024-01-15T13:00:00Z",
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 123,
    pageUrl: "/test/repo/123?mode=stateless",
  };

  /**
   * Inject stateless iteration data into the store via browser script.
   * Uses the __CODJIFLO_ITERATION_STORE__ exposed in non-production mode.
   */
  async function injectStatelessData(
    page: import("@playwright/test").Page
  ): Promise<void> {
    await page.evaluate(() => {
      interface IterationStoreType {
        getState: () => {
          setStatelessIterations: (
            iterations: {
              revision: number;
              commitSha: string;
              baseSha: string;
              author: string;
              message: string;
              createdAt: Date;
              lineage: "current" | "discarded";
              collapsedGroupId?: string;
            }[],
            groups: {
              id: string;
              beforeSha: string;
              afterSha: string;
              iterations: {
                revision: number;
                commitSha: string;
                baseSha: string;
                author: string;
                message: string;
                createdAt: Date;
                lineage: "current" | "discarded";
                collapsedGroupId?: string;
              }[];
              visibility: "collapsed" | "expanded";
            }[]
          ) => void;
        };
      }

      const store = (
        window as unknown as { __CODJIFLO_ITERATION_STORE__?: IterationStoreType }
      ).__CODJIFLO_ITERATION_STORE__;

      if (!store) {
        throw new Error("Iteration store not found on window.__CODJIFLO_ITERATION_STORE__");
      }

      const discardedIterations = [
        {
          revision: 1,
          commitSha: "commit1sha",
          baseSha: "basesha",
          author: "testuser",
          message: "First commit",
          createdAt: new Date("2024-01-15T10:00:00Z"),
          lineage: "discarded" as const,
          collapsedGroupId: "group-0-live3sh",
        },
        {
          revision: 2,
          commitSha: "commit2sha",
          baseSha: "commit1sha",
          author: "testuser",
          message: "Second commit",
          createdAt: new Date("2024-01-15T11:00:00Z"),
          lineage: "discarded" as const,
          collapsedGroupId: "group-0-live3sh",
        },
      ];

      const liveIterations = [
        {
          revision: 3,
          commitSha: "live3sha",
          baseSha: "basesha",
          author: "testuser",
          message: "Final implementation",
          createdAt: new Date("2024-01-15T14:00:00Z"),
          lineage: "current" as const,
        },
      ];

      const iterations = [...discardedIterations, ...liveIterations];

      const collapsedGroups = [
        {
          id: "group-0-live3sh",
          beforeSha: "commit2sha",
          afterSha: "live3sha",
          iterations: discardedIterations,
          visibility: "collapsed" as const,
        },
      ];

      store.getState().setStatelessIterations(iterations, collapsedGroups);
    });
  }

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupStatelessIterationMocks(page, config.owner, config.repo, config.prNumber, {
      commits: mockCommits,
      forcePushEvents: forcePushEvents,
    });
  });

  test("Collapsed group renders when force-push history exists", async ({ page }) => {
    // Navigate and wait for page to load
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for the file list to be visible (page has loaded)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Wait for the iteration store to be available
    await page.waitForFunction(() => {
      return (window as unknown as { __CODJIFLO_ITERATION_STORE__?: unknown }).__CODJIFLO_ITERATION_STORE__ !== undefined;
    });

    // Inject stateless data with 2 discarded iterations and 1 live
    await injectStatelessData(page);

    // Verify collapsed group tab is visible
    const collapsedGroup = page.getByTestId("collapsed-group-group-0-live3sh");
    await expect(collapsedGroup).toBeVisible();

    // Verify count shows "2" for discarded iterations
    await expect(collapsedGroup.getByText("2")).toBeVisible();

    // Verify eraser icon is present (via aria-label)
    const eraserIcon = collapsedGroup.getByLabel("Discarded iterations");
    await expect(eraserIcon).toBeVisible();
  });

  test("Expanding collapsed group shows discarded iterations", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for the file list to be visible
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Wait for store and inject data
    await page.waitForFunction(() => {
      return (window as unknown as { __CODJIFLO_ITERATION_STORE__?: unknown }).__CODJIFLO_ITERATION_STORE__ !== undefined;
    });

    await injectStatelessData(page);

    // Click on collapsed group to expand
    const collapsedGroup = page.getByTestId("collapsed-group-group-0-live3sh");
    await collapsedGroup.click();

    // Verify discarded iteration tabs are now visible
    const discardedTab1 = page.getByTestId("discarded-iteration-tab-1");
    const discardedTab2 = page.getByTestId("discarded-iteration-tab-2");
    await expect(discardedTab1).toBeVisible();
    await expect(discardedTab2).toBeVisible();

    // Verify expanded state has chevron collapse button
    const collapseButton = page.getByRole("button", { name: /collapse/i });
    await expect(collapseButton).toBeVisible();

    // Verify discarded tabs have proper styling class
    await expect(discardedTab1).toHaveClass(/discarded-iteration-tab/);
    await expect(discardedTab2).toHaveClass(/discarded-iteration-tab/);
  });

  test("Collapsing expanded group hides discarded iterations", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for the file list
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Wait for store and inject data
    await page.waitForFunction(() => {
      return (window as unknown as { __CODJIFLO_ITERATION_STORE__?: unknown }).__CODJIFLO_ITERATION_STORE__ !== undefined;
    });

    await injectStatelessData(page);

    // Expand the collapsed group
    const collapsedGroup = page.getByTestId("collapsed-group-group-0-live3sh");
    await collapsedGroup.click();

    // Verify expanded
    const discardedTab1 = page.getByTestId("discarded-iteration-tab-1");
    await expect(discardedTab1).toBeVisible();

    // Click collapse button
    const collapseButton = page.getByRole("button", { name: /collapse/i });
    await collapseButton.click();

    // Verify collapsed state - discarded tabs should be hidden
    await expect(discardedTab1).toBeHidden();

    // Verify collapsed tab with count is visible again
    await expect(collapsedGroup.getByText("2")).toBeVisible();
  });

  test("Discarded iterations participate in range selection", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for the file list
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Wait for store and inject data
    await page.waitForFunction(() => {
      return (window as unknown as { __CODJIFLO_ITERATION_STORE__?: unknown }).__CODJIFLO_ITERATION_STORE__ !== undefined;
    });

    await injectStatelessData(page);

    // Expand the collapsed group first
    const collapsedGroup = page.getByTestId("collapsed-group-group-0-live3sh");
    await collapsedGroup.click();

    // Get the iteration tabs
    const discardedTab1 = page.getByTestId("discarded-iteration-tab-1");
    const liveTab3 = page.getByTestId("iteration-tab-3");

    // Verify tabs are visible before drag
    await expect(discardedTab1).toBeVisible();
    await expect(liveTab3).toBeVisible();

    // Perform drag selection from discarded iteration to live iteration
    // Use dragTo which handles the bounding box internally
    // Start drag on discarded tab - use hover then mouse.down
    await discardedTab1.hover();
    await page.mouse.down();

    // Move to live tab
    await liveTab3.hover();

    // Both should be highlighted in preview range during drag
    await expect(discardedTab1).toHaveClass(/in-range/);
    await expect(liveTab3).toHaveClass(/in-range/);

    // Also check discarded tab 2 is in range during drag
    const discardedTab2 = page.getByTestId("discarded-iteration-tab-2");
    await expect(discardedTab2).toHaveClass(/in-range/);

    // Release to complete selection
    await page.mouse.up();

    // Note: After mouse up, the selection state depends on currentPrKey being set
    // which is done by loadIterations. Since we're injecting data directly,
    // the range persistence is not fully wired. The key functionality tested here
    // is that discarded iterations participate in the drag selection preview.
  });
});
