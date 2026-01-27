import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthMock,
  setupFullPRMocks,
  defaultMockPR,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Redirect After Login", () => {
  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    // Clear storage before each test
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("should load PR page without authentication and redirect to PR after login", async ({
    page,
  }) => {
    // Mock data for the test
    const owner = isMockMode() ? "test" : prodModeConfig.testRepo.owner;
    const repo = isMockMode() ? "repo" : prodModeConfig.testRepo.repo;
    const prNumber = isMockMode() ? 123 : prodModeConfig.testRepo.prNumber;

    // Set up mocks before navigation
    await setupAuthMock(page);
    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: { ...defaultMockPR, number: prNumber },
      files: [
        {
          filename: "test.ts",
          status: "modified",
          additions: 1,
          deletions: 1,
          changes: 2,
          patch: "@@ -1 +1 @@\n-old\n+new",
        },
      ],
    });

    // Navigate directly to a PR page without being authenticated
    // PR pages now load without requiring authentication (S-4.1.2)
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // PR page should load without redirect
    await expect(page).toHaveURL(
      new RegExp(`/${owner}/${repo}/${String(prNumber)}`)
    );

    // PR content should be visible (indicates successful load)
    await expect(page.getByRole("treeitem", { name: /Pull Request Description/i })).toBeVisible();

    // Click login button to authenticate (should preserve returnPath)
    await page.getByRole("link", { name: /Log in/i }).click();

    // Should be on login page with returnPath
    await expect(page).toHaveURL(
      new RegExp(`/login\\?returnPath=.*${owner}.*${repo}.*${String(prNumber)}`)
    );

    // Login with PAT
    await page.getByText(/Use Personal Access Token/i).click();
    const input = page.getByLabel(/Personal Access Token/i);

    const token = isMockMode()
      ? "ghp_validtoken123456789"
      : process.env.CODJIFLO_E2E_GITHUB_TOKEN ?? "";

    await input.fill(token);
    await page.getByRole("button", { name: /Connect with PAT/i }).click();

    // Should be redirected back to the original PR page
    await expect(page).toHaveURL(
      new RegExp(`/${owner}/${repo}/${String(prNumber)}`)
    );

    // PR content should still be visible
    await expect(page.getByRole("treeitem", { name: /Pull Request Description/i })).toBeVisible();
  });

  test("should redirect to dashboard when accessing login directly and logging in", async ({
    page,
  }) => {
    // Set up auth mock
    await setupAuthMock(page);

    // Navigate directly to login (no returnPath)
    await page.goto("/login");

    // Login with PAT
    await page.getByText(/Use Personal Access Token/i).click();
    const input = page.getByLabel(/Personal Access Token/i);

    const token = isMockMode()
      ? "ghp_validtoken123456789"
      : process.env.CODJIFLO_E2E_GITHUB_TOKEN ?? "";

    await input.fill(token);
    await page.getByRole("button", { name: /Connect with PAT/i }).click();

    // Should redirect to dashboard (default when no returnPath)
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
