/**
 * CodeMirror testing helpers for CodjiFlo E2E tests.
 *
 * This fixture registers CodjiFlo's diff extension classes with playwright-codemirror,
 * enabling semantic locators for CodeMirror elements in tests.
 *
 * @example
 * ```typescript
 * import { CMEditor, expect } from '../../fixtures/codemirror';
 *
 * const editor = CMEditor.from(page);
 * await expect(editor.ext('diff', 'lineAddition')).toHaveCount(5);
 * ```
 */
import { CMEditor } from 'playwright-codemirror';
import type { Locator } from '@playwright/test';

// Re-export for convenience
export { CMEditor, expect, ExtensionRegistryManager } from 'playwright-codemirror';

/**
 * Locator for CodeMirror syntax-highlighting token spans within the rendered lines.
 *
 * CodeMirror's syntax highlighter wraps tokens in `<span>` elements that carry a
 * dynamically-generated class (the `ͼ…` / `tok-…` highlight classes). These are
 * emitted at runtime by CodeMirror, not by CodjiFlo product code, so there is no
 * single stable class or product `data-testid` to register via `ext()`. Counting
 * "any span that has a class" is exactly what verifies that syntax highlighting is
 * present. This helper centralizes that attribute selector behind the sanctioned
 * CMEditor fixture so specs stay free of raw locators.
 */
export function syntaxTokenSpans(editor: CMEditor): Locator {
  return editor.linesInDOM.locator('span[class]');
}

/**
 * Register CodjiFlo's diff extension classes.
 * These map to the classes defined in src/features/diff/components/codemirror/extensions/diff-theme.ts
 */
CMEditor.registerExtension('diff', {
  // Line decorations
  lineAddition: 'cm-diff-line-addition',
  lineDeletion: 'cm-diff-line-deletion',
  lineContext: 'cm-diff-line-context',
  lineHeader: 'cm-diff-line-header',
  lineSpacer: 'cm-diff-line-spacer',

  // Word-level decorations
  wordAdded: 'cm-diff-word-added',
  wordRemoved: 'cm-diff-word-removed',

  // Gutter markers (from diff-theme.ts)
  gutterAddition: 'cm-diff-gutter-addition',
  gutterDeletion: 'cm-diff-gutter-deletion',
  gutterHeader: 'cm-diff-gutter-header',
  gutterSpacer: 'cm-diff-gutter-spacer',

  // Gutter structure (from diff-gutter.ts)
  gutter: 'cm-diff-gutter',
  gutterWrapper: 'cm-diff-gutter-wrapper',
  gutterLeft: 'cm-diff-gutter-left',
  gutterRight: 'cm-diff-gutter-right',
});

/**
 * Register CodeMirror search extension classes.
 * These are from @codemirror/search.
 */
CMEditor.registerExtension('search', {
  match: 'cm-searchMatch',
  matchSelected: 'cm-searchMatch-selected',
});

/**
 * Register CodeMirror whitespace-visibility extension classes.
 * `cm-highlightSpace` is the stable class emitted by CodeMirror's built-in
 * `highlightWhitespace()` extension (enabled in the diff editors when whitespace
 * visibility is toggled on).
 */
CMEditor.registerExtension('whitespace', {
  highlightSpace: 'cm-highlightSpace',
});
