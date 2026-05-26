import { test, expect } from "@playwright/test";
import {
  setupAuthMock,
  setupFullPRMocks,
  defaultMockPR,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Authentication Query Params (Mock Only)", () => {
  test("should preserve query params when loading PR page and after login", async ({
    page,
  }) => {
    // This test is mock-only since it needs controlled query params
    const owner = "test";
    const repo = "repo";
    const prNumber = 123;

    // Set up mocks
    await setupLegacyDefaults(page);
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
    // PR pages now load without auth (S-4.1.2)
    await page.goto(`/${owner}/${repo}/${String(prNumber)}?file=test.ts`);

    // PR page should load directly with query params preserved
    await expect(page).toHaveURL(
      new RegExp(`/${owner}/${repo}/${String(prNumber)}.*file=test.ts`)
    );

    // PR content should be visible
    await expect(page.getByRole("row", { name: /Pull Request Description/i })).toBeVisible();

    // Click login to authenticate (preserving returnPath with query params)
    await page.getByRole("link", { name: /Log in/i }).click();

    // Login page should have returnPath with query params
    await expect(page).toHaveURL(/login\?returnPath=.*file.*test\.ts/);

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
});
