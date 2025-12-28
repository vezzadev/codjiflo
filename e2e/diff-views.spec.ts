import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "./fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "./fixtures/github-mocks";

test.describe("Diff View Modes (S-3.2, S-3.3, S-3.5)", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Feature: Advanced Diff Views",
    body: "Testing diff view modes",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/diff-views", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    html_url: "https://github.com/test/repo/pull/123",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/example.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      changes: 3,
      patch:
        "@@ -1,3 +1,4 @@\n const foo = 'bar';\n-const old = true;\n+const new1 = true;\n+const new2 = false;",
    },
  ];

  const getTestConfig = () => {
    if (isMockMode()) {
      return {
        owner: "test",
        repo: "repo",
        prNumber: 123,
        pageUrl: "/pr/test/repo/123",
      };
    }
    const { owner, repo, prNumber } = prodModeConfig.testRepo;
    return {
      owner,
      repo,
      prNumber,
      pageUrl: `/pr/${owner}/${repo}/${String(prNumber)}`,
    };
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    const config = getTestConfig();
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("View mode toggles between Unified and Split (S-3.3)", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("networkidle");

    // Click on a file to show diff (PR description is default)
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 30000 });

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible({ timeout: 15000 });

      // [AC-3.3.1] Unified mode should be default - find buttons in view mode group
      const viewModeGroup = page.getByRole("group", { name: "View mode" });
      await expect(viewModeGroup).toBeVisible({ timeout: 10000 });

      const unifiedButton = viewModeGroup.getByRole("button", {
        name: /Unified/i,
      });
      const splitButton = viewModeGroup.getByRole("button", { name: /Split/i });

      await expect(unifiedButton).toBeVisible();
      await expect(splitButton).toBeVisible();

      // [AC-3.3.2] Active mode should be visually highlighted
      await expect(unifiedButton).toHaveAttribute("aria-pressed", "true");

      // [AC-3.2.1] Switch to Split view
      await splitButton.click();
      await expect(splitButton).toHaveAttribute("aria-pressed", "true");

      // [AC-3.2.8-9] Split view should have accessible labels
      await expect(
        page.getByRole("region", { name: "Side-by-side diff view" })
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("region", { name: "Original version" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Modified version" })
      ).toBeVisible();

      // Switch back to Unified
      await unifiedButton.click();
      await expect(unifiedButton).toHaveAttribute("aria-pressed", "true");
    } else {
      // Prod mode: verify structure
      const fileButtons = fileNav.getByRole("button");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible({ timeout: 30000 });
      }
    }
  });

  test("Keyboard shortcuts for view modes (S-3.3)", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 30000 });

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible({ timeout: 15000 });

      const viewModeGroup = page.getByRole("group", { name: "View mode" });
      await expect(viewModeGroup).toBeVisible({ timeout: 10000 });

      const unifiedButton = viewModeGroup.getByRole("button", {
        name: /Unified/i,
      });
      const splitButton = viewModeGroup.getByRole("button", { name: /Split/i });

      // Focus on page body
      await page.locator("body").click();
      await page.waitForTimeout(300);

      // [AC-3.3.4] Press 's' for Split
      await page.keyboard.press("s");
      await page.waitForTimeout(200);
      await expect(splitButton).toHaveAttribute("aria-pressed", "true", {
        timeout: 5000,
      });

      // [AC-3.3.4] Press 'u' for Unified
      await page.keyboard.press("u");
      await page.waitForTimeout(200);
      await expect(unifiedButton).toHaveAttribute("aria-pressed", "true", {
        timeout: 5000,
      });
    } else {
      // Prod mode: skip keyboard shortcuts test (real PR may have modal conflicts)
      test.skip(true, "Keyboard shortcuts tested in mock mode only");
    }
  });

  test("Content filter toggles (Left/Both/Right) (S-3.3)", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 30000 });

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible({ timeout: 15000 });

      // Switch to Split for content filter to be visible
      const viewModeGroup = page.getByRole("group", { name: "View mode" });
      await expect(viewModeGroup).toBeVisible({ timeout: 10000 });
      const splitButton = viewModeGroup.getByRole("button", { name: /Split/i });
      await splitButton.click();
      await expect(splitButton).toHaveAttribute("aria-pressed", "true");

      // [AC-3.3.5-7] Content filter buttons (only visible in split mode)
      const contentFilterGroup = page.getByRole("group", {
        name: "Content filter",
      });
      await expect(contentFilterGroup).toBeVisible({ timeout: 10000 });

      const leftButton = contentFilterGroup.getByRole("button", {
        name: /Left/i,
      });
      const bothButton = contentFilterGroup.getByRole("button", {
        name: /Both/i,
      });
      const rightButton = contentFilterGroup.getByRole("button", {
        name: /Right/i,
      });

      // [AC-3.3.7] Both is default
      await expect(bothButton).toHaveAttribute("aria-pressed", "true");

      // [AC-3.3.6] Left Only - hides right pane
      await leftButton.click();
      await expect(leftButton).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("region", { name: "Original version" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Modified version" })
      ).not.toBeVisible();

      // [AC-3.3.8] Right Only - hides left pane
      await rightButton.click();
      await expect(rightButton).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("region", { name: "Modified version" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Original version" })
      ).not.toBeVisible();

      // Back to Both
      await bothButton.click();
      await expect(
        page.getByRole("region", { name: "Original version" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Modified version" })
      ).toBeVisible();
    } else {
      // Prod mode: verify structure
      const fileButtons = fileNav.getByRole("button");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible({ timeout: 30000 });
      }
    }
  });

  test("Whitespace toggle is visible and functional (S-3.5)", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 30000 });

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible({ timeout: 15000 });

      // [AC-3.5.4] Whitespace toggle in toolbar - find by aria-label pattern
      const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
      await expect(toolbar).toBeVisible({ timeout: 10000 });

      // Whitespace button uses aria-label "Hide whitespace changes" or "Show whitespace changes"
      const whitespaceButton = toolbar.getByRole("button", {
        name: /whitespace/i,
      });
      await expect(whitespaceButton).toBeVisible({ timeout: 10000 });

      // [AC-3.5.5] Toggle state indicator - starts off (WS visible)
      await expect(whitespaceButton).toHaveAttribute("aria-pressed", "false");

      // Toggle on (hide whitespace)
      await whitespaceButton.click();
      await expect(whitespaceButton).toHaveAttribute("aria-pressed", "true");

      // Toggle off (show whitespace)
      await whitespaceButton.click();
      await expect(whitespaceButton).toHaveAttribute("aria-pressed", "false");
    } else {
      // Prod mode: verify structure
      const fileButtons = fileNav.getByRole("button");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible({ timeout: 30000 });
      }
    }
  });

  test("Side-by-side view accessibility (S-3.2)", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("networkidle");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible({ timeout: 30000 });

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible({ timeout: 15000 });

      // Switch to Split view
      const viewModeGroup = page.getByRole("group", { name: "View mode" });
      await expect(viewModeGroup).toBeVisible({ timeout: 10000 });
      await viewModeGroup.getByRole("button", { name: /Split/i }).click();

      // [AC-3.2.8] Screen reader can move between panes
      const leftPane = page.getByRole("region", { name: "Original version" });
      const rightPane = page.getByRole("region", { name: "Modified version" });

      await expect(leftPane).toBeVisible({ timeout: 10000 });
      await expect(rightPane).toBeVisible();

      // [AC-3.2.9] Aria labels correctly set
      await expect(leftPane).toHaveAttribute("aria-label", "Original version");
      await expect(rightPane).toHaveAttribute("aria-label", "Modified version");

      // [AC-3.2.2-3] Left shows base, right shows head content
      // Verify the panes contain content (visual check)
      await expect(leftPane.locator("table")).toBeVisible();
      await expect(rightPane.locator("table")).toBeVisible();
    } else {
      // Prod mode: verify structure
      const fileButtons = fileNav.getByRole("button");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible({ timeout: 30000 });
      }
    }
  });
});
