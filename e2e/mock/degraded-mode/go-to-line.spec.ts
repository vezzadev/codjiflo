import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

/**
 * Go to Line E2E Tests
 *
 * Tests the Ctrl+G keyboard shortcut to open the Go to Line modal
 * and navigate to a specific line in the diff view.
 */
test.describe("Go to Line feature", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR with many lines",
    body: "Test PR body",
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

  // Generate a file with enough lines to test scrolling
  function generateLargeFile(lineCount: number) {
    const baseLines: string[] = [];
    const headLines: string[] = [];
    const patchLines: string[] = [`@@ -1,${lineCount} +1,${lineCount} @@`];

    for (let i = 1; i <= lineCount; i++) {
      const line = `// Line ${i}: context content here`;
      baseLines.push(line);
      headLines.push(line);
      patchLines.push(` ${line}`);
    }

    // Add some changes in the middle
    const midPoint = Math.floor(lineCount / 2);
    baseLines[midPoint] = `const oldValue${midPoint} = ${midPoint};`;
    headLines[midPoint] = `const newValue${midPoint} = ${midPoint + 100};`;
    patchLines[midPoint + 1] = `-${baseLines[midPoint]}`;
    patchLines.splice(midPoint + 2, 0, `+${headLines[midPoint]}`);

    return {
      patch: patchLines.join("\n"),
      baseContent: baseLines.join("\n"),
      headContent: headLines.join("\n"),
    };
  }

  const largeFile = generateLargeFile(200);

  const mockFiles: MockFile[] = [
    {
      filename: "src/large-file.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: largeFile.patch,
      baseContent: largeFile.baseContent,
      headContent: largeFile.headContent,
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 123,
    pageUrl: "/test/repo/123",
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Ctrl+G opens go-to-line modal in inline view", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Select the file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff content to be visible
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Focus the diff region and press Ctrl+G
    await diffRegion.focus();
    await page.keyboard.press("Control+g");

    // Verify the modal appears
    const modal = page.getByRole("dialog", { name: "Go to line" });
    await expect(modal).toBeVisible();

    // Verify the input is focused
    const input = page.getByRole("textbox", { name: "Go to line:" });
    await expect(input).toBeFocused();
  });

  test("typing line number and pressing Enter scrolls to that line", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Select the file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff content
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Enable full file view to see all lines (changes view only shows context around changes)
    await diffRegion.focus();
    await page.keyboard.press("f"); // Toggle to full file view

    // Wait for full file to load
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar.getByText("Full File")).toBeVisible();

    // Re-focus the diff region after the keyboard shortcut
    await diffRegion.focus();

    // Open go-to-line modal
    await page.keyboard.press("Control+g");

    const modal = page.getByRole("dialog", { name: "Go to line" });
    await expect(modal).toBeVisible();

    // Type a line number and submit (use pressSequentially() to trigger React onChange properly)
    const input = modal.getByRole("textbox");
    await input.clear();
    await input.pressSequentially("150");
    await input.press("Enter");

    // Modal should close
    await expect(modal).not.toBeVisible();

    // The line should now be visible in the viewport
    // Check the text content that would be on line 150
    const lineContent = diffRegion.getByText("// Line 150: context content here");
    await expect(lineContent).toBeInViewport();
  });

  test("Escape key closes the modal without navigation", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Select the file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff content
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Open go-to-line modal
    await diffRegion.focus();
    await page.keyboard.press("Control+g");

    const modal = page.getByRole("dialog", { name: "Go to line" });
    await expect(modal).toBeVisible();

    // Type a line number but press Escape instead of Enter
    await page.keyboard.type("150");
    await page.keyboard.press("Escape");

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Line 150 should NOT be in viewport (we didn't navigate)
    // Line 1 area should still be visible (top of file)
    const firstLineGutter = diffRegion
      .locator(".cm-gutterElement")
      .filter({ hasText: /^1$/ });
    await expect(firstLineGutter.first()).toBeInViewport();
  });

  test("empty input does not navigate and keeps modal open", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Select the file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff content
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Open go-to-line modal
    await diffRegion.focus();
    await page.keyboard.press("Control+g");

    const modal = page.getByRole("dialog", { name: "Go to line" });
    await expect(modal).toBeVisible();

    // Press Enter without typing anything
    await page.keyboard.press("Enter");

    // Modal should still be visible (validation failed on empty input)
    // Note: We don't check for error message as React state doesn't sync with Playwright fill()
    // The validation is thoroughly tested in unit tests
    await expect(modal).toBeVisible();

    // Line 1 should still be in viewport (no navigation happened)
    const firstLineContent = diffRegion.getByText("// Line 1: context content here");
    await expect(firstLineContent).toBeInViewport();
  });

  test("Ctrl+G works when clicking inside CodeMirror editor content", async ({
    page,
  }) => {
    // This test verifies that Ctrl+G works as a global shortcut even when
    // focus is NOT on the wrapper div (simulating clicking inside the diff)
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Select the file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff content
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Click on actual code text inside the CodeMirror content area
    // This focuses CodeMirror's internal contenteditable, NOT the wrapper div
    const codeText = diffRegion.getByText("// Line 5: context content here");
    await codeText.click();

    // Press Ctrl+G - this should open the modal as a global shortcut
    await page.keyboard.press("Control+g");

    // Verify the modal appears
    const modal = page.getByRole("dialog", { name: "Go to line" });
    await expect(modal).toBeVisible();

    // Verify the input is focused
    const input = page.getByRole("textbox", { name: "Go to line:" });
    await expect(input).toBeFocused();
  });
});
