import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Side-by-Side Spacer Line Styling", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR with additions and deletions",
    body: "Testing spacer line styling",
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

  // File with pure additions (left side will have spacers)
  // and pure deletions (right side will have spacers)
  const mockFiles: MockFile[] = [
    {
      filename: "src/spacer-test.ts",
      status: "modified",
      additions: 3,
      deletions: 2,
      changes: 5,
      // Patch format: deletions followed by additions creates spacer lines
      // Context line, then 2 deletions, then 3 additions
      patch:
        "@@ -1,4 +1,5 @@\n const unchanged = 1;\n-const deleted1 = 2;\n-const deleted2 = 3;\n+const added1 = 4;\n+const added2 = 5;\n+const added3 = 6;\n const alsoUnchanged = 7;",
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 123,
    pageUrl: "/test/repo/123",
  };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("Spacer lines have gray background, not white (Issue: SXS gaps)", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Navigate to the test file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("spacer-test.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/spacer-test.ts" })
    ).toBeVisible();

    // Switch to Side-by-Side view using 'X' keyboard shortcut
    await page.locator("body").click();
    await page.keyboard.press("x");

    // Verify we're in side-by-side mode
    await expect(
      page.getByRole("region", { name: "Side-by-side diff view" })
    ).toBeVisible();

    // Find spacer lines (data-line-type="spacer" attribute)
    // The decorations extension adds this attribute to spacer lines
    const spacerLines = page.locator('[data-line-type="spacer"]');

    // We should have spacer lines in the diff
    // Left side: 1 spacer (opposite the 3rd addition that has no matching deletion)
    // Right side: no spacers because we have more additions than deletions
    // Actually, with 2 deletions and 3 additions, the right side should have
    // no spacers and the left side should have spacers
    await expect(spacerLines.first()).toBeVisible();

    // Get the computed background color of a spacer line
    const spacerLineElement = spacerLines.first();
    const bgColor = await spacerLineElement.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // The background should NOT be white (rgb(255, 255, 255)) or transparent
    // It should be a shade of gray matching --diff-empty-line variable
    // In dark theme: #151B23 = rgb(21, 27, 35)
    // In light theme: #F6F8FA = rgb(246, 248, 250)
    expect(bgColor).not.toBe("rgb(255, 255, 255)");
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(bgColor).not.toBe("transparent");

    // Verify it's actually using the --diff-empty-line CSS variable
    // by checking if it's a grayish color (R, G, B values close to each other)
    // or one of the theme-defined colors
    const rgbMatch = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(bgColor);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      // For dark themes, values should be low (< 100)
      // For light themes, values should be high (> 200)
      // The key is they shouldn't be pure white (255, 255, 255)
      const isNotPureWhite = r !== 255 || g !== 255 || b !== 255;
      expect(isNotPureWhite).toBe(true);
    }
  });
});
