import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
  type MockComment,
} from "../../fixtures/github-mocks";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";

test.describe("Inline comment visibility in virtualized diff", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 456;

  // Base content
  const baseContent = `const line1 = 1;
const line2 = 2;
const line3 = 3;`;

  // Head content with added line
  const headContent = `const line1 = 1;
const line2 = 2;
const addedLine = 'new';
const line3 = 3;`;

  const initialFiles = {
    "src/example.ts": baseContent,
  };

  // Git format-patch for the change
  const patch1 = `From abc123 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 10:00:00 +0000
Subject: [PATCH] feat: Add new line

diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,3 +1,4 @@
 const line1 = 1;
 const line2 = 2;
+const addedLine = 'new';
 const line3 = 3;
`;

  const mockPR: MockPR = {
    id: 1,
    number: prNumber,
    title: "Test: inline comment thread visibility",
    body: "PR to verify multi-comment threads are fully visible",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/comments", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/example.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: `@@ -1,3 +1,4 @@
 const line1 = 1;
 const line2 = 2;
+const addedLine = 'new';
 const line3 = 3;`,
      baseContent,
      headContent,
    },
  ];

  // Create a comment thread with original comment and reply
  const mockComments: MockComment[] = [
    {
      id: 1001,
      body: "This is the original comment on the added line. Please explain why this change was needed.",
      user: {
        id: 2,
        login: "reviewer",
        avatar_url: "https://avatars.githubusercontent.com/u/2",
      },
      created_at: "2024-01-02T12:00:00Z",
      updated_at: "2024-01-02T12:00:00Z",
      path: "src/example.ts",
      line: 3, // The added line
      side: "RIGHT",
      position: 3,
      original_line: 3,
      original_commit_id: "abc123",
    },
    {
      id: 1002,
      body: "This reply explains the change. The new line is needed for feature X to work properly with the existing codebase.",
      user: {
        id: 1,
        login: "testuser",
        avatar_url: "https://avatars.githubusercontent.com/u/1",
      },
      created_at: "2024-01-02T13:00:00Z",
      updated_at: "2024-01-02T13:00:00Z",
      path: "src/example.ts",
      line: 3,
      side: "RIGHT",
      position: 3,
      in_reply_to_id: 1001, // This is a reply to the first comment
      original_line: 3,
      original_commit_id: "abc123",
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    // Build mock iteration database
    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1],
    });

    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: mockPR,
      files: mockFiles,
      comments: mockComments,
    });
    await setupIterationArtifactMock(page, owner, repo, prNumber, mockDb);
  });

  test("shows full comment thread with original comment, reply, and reply textbox", async ({
    page,
  }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

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
      name: /Thread on line 3/i,
    });
    await expect(threadRegion).toBeVisible();

    // Verify the ORIGINAL comment is visible
    await expect(
      threadRegion.getByText(
        "This is the original comment on the added line. Please explain why this change was needed.",
        { exact: true }
      )
    ).toBeVisible();

    // Verify the REPLY comment is visible (this would fail if rows are clipped)
    await expect(
      threadRegion.getByText(
        "This reply explains the change. The new line is needed for feature X to work properly with the existing codebase.",
        { exact: true }
      )
    ).toBeVisible();

    // Verify the reply textbox is visible (ensures thread isn't truncated)
    const replyTextbox = threadRegion.getByRole("textbox", {
      name: /Reply to conversation/i,
    });
    await expect(replyTextbox).toBeVisible();

    // Verify both usernames are visible
    await expect(threadRegion.getByText("reviewer")).toBeVisible();
    await expect(threadRegion.getByText("testuser")).toBeVisible();
  });
});
