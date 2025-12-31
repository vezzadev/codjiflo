import { test, expect } from "@playwright/test";
import { isMockMode } from "./fixtures/mode";

/**
 * Simple test for debugging purposes.
 * 
 * This test file is designed to be used with the debug command:
 * npm run test:e2e:debug
 * 
 * It performs a simple navigation and assertion that can be used
 * to verify the debugging functionality works correctly.
 */
test.describe("Debug Test", () => {
  test("should load the login page", async ({ page }) => {
    await page.goto("/");
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
    
    // Verify the login heading is visible
    await expect(page.getByRole("heading", { name: /Connect to GitHub/i })).toBeVisible();
    
    // In mock mode, verify PAT option is available
    if (isMockMode()) {
      await expect(page.getByText(/Use Personal Access Token/i)).toBeVisible();
    }
  });

  test("should have correct page title", async ({ page }) => {
    await page.goto("/");
    
    // Verify the page has a title
    await expect(page).toHaveTitle(/CodjiFlo/);
  });
});
