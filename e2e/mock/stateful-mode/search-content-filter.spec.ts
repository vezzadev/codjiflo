/**
 * E2E test for Search panel with content filter changes
 *
 * Bug reproduction: When searching with content filter "both" then switching
 * to "left" or "right", the match count should update to reflect the filtered
 * content. Currently the count doesn't update because SearchPanel doesn't
 * receive contentFilter as a dependency.
 */

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

test.describe('Search panel updates with content filter changes', () => {
  // Mock PR with asymmetric content - "original" only on left, "modified" only on right
  const mockPR: MockPR = {
    id: 1,
    number: 500,
    title: 'Test PR for search + content filter',
    body: 'Testing search with content filter',
    state: 'open',
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
    },
    head: { ref: 'feature/search-filter', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    html_url: 'https://github.com/test/repo/pull/500',
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

  // Patch that changes "original" to "modified" - asymmetric content
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
    await setupFullPRMocks(page, 'test', 'repo', 500, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, 'test', 'repo', 500, mockDb);
  });

  test('search count updates when content filter changes via slider in split mode', async ({ page }) => {
    await page.goto('/test/repo/500');
    await page.waitForLoadState('load');

    // Wait for file list to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByRole('status', { name: 'Loading files' })).toHaveCount(0);

    // Wait for iterations to load
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.getByTestId(/^iteration-tab-/)).not.toHaveCount(0);

    // Click on the file to open it in the diff view
    const fileItem = fileList.getByRole('row', { name: /content\.ts/i });
    await fileItem.click();

    // Wait for diff content to load
    const diffArea = page.getByRole('region', { name: /Diff content/i });
    await expect(diffArea).toBeVisible();
    const editor = CMEditor.from(diffArea);
    await expect(editor.content).toBeVisible();

    // Switch to side-by-side view (X key)
    await page.keyboard.press('x');

    // Wait for side-by-side view to render
    const sideBySideView = page.getByRole('region', { name: /Side-by-side diff view/i });
    await expect(sideBySideView).toBeVisible();

    // Ensure content filter is "both" (O key)
    await page.keyboard.press('o');

    // Click on LEFT pane first to set focusedSide
    const leftPane = sideBySideView.getByRole('region', { name: 'Original version' });
    await leftPane.click();

    // Open search panel with Ctrl+F
    await page.keyboard.press('Control+f');

    // Verify search panel is visible
    const searchPanel = page.getByRole('dialog', { name: 'Find in diff' });
    await expect(searchPanel).toBeVisible();

    // Search for "original" - only exists on left side (3 matches)
    const searchInput = searchPanel.getByRole('searchbox', { name: 'Search term' });
    await expect(searchInput).toBeFocused();
    await searchInput.fill('original');

    // Wait for match count to appear
    const matchCount = searchPanel.getByRole('status');
    await expect(matchCount).toBeVisible();
    await expect(matchCount).toContainText('(Left)');
    await expect(matchCount).toContainText('of 3');

    // BUG REPRODUCTION: Change content filter while search panel is open
    // We blur the search input first, then use keyboard shortcut
    await searchInput.blur();
    await page.keyboard.press('r'); // R for Right Only filter

    // The left pane should now be hidden
    await expect(leftPane).toBeHidden();

    // BUG: The match count should update to reflect that we're now searching
    // in the right editor (which has 0 matches for "original")
    // Expected: "(Right)" and "No results"
    // Actual (bug): Count stays at "1 of 3 (Left)" because SearchPanel
    // doesn't know the content filter changed and doesn't recalculate

    // After the fix, search should show "(Right)" and "No results"
    // because "original" doesn't exist in the right side
    await expect(matchCount).toContainText('(Right)');
    await expect(matchCount).toContainText('No results');
  });
});
