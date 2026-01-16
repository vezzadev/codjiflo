import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";

test.describe("Minimap navigation without inline comments", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 789;

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
    title: "Test: minimap navigation",
    body: "PR to test minimap click and lasso visibility",
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

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1],
    });

    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: mockPR,
      files: mockFiles,
      comments: [], // No comments
    });
    await setupIterationArtifactMock(page, owner, repo, prNumber, mockDb);
  });

  test("shows minimap when viewing a file", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Wait for file navigation and click file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff to load
    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Enable full file mode first (F key)
    await page.keyboard.press("f");

    // Minimap should be visible
    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();
  });

  test("shows lasso in full-file mode without comments", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Enable full file mode (F key)
    await page.keyboard.press("f");

    // Minimap should show lasso
    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).toBeVisible();
  });

  test("hides lasso in changes-only mode", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Ensure we're in changes-only mode (default)
    // Minimap should be visible but lasso hidden
    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).not.toBeVisible();
  });

  test("clicking minimap scrolls to position", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Enable full file mode to see full file content
    await page.keyboard.press("f");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    // Get minimap bounding box and verify it exists
    const minimapBox = await minimap.boundingBox();
    if (!minimapBox) {
      throw new Error("Minimap bounding box not found");
    }

    // Click on the bottom third of the minimap (should scroll down)
    const clickY = minimapBox.y + minimapBox.height * 0.8;
    const clickX = minimapBox.x + minimapBox.width / 2;

    await page.mouse.click(clickX, clickY);

    // Verify scrolling happened by checking that later lines are visible
    // After clicking bottom of minimap, we should see lines near the end
    await expect(page.getByText(/line 9\d/)).toBeVisible();
  });
});
