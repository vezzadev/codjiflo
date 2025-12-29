import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "./fixtures/mode";
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
        pageUrl: "/pr/test/repo/123",
      };
    }
    const { owner, repo, prNumber } = prodModeConfig.testRepo;
    return {
      owner,
      repo,
      prNumber,
      pageUrl: `/pr/${owner}/${repo}/${String(prNumber)}`,
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
    await expect(fileNav).toBeVisible({ timeout: 30000 });

    // Verify sidebar exists (aside element where IterationSelector is placed)
    const aside = page.locator("aside");
    await expect(aside).toBeVisible();
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
    await expect(banner).toBeVisible({ timeout: 15000 });
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
