import { test } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { CMEditor, expect } from "../../fixtures/codemirror";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Change Navigation After File Switch", () => {
  // Create a PR with two files, each having multiple hunks
  const mockPR: MockPR = {
    id: 1,
    number: 456,
    title: "Test PR for change navigation",
    body: "This PR tests j/k navigation after switching files with s/w",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/nav-test", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/456",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  // File 1: Has multiple hunks (changes separated by context lines)
  const file1Patch = [
    "@@ -1,15 +1,15 @@",
    " // File header - context line",
    " import { foo } from 'bar';",
    " ",
    "-const oldValue1 = 1;", // Hunk 1 start
    "+const newValue1 = 100;",
    " ",
    " // Middle context",
    " const unchanged = 'keep';",
    " ",
    "-const oldValue2 = 2;", // Hunk 2 start
    "+const newValue2 = 200;",
    "+const extraValue = 300;",
    " ",
    " // End context",
    " export { foo };",
  ].join("\n");

  // File 2: Larger file with multiple hunks spread far apart
  // Creates a file with 100+ lines and changes at lines ~20, ~50, ~80
  const generateLargeFile2 = () => {
    const lines: string[] = [];
    lines.push("@@ -1,100 +1,103 @@");

    // First 15 context lines
    for (let i = 1; i <= 15; i++) {
      lines.push(` // Context line ${String(i)}`);
    }

    // Hunk 1 around line 16
    lines.push("-const oldConfig = { a: 1 };");
    lines.push("+const newConfig = { a: 1, b: 2 };");

    // 30 more context lines (lines 18-47)
    for (let i = 18; i <= 47; i++) {
      lines.push(` // Context line ${String(i)}`);
    }

    // Hunk 2 around line 48
    lines.push("-function oldHelper() { return 1; }");
    lines.push("-function oldHelper2() { return 2; }");
    lines.push("+function newHelper() { return 100; }");
    lines.push("+function newHelper2() { return 200; }");
    lines.push("+function newHelper3() { return 300; }");

    // 30 more context lines (lines 52-81)
    for (let i = 52; i <= 81; i++) {
      lines.push(` // Context line ${String(i)}`);
    }

    // Hunk 3 around line 82
    lines.push("-export const VERSION = '1.0.0';");
    lines.push("+export const VERSION = '2.0.0';");

    // Final context lines
    for (let i = 84; i <= 100; i++) {
      lines.push(` // Context line ${String(i)}`);
    }

    return lines.join("\n");
  };

  const file2Patch = generateLargeFile2();

  const mockFiles: MockFile[] = [
    {
      filename: "src/example.ts",
      status: "modified",
      additions: 3,
      deletions: 2,
      changes: 5,
      patch: file1Patch,
    },
    {
      filename: "src/types.ts",
      status: "modified",
      additions: 6,
      deletions: 4,
      changes: 10,
      patch: file2Patch,
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 456,
    pageUrl: "/test/repo/456",
  };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Bug repro: J fails after clicking first file then S to second file", async ({
    page,
  }) => {
    // Exact flow from user report:
    // 1. Click on first file
    // 2. Press j (works - scrolls to first change)
    // 3. Press s (navigates to second file)
    // 4. Press j (BUG - should scroll to first change but doesn't)

    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    const nextChangeBtn = toolbar.getByRole("button", { name: /Next change/i });
    const prevChangeBtn = toolbar.getByRole("button", {
      name: /Previous change/i,
    });

    // === Step 1: CLICK on first file (example.ts) ===
    const exampleFile = fileNav.getByRole("row", { name: /example\.ts/ });
    await exampleFile.click();
    await expect(exampleFile).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();
    await expect(nextChangeBtn).toBeEnabled();

    // === Step 2: Press j - scrolls to first change ===
    await page.locator("body").click();
    await page.keyboard.press("j");
    await expect(prevChangeBtn).toBeDisabled();
    await expect(nextChangeBtn).toBeEnabled();

    // === Step 3: Press s - moves to types.ts ===
    await page.keyboard.press("s");
    const typesFile = fileNav.getByRole("row", { name: /types\.ts/ });
    await expect(typesFile).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("heading", { name: "src/types.ts" })
    ).toBeVisible();

    // Wait for the new file's navigation to be ready
    await expect(nextChangeBtn).toBeEnabled();

    const diffRegion = page.getByRole("region", { name: /Diff content/i });

    // Ensure focus is on body, not inside the CodeMirror editor
    // This is important because there are TWO j handlers:
    // 1. Global handler (useKeyboardShortcuts) - triggered when body/document has focus
    // 2. CodeMirror keymap - triggered when editor has focus
    await page.locator("body").click();

    // === Step 4: Press j - THIS IS WHERE THE BUG OCCURS ===
    // The bug: after switching files with S, pressing J doesn't scroll to first change
    await page.keyboard.press("j");

    // EXPECTED: prevChangeBtn disabled (at first change), nextChangeBtn enabled (more changes)
    await expect(prevChangeBtn).toBeDisabled();
    await expect(nextChangeBtn).toBeEnabled();

    // Also verify scroll position changed (the actual scroll happened)
    // The first hunk in types.ts is at line 3 (oldField -> newField)
    // After pressing J, scrollTop should have changed if the first hunk isn't at the very top
    // Actually, let's press J again to go to the second hunk and verify scroll changes
    const editor = CMEditor.from(diffRegion);
    const scrollAfterFirstJ = await editor.scrollPosition();

    // Press j again to go to second change
    await page.keyboard.press("j");
    await expect(prevChangeBtn).toBeEnabled();

    // Verify scroll position changed after second j press
    const scrollAfterSecondJ = await editor.scrollPosition();

    // The scroll position should change when navigating to a different hunk
    // (Unless the second hunk is already visible, but our test file has hunks spread out)
    expect(scrollAfterSecondJ.scrollTop).not.toBe(scrollAfterFirstJ.scrollTop);
  });
});
