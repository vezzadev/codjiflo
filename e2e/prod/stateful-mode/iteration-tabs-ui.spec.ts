import { test, expect } from "@playwright/test";
import { setupAuthState } from "../../fixtures/github-mocks";

test.describe("Iteration Tabs UI (Prod Mode)", () => {
  // These tests require real iteration artifacts from PR #11 in the e2e test repo.
  // PR #11 (vezzadev/codjiflo-e2e-test-repo) has exactly 2 iterations: the sibling
  // iteration-file-status.spec.ts relies on iteration-tab-1 / iteration-tab-2 and on
  // target-file.yml being first modified in iteration 2 (i.e. iteration 2 is the last).
  const iterationTestPR = {
    owner: "vezzadev",
    repo: "codjiflo-e2e-test-repo",
    prNumber: 11,
  };
  const ITERATION_COUNT = 2;

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

    // Iteration tabs are ToggleButtons (role=button) named "Iteration N (date)".
    // Collapsed-group tabs use role=img, so this filter counts only live iterations.
    const tabs = selector.getByRole("button", { name: /^Iteration \d/ });
    await expect(tabs.first()).toBeVisible();

    // PR #11 has exactly ITERATION_COUNT iterations.
    await expect(tabs).toHaveCount(ITERATION_COUNT);

    // Each tab exposes its iteration number via its accessible name.
    await expect(
      selector.getByRole("button", { name: /^Iteration 1\b/ })
    ).toBeVisible();
    await expect(
      selector.getByRole("button", { name: /^Iteration 2\b/ })
    ).toBeVisible();
  });

  test("Clicking a single tab selects that iteration", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Click the first tab
    const firstTab = page.getByTestId("iteration-tab-1");
    await firstTab.click();

    // First tab should now have the 'selected' class
    await expect(firstTab).toHaveClass(/selected/);
  });

  test("Last iteration is selected by default", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // The last iteration (revision 2) should be selected by default.
    const lastTab = page.getByTestId(`iteration-tab-${String(ITERATION_COUNT)}`);
    await expect(lastTab).toHaveClass(/selected/);
  });

  test("Dragging across tabs selects a range", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const firstTab = page.getByTestId("iteration-tab-1");
    const secondTab = page.getByTestId("iteration-tab-2");
    await expect(firstTab).toBeVisible();
    await expect(secondTab).toBeVisible();

    // Perform drag from the first tab to the second tab. dragTo presses on the
    // source, moves over the target, and releases — driving the same
    // mousedown(tab1) -> mouseenter(tab2) -> mouseup range selection.
    await firstTab.dragTo(secondTab);

    // Both tabs should be selected (first as range-start, second as range-end)
    await expect(firstTab).toHaveClass(/selected/);
    await expect(secondTab).toHaveClass(/selected/);
  });

  test("Iteration tabs appear above filename in diff view", async ({ page }) => {
    const { owner, repo, prNumber } = iterationTestPR;
    const pageUrl = `/${owner}/${repo}/${String(prNumber)}`;

    await page.goto(pageUrl);
    await page.waitForLoadState("load");

    // Click on a file to show the diff view (PR description is shown by default)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    // Click on the first actual file (not PR description). file-tree-item is only
    // present on real file rows; the PR Description row does not carry it.
    const fileItems = fileList.getByTestId("file-tree-item");
    await fileItems.first().click();

    // Wait for the diff to render
    await expect(page.getByTestId("diff-viewer")).toBeVisible();

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // The iteration selector should be inside diff-header-iterations
    const headerContainer = page.getByTestId("diff-header-iterations");
    await expect(headerContainer).toBeVisible();

    // Verify the iteration selector is inside the header container
    const selectorInHeader = headerContainer.getByTestId("iteration-selector");
    await expect(selectorInHeader).toBeVisible();
  });
});
