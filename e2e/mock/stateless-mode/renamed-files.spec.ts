import { test } from "@playwright/test";
import { CMEditor, expect } from "../../fixtures/codemirror";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Renamed Files (Issue #349)", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 349,
    title: "Rename directory structure",
    body: "Renames degraded-mode to stateless-mode",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/rename", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/349",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "e2e/stateless-mode/app.spec.ts",
      status: "renamed",
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: "",
    },
    {
      filename: "e2e/stateless-mode/auth.spec.ts",
      status: "renamed",
      additions: 5,
      deletions: 3,
      changes: 8,
      patch: "@@ -1,3 +1,5 @@\n import { test } from '@playwright/test';\n-import { oldHelper } from './old-helpers';\n+import { newHelper } from './new-helpers';\n+import { extraHelper } from './extra';\n test('auth works', () => {",
    },
    {
      filename: "src/utils.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      changes: 3,
      patch: "@@ -1,3 +1,4 @@\n export function helper() {\n-  return 'old';\n+  return 'new';\n+  // updated\n }",
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, "test", "repo", 349, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("renamed files show R badge instead of A badge", async ({ page }) => {
    await page.goto("/test/repo/349");
    await page.waitForLoadState("domcontentloaded");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Pure renamed file should show R badge
    const pureRenamedItem = fileNav.getByRole("treeitem", { name: /app\.spec\.ts/ });
    await expect(pureRenamedItem).toBeVisible();
    await expect(pureRenamedItem.getByText("R")).toBeVisible();

    // Renamed+edited file should also show R badge
    const editedRenamedItem = fileNav.getByRole("treeitem", { name: /auth\.spec\.ts/ });
    await expect(editedRenamedItem).toBeVisible();
    await expect(editedRenamedItem.getByText("R")).toBeVisible();

    // Modified file should show M badge
    const modifiedItem = fileNav.getByRole("treeitem", { name: /utils\.ts/ });
    await expect(modifiedItem).toBeVisible();
    await expect(modifiedItem.getByText("M")).toBeVisible();
  });

  test("pure renamed file renders diff page without 'no diff available'", async ({ page }) => {
    await page.goto("/test/repo/349");
    await page.waitForLoadState("domcontentloaded");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Click the pure renamed file (0 additions, 0 deletions)
    await fileNav.getByText("app.spec.ts").click();

    // Should NOT show "No diff available" or "binary file" message
    await expect(page.getByText(/No diff available/i)).toBeHidden();
    await expect(page.getByText(/binary file/i)).toBeHidden();

    // Should render the diff view container with toolbar
    const diffToolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(diffToolbar).toBeVisible();

    // Should show the filename in the header
    await expect(page.getByRole("heading", { name: /app\.spec\.ts/i })).toBeVisible();
  });

  test("renamed+edited file renders diff with changes", async ({ page }) => {
    await page.goto("/test/repo/349");
    await page.waitForLoadState("domcontentloaded");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    // Click the renamed+edited file
    await fileNav.getByText("auth.spec.ts").click();

    // Should render the diff view with toolbar
    const diffToolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(diffToolbar).toBeVisible();

    // Should show the filename
    await expect(page.getByRole("heading", { name: /auth\.spec\.ts/i })).toBeVisible();

    // Should show the diff content (CodeMirror editor)
    const editor = CMEditor.from(page);
    await expect(editor.view).toBeVisible();
  });
});
