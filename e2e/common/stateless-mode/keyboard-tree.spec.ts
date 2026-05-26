import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("File explorer keyboard model (react-aria Tree)", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 700,
    title: "Tree keyboard fixture",
    body: "Body",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feat/tree", sha: "aaa" },
    base: { ref: "main", sha: "bbb" },
    html_url: "https://github.com/test/repo/pull/700",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/alpha.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "@@ -1 +1,2 @@\n line\n+added",
    },
    {
      filename: "src/beta.ts",
      status: "added",
      additions: 2,
      deletions: 0,
      changes: 2,
      patch: "@@ -0,0 +1,2 @@\n+a\n+b",
    },
  ];

  const config = isMockMode()
    ? { pageUrl: "/test/repo/700" }
    : {
        pageUrl: `/${prodModeConfig.testRepo.owner}/${prodModeConfig.testRepo.repo}/${String(prodModeConfig.testRepo.prNumber)}`,
      };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    if (isMockMode()) {
      await setupAuthState(page);
      await setupFullPRMocks(page, "test", "repo", 700, { pr: mockPR, files: mockFiles });
    }
  });

  test("ArrowDown moves between rows; Left collapses a folder; Right re-expands", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await expect(fileNav.getByRole("status", { name: "Loading files" })).toHaveCount(0);

    const tree = fileNav.getByRole("treegrid");
    await expect(tree).toBeVisible();

    const prDescription = fileNav.getByRole("row", { name: /Pull Request Description/i });
    await prDescription.focus();
    await page.keyboard.press("ArrowDown");

    const folderRow = fileNav.getByRole("row").nth(1);
    await expect(folderRow).toBeFocused();

    // Folders start expanded; Left collapses, Right re-expands.
    await page.keyboard.press("ArrowLeft");
    await expect(folderRow).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowRight");
    await expect(folderRow).toHaveAttribute("aria-expanded", "true");

    // After expansion, navigate to the first file row and confirm Enter selects it.
    await page.keyboard.press("ArrowDown");
    const firstFile = fileNav.getByRole("row", { name: /alpha\.ts/i });
    await expect(firstFile).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(firstFile).toHaveAttribute("aria-selected", "true");
  });
});
