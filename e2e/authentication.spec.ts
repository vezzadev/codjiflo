import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "./fixtures/mode";
import {
  setupAuthMock,
  setupFullPRMocks,
  defaultMockPR,
  setupOAuthAuthState,
  setupTokenRefreshMock,
} from "./fixtures/github-mocks";

test.describe("Authentication Flow (S-1.1)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("Complete authentication journey - successful login and session persistence", async ({
    page,
  }) => {
    // [AC-1.1.1] User sees "Connect to GitHub" screen when not authenticated
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Connect to GitHub/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Sign in to start reviewing pull requests/i)
    ).toBeVisible();

    // OAuth button should be visible
    await expect(
      page.getByRole("button", { name: /Login with GitHub/i })
    ).toBeVisible();

    // Expand PAT section
    await page.getByText(/Use Personal Access Token/i).click();

    // [AC-1.1.2] Personal Access Token input field exists
    const input = page.getByLabel(/Personal Access Token/i);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "password");

    // Set up auth mock (only applies in mock mode)
    await setupAuthMock(page);

    // Use appropriate token based on mode
    const token = isMockMode()
      ? "ghp_validtoken123456789"
      : process.env.CODJIFLO_E2E_GITHUB_TOKEN ?? "";

    // Enter valid token and submit
    await input.fill(token);
    const button = page.getByRole("button", { name: /Connect with PAT/i });
    await button.click();

    // [AC-1.1.4] Should navigate to dashboard after successful auth
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /View Pull Request/i })
    ).toBeVisible();

    // [AC-1.1.5] Token persistence - reload should keep user authenticated
    await page.reload();
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /View Pull Request/i })
    ).toBeVisible();
  });

  test("Authentication error handling and accessibility", async ({ page }) => {
    await page.goto("/login");

    // Expand PAT section
    await page.getByText(/Use Personal Access Token/i).click();

    const input = page.getByLabel(/Personal Access Token/i);
    const button = page.getByRole("button", { name: /Connect with PAT/i });

    // [AC-1.1.3] Validate token format - invalid prefix (works in both modes)
    await input.fill("invalid_token");
    await button.click();

    // [AC-1.1.6] Show clear error message
    const formatError = page.getByText(/Invalid token format/i);
    await expect(formatError).toBeVisible();

    // [AC-1.1.9] Error announced via aria-live
    await expect(formatError).toHaveAttribute("role", "alert");
    await expect(formatError).toHaveAttribute("aria-live", "polite");

    // Clear error when user starts typing again
    await input.clear();
    await input.fill("ghp_");
    await expect(formatError).toBeHidden();

    // [AC-1.1.7] Network/API error handling
    if (isMockMode()) {
      // Mock mode: use route interception
      await setupAuthMock(page, { failWith: 401 });
    }

    // Use invalid token - in prod mode this hits GitHub and gets 401
    const invalidToken = isMockMode()
      ? "ghp_invalidtoken123456789"
      : prodModeConfig.invalidToken;

    await input.fill(invalidToken);
    await button.click();

    // Should show authentication failed error
    await expect(
      page.getByText(/Authentication failed. Please check your token./i)
    ).toBeVisible();

    // [AC-1.1.10] Input should remain accessible for correction
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
  });
});

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
    test.skip(!isMockMode(), "Query param test only runs in mock mode");

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

test.describe("Token Refresh Flow", () => {
  // Token refresh tests are mock-only since they require precise control over API responses
  test.beforeEach(async ({ page }) => {
    test.skip(!isMockMode(), "Token refresh tests only run in mock mode");
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("should refresh token and retry request on 401 for OAuth users", async ({
    page,
  }) => {
    const owner = "test";
    const repo = "repo";
    const prNumber = 123;
    let prApiCallCount = 0;
    let refreshWasCalled = false;

    // Set up OAuth auth state with valid token
    await setupOAuthAuthState(page, {
      token: "gho_expiredtoken",
      refreshToken: "ghr_validrefresh",
    });

    // Set up token refresh mock to succeed and track if it was called
    await page.route("**/api/auth/refresh", async (route) => {
      refreshWasCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "gho_freshtoken",
          expires_in: 28800,
        }),
      });
    });

    // Set up GitHub PR API to return 401 on first call, then succeed
    await page.route(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}`,
      async (route) => {
        prApiCallCount++;
        if (prApiCallCount === 1) {
          // First call: simulate expired token
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ message: "Bad credentials" }),
          });
        } else {
          // Retry after refresh: succeed
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...defaultMockPR,
              number: prNumber,
              html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
            }),
          });
        }
      }
    );

    // Set up files and comments mocks (these succeed normally)
    // Use regex to match URLs with pagination query params
    await page.route(
      new RegExp(`repos/${owner}/${repo}/pulls/${String(prNumber)}/files`),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              filename: "test.ts",
              status: "modified",
              additions: 1,
              deletions: 1,
              changes: 2,
              patch: "@@ -1 +1 @@\n-old\n+new",
            },
          ]),
        });
      }
    );

    await page.route(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/comments`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    );

    await page.route(
      `https://api.github.com/repos/${owner}/${repo}/issues/${String(prNumber)}/comments`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    );

    // Navigate to PR page
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Should successfully load after token refresh
    // The PR page should show file content (indicates API calls succeeded)
    await expect(page.getByText("Files")).toBeVisible();
    await expect(page.getByText("test.ts")).toBeVisible();

    // Verify the refresh endpoint was called and PR API was retried
    expect(refreshWasCalled).toBe(true);
    expect(prApiCallCount).toBeGreaterThanOrEqual(2);
  });

  test("should redirect to login when token refresh fails", async ({
    page,
  }) => {
    const owner = "test";
    const repo = "repo";
    const prNumber = 123;

    // Set up OAuth auth state
    await setupOAuthAuthState(page, {
      token: "gho_expiredtoken",
      refreshToken: "ghr_invalidrefresh",
    });

    // Set up token refresh mock to fail
    await setupTokenRefreshMock(page, { success: false });

    // Set up GitHub API to always return 401
    await page.route("https://api.github.com/**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Bad credentials" }),
      });
    });

    // Navigate to PR page
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Should be redirected to login after refresh fails
    await expect(page).toHaveURL(/\/login/);

    // Login page should be visible
    await expect(
      page.getByRole("heading", { name: /Connect to GitHub/i })
    ).toBeVisible();
  });

  test("should preserve return path when redirecting to login after refresh failure", async ({
    page,
  }) => {
    const owner = "test";
    const repo = "repo";
    const prNumber = 456;

    // Set up OAuth auth state
    await setupOAuthAuthState(page, {
      token: "gho_expiredtoken",
      refreshToken: "ghr_invalidrefresh",
    });

    // Set up token refresh mock to fail
    await setupTokenRefreshMock(page, { success: false });

    // Set up GitHub API to always return 401
    await page.route("https://api.github.com/**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Bad credentials" }),
      });
    });

    // Navigate to specific PR page
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Should be redirected to login with returnPath
    await expect(page).toHaveURL(
      new RegExp(`/login\\?returnPath=.*${owner}.*${repo}.*${String(prNumber)}`)
    );
  });
});
