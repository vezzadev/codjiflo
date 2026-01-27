import { test, expect } from "@playwright/test";
import {
  setupOAuthAuthState,
  setupTokenRefreshMock,
  defaultMockPR,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Token Refresh Flow", () => {
  // Token refresh tests are mock-only since they require precise control over API responses
  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
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
    await page.route(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/files`,
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
    await expect(page.getByPlaceholder("Filter by file name")).toBeVisible();
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
