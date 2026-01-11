/**
 * E2E test for iteration-aware keyboard navigation (Issue #189)
 *
 * Verifies that s/w keyboard shortcuts navigate through iteration-aware files,
 * not GitHub API files.
 */

import { test, expect } from './fixtures/console-warnings';
import { isMockMode } from './fixtures/mode';
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from './fixtures/github-mocks';
import { buildIterationDb } from './fixtures/iteration-db-builder';

test.describe('Iteration Keyboard Navigation (#189)', () => {
  // Mock PR data
  const mockPR: MockPR = {
    id: 1,
    number: 300,
    title: 'Test PR for keyboard navigation',
    body: 'Testing iteration-aware keyboard shortcuts',
    state: 'open',
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
    },
    head: { ref: 'feature/test', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    html_url: 'https://github.com/test/repo/pull/300',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-02T15:00:00Z',
  };

  // Initial files (base state)
  const initialFiles = {
    'file-a.txt': 'Line 1\nLine 2\nLine 3\n',
    'file-b.txt': 'Content B\nMore content\n',
    'file-c.txt': 'Content C\n',
  };

  // Iteration 1: Modify file-a.txt only
  const patch1 = `diff --git a/file-a.txt b/file-a.txt
index 1234567..abcdefg 100644
--- a/file-a.txt
+++ b/file-a.txt
@@ -1,3 +1,3 @@
-Line 1
+Modified Line 1
 Line 2
 Line 3
`;

  // Iteration 2: Modify file-b.txt and file-c.txt (file-a unchanged in this iteration)
  const patch2 = `diff --git a/file-b.txt b/file-b.txt
index 2234567..bbcdefg 100644
--- a/file-b.txt
+++ b/file-b.txt
@@ -1,2 +1,2 @@
-Content B
+Modified Content B
 More content
diff --git a/file-c.txt b/file-c.txt
index 3334567..cbcdefg 100644
--- a/file-c.txt
+++ b/file-c.txt
@@ -1 +1 @@
-Content C
+Modified Content C
`;

  // GitHub API returns all 3 files (full PR diff)
  const mockFiles: MockFile[] = [
    {
      filename: 'file-a.txt',
      status: 'modified',
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: patch1,
    },
    {
      filename: 'file-b.txt',
      status: 'modified',
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: `@@ -1,2 +1,2 @@
-Content B
+Modified Content B
 More content`,
    },
    {
      filename: 'file-c.txt',
      status: 'modified',
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: `@@ -1 +1 @@
-Content C
+Modified Content C`,
    },
  ];

  test.beforeEach(async ({ page }) => {
    test.skip(!isMockMode(), 'Only runs in mock mode');

    await setupAuthState(page);

    // Build mock iteration database with 2 iterations
    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1, patch2],
    });

    // Setup PR mocks and iteration artifact
    await setupFullPRMocks(page, 'test', 'repo', 300, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, 'test', 'repo', 300, mockDb);
  });

  test('s/w navigate through iteration-aware files only', async ({ page }) => {
    await page.goto('/test/repo/300');
    await page.waitForLoadState('load');

    // Wait for file list and iterations to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();

    // Select iteration 1 (only file-a.txt changed)
    const tabs = selector.locator('.iteration-tab');
    await tabs.nth(0).click();

    // Wait for file list to update
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    // In iteration 1, only file-a.txt should be visible
    const fileItems = fileList.getByRole('listitem');
    // Should have 2 items: PR description + file-a.txt
    const visibleFileCount = await fileItems.count();
    expect(visibleFileCount).toBe(2);

    // Click on file-a.txt (second item after PR description)
    await fileItems.nth(1).click();
    await expect(fileItems.nth(1)).toHaveAttribute('aria-current', 'location');

    // Press 's' to go to next file - should do nothing (already at last file)
    await page.keyboard.press('s');
    await expect(fileItems.nth(1)).toHaveAttribute('aria-current', 'location');

    // Press 'w' to go to previous - should go to PR description
    await page.keyboard.press('w');
    await expect(fileItems.first()).toHaveAttribute('aria-current', 'location');

    // Press 's' to go back to file-a.txt
    await page.keyboard.press('s');
    await expect(fileItems.nth(1)).toHaveAttribute('aria-current', 'location');
  });

  test('s/w navigate through multiple visible files in iteration 2', async ({ page }) => {
    await page.goto('/test/repo/300');
    await page.waitForLoadState('load');

    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();

    // Select iteration 2 (file-b.txt and file-c.txt changed)
    const tabs = selector.locator('.iteration-tab');
    await tabs.nth(1).click();

    // Wait for file list to update
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    // In iteration 2, file-b.txt and file-c.txt should be visible
    const fileItems = fileList.getByRole('listitem');
    // Should have 3 items: PR description + file-b.txt + file-c.txt
    const visibleFileCount = await fileItems.count();
    expect(visibleFileCount).toBe(3);

    // Start at PR description
    await fileItems.first().click();
    await expect(fileItems.first()).toHaveAttribute('aria-current', 'location');

    // Press 's' to go to first file (file-b.txt)
    await page.keyboard.press('s');
    await expect(fileItems.nth(1)).toHaveAttribute('aria-current', 'location');

    // Press 's' to go to second file (file-c.txt)
    await page.keyboard.press('s');
    await expect(fileItems.nth(2)).toHaveAttribute('aria-current', 'location');

    // Press 's' again - should stay on last file
    await page.keyboard.press('s');
    await expect(fileItems.nth(2)).toHaveAttribute('aria-current', 'location');

    // Press 'w' to go back to file-b.txt
    await page.keyboard.press('w');
    await expect(fileItems.nth(1)).toHaveAttribute('aria-current', 'location');

    // Press 'w' to go back to PR description
    await page.keyboard.press('w');
    await expect(fileItems.first()).toHaveAttribute('aria-current', 'location');

    // Press 'w' again - should stay on PR description
    await page.keyboard.press('w');
    await expect(fileItems.first()).toHaveAttribute('aria-current', 'location');
  });

  test('default view (latest iteration) shows correct files and keyboard navigation works', async ({ page }) => {
    await page.goto('/test/repo/300');
    await page.waitForLoadState('load');

    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();

    // Default view shows iteration 2 (latest), which has file-b.txt and file-c.txt
    const fileItems = fileList.getByRole('listitem');
    // Should have 3 items: PR description + file-b.txt + file-c.txt
    const visibleFileCount = await fileItems.count();
    expect(visibleFileCount).toBe(3);

    // Navigate through visible files with 's'
    await fileItems.first().click(); // Start at PR description
    await expect(fileItems.first()).toHaveAttribute('aria-current', 'location');

    await page.keyboard.press('s');
    await expect(fileItems.nth(1)).toHaveAttribute('aria-current', 'location');

    await page.keyboard.press('s');
    await expect(fileItems.nth(2)).toHaveAttribute('aria-current', 'location');

    // At last file, 's' does nothing
    await page.keyboard.press('s');
    await expect(fileItems.nth(2)).toHaveAttribute('aria-current', 'location');

    // Navigate back with 'w'
    await page.keyboard.press('w');
    await expect(fileItems.nth(1)).toHaveAttribute('aria-current', 'location');

    await page.keyboard.press('w');
    await expect(fileItems.first()).toHaveAttribute('aria-current', 'location');

    // At PR description, 'w' does nothing
    await page.keyboard.press('w');
    await expect(fileItems.first()).toHaveAttribute('aria-current', 'location');
  });
});
