import { test, expect } from "@playwright/test";
import { setupAuthState } from "../../fixtures/github-mocks";

test.describe("Iteration File Status", () => {
  // Test for bug fix: files first modified in later iterations should show as "modified" not "added"
  // Uses real PR #97 which has action/action.yml first modified in iteration 2

  // Prod mode configuration - uses real PR #97
  const config = { owner: "pedropaulovc", repo: "codjiflo", prNumber: 97 };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
  });

  test("File first modified in later iteration shows as modified, not added", async ({
    page,
  }) => {
    // This test verifies the "base equivalence" fix:
    // - action/action.yml existed in the PR base but wasn't changed in iteration 1
    // - action/action.yml was first modified in iteration 2
    // - When viewing iteration 1, action/action.yml should NOT appear
    // - When viewing iteration 2, it should show as "M" (modified), not "A" (added)

    const pageUrl = `/${config.owner}/${config.repo}/${String(config.prNumber)}`;

    await page.goto(pageUrl);

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileList).toBeVisible();

    const actionYmlItem = fileList.locator(".tree-item.file").filter({
      hasText: /action\.yml/,
    });

    // --- Iteration 1: action/action.yml should NOT appear ---
    const iteration1Tab = page.getByTestId("iteration-tab-1");
    await iteration1Tab.click();
    await expect(iteration1Tab).toHaveClass(/selected/);

    // action/action.yml should not be visible (wasn't modified in iteration 1)
    await expect(actionYmlItem).toBeHidden();

    // --- Iteration 2: action/action.yml should appear as "M" (modified) ---
    const iteration2Tab = page.getByTestId("iteration-tab-2");
    await iteration2Tab.click();
    await expect(iteration2Tab).toHaveClass(/selected/);

    // action/action.yml should now be visible
    await expect(actionYmlItem).toBeVisible();

    // Check the change-type indicator shows "M" (modified), not "A" (added)
    const changeTypeIndicator = actionYmlItem.locator(".change-type");
    await expect(changeTypeIndicator).toHaveText("M");

    // Also verify via aria-label that it says "modified" not "added"
    const ariaLabel = await actionYmlItem.getAttribute("aria-label");
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

    const box1 = await tab1.boundingBox();
    const box2 = await tab2.boundingBox();

    if (box1 && box2) {
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
      await page.mouse.down();
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
      await page.mouse.up();
    }

    // Both tabs should be selected (range selection)
    await expect(tab1).toHaveClass(/selected/);
    await expect(tab2).toHaveClass(/selected/);

    // action/action.yml should appear as "M" (modified), not "A" (added)
    const fileList = page.getByRole("navigation", { name: /Changed files/i });
    const actionYmlItem = fileList.locator(".tree-item.file").filter({
      hasText: /action\.yml/,
    });

    await expect(actionYmlItem).toBeVisible();

    const changeTypeIndicator = actionYmlItem.locator(".change-type");
    await expect(changeTypeIndicator).toHaveText("M");
  });
});
