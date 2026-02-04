import { test, expect } from "@playwright/test";
import {
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
  type MockComment,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Unauthenticated Comment Viewing (S-4.1.6)", () => {
  // This test validates that unauthenticated users can view PR comments
  // on public repositories. Per spec/functional/unauthenticated-access.md:
  // - All comments load and display for unauthenticated users [AC-4.1.6.1]
  // - Comment author, timestamp, and body render identically [AC-4.1.6.2]
  // - Thread structure displayed correctly [AC-4.1.6.3]

  const mockPR: MockPR = {
    id: 416,
    number: 416,
    title: "Test: unauthenticated comment viewing",
    body: "Public PR with comments for unauthenticated testing",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "author",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/public-comments", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/416",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/public-file.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      changes: 3,
      patch:
        "@@ -1,3 +1,4 @@\n const x = 1;\n-const old = true;\n+const new1 = true;\n+const new2 = false;",
    },
  ];

  // Comments from different reviewers to test rendering
  const mockComments: MockComment[] = [
    {
      id: 1001,
      body: "This looks good, but consider adding a comment here.",
      user: {
        id: 100,
        login: "reviewer1",
        avatar_url: "https://avatars.githubusercontent.com/u/100",
      },
      created_at: "2024-01-02T10:00:00Z",
      updated_at: "2024-01-02T10:00:00Z",
      path: "src/public-file.ts",
      line: 3,
      side: "RIGHT",
      position: 3,
      original_line: 3,
      original_commit_id: "abc123",
    },
    {
      id: 1002,
      body: "I agree with the suggestion above. Please address.",
      user: {
        id: 200,
        login: "reviewer2",
        avatar_url: "https://avatars.githubusercontent.com/u/200",
      },
      created_at: "2024-01-02T11:00:00Z",
      updated_at: "2024-01-02T11:00:00Z",
      path: "src/public-file.ts",
      line: 3,
      side: "RIGHT",
      position: 3,
      in_reply_to_id: 1001, // Reply to first comment
      original_line: 3,
      original_commit_id: "abc123",
    },
  ];

  const owner = "test";
  const repo = "repo";
  const prNumber = 416;

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    // NOTE: We do NOT call setupAuthState() - user is unauthenticated
    await setupAuthMock(page);
    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: mockPR,
      files: mockFiles,
      comments: mockComments,
    });
  });

  test("unauthenticated user can view comments on public PR [AC-4.1.6.1, AC-4.1.6.2]", async ({
    page,
  }) => {
    // Navigate to PR page without authentication
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);
    await page.waitForLoadState("load");

    // Verify user is NOT authenticated (login button visible)
    await expect(
      page.getByRole("link", { name: /Log in/i })
    ).toBeVisible();

    // Navigate to file with comments
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("public-file.ts").click();

    // Wait for diff to load
    await expect(
      page.getByRole("heading", { name: "src/public-file.ts" })
    ).toBeVisible();

    // [AC-4.1.6.1] Verify comments are visible
    const threadRegion = page.getByRole("region", { name: /Thread on line 3/i });
    await expect(threadRegion).toBeVisible();

    // [AC-4.1.6.2] Verify comment content renders correctly
    // First comment body
    await expect(
      threadRegion.getByText("This looks good, but consider adding a comment here.")
    ).toBeVisible();

    // First comment author
    await expect(threadRegion.getByText("reviewer1")).toBeVisible();
  });

  test("unauthenticated user sees reply thread structure [AC-4.1.6.3]", async ({
    page,
  }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);
    await page.waitForLoadState("load");

    // Navigate to file with comments
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("public-file.ts").click();

    // Wait for diff to load
    await expect(
      page.getByRole("heading", { name: "src/public-file.ts" })
    ).toBeVisible();

    // [AC-4.1.6.3] Verify thread structure - both comments in the thread visible
    const threadRegion = page.getByRole("region", { name: /Thread on line 3/i });
    await expect(threadRegion).toBeVisible();

    // Both comments should be visible in the thread
    await expect(
      threadRegion.getByText("This looks good, but consider adding a comment here.")
    ).toBeVisible();
    await expect(
      threadRegion.getByText("I agree with the suggestion above. Please address.")
    ).toBeVisible();

    // Both authors should be visible
    await expect(threadRegion.getByText("reviewer1")).toBeVisible();
    await expect(threadRegion.getByText("reviewer2")).toBeVisible();
  });

  test("unauthenticated user sees comment reply textarea (current behavior)", async ({
    page,
  }) => {
    // NOTE: This test documents CURRENT behavior.
    // Per spec [AC-4.1.6.5], the reply textarea should be replaced with a
    // "Log in to reply" button for unauthenticated users.
    // This AC is NOT YET IMPLEMENTED. Currently, the textarea is visible
    // but posting would fail due to auth requirements.
    //
    // This test documents the current state and will need to be updated
    // when AC-4.1.6.5 is implemented.

    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);
    await page.waitForLoadState("load");

    // Verify user is unauthenticated
    await expect(
      page.getByRole("link", { name: /Log in/i })
    ).toBeVisible();

    // Navigate to file with comments
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("public-file.ts").click();

    // Wait for diff to load
    await expect(
      page.getByRole("heading", { name: "src/public-file.ts" })
    ).toBeVisible();

    // Verify comments are visible (can view)
    const threadRegion = page.getByRole("region", { name: /Thread on line 3/i });
    await expect(threadRegion).toBeVisible();

    // CURRENT BEHAVIOR (AC-4.1.6.5 not yet implemented):
    // Reply textarea IS visible for unauthenticated users.
    // The textarea has placeholder="Leave a comment"
    // When AC-4.1.6.5 is implemented, this should change to:
    // await expect(replyTextarea).toBeHidden();
    // await expect(threadRegion.getByRole('button', { name: /Log in to reply/i })).toBeVisible();
    const replyTextarea = threadRegion.getByPlaceholder("Leave a comment");
    await expect(replyTextarea).toBeVisible();
  });
});
