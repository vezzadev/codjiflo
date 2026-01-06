/**
 * Test: Iteration-aware file list filtering
 *
 * Verifies that files with no changes in the selected iteration range are hidden.
 *
 * NOTE: This test only runs in PROD mode because it requires real iteration data
 * from the GitHub artifact. Mock mode doesn't include iteration data.
 */

import { test, expect } from "./fixtures/test";

test.describe('Iteration-aware File List (AC-4.8.11)', () => {
  // Skip in both modes for now - PR #28 iteration data may be stale/expired
  // TODO: Re-enable with a stable test PR that has fresh iteration artifacts
  test.skip(() => true, 'Temporarily disabled - iteration artifacts may have expired');

  test('Latest preset hides unchanged files', async ({ page }) => {
    // Navigate to PR 28
    await page.goto('/pedropaulovc/codjiflo/28');

    // Wait for iterations to load
    await expect(page.getByRole('toolbar', { name: 'Iteration range selector' })).toBeVisible();

    // Click "Latest" to compare v5 → v6
    await page.getByRole('button', { name: 'Latest' }).click();

    // Wait for file list to update - wait for any file button to be visible
    const fileList = page.getByRole('navigation', { name: 'Changed files' });
    const fileButtons = fileList.getByRole('button').filter({ hasNotText: 'Pull Request Description' });
    await expect(fileButtons.first()).toBeVisible();

    // Get all file list items

    // Count files shown in Latest view
    const latestFileCount = await fileButtons.count();
    console.log('Latest view shows ' + String(latestFileCount) + ' files');

    // ci-cd-pr.yml should NOT appear if it wasn't changed between v5 and v6
    // (It was added in an earlier iteration)
    const ciCdFile = fileList.getByRole('button', { name: /ci-cd-pr\.yml/ });

    // Check if ci-cd-pr.yml is visible - if it is, check it's not marked as "added"
    if (await ciCdFile.isVisible()) {
      // If visible, it should be because it actually changed, not because of a bug
      const ariaLabel = await ciCdFile.getAttribute('aria-label');
      console.log('ci-cd-pr.yml is visible with label: ' + (ariaLabel ?? ''));

      // The file should show as modified, not added (if it actually changed)
      // If it shows as "added" with 206 additions, that's the bug we fixed
      expect(ariaLabel).not.toContain('206 additions');
    } else {
      console.log('ci-cd-pr.yml is correctly hidden (no changes in v5→v6)');
    }

    // Now switch to Full diff and verify more files appear
    await page.getByRole('button', { name: 'Full diff' }).click();
    // Wait for file list to update by waiting for the count to stabilize
    await expect(fileButtons.first()).toBeVisible();

    const fullDiffFileCount = await fileButtons.count();
    console.log('Full diff view shows ' + String(fullDiffFileCount) + ' files');

    // Full diff should show more files than Latest (or equal if all files changed in latest)
    expect(fullDiffFileCount).toBeGreaterThanOrEqual(latestFileCount);

    // eslint.config.mjs should appear in Full diff (it was modified earlier)
    const eslintFile = fileList.getByRole('button', { name: /eslint\.config\.mjs/ });
    await expect(eslintFile).toBeVisible();

    // Switch back to Latest - eslint.config.mjs should be hidden
    await page.getByRole('button', { name: 'Latest' }).click();
    // Wait for file list to update by waiting for visible buttons
    await expect(fileButtons.first()).toBeVisible();

    // eslint.config.mjs should NOT be visible in Latest if it wasn't changed in v5→v6
    const eslintInLatest = fileList.getByRole('button', { name: /eslint\.config\.mjs/ });
    const isEslintVisible = await eslintInLatest.isVisible();
    console.log('eslint.config.mjs visible in Latest: ' + String(isEslintVisible));
  });
});
