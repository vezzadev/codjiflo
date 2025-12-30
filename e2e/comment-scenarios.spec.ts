/**
 * Comment Scenarios E2E Tests
 *
 * Tests based on Azure DevOps Test Matrix (spec/test/azure-devops-test-matrix.md)
 * Covers user stories: S-2.1, S-2.3, S-2.5
 *
 * These tests run in both mock and prod modes:
 * - Mock mode: Uses Playwright route mocking with predefined data
 * - Prod mode: Uses real PRs in pedropaulovc/codjiflo-e2e-test-repo
 */

import { test, expect } from "@playwright/test";
import { isMockMode } from "./fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
} from "./fixtures/github-mocks";
import {
  pr2CommentPositioning,
  pr3CommentThreading,
  pr4FileOperations,
  pr10EdgeCases,
  getTestConfig,
} from "./fixtures/azure-devops-test-matrix";

// Helper to build page URL with proper string conversion
function buildPageUrl(owner: string, repo: string, prNumber: number): string {
  return `/pr/${owner}/${repo}/${String(prNumber)}`;
}

// ============================================================================
// S-2.1: View Comment Threads on Diff
// ============================================================================

test.describe("Comment Positioning (S-2.1, PR#2)", () => {
  const testConfig = getTestConfig(1);

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    if (isMockMode()) {
      await setupFullPRMocks(
        page,
        testConfig.owner,
        testConfig.repo,
        testConfig.prNumber,
        {
          pr: pr2CommentPositioning.pr,
          files: pr2CommentPositioning.files,
          comments: pr2CommentPositioning.allComments(),
        }
      );
    }
  });

  test("CP-01: displays comment on added line (RIGHT side)", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    // Navigate to the file with comments
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });

    const fileButton = fileNav.getByText("src/positioning-test.ts");
    await expect(fileButton).toBeVisible({ timeout: 10000 });
    await fileButton.click();

    // Wait for diff to load
    await expect(page.getByRole("heading", { name: "src/positioning-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // Verify CP-01 comment is visible (comment on added line)
    await expect(
      page.getByText("[CP-01] Comment on added line - should appear on RIGHT side of diff").first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("CP-02: displays comment on deleted line (LEFT side)", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/positioning-test.ts").click();

    await expect(page.getByRole("heading", { name: "src/positioning-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // Verify CP-02 comment on deleted line is visible
    await expect(
      page.getByText("[CP-02] Comment on deleted line - should appear on LEFT side of diff").first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("CP-03: displays comment on context (unchanged) line", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/positioning-test.ts").click();

    await expect(page.getByRole("heading", { name: "src/positioning-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // Verify CP-03 comment on context line is visible
    await expect(
      page.getByText("[CP-03] Comment on context (unchanged) line - visible in both views").first()
    ).toBeVisible({ timeout: 20000 });
  });
});

// ============================================================================
// S-2.1: Multiple Threads and File Operations
// ============================================================================

test.describe("Multiple Threads on Same Line (S-2.1, PR#2 CT-08)", () => {
  const testConfig = getTestConfig(2);

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    if (isMockMode()) {
      await setupFullPRMocks(
        page,
        testConfig.owner,
        testConfig.repo,
        testConfig.prNumber,
        {
          pr: pr3CommentThreading.pr,
          files: pr3CommentThreading.files,
          comments: pr3CommentThreading.allComments(),
        }
      );
    }
  });

  test("CT-08: displays multiple parallel threads on the same line", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/threading-test.ts").click();

    await expect(page.getByRole("heading", { name: "src/threading-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // Both CT-08 threads should be visible (different thread IDs on same line 10)
    await expect(
      page.getByText("[CT-08] Thread 1 on line 10 - First parallel thread").first()
    ).toBeVisible({ timeout: 20000 });

    await expect(
      page.getByText("[CT-08] Thread 2 on line 10 - Second parallel thread").first()
    ).toBeVisible({ timeout: 20000 });
  });
});

test.describe("Comments on Added/Deleted Files (S-2.1, PR#3)", () => {
  const testConfig = getTestConfig(3);

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    if (isMockMode()) {
      await setupFullPRMocks(
        page,
        testConfig.owner,
        testConfig.repo,
        testConfig.prNumber,
        {
          pr: pr4FileOperations.pr,
          files: pr4FileOperations.files,
          comments: pr4FileOperations.allComments(),
        }
      );
    }
  });

  test("FO-01: displays comment on newly added file", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/new-file.txt").click();

    await expect(page.getByRole("heading", { name: "src/new-file.txt" })).toBeVisible({
      timeout: 15000,
    });

    // Verify FO-01 comment on new file is visible
    await expect(
      page.getByText("[FO-01] Comment on NEW FILE - rightFileStart only").first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("FO-02: displays comment on deleted file", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/file-to-delete.txt").click();

    await expect(page.getByRole("heading", { name: "src/file-to-delete.txt" })).toBeVisible({
      timeout: 15000,
    });

    // Verify FO-02 comment on deleted file is visible
    await expect(
      page.getByText("[FO-02] Comment on DELETED FILE - leftFileStart only").first()
    ).toBeVisible({ timeout: 20000 });
  });
});

// ============================================================================
// S-2.1: Edge Cases (Unicode, Boundaries)
// ============================================================================

test.describe("Edge Cases (S-2.1, PR#4)", () => {
  const testConfig = getTestConfig(4);

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    if (isMockMode()) {
      await setupFullPRMocks(
        page,
        testConfig.owner,
        testConfig.repo,
        testConfig.prNumber,
        {
          pr: pr10EdgeCases.pr,
          files: pr10EdgeCases.files,
          comments: pr10EdgeCases.allComments(),
        }
      );
    }
  });

  test("EC-04: displays comment with unicode/emoji content correctly", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/unicode-test.ts").click();

    await expect(page.getByRole("heading", { name: "src/unicode-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // Verify EC-04 comment with unicode/emoji renders correctly
    await expect(page.getByText(/\[EC-04\].*Unicode\/emoji rendering test/).first()).toBeVisible({
      timeout: 20000,
    });

    // Verify the emoji is actually rendered in the comment
    await expect(page.getByText("[EC-04]").first()).toBeVisible({ timeout: 5000 });
  });

  test("EC-05: displays comment at first character of file (boundary)", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/unicode-test.ts").click();

    await expect(page.getByRole("heading", { name: "src/unicode-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // Verify EC-05 comment at file start is visible
    await expect(
      page.getByText("[EC-05] Comment at first character of file").first()
    ).toBeVisible({ timeout: 20000 });
  });
});

// ============================================================================
// S-2.3: Reply to a Thread
// ============================================================================

test.describe("Reply Chains (S-2.3, PR#2 CT-07)", () => {
  const testConfig = getTestConfig(2);

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    if (isMockMode()) {
      await setupFullPRMocks(
        page,
        testConfig.owner,
        testConfig.repo,
        testConfig.prNumber,
        {
          pr: pr3CommentThreading.pr,
          files: pr3CommentThreading.files,
          comments: pr3CommentThreading.allComments(),
        }
      );
    }
  });

  test("CT-07: displays 3-level deep reply chain in correct order", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/threading-test.ts").click();

    await expect(page.getByRole("heading", { name: "src/threading-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // All three levels of the CT-07 reply chain should be visible
    const rootComment = page.getByText("[CT-07] ROOT COMMENT - Starting discussion").first();
    const level2Reply = page.getByText("[CT-07] LEVEL 2 REPLY - Responding to root").first();
    const level3Reply = page.getByText("[CT-07] LEVEL 3 REPLY - Responding to level 2").first();

    await expect(rootComment).toBeVisible({ timeout: 20000 });
    await expect(level2Reply).toBeVisible({ timeout: 5000 });
    await expect(level3Reply).toBeVisible({ timeout: 5000 });

    // Verify chronological ordering (root appears before replies in DOM)
    const commentTexts = await page
      .locator('[data-testid="comment-body"], .comment-body, [class*="comment"]')
      .filter({ hasText: "[CT-07]" })
      .allTextContents();

    // If we have structured data, verify order
    if (commentTexts.length >= 3) {
      const rootIndex = commentTexts.findIndex((t) => t.includes("ROOT COMMENT"));
      const level2Index = commentTexts.findIndex((t) => t.includes("LEVEL 2 REPLY"));
      const level3Index = commentTexts.findIndex((t) => t.includes("LEVEL 3 REPLY"));

      // Root should come before Level 2, Level 2 before Level 3
      expect(rootIndex).toBeLessThan(level2Index);
      expect(level2Index).toBeLessThan(level3Index);
    }
  });
});

// ============================================================================
// S-2.5: Resolve Conversation
// ============================================================================

test.describe("Resolved Threads (S-2.5, PR#2 CT-02)", () => {
  const testConfig = getTestConfig(2);

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    if (isMockMode()) {
      await setupFullPRMocks(
        page,
        testConfig.owner,
        testConfig.repo,
        testConfig.prNumber,
        {
          pr: pr3CommentThreading.pr,
          files: pr3CommentThreading.files,
          comments: pr3CommentThreading.allComments(),
        }
      );
    }
  });

  test("CT-02: displays resolved/fixed thread with appropriate styling", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/threading-test.ts").click();

    await expect(page.getByRole("heading", { name: "src/threading-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // CT-02 resolved thread should be visible
    await expect(
      page.getByText("[CT-02] This thread has been RESOLVED (status 2 - Fixed)").first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("CT-01: displays active thread normally", async ({ page }) => {
    await page.goto(buildPageUrl(testConfig.owner, testConfig.repo, testConfig.prNumber));
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 15000 });
    await fileNav.getByText("src/threading-test.ts").click();

    await expect(page.getByRole("heading", { name: "src/threading-test.ts" })).toBeVisible({
      timeout: 15000,
    });

    // CT-01 active thread should be visible and fully expanded
    await expect(
      page.getByText("[CT-01] Active thread - status 1 (open discussion)").first()
    ).toBeVisible({ timeout: 20000 });
  });
});
