import { test, expect } from "@playwright/test";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("CodjiFlo App - authenticated (prod)", () => {
  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
  });

  test("should show dashboard when authenticated", async ({ page }) => {
    // Login first
    await page.goto("/login");

    // Expand PAT section
    await page.getByText(/Use Personal Access Token/i).click();

    const input = page.getByLabel(/Personal Access Token/i);
    const button = page.getByRole("button", { name: /Connect with PAT/i });

    const token = process.env.GITHUB_TOKEN ?? "";

    await input.fill(token);
    await button.click();

    // Should be on dashboard with PR URL input
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("heading", { name: /View Pull Request/i })).toBeVisible();
    await expect(page.getByLabel(/GitHub Pull Request URL/i)).toBeVisible();
  });
});
