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

test.describe("Iteration File Status", () => {
  // Test for bug fix: files first modified in later iterations should show as "modified" not "added"
  // Uses buildIterationDb to create mock iteration database

  // Mock data for file status tests
  // Simulates: action.yml exists in base, not modified in iter 1, modified in iter 2
  const mockInitialFiles = {
    "action.yml": `name: CodjiFlo
description: Capture PR iterations
runs:
  using: node20
  main: dist/index.js
`,
    ".github/workflows/codjiflo.yml": `name: CodjiFlo
on: pull_request
`,
  };

  // Iteration 1: Only modifies .github/workflows/codjiflo.yml (not action.yml)
  const mockPatch1 = `From f882b4e Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 03:21:50 +0000
Subject: [PATCH] chore: Update workflow

diff --git a/.github/workflows/codjiflo.yml b/.github/workflows/codjiflo.yml
--- a/.github/workflows/codjiflo.yml
+++ b/.github/workflows/codjiflo.yml
@@ -1,2 +1,2 @@
 name: CodjiFlo
-on: pull_request
+on: [pull_request, workflow_dispatch]
`;

  // Iteration 2: First modifies action.yml
  const mockPatch2 = `From 4ef287e Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 03:26:01 +0000
Subject: [PATCH] feat: Add author field

diff --git a/action.yml b/action.yml
--- a/action.yml
+++ b/action.yml
@@ -1,5 +1,6 @@
 name: CodjiFlo
 description: Capture PR iterations
+author: testuser
 runs:
   using: node20
   main: dist/index.js
`;

  const mockPR: MockPR = {
    id: 97,
    number: 97,
    title: "Test iteration file status",
    body: "Testing file status across iterations",
    state: "open",
    merged: false,
    draft: false,
    user: { id: 1, login: "testuser" },
    head: { ref: "feature/test", sha: "4ef287e" },
    base: { ref: "main", sha: "fec7c2a" },
    html_url: "https://github.com/test/repo/pull/97",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "action.yml",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "@@ -1,5 +1,6 @@\n name: CodjiFlo\n description: Capture PR iterations\n+author: testuser\n runs:",
      baseContent: mockInitialFiles["action.yml"],
      headContent: `name: CodjiFlo
description: Capture PR iterations
author: testuser
runs:
  using: node20
  main: dist/index.js
`,
    },
    {
      filename: ".github/workflows/codjiflo.yml",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: "@@ -1,2 +1,2 @@\n name: CodjiFlo\n-on: pull_request\n+on: [pull_request, workflow_dispatch]",
      baseContent: mockInitialFiles[".github/workflows/codjiflo.yml"],
      headContent: `name: CodjiFlo
on: [pull_request, workflow_dispatch]
`,
    },
  ];

  // Mock mode configuration
  const config = { owner: "test", repo: "repo", prNumber: 97 };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);

    // Build mock iteration database from patches
    const mockDb = buildIterationDb({
      initialFiles: mockInitialFiles,
      patches: [mockPatch1, mockPatch2],
    });
    // Setup PR mocks first, then iteration artifact mock
    // (Playwright routes registered later are checked first, so iteration mock overrides the empty comments)
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      mockDb
    );
  });

  test("File first modified in later iteration shows as modified, not added", async ({
    page,
  }) => {
    // This test verifies the "base equivalence" fix:
    // - action.yml existed in the PR base but wasn't changed in iteration 1
    // - action.yml was first modified in iteration 2
    // - When viewing iteration 1, action.yml should NOT appear
    // - When viewing iteration 2, it should show as "M" (modified), not "A" (added)

    const pageUrl = `/${config.owner}/${config.repo}/${String(config.prNumber)}`;

    await page.goto(pageUrl);

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    const actionYmlItem = fileList.locator(".tree-item.file").filter({
      hasText: "action.yml",
    });

    // --- Iteration 1: action.yml should NOT appear ---
    const iteration1Tab = page.getByTestId("iteration-tab-1");
    await iteration1Tab.click();
    await expect(iteration1Tab).toHaveClass(/selected/);

    // action.yml should not be visible (wasn't modified in iteration 1)
    await expect(actionYmlItem).toBeHidden();

    // --- Iteration 2: action.yml should appear as "M" (modified) ---
    const iteration2Tab = page.getByTestId("iteration-tab-2");
    await iteration2Tab.click();
    await expect(iteration2Tab).toHaveClass(/selected/);

    // action.yml should now be visible
    await expect(actionYmlItem).toBeVisible();

    // Check the change-type indicator shows "M" (modified), not "A" (added)
    const changeTypeIndicator = actionYmlItem.locator(".change-type");
    await expect(changeTypeIndicator).toHaveText("M");

    // Also verify via aria-label that it says "modified" not "added"
    const ariaLabel = await actionYmlItem.getAttribute("aria-label");
    expect(ariaLabel).toContain("modified");
    expect(ariaLabel).not.toContain("added");
  });

  test("Dragging between iterations shows file as modified, not added", async ({
    page,
  }) => {
    // When comparing iteration 1 to iteration 2 via drag selection,
    // files first modified in iteration 2 should show as "M" (modified)
    // because the base content exists (PR base = iteration 1 end state for unchanged files)

    const pageUrl = `/${config.owner}/${config.repo}/${String(config.prNumber)}`;

    await page.goto(pageUrl);

    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Drag from iteration 1 to iteration 2
    const tab1 = page.getByTestId("iteration-tab-1");
    const tab2 = page.getByTestId("iteration-tab-2");

    const box1 = await tab1.boundingBox();
    const box2 = await tab2.boundingBox();

    if (box1 && box2) {
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
      await page.mouse.down();
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
      await page.mouse.up();
    }

    // Both tabs should be selected (range selection)
    await expect(tab1).toHaveClass(/selected/);
    await expect(tab2).toHaveClass(/selected/);

    // action.yml should appear as "M" (modified), not "A" (added)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    const actionYmlItem = fileList.locator(".tree-item.file").filter({
      hasText: "action.yml",
    });

    await expect(actionYmlItem).toBeVisible();

    const changeTypeIndicator = actionYmlItem.locator(".change-type");
    await expect(changeTypeIndicator).toHaveText("M");
  });
});
