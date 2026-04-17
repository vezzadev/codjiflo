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
      `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/files**`,
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

  test("should clear auth and show login button when token refresh fails", async ({
    page,
  }) => {
    const owner = "test";
    const repo = "repo";
    const prNumber = 123;
    let firstRequest = true;

    // Set up OAuth auth state
    await setupOAuthAuthState(page, {
      token: "gho_expiredtoken",
      refreshToken: "ghr_invalidrefresh",
    });

    // Set up token refresh mock to fail
    await setupTokenRefreshMock(page, { success: false });

    // Set up GitHub API to return 401 for authenticated requests, 200 for unauthenticated
    await page.route(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}`,
      async (route) => {
        const auth = route.request().headers().authorization;
        if (auth && firstRequest) {
          // First authenticated request fails with 401
          firstRequest = false;
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ message: "Bad credentials" }),
          });
        } else {
          // Unauthenticated request succeeds (public repo)
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              number: prNumber,
              title: "Test PR",
              state: "open",
              html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
              user: { login: "testuser", avatar_url: "https://example.com/avatar.png" },
              base: { ref: "main", sha: "abc123" },
              head: { ref: "feature", sha: "def456" },
            }),
          });
        }
      }
    );

    // Set up other mocks
    await page.route(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/files**`,
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

    // After token refresh failure, error page is shown with login prompt (S-4.1.4)
    await expect(page).toHaveURL(new RegExp(`/${owner}/${repo}/${String(prNumber)}`));

    // Error page should be visible with login option
    const errorContainer = page.getByTestId("pr-error");
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer.getByRole("heading", { level: 1 })).toBeVisible();

    // Login link should be visible (user is now unauthenticated after refresh failure)
    await expect(errorContainer.getByRole("link", { name: /log in/i })).toBeVisible();
  });
});
