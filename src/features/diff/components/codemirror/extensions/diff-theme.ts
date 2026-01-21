/**
 * Diff Theme Extension for CodeMirror 6
 *
 * Bridges CSS variables from the app's theme system to CodeMirror's theming.
 * Uses the same CSS variable names defined in variables.css for consistency.
 */

import { EditorView } from '@codemirror/view';

/**
 * CodeMirror theme that uses the app's CSS variables for diff styling.
 * This ensures the diff colors match the selected theme (light/dark/black/high-contrast)
 * and the selected diff color scheme (GitHub, VS, CodeFlow, etc.).
 */
export const diffTheme = EditorView.theme({
  // Base editor styles
  '&': {
    backgroundColor: 'var(--diff-area-bg, var(--main-bg))',
    color: 'var(--main-fg)',
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '14px',
    height: '100%',
  },

  // Content area
  '.cm-content': {
    fontFamily: 'Consolas, "Courier New", monospace',
    padding: '0',
    caretColor: 'var(--main-fg)',
  },

  // Scroller (for scroll sync)
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'Consolas, "Courier New", monospace',
  },

  // Line styles
  '.cm-line': {
    padding: '0 4px',
    lineHeight: 'var(--diff-line-height, 23px)',
    minHeight: 'var(--diff-line-height, 23px)',
  },

  // Selection
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--treeview-selected)',
  },

  // Cursor
  '.cm-cursor': {
    borderLeftColor: 'var(--main-fg)',
  },

  // Active line (disabled for diff view to avoid confusion with diff highlights)
  '&.cm-focused .cm-activeLine': {
    backgroundColor: 'transparent',
  },

  // Gutter styles
  '.cm-gutters': {
    backgroundColor: 'var(--diff-area-bg, var(--main-bg))',
    borderRight: '1px solid var(--control-bg)',
    color: 'var(--watermark-text)',
  },

  '.cm-gutter': {
    minWidth: '48px',
  },

  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 4px',
    minWidth: '48px',
    textAlign: 'right',
    lineHeight: 'var(--diff-line-height, 23px)',
  },

  // ============================================
  // Diff line decorations
  // ============================================

  // Addition line background
  '.cm-diff-line-addition': {
    backgroundColor: 'var(--diff-add-line)',
    color: 'var(--diff-add-fg)',
  },

  '.cm-diff-line-addition .cm-lineNumbers .cm-gutterElement': {
    backgroundColor: 'var(--diff-add-gutter)',
  },

  // Deletion line background
  '.cm-diff-line-deletion': {
    backgroundColor: 'var(--diff-delete-line)',
    color: 'var(--diff-delete-fg)',
  },

  '.cm-diff-line-deletion .cm-lineNumbers .cm-gutterElement': {
    backgroundColor: 'var(--diff-delete-gutter)',
  },

  // Context line (unchanged)
  '.cm-diff-line-context': {
    backgroundColor: 'transparent',
  },

  // Hunk header line
  '.cm-diff-line-header': {
    backgroundColor: 'var(--diff-hunk-line)',
    color: 'var(--diff-hunk-fg)',
    fontStyle: 'italic',
  },

  '.cm-diff-line-header .cm-lineNumbers .cm-gutterElement': {
    backgroundColor: 'var(--diff-hunk-gutter)',
  },

  // Spacer line (for alignment in split view)
  '.cm-diff-line-spacer': {
    backgroundColor: 'var(--diff-empty-line)',
  },

  // ============================================
  // Word-level diff decorations
  // ============================================

  // Word addition highlight
  '.cm-diff-word-added': {
    backgroundColor: 'var(--diff-add-word)',
    color: 'var(--diff-add-word-fg)',
    borderRadius: '2px',
  },

  // Word deletion highlight
  '.cm-diff-word-removed': {
    backgroundColor: 'var(--diff-delete-word)',
    color: 'var(--diff-delete-word-fg)',
    borderRadius: '2px',
  },

  // ============================================
  // Whitespace visibility
  // ============================================

  '.cm-whitespace-space::before': {
    content: '"·"',
    color: 'var(--watermark-text)',
    position: 'absolute',
  },

  '.cm-whitespace-tab::before': {
    content: '"→"',
    color: 'var(--watermark-text)',
    position: 'absolute',
  },

  // ============================================
  // Custom gutter for dual line numbers
  // ============================================

  '.cm-diff-gutter-left': {
    backgroundColor: 'var(--diff-area-bg, var(--main-bg))',
    minWidth: '48px',
    textAlign: 'right',
    padding: '0 4px',
  },

  '.cm-diff-gutter-right': {
    backgroundColor: 'var(--diff-area-bg, var(--main-bg))',
    minWidth: '48px',
    textAlign: 'right',
    padding: '0 4px',
    borderRight: '1px solid var(--control-bg)',
  },

  // Gutter background for additions/deletions
  '.cm-diff-gutter-addition': {
    backgroundColor: 'var(--diff-add-gutter)',
  },

  '.cm-diff-gutter-deletion': {
    backgroundColor: 'var(--diff-delete-gutter)',
  },

  '.cm-diff-gutter-header': {
    backgroundColor: 'var(--diff-hunk-gutter)',
  },

  // ============================================
  // Comment widget styles
  // ============================================

  '.cm-comment-widget': {
    padding: '8px 16px',
    borderTop: '1px solid var(--control-bg)',
    borderBottom: '1px solid var(--control-bg)',
    backgroundColor: 'var(--main-bg)',
  },

  // ============================================
  // Scrollbar styling to match app theme
  // ============================================

  '.cm-scroller::-webkit-scrollbar': {
    width: '10px',
    height: '10px',
  },

  '.cm-scroller::-webkit-scrollbar-track': {
    background: 'var(--control-bg)',
  },

  '.cm-scroller::-webkit-scrollbar-thumb': {
    background: 'var(--scroll-thumb)',
    borderRadius: '2px',
  },

  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    background: 'var(--scroll-hover)',
  },
});

/**
 * Theme classes that can be applied to lines/marks.
 * These are used by the diff-decorations extension.
 */
export const diffThemeClasses = {
  lineAddition: 'cm-diff-line-addition',
  lineDeletion: 'cm-diff-line-deletion',
  lineContext: 'cm-diff-line-context',
  lineHeader: 'cm-diff-line-header',
  lineSpacer: 'cm-diff-line-spacer',
  wordAdded: 'cm-diff-word-added',
  wordRemoved: 'cm-diff-word-removed',
  gutterAddition: 'cm-diff-gutter-addition',
  gutterDeletion: 'cm-diff-gutter-deletion',
  gutterHeader: 'cm-diff-gutter-header',
  gutterSpacer: 'cm-diff-gutter-spacer',
} as const;
