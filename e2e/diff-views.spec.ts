import { test, expect } from "@playwright/test";
import { isMockMode, prodModeConfig } from "./fixtures/mode";
import {
  setupAuthState,
  setupAuthMock,
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
      // Full file content for testing full file toggle
      baseContent: `const foo = 'bar';
const old = true;
const baz = 'qux';
// This is line 4
// This is line 5
// This is line 6
// End of file`,
      headContent: `const foo = 'bar';
const new1 = true;
const new2 = false;
const baz = 'qux';
// This is line 5
// This is line 6
// This is line 7
// End of file`,
    },
  ];

  const getTestConfig = () => {
    if (isMockMode()) {
      return {
        owner: "test",
        repo: "repo",
        prNumber: 123,
        pageUrl: "/test/repo/123",
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
  });

  test("View mode toggles between Inline and Split (S-3.3)", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Click on a file to show diff (PR description is default)
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible();

      // [AC-3.3.1] Inline mode should be default - single toggle button shows "Inline"
      const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
      await expect(toolbar).toBeVisible();

      const viewModeButton = toolbar.getByRole("button", {
        name: /switch to side-by-side view/i,
      });
      await expect(viewModeButton).toBeVisible();
      await expect(viewModeButton).toContainText("Inline");

      // [AC-3.2.1] Switch to Split view by clicking the toggle
      await viewModeButton.click();

      // Now button should show SxS and offer to switch to inline
      const inlineButton = toolbar.getByRole("button", {
        name: /switch to inline view/i,
      });
      await expect(inlineButton).toBeVisible();
      await expect(inlineButton).toContainText("SxS");

      // [AC-3.2.8-9] Split view should have accessible labels
      await expect(
        page.getByRole("region", { name: "Side-by-side diff view" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Original version" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Modified version" })
      ).toBeVisible();

      // Switch back to Inline
      await inlineButton.click();
      await expect(
        toolbar.getByRole("button", { name: /switch to side-by-side view/i })
      ).toContainText("Inline");
    } else {
      // Prod mode: verify structure
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible();
      }
    }
  });

  test("Keyboard shortcuts for view modes (S-3.3)", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible();

      const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
      await expect(toolbar).toBeVisible();

      // Focus on page body
      await page.locator("body").click();

      // [AC-3.3.4] Press 'x' for Split - button should now show SxS
      await page.keyboard.press("x");
      await expect(
        toolbar.getByRole("button", { name: /switch to inline view/i })
      ).toContainText("SxS");

      // [AC-3.3.4] Press 'i' for Inline - button should now show Inline
      await page.keyboard.press("i");
      await expect(
        toolbar.getByRole("button", { name: /switch to side-by-side view/i })
      ).toContainText("Inline");
    } else {
      // Prod mode: skip keyboard shortcuts test (real PR may have modal conflicts)
      test.skip(true, "Keyboard shortcuts tested in mock mode only");
    }
  });

  test("Content filter toggles (Left/Both/Right) (S-3.3)", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible();

      const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
      await expect(toolbar).toBeVisible();

      // Switch to Split view using keyboard shortcut
      await page.locator("body").click();
      await page.keyboard.press("x");

      // [AC-3.3.5-7] Content filter radiogroup should be visible
      const contentFilter = toolbar.getByRole("radiogroup", {
        name: "Content filter",
      });
      await expect(contentFilter).toBeVisible();

      // [AC-3.3.7] Both is default - check the radio label
      const currentRadio = contentFilter.getByRole("radio");
      await expect(currentRadio).toHaveAttribute("aria-label", "Show Both");

      // [AC-3.3.6] Left Only - use keyboard shortcut 'l'
      await page.keyboard.press("l");
      await expect(currentRadio).toHaveAttribute("aria-label", "Left Only");
      await expect(
        page.getByRole("region", { name: "Original version" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Modified version" })
      ).toBeHidden();

      // [AC-3.3.8] Right Only - use keyboard shortcut 'r'
      await page.keyboard.press("r");
      await expect(currentRadio).toHaveAttribute("aria-label", "Right Only");
      await expect(
        page.getByRole("region", { name: "Modified version" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Original version" })
      ).toBeHidden();

      // Back to Both - use keyboard shortcut 'o'
      await page.keyboard.press("o");
      await expect(currentRadio).toHaveAttribute("aria-label", "Show Both");
      await expect(
        page.getByRole("region", { name: "Original version" })
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Modified version" })
      ).toBeVisible();
    } else {
      // Prod mode: verify structure
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible();
      }
    }
  });

  test("Whitespace toggle is visible and functional (S-3.5)", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible();

      // [AC-3.5.4] Whitespace toggle in toolbar - find by aria-label pattern
      const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
      await expect(toolbar).toBeVisible();

      // Whitespace button uses aria-label "Hide whitespace changes" or "Show whitespace changes"
      const whitespaceButton = toolbar.getByRole("button", {
        name: /whitespace/i,
      });
      await expect(whitespaceButton).toBeVisible();

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
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible();
      }
    }
  });

  test("Full file toggle switches between changes only and full file (S-3.1)", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible();

      const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
      await expect(toolbar).toBeVisible();

      // Find the full file toggle button
      const fullFileButton = toolbar.getByRole("button", {
        name: /show full file|show changes only/i,
      });
      await expect(fullFileButton).toBeVisible();

      // [AC-3.1.1] Default should be "Changes" (showing changes only)
      await expect(fullFileButton).toContainText("Changes");

      // Verify we see the hunk header (changes only mode)
      const diffRegion = page.getByRole("region", { name: /Diff content/i });
      await expect(diffRegion).toBeVisible();
      await expect(diffRegion.getByText("@@")).toBeVisible();

      // [AC-3.1.2] Toggle to full file mode
      await fullFileButton.click();
      await expect(fullFileButton).toContainText("Full");

      // [AC-3.1.3-6] Full file mode should show more lines
      // Should now see content from the full file (line numbers starting from 1)
      // In full file mode, we should see lines that weren't in the patch
      await expect(diffRegion.getByText("End of file")).toBeVisible();

      // [AC-3.1.7] Toggle back to changes only
      await fullFileButton.click();
      await expect(fullFileButton).toContainText("Changes");

      // Should be back to showing only the hunk
      await expect(diffRegion.getByText("@@")).toBeVisible();
    } else {
      // Prod mode: verify structure
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible();

        // Verify full file toggle exists
        const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
        const fullFileButton = toolbar.getByRole("button", {
          name: /show full file|show changes only/i,
        });
        await expect(fullFileButton).toBeVisible();
      }
    }
  });

  test("Side-by-side view renders panes horizontally (S-3.2)", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible();

      // Switch to Split view using keyboard shortcut
      await page.locator("body").click();
      await page.keyboard.press("x");

      // Get the side-by-side container and panes
      const sideBySideContainer = page.getByRole("region", {
        name: "Side-by-side diff view",
      });
      await expect(sideBySideContainer).toBeVisible();

      const leftPane = page.getByRole("region", { name: "Original version" });
      const rightPane = page.getByRole("region", { name: "Modified version" });

      await expect(leftPane).toBeVisible();
      await expect(rightPane).toBeVisible();

      // Get bounding boxes to verify horizontal layout
      const leftBox = await leftPane.boundingBox();
      const rightBox = await rightPane.boundingBox();

      // Fail fast if bounding boxes are null
      if (!leftBox || !rightBox) {
        throw new Error("Failed to get bounding boxes for panes");
      }

      // Verify panes are side-by-side: same Y position, left pane ends where right begins
      // Allow small tolerance for borders
      expect(Math.abs(leftBox.y - rightBox.y)).toBeLessThan(5);
      expect(rightBox.x).toBeGreaterThan(leftBox.x);
      expect(rightBox.x).toBeLessThanOrEqual(leftBox.x + leftBox.width + 5);

      // Each pane should have reasonable width (not collapsed)
      expect(leftBox.width).toBeGreaterThan(100);
      expect(rightBox.width).toBeGreaterThan(100);
    } else {
      test.skip(true, "Layout test runs in mock mode only");
    }
  });

  test("Side-by-side view accessibility (S-3.2)", async ({ page }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible();

      // Switch to Split view using keyboard shortcut
      await page.locator("body").click();
      await page.keyboard.press("x");

      // [AC-3.2.8] Screen reader can move between panes
      const leftPane = page.getByRole("region", { name: "Original version" });
      const rightPane = page.getByRole("region", { name: "Modified version" });

      await expect(leftPane).toBeVisible();
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
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const diffRegion = page.getByRole("region", { name: /Diff content/i });
        await expect(diffRegion).toBeVisible();
      }
    }
  });

  test("Change navigation with J/K keys and toolbar buttons", async ({
    page,
  }) => {
    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    if (isMockMode()) {
      await fileNav.getByText("src/example.ts").click();
      await expect(
        page.getByRole("heading", { name: "src/example.ts" })
      ).toBeVisible();

      const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
      await expect(toolbar).toBeVisible();

      // Verify navigation buttons exist with correct labels
      const prevChangeButton = toolbar.getByRole("button", {
        name: /Previous change/i,
      });
      const nextChangeButton = toolbar.getByRole("button", {
        name: /Next change/i,
      });
      await expect(prevChangeButton).toBeVisible();
      await expect(nextChangeButton).toBeVisible();

      // Verify buttons show keyboard shortcut hints
      await expect(prevChangeButton).toContainText("K");
      await expect(nextChangeButton).toContainText("J");

      // Get diff region
      const diffRegion = page.getByRole("region", { name: /Diff content/i });
      await expect(diffRegion).toBeVisible();

      // Wait for hunk count to be calculated (Next button becomes enabled when changes exist)
      await expect(nextChangeButton).toBeEnabled();

      // At start, Previous button should be disabled (no previous change)
      await expect(prevChangeButton).toBeDisabled();

      // Focus the diff region for keyboard navigation
      await diffRegion.click();

      // Press J to navigate to first change
      // Note: Our mock diff has only 1 hunk, so after pressing J we're at the only change
      await page.keyboard.press("j");

      // After pressing J, we're at index 0 (the first and only hunk)
      // Both buttons should be disabled since we're at both the start and end
      // (there's only 1 hunk group: deletion + additions are consecutive)
      await expect(prevChangeButton).toBeDisabled();
      await expect(nextChangeButton).toBeDisabled();

      // Verify the diff content is still visible (no crashes)
      await expect(diffRegion).toBeVisible();
    } else {
      // Prod mode: verify toolbar buttons exist
      const fileButtons = fileNav.getByRole("listitem");
      const allButtons = await fileButtons.all();
      if (allButtons.length > 1) {
        await allButtons[1]?.click();
        const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
        await expect(
          toolbar.getByRole("button", { name: /Previous change/i })
        ).toBeVisible();
        await expect(
          toolbar.getByRole("button", { name: /Next change/i })
        ).toBeVisible();
      }
    }
  });

  test("Change navigation works in virtualized diff (500+ lines)", async ({
    page,
  }) => {
    // Skip in prod mode - mock mode only test
    test.skip(!isMockMode(), "Virtualized diff test runs in mock mode only");

    // Generate a large file with 600+ lines to trigger virtualization (threshold is 500)
    const generateLargeFile = () => {
      const lines: string[] = [];
      // Add header
      lines.push("@@ -1,300 +1,310 @@");
      // Add context lines, then a hunk of changes, repeat
      for (let i = 0; i < 60; i++) {
        // 10 context lines
        for (let j = 0; j < 10; j++) {
          lines.push(` // Context line ${i * 10 + j}`);
        }
        // Then a hunk of changes (deletion + addition)
        lines.push(`-const oldVar${String(i)} = ${String(i)};`);
        lines.push(`+const newVar${String(i)} = ${String(i + 100)};`);
      }
      return lines.join("\n");
    };

    const largePatch = generateLargeFile();

    // Override the mock to use the large file
    await page.route(
      "**/repos/test/repo/pulls/123/files*",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              sha: "abc123",
              filename: "src/large-file.ts",
              status: "modified",
              additions: 60,
              deletions: 60,
              changes: 120,
              patch: largePatch,
            },
          ]),
        });
      }
    );

    const config = getTestConfig();
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Click on the large file
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText("src/large-file.ts").click();

    // Wait for diff to render
    await expect(
      page.getByRole("heading", { name: "src/large-file.ts" })
    ).toBeVisible();

    // Get the toolbar
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    // Get navigation buttons
    const prevChangeButton = toolbar.getByRole("button", {
      name: /Previous change/i,
    });
    const nextChangeButton = toolbar.getByRole("button", {
      name: /Next change/i,
    });

    // Wait for hunk count to be calculated (buttons should be enabled)
    await expect(nextChangeButton).toBeEnabled();
    await expect(prevChangeButton).toBeDisabled();

    // Focus the page body for keyboard navigation
    await page.locator("body").click();

    // Press J to navigate to first change
    await page.keyboard.press("j");

    // After first J press, we should be at index 0
    // Prev should still be disabled (at start), Next should be enabled (many more hunks)
    await expect(prevChangeButton).toBeDisabled();
    await expect(nextChangeButton).toBeEnabled();

    // Press J a few more times to navigate through changes
    await page.keyboard.press("j");
    await page.keyboard.press("j");

    // Now we're at index 2, both buttons should be enabled
    await expect(prevChangeButton).toBeEnabled();
    await expect(nextChangeButton).toBeEnabled();

    // Press K to go back
    await page.keyboard.press("k");

    // Still both enabled (we're at index 1)
    await expect(prevChangeButton).toBeEnabled();
    await expect(nextChangeButton).toBeEnabled();

    // Go back to start
    await page.keyboard.press("k");

    // Now at index 0, prev disabled
    await expect(prevChangeButton).toBeDisabled();
    await expect(nextChangeButton).toBeEnabled();
  });
});
