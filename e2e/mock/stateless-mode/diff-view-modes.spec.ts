import { test } from "@playwright/test";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { CMEditor, expect } from "../../fixtures/codemirror";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

type BoundingBox = NonNullable<
  Awaited<ReturnType<import("@playwright/test").Locator["boundingBox"]>>
>;

/**
 * Assert a bounding box is present and return it narrowed to non-null.
 * Lives at module scope so the guard is not a conditional inside a test body.
 */
function assertBoundingBox(box: BoundingBox | null): BoundingBox {
  expect(box).not.toBeNull();
  if (box === null) {
    throw new Error("Pane bounding box not found");
  }
  return box;
}

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

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 123,
    pageUrl: "/test/repo/123",
  };

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupAuthMock(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("View mode toggles between Inline and Split (S-3.3)", async ({
    page,
  }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    // Click on a file to show diff (PR description is default)
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    // [AC-3.3.1] Inline mode should be default - dropdown shows "Inline"
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    const viewModeDropdown = toolbar.getByRole("button", { name: "View mode" });
    await expect(viewModeDropdown).toBeVisible();
    await expect(viewModeDropdown).toContainText("Inline");

    // [AC-3.2.1] Switch to Split view by selecting from dropdown
    await viewModeDropdown.click();
    await page.getByRole("option", { name: /Side-by-Side/i }).click();

    // Now dropdown should show Side-by-Side
    await expect(viewModeDropdown).toContainText("Side-by-Side");

    // [AC-3.2.8-9] Split view should have accessible labels
    await expect(
      page.getByRole("region", { name: "Side-by-side diff view" })
    ).toBeVisible();
    // Use .first() since react-window renders each row with its own pane element
    await expect(
      page.getByRole("region", { name: "Original version" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Modified version" }).first()
    ).toBeVisible();

    // Switch back to Inline
    await viewModeDropdown.click();
    await page.getByRole("option", { name: /Inline/i }).click();
    await expect(viewModeDropdown).toContainText("Inline");
  });

  test("Keyboard shortcuts for view modes (S-3.3)", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    const viewModeDropdown = toolbar.getByRole("button", { name: "View mode" });

    // Defocus the dropdown before issuing global keyboard shortcuts
    await page.getByRole("heading", { name: "src/example.ts" }).click();

    // [AC-3.3.4] Press 'x' for Split - dropdown should now show Side-by-Side
    await page.keyboard.press("x");
    await expect(viewModeDropdown).toContainText("Side-by-Side");

    // [AC-3.3.4] Press 'i' for Inline - dropdown should now show Inline
    await page.keyboard.press("i");
    await expect(viewModeDropdown).toContainText("Inline");
  });

  test("Content filter toggles (Left/Both/Right) (S-3.3)", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    // Switch to Split view using keyboard shortcut
    await page.getByRole("heading", { name: "src/example.ts" }).click();
    await page.keyboard.press("x");

    // [AC-3.3.5-7] Content filter radiogroup should be visible
    const contentFilter = toolbar.getByRole("radiogroup", {
      name: "Content filter",
    });
    await expect(contentFilter).toBeVisible();

    // [AC-3.3.7] Both is default - check the checked radio
    await expect(contentFilter.getByLabel("Show Both")).toBeChecked();

    // [AC-3.3.6] Left Only - use keyboard shortcut 'l'
    await page.keyboard.press("l");
    await expect(contentFilter.getByLabel("Left Only")).toBeChecked();
    // Use .first() since react-window renders each row with its own pane element
    await expect(
      page.getByRole("region", { name: "Original version" }).first()
    ).toBeVisible();
    // When filtering to left only, right panes should not exist
    await expect(
      page.getByRole("region", { name: "Modified version" })
    ).toHaveCount(0);

    // [AC-3.3.8] Right Only - use keyboard shortcut 'r'
    await page.keyboard.press("r");
    await expect(contentFilter.getByLabel("Right Only")).toBeChecked();
    await expect(
      page.getByRole("region", { name: "Modified version" }).first()
    ).toBeVisible();
    // When filtering to right only, left panes should not exist
    await expect(
      page.getByRole("region", { name: "Original version" })
    ).toHaveCount(0);

    // Back to Both - use keyboard shortcut 'o'
    await page.keyboard.press("o");
    await expect(contentFilter.getByLabel("Show Both")).toBeChecked();
    // Use .first() since virtualized rendering creates multiple panes
    await expect(
      page.getByRole("region", { name: "Original version" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Modified version" }).first()
    ).toBeVisible();

    // Content filter radio is keyboard focusable
    const bothRadio = contentFilter.getByLabel("Show Both");
    await bothRadio.focus();
    await expect(bothRadio).toBeFocused();

    // Arrow keys navigate between radio options
    await page.keyboard.press("ArrowRight");
    await expect(contentFilter.getByLabel("Right Only")).toBeChecked();
    await expect(contentFilter.getByLabel("Right Only")).toBeFocused();

    await page.keyboard.press("ArrowLeft");
    await expect(contentFilter.getByLabel("Show Both")).toBeChecked();
    await expect(contentFilter.getByLabel("Show Both")).toBeFocused();
  });

  test("Whitespace toggle is visible and functional (S-3.5)", async ({
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

    // [AC-3.5.4] Whitespace dropdown in toolbar
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    const whitespaceDropdown = toolbar.getByRole("button", {
      name: "Whitespace visibility",
    });
    await expect(whitespaceDropdown).toBeVisible();

    // [AC-3.5.5] Default state - WS hidden
    await expect(whitespaceDropdown).toContainText("WS: Hidden");

    // Select visible option
    await whitespaceDropdown.click();
    await page.getByRole("option", { name: /WS: Visible/i }).click();
    await expect(whitespaceDropdown).toContainText("WS: Visible");

    // Select hidden option
    await whitespaceDropdown.click();
    await page.getByRole("option", { name: /WS: Hidden/i }).click();
    await expect(whitespaceDropdown).toContainText("WS: Hidden");
  });

  test("Full file toggle switches between changes only and full file (S-3.1)", async ({
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

    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar).toBeVisible();

    // Find the file content dropdown
    const fileContentDropdown = toolbar.getByRole("button", {
      name: "File content",
    });
    await expect(fileContentDropdown).toBeVisible();

    // [AC-3.1.1] Default should be "Changes" (showing changes only)
    await expect(fileContentDropdown).toContainText("Changes");

    // Verify we see the hunk header (changes only mode)
    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();
    await expect(diffRegion.getByText("@@")).toBeVisible();

    // [AC-3.1.2] Select full file mode from dropdown
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Full File/i }).click();
    await expect(fileContentDropdown).toContainText("Full File");

    // [AC-3.1.3-6] Full file mode should show more lines
    // Should now see content from the full file (line numbers starting from 1)
    // In full file mode, we should see lines that weren't in the patch
    await expect(diffRegion.getByText("End of file")).toBeVisible();

    // [AC-3.1.7] Select changes only mode
    await fileContentDropdown.click();
    await page.getByRole("option", { name: /Changes/i }).click();
    await expect(fileContentDropdown).toContainText("Changes");

    // Should be back to showing only the hunk
    await expect(diffRegion.getByText("@@")).toBeVisible();
  });

  test("Side-by-side view renders panes horizontally (S-3.2)", async ({
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

    // Switch to Split view using keyboard shortcut
    await page.getByRole("heading", { name: "src/example.ts" }).click();
    await page.keyboard.press("x");

    // Get the side-by-side container and panes
    const sideBySideContainer = page.getByRole("region", {
      name: "Side-by-side diff view",
    });
    await expect(sideBySideContainer).toBeVisible();

    // Use .first() since react-window renders each row with its own pane element
    const leftPane = page.getByRole("region", { name: "Original version" }).first();
    const rightPane = page.getByRole("region", { name: "Modified version" }).first();

    await expect(leftPane).toBeVisible();
    await expect(rightPane).toBeVisible();

    // Get bounding boxes to verify horizontal layout
    const left = assertBoundingBox(await leftPane.boundingBox());
    const right = assertBoundingBox(await rightPane.boundingBox());

    // Verify panes are side-by-side: same Y position, left pane ends where right begins
    // Allow small tolerance for borders
    expect(Math.abs(left.y - right.y)).toBeLessThan(5);
    expect(right.x).toBeGreaterThan(left.x);
    expect(right.x).toBeLessThanOrEqual(left.x + left.width + 5);

    // Each pane should have reasonable width (not collapsed)
    expect(left.width).toBeGreaterThan(100);
    expect(right.width).toBeGreaterThan(100);
  });

  test("Side-by-side view accessibility (S-3.2)", async ({ page }) => {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();

    await fileNav.getByText("example.ts").click();
    await expect(
      page.getByRole("heading", { name: "src/example.ts" })
    ).toBeVisible();

    // Switch to Split view using keyboard shortcut
    await page.getByRole("heading", { name: "src/example.ts" }).click();
    await page.keyboard.press("x");

    // [AC-3.2.8] Screen reader can move between panes
    // Use .first() since react-window renders each row with its own pane element
    const leftPane = page.getByRole("region", { name: "Original version" }).first();
    const rightPane = page.getByRole("region", { name: "Modified version" }).first();

    await expect(leftPane).toBeVisible();
    await expect(rightPane).toBeVisible();

    // [AC-3.2.9] Aria labels correctly set
    await expect(leftPane).toHaveAttribute("aria-label", "Original version");
    await expect(rightPane).toHaveAttribute("aria-label", "Modified version");

    // [AC-3.2.2-3] Left shows base, right shows head content
    // Verify the panes contain content (CodeMirror editors)
    const leftEditor = CMEditor.from(leftPane);
    const rightEditor = CMEditor.from(rightPane);
    await expect(leftEditor.content).toBeVisible();
    await expect(rightEditor.content).toBeVisible();
  });

  test("Change navigation with J/K keys and toolbar buttons", async ({
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
  });
});
