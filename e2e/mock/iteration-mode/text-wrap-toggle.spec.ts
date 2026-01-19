import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "../../fixtures/mode";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

test.describe("Text Wrap Toggle", () => {
  // Create a file with very long lines to test word wrap behavior
  const longLine =
    "const veryLongVariableName = 'This is an extremely long string that will definitely extend beyond the viewport width and needs to wrap when word wrap is enabled because it keeps going and going and going for testing purposes';";

  const mockPR: MockPR = {
    id: 1,
    number: 789,
    title: "Test: Text Wrap Toggle",
    body: "Testing text wrap toggle behavior",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/wrap-test", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/789",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/long-lines.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      changes: 3,
      patch: `@@ -1,3 +1,4 @@
 const short = 'value';
-const old = 'removed';
+${longLine}
+const another = 'line';
 const unchanged = 'end';`,
    },
  ];

  const getTestConfig = () => {
    if (isMockMode()) {
      return {
        owner: "test",
        repo: "repo",
        prNumber: 789,
        pageUrl: "/test/repo/789",
      };
    }
    const { owner, repo, prNumber } = prodModeConfig.testRepo;
    return {
      owner,
      repo,
      prNumber,
      pageUrl: `/${owner}/${repo}/${String(prNumber)}`,
    };
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    await setupAuthMock(page);
    const config = getTestConfig();
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });

    // Mock iteration artifact comment for iteration selector to appear
    if (isMockMode()) {
      await page.route(
        `**/repos/${config.owner}/${config.repo}/issues/${String(config.prNumber)}/comments*`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                id: 1,
                body: `<!-- codjiflo-data -->
Artifact ID: 12345
Run ID: 67890
Iterations: 2`,
                user: { login: "github-actions[bot]" },
                created_at: "2024-01-01T10:00:00Z",
              },
            ]),
          });
        }
      );
    }
  });

  test("Text wrap toggle button cycles between wrap states", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("long-lines.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/long-lines.ts" })
    ).toBeVisible();

    // Get the diff toolbar
    const diffToolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(diffToolbar).toBeVisible();

    // Find the text wrap dropdown button
    const textWrapButton = diffToolbar.getByRole("button", { name: /Text wrap/i });
    await expect(textWrapButton).toBeVisible();

    // Initial state should be "No Wrap" (default)
    await expect(textWrapButton.getByText(/No Wrap/i)).toBeVisible();

    // Click to open dropdown and select "Wrap"
    await textWrapButton.click();
    const wrapOption = page.getByRole("option", { name: /^Wrap$/i });
    await expect(wrapOption).toBeVisible();
    await wrapOption.click();

    // Button should now show "Wrap"
    await expect(textWrapButton.getByText(/^Wrap$/i)).toBeVisible();

    // Click to open dropdown and select "No Wrap"
    await textWrapButton.click();
    const noWrapOption = page.getByRole("option", { name: /No Wrap/i });
    await expect(noWrapOption).toBeVisible();
    await noWrapOption.click();

    // Button should now show "No Wrap"
    await expect(textWrapButton.getByText(/No Wrap/i)).toBeVisible();
  });

  test("Keyboard shortcut P toggles text wrap", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("long-lines.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/long-lines.ts" })
    ).toBeVisible();

    // Get the diff toolbar
    const diffToolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(diffToolbar).toBeVisible();

    // Find the text wrap dropdown button
    const textWrapButton = diffToolbar.getByRole("button", { name: /Text wrap/i });
    await expect(textWrapButton).toBeVisible();

    // Initial state should be "No Wrap"
    await expect(textWrapButton.getByText(/No Wrap/i)).toBeVisible();

    // Press P to toggle to wrap
    await page.keyboard.press("p");

    // Button should now show "Wrap"
    await expect(textWrapButton.getByText(/^Wrap$/i)).toBeVisible();

    // Press P again to toggle back to nowrap
    await page.keyboard.press("p");

    // Button should now show "No Wrap"
    await expect(textWrapButton.getByText(/No Wrap/i)).toBeVisible();
  });

  test("Word wrap applies CSS class to diff code elements", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("long-lines.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/long-lines.ts" })
    ).toBeVisible();

    // Check initial state - no word-wrap class
    const diffCodeWithoutWrap = await page.evaluate(() => {
      const codes = document.querySelectorAll(".diff-code");
      return Array.from(codes).some((el) => el.classList.contains("word-wrap"));
    });
    expect(diffCodeWithoutWrap).toBe(false);

    // Press P to enable wrap
    await page.keyboard.press("p");

    // Check that word-wrap class is applied
    const diffCodeWithWrap = await page.evaluate(() => {
      const codes = document.querySelectorAll(".diff-code");
      return (
        codes.length > 0 &&
        Array.from(codes).every((el) => el.classList.contains("word-wrap"))
      );
    });
    expect(diffCodeWithWrap).toBe(true);

    // Press P to disable wrap
    await page.keyboard.press("p");

    // Check that word-wrap class is removed
    const diffCodeAfterDisable = await page.evaluate(() => {
      const codes = document.querySelectorAll(".diff-code");
      return Array.from(codes).some((el) => el.classList.contains("word-wrap"));
    });
    expect(diffCodeAfterDisable).toBe(false);
  });

  test("Data attribute is set on diff container for CSS targeting", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click on the file with long lines
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("long-lines.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/long-lines.ts" })
    ).toBeVisible();

    // Check initial data attribute on the diff content area
    const initialAttr = await page.evaluate(() => {
      const container = document.querySelector(".diff-content-area");
      return container?.getAttribute("data-text-wrap");
    });
    expect(initialAttr).toBe("nowrap");

    // Press P to enable wrap
    await page.keyboard.press("p");

    // Check data attribute changed
    const wrapAttr = await page.evaluate(() => {
      const container = document.querySelector(".diff-content-area");
      return container?.getAttribute("data-text-wrap");
    });
    expect(wrapAttr).toBe("wrap");
  });
});
