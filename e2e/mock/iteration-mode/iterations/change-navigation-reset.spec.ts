import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../../fixtures/github-mocks";
import { buildIterationDb } from "../../../fixtures/iteration-db-builder";
import { setupLegacyDefaults } from "../../../fixtures/legacy-defaults";

test.describe("Change Navigation Reset (Mock Mode)", () => {
  // Test validates that currentChangeIndex resets when iteration changes.
  // Uses mock mode with controlled data to guarantee testable state.
  // This test only runs in mock mode.

  // Initial file with content that will have multiple changes
  const initialFiles = {
    "src/app.ts": `export function main() {
  console.log("Hello");
  console.log("World");
  return 0;
}
`,
  };

  // Iteration 1: Add multiple lines (creates at least 2 changes)
  const patch1 = `From abc1234 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 10:00:00 +0000
Subject: [PATCH] feat: Add feature

diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,8 @@
 export function main() {
+  console.log("Starting");
   console.log("Hello");
+  console.log("Processing");
   console.log("World");
+  console.log("Done");
   return 0;
 }
`;

  // Iteration 2: Modify lines (also has multiple changes)
  const patch2 = `From def5678 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 11:00:00 +0000
Subject: [PATCH] fix: Update messages

diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,8 +1,8 @@
 export function main() {
-  console.log("Starting");
+  console.log("Initializing");
   console.log("Hello");
-  console.log("Processing");
+  console.log("Running");
   console.log("World");
-  console.log("Done");
+  console.log("Complete");
   return 0;
 }
`;

  const mockPR: MockPR = {
    id: 200,
    number: 200,
    title: "Test change navigation reset",
    body: "Testing J/K navigation reset on iteration switch",
    state: "open",
    merged: false,
    draft: false,
    user: { id: 1, login: "testuser" },
    head: { ref: "feature/test", sha: "def5678" },
    base: { ref: "main", sha: "base123" },
    html_url: "https://github.com/test/repo/pull/200",
    created_at: "2026-01-02T10:00:00Z",
    updated_at: "2026-01-02T11:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/app.ts",
      status: "modified",
      additions: 6,
      deletions: 3,
      changes: 9,
      patch: `@@ -1,5 +1,8 @@
 export function main() {
-  console.log("Starting");
+  console.log("Initializing");
   console.log("Hello");
-  console.log("Processing");
+  console.log("Running");
   console.log("World");
-  console.log("Done");
+  console.log("Complete");
   return 0;
 }`,
      baseContent: initialFiles["src/app.ts"],
      headContent: `export function main() {
  console.log("Initializing");
  console.log("Hello");
  console.log("Running");
  console.log("World");
  console.log("Complete");
  return 0;
}
`,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);

    // Build mock iteration database with 2 iterations
    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1, patch2],
    });

    // Setup PR mocks and iteration artifact
    await setupFullPRMocks(page, "test", "repo", 200, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, "test", "repo", 200, mockDb);
  });

  test("Previous button resets to disabled after switching iterations", async ({
    page,
  }) => {
    // TEST FAILURE VALIDATION:
    // Without the fix (resetChangeIndex on selectedRange change):
    //   - Test fails at line with "await expect(prevChangeBtn).toBeDisabled()"
    //   - Expected: disabled, Received: enabled
    //   - Previous button stays enabled (stale index) after iteration switch
    // With the fix:
    //   - Test passes - Previous button correctly disabled after iteration switch

    await page.goto("/test/repo/200");
    await page.waitForLoadState("load");

    // Wait for file list and iterations to load
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator(".skeleton")).toHaveCount(0);

    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();
    // Wait for iteration tabs to load (not just skeleton)
    await expect(selector.locator(".iteration-tab")).not.toHaveCount(0);

    // Click on the file (second item after PR description)
    // Use .tree-item.file to exclude folder headers from count
    const fileItems = fileList.locator(".tree-item.file");
    await fileItems.nth(1).click();

    // Wait for diff toolbar
    const toolbar = page.getByRole("toolbar", { name: /Diff view controls/i });
    await expect(toolbar).toBeVisible();

    // Get navigation buttons
    const nextChangeBtn = page.getByRole("button", { name: /Next change/i });
    const prevChangeBtn = page.getByRole("button", { name: /Previous change/i });
    await expect(nextChangeBtn).toBeVisible();
    await expect(prevChangeBtn).toBeVisible();

    // Initially, Previous should be disabled (index = -1)
    await expect(prevChangeBtn).toBeDisabled();

    // Navigate forward twice with J to move index > 0
    // First J: index -1 -> 0, Second J: index 0 -> 1
    await page.keyboard.press("j");
    await page.keyboard.press("j");

    // After pressing J twice, Previous should be ENABLED (index > 0)
    await expect(prevChangeBtn).toBeEnabled();

    // Switch to first iteration (currently on last)
    const tabs = selector.locator(".iteration-tab");
    const firstTab = tabs.nth(0);
    await firstTab.click();
    await expect(firstTab).toHaveClass(/selected/);

    // CRITICAL: After iteration switch, Previous should be DISABLED again
    // because the change index should reset to -1 (start position)
    // The expect with locator will auto-retry until condition is met
    await expect(prevChangeBtn).toBeDisabled();
  });
});
