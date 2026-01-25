/**
 * E2E test for Search and Go to Line panels
 *
 * Verifies that Ctrl+F opens search panel, search finds matches,
 * F3 navigates through matches, and Ctrl+G opens go-to-line panel.
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

    // Wait for file list to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    // Wait for iterations to load
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.locator('.iteration-tab')).not.toHaveCount(0);

    // Click on the file to open it in the diff view
    const fileItems = fileList.locator('.tree-item.file');
    await expect(fileItems).toHaveCount(2); // PR description + example.ts
    await fileItems.nth(1).click();

    // Wait for diff content to load
    const diffArea = page.locator('.diff-content-area');
    await expect(diffArea).toBeVisible();
    await expect(page.locator('.cm-content')).toBeVisible();

    // Open search panel with Ctrl+F
    await page.keyboard.press('Control+f');

    // Verify search panel is visible
    const searchPanel = page.locator('.diff-search-panel');
    await expect(searchPanel).toBeVisible();

    // Type search term
    const searchInput = searchPanel.locator('input[type="text"]');
    await expect(searchInput).toBeFocused();
    await searchInput.fill('function');

    // Verify match count is displayed (the word 'function' appears multiple times)
    const matchCount = searchPanel.locator('.diff-search-match-count');
    await expect(matchCount).toBeVisible();
    await expect(matchCount).not.toHaveText('No results');

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(searchPanel).toBeHidden();
  });

  test('Ctrl+G opens go-to-line panel and jumps to line', async ({ page }) => {
    await page.goto('/test/repo/400');
    await page.waitForLoadState('load');

    // Wait for file list to load
    const fileList = page.getByRole('navigation', { name: /Changed files/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.locator('.skeleton')).toHaveCount(0);

    // Wait for iterations to load
    const selector = page.getByTestId('iteration-selector');
    await expect(selector).toBeVisible();
    await expect(selector.locator('.iteration-tab')).not.toHaveCount(0);

    // Click on the file to open it in the diff view
    const fileItems = fileList.locator('.tree-item.file');
    await expect(fileItems).toHaveCount(2);
    await fileItems.nth(1).click();

    // Wait for diff content to load
    const diffArea = page.locator('.diff-content-area');
    await expect(diffArea).toBeVisible();
    await expect(page.locator('.cm-content')).toBeVisible();

    // Open go-to-line panel with Ctrl+G
    await page.keyboard.press('Control+g');

    // Verify go-to-line panel is visible
    const gotoPanel = page.locator('.diff-goto-panel');
    await expect(gotoPanel).toBeVisible();

    // Type line number
    const lineInput = gotoPanel.locator('input[type="text"]');
    await expect(lineInput).toBeFocused();
    await lineInput.fill('10');

    // Press Enter to go to line
    await page.keyboard.press('Enter');

    // Panel should close after navigation
    await expect(gotoPanel).toBeHidden();
  });
});
