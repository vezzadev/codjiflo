import { test, expect } from "@playwright/test";
import { isMockMode } from "../../fixtures/mode";
import { setupAuthMock } from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("CodjiFlo App", () => {
  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByRole("heading", { name: /Connect to GitHub/i })).toBeVisible();
  });

  test("should show dashboard when authenticated", async ({ page }) => {
    // Set up auth mock (only applies in mock mode)
    await setupAuthMock(page);

    // Login first
    await page.goto("/login");

    // Expand PAT section
    await page.getByText(/Use Personal Access Token/i).click();

    const input = page.getByLabel(/Personal Access Token/i);
    const button = page.getByRole("button", { name: /Connect with PAT/i });

    // Use appropriate token based on mode
    const token = isMockMode()
      ? "ghp_validtoken123456789"
      : process.env.CODJIFLO_E2E_GITHUB_TOKEN ?? "";

    await input.fill(token);
    await button.click();

    // Should be on dashboard with PR URL input
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("heading", { name: /View Pull Request/i })).toBeVisible();
    await expect(page.getByLabel(/GitHub Pull Request URL/i)).toBeVisible();
  });
});
