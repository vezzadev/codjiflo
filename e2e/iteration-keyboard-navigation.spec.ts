/**
 * E2E test for iteration-aware keyboard navigation (Issue #189)
 *
 * Verifies that s/w keyboard shortcuts navigate through iteration-aware files,
 * not GitHub API files.
 */

import { test, expect } from './fixtures/console-warnings';
import { isMockMode } from './fixtures/mode';

test.describe('Iteration Keyboard Navigation (#189)', () => {
  test('s/w should navigate through iteration-aware files only', async ({ page }) => {
    test.skip(!isMockMode(), 'This test requires mock mode for controlled artifact data');

    // Navigate to PR with iterations (codjiflo/action#7)
    await page.goto('/repos/codjiflo/action/pull/7');

    // Wait for file list to load
    await page.waitForSelector('[data-testid="file-list-item"]');

    // Select iteration 1 (which should have artifact-only files)
    const iterationSelector = page.getByTestId('iteration-selector');
    await iterationSelector.click();
    await page.getByText('1', { exact: true }).click();

    // Wait for iteration diff to load
    await page.waitForSelector('[data-testid="file-list-item"]');

    // Get the list of visible files in iteration 1
    const fileListItems = page.getByTestId('file-list-item');
    const visibleFileCount = await fileListItems.count();

    // Verify we have visible files
    expect(visibleFileCount).toBeGreaterThan(0);

    // Click on the first file to select it
    await fileListItems.first().click();

    // Verify the file is selected (use aria-current attribute)
    await expect(fileListItems.first()).toHaveAttribute('aria-current', 'location');

    // Press 's' to go to next file
    await page.keyboard.press('s');

    // The selected file should now be the second file in the visible list
    if (visibleFileCount > 1) {
      await expect(fileListItems.nth(1)).toHaveAttribute('aria-current', 'location');
    } else {
      // If only one file, should stay on the same file
      await expect(fileListItems.first()).toHaveAttribute('aria-current', 'location');
    }

    // Press 'w' to go back to previous file
    await page.keyboard.press('w');

    // Should be back to the first file
    await expect(fileListItems.first()).toHaveAttribute('aria-current', 'location');
  });

  test('s should not navigate beyond visible iteration files', async ({ page }) => {
    test.skip(!isMockMode(), 'This test requires mock mode for controlled artifact data');

    // Navigate to PR with iterations
    await page.goto('/repos/codjiflo/action/pull/7');

    // Wait for file list
    await page.waitForSelector('[data-testid="file-list-item"]');

    // Select iteration 1
    const iterationSelector = page.getByTestId('iteration-selector');
    await iterationSelector.click();
    await page.getByText('1', { exact: true }).click();

    await page.waitForSelector('[data-testid="file-list-item"]');

    const fileListItems = page.getByTestId('file-list-item');
    const visibleFileCount = await fileListItems.count();
    console.log(`Found ${visibleFileCount} visible files in iteration 1`);

    // Navigate to the last visible file
    await fileListItems.last().click();

    // Verify the last file is selected
    await expect(fileListItems.last()).toHaveAttribute('aria-current', 'location');

    // Press 's' - should NOT navigate to files outside the iteration view
    await page.keyboard.press('s');

    // Should still be on the last file (can't go beyond)
    await expect(fileListItems.last()).toHaveAttribute('aria-current', 'location');
  });

  test('w should not navigate before first iteration file', async ({ page }) => {
    test.skip(!isMockMode(), 'This test requires mock mode for controlled artifact data');

    await page.goto('/repos/codjiflo/action/pull/7');
    await page.waitForSelector('[data-testid="file-list-item"]');

    // Select iteration 1
    const iterationSelector = page.getByTestId('iteration-selector');
    await iterationSelector.click();
    await page.getByText('1', { exact: true }).click();

    await page.waitForSelector('[data-testid="file-list-item"]');

    const fileListItems = page.getByTestId('file-list-item');

    // Click first file
    await fileListItems.first().click();

    // Verify first file is selected
    await expect(fileListItems.first()).toHaveAttribute('aria-current', 'location');

    // Press 'w' - should go back to PR description (not stay on first file)
    await page.keyboard.press('w');

    // Should now be on PR description
    const prDescButton = page.getByRole('listitem').filter({ hasText: 'Pull Request Description' });
    await expect(prDescButton).toHaveAttribute('aria-current', 'location');
  });
});
