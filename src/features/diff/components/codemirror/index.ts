/**
 * CodeMirror Diff Components
 *
 * Re-exports all CodeMirror-based diff view components and utilities.
 */

// Main components
export { CodeMirrorBase, type CodeMirrorBaseProps, type CodeMirrorBaseHandle } from './CodeMirrorBase';
export { UnifiedDiffEditor, type UnifiedDiffEditorProps, type UnifiedDiffEditorHandle } from './UnifiedDiffEditor';
export { SplitDiffEditor, type SplitDiffEditorProps, type SplitDiffEditorHandle } from './SplitDiffEditor';
export { CommentPortalManager, type CommentPortalManagerProps, type PortalCallbacks } from './CommentPortalManager';

// Extensions
export {
  diffTheme,
  diffThemeClasses,
  diffDecorations,
  setDiffLines,
  buildDiffDecorations,
  diffGutter,
  createDiffGutter,
  setGutterDiffLines,
  setLineNumberMode,
  diffKeymap,
  createDiffKeymap,
  setHunkIndices,
  scrollSync,
  createScrollSync,
  syncScrollPosition,
  commentWidgets,
  setCommentThreads,
  setDraftLineIndex,
  setShowComments,
} from './extensions';

// Utilities
export {
  detectLanguage,
  getLanguageSupport,
  getCachedLanguageSupport,
  preloadLanguage,
  preloadLanguages,
} from './utils/language-registry';
