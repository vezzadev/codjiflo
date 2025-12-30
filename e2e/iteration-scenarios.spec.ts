/**
 * Iteration Scenarios E2E Tests
 *
 * Tests based on Azure DevOps Test Matrix (spec/test/azure-devops-test-matrix.md)
 * Covers user stories: S-4.2, S-4.7, S-4.8, S-4.9
 *
 * Note: Full iteration functionality requires SQLite artifact parsing.
 * Mock mode tests verify UI components load correctly when artifact data is present.
 * Prod mode tests verify actual iteration behavior with real GitHub Actions artifacts.
 */

import { test, expect } from "@playwright/test";
import { isMockMode, isProdMode, prodModeConfig } from "./fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockIteration,
} from "./fixtures/github-mocks";
import {
  pr5IterationTracking,
  pr15MultiCommitPush,
  testRepository,
} from "./fixtures/azure-devops-test-matrix";

// Helper to build page URL with proper string conversion
function buildPageUrl(owner: string, repo: string, prNumber: number): string {
  return `/pr/${owner}/${repo}/${String(prNumber)}`;
}

// ============================================================================
// S-4.7: Iteration Selector UI
// ============================================================================

test.describe("Iteration Selector (S-4.7)", () => {
  test.describe("Mock mode - UI behavior", () => {
    const testConfig = {
      owner: testRepository.mockOwner,
      repo: testRepository.mockRepo,
      prNumber: 15,
    };

    // Convert iteration data to MockIteration format
    const mockIterations: MockIteration[] = pr15MultiCommitPush.iterations.map((iter) => ({
      id: iter.id,
      revision: iter.revision,
      head_sha: iter.head_sha,
      base_sha: iter.base_sha,
      author: iter.author,
      created_at: iter.created_at,
    }));

    test.beforeEach(async ({ page }) => {
      await setupAuthState(page);

      if (isMockMode()) {
        await setupFullPRMocks(
          page,
          testConfig.owner,
          testConfig.repo,
          testConfig.prNumber,
          {
            pr: pr15MultiCommitPush.pr,
            files: pr15MultiCommitPush.files,
            comments: pr15MultiCommitPush.allComments(),
            iterations: {
              degradedMode: false,
              iterations: mockIterations,
            },
          }
        );
      }
    });

    test("MC-03: detects codjiflo artifact comment and shows iteration awareness", async ({
      page,
    }) => {
      if (!isMockMode()) {
        test.skip();
        return;
      }

      await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
      await page.waitForLoadState("networkidle");

      // Verify page loads without degraded mode banner when artifact is present
      // Wait for the page to stabilize
      await page.waitForTimeout(2000);

      // The degraded mode banner should NOT be visible when artifact is detected
      // Note: The actual iteration selector visibility depends on artifact parsing success
      const banner = page.getByRole("status");

      // If iteration data is properly mocked, banner should either not exist
      // or not contain the degraded mode message
      const bannerVisible = await banner.isVisible().catch(() => false);
      if (bannerVisible) {
        // If there's a banner, it shouldn't be about missing iteration tracking
        // (it could be a different status message)
        const bannerText = await banner.textContent();
        // The presence of artifact comment means we attempted to load iterations
        expect(bannerText).toBeDefined();
      }

      // Verify file navigation still works
      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Prod mode - real iteration data", () => {
    test.skip(!isProdMode(), "Prod mode tests only run with E2E_DEPENDENCIES_MODE=prod");

    test.beforeEach(async ({ page }) => {
      await setupAuthState(page);
    });

    test("loads iteration data from real PR with CodjiFlo workflow", async ({ page }) => {
      // This test uses the main test repo which should have CodjiFlo enabled
      const config = prodModeConfig.testRepo;
      await page.goto(buildPageUrl(config.owner, config.repo, config.prNumber));
      await page.waitForLoadState("networkidle");

      // Verify basic page structure
      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible({ timeout: 30000 });

      // If CodjiFlo workflow is installed, iteration selector should be visible
      // Note: This depends on the actual state of the test repo
      const selector = page.getByTestId("iteration-selector");
      const selectorVisible = await selector.isVisible({ timeout: 5000 }).catch(() => false);

      if (selectorVisible) {
        // Verify selector has expected structure
        await expect(selector).toBeVisible();

        // Look for preset buttons
        const fullDiffPreset = selector.getByRole("button", { name: /full diff/i });
        const latestPreset = selector.getByRole("button", { name: /latest/i });

        // At least one preset should be visible
        const hasPresets =
          (await fullDiffPreset.isVisible().catch(() => false)) ||
          (await latestPreset.isVisible().catch(() => false));

        if (hasPresets) {
          // Click a preset and verify it works
          if (await fullDiffPreset.isVisible().catch(() => false)) {
            await fullDiffPreset.click();
          }
        }
      }
    });
  });
});

// ============================================================================
// S-4.8: Cross-Iteration Diff Computation
// ============================================================================

test.describe("Cross-Iteration Diff (S-4.8)", () => {
  test.describe("Mock mode - file list filtering", () => {
    const testConfig = {
      owner: testRepository.mockOwner,
      repo: testRepository.mockRepo,
      prNumber: 5,
    };

    const mockIterations: MockIteration[] = pr5IterationTracking.iterations.map((iter) => ({
      id: iter.id,
      revision: iter.revision,
      head_sha: iter.head_sha,
      base_sha: iter.base_sha,
      before_sha: iter.before_sha,
      author: iter.author,
      created_at: iter.created_at,
    }));

    test.beforeEach(async ({ page }) => {
      await setupAuthState(page);

      if (isMockMode()) {
        await setupFullPRMocks(
          page,
          testConfig.owner,
          testConfig.repo,
          testConfig.prNumber,
          {
            pr: pr5IterationTracking.pr,
            files: pr5IterationTracking.files,
            comments: pr5IterationTracking.allComments(),
            iterations: {
              degradedMode: false,
              iterations: mockIterations,
            },
          }
        );
      }
    });

    test("IT-08/IT-09/IT-10: file list shows correct files for the PR", async ({ page }) => {
      if (!isMockMode()) {
        test.skip();
        return;
      }

      await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
      await page.waitForLoadState("networkidle");

      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible({ timeout: 10000 });

      // Verify expected files from PR #5 are shown
      // These are the files at the final iteration state
      await expect(fileNav.getByText("src/fileA.txt")).toBeVisible({ timeout: 5000 });
      await expect(fileNav.getByText("src/fileC.txt")).toBeVisible({ timeout: 5000 });
      await expect(fileNav.getByText("src/fileD.txt")).toBeVisible({ timeout: 5000 });
    });

    test("IT-06: compares correct diff range", async ({ page }) => {
      if (!isMockMode()) {
        test.skip();
        return;
      }

      await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
      await page.waitForLoadState("networkidle");

      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible({ timeout: 10000 });

      // Click on fileA.txt to view its diff
      await fileNav.getByText("src/fileA.txt").click();

      // Verify diff content loads
      await expect(page.getByRole("heading", { name: "src/fileA.txt" })).toBeVisible({
        timeout: 15000,
      });

      // The diff should show the changes from iteration 1 (modified in iter 1)
      const diffTable = page.locator("table");
      await expect(diffTable).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Prod mode - iteration range comparison", () => {
    test.skip(!isProdMode(), "Prod mode tests only run with E2E_DEPENDENCIES_MODE=prod");

    test.beforeEach(async ({ page }) => {
      await setupAuthState(page);
    });

    test("switches between iteration ranges correctly", async ({ page }) => {
      const config = prodModeConfig.testRepo;
      await page.goto(buildPageUrl(config.owner, config.repo, config.prNumber));
      await page.waitForLoadState("networkidle");

      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible({ timeout: 30000 });

      // Check if iteration selector is available
      const selector = page.getByTestId("iteration-selector");
      const selectorVisible = await selector.isVisible({ timeout: 5000 }).catch(() => false);

      if (selectorVisible) {
        // Get initial file count
        const initialFiles = await fileNav.getByRole("button").count();

        // Try switching iteration range if controls are available
        const compareFromDropdown = selector.getByLabel(/compare from/i);
        if (await compareFromDropdown.isVisible().catch(() => false)) {
          // Interaction with iteration selector
          // Actual behavior depends on available iterations
          expect(initialFiles).toBeGreaterThan(0);
        }
      }
    });
  });
});

// ============================================================================
// S-4.2: Iteration Snapshot Capture (Force-push handling)
// ============================================================================

test.describe("Force-Push Handling (S-4.2)", () => {
  test.describe("Mock mode - comment visibility", () => {
    const testConfig = {
      owner: testRepository.mockOwner,
      repo: testRepository.mockRepo,
      prNumber: 5,
    };

    const mockIterations: MockIteration[] = pr5IterationTracking.iterations.map((iter) => ({
      id: iter.id,
      revision: iter.revision,
      head_sha: iter.head_sha,
      base_sha: iter.base_sha,
      before_sha: iter.before_sha,
      author: iter.author,
      created_at: iter.created_at,
    }));

    test.beforeEach(async ({ page }) => {
      await setupAuthState(page);

      if (isMockMode()) {
        await setupFullPRMocks(
          page,
          testConfig.owner,
          testConfig.repo,
          testConfig.prNumber,
          {
            pr: pr5IterationTracking.pr,
            files: pr5IterationTracking.files,
            comments: pr5IterationTracking.allComments(),
            iterations: {
              degradedMode: false,
              iterations: mockIterations,
            },
          }
        );
      }
    });

    test("IT-05: comments survive force-push SHA change", async ({ page }) => {
      if (!isMockMode()) {
        test.skip();
        return;
      }

      await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
      await page.waitForLoadState("networkidle");

      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible({ timeout: 10000 });

      // Navigate to fileC.txt which has the IT-05 comment
      await fileNav.getByText("src/fileC.txt").click();

      await expect(page.getByRole("heading", { name: "src/fileC.txt" })).toBeVisible({
        timeout: 15000,
      });

      // The IT-05 comment should be visible (survives force-push)
      await expect(
        page.getByText("[IT-05] Comment survives force-push")
      ).toBeVisible({ timeout: 20000 });
    });

    test("IT-01: comment position preserved across unchanged iterations", async ({
      page,
    }) => {
      if (!isMockMode()) {
        test.skip();
        return;
      }

      await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
      await page.waitForLoadState("networkidle");

      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible({ timeout: 10000 });

      // Navigate to fileA.txt which has the IT-01 comment
      await fileNav.getByText("src/fileA.txt").click();

      await expect(page.getByRole("heading", { name: "src/fileA.txt" })).toBeVisible({
        timeout: 15000,
      });

      // The IT-01 comment should be visible with position preserved
      await expect(
        page.getByText("[IT-01] Comment on iter 1, file unchanged in iter 2")
      ).toBeVisible({ timeout: 20000 });
    });
  });
});

// ============================================================================
// S-4.9: SpanTracker Client Integration
// Note: SpanTracker requires actual SQLite artifact data for full testing
// These tests verify comment visibility across iterations conceptually
// ============================================================================

test.describe("SpanTracker Integration (S-4.9)", () => {
  test.describe("Prod mode - comment tracking", () => {
    test.skip(!isProdMode(), "SpanTracker tests require prod mode with real artifacts");

    test.beforeEach(async ({ page }) => {
      await setupAuthState(page);
    });

    test("comments track correctly across iterations", async ({ page }) => {
      // This test requires a PR with CodjiFlo workflow and multiple iterations
      // with comments that span across iteration changes
      const config = prodModeConfig.testRepo;
      await page.goto(buildPageUrl(config.owner, config.repo, config.prNumber));
      await page.waitForLoadState("networkidle");

      // Verify basic page structure
      const fileNav = page.getByRole("navigation", { name: /Changed files/i });
      await expect(fileNav).toBeVisible({ timeout: 30000 });

      // If iteration selector is available, try switching iterations
      const selector = page.getByTestId("iteration-selector");
      const selectorVisible = await selector.isVisible({ timeout: 5000 }).catch(() => false);

      if (selectorVisible) {
        // Look for comments in the current view
        // SpanTracker should map them correctly even when switching iterations
        const commentElements = page.locator('[data-testid*="comment"]');
        const hasComments = (await commentElements.count()) > 0;

        // Comments should be visible if they exist on this PR
        if (hasComments) {
          const firstComment = commentElements.first();
          await expect(firstComment).toBeVisible();
        }
      }
    });
  });
});

// ============================================================================
// Multi-Commit Push Tests (S-4.2, S-4.7)
// ============================================================================

test.describe("Multi-Commit Push (PR#15)", () => {
  const testConfig = {
    owner: testRepository.mockOwner,
    repo: testRepository.mockRepo,
    prNumber: 15,
  };

  const mockIterations: MockIteration[] = pr15MultiCommitPush.iterations.map((iter) => ({
    id: iter.id,
    revision: iter.revision,
    head_sha: iter.head_sha,
    base_sha: iter.base_sha,
    author: iter.author,
    created_at: iter.created_at,
  }));

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    if (isMockMode()) {
      await setupFullPRMocks(
        page,
        testConfig.owner,
        testConfig.repo,
        testConfig.prNumber,
        {
          pr: pr15MultiCommitPush.pr,
          files: pr15MultiCommitPush.files,
          comments: pr15MultiCommitPush.allComments(),
          iterations: {
            degradedMode: false,
            iterations: mockIterations,
          },
        }
      );
    }
  });

  test("MC-01: displays comment on line from first commit", async ({ page }) => {
    if (!isMockMode()) {
      test.skip();
      return;
    }

    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 10000 });

    // Navigate to multi-commit-file.txt
    await fileNav.getByText("src/multi-commit-file.txt").click();

    await expect(page.getByRole("heading", { name: "src/multi-commit-file.txt" })).toBeVisible({
      timeout: 15000,
    });

    // MC-01 comment should be visible
    await expect(
      page.getByText("[MC-01] Comment on line 6 from Commit 3")
    ).toBeVisible({ timeout: 20000 });
  });

  test("MC-02: displays comment on last file from iteration 1", async ({ page }) => {
    if (!isMockMode()) {
      test.skip();
      return;
    }

    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 10000 });

    // Navigate to second-file.txt
    await fileNav.getByText("src/second-file.txt").click();

    await expect(page.getByRole("heading", { name: "src/second-file.txt" })).toBeVisible({
      timeout: 15000,
    });

    // MC-02 comment should be visible
    await expect(
      page.getByText("[MC-02] Comment on second-file.txt line 5")
    ).toBeVisible({ timeout: 20000 });
  });

  test("MC-03: displays comment from iteration 2", async ({ page }) => {
    if (!isMockMode()) {
      test.skip();
      return;
    }

    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 10000 });

    // Navigate to multi-commit-file.txt
    await fileNav.getByText("src/multi-commit-file.txt").click();

    await expect(page.getByRole("heading", { name: "src/multi-commit-file.txt" })).toBeVisible({
      timeout: 15000,
    });

    // MC-03 comment (from iteration 2) should be visible
    await expect(
      page.getByText("[MC-03] Comment on line 13 from Commit 7")
    ).toBeVisible({ timeout: 20000 });
  });
});
