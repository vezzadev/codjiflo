/**
 * E2E test for Search Panel side indicator in split mode
 *
 * Verifies that the search result count changes and shows
 * "(Left)" or "(Right)" indicator when focus switches between
 * panels in side-by-side view.
 */

/* eslint-disable playwright/prefer-web-first-assertions -- comparing nullable textContent() values */
import { test } from '../../fixtures/console-warnings';
import {
  setupAuthState,
  setupFullPRMocks,
  setupIterationArtifactMock,
  type MockPR,
  type MockFile,
} from '../../fixtures/github-mocks';
import { buildIterationDb } from '../../fixtures/iteration-db-builder';
import { CMEditor, expect } from '../../fixtures/codemirror';

test.describe('Search panel side indicator in split mode', () => {
  // Mock PR with asymmetric content (different matches on left vs right)
  const mockPR: MockPR = {
    id: 1,
    number: 450,
    title: 'Test PR for split mode search focus',
    body: 'Testing search side indicator',
    state: 'open',
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
    },
    head: { ref: 'feature/split-search', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    html_url: 'https://github.com/test/repo/pull/450',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-02T15:00:00Z',
  };

  // Initial file content - has 3 occurrences of "original"
  const initialFiles = {
    'content.ts': `// File with searchable content
function originalFunction() {
  // original implementation
  return "original value";
}

function helper() {
  return 42;
}
`,
  };

  // Patch that changes "original" to "modified" - right side has 0 occurrences of "original"
  const patch1 = `diff --git a/content.ts b/content.ts
index 1234567..abcdefg 100644
--- a/content.ts
+++ b/content.ts
@@ -1,9 +1,9 @@
 // File with searchable content
-function originalFunction() {
-  // original implementation
-  return "original value";
+function modifiedFunction() {
+  // modified implementation
+  return "modified value";
 }

 function helper() {
   return 42;
 }
`;

  const mockFiles: MockFile[] = [
    {
      filename: 'content.ts',
      status: 'modified',
      additions: 3,
      deletions: 3,
      changes: 6,
      patch: patch1,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);

    // Build mock iteration database
    const mockDb = buildIterationDb({
      initialFiles,
      patches: [patch1],
    });

    // Setup PR mocks and iteration artifact
    await setupFullPRMocks(page, 'test', 'repo', 450, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, 'test', 'repo', 450, mockDb);
  });

  test('shows "(Right)" indicator when right pane is focused in split mode', async ({ page }) => {
    await page.goto('/test/repo/450');
    await page.waitForLoadState('load');

    // Wait for file list to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByRole('status', { name: 'Loading files' })).toHaveCount(0);

    // Wait for iterations to load
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.getByTestId(/^iteration-tab-/)).not.toHaveCount(0);

    // Click on file to open diff
    const fileItem = fileList.getByRole('treeitem', { name: /content\.ts/i });
    await fileItem.click();

    // Wait for diff content
    const diffArea = page.getByRole('region', { name: /Diff content/i });
    await expect(diffArea).toBeVisible();
    const editor = CMEditor.from(diffArea);
    await expect(editor.content).toBeVisible();

    // Switch to side-by-side mode
    const viewModeButton = page.getByRole('button', { name: 'View mode' });
    await viewModeButton.click();
    const sideBySideOption = page.getByRole('option', { name: /Side-by-Side/i });
    await sideBySideOption.click();

    // Wait for split view to render
    const sideBySideView = page.getByRole('region', { name: /Side-by-side diff view/i });
    await expect(sideBySideView).toBeVisible();

    // Click on right pane to focus it
    const rightPane = page.getByRole('region', { name: 'Modified version' });
    await rightPane.click();

    // Open search panel
    await page.keyboard.press('Control+f');
    const searchPanel = page.getByRole('dialog', { name: 'Find in diff' });
    await expect(searchPanel).toBeVisible();

    // Search for "modified" which only exists in right pane
    const searchInput = searchPanel.getByRole('searchbox', { name: 'Search term' });
    await searchInput.fill('modified');

    // Verify match count shows "(Right)" indicator
    const matchCount = searchPanel.getByRole('status');
    await expect(matchCount).toBeVisible();
    await expect(matchCount).toContainText('(Right)');
    // Should find 3 matches in right side ("modifiedFunction", "modified implementation", "modified value")
    await expect(matchCount).toContainText('of 3');
  });

  test('shows "(Left)" indicator when left pane is focused in split mode', async ({ page }) => {
    await page.goto('/test/repo/450');
    await page.waitForLoadState('load');

    // Wait for file list and iterations to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByRole('status', { name: 'Loading files' })).toHaveCount(0);
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.getByTestId(/^iteration-tab-/)).not.toHaveCount(0);

    // Click on file
    const fileItem = fileList.getByRole('treeitem', { name: /content\.ts/i });
    await fileItem.click();

    // Wait for diff content
    const diffArea = page.getByRole('region', { name: /Diff content/i });
    await expect(diffArea).toBeVisible();
    const editor = CMEditor.from(diffArea);
    await expect(editor.content).toBeVisible();

    // Switch to side-by-side mode
    const viewModeButton = page.getByRole('button', { name: 'View mode' });
    await viewModeButton.click();
    const sideBySideOption = page.getByRole('option', { name: /Side-by-Side/i });
    await sideBySideOption.click();

    // Wait for split view
    const sideBySideView = page.getByRole('region', { name: /Side-by-side diff view/i });
    await expect(sideBySideView).toBeVisible();

    // Click on left pane to focus it
    const leftPane = page.getByRole('region', { name: 'Original version' });
    await leftPane.click();

    // Open search panel
    await page.keyboard.press('Control+f');
    const searchPanel = page.getByRole('dialog', { name: 'Find in diff' });
    await expect(searchPanel).toBeVisible();

    // Search for "original" which only exists in left pane
    const searchInput = searchPanel.getByRole('searchbox', { name: 'Search term' });
    await searchInput.fill('original');

    // Verify match count shows "(Left)" indicator
    const matchCount = searchPanel.getByRole('status');
    await expect(matchCount).toBeVisible();
    await expect(matchCount).toContainText('(Left)');
    // Should find 3 matches in left side ("originalFunction", "original implementation", "original value")
    await expect(matchCount).toContainText('of 3');
  });

  test('result count updates when switching focus between panels', async ({ page }) => {
    await page.goto('/test/repo/450');
    await page.waitForLoadState('load');

    // Wait for file list and iterations to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByRole('status', { name: 'Loading files' })).toHaveCount(0);
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.getByTestId(/^iteration-tab-/)).not.toHaveCount(0);

    // Click on file
    const fileItem = fileList.getByRole('treeitem', { name: /content\.ts/i });
    await fileItem.click();

    // Wait for diff content
    const diffArea = page.getByRole('region', { name: /Diff content/i });
    await expect(diffArea).toBeVisible();
    const editor = CMEditor.from(diffArea);
    await expect(editor.content).toBeVisible();

    // Switch to side-by-side mode
    const viewModeButton = page.getByRole('button', { name: 'View mode' });
    await viewModeButton.click();
    const sideBySideOption = page.getByRole('option', { name: /Side-by-Side/i });
    await sideBySideOption.click();

    // Wait for split view
    const sideBySideView = page.getByRole('region', { name: /Side-by-side diff view/i });
    await expect(sideBySideView).toBeVisible();

    // Click on right pane first
    const rightPane = page.getByRole('region', { name: 'Modified version' });
    await rightPane.click();

    // Open search panel and search for "function" (appears in both sides)
    await page.keyboard.press('Control+f');
    const searchPanel = page.getByRole('dialog', { name: 'Find in diff' });
    await expect(searchPanel).toBeVisible();

    const searchInput = searchPanel.getByRole('searchbox', { name: 'Search term' });
    await searchInput.fill('function');

    // Verify shows "(Right)"
    const matchCount = searchPanel.getByRole('status');
    await expect(matchCount).toBeVisible();
    await expect(matchCount).toContainText('(Right)');

    // Record the current count text for right side
    const rightCountText = await matchCount.textContent();
    expect(rightCountText).toContain('(Right)');

    // Click on left pane to switch focus
    const leftPane = page.getByRole('region', { name: 'Original version' });
    await leftPane.click();

    // Verify indicator changes to "(Left)"
    await expect(matchCount).toContainText('(Left)');

    // The count text should be different (includes "(Left)" instead of "(Right)")
    const leftCountText = await matchCount.textContent();
    expect(leftCountText).not.toBe(rightCountText);
  });

  test('does not show side indicator in inline mode', async ({ page }) => {
    await page.goto('/test/repo/450');
    await page.waitForLoadState('load');

    // Wait for file list and iterations to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByRole('status', { name: 'Loading files' })).toHaveCount(0);
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.getByTestId(/^iteration-tab-/)).not.toHaveCount(0);

    // Click on file
    const fileItem = fileList.getByRole('treeitem', { name: /content\.ts/i });
    await fileItem.click();

    // Wait for diff content (starts in inline mode by default)
    const diffArea = page.getByRole('region', { name: /Diff content/i });
    await expect(diffArea).toBeVisible();
    const editor = CMEditor.from(diffArea);
    await expect(editor.content).toBeVisible();

    // Open search panel (in inline mode)
    await page.keyboard.press('Control+f');
    const searchPanel = page.getByRole('dialog', { name: 'Find in diff' });
    await expect(searchPanel).toBeVisible();

    // Search for "function"
    const searchInput = searchPanel.getByRole('searchbox', { name: 'Search term' });
    await searchInput.fill('function');

    // Verify match count does NOT show "(Left)" or "(Right)" indicator
    const matchCount = searchPanel.getByRole('status');
    await expect(matchCount).toBeVisible();
    await expect(matchCount).not.toContainText('(Left)');
    await expect(matchCount).not.toContainText('(Right)');
  });
});
