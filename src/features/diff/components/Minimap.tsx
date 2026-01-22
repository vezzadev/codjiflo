/**
 * Minimap Component
 *
 * Provides a birds-eye view of the entire diff with:
 * - Two vertical bars (left: deletions, right: additions)
 * - Viewport lasso showing visible portion
 * - Click and drag navigation (25% viewport positioning)
 *
 * See spec/functional/diff-viewing.md "Overview Margin (Minimap)" section
 */

import { useCallback, useRef, useState, type RefObject, useMemo } from 'react';
import type { DiffPipelineOutput } from '../hooks/pipeline/types';
import { useMinimapScroll } from '../hooks/useMinimapScroll';
import {
  MINIMAP_CONSTANTS,
  calculateDiffRegions,
  calculateAsymmetricViewportLasso,
  generateLassoPath,
  getClickSide,
  countLinesByType,
  calculateBarHeights,
  type DiffRegion,
  type VisibleLineRange,
} from '../utils/minimap-mapping';
import type { ParsedDiffLine, VisibleRowRange } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface NavigateEvent {
  /** Target line number (0-indexed) */
  lineNumber: number;
  /** Which side was clicked/dragged */
  side: 'left' | 'right';
  /** Type of navigation action */
  type: 'click' | 'drag';
}

interface MinimapProps {
  /** Pipeline output containing diff data */
  pipeline: DiffPipelineOutput;
  /** Container height for viewport calculations */
  containerHeight: number;
  /** Ref to scroll container for scroll tracking and navigation */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** Whether full file mode is enabled (hides lasso in changes-only mode) */
  showFullFile: boolean;
  /** When true, comments are shown and lasso is hidden; when false, comments hidden and lasso visible */
  showComments: boolean;
  /** Callback when user navigates via click or drag */
  onNavigate?: (event: NavigateEvent) => void;
  /** Visible row range from react-window (for accurate lasso positioning) */
  visibleRowRange?: VisibleRowRange | null;
}

// ============================================================================
// Constants
// ============================================================================

const { WIDTH, BAR_WIDTH, LEFT_BAR_X, RIGHT_BAR_X, PADDING_VERTICAL } = MINIMAP_CONSTANTS;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Result type for visible line range calculation
 * Includes anchor positions for when one side has no visible content
 */
interface VisibleLineRangesResult {
  left: VisibleLineRange | null;
  right: VisibleLineRange | null;
  /** Last left line number before visible range (for positioning when left is null) */
  leftAnchor: number | null;
  /** Last right line number before visible range (for positioning when right is null) */
  rightAnchor: number | null;
}

/**
 * Minimum number of visible lines required to use visibleRange calculation.
 * Below this threshold, we use anchor-based calculation to avoid jitter
 * when borderline context lines enter/exit the viewport during scroll.
 */
const MIN_VISIBLE_LINES_FOR_RANGE = 3;

/**
 * Calculate visible line ranges from row indices and diff lines
 *
 * This function maps visible row indices (from react-window) to actual file
 * line numbers by examining the diff lines in that range.
 *
 * When one side has no visible lines (e.g., viewing pure additions), it also
 * provides an "anchor" - the last line number from that side before the visible
 * range. This allows consistent lasso positioning during transitions.
 *
 * To prevent jitter at boundaries, when only 1-2 lines are visible on a side,
 * we treat it as "no visible lines" and use anchor-based positioning instead.
 * This provides smoother transitions when scrolling through regions where
 * one side has sparse content (e.g., scrolling through additions where only
 * occasional context lines appear on the left).
 */
