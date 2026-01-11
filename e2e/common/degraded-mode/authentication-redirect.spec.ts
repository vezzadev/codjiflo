import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthMock,
  setupFullPRMocks,
  defaultMockPR,
} from "../../fixtures/github-mocks";

test.describe("Redirect After Login", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("should redirect to original PR page after PAT login", async ({
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
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Should be redirected to login with returnPath
    await expect(page).toHaveURL(
      new RegExp(`/login\\?returnPath=.*${owner}.*${repo}.*${String(prNumber)}`)
    );

    // Login page should be visible
    await expect(
      page.getByRole("heading", { name: /Connect to GitHub/i })
    ).toBeVisible();

    // Expand PAT section and login
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

    // PR content should be visible (indicates successful load)
    // Check for the file explorer header which is always present on the PR page
    await expect(page.getByRole("listitem", { name: /Pull Request Description/i })).toBeVisible();
  });

  test("should preserve query params in redirect after login", async ({
    page,
  }) => {
    // This test is mock-only since it needs controlled query params

    const owner = "test";
    const repo = "repo";
    const prNumber = 123;

    // Set up mocks
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

    // Navigate to PR page with query params
    await page.goto(`/${owner}/${repo}/${String(prNumber)}?file=test.ts`);

    // Should be redirected to login with full returnPath including query params
    await expect(page).toHaveURL(/login\?returnPath=/);

    // Login with PAT
    await page.getByText(/Use Personal Access Token/i).click();
    const input = page.getByLabel(/Personal Access Token/i);
    await input.fill("ghp_validtoken123456789");
    await page.getByRole("button", { name: /Connect with PAT/i }).click();

    // Should be redirected back to the PR page with query params preserved
    await expect(page).toHaveURL(
      new RegExp(`/${owner}/${repo}/${String(prNumber)}.*file=test.ts`)
    );
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
