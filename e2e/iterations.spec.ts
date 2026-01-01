import { test, expect } from "@playwright/test";
import { isMockMode, isProdMode, prodModeConfig } from "./fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "./fixtures/github-mocks";

test.describe("Iteration Management (S-4 Milestone)", () => {
  // Mock PR data for iteration tests
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
    const { owner, repo, prNumber } = prodModeConfig.testRepo;
    return {
      owner,
      repo,
      prNumber,
      pageUrl: `/${owner}/${repo}/${String(prNumber)}`,
    };
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    const config = getTestConfig();
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Page loads with iteration components integrated", async ({ page }) => {
    const config = getTestConfig();

    await page.goto(config.pageUrl);
    await page.waitForLoadState("networkidle");

    // Verify basic page structure is intact
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Verify navigation exists
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });

  test("Degraded mode banner shows when no artifact is available", async ({ page }) => {
    // This test only runs in mock mode since we control the responses
    test.skip(!isMockMode(), "Only runs in mock mode");

    const config = getTestConfig();

    await page.goto(config.pageUrl);
    await page.waitForLoadState("networkidle");

    // Wait for the page to stabilize
    await page.waitForTimeout(1000);

    // Look for the degraded mode banner (rendered as a status element)
    const banner = page.getByRole("status");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/iteration tracking/i);
  });

  test("Iteration selector is hidden when no artifact is available", async ({ page }) => {
    // This test only runs in mock mode since we control the responses
    test.skip(!isMockMode(), "Only runs in mock mode");

    const config = getTestConfig();

    await page.goto(config.pageUrl);
    await page.waitForLoadState("networkidle");

    // Wait for the page to stabilize and iteration loading to complete
    await page.waitForTimeout(2000);

    // Iteration selector should NOT be visible when in degraded mode
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).not.toBeVisible();
  });
});

test.describe("Iteration Tabs UI (Prod Mode)", () => {
  // These tests require real iteration artifacts, so they only run in prod mode
  // Uses PR #75 which has CodjiFlo iteration artifacts installed
  const iterationTestPR = {
    owner: "pedropaulovc",
    repo: "codjiflo",
    prNumber: 75,
  };

  test.beforeEach(async ({ page }) => {
    test.skip(!isProdMode(), "Requires real iteration artifacts - prod mode only");
    await setupAuthState(page);
  });

  test("Iteration tabs display correct number of iterations", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("networkidle");

    // Wait for iterations to load (may take a while to download artifacts)
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Wait for at least one tab to appear
    const tabs = selector.locator(".iteration-tab");
    await expect(tabs.first()).toBeVisible();

    const tabCount = await tabs.count();

    // Should have at least 1 iteration tab
    expect(tabCount).toBeGreaterThanOrEqual(1);

    // Each tab should display a number
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const tabNumber = await tab.locator(".iteration-tab-number").textContent();
      expect(tabNumber).toBe(String(i + 1));
    }
  });

  test("Clicking a single tab selects that iteration", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("networkidle");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    if (tabCount >= 1) {
      // Click the first tab
      const firstTab = tabs.nth(0);
      await firstTab.click();

      // First tab should now have the 'selected' class
      await expect(firstTab).toHaveClass(/selected/);
    }
  });

  test("Last iteration is selected by default", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("networkidle");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    if (tabCount >= 1) {
      // The last tab should be selected by default
      const lastTab = tabs.nth(tabCount - 1);
      await expect(lastTab).toHaveClass(/selected/);
    }
  });

  test("Dragging across tabs selects a range", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("networkidle");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    // Need at least 2 tabs to test range selection
    if (tabCount >= 2) {
      const firstTab = tabs.nth(0);
      const secondTab = tabs.nth(1);

      // Get bounding boxes for drag operation
      const firstBox = await firstTab.boundingBox();
      const secondBox = await secondTab.boundingBox();

      if (firstBox && secondBox) {
        // Perform drag from first to second tab
        await page.mouse.move(
          firstBox.x + firstBox.width / 2,
          firstBox.y + firstBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          secondBox.x + secondBox.width / 2,
          secondBox.y + secondBox.height / 2
        );
        await page.mouse.up();

        // Both tabs should be selected (first as range-start, second as range-end)
        await expect(firstTab).toHaveClass(/selected/);
        await expect(secondTab).toHaveClass(/selected/);
      }
    }
  });

  test("Iteration tabs appear above filename in diff view", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("networkidle");

    // Click on a file to show the diff view (PR description is shown by default)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Click on the first actual file (not PR description)
    const fileItems = fileList.locator(".tree-item.file");
    const fileCount = await fileItems.count();
    if (fileCount > 0) {
      await fileItems.first().click();
      await page.waitForTimeout(500);
    }

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // The iteration selector should be inside diff-header-iterations
    const headerContainer = page.locator(".diff-header-iterations");
    await expect(headerContainer).toBeVisible();

    // Verify the iteration selector is inside the header container
    const selectorInHeader = headerContainer.getByTestId("iteration-selector");
    await expect(selectorInHeader).toBeVisible();
  });
});
