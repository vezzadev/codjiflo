import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthMock,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Authentication Flow (S-1.1)", () => {
  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    // Clear storage before each test
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("Complete authentication journey - successful login and session persistence", async ({
    page,
  }) => {
    // [AC-1.1.1] User sees "Connect to GitHub" screen when navigating to login
    await page.goto("/login");
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
      : process.env.GITHUB_TOKEN ?? "";

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
