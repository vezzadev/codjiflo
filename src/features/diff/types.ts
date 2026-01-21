import type { FileChange } from '@/api/types';

// ============================================================================
// View Mode Types (S-3.3)
// ============================================================================

export type DiffViewMode = 'inline' | 'split';
export type ContentFilter = 'both' | 'left' | 'right';
export type TextWrap = 'nowrap' | 'wrap';

export interface DiffViewConfig {
  mode: DiffViewMode;
  filter: ContentFilter;
  showFullFile: boolean;
  /** When true, render whitespace characters visibly (· for spaces, → for tabs) */
  showWhitespace: boolean;
  /** When true, show inline comment threads; when false, hide comments and show minimap lasso */
  showComments: boolean;
  /** Text wrap mode: 'nowrap' for horizontal scroll, 'wrap' for line wrapping */
  textWrap: TextWrap;
}

/**
 * Visible row range for virtualized scrolling
 * Used by Minimap to show lasso position
 */
export interface VisibleRowRange {
  startIndex: number;
  stopIndex: number;
}

/**
 * Scroll state for a file, stored as ratio (0-1) to work across view modes
 */
export interface FileScrollState {
  /** Scroll ratio (0-1) representing position in document */
  scrollRatio: number;
  /** Timestamp of last update for debugging */
  lastUpdated: number;
}

/**
 * Content mode for scroll state keying
 * Scroll is preserved within the same content mode but resets when switching
 */
export type ContentMode = 'full' | 'changes';

// ============================================================================
// Diff Line Types
// ============================================================================

export type DiffLineType = 'addition' | 'deletion' | 'context' | 'header' | 'spacer';

export interface ParsedDiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  /** Word-level diff segments for modified lines (S-3.4) */
  wordDiff?: WordDiffSegment[];
}

/**
 * Segment of a word-level diff within a line
 */
export interface WordDiffSegment {
  text: string;
  type: 'added' | 'removed' | 'unchanged';
}

/**
 * Aligned line pair for side-by-side view (S-3.2)
 * null indicates a spacer row for alignment
 */
export interface AlignedDiffLine {
  left: ParsedDiffLine | null;
  right: ParsedDiffLine | null;
  key: string;
}

// ============================================================================
// File Content Types (S-3.1)
// ============================================================================

/**
 * Cached file content for full file view
 */
export interface FileContent {
  path: string;
  ref: string; // SHA or branch
  content: string;
  lines: string[];
  language: string;
}

/**
 * Full file diff with aligned lines ready for rendering
 */
export interface FullFileDiff {
  base: FileContent | null;
  head: FileContent | null;
  diffLines: ParsedDiffLine[];
  alignedLines: AlignedDiffLine[];
}

// ============================================================================
// Store State Types
// ============================================================================

export interface DiffState {
  files: FileChange[];
  selectedFileIndex: number;
  isLoading: boolean;
  error: string | null;

  /** View configuration (S-3.3) - persisted to localStorage */
  viewConfig: DiffViewConfig;

  /** Current hunk index for navigation (-1 = before first, incremented by scrollToNextChange) */
  currentChangeIndex: number;
  /** Total number of hunks (change groups) in current file, set by DiffView */
  totalChangeCount: number;

  /**
   * Scroll state cache keyed by `${filename}:${contentMode}`
   * Stores scroll ratio (0-1) to work across inline/split view modes
   * In-memory only, not persisted
   */
  scrollStateCache: Map<string, FileScrollState>;

  // File actions
  loadFiles: (owner: string, repo: string, number: number) => Promise<void>;
  selectFile: (index: number) => void;
  selectNextFile: () => void;
  selectPreviousFile: () => void;
  reset: () => void;

  // View config actions
  setViewMode: (mode: DiffViewMode) => void;
  setContentFilter: (filter: ContentFilter) => void;
  toggleFullFile: () => void;
  toggleWhitespace: () => void;
  toggleComments: () => void;
  setTextWrap: (wrap: TextWrap) => void;

  // Change navigation actions
  scrollToNextChange: () => void;
  scrollToPreviousChange: () => void;
  resetChangeIndex: () => void;
  setTotalChangeCount: (count: number) => void;

  // Scroll state actions
  saveScrollState: (filename: string, contentMode: ContentMode, scrollRatio: number) => void;
  getScrollState: (filename: string, contentMode: ContentMode) => FileScrollState | undefined;
  clearScrollStateCache: () => void;
}

/**
 * Separate store for file content caching (M4-ready abstraction)
 */
export interface DiffContentState {
  /** Cache of full file contents keyed by `${path}@${ref}` */
  contentCache: Map<string, FileContent>;
  /** Cache of computed full file diffs keyed by `${path}@${baseSHA}:${headSHA}` */
  fullFileDiffs: Map<string, FullFileDiff>;
  isLoadingContent: boolean;

  fetchFileContent: (
    owner: string,
    repo: string,
    path: string,
    ref: string
  ) => Promise<FileContent>;
  computeFullFileDiff: (
    owner: string,
    repo: string,
    path: string,
    baseSHA: string,
    headSHA: string
  ) => Promise<FullFileDiff>;
  clearCache: () => void;
}
