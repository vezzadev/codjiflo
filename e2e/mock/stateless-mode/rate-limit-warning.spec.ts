import { test, expect, Page } from "@playwright/test";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";
import {
  defaultMockPR,
  defaultMockUser,
} from "../../fixtures/github-mocks";

const owner = "test";
const repo = "repo";
const prNumber = 42;

/**
 * Set up GitHub API mocks that include rate limit headers in all responses.
 * The `getRemaining` callback allows dynamic remaining values across requests.
 */
async function setupMocksWithRateLimit(
  page: Page,
  getRemaining: () => number,
  limit = 60
): Promise<void> {
  const resetTimestamp = String(Math.floor(Date.now() / 1000) + 1800);

  const rateLimitHeaders = () => ({
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Limit",
    "x-ratelimit-remaining": String(getRemaining()),
    "x-ratelimit-reset": resetTimestamp,
    "x-ratelimit-limit": String(limit),
  });

  const pr = {
    ...defaultMockPR,
    number: prNumber,
    html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
  };

  // Catch-all for other API endpoints (artifact check, etc.)
  // Must be registered FIRST because Playwright matches routes LIFO
  await page.route("https://api.github.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: rateLimitHeaders(),
      body: JSON.stringify([]),
    });
  });

  // PR endpoint
  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: rateLimitHeaders(),
        body: JSON.stringify(pr),
      });
    }
  );

  // Files endpoint
  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/files**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: rateLimitHeaders(),
        body: JSON.stringify([
          {
            filename: "test.ts",
            status: "modified",
            additions: 1,
            deletions: 1,
            changes: 2,
            patch:
              "@@ -1,3 +1,3 @@\n line one\n-old line\n+new line\n line three",
          },
        ]),
      });
    }
  );

  // Comments endpoint
  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/comments`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: rateLimitHeaders(),
        body: JSON.stringify([]),
      });
    }
  );

  // Reviews endpoint
  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/reviews`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: rateLimitHeaders(),
        body: JSON.stringify([]),
      });
    }
  );

  // Issue comments endpoint
  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/issues/${String(prNumber)}/comments`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: rateLimitHeaders(),
        body: JSON.stringify([]),
      });
    }
  );

  // Timeline endpoint
  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/issues/${String(prNumber)}/timeline*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: rateLimitHeaders(),
        body: JSON.stringify([]),
      });
    }
  );

  // User endpoint
  await page.route("https://api.github.com/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: rateLimitHeaders(),
      body: JSON.stringify(defaultMockUser),
    });
  });
}

test.describe("Rate Limit Warning Banner (S-4.1.3)", () => {
  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
  });

  test("shows warning banner when rate limit is below 20% and allows dismiss [AC-4.1.3.5, AC-4.1.3.8, AC-4.1.3.10]", async ({
    page,
  }) => {
    await setupMocksWithRateLimit(page, () => 8);
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Wait for the PR page to load
    await expect(
      page.getByRole("heading", { name: /Test PR/i })
    ).toBeVisible();

    // Banner should appear with warning message
    const banner = page.getByRole("alert").filter({ hasText: "requests remaining" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Sign in");
    await expect(banner).toHaveAttribute("aria-live", "polite");

    // Dismiss the banner
    const dismissBtn = page.getByLabel("Dismiss rate limit warning");
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();
    await expect(banner).toBeHidden();
  });

  test("banner does not appear when rate limit is above 20% threshold [AC-4.1.3.5]", async ({
    page,
  }) => {
    // 50 remaining out of 60 = 83%, well above the 20% threshold
    await setupMocksWithRateLimit(page, () => 50);
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    await expect(
      page.getByRole("heading", { name: /Test PR/i })
    ).toBeVisible();

    const banner = page.getByRole("alert").filter({ hasText: "requests remaining" });
    await expect(banner).toBeHidden();
  });

  test("shows non-dismissible exhausted banner when remaining is 0 [AC-4.1.3.12]", async ({
    page,
  }) => {
    await setupMocksWithRateLimit(page, () => 0);
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // The first API request will return remaining=0, and then the pre-request
    // guard kicks in for subsequent requests. But the banner should still show.
    const banner = page.getByRole("alert").filter({ hasText: "GitHub rate limit exceeded" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Resets in/);
    await expect(banner).toHaveAttribute("aria-live", "assertive");

    // Should NOT have a dismiss button
    await expect(
      page.getByLabel("Dismiss rate limit warning")
    ).toBeHidden();
  });
});
