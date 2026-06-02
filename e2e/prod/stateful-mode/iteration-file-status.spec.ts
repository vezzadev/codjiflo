import { test, expect } from "@playwright/test";
import { setupAuthState } from "../../fixtures/github-mocks";

test.describe("Iteration File Status", () => {
  // Test for bug fix: files first modified in later iterations should show as "modified" not "added"
  // Uses real PR #11 in codjiflo-e2e-test-repo which has target-file.yml first modified in iteration 2

  // Prod mode configuration - uses real PR #11 in e2e test repo
  const config = { owner: "vezzadev", repo: "codjiflo-e2e-test-repo", prNumber: 11 };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
  });

  test("File first modified in later iteration shows as modified, not added", async ({
    page,
  }) => {
    // This test verifies the "base equivalence" fix:
    // - target-file.yml existed in the PR base but wasn't changed in iteration 1
    // - target-file.yml was first modified in iteration 2
    // - When viewing iteration 1, target-file.yml should NOT appear
    // - When viewing iteration 2, it should show as "M" (modified), not "A" (added)

    const pageUrl = `/${config.owner}/${config.repo}/${String(config.prNumber)}`;

    await page.goto(pageUrl);

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    const targetFileItem = fileList.getByRole("treeitem", {
      name: /target-file\.yml/,
    });

    // --- Iteration 1: target-file.yml should NOT appear ---
    const iteration1Tab = page.getByTestId("iteration-tab-1");
    await iteration1Tab.click();
    await expect(iteration1Tab).toHaveClass(/selected/);

    // target-file.yml should not be visible (wasn't modified in iteration 1)
    await expect(targetFileItem).toBeHidden();

    // --- Iteration 2: target-file.yml should appear as "M" (modified) ---
    const iteration2Tab = page.getByTestId("iteration-tab-2");
    await iteration2Tab.click();
    await expect(iteration2Tab).toHaveClass(/selected/);

    // target-file.yml should now be visible
    await expect(targetFileItem).toBeVisible();

    // Check the change-type indicator shows "M" (modified), not "A" (added)
    const changeTypeIndicator = targetFileItem.getByTestId("file-change-type");
    await expect(changeTypeIndicator).toHaveText("M");

    // Also verify via aria-label that it says "modified" not "added"
    const ariaLabel = await targetFileItem.getAttribute("aria-label");
    expect(ariaLabel).toContain("modified");
    expect(ariaLabel).not.toContain("added");
  });

  test("Dragging between iterations shows file as modified, not added", async ({
    page,
  }) => {
    // When comparing iteration 1 to iteration 2 via drag selection,
    // files first modified in iteration 2 should show as "M" (modified)
    // because the base content exists (PR base = iteration 1 end state for unchanged files)

    const pageUrl = `/${config.owner}/${config.repo}/${String(config.prNumber)}`;

    await page.goto(pageUrl);

    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Drag from iteration 1 to iteration 2
    const tab1 = page.getByTestId("iteration-tab-1");
    const tab2 = page.getByTestId("iteration-tab-2");

    await tab1.dragTo(tab2);

    // Both tabs should be selected (range selection)
    await expect(tab1).toHaveClass(/selected/);
    await expect(tab2).toHaveClass(/selected/);

    // target-file.yml should appear as "M" (modified), not "A" (added)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    const targetFileItem = fileList.getByRole("treeitem", {
      name: /target-file\.yml/,
    });

    await expect(targetFileItem).toBeVisible();

    const changeTypeIndicator = targetFileItem.getByTestId("file-change-type");
    await expect(changeTypeIndicator).toHaveText("M");
  });
});
