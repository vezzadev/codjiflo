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
  TextWrap,
} from '../../types';

// ============================================================================
// Stage 1: Data Source
// ============================================================================

/**
 * Output of useDiffSource hook
 * Branches: stateless (GitHub API only) vs stateful (artifact available)
 */
export interface DiffSourceOutput {
  /** Raw patch from GitHub API */
  patch: string | undefined;
  /** Current file path */
  filename: string | undefined;
  /** File change status (added, modified, deleted, renamed) */
  fileStatus: FileChangeStatus | undefined;
  /** Pre-computed diff from iteration artifact (null in stateless mode) */
  iterationDiff: FullFileDiff | null;
  /** Whether stateful mode is active (artifact available) */
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
 * Branches: inline (single column) vs split (aligned left/right)
 */
export interface DiffShapeOutput extends DiffFilterOutput {
  /** Aligned line pairs for side-by-side view (empty in inline mode) */
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
  /** Text wrap mode: 'nowrap' for horizontal scroll, 'wrap' for line wrapping */
  textWrap: TextWrap;
}

// ============================================================================
// Stage 5: Side Filter
// ============================================================================

/**
 * Output of useDiffSideFilter hook
 * Applies left/both/right content filter to diffLines and alignedLines.
 * Filtering happens before navigation so hunk indices are correct for filtered view.
 *
 * Type alias for DiffDisplayOutput since filtering modifies inherited fields in place.
 */
export type DiffSideFilterOutput = DiffDisplayOutput;

// ============================================================================
// Stage 6: Navigation
// ============================================================================

/**
 * Output of useDiffNavigation hook
 */
export interface DiffNavigationOutput extends DiffSideFilterOutput {
  /** Indices of first line in each hunk (change group) */
  hunkIndices: number[];
  /** Row index to scroll to for current change (undefined if no target) */
  scrollToRowIndex: number | undefined;
}

// ============================================================================
// Stage 7: Comments
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
