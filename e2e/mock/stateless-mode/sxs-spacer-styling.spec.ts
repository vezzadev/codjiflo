import { test } from "@playwright/test";
import { CMEditor, expect } from "../../fixtures/codemirror";
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

    // Switch to Side-by-Side view using 'X' keyboard shortcut.
    // Click a semantic app element first to ensure keyboard focus is in the app.
    await page.getByRole("main").click();
    await page.keyboard.press("x");

    // Verify we're in side-by-side mode
    await expect(
      page.getByRole("region", { name: "Side-by-side diff view" })
    ).toBeVisible();

    // Find spacer lines (cm-diff-line-spacer / data-line-type="spacer").
    // The decorations extension applies this class+attribute to spacer lines.
    // Left side: spacers opposite the additions that have no matching deletion.
    // Right side: no spacers because we have more additions than deletions.
    const editor = CMEditor.from(page);
    const spacerLines = editor.ext("diff", "lineSpacer");
    const spacerLineElement = spacerLines.first();
    await expect(spacerLineElement).toBeVisible();

    // Get the computed background color of a spacer line.
    const bgColor = await spacerLineElement.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Mock mode forces the light theme (e2e/fixtures/legacy-defaults.ts),
    // and the spacer line uses --diff-empty-line, which is #F6F8FA in the
    // light theme. So the computed background is deterministically the themed
    // gray, NOT white or transparent (the original SXS-gaps bug).
    expect(bgColor).toBe("rgb(246, 248, 250)");
  });
});
