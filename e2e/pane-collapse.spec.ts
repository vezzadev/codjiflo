import { test, expect } from "@playwright/test";
import { isMockMode } from "./fixtures/mode";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "./fixtures/github-mocks";

test.describe("Pane Collapse/Expand Functionality", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 456,
    title: "Test PR for pane collapse",
    body: "Testing pane collapse functionality",
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
    html_url: "https://github.com/test/repo/pull/456",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/test.ts",
      status: "added",
      additions: 5,
      deletions: 0,
      changes: 5,
      patch: "@@ -0,0 +1,5 @@\n+const test = true;\n+export { test };",
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    if (isMockMode()) {
      await setupFullPRMocks(page, "test", "repo", 456, {
        pr: mockPR,
        files: mockFiles,
      });
    }
  });

  test("left pane collapses when dragged to small size and restores on click", async ({
    page,
  }) => {
    // Navigate to PR page
    const pageUrl = isMockMode() ? "/test/repo/456" : "/facebook/react/12345";
    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Verify left pane is visible initially
    const leftPane = page.locator(".left-pane");
    await expect(leftPane).toBeVisible();

    // Get the resize handle
    const resizeHandle = page.locator(".resize-handle-v");
    await expect(resizeHandle).toBeVisible();

    // Get the initial bounding box of the resize handle
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) {
      throw new Error("Resize handle bounding box not found");
    }

    // Use page.mouse for reliable drag operation
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Drag to the left edge to collapse
    await page.mouse.move(10, startY);
    await page.mouse.up();

    // Wait for collapse - left pane should be hidden, collapse bar should appear
    const collapseBarLeft = page.getByRole("button", {
      name: /expand left pane/i,
    });
    await expect(collapseBarLeft).toBeVisible();
    await expect(leftPane).toBeHidden();

    // Click the collapse bar to restore
    await collapseBarLeft.click();

    // Verify left pane is visible again
    await expect(leftPane).toBeVisible();
    await expect(collapseBarLeft).toBeHidden();
  });

  test("bottom pane collapses when dragged down and restores on click", async ({
    page,
  }) => {
    // Navigate to PR page
    const pageUrl = isMockMode() ? "/test/repo/456" : "/facebook/react/12345";
    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Verify bottom pane is visible initially
    const bottomPane = page.locator(".bottom-pane");
    await expect(bottomPane).toBeVisible();

    // Get the horizontal resize handle for bottom pane
    const resizeHandle = page.locator(".resize-handle-h");
    await expect(resizeHandle).toBeVisible();

    // Get the viewport height
    const viewportSize = page.viewportSize();
    if (!viewportSize) {
      throw new Error("Viewport size not available");
    }

    // Get the initial bounding box of the resize handle
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) {
      throw new Error("Resize handle bounding box not found");
    }

    // Use page.mouse for more reliable drag operation
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Drag down to the bottom of the viewport
    await page.mouse.move(startX, viewportSize.height - 10);
    await page.mouse.up();

    // Wait for collapse - bottom pane should be hidden, collapse bar should appear
    const collapseBarBottom = page.getByRole("button", {
      name: /expand bottom pane/i,
    });
    await expect(collapseBarBottom).toBeVisible();
    await expect(bottomPane).toBeHidden();

    // Click the collapse bar to restore
    await collapseBarBottom.click();

    // Verify bottom pane is visible again
    await expect(bottomPane).toBeVisible();
    await expect(collapseBarBottom).toBeHidden();
  });
});