function calculateVisibleLineRangesFromRows(
  startIndex: number,
  stopIndex: number,
  diffLines: ParsedDiffLine[]
): VisibleLineRangesResult {
  if (diffLines.length === 0) {
    return { left: null, right: null, leftAnchor: null, rightAnchor: null };
  }

  // Clamp indices to valid range
  const firstRow = Math.max(0, startIndex);
  const lastRow = Math.min(diffLines.length - 1, stopIndex);

  // Find actual line numbers from visible diff rows
  let leftFirst: number | null = null;
  let leftLast: number | null = null;
  let rightFirst: number | null = null;
  let rightLast: number | null = null;
  let leftCount = 0;
  let rightCount = 0;

  for (let i = firstRow; i <= lastRow; i++) {
    const line = diffLines[i];
    if (!line) continue;

    // Track left side line numbers (deletions and context)
    if (line.oldLineNumber != null) {
      leftFirst ??= line.oldLineNumber;
      leftLast = line.oldLineNumber;
      leftCount++;
    }

    // Track right side line numbers (additions and context)
    if (line.newLineNumber != null) {
      rightFirst ??= line.newLineNumber;
      rightLast = line.newLineNumber;
      rightCount++;
    }
  }

  // Find anchor positions by looking at rows before the visible range
  // These are used when one side has no visible content (or too few lines)
  let leftAnchor: number | null = null;
  let rightAnchor: number | null = null;

  // Use anchor-based calculation when visible lines are below threshold
  // This prevents jitter when borderline context lines enter/exit viewport
  const useLeftAnchor = leftFirst === null || leftCount < MIN_VISIBLE_LINES_FOR_RANGE;
  const useRightAnchor = rightFirst === null || rightCount < MIN_VISIBLE_LINES_FOR_RANGE;

  if (useLeftAnchor) {
    // Find the last left line before or within the visible range
    // Start from lastRow to find the most recent left line
    for (let i = lastRow; i >= 0; i--) {
      const line = diffLines[i];
      if (line?.oldLineNumber != null) {
        leftAnchor = line.oldLineNumber;
        break;
      }
    }
  }

  if (useRightAnchor) {
    // Find the last right line before or within the visible range
    for (let i = lastRow; i >= 0; i--) {
      const line = diffLines[i];
      if (line?.newLineNumber != null) {
        rightAnchor = line.newLineNumber;
        break;
      }
    }
  }

  return {
    // Only return visible range if we have enough lines (not borderline)
    left: leftFirst !== null && leftLast !== null && !useLeftAnchor
      ? { firstLine: leftFirst, lastLine: leftLast }
      : null,
    right: rightFirst !== null && rightLast !== null && !useRightAnchor
      ? { firstLine: rightFirst, lastLine: rightLast }
      : null,
    leftAnchor: useLeftAnchor ? leftAnchor : null,
    rightAnchor: useRightAnchor ? rightAnchor : null,
  };
}

/**
 * Find the diff row index containing a specific line number
 * @param diffLines - Array of parsed diff lines
 * @param targetLine - The 1-indexed line number to find
 * @param side - Which side ('left' for oldLineNumber, 'right' for newLineNumber)
 * @returns Row index (0-indexed) or -1 if not found
 */
function findRowIndexByLineNumber(
  diffLines: ParsedDiffLine[],
  targetLine: number,
  side: 'left' | 'right'
): number {
  const lineKey = side === 'left' ? 'oldLineNumber' : 'newLineNumber';

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];
    if (line?.[lineKey] === targetLine) {
      return i;
    }
  }

  // If exact line not found, find the closest row
  // (can happen if target line is in an addition-only or deletion-only region)
  let closestIndex = -1;
  let closestDistance = Infinity;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];
    const lineNum = line?.[lineKey];
    if (lineNum !== null && lineNum !== undefined) {
      const distance = Math.abs(lineNum - targetLine);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
  }

  return closestIndex;
}

// ============================================================================
// Component
// ============================================================================

