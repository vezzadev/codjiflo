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

// Re-export for convenience
export { CMEditor, expect, ExtensionRegistryManager } from 'playwright-codemirror';

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
