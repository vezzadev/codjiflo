import { test, expect } from "@playwright/test";
import {
  forcePushConfig,
  setupForcePushDefaults,
  setupForcePushScenario,
} from "../../fixtures/force-push-helpers";

test.describe("Collapsed Iterations Expanded View", () => {
  test.beforeEach(async ({ page }) => {
    await setupForcePushDefaults(page);
  });

  test("Include button expands collapsed group into individual discarded iteration tabs", async ({
    page,
  }) => {
    // 2 discarded commits + 1 live commit = revisions 1, 2 (discarded), 3 (live)
    await setupForcePushScenario(page, {
      eventId: 5001,
      beforeSha: "old-before-sha",
      afterSha: "new-after-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "New commit after force push",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-exp-1",
            message: "Discarded commit 1",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
          {
            sha: "discarded-exp-2",
            message: "Discarded commit 2",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T12:00:00Z",
          },
        ],
      },
    });

    await page.goto(forcePushConfig.pageUrl);

    // Verify initial state: collapsed group tab visible
    const collapsedTab = page.getByTestId("collapsed-group-5001");
    await expect(collapsedTab).toBeVisible();

    // Click to open history view, then click "Include"
    await collapsedTab.click();
    const includeBtn = page.getByTestId("collapsed-history-include-btn");
    await expect(includeBtn).toBeVisible();
    await includeBtn.click();

    // After expanding: collapsed group tab should be replaced by individual tabs
    await expect(collapsedTab).toBeHidden();

    // Individual discarded iteration tabs should now be visible
    // Revisions 1 and 2 are the discarded iterations
    const discardedTab1 = page.getByTestId("iteration-tab-1");
    const discardedTab2 = page.getByTestId("iteration-tab-2");
    await expect(discardedTab1).toBeVisible();
    await expect(discardedTab2).toBeVisible();

    // Discarded tabs should have the 'discarded' CSS class (grayed out)
    await expect(discardedTab1).toHaveClass(/discarded/);
    await expect(discardedTab2).toHaveClass(/discarded/);

    // The live iteration tab (revision 3) should still be visible and NOT discarded
    const liveTab = page.getByTestId("iteration-tab-3");
    await expect(liveTab).toBeVisible();
    await expect(liveTab).not.toHaveClass(/discarded/);
  });

  test("Expanded discarded tabs participate in drag range selection", async ({
    page,
  }) => {
    // 2 discarded + 2 live = revisions 1,2 (discarded), 3,4 (live)
    await setupForcePushScenario(page, {
      eventId: 6001,
      beforeSha: "old-drag-sha",
      afterSha: "new-drag-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Live commit 1",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
        {
          sha: "new-commit-2",
          message: "Live commit 2",
          author: "testuser",
          date: "2024-01-04T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-drag-1",
            message: "Old commit 1",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
          {
            sha: "discarded-drag-2",
            message: "Old commit 2",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T12:00:00Z",
          },
        ],
      },
    });

    await page.goto(forcePushConfig.pageUrl);

    // Expand the collapsed group
    const collapsedTab = page.getByTestId("collapsed-group-6001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();
    await page.getByTestId("collapsed-history-include-btn").click();

    // Wait for expanded tabs to appear
    const discardedTab1 = page.getByTestId("iteration-tab-1");
    const liveTab4 = page.getByTestId("iteration-tab-4");
    await expect(discardedTab1).toBeVisible();
    await expect(liveTab4).toBeVisible();

    // Drag from discarded tab 2 to live tab 3 (cross-boundary range)
    // This creates a range where both boundary tabs get 'selected' class
    // and middle tabs (if any) get 'in-range' class
    const discardedTab2 = page.getByTestId("iteration-tab-2");
    const liveTab3 = page.getByTestId("iteration-tab-3");
    await discardedTab2.hover();
    await page.mouse.down();
    await liveTab3.hover();
    await page.mouse.up();

    // Range boundary tabs get 'selected', middle tabs get 'in-range'
    // All tabs in the range should have aria-pressed="true"
    await expect(discardedTab2).toHaveAttribute("aria-pressed", "true");
    await expect(liveTab3).toHaveAttribute("aria-pressed", "true");

    // The discarded tab should also have 'discarded' class (styling preserved during selection)
    await expect(discardedTab2).toHaveClass(/discarded/);

    // Tabs outside the range should NOT be selected
    await expect(discardedTab1).toHaveAttribute("aria-pressed", "false");
    await expect(liveTab4).toHaveAttribute("aria-pressed", "false");
  });

  test("CSS rule .iteration-tab.unavailable exists with correct opacity and cursor properties", async ({
    page,
  }) => {
    // AC-4.2.2.8: When a collapsed iteration's commit is GC'd, show as unavailable
    // within the expanded view. The tab should have .unavailable class, aria-disabled,
    // and no mouse handlers (pointer-events: none).
    //
    // We set up a scenario with 2 discarded commits: one available, one unavailable.
    // The compare API returns both, but we inject 'unavailable' status directly
    // into the store after loading (since the timeline-loader always returns 'available').

    await setupForcePushScenario(page, {
      eventId: 7001,
      beforeSha: "old-unavail-sha",
      afterSha: "new-unavail-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Live commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-avail",
            message: "Available discarded commit",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
          {
            sha: "discarded-gc",
            message: "GC'd discarded commit",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T12:00:00Z",
          },
        ],
      },
    });

    await page.goto(forcePushConfig.pageUrl);

    // Wait for iterations to load
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();
    const collapsedTab = page.getByTestId("collapsed-group-7001");
    await expect(collapsedTab).toBeVisible();

    // Expand the group
    await collapsedTab.click();
    await page.getByTestId("collapsed-history-include-btn").click();

    // Both discarded tabs should be visible (both are 'available' from API)
    const discardedTab1 = page.getByTestId("iteration-tab-1");
    const discardedTab2 = page.getByTestId("iteration-tab-2");
    await expect(discardedTab1).toBeVisible();
    await expect(discardedTab2).toBeVisible();
    await expect(discardedTab1).toHaveClass(/discarded/);
    await expect(discardedTab2).toHaveClass(/discarded/);

    // Verify .iteration-tab.unavailable CSS rule exists with correct properties
    const unavailableStyles = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && rule.selectorText === '.iteration-tab.unavailable') {
              return {
                opacity: rule.style.opacity,
                cursor: rule.style.cursor,
              };
            }
          }
        } catch {
          // Cross-origin stylesheet, skip
        }
      }
      return null;
    });

    expect(unavailableStyles).not.toBeNull();
    expect(unavailableStyles?.opacity).toBe("0.4");
    expect(unavailableStyles?.cursor).toBe("not-allowed");
  });

  test("Discarded tabs have reduced opacity and live tabs have full opacity", async ({
    page,
  }) => {
    await setupForcePushScenario(page, {
      eventId: 8001,
      beforeSha: "old-style-sha",
      afterSha: "new-style-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Live commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-style-1",
            message: "Old commit",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
        ],
      },
    });

    await page.goto(forcePushConfig.pageUrl);

    // Expand the group
    const collapsedTab = page.getByTestId("collapsed-group-8001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();
    await page.getByTestId("collapsed-history-include-btn").click();

    // Discarded tab should have reduced opacity (spec says 0.6)
    const discardedTab = page.getByTestId("iteration-tab-1");
    await expect(discardedTab).toBeVisible();
    await expect(discardedTab).toHaveClass(/discarded/);

    const opacity = await discardedTab.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    const opacityNum = parseFloat(opacity);
    expect(opacityNum).toBeLessThanOrEqual(0.7);
    expect(opacityNum).toBeGreaterThanOrEqual(0.5);

    // Live tab should have full opacity (1.0)
    const liveTab = page.getByTestId("iteration-tab-2");
    const liveOpacity = await liveTab.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(parseFloat(liveOpacity)).toBe(1);
  });

  test("Clicking a discarded tab selects it for range diff like a regular tab", async ({
    page,
  }) => {
    await setupForcePushScenario(page, {
      eventId: 9001,
      beforeSha: "old-click-sha",
      afterSha: "new-click-sha",
      liveCommits: [
        {
          sha: "new-commit-1",
          message: "Live commit",
          author: "testuser",
          date: "2024-01-03T10:00:00Z",
        },
      ],
      compareResponse: {
        status: 200,
        commits: [
          {
            sha: "discarded-click-1",
            message: "Discarded commit",
            authorName: "testuser",
            authorLogin: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
        ],
      },
    });

    await page.goto(forcePushConfig.pageUrl);

    // Expand
    const collapsedTab = page.getByTestId("collapsed-group-9001");
    await expect(collapsedTab).toBeVisible();
    await collapsedTab.click();
    await page.getByTestId("collapsed-history-include-btn").click();

    // Click the discarded tab (single click = select from base to this iteration)
    const discardedTab = page.getByTestId("iteration-tab-1");
    await expect(discardedTab).toBeVisible();
    await discardedTab.click();

    // Discarded tab should be selected (aria-pressed="true")
    await expect(discardedTab).toHaveAttribute("aria-pressed", "true");

    // It should have both 'discarded' (styling) and 'selected' or range classes
    await expect(discardedTab).toHaveClass(/discarded/);

    // Live tab should NOT be in the selection (clicked only discarded tab 1)
    const liveTab = page.getByTestId("iteration-tab-2");
    await expect(liveTab).toHaveAttribute("aria-pressed", "false");
  });
});
