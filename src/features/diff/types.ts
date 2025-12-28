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
 * Display mode for file content
 * ChangesOnly: Show only changed hunks (default)
 * FullFile: Show complete file content
 */
export enum DiffDisplayMode {
  ChangesOnly = 'changes_only',
  FullFile = 'full_file',
}

export interface DiffState {
  files: FileChange[];
  selectedFileIndex: number;
  isLoading: boolean;
  error: string | null;
  viewMode: DiffViewMode;
  contentFilter: DiffContentFilter;
  displayMode: DiffDisplayMode;
  loadFiles: (owner: string, repo: string, number: number) => Promise<void>;
  selectFile: (index: number) => void;
  selectNextFile: () => void;
  selectPreviousFile: () => void;
  setViewMode: (mode: DiffViewMode) => void;
  setContentFilter: (filter: DiffContentFilter) => void;
  setDisplayMode: (mode: DiffDisplayMode) => void;
  reset: () => void;
}

export type DiffLineType = 'addition' | 'deletion' | 'context' | 'header';

export interface ParsedDiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}
