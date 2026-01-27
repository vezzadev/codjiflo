import { test } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { CMEditor, expect } from "../../fixtures/codemirror";

test.describe("Search Match Highlighting", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 42,
    title: "Search Test PR",
    body: "Testing search highlighting",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/search", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/42",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/example.ts",
      status: "modified",
      additions: 3,
      deletions: 1,
      changes: 4,
      patch:
        "@@ -1,4 +1,6 @@\n const greeting = 'hello';\n-const farewell = 'goodbye';\n+const farewell = 'bye';\n+const morning = 'hello morning';\n+const evening = 'hello evening';",
      baseContent: "const greeting = 'hello';\nconst farewell = 'goodbye';",
      headContent:
        "const greeting = 'hello';\nconst farewell = 'bye';\nconst morning = 'hello morning';\nconst evening = 'hello evening';",
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 42,
    pageUrl: "/test/repo/42",
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("first match is automatically selected when typing search term", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);

    // Click on the file to show diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("example.ts").click();

    // Wait for diff to render
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    const editor = CMEditor.from(diffRegion);
    await expect(editor.view).toBeVisible();

    // Open search panel with Ctrl+F
    await page.keyboard.press("Control+f");

    // Wait for search panel to appear (using role=dialog)
    const searchPanel = page.getByRole("dialog", { name: /Find in diff/i });
    await expect(searchPanel).toBeVisible();

    // Search for "hello" which appears multiple times
    const searchInput = searchPanel.getByRole("textbox", {
      name: /Search term/i,
    });
    await searchInput.fill("hello");

    // Wait for match count to update (debounced at 150ms)
    const matchCount = searchPanel.getByRole("status");
    await expect(matchCount).toContainText("of 3");

    // BUG: After typing a search term, the first match should be automatically
    // selected (showing cm-searchMatch-selected) WITHOUT needing to press Enter.
    // This provides immediate visual feedback of the "current" position.
    const selectedMatch = editor.ext("search", "matchSelected");
    await expect(selectedMatch).toHaveCount(1);

    // The counter should show "1 of 3" immediately after typing
    await expect(matchCount).toHaveText("1 of 3");
  });

  test("search matches are highlighted with visible background color", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);

    // Click on the file to show diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("example.ts").click();

    // Wait for diff to render
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    const editor = CMEditor.from(diffRegion);
    await expect(editor.view).toBeVisible();

    // Open search panel with Ctrl+F
    await page.keyboard.press("Control+f");

    // Wait for search panel to appear (using role=dialog)
    const searchPanel = page.getByRole("dialog", { name: /Find in diff/i });
    await expect(searchPanel).toBeVisible();

    // Search for "hello" which appears multiple times
    const searchInput = searchPanel.getByRole("textbox", {
      name: /Search term/i,
    });
    await searchInput.fill("hello");

    // Wait for match count to update (debounced at 150ms)
    const matchCount = searchPanel.getByRole("status");
    await expect(matchCount).toContainText("of 3");

    // Verify search matches exist and have visible background
    const searchMatches = editor.ext("search", "match");
    await expect(searchMatches).toHaveCount(3);

    // Get the background color of the first match
    const matchBgColor = await searchMatches.first().evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });

    // The background should NOT be transparent (rgba(0, 0, 0, 0))
    // It should be a visible purple color
    expect(matchBgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(matchBgColor).not.toBe("transparent");

    // Navigate to first match (press Enter or click next)
    await searchInput.press("Enter");

    // The selected match should have a different (more prominent) style
    const selectedMatch = editor.ext("search", "matchSelected");
    await expect(selectedMatch).toHaveCount(1);

    const selectedBgColor = await selectedMatch.evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });

    // Selected match should also be visible (not transparent)
    expect(selectedBgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(selectedBgColor).not.toBe("transparent");
  });

  test("search highlight is distinct from diff addition color", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);

    // Click on the file to show diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("example.ts").click();

    // Wait for diff to render
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    const editor = CMEditor.from(diffRegion);
    await expect(editor.view).toBeVisible();

    // Get addition line background color (from an added line)
    const additionLine = editor.ext("diff", "lineAddition").first();
    await expect(additionLine).toBeVisible();
    const additionBgColor = await additionLine.evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });

    // Open search and find "hello"
    await page.keyboard.press("Control+f");
    const searchPanel = page.getByRole("dialog", { name: /Find in diff/i });
    await expect(searchPanel).toBeVisible();

    const searchInput = searchPanel.getByRole("textbox", {
      name: /Search term/i,
    });
    await searchInput.fill("hello");

    // Wait for matches
    const matchCount = searchPanel.getByRole("status");
    await expect(matchCount).toContainText("of 3");

    // Get search match background color
    const searchMatches = editor.ext("search", "match");
    const matchBgColor = await searchMatches.first().evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });

    // Search highlight should be different from addition background
    expect(matchBgColor).not.toBe(additionBgColor);
  });

  test("selected match highlight syncs with navigation counter", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);

    // Click on the file to show diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("example.ts").click();

    // Wait for diff to render
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    const editor = CMEditor.from(diffRegion);
    await expect(editor.view).toBeVisible();

    // Open search panel
    await page.keyboard.press("Control+f");
    const searchPanel = page.getByRole("dialog", { name: /Find in diff/i });
    await expect(searchPanel).toBeVisible();

    // Search for "hello" - 3 matches
    const searchInput = searchPanel.getByRole("textbox", {
      name: /Search term/i,
    });
    await searchInput.fill("hello");

    // Wait for matches to be found
    const matchCount = searchPanel.getByRole("status");
    await expect(matchCount).toContainText("of 3");

    // Get all match elements for position comparison
    const searchMatches = editor.ext("search", "match");
    await expect(searchMatches).toHaveCount(3);

    // Get the Y positions of all matches to identify them
    const matchPositions = await searchMatches.evaluateAll((elements) =>
      elements.map((el) => Math.round(el.getBoundingClientRect().top))
    );

    // Helper to get which match index is currently selected (0-indexed)
    // Assumes exactly 1 selected match exists (verified by expect before calling)
    const getSelectedMatchIndex = async () => {
      const selectedMatch = editor.ext("search", "matchSelected");
      await expect(selectedMatch).toHaveCount(1);
      const selectedTop = await selectedMatch.evaluate((el) =>
        Math.round(el.getBoundingClientRect().top)
      );
      return matchPositions.findIndex((pos) => pos === selectedTop);
    };

    // First match is automatically selected after typing (no Enter needed)
    await expect(matchCount).toHaveText("1 of 3");
    expect(await getSelectedMatchIndex()).toBe(0);

    // Navigate to second match (Enter)
    await searchInput.press("Enter");
    await expect(matchCount).toHaveText("2 of 3");
    expect(await getSelectedMatchIndex()).toBe(1);

    // Navigate to third match (Enter)
    await searchInput.press("Enter");
    await expect(matchCount).toHaveText("3 of 3");
    expect(await getSelectedMatchIndex()).toBe(2);

    // Wrap around to first match (Enter)
    await searchInput.press("Enter");
    await expect(matchCount).toHaveText("1 of 3");
    expect(await getSelectedMatchIndex()).toBe(0);

    // Navigate backwards with Shift+Enter
    await searchInput.press("Shift+Enter");
    await expect(matchCount).toHaveText("3 of 3");
    expect(await getSelectedMatchIndex()).toBe(2);
  });
});
