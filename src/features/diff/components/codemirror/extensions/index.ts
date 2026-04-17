/**
 * CodeMirror Extensions Index
 *
 * Re-exports all diff-related CodeMirror extensions.
 */

export { diffTheme, diffThemeClasses } from './diff-theme';
export {
  diffDecorations,
  setDiffLines,
  buildDiffDecorations,
  type DiffDecorationConfig,
} from './diff-decorations';
export {
  diffGutter,
  createDiffGutter,
  setGutterDiffLines,
  setLineNumberMode,
  type DiffGutterConfig,
} from './diff-gutter';
export {
  diffKeymap,
  createDiffKeymap,
  setHunkIndices,
  type DiffKeymapConfig,
} from './diff-keymap';
export {
  scrollSync,
  createScrollSync,
  syncScrollPosition,
  type ScrollSyncConfig,
} from './scroll-sync';
export {
  commentWidgets,
  setCommentThreads,
  setDraftLineIndex,
  setShowComments,
  type CommentWidgetConfig,
} from './comment-widgets';
