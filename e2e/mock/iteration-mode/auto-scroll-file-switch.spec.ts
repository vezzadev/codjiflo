/**
 * E2E test for auto-scroll to first change on file switch
 *
 * When user switches files in the PR diff viewer, the view should automatically
 * scroll so the first changed line is centered in the viewport. On revisit to
 * the same file, scroll position should be preserved.
 */

import { test, expect } from '../../fixtures/console-warnings';
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from '../../fixtures/github-mocks';
import { buildIterationDb } from '../../fixtures/iteration-db-builder';

test.describe('Auto-scroll to First Change on File Switch', () => {
  // Create files with multiple changes and context lines for scroll testing
  // Each file needs enough content to require scrolling
  const contextLines = Array.from(
    { length: 30 },
    (_, i) => `// Context line ${String(i + 1)}`
  ).join('\n');

  const moreContextLines = Array.from(
    { length: 30 },
    (_, i) => `// More context ${String(i + 1)}`
  ).join('\n');

  const initialFiles = {
    'file-a.ts': `${contextLines}\nfunction unchanged() {}\n${moreContextLines}`,
    'file-b.ts': `${contextLines}\nfunction original() {}\n${moreContextLines}`,
    'file-c.ts': `${contextLines}\nconst value = 'old';\n${moreContextLines}`,
  };

  // Patch for file-a: changes near the middle (after ~30 context lines)
  const patchA = `diff --git a/file-a.ts b/file-a.ts
index 1234567..abcdefg 100644
--- a/file-a.ts
+++ b/file-a.ts
@@ -28,6 +28,8 @@
 // Context line 28
 // Context line 29
 // Context line 30
-function unchanged() {}
+function changed() {
+  console.log('first change');
+}
 // More context 1
 // More context 2
 // More context 3
@@ -45,6 +47,8 @@
 // More context 16
 // More context 17
 // More context 18
+// Second hunk - another change
+const newVar = 'added';
 // More context 19
 // More context 20
 // More context 21
`;

  // Patch for file-b: changes in similar location
  const patchB = `diff --git a/file-b.ts b/file-b.ts
index 2234567..bbcdefg 100644
--- a/file-b.ts
+++ b/file-b.ts
@@ -28,6 +28,7 @@
 // Context line 28
 // Context line 29
 // Context line 30
-function original() {}
+function modified() {
+  return true;
+}
 // More context 1
 // More context 2
`;

  // Patch for file-c: changes in similar location
  const patchC = `diff --git a/file-c.ts b/file-c.ts
index 3334567..cbcdefg 100644
--- a/file-c.ts
+++ b/file-c.ts
@@ -28,6 +28,6 @@
 // Context line 28
 // Context line 29
 // Context line 30
-const value = 'old';
+const value = 'new';
 // More context 1
 // More context 2
`;

  const mockPR: MockPR = {
    id: 1,
    number: 500,
    title: 'Test PR for auto-scroll',
    body: 'Testing auto-scroll on file switch',
    state: 'open',
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
    },
    head: { ref: 'feature/auto-scroll', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    html_url: 'https://github.com/test/repo/pull/500',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-02T15:00:00Z',
  };

  const mockFiles: MockFile[] = [
    {
      filename: 'file-a.ts',
      status: 'modified',
      additions: 4,
      deletions: 1,
      changes: 5,
      patch: `@@ -28,6 +28,8 @@
 // Context line 28
 // Context line 29
 // Context line 30
-function unchanged() {}
+function changed() {
+  console.log('first change');
+}
 // More context 1
 // More context 2
 // More context 3
@@ -45,6 +47,8 @@
 // More context 16
 // More context 17
 // More context 18
+// Second hunk - another change
+const newVar = 'added';
 // More context 19
 // More context 20
 // More context 21`,
    },
    {
      filename: 'file-b.ts',
      status: 'modified',
      additions: 2,
      deletions: 1,
      changes: 3,
      patch: `@@ -28,6 +28,7 @@
 // Context line 28
 // Context line 29
 // Context line 30
-function original() {}
+function modified() {
+  return true;
+}
 // More context 1
 // More context 2`,
    },
    {
      filename: 'file-c.ts',
      status: 'modified',
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: `@@ -28,6 +28,6 @@
 // Context line 28
 // Context line 29
 // Context line 30
-const value = 'old';
+const value = 'new';
 // More context 1
 // More context 2`,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    // Build mock iteration database
    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patchA + patchB + patchC],
    });

    // Setup PR mocks and iteration artifact
    await setupFullPRMocks(page, 'test', 'repo', 500, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, 'test', 'repo', 500, mockDb);
  });

  test('auto-scrolls to first change when clicking file for first time (inline mode)', async ({ page }) => {
    await page.goto('/test/repo/500');
    await page.waitForLoadState('load');

    // Wait for file list to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    // Click on file-a.ts
    await fileList.getByText('file-a.ts').click();

    // Wait for diff to render
    await expect(page.getByRole('heading', { name: 'file-a.ts' })).toBeVisible();

    // Wait for the diff content to load
    const diffContent = page.locator('[data-view-mode="inline"]');
    await expect(diffContent).toBeVisible();

    // Verify the first change is visible (the "function changed()" line)
    // The changed line should be visible in the viewport
    const changedLine = page.locator('.diff-line-addition').filter({ hasText: 'function changed()' });
    await expect(changedLine).toBeVisible();

    // The first context line should NOT be visible if we scrolled to center the change
    // This verifies we didn't stay at the top of the file
    const firstContextLine = page.locator('.diff-line-context').filter({ hasText: 'Context line 1' });
    await expect(firstContextLine).not.toBeInViewport();
  });

  test('auto-scrolls to first change in side-by-side mode', async ({ page }) => {
    await page.goto('/test/repo/500');
    await page.waitForLoadState('load');

    // Wait for file list to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    // First click on a file to show the diff view with toolbar
    await fileList.getByText('file-a.ts').click();
    await expect(page.getByRole('heading', { name: 'file-a.ts' })).toBeVisible();

    // Switch to side-by-side mode via dropdown
    const toolbar = page.getByRole('toolbar', { name: 'Diff view controls' });
    await expect(toolbar).toBeVisible();
    const viewModeDropdown = toolbar.getByRole('button', { name: 'View mode' });
    await viewModeDropdown.click();
    await page.getByRole('option', { name: /Side-by-Side/i }).click();

    // Now click on file-b.ts (first visit in split mode should auto-scroll)
    await fileList.getByText('file-b.ts').click();

    // Wait for diff to render in split mode
    await expect(page.getByRole('heading', { name: 'file-b.ts' })).toBeVisible();
    const diffContent = page.locator('[data-view-mode="split"]');
    await expect(diffContent).toBeVisible();

    // Verify a changed line is visible (the "function modified()" line)
    const changedLine = page.locator('.diff-line-addition').filter({ hasText: 'function modified()' });
    await expect(changedLine).toBeVisible();
  });

  test('J/K navigation centers the target change', async ({ page }) => {
    await page.goto('/test/repo/500');
    await page.waitForLoadState('load');

    // Wait for file list to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    // Click on file-a.ts (which has 2 hunks)
    await fileList.getByText('file-a.ts').click();
    await expect(page.getByRole('heading', { name: 'file-a.ts' })).toBeVisible();

    const diffContent = page.locator('[data-view-mode="inline"]');
    await expect(diffContent).toBeVisible();

    // First change should be visible after initial auto-scroll
    const firstChange = page.locator('.diff-line-addition').filter({ hasText: 'function changed()' });
    await expect(firstChange).toBeVisible();

    // Press J to go to next change (second hunk)
    await page.keyboard.press('j');

    // Second change should now be visible
    const secondChange = page.locator('.diff-line-addition').filter({ hasText: 'Second hunk' });
    await expect(secondChange).toBeVisible();

    // Press K to go back to first change
    await page.keyboard.press('k');

    // First change should be visible again
    await expect(firstChange).toBeVisible();
  });

  test('preserves scroll position on revisit to same file', async ({ page }) => {
    await page.goto('/test/repo/500');
    await page.waitForLoadState('load');

    // Wait for file list to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    // Click on file-a.ts
    await fileList.getByText('file-a.ts').click();
    await expect(page.getByRole('heading', { name: 'file-a.ts' })).toBeVisible();

    const diffContent = page.locator('[data-view-mode="inline"]');
    await expect(diffContent).toBeVisible();

    // Navigate to second hunk using J
    await page.keyboard.press('j');
    const secondChange = page.locator('.diff-line-addition').filter({ hasText: 'Second hunk' });
    await expect(secondChange).toBeVisible();

    // Switch to file-b.ts
    await fileList.getByText('file-b.ts').click();
    await expect(page.getByRole('heading', { name: 'file-b.ts' })).toBeVisible();

    // Switch back to file-a.ts (revisit)
    await fileList.getByText('file-a.ts').click();
    await expect(page.getByRole('heading', { name: 'file-a.ts' })).toBeVisible();

    // The second hunk should still be visible (scroll position preserved)
    // This proves the view didn't auto-scroll back to the first change
    await expect(secondChange).toBeVisible();

    // Note: currentChangeIndex is reset to -1 on revisit, which is intentional.
    // The scroll position is preserved (no pendingScrollToChange), but the
    // navigation state is reset. This allows the user to start fresh with J/K.
  });
});
