import { test, expect } from "@playwright/test";
import { isMockMode, isProdMode, prodModeConfig } from "./fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from "./fixtures/github-mocks";
import { buildIterationDb, buildRebaseIterationDb } from "./fixtures/iteration-db-builder";

test.describe("Iteration Management (S-4 Milestone)", () => {
  // Mock PR data for iteration tests
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR for Iterations",
    body: "Testing iteration management",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/test", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/123",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/test.ts",
      status: "modified",
      additions: 10,
      deletions: 5,
      changes: 15,
      patch: "@@ -1,5 +1,10 @@\n+// New code\n const x = 1;",
    },
  ];

  // Test configuration based on mode
  const getTestConfig = () => {
    if (isMockMode()) {
      return {
        owner: "test",
        repo: "repo",
        prNumber: 123,
        pageUrl: "/test/repo/123",
      };
    }
    const { owner, repo, prNumber } = prodModeConfig.testRepo;
    return {
      owner,
      repo,
      prNumber,
      pageUrl: `/${owner}/${repo}/${String(prNumber)}`,
    };
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    const config = getTestConfig();
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Page loads with iteration components integrated", async ({ page }) => {
    const config = getTestConfig();

    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Verify basic page structure is intact
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Verify navigation exists
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });

  test("Degraded mode banner shows when no artifact is available", async ({ page }) => {
    // This test only runs in mock mode since we control the responses
    test.skip(!isMockMode(), "Only runs in mock mode");

    const config = getTestConfig();

    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for the page to stabilize by waiting for the specific degraded mode banner
    // Look for the degraded mode banner (rendered as a status element with iteration tracking text)
    const banner = page.getByRole("status").filter({ hasText: /iteration tracking/i });
    await expect(banner).toBeVisible();
  });

  test("Iteration selector is hidden when no artifact is available", async ({ page }) => {
    // This test only runs in mock mode since we control the responses
    test.skip(!isMockMode(), "Only runs in mock mode");

    const config = getTestConfig();

    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Wait for the page to stabilize and iteration loading to complete
    // by waiting for the file list to be visible (which appears after loading)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Iteration selector should NOT be visible when in degraded mode
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeHidden();
  });
});

test.describe("Iteration Tabs UI (Prod Mode)", () => {
  // These tests require real iteration artifacts, so they only run in prod mode
  // Uses PR #75 which has CodjiFlo iteration artifacts installed
  const iterationTestPR = {
    owner: "pedropaulovc",
    repo: "codjiflo",
    prNumber: 75,
  };

  test.beforeEach(async ({ page }) => {
    test.skip(!isProdMode(), "Requires real iteration artifacts - prod mode only");
    await setupAuthState(page);
  });

  test("Iteration tabs display correct number of iterations", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load (may take a while to download artifacts)
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Wait for at least one tab to appear
    const tabs = selector.locator(".iteration-tab");
    await expect(tabs.first()).toBeVisible();

    const tabCount = await tabs.count();

    // Should have at least 1 iteration tab
    expect(tabCount).toBeGreaterThanOrEqual(1);

    // Each tab should display a number
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const tabNumber = tab.locator(".iteration-tab-number");
      await expect(tabNumber).toHaveText(String(i + 1));
    }
  });

  test("Clicking a single tab selects that iteration", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    if (tabCount >= 1) {
      // Click the first tab
      const firstTab = tabs.nth(0);
      await firstTab.click();

      // First tab should now have the 'selected' class
      await expect(firstTab).toHaveClass(/selected/);
    }
  });

  test("Last iteration is selected by default", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    if (tabCount >= 1) {
      // The last tab should be selected by default
      const lastTab = tabs.nth(tabCount - 1);
      await expect(lastTab).toHaveClass(/selected/);
    }
  });

  test("Dragging across tabs selects a range", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    // Need at least 2 tabs to test range selection
    if (tabCount >= 2) {
      const firstTab = tabs.nth(0);
      const secondTab = tabs.nth(1);

      // Get bounding boxes for drag operation
      const firstBox = await firstTab.boundingBox();
      const secondBox = await secondTab.boundingBox();

      if (firstBox && secondBox) {
        // Perform drag from first to second tab
        await page.mouse.move(
          firstBox.x + firstBox.width / 2,
          firstBox.y + firstBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          secondBox.x + secondBox.width / 2,
          secondBox.y + secondBox.height / 2
        );
        await page.mouse.up();

        // Both tabs should be selected (first as range-start, second as range-end)
        await expect(firstTab).toHaveClass(/selected/);
        await expect(secondTab).toHaveClass(/selected/);
      }
    }
  });

  test("Iteration tabs appear above filename in diff view", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Click on a file to show the diff view (PR description is shown by default)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Click on the first actual file (not PR description)
    const fileItems = fileList.locator(".tree-item.file");
    const fileCount = await fileItems.count();
    if (fileCount > 0) {
      await fileItems.first().click();
      // Wait for the diff to render
      await expect(page.locator(".diff-viewer")).toBeVisible();
    }

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // The iteration selector should be inside diff-header-iterations
    const headerContainer = page.locator(".diff-header-iterations");
    await expect(headerContainer).toBeVisible();

    // Verify the iteration selector is inside the header container
    const selectorInHeader = headerContainer.getByTestId("iteration-selector");
    await expect(selectorInHeader).toBeVisible();
  });

});

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
    test.skip(!isMockMode(), "Only runs in mock mode");

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

    // Click on the file (second item after PR description)
    const fileItems = fileList.getByRole("listitem");
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

