import { test } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "../../../fixtures/github-mocks";
import { buildRebaseIterationDb } from "../../../fixtures/iteration-db-builder";
import { setupLegacyDefaults } from "../../../fixtures/legacy-defaults";
import { CMEditor, expect } from "../../../fixtures/codemirror";

test.describe("Rebase Base Commit Handling (Issue #151)", () => {
  // Tests: AC-4.7.5, AC-4.7.7.1 (Rebase-aware default range and "Full diff" preset)
  //
  // Test for issue #151: After rebase, diff viewer should use the new base
  // not the stale old base from snapshot 0.
  //
  // Scenario:
  // 1. Original base has: line1, line2, line3, line4, line5
  // 2. Iteration 1: Change line2 → "modified line2"
  // 3. Rebase: Base branch changed line4 → "base modified line4"
  // 4. Iteration 2: After rebase, head has both changes
  //
  // Expected behavior:
  // - Viewing "base → iteration 2" should show ONLY line2 changed
  //   (because line4 is already in the new base after rebase)
  //
  // Bug behavior (before fix):
  // - Shows BOTH line2 AND line4 as changed (comparing against old base)

  const originalBase = `line1
line2
line3
line4
line5
`;

  const iteration1Head = `line1
modified line2
line3
line4
line5
`;

  // After rebase, the base branch has line4 changed
  const rebasedBase = `line1
line2
line3
base modified line4
line5
`;

  // After rebase, head has both changes (line2 from PR, line4 from new base)
  const iteration2Head = `line1
modified line2
line3
base modified line4
line5
`;

  const mockPR: MockPR = {
    id: 151,
    number: 151,
    title: "Test rebase base commit handling",
    body: "Testing issue #151 - diff after rebase",
    state: "open",
    merged: false,
    draft: false,
    user: { id: 1, login: "testuser" },
    head: { ref: "feature/rebase-test", sha: "head-sha-2" },
    base: { ref: "main", sha: "new-base-sha" },
    html_url: "https://github.com/test/repo/pull/151",
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/file.txt",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      // Patch shows only line2 changed (relative to NEW base)
      patch: `@@ -1,5 +1,5 @@
 line1
-line2
+modified line2
 line3
 base modified line4
 line5`,
      baseContent: rebasedBase,
      headContent: iteration2Head,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);

    // Build rebase scenario database
    const mockDb = buildRebaseIterationDb({
      filePath: "src/file.txt",
      originalBaseContent: originalBase,
      iteration1HeadContent: iteration1Head,
      rebasedBaseContent: rebasedBase,
      iteration2HeadContent: iteration2Head,
    });

    await setupFullPRMocks(page, "test", "repo", 151, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, "test", "repo", 151, mockDb);
  });

  test("Full diff after rebase uses new base, not stale old base", async ({
    page,
  }) => {
    // Tests: AC-4.7.5 ("Full diff" preset uses latest iteration's left snapshot)
    //        AC-4.7.7.1 (Default range on load uses latest iteration base)
    //
    // TEST FAILURE VALIDATION (issue #151):
    // Before fix (cached fromSnapshot:0 is used, comparing to old base):
    //   - Diff shows 4 changed lines (line2 + line4)
    //   - Test fails: expected 2 changed lines, got 4
    // After fix (cached fromSnapshot:0 is invalidated, using new base):
    //   - Diff shows 2 changed lines (only line2)
    //   - Test passes

    // CRITICAL: Inject a STALE cached range to simulate a user who visited
    // this PR before the rebase. The cached range has fromSnapshot: 0 (old base).
    // The fix should INVALIDATE this cache and use the new base instead.
    await page.goto("/test/repo/151");
    await page.evaluate(() => {
      localStorage.setItem(
        "iteration-store",
        JSON.stringify({
          state: {
            selectedRanges: {
              "https://github.com/test/repo/pull/151": {
                fromSnapshot: 0, // Stale cached value pointing to OLD base
                toSnapshot: 3,
              },
            },
          },
          version: 0,
        })
      );
    });

    // Reload to apply the cached value
    await page.reload();
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Verify iteration 2 tab is selected by default (last iteration)
    const iteration2Tab = page.getByTestId("iteration-tab-2");
    await expect(iteration2Tab).toHaveClass(/selected/);

    // Click on the file to view the diff
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    const fileItem = fileList.getByRole("row", { name: /file\.txt/i });
    await fileItem.click();

    // Wait for diff to render
    const diffViewer = page.getByTestId("diff-viewer");
    await expect(diffViewer).toBeVisible();

    // Count the number of changed lines (additions + deletions)
    // Should be 2 (one deletion "line2", one addition "modified line2")
    // NOT 4 (which would include line4 changes if comparing to old base)
    // Use CodeMirror line decorations for diff line types
    const editor = CMEditor.from(page);
    const additionLines = editor.ext("diff", "lineAddition");
    const deletionLines = editor.ext("diff", "lineDeletion");

    // Wait for diff content to stabilize
    await expect(additionLines.first()).toBeVisible();

    const additionCount = await additionLines.count();
    const deletionCount = await deletionLines.count();

    // Total changed lines should be 2 (1 addition + 1 deletion for line2 only)
    // If this equals 4, the fix is not working (comparing to old base)
    expect(additionCount + deletionCount).toBe(2);
  });

  test("Iteration 1 diff uses original base correctly", async ({ page }) => {
    // Tests: Regression check for AC-4.4.4 (Individual iteration selection)
    //
    // Sanity check: Iteration 1 should still work correctly,
    // showing line2 change against the ORIGINAL base

    await page.goto("/test/repo/151");
    await page.waitForLoadState("load");

    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Select iteration 1
    const iteration1Tab = page.getByTestId("iteration-tab-1");
    await iteration1Tab.click();
    await expect(iteration1Tab).toHaveClass(/selected/);

    // Click on the file
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    const fileItem = fileList.getByRole("row", { name: /file\.txt/i });
    await fileItem.click();

    const diffViewer = page.getByTestId("diff-viewer");
    await expect(diffViewer).toBeVisible();

    // Use CodeMirror line decorations for diff line types
    const editor = CMEditor.from(page);
    const additionLines = editor.ext("diff", "lineAddition");
    const deletionLines = editor.ext("diff", "lineDeletion");

    await expect(additionLines.first()).toBeVisible();

    const additionCount = await additionLines.count();
    const deletionCount = await deletionLines.count();

    // Iteration 1: should show 2 changed lines (line2 change)
    expect(additionCount + deletionCount).toBe(2);
  });
});
