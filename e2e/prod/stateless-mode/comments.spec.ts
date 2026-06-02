import { test, expect } from "@playwright/test";
import { prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Inline comments flow (S-2.x)", () => {
  // Prod mode uses a known public PR
  const { owner, repo, prNumber } = prodModeConfig.testRepo;
  const config = {
    owner,
    repo,
    prNumber,
    pageUrl: `/${owner}/${repo}/${String(prNumber)}`,
  };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    // Set up authentication state (uses real token in real mode)
    await setupAuthState(page);

    // setupFullPRMocks is a no-op against the real API in prod mode
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber);
  });

  test("shows existing threads and allows adding a comment", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Wait for page to fully stabilize
    await page.waitForLoadState("load");

    // Real mode: just verify structure loads
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Click first file to show diff (PR description is default).
    // Leaf file tree items expose role=row with an aria-label of the form
    // "<basename>, <changetype>, N additions, N deletions"; folders and the
    // PR-description row lack that label, so this selects only leaf files.
    await fileNav.getByRole("row", { name: /additions, .* deletions/ }).first().click();

    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();
  });
});
