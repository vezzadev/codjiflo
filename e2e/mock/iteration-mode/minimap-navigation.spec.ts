import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";

test.describe("Minimap navigation with comments hidden", () => {
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

  // Create a much larger file for testing lasso proportional sizing
  const veryLargeBaseContent = createLargeContent(500, "const config =");
  const veryLargeHeadContent =
    createLargeContent(250, "const config =") +
    "\nconst newConfig = 'added';\n" +
    createLargeContent(249, "const config =");

  const initialFiles = {
    "src/large-file.ts": baseContent,
    "src/very-large-file.ts": veryLargeBaseContent,
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

diff --git a/src/very-large-file.ts b/src/very-large-file.ts
--- a/src/very-large-file.ts
+++ b/src/very-large-file.ts
@@ -248,6 +248,7 @@ const config = line 248
 const config = line 249
 const config = line 250
+const newConfig = 'added';
 const config = line 251
 const config = line 252
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
    {
      filename: "src/very-large-file.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: `@@ -248,6 +248,7 @@ const config = line 248
 const config = line 249
 const config = line 250
+const newConfig = 'added';
 const config = line 251
 const config = line 252`,
      baseContent: veryLargeBaseContent,
      headContent: veryLargeHeadContent,
    },
  ];

  /**
   * Wait for the minimap lasso to become visible
   * This waits for the scroll container to be found AND viewportRatio to be calculated
   */
  async function waitForLasso(page: import("@playwright/test").Page): Promise<void> {
    const minimap = page.getByRole("img", { name: /minimap/i });
    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).toBeVisible();
  }

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
    await fileNav.getByText("large-file.ts", { exact: true }).click();

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

  test("shows lasso when comments hidden in full-file mode", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts", { exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Enable full file mode and wait for it to take effect
    await page.keyboard.press("f");
    // Wait for toolbar to show "Full File" label (indicating full-file mode is active)
    await expect(page.getByText("Full File")).toBeVisible();

    // Hide comments to show lasso (D key)
    await page.keyboard.press("d");

    // Minimap should show lasso when comments are hidden
    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    // Wait for lasso to appear (depends on scroll container being found and viewportRatio calculated)
    await waitForLasso(page);
  });

  test("hides lasso in changes-only mode", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts", { exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Ensure we're in changes-only mode (default)
    // Minimap should be visible but lasso hidden
    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    const lasso = minimap.locator(".minimap-lasso");
    await expect(lasso).toBeHidden();
  });

  test("clicking minimap scrolls to position", async ({ page }) => {
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts", { exact: true }).click();

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
    await expect(page.getByText(/line 9\d/).first()).toBeVisible();
  });

  test("minimap resets lasso when switching files", async ({ page }) => {
    // This test validates the contentKey bug fix:
    // When switching files, the minimap lasso should reset to top position
    // and reflect the new file's proportional viewport size
    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Click on first file
    await fileNav.getByText("large-file.ts", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Enable full file mode and wait for it to take effect
    await page.keyboard.press("f");
    // Wait for toolbar to show "Full File" label (indicating full-file mode is active)
    await expect(page.getByText("Full File")).toBeVisible();

    // Hide comments to show lasso (D key)
    await page.keyboard.press("d");

    const minimap = page.getByRole("img", { name: /minimap/i });
    await expect(minimap).toBeVisible();

    // Wait for lasso to appear (depends on scroll container being found and viewportRatio calculated)
    await waitForLasso(page);

    // Get initial lasso state
    const lassoInitial = minimap.locator(".minimap-lasso");

    // Scroll down in the first file by clicking bottom of minimap
    const minimapBox = await minimap.boundingBox();
    if (!minimapBox) throw new Error("Minimap bounding box not found");

    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height * 0.8
    );

    // Wait for scroll to take effect (lines in 90s should be visible)
    await expect(page.getByText(/line 9\d/).first()).toBeVisible();

    // Get lasso "d" attribute after scrolling (should be lower on the bar)
    const pathAfterScroll = await lassoInitial.getAttribute("d");

    // Now switch to the very large file
    await fileNav.getByText("very-large-file.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/very-large-file.ts" })
    ).toBeVisible();

    // Verify minimap is still visible
    await expect(minimap).toBeVisible();

    // Get lasso after file switch
    const lassoAfterSwitch = minimap.locator(".minimap-lasso");
    await expect(lassoAfterSwitch).toBeVisible();

    // Get the "d" attribute after switching files
    const pathAfterSwitch = await lassoAfterSwitch.getAttribute("d");

    // The lasso path should be different after switching files
    // (it should reset to top position for the new file)
    // Using if-throw pattern to avoid linter auto-fix issues
    if (pathAfterScroll === pathAfterSwitch) {
      throw new Error(`Lasso path should change after file switch. Got: ${pathAfterScroll ?? "null"}`);
    }

    // Additional verification: the lasso should be near the top (scrollRatio ~0)
    // This is hard to assert directly, but we can verify the diff content is at line 1
    await expect(page.getByText(/const config = line 1$/)).toBeVisible();
  });
});
