/**
 * Pipeline Types for DiffView Refactoring
 *
 * The diff pipeline is a series of composed hooks where each stage handles
 * one concern, branches for variants, and outputs a consistent shape.
 *
 * Pipeline flow:
 * Source → Filter → Shape → Display → SideFilter → Navigation → Comments → render
 */

import type { FileChangeStatus } from '@/api/types';
import type { ReviewThread } from '@/features/comments';
import type {
  ParsedDiffLine,
  AlignedDiffLine,
  FullFileDiff,
  ContentFilter,
  DiffViewMode,
} from '../../types';

// ============================================================================
// Stage 1: Data Source
// ============================================================================

/**
 * Output of useDiffSource hook
 * Branches: degraded (GitHub API only) vs iteration (artifact available)
 */
export interface DiffSourceOutput {
  /** Raw patch from GitHub API */
  patch: string | undefined;
  /** Current file path */
  filename: string | undefined;
  /** File change status (added, modified, deleted, renamed) */
  fileStatus: FileChangeStatus | undefined;
  /** Pre-computed diff from iteration artifact (null in degraded mode) */
  iterationDiff: FullFileDiff | null;
  /** Whether iteration mode is active */
  isIterationMode: boolean;
}

// ============================================================================
// Stage 2: Content Filter
// ============================================================================

/**
 * Output of useDiffFilter hook
 * Branches: full file (from store/DB snapshots) vs changes only (patch-based)
 */
export interface DiffFilterOutput {
  /** Parsed diff lines ready for rendering */
  diffLines: ParsedDiffLine[];
  /** Pre-computed aligned lines (if available from source, with word diffs) */
  sourceAlignedLines: AlignedDiffLine[] | null;
  /** Detected language for syntax highlighting */
  language: string;
  /** True if file is fully added/deleted (all lines are changes) */
  isFullFileChange: boolean;
  /** Pass through from source */
  filename: string | undefined;
  isIterationMode: boolean;
  /** Internal: whether full file content is loading */
  _isLoadingFullFile?: boolean;
  /** Internal: error message from full file fetch */
  _fullFileError?: string | null;
}

// ============================================================================
// Stage 3: View Shape
// ============================================================================

/**
 * Output of useDiffShape hook
 * Branches: unified (single column) vs split (aligned left/right)
 */
export interface DiffShapeOutput extends DiffFilterOutput {
  /** Aligned line pairs for side-by-side view (empty in unified mode) */
  alignedLines: AlignedDiffLine[];
  /** Current view mode */
  viewMode: DiffViewMode;
}

// ============================================================================
// Stage 4: Display Options
// ============================================================================

/**
 * Output of useDiffDisplay hook
 * Branches: whitespace visible/hidden, content filter left/both/right
 */
export interface DiffDisplayOutput extends DiffShapeOutput {
  /** Whether to show whitespace characters */
  showWhitespace: boolean;
  /** Content filter setting */
  contentFilter: ContentFilter;
  /** Line number display mode derived from content filter */
  lineNumberMode: 'left' | 'both' | 'right';
}

// ============================================================================
// Stage 4.5: Side Filter
// ============================================================================

/**
 * Output of useDiffSideFilter hook
 * Applies left/both/right content filter to diffLines and alignedLines.
 * Filtering happens before navigation so hunk indices are correct for filtered view.
 */
export interface DiffSideFilterOutput extends DiffDisplayOutput {
  // diffLines and alignedLines are inherited but now filtered by contentFilter
  // No additional fields - the filtering happens in place
}

// ============================================================================
// Stage 5: Navigation
// ============================================================================

/**
 * Output of useDiffNavigation hook
 */
export interface DiffNavigationOutput extends DiffSideFilterOutput {
  /** Indices of first line in each hunk (change group) */
  hunkIndices: number[];
  /** Row index to scroll to for current change (undefined if no target) */
  scrollToRowIndex: number | undefined;
  /** Whether virtualization is enabled (based on line count) */
  isVirtualized: boolean;
}

// ============================================================================
// Stage 6: Comments
// ============================================================================

/**
 * Output of useDiffComments hook
 * Will grow as comment features expand (M5: floating bubbles, lasso positioning)
 */
export interface DiffCommentsOutput extends DiffNavigationOutput {
  /** Map of "lineNumber-side" → threads for quick lookup during render */
  threadsByLineAndSide: Map<string, ReviewThread[]>;
  // Future: lassoPositions, floatingBubbleCoords, etc.
}

// ============================================================================
// Final Pipeline Output
// ============================================================================

/**
 * Complete output from useDiffPipeline composite hook
 */
export type DiffPipelineOutput = DiffCommentsOutput;
