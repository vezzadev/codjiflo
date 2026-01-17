import { test, expect } from "@playwright/test";
import { setupAuthState } from "../../fixtures/github-mocks";

test.describe("Iteration Tabs UI (Prod Mode)", () => {
  // These tests require real iteration artifacts from PR #11 in e2e test repo
  const iterationTestPR = {
    owner: "pedropaulovc",
    repo: "codjiflo-e2e-test-repo",
    prNumber: 11,
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
  });

  test("Iteration tabs display correct number of iterations", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load (may take a while to download artifacts)
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Wait for at least one tab to appear
    const tabs = selector.locator(".iteration-tab");
    await expect(tabs.first()).toBeVisible();

    const tabCount = await tabs.count();

    // Should have at least 1 iteration tab
    expect(tabCount).toBeGreaterThanOrEqual(1);

    // Each tab should display a number
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const tabNumber = tab.locator(".iteration-tab-number");
      await expect(tabNumber).toHaveText(String(i + 1));
    }
  });

  test("Clicking a single tab selects that iteration", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    if (tabCount >= 1) {
      // Click the first tab
      const firstTab = tabs.nth(0);
      await firstTab.click();

      // First tab should now have the 'selected' class
      await expect(firstTab).toHaveClass(/selected/);
    }
  });

  test("Last iteration is selected by default", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    if (tabCount >= 1) {
      // The last tab should be selected by default
      const lastTab = tabs.nth(tabCount - 1);
      await expect(lastTab).toHaveClass(/selected/);
    }
  });

  test("Dragging across tabs selects a range", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const tabs = selector.locator(".iteration-tab");
    const tabCount = await tabs.count();

    // Need at least 2 tabs to test range selection
    if (tabCount >= 2) {
      const firstTab = tabs.nth(0);
      const secondTab = tabs.nth(1);

      // Get bounding boxes for drag operation
      const firstBox = await firstTab.boundingBox();
      const secondBox = await secondTab.boundingBox();

      if (firstBox && secondBox) {
        // Perform drag from first to second tab
        await page.mouse.move(
          firstBox.x + firstBox.width / 2,
          firstBox.y + firstBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          secondBox.x + secondBox.width / 2,
          secondBox.y + secondBox.height / 2
        );
        await page.mouse.up();

        // Both tabs should be selected (first as range-start, second as range-end)
        await expect(firstTab).toHaveClass(/selected/);
        await expect(secondTab).toHaveClass(/selected/);
      }
    }
  });

  test("Iteration tabs appear above filename in diff view", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Click on a file to show the diff view (PR description is shown by default)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Click on the first actual file (not PR description)
    const fileItems = fileList.locator(".tree-item.file");
    const fileCount = await fileItems.count();
    if (fileCount > 0) {
      await fileItems.first().click();
      // Wait for the diff to render
      await expect(page.locator(".diff-viewer")).toBeVisible();
    }

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // The iteration selector should be inside diff-header-iterations
    const headerContainer = page.locator(".diff-header-iterations");
    await expect(headerContainer).toBeVisible();

    // Verify the iteration selector is inside the header container
    const selectorInHeader = headerContainer.getByTestId("iteration-selector");
    await expect(selectorInHeader).toBeVisible();
  });
});
