import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
  type MockComment,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("SpanTracker and Comments in Stateless Mode", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 789;

  // Base content with 10 lines
  const baseContent = `const line1 = 'first';
const line2 = 'second';
const line3 = 'third';
const line4 = 'fourth';
const line5 = 'fifth';
const line6 = 'sixth';
const line7 = 'seventh';
const line8 = 'eighth';
const line9 = 'ninth';
const line10 = 'tenth';`;

  // Head content with changes - line 5 modified, line 7 removed, new line added
  const headContent = `const line1 = 'first';
const line2 = 'second';
const line3 = 'third';
const line4 = 'fourth';
const line5 = 'modified fifth';
const line6 = 'sixth';
const line8 = 'eighth';
const line9 = 'ninth';
const line10 = 'tenth';
const newLine = 'added';`;

  const mockPR: MockPR = {
    id: 1,
    number: prNumber,
    title: "Test: SpanTracker comment positioning",
    body: "PR to verify comment positioning in stateless mode",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/span-tracker", sha: "headsha123" },
    base: { ref: "main", sha: "basesha456" },
    html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/example.ts",
      status: "modified",
      additions: 2,
      deletions: 2,
      changes: 4,
      patch: `@@ -1,10 +1,10 @@
 const line1 = 'first';
 const line2 = 'second';
 const line3 = 'third';
 const line4 = 'fourth';
-const line5 = 'fifth';
+const line5 = 'modified fifth';
 const line6 = 'sixth';
-const line7 = 'seventh';
 const line8 = 'eighth';
 const line9 = 'ninth';
-const line10 = 'tenth';
+const line10 = 'tenth';
+const newLine = 'added';`,
      baseContent,
      headContent,
    },
  ];

  // Comment on a current line (line 2 - unchanged)
  const currentLineComment: MockComment = {
    id: 2001,
    body: "This comment is on a line that still exists at the same position.",
    user: {
      id: 2,
      login: "reviewer",
      avatar_url: "https://avatars.githubusercontent.com/u/2",
    },
    created_at: "2024-01-02T12:00:00Z",
    updated_at: "2024-01-02T12:00:00Z",
    path: "src/example.ts",
    line: 2, // Current line position
    side: "RIGHT",
    position: 2,
    original_line: 2,
    original_commit_id: "headsha123", // Same as current head
  };

  // Outdated comment - line was deleted (line 7 removed)
  const outdatedDeletedComment: MockComment = {
    id: 2002,
    body: "This comment was on line7 which has been deleted.",
    user: {
      id: 2,
      login: "reviewer",
      avatar_url: "https://avatars.githubusercontent.com/u/2",
    },
    created_at: "2024-01-01T14:00:00Z",
    updated_at: "2024-01-01T14:00:00Z",
    path: "src/example.ts",
    line: null, // Outdated - no current line
    side: "RIGHT",
    position: 7,
    original_line: 7, // Was on line 7
    original_commit_id: "previoussha", // Different from current head
  };

  const config = {
    owner,
    repo,
    prNumber,
    pageUrl: `/${owner}/${repo}/${String(prNumber)}?mode=stateless`,
  };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
  });

  test("displays comments correctly in stateless mode", async ({ page }) => {
    // Setup mocks with a current line comment
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
      comments: [currentLineComment],
    });

    await page.goto(config.pageUrl);

    // Wait for file navigation to load
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await expect(fileNav.getByText("example.ts")).toBeVisible();

    // Click on the file to show diff
    await fileNav.getByText("example.ts").click();

    // Wait for diff to load
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    // Find the comment thread region
    const threadRegion = page.getByRole("region", {
      name: /Thread on line 2/i,
    });
    await expect(threadRegion).toBeVisible();

    // Verify the comment text is visible
    await expect(
      threadRegion.getByText(
        "This comment is on a line that still exists at the same position."
      )
    ).toBeVisible();

    // Verify the reply textbox is visible (thread is fully rendered)
    const replyTextbox = threadRegion.getByRole("textbox", {
      name: /Reply to conversation/i,
    });
    await expect(replyTextbox).toBeVisible();
  });

  test("handles outdated comments gracefully without crashing", async ({ page }) => {
    // Setup mocks with both current and outdated comments
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
      comments: [currentLineComment, outdatedDeletedComment],
    });

    await page.goto(config.pageUrl);

    // Wait for file navigation to load
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Click on the file to show diff
    await fileNav.getByText("example.ts").click();

    // Wait for diff to load - this confirms the app doesn't crash with outdated comments
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    // Current line comment should still be visible
    const currentThread = page.getByRole("region", {
      name: /Thread on line 2/i,
    });
    await expect(currentThread).toBeVisible();
    await expect(
      currentThread.getByText(
        "This comment is on a line that still exists at the same position."
      )
    ).toBeVisible();

    // The outdated comment may or may not be visible depending on SpanTracker results,
    // but the app should not crash. The main assertion is that we got here without errors.
  });

  test("stateless mode warning is shown when viewing PR", async ({ page }) => {
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
      comments: [currentLineComment],
    });

    // Set up promise BEFORE navigation to catch the console warning
    const warningPromise = page.waitForEvent("console", {
      predicate: (msg) =>
        msg.type() === "warning" &&
        msg.text().includes("[CodjiFlo] Using GitHub API as fallback"),
    });

    await page.goto(config.pageUrl);

    // Wait for the warning to be emitted
    const warningMsg = await warningPromise;
    const warningText = warningMsg.text();

    // Verify it's the stateless mode warning
    expect(warningText).toContain("Reason:");
    // In forced stateless mode, the reason is about the query parameter
    expect(warningText).toContain("stateless mode");
  });

  test("application is stable when SpanTracker precomputation is triggered", async ({ page }) => {
    // This test verifies that the SpanTracker precomputation hook doesn't cause
    // any runtime errors when triggered in stateless mode with files that have comments.

    // Setup with multiple files and comments to ensure SpanTracker is engaged
    const multipleFiles: MockFile[] = [
      ...mockFiles,
      {
        filename: "src/helper.ts",
        status: "added",
        additions: 3,
        deletions: 0,
        changes: 3,
        patch: `@@ -0,0 +1,3 @@
+export function helper() {
+  return 'helper';
+}`,
        headContent: `export function helper() {
  return 'helper';
}`,
      },
    ];

    const multipleComments: MockComment[] = [
      currentLineComment,
      {
        id: 2003,
        body: "Comment on the helper file",
        user: {
          id: 2,
          login: "reviewer",
          avatar_url: "https://avatars.githubusercontent.com/u/2",
        },
        created_at: "2024-01-02T14:00:00Z",
        updated_at: "2024-01-02T14:00:00Z",
        path: "src/helper.ts",
        line: 2,
        side: "RIGHT",
        position: 2,
        original_line: 2,
        original_commit_id: "headsha123",
      },
    ];

    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: multipleFiles,
      comments: multipleComments,
    });

    await page.goto(config.pageUrl);

    // Wait for file navigation to load
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Both files should be listed
    await expect(fileNav.getByText("example.ts")).toBeVisible();
    await expect(fileNav.getByText("helper.ts")).toBeVisible();

    // Click on first file
    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    // Switch to second file - SpanTracker tasks may be scheduled in background
    await fileNav.getByText("helper.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/helper.ts" })
    ).toBeVisible();

    // Verify comment on helper file is visible
    const helperThread = page.getByRole("region", {
      name: /Thread on line 2/i,
    });
    await expect(helperThread).toBeVisible();
    await expect(
      helperThread.getByText("Comment on the helper file")
    ).toBeVisible();

    // Switch back to first file - tests that app remains stable
    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    // First file's comment should still be visible
    const exampleThread = page.getByRole("region", {
      name: /Thread on line 2/i,
    });
    await expect(exampleThread).toBeVisible();
  });
});
