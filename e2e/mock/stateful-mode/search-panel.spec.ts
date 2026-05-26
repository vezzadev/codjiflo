/**
 * E2E test for Search and Go to Line panels
 *
 * Verifies that Ctrl+F opens search panel, search finds matches,
 * F3 navigates through matches, and Ctrl+G opens go-to-line panel.
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

test.describe('Search and Go to Line panels', () => {
  // Mock PR data with file content that has searchable text
  const mockPR: MockPR = {
    id: 1,
    number: 400,
    title: 'Test PR for search panels',
    body: 'Testing search functionality',
    state: 'open',
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
    },
    head: { ref: 'feature/search', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    html_url: 'https://github.com/test/repo/pull/400',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-02T15:00:00Z',
  };

  // Initial file content with repeated searchable text
  const initialFiles = {
    'example.ts': `// Example TypeScript file
function greet(name: string) {
  console.log('Hello, ' + name);
}

function farewell(name: string) {
  console.log('Goodbye, ' + name);
}

function calculate(a: number, b: number) {
  return a + b;
}

// Main function
function main() {
  greet('World');
  farewell('World');
  const result = calculate(1, 2);
  console.log('Result:', result);
}

main();
`,
  };

  // Patch modifying the file
  const patch1 = `diff --git a/example.ts b/example.ts
index 1234567..abcdefg 100644
--- a/example.ts
+++ b/example.ts
@@ -1,5 +1,5 @@
 // Example TypeScript file
-function greet(name: string) {
+export function greet(name: string) {
   console.log('Hello, ' + name);
 }

@@ -10,7 +10,7 @@
   return a + b;
 }

-// Main function
+// Entry point
 function main() {
   greet('World');
   farewell('World');
`;

  const mockFiles: MockFile[] = [
    {
      filename: 'example.ts',
      status: 'modified',
      additions: 2,
      deletions: 2,
      changes: 4,
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
    await setupFullPRMocks(page, 'test', 'repo', 400, {
      pr: mockPR,
      files: mockFiles,
    });
    await setupIterationArtifactMock(page, 'test', 'repo', 400, mockDb);
  });

  test('Ctrl+F opens search panel and finds matches', async ({ page }) => {
    await page.goto('/test/repo/400');
    await page.waitForLoadState('load');

    // Wait for file list to load (skeleton has role="status" with aria-label "Loading files")
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByRole('status', { name: 'Loading files' })).toHaveCount(0);

    // Wait for iterations to load
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.getByTestId(/^iteration-tab-/)).not.toHaveCount(0);

    // Click on the file to open it in the diff view
    const fileItem = fileList.getByRole('treeitem', { name: /example\.ts/i });
    await fileItem.click();

    // Wait for diff content to load using playwright-codemirror
    const diffArea = page.getByRole('region', { name: /Diff content/i });
    await expect(diffArea).toBeVisible();
    const editor = CMEditor.from(diffArea);
    await expect(editor.content).toBeVisible();

    // Open search panel with Ctrl+F
    await page.keyboard.press('Control+f');

    // Verify search panel is visible
    const searchPanel = page.getByRole('dialog', { name: 'Find in diff' });
    await expect(searchPanel).toBeVisible();

    // Type search term
    const searchInput = searchPanel.getByRole('searchbox', { name: 'Search term' });
    await expect(searchInput).toBeFocused();
    await searchInput.fill('function');

    // Verify match count is displayed (the word 'function' appears multiple times)
    const matchCount = searchPanel.getByRole('status');
    await expect(matchCount).toBeVisible();
    await expect(matchCount).not.toHaveText('No results');

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(searchPanel).toBeHidden();
  });

  test('Ctrl+G opens go-to-line panel and jumps to line', async ({ page }) => {
    await page.goto('/test/repo/400');
    await page.waitForLoadState('load');

    // Wait for file list to load (skeleton has role="status" with aria-label "Loading files")
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByRole('status', { name: 'Loading files' })).toHaveCount(0);

    // Wait for iterations to load
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.getByTestId(/^iteration-tab-/)).not.toHaveCount(0);

    // Click on the file to open it in the diff view
    const fileItem = fileList.getByRole('treeitem', { name: /example\.ts/i });
    await fileItem.click();

    // Wait for diff content to load using playwright-codemirror
    const diffArea = page.getByRole('region', { name: /Diff content/i });
    await expect(diffArea).toBeVisible();
    const editor = CMEditor.from(diffArea);
    await expect(editor.content).toBeVisible();

    // Open go-to-line panel with Ctrl+G
    await page.keyboard.press('Control+g');

    // Verify go-to-line panel is visible
    const gotoPanel = page.getByRole('dialog', { name: 'Go to line' });
    await expect(gotoPanel).toBeVisible();

    // Type line number - input has id="goto-line-input" and label "Go to Line:"
    const lineInput = gotoPanel.getByRole('textbox', { name: /Go to Line/i });
    await expect(lineInput).toBeFocused();
    await lineInput.fill('10');

    // Press Enter to go to line
    await page.keyboard.press('Enter');

    // Panel should close after navigation
    await expect(gotoPanel).toBeHidden();
  });

  test('search persists when switching between inline and side-by-side view', async ({ page }) => {
    await page.goto('/test/repo/400');
    await page.waitForLoadState('load');

    // Wait for file list and iterations to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByRole('status', { name: 'Loading files' })).toHaveCount(0);
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.getByTestId(/^iteration-tab-/)).not.toHaveCount(0);

    // Click on file to open diff
    const fileItem = fileList.getByRole('treeitem', { name: /example\.ts/i });
    await fileItem.click();

    // Wait for diff content
    const diffArea = page.getByRole('region', { name: /Diff content/i });
    await expect(diffArea).toBeVisible();
    const editor = CMEditor.from(diffArea);
    await expect(editor.content).toBeVisible();

    // Open search and type a term
    await page.keyboard.press('Control+f');
    const searchPanel = page.getByRole('dialog', { name: 'Find in diff' });
    await expect(searchPanel).toBeVisible();
    const searchInput = searchPanel.getByRole('searchbox', { name: 'Search term' });
    await searchInput.fill('function');

    // Verify initial match count
    const matchCount = searchPanel.getByRole('status');
    await expect(matchCount).toBeVisible();
    await expect(matchCount).not.toHaveText('No results');

    // Switch view mode (click View mode button to open dropdown)
    const viewModeButton = page.getByRole('button', { name: 'View mode' });
    await viewModeButton.click();

    // Select "Side-by-Side" from dropdown (it's a listbox with options)
    const sideBySideOption = page.getByRole('option', { name: /Side-by-Side/i });
    await sideBySideOption.click();

    // Wait for new editor to render (side-by-side has different structure)
    const sideBySideView = page.getByRole('region', { name: /Side-by-side diff view/i });
    await expect(sideBySideView).toBeVisible();

    // Verify search still works by pressing F3 and checking match count updates
    // If search wasn't re-applied, F3 would do nothing and count would stay at "1 of X"
    const initialCount = await matchCount.textContent();

    // Press F3 to navigate to next match
    await page.keyboard.press('F3');

    // Match count should change (e.g., from "1 of 5" to "2 of 5")
    // This proves the search is active on the new editor
    await expect(matchCount).not.toHaveText(initialCount ?? '');
  });
});
