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

test.describe("Comment toggle with 'd' shortcut", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 800;

  // Create content for test file
  // startLine allows continuing line numbering (e.g., for headContent after inserted line)
  const createContent = (lineCount: number, prefix: string, startLine = 1) => {
    return Array.from({ length: lineCount }, (_, i) => `${prefix} line ${i + startLine}`).join("\n");
  };

  const baseContent = createContent(100, "const base =");
  // headContent: lines 1-50 unchanged, then added line at 51, then base lines 51-100 shifted to 52-101
  const headContent =
    createContent(50, "const base =") +
    "\nconst added = 'new line';\n" +
    createContent(50, "const base =", 51); // Lines 51-100 from base, now at positions 52-101

  const initialFiles = {
    "src/commented-file.ts": baseContent,
  };

  const patch1 = `From abc123 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 10:00:00 +0000
Subject: [PATCH] feat: Add new line

diff --git a/src/commented-file.ts b/src/commented-file.ts
--- a/src/commented-file.ts
+++ b/src/commented-file.ts
@@ -48,6 +48,7 @@ const base = line 48
 const base = line 49
 const base = line 50
+const added = 'new line';
 const base = line 51
 const base = line 52
`;

  const mockPR: MockPR = {
    id: 1,
    number: prNumber,
    title: "Test: comment toggle shortcut",
    body: "PR to test 'd' shortcut for toggling comment visibility",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/comment-toggle", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/commented-file.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: `@@ -48,6 +48,7 @@ const base = line 48
 const base = line 49
 const base = line 50
+const added = 'new line';
 const base = line 51
 const base = line 52`,
      baseContent,
      headContent,
    },
  ];

  const mockComments: MockComment[] = [
    {
      id: 3001,
      body: "This is a test comment on the added line",
      user: {
        id: 2,
        login: "reviewer",
        avatar_url: "https://avatars.githubusercontent.com/u/2",
      },
      created_at: "2024-01-02T12:00:00Z",
      updated_at: "2024-01-02T12:00:00Z",
      path: "src/commented-file.ts",
      line: 51,
      side: "RIGHT",
      position: 4,
      original_line: 51,
      original_commit_id: "abc123",
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

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

  test("shows lasso in full-file mode when comments are hidden (default)", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Navigate to the file with comments
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("commented-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/commented-file.ts" })
    ).toBeVisible();

    // Get the diff content region (where inline comments appear)
    const diffRegion = page.getByRole("region", { name: /Diff content for/i });
    await expect(diffRegion).toBeVisible();

    // Use 'J' shortcut to navigate to the change (where the comment is, line 51)
    // This ensures the comment row is scrolled into view
    await page.keyboard.press("j");

    // Verify inline comment thread is hidden by default (showComments=false)
    await expect(diffRegion.getByText("This is a test comment")).toBeHidden();

    // Minimap lasso should be visible (comments are hidden by default, full-file mode on by default)
    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();
    await expect(minimap.locator(".minimap-lasso")).toBeVisible();

    // Press 'd' to show comments
    await page.keyboard.press("d");

    // Inline comment thread should now be visible in diff
    await expect(diffRegion.getByText("This is a test comment")).toBeVisible();

    // Lasso should now be hidden (comments visible, full-file mode on)
    await expect(minimap.locator(".minimap-lasso")).toBeHidden();
  });

  test("pressing 'd' twice toggles comments visibility and lasso", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Navigate to the file with comments
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("commented-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/commented-file.ts" })
    ).toBeVisible();

    // Wait for diff content to fully load before keyboard interactions
    const diffRegion = page.getByRole("region", { name: /Diff content for/i });
    await expect(diffRegion).toBeVisible();

    // Navigate to the change (where the comment is) using 'J' shortcut
    await page.keyboard.press("j");

    // Default: comments hidden, lasso visible
    await expect(diffRegion.getByText("This is a test comment")).toBeHidden();

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap.locator(".minimap-lasso")).toBeVisible();

    // Press 'd' to show comments
    await page.keyboard.press("d");
    await expect(diffRegion.getByText("This is a test comment")).toBeVisible();

    // Lasso should be hidden when comments are visible
    await expect(minimap.locator(".minimap-lasso")).toBeHidden();

    // Press 'd' again to hide comments
    await page.keyboard.press("d");

    // Inline comment thread should be hidden again
    await expect(diffRegion.getByText("This is a test comment")).toBeHidden();

    // Lasso should be visible again
    await expect(minimap.locator(".minimap-lasso")).toBeVisible();
  });

  test("toolbar shows comment toggle button with correct state", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Navigate to the file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("commented-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/commented-file.ts" })
    ).toBeVisible();

    // Find the comments toggle dropdown (initially showing "Comments: Hidden" because showComments=false)
    const toggleButton = page.getByRole("button", { name: /comments visibility/i });
    await expect(toggleButton).toBeVisible();

    // Button should show "Comments: Hidden" label initially (default)
    await expect(toggleButton).toContainText("Comments: Hidden");

    // Click the button to open dropdown and select visible option
    await toggleButton.click();
    await page.getByText("Comments: Visible").click();

    // Button should now show "Comments: Visible"
    await expect(toggleButton).toContainText("Comments: Visible");

    // Click again and select hidden
    await toggleButton.click();
    await page.getByText("Comments: Hidden").click();
    await expect(toggleButton).toContainText("Comments: Hidden");
  });
});