test.describe("Iteration File Status", () => {
  // Test for bug fix: files first modified in later iterations should show as "modified" not "added"
  // Mock mode: uses buildIterationDb to create mock iteration database
  // Prod mode: uses PR #97 which has action.yml first modified in iteration 2

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

  // Config for mock vs prod mode
  const getTestConfig = () => {
    if (isMockMode()) {
      return { owner: "test", repo: "repo", prNumber: 97 };
    }
    return { owner: "pedropaulovc", repo: "codjiflo", prNumber: 97 };
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    if (isMockMode()) {
      const config = getTestConfig();
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
    }
  });

  test("File first modified in later iteration shows as modified, not added", async ({
    page,
  }) => {
    // This test verifies the "base equivalence" fix:
    // - action.yml existed in the PR base but wasn't changed in iteration 1
    // - action.yml was first modified in iteration 2
    // - When viewing iteration 1, action.yml should NOT appear
    // - When viewing iteration 2, it should show as "M" (modified), not "A" (added)

    const config = getTestConfig();
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

    const config = getTestConfig();
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

test.describe("Rebase Base Commit Handling (Issue #151)", () => {
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
    test.skip(!isMockMode(), "Only runs in mock mode");

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
    // TEST FAILURE VALIDATION (issue #151):
    // Before fix (fromSnapshot always 0):
    //   - Diff shows 4 changed lines (line2 + line4, comparing to old base)
    //   - Test fails: expected 2 changed lines, got 4
    // After fix (fromSnapshot uses latest iteration's left snapshot):
    //   - Diff shows 2 changed lines (only line2, comparing to new base)
    //   - Test passes

    await page.goto("/test/repo/151");
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

    const fileItem = fileList.locator(".tree-item.file").filter({
      hasText: "file.txt",
    });
    await fileItem.click();

    // Wait for diff to render
    const diffViewer = page.locator(".diff-viewer");
    await expect(diffViewer).toBeVisible();

    // Count the number of changed lines (additions + deletions)
    // Should be 2 (one deletion "line2", one addition "modified line2")
    // NOT 4 (which would include line4 changes if comparing to old base)
    const additionLines = diffViewer.locator(".diff-line-addition");
    const deletionLines = diffViewer.locator(".diff-line-deletion");

    // Wait for diff content to stabilize
    await expect(additionLines.first()).toBeVisible();

    const additionCount = await additionLines.count();
    const deletionCount = await deletionLines.count();

    // Total changed lines should be 2 (1 addition + 1 deletion for line2 only)
    // If this equals 4, the fix is not working (comparing to old base)
    expect(additionCount + deletionCount).toBe(2);
  });

  test("Iteration 1 diff uses original base correctly", async ({ page }) => {
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
    const fileItem = fileList.locator(".tree-item.file").filter({
      hasText: "file.txt",
    });
    await fileItem.click();

    const diffViewer = page.locator(".diff-viewer");
    await expect(diffViewer).toBeVisible();

    const additionLines = diffViewer.locator(".diff-line-addition");
    const deletionLines = diffViewer.locator(".diff-line-deletion");

    await expect(additionLines.first()).toBeVisible();

    const additionCount = await additionLines.count();
    const deletionCount = await deletionLines.count();

    // Iteration 1: should show 2 changed lines (line2 change)
    expect(additionCount + deletionCount).toBe(2);
  });
});
