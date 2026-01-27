import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

test.describe("Full file view for newly added files (Issue #195)", () => {
  const mockPR: MockPR = {
    id: 195,
    number: 195,
    title: "Add new file",
    body: "This PR adds a new file",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/new-file", sha: "head123" },
    base: { ref: "main", sha: "base456" },
    html_url: "https://github.com/test/repo/pull/195",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  // File that is newly added (status: 'added') - only has headContent, no baseContent
  const mockFiles: MockFile[] = [
    {
      filename: "e2e/fixtures/console-warnings.ts",
      status: "added",
      additions: 5,
      deletions: 0,
      changes: 5,
      patch:
        "@@ -0,0 +1,5 @@\n+// New utility file\n+export function suppressWarnings() {\n+  console.log('warnings suppressed');\n+}\n+",
      // No baseContent - file doesn't exist in base branch
      headContent: `// New utility file
export function suppressWarnings() {
  console.log('warnings suppressed');
}
`,
    },
  ];

  test("displays newly added file content without error in full file mode (default, Issue #195)", async ({
    page,
  }) => {
    // Mock mode only test

    await setupAuthState(page);
    await setupAuthMock(page);
    await setupFullPRMocks(page, "test", "repo", 195, {
      pr: mockPR,
      files: mockFiles,
    });

    await page.goto("/test/repo/195");
    await page.waitForLoadState("load");

    // Click on the newly added file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("console-warnings.ts").click();

    // Verify file is selected
    await expect(
      page.getByRole("heading", { name: "e2e/fixtures/console-warnings.ts" })
    ).toBeVisible();

    // Get the diff region and verify content is displayed
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Verify the file content is shown
    await expect(diffRegion.getByText("suppressWarnings")).toBeVisible();

    // Get the toolbar and verify full file mode is active (default)
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    const fileContentDropdown = toolbar.getByRole("button", {
      name: "File content",
    });
    await expect(fileContentDropdown).toBeVisible();

    // Verify default is Full File
    await expect(fileContentDropdown).toContainText("Full File");

    // KEY ASSERTION: No error banner should be displayed
    // The bug in Issue #195 shows "File not found at this version" error
    const errorBanner = page.locator(".diff-error-banner");
    await expect(errorBanner).toBeHidden();

    // Verify content is still visible (file was successfully loaded)
    await expect(diffRegion.getByText("suppressWarnings")).toBeVisible();
    await expect(diffRegion.getByText("warnings suppressed")).toBeVisible();
  });
});
