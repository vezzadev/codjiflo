import { test } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { CMEditor, expect } from "../../fixtures/codemirror";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Diff Area Theme Background", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 42,
    title: "Theme Test PR",
    body: "Testing theme backgrounds",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/theme", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/42",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/test.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      changes: 3,
      patch: "@@ -1,3 +1,4 @@\n const x = 1;\n-const y = 2;\n+const y = 3;\n+const z = 4;",
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 42,
    pageUrl: "/test/repo/42",
  };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("diff editor background honors dark theme", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Click on the file to show diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("test.ts").click();

    // Wait for diff to render
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    // Wait for CodeMirror editor to be present
    const editor = CMEditor.from(diffRegion);
    await expect(editor.view).toBeVisible();

    // Get initial background color
    // Color depends on the default diffColorScheme (now 'codeflow-classic')
    // CodeFlow Classic uses white background: #ffffff = rgb(255, 255, 255)
    const initialBg = await editor.view.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(initialBg).toBe("rgb(255, 255, 255)");

    // Open appearance settings
    await page.getByRole("button", { name: "Appearance Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Appearance Settings" });
    await expect(dialog).toBeVisible();

    // Switch to dark theme (use exact match to avoid ambiguity)
    await dialog.getByRole("radio", { name: "Dark", exact: true }).click();
    await dialog.getByRole("button", { name: "Close" }).click();

    // Verify background changed to dark theme color
    const darkBg = await editor.view.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Dark theme should be #313131 = rgb(49, 49, 49)
    expect(darkBg).toBe("rgb(49, 49, 49)");
  });

  test("diff editor background honors black theme", async ({ page }) => {
    await page.goto(config.pageUrl);

    // Click on the file to show diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("test.ts").click();

    // Wait for diff to render
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    const editor = CMEditor.from(diffRegion);
    await expect(editor.view).toBeVisible();

    // Open appearance settings and switch to black theme
    await page.getByRole("button", { name: "Appearance Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Appearance Settings" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("radio", { name: "Black" }).click();
    await dialog.getByRole("button", { name: "Close" }).click();

    // Verify background changed to black theme color
    const blackBg = await editor.view.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Black theme should be #0f0f0f = rgb(15, 15, 15)
    expect(blackBg).toBe("rgb(15, 15, 15)");
  });

  test("diff editor background honors high contrast theme", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);

    // Click on the file to show diff
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("test.ts").click();

    // Wait for diff to render
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();

    const editor = CMEditor.from(diffRegion);
    await expect(editor.view).toBeVisible();

    // Open appearance settings and switch to high contrast theme
    await page.getByRole("button", { name: "Appearance Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Appearance Settings" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("radio", { name: "High Contrast", exact: true }).click();
    await dialog.getByRole("button", { name: "Close" }).click();

    // Verify background changed to high contrast theme color
    const hcBg = await editor.view.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // High contrast theme should be #000000 = rgb(0, 0, 0)
    expect(hcBg).toBe("rgb(0, 0, 0)");
  });
});
