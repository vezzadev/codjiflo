/**
 * Minimap Component
 *
 * Provides a birds-eye view of the entire diff with:
 * - Two vertical bars (left: deletions, right: additions)
 * - Viewport lasso showing visible portion
 * - Click and drag navigation
 *
 * See spec/functional/diff-viewing.md lines 268-293
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
} from '../utils/minimap-mapping';

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
}

// ============================================================================
// Constants
// ============================================================================

const { WIDTH, BAR_WIDTH, LEFT_BAR_X, RIGHT_BAR_X, PADDING_VERTICAL } = MINIMAP_CONSTANTS;

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
}: MinimapProps) {
  const { diffLines, alignedLines, viewMode, contentFilter, filename } = pipeline;

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

  // Calculate viewport lasso position
  const lasso = useMemo(() => {
    // Lasso is hidden when:
    // 1. Not in full file mode
    // 2. Comments are visible (showComments=true)
    // 3. Scroll state not yet initialized (viewportRatio === 0)
    //    This prevents the lasso from appearing at full-bar-height before
    //    the actual viewport ratio is calculated from the DOM.
    if (!showFullFile || showComments || scrollState.viewportRatio === 0) {
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
    });
  }, [
    showFullFile,
    showComments,
    scrollState,
    lineCounts,
    leftBarTop,
    rightBarTop,
    barHeights,
  ]);

  // Convert Y position to scroll ratio (0-1) with lasso-center positioning
  // Both click and drag use this so lasso center is positioned at cursor
  const yToScrollRatio = useCallback(
    (y: number, side: 'left' | 'right'): number => {
      const barTop = side === 'left' ? leftBarTop : rightBarTop;
      const barHeight = side === 'left' ? barHeights.leftHeight : barHeights.rightHeight;
      const { viewportRatio } = scrollState;

      // Lasso height and movement range
      const lassoHeight = viewportRatio * barHeight;
      const lassoMoveRange = barHeight - lassoHeight;

      // Edge case: lasso fills entire bar (no scrolling possible)
      if (lassoMoveRange <= 0) return 0;

      // Map Y to scroll ratio such that lasso center follows mouse 1:1
      // lassoCenterY = barTop + scrollRatio * lassoMoveRange + lassoHeight/2
      // Solving for scrollRatio: scrollRatio = (Y - barTop - lassoHeight/2) / lassoMoveRange
      const ratio = (y - barTop - lassoHeight / 2) / lassoMoveRange;

      return Math.max(0, Math.min(1, ratio));
    },
    [barHeights, leftBarTop, rightBarTop, scrollState]
  );

  // Navigate to scroll position by ratio (0-1) - instant, no animation
  const navigateToRatio = useCallback(
    (ratio: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // Find actual scroll container with LARGEST scroll range (matching useMinimapScroll logic)
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

      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      // Set scroll position directly from ratio - instant scrolling
      // eslint-disable-next-line react-hooks/immutability -- We're modifying the DOM element's scroll position, not the ref
      scrollEl.scrollTop = ratio * maxScroll;
    },
    [scrollContainerRef]
  );

  // Handle click navigation - positions lasso center at click point
  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const side = getClickSide(x);
      // Use lasso-aware calculation so click positions lasso center under cursor
      const ratio = yToScrollRatio(y, side);

      // Navigate using scroll ratio for accurate positioning
      navigateToRatio(ratio);

      // Call external callback if provided (for testing/external tracking)
      if (onNavigate) {
        const lineCount = side === 'left' ? lineCounts.leftLineCount : lineCounts.rightLineCount;
        const lineNumber = Math.floor(ratio * lineCount);
        onNavigate({ lineNumber, side, type: 'click' });
      }
    },
    [onNavigate, yToScrollRatio, navigateToRatio, lineCounts]
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

      dragSideRef.current = getClickSide(x);
      setIsDragging(true);

      // Prevent text selection during drag
      event.preventDefault();
    },
    [showComments]
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
      // Use drag-specific ratio calculation for 1:1 lasso tracking
      const ratio = yToScrollRatio(y, side);

      // Navigate using scroll ratio
      navigateToRatio(ratio);

      // Call external callback if provided
      if (onNavigate) {
        const lineCount = side === 'left' ? lineCounts.leftLineCount : lineCounts.rightLineCount;
        const lineNumber = Math.floor(ratio * lineCount);
        onNavigate({ lineNumber, side, type: 'drag' });
      }
    },
    [isDragging, showComments, yToScrollRatio, navigateToRatio, onNavigate, lineCounts]
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

  // Determine if bars should be disabled based on content filter
  const isLeftDisabled = contentFilter === 'right';
  const isRightDisabled = contentFilter === 'left';

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
