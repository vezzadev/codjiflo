import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

test.describe("File List Sorting", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR with multiple files",
    body: "Testing file list sorting",
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

  // Files deliberately in unsorted order to test sorting
  const mockFiles: MockFile[] = [
    {
      filename: "src/zebra.ts",
      status: "modified",
      additions: 5,
      deletions: 2,
      changes: 7,
      patch: "@@ -1,2 +1,5 @@\n-old\n+new",
    },
    {
      filename: "src/alpha.ts",
      status: "added",
      additions: 10,
      deletions: 0,
      changes: 10,
      patch: "@@ -0,0 +1,10 @@\n+new file",
    },
    {
      filename: "README.md",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: "@@ -1 +1 @@\n-old\n+new",
    },
    {
      filename: "package.json",
      status: "modified",
      additions: 2,
      deletions: 1,
      changes: 3,
      patch: "@@ -1,1 +1,2 @@\n-v1\n+v2",
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

  test("files are displayed in alphabetical order", async ({ page }) => {
    await page.goto(config.pageUrl);

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Get all file items (excluding PR Description which is always first)
    const fileItems = fileNav.getByRole("listitem");

    // Wait for files to load - should have PR Description + 4 files = 5 items
    await expect(fileItems).toHaveCount(5);

    // Verify files are in alphabetical order (case-insensitive: p < r < s)
    // PR Description is first, then sorted files
    const itemTexts = await fileItems.allTextContents();

    // Extract just the filenames (items contain filename + stats)
    expect(itemTexts[0]).toContain("Pull Request Description");
    expect(itemTexts[1]).toContain("package.json");
    expect(itemTexts[2]).toContain("README.md");
    expect(itemTexts[3]).toContain("src/alpha.ts");
    expect(itemTexts[4]).toContain("src/zebra.ts");
  });
});
