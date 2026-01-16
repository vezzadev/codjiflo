import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../../fixtures/github-mocks";
import { buildIterationDb } from "../../../fixtures/iteration-db-builder";

test.describe("J/K Navigation in Full File Mode (Issue #140)", () => {
  // Tests for bug #140: J/K shortcuts don't work when reviewing diff between
  // iterations in full file mode. This test verifies that keyboard navigation
  // works correctly when:
  // 1. In iteration mode (viewing diff between iterations)
  // 2. Full file mode is enabled (showing all lines, not just changes)
  // 3. The diff is virtualized (500+ lines)

  // Generate a large file (600 lines) with scattered changes
  const generateLargeFile = (version: "base" | "head") => {
    const lines: string[] = [];
    for (let i = 1; i <= 600; i++) {
      if (i === 50) {
        lines.push(version === "base" ? "// Old line 50" : "// New line 50");
      } else if (i === 250) {
        lines.push(version === "base" ? "// Old line 250" : "// New line 250");
      } else if (i === 450) {
        lines.push(version === "base" ? "// Old line 450" : "// New line 450");
      } else {
        lines.push(`// Line ${String(i)}`);
      }
    }
    return lines.join("\n");
  };

  const initialContent = generateLargeFile("base");
  const modifiedContent = generateLargeFile("head");

  const initialFiles = {
    "src/large-file.ts": initialContent,
  };

  // Patch that modifies 3 scattered lines
  const patch1 = `From abc1234 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 10:00:00 +0000
Subject: [PATCH] feat: Update large file

diff --git a/src/large-file.ts b/src/large-file.ts
--- a/src/large-file.ts
+++ b/src/large-file.ts
@@ -48,5 +48,5 @@
 // Line 48
 // Line 49
-// Old line 50
+// New line 50
 // Line 51
 // Line 52
@@ -248,5 +248,5 @@
 // Line 248
 // Line 249
-// Old line 250
+// New line 250
 // Line 251
 // Line 252
@@ -448,5 +448,5 @@
 // Line 448
 // Line 449
-// Old line 450
+// New line 450
 // Line 451
 // Line 452
`;

  const mockPR: MockPR = {
    id: 140,
    number: 140,
    title: "Test J/K navigation in full file mode",
    body: "Testing issue #140",
    state: "open",
    merged: false,
    draft: false,
    user: { id: 1, login: "testuser" },
    head: { ref: "feature/test", sha: "abc1234" },
    base: { ref: "main", sha: "base123" },
    html_url: "https://github.com/test/repo/pull/140",
    created_at: "2026-01-02T10:00:00Z",
    updated_at: "2026-01-02T11:00:00Z",
  };

  // IMPORTANT: status must be "added" to reproduce Issue #140
  // The bug occurs when PR-level status is "added" (new file in PR)
  // but iteration diff has context lines (file modified between iterations)
  const mockFiles: MockFile[] = [
    {
      filename: "src/large-file.ts",
      status: "added",
      additions: 600,
      deletions: 0,
      changes: 600,
      patch: `@@ -48,5 +48,5 @@
 // Line 48
 // Line 49
-// Old line 50
+// New line 50
 // Line 51
 // Line 52
@@ -248,5 +248,5 @@
 // Line 248
 // Line 249
-// Old line 250
+// New line 250
 // Line 251
 // Line 252
@@ -448,5 +448,5 @@
 // Line 448
 // Line 449
-// Old line 450
+// New line 450
 // Line 451
 // Line 452`,
      baseContent: initialContent,
      headContent: modifiedContent,
    },
  ];

  test.beforeEach(async ({ page }) => {

    await setupAuthState(page);

    // Build mock iteration database
    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1],
    });

    await setupFullPRMocks(page, "test", "repo", 140, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, "test", "repo", 140, mockDb);
  });

  test("J/K navigation works in iteration mode with full file view", async ({
    page,
  }) => {
    // TEST FAILURE VALIDATION:
    // Without fix: After pressing J in full file mode, navigation doesn't work
    //   - Previous button stays disabled even after multiple J presses
    //   - Scroll position doesn't change
    // With fix: J/K navigation works correctly
    //   - After pressing J twice, Previous button becomes enabled
    //   - View scrolls to the change location

    await page.goto("/test/repo/140");
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Click on the large file
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await fileList.getByText("large-file.ts").click();

    // Wait for diff to render
    const diffViewer = page.locator(".diff-viewer");
    await expect(diffViewer).toBeVisible();

    // Get toolbar and navigation buttons
    const toolbar = page.getByRole("toolbar", { name: /Diff view controls/i });
    await expect(toolbar).toBeVisible();

    const prevChangeBtn = toolbar.getByRole("button", { name: /Previous change/i });
    const nextChangeBtn = toolbar.getByRole("button", { name: /Next change/i });

    // Toggle to full file mode (this triggers virtualization with 600+ lines)
    await page.keyboard.press("f");

    // Wait for full file content - dropdown should show "Full File"
    const fileContentDropdown = toolbar.getByRole("button", { name: "File content" });
    await expect(fileContentDropdown).toContainText("Full File");

    // Navigation buttons should be ready (multiple hunks detected)
    await expect(nextChangeBtn).toBeEnabled();
    await expect(prevChangeBtn).toBeDisabled();

    // Press J to navigate to first change
    await page.keyboard.press("j");

    // After first J, we're at index 0 (first hunk)
    // Previous should still be disabled (at first change), Next should be enabled
    await expect(prevChangeBtn).toBeDisabled();
    await expect(nextChangeBtn).toBeEnabled();

    // Press J again to move to second change
    await page.keyboard.press("j");

    // Now at index 1, Previous should be enabled (can go back)
    await expect(prevChangeBtn).toBeEnabled();

    // Press K to go back to first change
    await page.keyboard.press("k");

    // Back to index 0, Previous should be disabled again
    await expect(prevChangeBtn).toBeDisabled();
    await expect(nextChangeBtn).toBeEnabled();

    // Navigate forward until we reach the last change
    let maxIterations = 20; // Safety limit
    while (maxIterations > 0 && await nextChangeBtn.isEnabled()) {
      await page.keyboard.press("j");
      maxIterations--;
    }

    // After reaching the last change, Next should be disabled
    await expect(nextChangeBtn).toBeDisabled();
    await expect(prevChangeBtn).toBeEnabled();
  });
});

