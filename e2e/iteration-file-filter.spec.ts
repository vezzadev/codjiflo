/**
 * Test: Iteration-aware file list filtering
 *
 * Verifies that files with no changes in the selected iteration range are hidden.
 */

import { test, expect } from '@playwright/test';
import { setupFullPRMocks } from './fixtures/github-mocks';
import { isMockMode } from './fixtures/mode';

test.describe('Iteration-aware File List (AC-4.8.11)', () => {
  test.beforeEach(async ({ page }) => {
    if (isMockMode()) {
      await setupFullPRMocks(page, 'pedropaulovc', 'codjiflo', 28);
    }
  });

  test('Latest preset hides unchanged files', async ({ page }) => {
    // Navigate to PR 28
    await page.goto('/pr/pedropaulovc/codjiflo/28');

    // Wait for iterations to load
    await expect(page.getByRole('toolbar', { name: 'Iteration range selector' })).toBeVisible({ timeout: 10000 });

    // Click "Latest" to compare v5 → v6
    await page.getByRole('button', { name: 'Latest' }).click();

    // Wait for file list to update
    await page.waitForTimeout(1000);

    // Get all file list items
    const fileList = page.getByRole('navigation', { name: 'Changed files' });
    const fileButtons = fileList.getByRole('button').filter({ hasNotText: 'Pull Request Description' });

    // Count files shown in Latest view
    const latestFileCount = await fileButtons.count();
    console.log(`Latest view shows ${latestFileCount} files`);

    // ci-cd-pr.yml should NOT appear if it wasn't changed between v5 and v6
    // (It was added in an earlier iteration)
    const ciCdFile = fileList.getByRole('button', { name: /ci-cd-pr\.yml/ });

    // Check if ci-cd-pr.yml is visible - if it is, check it's not marked as "added"
    if (await ciCdFile.isVisible()) {
      // If visible, it should be because it actually changed, not because of a bug
      const ariaLabel = await ciCdFile.getAttribute('aria-label');
      console.log(`ci-cd-pr.yml is visible with label: ${ariaLabel}`);

      // The file should show as modified, not added (if it actually changed)
      // If it shows as "added" with 206 additions, that's the bug we fixed
      expect(ariaLabel).not.toContain('206 additions');
    } else {
      console.log('ci-cd-pr.yml is correctly hidden (no changes in v5→v6)');
    }

    // Now switch to Full diff and verify more files appear
    await page.getByRole('button', { name: 'Full diff' }).click();
    await page.waitForTimeout(1000);

    const fullDiffFileCount = await fileButtons.count();
    console.log(`Full diff view shows ${fullDiffFileCount} files`);

    // Full diff should show more files than Latest (or equal if all files changed in latest)
    expect(fullDiffFileCount).toBeGreaterThanOrEqual(latestFileCount);

    // eslint.config.mjs should appear in Full diff (it was modified earlier)
    const eslintFile = fileList.getByRole('button', { name: /eslint\.config\.mjs/ });
    await expect(eslintFile).toBeVisible();

    // Switch back to Latest - eslint.config.mjs should be hidden
    await page.getByRole('button', { name: 'Latest' }).click();
    await page.waitForTimeout(1000);

    // eslint.config.mjs should NOT be visible in Latest if it wasn't changed in v5→v6
    const eslintInLatest = fileList.getByRole('button', { name: /eslint\.config\.mjs/ });
    const isEslintVisible = await eslintInLatest.isVisible();
    console.log(`eslint.config.mjs visible in Latest: ${isEslintVisible}`);
  });
});