export function Minimap({
  pipeline,
  containerHeight,
  scrollContainerRef,
  showFullFile,
  showComments,
  onNavigate,
  visibleRowRange,
}: MinimapProps) {
  const { diffLines, alignedLines, viewMode, contentFilter, filename } = pipeline;

  // Determine if bars should be disabled based on content filter
  const isLeftDisabled = contentFilter === 'right';
  const isRightDisabled = contentFilter === 'left';

  // Scroll tracking - pass filename as contentKey to refresh state when file changes
  const { scrollState } = useMinimapScroll(scrollContainerRef, containerHeight, filename);

  // Mouse drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragSideRef = useRef<'left' | 'right'>('left');
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate render dimensions
  const renderAreaTop = PADDING_VERTICAL;
  const renderAreaHeight = containerHeight - 2 * PADDING_VERTICAL;

  // Get line counts for current view mode
  const lineCounts = useMemo(() => {
    const lines = viewMode === 'split' ? alignedLines : diffLines;
    return countLinesByType(lines, viewMode === 'split' ? 'side-by-side' : 'inline');
  }, [viewMode, alignedLines, diffLines]);

  // Calculate bar heights (proportional to line counts)
  const barHeights = useMemo(() => {
    return calculateBarHeights(
      lineCounts.leftLineCount,
      lineCounts.rightLineCount,
      renderAreaHeight
    );
  }, [lineCounts, renderAreaHeight]);

  // Center bars vertically within render area
  const leftBarTop = renderAreaTop + (renderAreaHeight - barHeights.leftHeight) / 2;
  const rightBarTop = renderAreaTop + (renderAreaHeight - barHeights.rightHeight) / 2;

  // Calculate diff regions for highlighting
  const regions = useMemo(() => {
    const lines = viewMode === 'split' ? alignedLines : diffLines;
    return calculateDiffRegions(lines, viewMode === 'split' ? 'side-by-side' : 'inline');
  }, [viewMode, alignedLines, diffLines]);

  // Calculate visible line ranges from row indices provided by react-window
  // This gives accurate lasso positioning based on what's actually visible in the viewport
  const visibleRanges = useMemo(() => {
    if (!showFullFile || showComments || !visibleRowRange) {
      return { left: null, right: null, leftAnchor: null, rightAnchor: null };
    }
    return calculateVisibleLineRangesFromRows(
      visibleRowRange.startIndex,
      visibleRowRange.stopIndex,
      diffLines
    );
  }, [showFullFile, showComments, visibleRowRange, diffLines]);

  // Calculate viewport lasso position
  const lasso = useMemo(() => {
    // Lasso is hidden when:
    // 1. Not in full file mode
    // 2. Comments are visible (showComments=true)
    // 3. Visible row range not yet available from react-window
    //    This prevents the lasso from appearing before react-window reports
    //    which rows are visible.
    if (!showFullFile || showComments || !visibleRowRange) {
      return null;
    }

    return calculateAsymmetricViewportLasso({
      scrollRatio: scrollState.scrollRatio,
      viewportRatio: scrollState.viewportRatio,
      leftLineCount: lineCounts.leftLineCount,
      rightLineCount: lineCounts.rightLineCount,
      leftBarTop,
      leftBarHeight: barHeights.leftHeight,
      rightBarTop,
      rightBarHeight: barHeights.rightHeight,
      visibleLeftRange: visibleRanges.left,
      visibleRightRange: visibleRanges.right,
      leftAnchor: visibleRanges.leftAnchor,
      rightAnchor: visibleRanges.rightAnchor,
    });
  }, [
    showFullFile,
    showComments,
    visibleRowRange,
    scrollState,
    lineCounts,
    leftBarTop,
    rightBarTop,
    barHeights,
    visibleRanges,
  ]);

  // Find the scroll element (matching useMinimapScroll logic)
  const findScrollElement = useCallback((): HTMLElement | null => {
    const container = scrollContainerRef.current;
    if (!container) return null;

    // First try CodeMirror scroller (primary for CodeMirror 6 diff view)
    const cmScroller = container.querySelector<HTMLElement>('.cm-scroller');
    if (cmScroller && cmScroller.scrollHeight > cmScroller.clientHeight) {
      return cmScroller;
    }

    // Find actual scroll container with LARGEST scroll range
    const candidates = container.querySelectorAll<HTMLElement>('[style*="overflow"]');
    let scrollEl: HTMLElement | null = null;
    let maxScrollRange = 0;

    for (const el of candidates) {
      const scrollRange = el.scrollHeight - el.clientHeight;
      if (scrollRange > maxScrollRange) {
        maxScrollRange = scrollRange;
        scrollEl = el;
      }
    }

    // Fallback for side-by-side view
    if (!scrollEl || maxScrollRange <= 100) {
      scrollEl = container.querySelector<HTMLElement>('.side-by-side-pane-left') ?? container;
    }

    return scrollEl;
  }, [scrollContainerRef]);

  // Navigate to put a specific row at 25% of viewport - instant, no animation
  const navigateToRow = useCallback(
    (rowIndex: number, totalRows: number) => {
      const scrollEl = findScrollElement();
      if (!scrollEl || totalRows <= 0) return;

      const { scrollHeight, clientHeight } = scrollEl;
      const rowHeight = scrollHeight / totalRows;

      // Calculate scroll position to put target row at 25% of viewport
      const targetScrollTop = (rowIndex * rowHeight) - (0.25 * clientHeight);

      // Clamp to valid scroll range
      const maxScroll = scrollHeight - clientHeight;
      scrollEl.scrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop));
    },
    [findScrollElement]
  );

  // Handle click navigation - positions clicked line at 25% of viewport
  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const side = getClickSide(x);
      
      // Don't handle clicks on disabled bars
      if ((side === 'left' && isLeftDisabled) || (side === 'right' && isRightDisabled)) {
        return;
      }

      const barTop = side === 'left' ? leftBarTop : rightBarTop;
      const barHeight = side === 'left' ? barHeights.leftHeight : barHeights.rightHeight;
      const lineCount = side === 'left' ? lineCounts.leftLineCount : lineCounts.rightLineCount;
      const clickRatio = (y - barTop) / barHeight;

      // Target line calculation (1-indexed: lines 1 to lineCount)
      const targetLine = Math.round(1 + clickRatio * (lineCount - 1));

      // Find the diff row containing this line
      const rowIndex = findRowIndexByLineNumber(diffLines, targetLine, side);

      // Navigate to put that row at 25% of viewport
      if (rowIndex >= 0) {
        navigateToRow(rowIndex, diffLines.length);
      }

      // Call external callback if provided (for testing/external tracking)
      if (onNavigate) {
        onNavigate({ lineNumber: targetLine, side, type: 'click' });
      }
    },
    [onNavigate, navigateToRow, diffLines, lineCounts, leftBarTop, rightBarTop, barHeights, isLeftDisabled, isRightDisabled]
  );

  // Handle mouse down (start drag)
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      // Disable drag when comments are visible
      if (showComments) return;

      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;

      const side = getClickSide(x);
      
      // Don't allow drag on disabled bars
      if ((side === 'left' && isLeftDisabled) || (side === 'right' && isRightDisabled)) {
        return;
      }

      dragSideRef.current = side;
      setIsDragging(true);

      // Prevent text selection during drag
      event.preventDefault();
    },
    [showComments, isLeftDisabled, isRightDisabled]
  );

  // Handle mouse move (during drag)
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!isDragging || showComments) return;

      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const y = event.clientY - rect.top;

      const side = dragSideRef.current;
      const barTop = side === 'left' ? leftBarTop : rightBarTop;
      const barHeight = side === 'left' ? barHeights.leftHeight : barHeights.rightHeight;
      const lineCount = side === 'left' ? lineCounts.leftLineCount : lineCounts.rightLineCount;
      const clickRatio = (y - barTop) / barHeight;

      // Target line calculation (1-indexed: lines 1 to lineCount)
      const targetLine = Math.round(1 + clickRatio * (lineCount - 1));

      // Find the diff row containing this line
      const rowIndex = findRowIndexByLineNumber(diffLines, targetLine, side);

      // Navigate to put that row at 25% of viewport
      if (rowIndex >= 0) {
        navigateToRow(rowIndex, diffLines.length);
      }

      // Call external callback if provided
      if (onNavigate) {
        onNavigate({ lineNumber: targetLine, side, type: 'drag' });
      }
    },
    [isDragging, showComments, navigateToRow, diffLines, onNavigate, lineCounts, leftBarTop, rightBarTop, barHeights]
  );

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle mouse leave (end drag if mouse leaves)
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // Render region rectangles
  const renderRegions = (
    regionList: DiffRegion[],
    barX: number,
    barTop: number,
    barHeight: number,
    className: string
  ) => {
    if (barHeight === 0) return null;

    return regionList.map((region, index) => {
      const y = barTop + region.startRatio * barHeight;
      const height = (region.endRatio - region.startRatio) * barHeight;

      return (
        <rect
          key={`${className}-${index}`}
          className={className}
          x={barX}
          y={y}
          width={BAR_WIDTH}
          height={Math.max(1, height)}
        />
      );
    });
  };

  return (
    <svg
      ref={svgRef}
      className="minimap"
      width={WIDTH}
      height={containerHeight}
      role="img"
      aria-label="Diff minimap navigation"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left bar background */}
      <rect
        className={`minimap-bar minimap-bar-left${isLeftDisabled ? ' minimap-bar-disabled' : ''}`}
        x={LEFT_BAR_X}
        y={leftBarTop}
        width={BAR_WIDTH}
        height={barHeights.leftHeight}
      />

      {/* Right bar background */}
      <rect
        className={`minimap-bar minimap-bar-right${isRightDisabled ? ' minimap-bar-disabled' : ''}`}
        x={RIGHT_BAR_X}
        y={rightBarTop}
        width={BAR_WIDTH}
        height={barHeights.rightHeight}
      />

      {/* Deletion regions on left bar */}
      {!isLeftDisabled && renderRegions(
        regions.leftRegions,
        LEFT_BAR_X,
        leftBarTop,
        barHeights.leftHeight,
        'minimap-deletion'
      )}

      {/* Addition regions on right bar */}
      {!isRightDisabled && renderRegions(
        regions.rightRegions,
        RIGHT_BAR_X,
        rightBarTop,
        barHeights.rightHeight,
        'minimap-addition'
      )}

      {/* Viewport lasso */}
      {lasso && (
        <path
          className="minimap-lasso"
          d={generateLassoPath(lasso)}
          fill="none"
        />
      )}
    </svg>
  );
}
