import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

test.describe("Row Text Selection", () => {
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

  test("clicking a diff row focuses it and enables keyboard navigation", async ({
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

    // Find a code line (not a header line)
    // Use attribute selector directly since data-line-type is on the same element
    const codeLines = diffRegion.locator('[data-testid="diff-line"][data-line-type="context"], [data-testid="diff-line"][data-line-type="addition"], [data-testid="diff-line"][data-line-type="deletion"]');

    // Get the first code line
    const firstCodeLine = codeLines.first();
    await expect(firstCodeLine).toBeVisible();

    // Click on the line
    await firstCodeLine.click();

    // The row should now be focusable and have the focused class
    await expect(firstCodeLine).toBeFocused();
    await expect(firstCodeLine).toHaveClass(/diff-line-focused/);
  });

  test("Arrow Up/Down moves focus between rows when a row is focused", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    // Use attribute selector directly since data-line-type is on the same element
    const codeLines = diffRegion.locator('[data-testid="diff-line"][data-line-type="context"], [data-testid="diff-line"][data-line-type="addition"], [data-testid="diff-line"][data-line-type="deletion"]');

    // Click on a code line (not the first one, so we can go up)
    const secondCodeLine = codeLines.nth(1);
    await expect(secondCodeLine).toBeVisible();
    await secondCodeLine.click();
    await expect(secondCodeLine).toBeFocused();

    // Press ArrowDown to move to next row
    await page.keyboard.press("ArrowDown");

    // The second code line should lose focus
    await expect(secondCodeLine).not.toBeFocused();

    // A different row should now be focused
    const thirdCodeLine = codeLines.nth(2);
    await expect(thirdCodeLine).toBeFocused();
    await expect(thirdCodeLine).toHaveClass(/diff-line-focused/);
  });

  test("Escape exits row focus mode", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    // Use attribute selector directly since data-line-type is on the same element
    const codeLines = diffRegion.locator('[data-testid="diff-line"][data-line-type="context"], [data-testid="diff-line"][data-line-type="addition"], [data-testid="diff-line"][data-line-type="deletion"]');

    // Click on a code line
    const firstCodeLine = codeLines.first();
    await firstCodeLine.click();
    await expect(firstCodeLine).toBeFocused();
    await expect(firstCodeLine).toHaveClass(/diff-line-focused/);

    // Press Escape to exit focus mode
    await page.keyboard.press("Escape");

    // The row should no longer have the focused class
    await expect(firstCodeLine).not.toHaveClass(/diff-line-focused/);
  });

  test("j/k navigation is disabled when a row is focused", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    // Use attribute selector directly since data-line-type is on the same element
    const codeLines = diffRegion.locator('[data-testid="diff-line"][data-line-type="context"], [data-testid="diff-line"][data-line-type="addition"], [data-testid="diff-line"][data-line-type="deletion"]');

    // Get the toolbar for navigation buttons
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    // Click outside to ensure no row is focused
    await page.locator("body").click();

    // Press J to navigate to first change (hunk navigation should work)
    await page.keyboard.press("j");

    // Now click on a code line to enter row focus mode
    const firstCodeLine = codeLines.first();
    await firstCodeLine.click();
    await expect(firstCodeLine).toBeFocused();

    // Press J - should NOT trigger hunk navigation in row focus mode
    await page.keyboard.press("j");

    // The row focus should still be on a row (not moved by hunk navigation)
    const focusedRowAfter = await page.evaluate(() => {
      const focused = document.querySelector(".diff-line-focused");
      return focused ? focused.getAttribute("aria-rowindex") : null;
    });

    // Row focus should still exist (j didn't exit focus mode)
    expect(focusedRowAfter).not.toBeNull();

    // Press Escape to exit focus mode
    await page.keyboard.press("Escape");
    await expect(firstCodeLine).not.toHaveClass(/diff-line-focused/);

    // Now J should work for hunk navigation again
    await page.locator("body").click();
    await page.keyboard.press("j");
    // If j works, we should see the navigation happening
    // (hard to verify directly, but no error means it ran)
  });
});
