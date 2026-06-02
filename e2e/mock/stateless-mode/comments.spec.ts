import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
  type MockComment,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Inline comments flow (S-2.x)", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Review: inline comments",
    body: "Sample PR for comment testing",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/comments", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/123",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/example.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "@@ -1,1 +1,2 @@\n const foo = 'bar';\n+const added = true;",
    },
  ];

  const mockComments: MockComment[] = [
    {
      id: 999,
      body: "Please add a quick note about this flag.",
      user: {
        id: 2,
        login: "reviewer",
        avatar_url: "https://avatars.githubusercontent.com/u/2",
      },
      created_at: "2024-01-02T12:00:00Z",
      updated_at: "2024-01-02T12:00:00Z",
      path: "src/example.ts",
      line: 2,
      side: "RIGHT",
      position: 2,
      original_line: 2,
      original_commit_id: "abc123",
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
    // Set up authentication state
    await setupAuthState(page);

    // Set up mocks
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
      comments: mockComments,
    });
  });

  test("shows existing threads and allows adding a comment", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Wait for page to fully stabilize
    await page.waitForLoadState("load");

    // Wait for the file navigation to be fully loaded
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await expect(fileNav.getByText("example.ts")).toBeVisible();

    // PR Description is selected by default, click on the file to show diff
    await fileNav.getByText("example.ts").click();

    // Wait for page to load - check the diff heading as a stable indicator
    await expect(page.getByRole("heading", { name: "src/example.ts" })).toBeVisible();

    // Wait for the file list item to be visible and selected
    const fileListItem = page.getByRole("row", { name: /example\.ts/ });
    await expect(fileListItem).toBeVisible();
    await expect(fileListItem).toHaveAttribute("aria-selected", "true");

    // The diff content should be rendered in CodeMirror
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Verify the existing comment is displayed (comments load async)
    const threadRegion = page.getByRole("region", { name: "Thread on line 2 (added line)" });
    await expect(
      threadRegion.getByText("Please add a quick note about this flag.", { exact: true }),
    ).toBeVisible();
  });
});
