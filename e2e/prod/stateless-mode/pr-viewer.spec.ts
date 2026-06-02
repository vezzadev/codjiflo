import { test, expect } from "@playwright/test";
import { prodModeConfig } from "../../fixtures/mode";
import { setupAuthState } from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("PR Viewer Flow - prod mode (S-1.2, S-1.3, S-1.4)", () => {
  const { owner, repo, prNumber } = prodModeConfig.testRepo;
  const prUrl = `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`;
  const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    // Uses the real GitHub token in prod mode.
    await setupAuthState(page);
  });

  test("Complete PR viewing journey", async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /View Pull Request/i })).toBeVisible();

    // Enter PR URL
    const input = page.getByLabel(/GitHub Pull Request URL/i);
    await input.fill(prUrl);

    // Submit form
    await page.getByRole("button", { name: /Load Pull Request/i }).click();

    // [S-1.2] Verify navigation to the PR page
    await expect(page).toHaveURL(new RegExp(`.*${escapeRegExp(pageUrl)}`));

    // Verify structure exists (content will vary)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /View on GitHub/i })).toBeVisible();
  });

  test("PR Description is shown as first entry in file list", async ({ page }) => {
    await page.goto(pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // PR Description should be the first entry in the file list
    const prDescButton = fileNav.getByRole("row", { name: /Pull Request Description/i });
    await expect(prDescButton).toBeVisible();

    // PR Description should be selected by default
    await expect(prDescButton).toHaveAttribute("aria-selected", "true");

    // Verify PR title heading exists
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("Clicking file switches from PR Description to diff view", async ({ page }) => {
    await page.goto(pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Verify PR Description is selected initially
    const prDescButton = fileNav.getByRole("row", { name: /Pull Request Description/i });
    await expect(prDescButton).toHaveAttribute("aria-selected", "true");

    // Click the first actual file (the prod fixture PR always has >=1 changed file).
    const firstFile = fileNav.getByTestId("file-tree-item").first();
    await expect(firstFile).toBeVisible();
    await firstFile.click();

    // PR Description should no longer be selected
    await expect(prDescButton).not.toHaveAttribute("aria-selected", "true");
  });

  test("File list displays correctly", async ({ page }) => {
    await page.goto(pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    // Verify file nav structure exists
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
  });

  test("Diff view renders correctly", async ({ page }) => {
    await page.goto(pageUrl);

    // Wait for page to load
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Click the first actual file (the prod fixture PR always has >=1 changed file).
    const firstFile = fileNav.getByTestId("file-tree-item").first();
    await expect(firstFile).toBeVisible();
    await firstFile.click();

    // [S-1.4] Diff region should be visible
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();
  });
});
