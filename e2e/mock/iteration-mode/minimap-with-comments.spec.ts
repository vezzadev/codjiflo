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

test.describe("Minimap lasso visibility with inline comments", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 790;

  // Create a larger file to ensure scrolling is meaningful
  const createLargeContent = (lineCount: number, prefix: string) => {
    return Array.from({ length: lineCount }, (_, i) => `${prefix} line ${i + 1}`).join("\n");
  };

  const baseContent = createLargeContent(100, "const base =");
  const headContent =
    createLargeContent(50, "const base =") +
    "\nconst added = 'new line';\n" +
    createLargeContent(49, "const base =");

  const initialFiles = {
    "src/large-file.ts": baseContent,
  };

  const patch1 = `From abc123 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 10:00:00 +0000
Subject: [PATCH] feat: Add new line in middle

diff --git a/src/large-file.ts b/src/large-file.ts
--- a/src/large-file.ts
+++ b/src/large-file.ts
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
    title: "Test: minimap with comments",
    body: "PR to test minimap lasso visibility with comments",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/minimap", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/large-file.ts",
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
      id: 2001,
      body: "Comment on the added line",
      user: {
        id: 2,
        login: "reviewer",
        avatar_url: "https://avatars.githubusercontent.com/u/2",
      },
      created_at: "2024-01-02T12:00:00Z",
      updated_at: "2024-01-02T12:00:00Z",
      path: "src/large-file.ts",
      line: 51, // The added line
      side: "RIGHT",
      position: 4,
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

  test("hides lasso when inline comments are present", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Enable full file mode
    await page.keyboard.press("f");

    // Minimap should be visible
    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    // But lasso should be hidden because comments are present
    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).not.toBeVisible();
  });
});
