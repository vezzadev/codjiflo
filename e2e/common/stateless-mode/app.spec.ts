import { test, expect } from "@playwright/test";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("CodjiFlo App", () => {
  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
  });

  test("should show dashboard for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("heading", { name: /View Pull Request/i })).toBeVisible();
    // Login button should be visible for unauthenticated users
    await expect(page.getByRole("button", { name: /Log in with GitHub/i })).toBeVisible();
  });
});
