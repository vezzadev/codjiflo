import { test, expect } from "@playwright/test";
import {
  setupAuthMock,
  setupFullPRMocks,
  defaultMockPR,
} from "../../fixtures/github-mocks";

test.describe("Authentication Query Params (Mock Only)", () => {
  test("should preserve query params in redirect after login", async ({
    page,
  }) => {
    // This test is mock-only since it needs controlled query params
    const owner = "test";
    const repo = "repo";
    const prNumber = 123;

    // Set up mocks
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
    await page.goto(`/${owner}/${repo}/${String(prNumber)}?file=test.ts`);

    // Should be redirected to login with full returnPath including query params
    await expect(page).toHaveURL(/login\?returnPath=/);

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
