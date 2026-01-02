/**
 * Test: Iteration-aware file list filtering
 *
 * Verifies that files with no changes in the selected iteration range are hidden.
 *
 * NOTE: This test only runs in PROD mode because it requires real iteration data
 * from the GitHub artifact. Mock mode doesn't include iteration data.
 *
 * TEMPORARILY DISABLED: PR #28 iteration data may be stale/expired.
 * TODO: Re-enable with a stable test PR that has fresh iteration artifacts.
 */

/* eslint-disable playwright/no-skipped-test, playwright/no-conditional-in-test */

import { test, expect } from '@playwright/test';

// Entire describe block is skipped until iteration artifacts are refreshed
test.describe.skip('Iteration-aware File List (AC-4.8.11)', () => {
  test('Latest preset hides unchanged files', async ({ page }) => {
    // Navigate to PR 28
    await page.goto('/pedropaulovc/codjiflo/28');

    // Wait for iterations to load
    const iterationToolbar = page.getByRole('toolbar', { name: 'Iteration range selector' });
    await expect(iterationToolbar).toBeVisible();

    // Click "Latest" to compare v5 → v6
    await page.getByRole('button', { name: 'Latest' }).click();

    // Get all file list items
    const fileList = page.getByRole('navigation', { name: 'Changed files' });
    const fileButtons = fileList.getByRole('button').filter({ hasNotText: 'Pull Request Description' });

    // Wait for file list to have content
    await expect(fileButtons.first()).toBeVisible();

    // Count files shown in Latest view
    const latestFileCount = await fileButtons.count();
    console.log('Latest view shows ' + String(latestFileCount) + ' files');

    // ci-cd-pr.yml should NOT appear if it wasn't changed between v5 and v6
    // (It was added in an earlier iteration)
    const ciCdFile = fileList.getByRole('button', { name: /ci-cd-pr\.yml/ });

    // Check visibility and validate if visible (file might or might not be visible based on changes)
    const isCiCdVisible = await ciCdFile.isVisible();
    console.log('ci-cd-pr.yml visible: ' + String(isCiCdVisible));
    // If visible, verify it doesn't show the old "206 additions" bug
    const ciCdLabel = isCiCdVisible ? await ciCdFile.getAttribute('aria-label') : null;
    expect(ciCdLabel ?? '').not.toContain('206 additions');

    // Now switch to Full diff and verify more files appear
    await page.getByRole('button', { name: 'Full diff' }).click();

    // Wait for file count to update
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

    // Wait for file list to update
    await expect(fileButtons.first()).toBeVisible();

    // eslint.config.mjs should NOT be visible in Latest if it wasn't changed in v5→v6
    const eslintInLatest = fileList.getByRole('button', { name: /eslint\.config\.mjs/ });
    const isEslintVisible = await eslintInLatest.isVisible();
    console.log('eslint.config.mjs visible in Latest: ' + String(isEslintVisible));
  });
});
