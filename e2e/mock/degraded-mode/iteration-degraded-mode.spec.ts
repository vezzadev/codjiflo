import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Iteration Management - Degraded Mode", () => {
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

  test("Page loads with iteration components integrated", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Verify basic page structure is intact
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Verify navigation exists
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });

  test("Degraded mode banner shows when no artifact is available", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for the page to stabilize by waiting for the specific degraded mode banner
    // Look for the degraded mode banner (rendered as a status element with iteration tracking text)
    const banner = page.getByRole("status").filter({ hasText: /iteration tracking/i });
    await expect(banner).toBeVisible();
  });

  test("Iteration selector is hidden when no artifact is available", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for the page to stabilize and iteration loading to complete
    // by waiting for the file list to be visible (which appears after loading)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Iteration selector should NOT be visible when in degraded mode
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeHidden();
  });

  test("Console warning is emitted when using GitHub API as fallback (Issue #186)", async ({ page }) => {
    // This test validates that when no iteration artifact is available,
    // a console warning is emitted to help with debugging and telemetry.

    // Set up promise BEFORE navigation to avoid race condition
    // waitForEvent creates the listener immediately, ensuring we don't miss the warning
    const warningPromise = page.waitForEvent("console", {
      predicate: (msg) =>
        msg.type() === "warning" &&
        msg.text().includes("[CodjiFlo] Using GitHub API as fallback"),
    });

    await page.goto(config.pageUrl);

    // Wait for the specific warning to be emitted
    const warningMsg = await warningPromise;
    const degradedWarning = warningMsg.text();

    // Verify the warning includes the reason
    expect(degradedWarning).toContain("Reason:");
    expect(degradedWarning).toContain("CodjiFlo artifact");
  });
});
