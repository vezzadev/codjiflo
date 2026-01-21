import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

/**
 * Reproduction test for gutter line number bug.
 *
 * Bug: In inline mode with 'both' filter (default), the gutter shows two columns
 * (left and right line numbers). According to the spec, it should only show
 * the right (new) line numbers in a single column.
 *
 * Spec reference (spec/functional/diff-viewing.md):
 * | Filter Mode | Line Numbers Shown |
 * |-------------|-------------------|
 * | **Both** | New (right) line numbers only |
 * | **Left** | Old (left) line numbers |
 * | **Right** | New (right) line numbers |
 */
test.describe("Inline mode gutter line numbers", () => {
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

  const mockFile: MockFile = {
    filename: "src/example.ts",
    status: "modified",
    additions: 2,
    deletions: 1,
    changes: 3,
    patch:
      "@@ -1,4 +1,5 @@\n const x = 1;\n-const oldY = 2;\n+const newY = 3;\n+const z = 4;\n // comment",
  };

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
      files: [mockFile],
    });
  });

  // Helper to navigate to file and wait for diff to render
  async function navigateToFile(page: import("@playwright/test").Page) {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Click on the file in the file list to view its diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("example.ts").click();

    // Wait for diff to render
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();
    return diffRegion;
  }

  // Helper to count gutter columns in a regular (non-spacer, non-header) line
  async function getGutterColumnCounts(page: import("@playwright/test").Page) {
    return page.evaluate(() => {
      const wrappers = document.querySelectorAll(".cm-diff-gutter-wrapper");
      if (wrappers.length === 0) return { total: 0, leftCount: 0, rightCount: 0 };

      // Find a regular line wrapper (skip spacers with "9999" and headers)
      for (const wrapper of wrappers) {
        // Skip headers (have cm-diff-gutter-header class)
        if (wrapper.classList.contains("cm-diff-gutter-header")) continue;

        // Skip spacers (contain "9999" text)
        if ((wrapper.textContent || "").includes("9999")) continue;

        const leftCols = wrapper.querySelectorAll(".cm-diff-gutter-left").length;
        const rightCols = wrapper.querySelectorAll(".cm-diff-gutter-right").length;
        if (leftCols > 0 || rightCols > 0) {
          return { total: wrappers.length, leftCount: leftCols, rightCount: rightCols };
        }
      }
      return { total: wrappers.length, leftCount: 0, rightCount: 0 };
    });
  }

  test("gutter shows only right line numbers in inline mode with 'both' filter", async ({
    page,
  }) => {
    await navigateToFile(page);

    const gutterStats = await getGutterColumnCounts(page);
    expect(gutterStats.total).toBeGreaterThan(0);

    // According to spec: 'both' filter should show only right (new) line numbers
    // So we expect 0 left columns and 1 right column
    expect(gutterStats.leftCount).toBe(0);
    expect(gutterStats.rightCount).toBe(1);
  });

  test("gutter shows only left line numbers when filter is 'left'", async ({
    page,
  }) => {
    await navigateToFile(page);

    // Press 'L' to set filter to left
    await page.locator("body").click();
    await page.keyboard.press("l");

    // Wait for filter to be applied (check the radio button is selected)
    await expect(page.getByRole("radio", { name: "Left Only" })).toBeChecked();

    const gutterStats = await getGutterColumnCounts(page);
    expect(gutterStats.total).toBeGreaterThan(0);

    // When filter is 'left', should show only left (old) line numbers
    expect(gutterStats.leftCount).toBe(1);
    expect(gutterStats.rightCount).toBe(0);
  });

  test("gutter shows only right line numbers when filter is 'right'", async ({
    page,
  }) => {
    await navigateToFile(page);

    // Press 'R' to set filter to right
    await page.locator("body").click();
    await page.keyboard.press("r");

    // Wait for filter to be applied
    await expect(page.getByRole("radio", { name: "Right Only" })).toBeChecked();

    const gutterStats = await getGutterColumnCounts(page);
    expect(gutterStats.total).toBeGreaterThan(0);

    // When filter is 'right', should show only right (new) line numbers
    expect(gutterStats.leftCount).toBe(0);
    expect(gutterStats.rightCount).toBe(1);
  });
});
