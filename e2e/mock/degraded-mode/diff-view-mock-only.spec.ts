import { test } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { CMEditor, expect } from "../../fixtures/codemirror";

test.describe("Diff View - Mock Only Tests", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR",
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

  const mockFiles: MockFile[] = [
    {
      filename: "src/example.ts",
      status: "modified",
      additions: 5,
      deletions: 2,
      changes: 7,
      patch:
        "@@ -1,5 +1,8 @@\n const x = 1;\n-const y = 2;\n+const y = 3;\n+const z = 4;\n // comment\n-const a = 5;\n+const a = 6;\n+const b = 7;\n+const c = 8;",
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

  test("Syntax highlighting preserved when showing whitespace (Issue #131)", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Before enabling whitespace visibility, verify syntax highlighting is present.
    // CodeMirror uses classes for syntax highlighting. Wait for syntax tokens to appear
    // by checking for .ͼ (CodeMirror highlight class prefix) or .tok- classes.
    // Language loading is async so we need to wait.
    const editor = CMEditor.from(diffRegion);
    const syntaxSpanLocator = editor.lines.locator('span[class]');
    await expect(syntaxSpanLocator.first()).toBeVisible();

    // Count spans with any class (syntax highlighting adds classes to spans)
    const syntaxSpansBefore = await syntaxSpanLocator.count();
    expect(syntaxSpansBefore).toBeGreaterThan(0);

    // Enable whitespace visibility using 'B' key
    await page.locator("body").click();
    await page.keyboard.press("b");

    // Verify whitespace indicators are visible (CodeMirror uses .cm-highlightSpace)
    await expect(editor.view.locator('.cm-highlightSpace').first()).toBeVisible();

    // After enabling whitespace visibility, syntax highlighting spans should still be present
    const syntaxSpansAfter = await editor.lines.locator('span[class]').count();
    expect(syntaxSpansAfter).toBeGreaterThan(0);

    // The count should be similar (whitespace toggle shouldn't remove syntax spans)
    // Allow some variance but ensure highlighting is preserved
    expect(syntaxSpansAfter).toBeGreaterThanOrEqual(syntaxSpansBefore * 0.8);
  });

  test("Change navigation works in virtualized diff (500+ lines)", async ({
    page,
  }) => {
    // Generate a large file with 600+ lines to trigger virtualization (threshold is 500)
    const generateLargeFile = () => {
      const lines: string[] = [];
      // Add header
      lines.push("@@ -1,300 +1,310 @@");
      // Add context lines, then a hunk of changes, repeat
      for (let i = 0; i < 60; i++) {
        // 10 context lines
        for (let j = 0; j < 10; j++) {
          lines.push(` // Context line ${i * 10 + j}`);
        }
        // Then a hunk of changes (deletion + addition)
        lines.push(`-const oldVar${String(i)} = ${String(i)};`);
        lines.push(`+const newVar${String(i)} = ${String(i + 100)};`);
      }
      return lines.join("\n");
    };

    const largePatch = generateLargeFile();

    // Override the mock to use the large file
    await page.route(
      "**/repos/test/repo/pulls/123/files*",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              sha: "abc123",
              filename: "src/large-file.ts",
              status: "modified",
              additions: 60,
              deletions: 60,
              changes: 120,
              patch: largePatch,
            },
          ]),
        });
      }
    );

    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Click on the large file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("large-file.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Get the toolbar
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    // Get navigation buttons
    const prevChangeButton = toolbar.getByRole("button", {
      name: /Previous change/i,
    });
    const nextChangeButton = toolbar.getByRole("button", {
      name: /Next change/i,
    });

    // Wait for hunk count to be calculated (buttons should be enabled)
    await expect(nextChangeButton).toBeEnabled();
    await expect(prevChangeButton).toBeDisabled();

    // Focus the page body for keyboard navigation
    await page.locator("body").click();

    // Press J to navigate to first change
    await page.keyboard.press("j");

    // After first J press, we should be at index 0
    // Prev should still be disabled (at start), Next should be enabled (many more hunks)
    await expect(prevChangeButton).toBeDisabled();
    await expect(nextChangeButton).toBeEnabled();

    // Press J a few more times to navigate through changes
    await page.keyboard.press("j");
    await page.keyboard.press("j");

    // Now we're at index 2, both buttons should be enabled
    await expect(prevChangeButton).toBeEnabled();
    await expect(nextChangeButton).toBeEnabled();

    // Press K to go back
    await page.keyboard.press("k");

    // Still both enabled (we're at index 1)
    await expect(prevChangeButton).toBeEnabled();
    await expect(nextChangeButton).toBeEnabled();

    // Go back to start
    await page.keyboard.press("k");

    // Now at index 0, prev disabled
    await expect(prevChangeButton).toBeDisabled();
    await expect(nextChangeButton).toBeEnabled();
  });
});
