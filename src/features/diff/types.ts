import type { FileChange } from '@/api/types';

/**
 * Diff view modes - S-3.3
 * Inline: Unified view with changes interleaved
 * SideBySide: Two panels, left=old, right=new
 * LeftOnly: Only original file
 * RightOnly: Only modified file
 */
export enum DiffViewMode {
  Inline = 'inline',
  SideBySide = 'side_by_side',
  LeftOnly = 'left_only',
  RightOnly = 'right_only',
}

/**
 * Content filter for what to show in diff
 * Left: Show only original file with deletions
 * Both: Show standard diff (default)
 * Right: Show only modified file with additions
 */
export enum DiffContentFilter {
  Left = 'left',
  Both = 'both',
  Right = 'right',
}

/**
 * Display mode for file content - S-3.1
 * ChangesOnly: Show only changed hunks (default)
 * FullFile: Show complete file content
 */
export enum DiffDisplayMode {
  ChangesOnly = 'changes_only',
  FullFile = 'full_file',
}

/**
 * Whitespace behavior - S-3.7
 */
export enum WhitespaceBehavior {
  None = 'none',
  Ignore = 'ignore',
}

/**
 * Full file content cache entry - S-3.1 AC-3.1.2
 */
export interface FileContentCache {
  baseContent: string;
  headContent: string;
  baseSha: string;
  headSha: string;
}

export interface DiffState {
  files: FileChange[];
  selectedFileIndex: number;
  isLoading: boolean;
  error: string | null;
  viewMode: DiffViewMode;
  contentFilter: DiffContentFilter;
  displayMode: DiffDisplayMode;
  whitespace: WhitespaceBehavior;
  fileContentCache: Map<string, FileContentCache>;
  loadFiles: (owner: string, repo: string, number: number) => Promise<void>;
  loadFullFileContent: (
    owner: string,
    repo: string,
    filename: string,
    baseSha: string,
    headSha: string
  ) => Promise<void>;
  selectFile: (index: number) => void;
  selectNextFile: () => void;
  selectPreviousFile: () => void;
  setViewMode: (mode: DiffViewMode) => void;
  setContentFilter: (filter: DiffContentFilter) => void;
  setDisplayMode: (mode: DiffDisplayMode) => void;
  setWhitespace: (behavior: WhitespaceBehavior) => void;
  reset: () => void;
}

export type DiffLineType = 'addition' | 'deletion' | 'context' | 'header';

export interface ParsedDiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}
