import type { FileChange } from '@/api/types';

// ============================================================================
// View Mode Types (S-3.3)
// ============================================================================

export type DiffViewMode = 'unified' | 'split';
export type ContentFilter = 'both' | 'left' | 'right';

export interface DiffViewConfig {
  mode: DiffViewMode;
  filter: ContentFilter;
  showFullFile: boolean;
  ignoreWhitespace: boolean;
}

// ============================================================================
// Diff Line Types
// ============================================================================

export type DiffLineType = 'addition' | 'deletion' | 'context' | 'header';

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
  contentError: string | null;

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
