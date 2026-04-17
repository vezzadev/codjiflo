/**
 * Minimap mapping utilities
 *
 * Pure functions for converting between minimap coordinates and diff line positions.
 * These utilities handle the coordinate mapping, region calculation, and SVG path
 * generation for the minimap component.
 */

import type { ParsedDiffLine, AlignedDiffLine } from '../types';

/**
 * View mode type for minimap calculations
 * Uses 'inline' and 'side-by-side' internally for clarity
 */
export type MinimapViewMode = 'inline' | 'side-by-side';

// ============================================================================
// Constants
// ============================================================================

export const MINIMAP_CONSTANTS = {
  /** Total minimap width in pixels */
  WIDTH: 60,
  /** Width of each vertical bar */
  BAR_WIDTH: 16,
  /** X position of left bar start */
  LEFT_BAR_X: 8,
  /** X position of right bar start */
  RIGHT_BAR_X: 36,
  /** Vertical padding top and bottom */
  PADDING_VERTICAL: 10,
  /** Corner radius for viewport lasso */
  VIEWPORT_CORNER_RADIUS: 4,
  /** X threshold for determining click side (< 30 = left, >= 30 = right) */
  CLICK_THRESHOLD: 30,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * A region of consecutive changes in the diff
 */
export interface DiffRegion {
  /** Start position as ratio (0-1) of total lines */
  startRatio: number;
  /** End position as ratio (0-1) of total lines */
  endRatio: number;
  /** Type of change */
  type: 'addition' | 'deletion';
}

/**
 * Viewport lasso coordinates for asymmetric rendering
 */
export interface ViewportLasso {
  /** Top Y position on left bar */
  leftTop: number;
  /** Bottom Y position on left bar */
  leftBottom: number;
  /** Top Y position on right bar */
  rightTop: number;
  /** Bottom Y position on right bar */
  rightBottom: number;
}

/**
 * Bar height calculation result
 */
export interface BarHeights {
  leftHeight: number;
  rightHeight: number;
}

/**
 * Line count result
 */
export interface LineCounts {
  leftLineCount: number;
  rightLineCount: number;
}

/**
 * Visible line range for a side of the diff
 */
export interface VisibleLineRange {
  /** First visible line number (1-indexed, inclusive) */
  firstLine: number;
  /** Last visible line number (1-indexed, inclusive) */
  lastLine: number;
}

/**
 * Calculate visible line ranges from scroll ratios and diff data
 *
 * Maps scroll position to actual file line numbers by:
 * 1. Calculating which diff row indices are visible based on scroll ratios
 * 2. Looking up file line numbers from those diff rows
 *
 * @param scrollRatio - Current scroll position as ratio (0-1)
 * @param viewportRatio - Viewport size as ratio of total content (0-1)
 * @param diffLines - Array of diff lines with line number information
 * @returns Visible line ranges for left and right sides
 */
export function calculateVisibleLineRanges(
  scrollRatio: number,
  viewportRatio: number,
  diffLines: ParsedDiffLine[]
): { left: VisibleLineRange | null; right: VisibleLineRange | null } {
  if (diffLines.length === 0 || viewportRatio <= 0) {
    return { left: null, right: null };
  }

  // Calculate visible range as fractions of total lines (matches feature/minimap approach)
  const firstVisibleRatio = scrollRatio * (1 - viewportRatio);
  const lastVisibleRatio = firstVisibleRatio + viewportRatio;

  // Convert to indices - use floor for start (inclusive) and ceil for end (inclusive)
  const firstVisibleRow = Math.max(0, Math.floor(firstVisibleRatio * diffLines.length));
  const lastVisibleRow = Math.min(
    diffLines.length - 1,
    Math.ceil(lastVisibleRatio * diffLines.length)
  );

  // Find actual line numbers from visible diff rows
  let leftFirst: number | null = null;
  let leftLast: number | null = null;
  let rightFirst: number | null = null;
  let rightLast: number | null = null;

  for (let i = firstVisibleRow; i <= lastVisibleRow; i++) {
    const line = diffLines[i];
    if (!line) continue;

    // Track left side line numbers (deletions and context)
    // ParsedDiffLine uses oldLineNumber for base/left side
    if (line.oldLineNumber != null) {
      leftFirst ??= line.oldLineNumber;
      leftLast = line.oldLineNumber;
    }

    // Track right side line numbers (additions and context)
    // ParsedDiffLine uses newLineNumber for head/right side
    if (line.newLineNumber != null) {
      rightFirst ??= line.newLineNumber;
      rightLast = line.newLineNumber;
    }
  }

  return {
    left: leftFirst !== null && leftLast !== null
      ? { firstLine: leftFirst, lastLine: leftLast }
      : null,
    right: rightFirst !== null && rightLast !== null
      ? { firstLine: rightFirst, lastLine: rightLast }
      : null,
  };
}

// ============================================================================
// Coordinate Mapping Functions
// ============================================================================

/**
 * Convert Y position on minimap to line number
 *
 * @param y - Y coordinate in pixels
 * @param renderAreaTop - Top of the render area in pixels
 * @param renderAreaHeight - Height of the render area in pixels
 * @param totalLineCount - Total number of lines
 * @returns Line number (0-indexed)
 */
export function pixelToLine(
  y: number,
  renderAreaTop: number,
  renderAreaHeight: number,
  totalLineCount: number
): number {
  if (totalLineCount === 0 || renderAreaHeight === 0) return 0;

  const ratio = Math.max(0, Math.min(1, (y - renderAreaTop) / renderAreaHeight));
  return Math.floor(ratio * totalLineCount);
}

/**
 * Convert line number to Y position on minimap
 *
 * @param lineNumber - Line number (0-indexed)
 * @param renderAreaTop - Top of the render area in pixels
 * @param renderAreaHeight - Height of the render area in pixels
 * @param totalLineCount - Total number of lines
 * @returns Y coordinate in pixels
 */
export function lineToPixel(
  lineNumber: number,
  renderAreaTop: number,
  renderAreaHeight: number,
  totalLineCount: number
): number {
  if (totalLineCount === 0) return renderAreaTop;

  const ratio = Math.max(0, Math.min(1, lineNumber / totalLineCount));
  return renderAreaTop + ratio * renderAreaHeight;
}

/**
 * Determine which side was clicked based on X coordinate
 *
 * @param x - X coordinate in pixels
 * @returns 'left' if X is below threshold, 'right' otherwise
 */
export function getClickSide(x: number): 'left' | 'right' {
  return x < MINIMAP_CONSTANTS.CLICK_THRESHOLD ? 'left' : 'right';
}

// ============================================================================
// Line Counting
// ============================================================================

/**
 * Count lines by side from diff data
 *
 * @param lines - Either ParsedDiffLine[] for inline or AlignedDiffLine[] for side-by-side
 * @param viewMode - Current view mode
 * @returns Line counts for left and right sides
 */
export function countLinesByType(
  lines: ParsedDiffLine[] | AlignedDiffLine[],
  viewMode: MinimapViewMode
): LineCounts {
  if (lines.length === 0) {
    return { leftLineCount: 0, rightLineCount: 0 };
  }

  if (viewMode === 'side-by-side') {
    // For aligned lines, find max line number on each side
    const alignedLines = lines as AlignedDiffLine[];
    let maxLeft = 0;
    let maxRight = 0;

    for (const line of alignedLines) {
      if (line.left?.oldLineNumber != null) {
        maxLeft = Math.max(maxLeft, line.left.oldLineNumber);
      }
      if (line.right?.newLineNumber != null) {
        maxRight = Math.max(maxRight, line.right.newLineNumber);
      }
    }

    return { leftLineCount: maxLeft, rightLineCount: maxRight };
  }

  // Inline mode - find max line numbers
  const diffLines = lines as ParsedDiffLine[];
  let maxOld = 0;
  let maxNew = 0;

  for (const line of diffLines) {
    if (line.oldLineNumber != null) {
      maxOld = Math.max(maxOld, line.oldLineNumber);
    }
    if (line.newLineNumber != null) {
      maxNew = Math.max(maxNew, line.newLineNumber);
    }
  }

  return { leftLineCount: maxOld, rightLineCount: maxNew };
}

// ============================================================================
// Diff Region Calculation
// ============================================================================

/**
 * Calculate diff regions from line data
 *
 * Groups consecutive additions and deletions into regions for efficient rendering.
 * Uses original file line numbers for positioning.
 *
 * @param lines - Either ParsedDiffLine[] or AlignedDiffLine[]
 * @param viewMode - Current view mode
 * @returns Regions for left (deletions) and right (additions) bars
 */
export function calculateDiffRegions(
  lines: ParsedDiffLine[] | AlignedDiffLine[],
  viewMode: MinimapViewMode
): { leftRegions: DiffRegion[]; rightRegions: DiffRegion[] } {
  if (lines.length === 0) {
    return { leftRegions: [], rightRegions: [] };
  }

  if (viewMode === 'side-by-side') {
    return calculateDiffRegionsFromAligned(lines as AlignedDiffLine[]);
  }

  return calculateDiffRegionsFromInline(lines as ParsedDiffLine[]);
}

/**
 * Calculate diff regions from inline diff lines
 */
function calculateDiffRegionsFromInline(
  diffLines: ParsedDiffLine[]
): { leftRegions: DiffRegion[]; rightRegions: DiffRegion[] } {
  const leftRegions: DiffRegion[] = [];
  const rightRegions: DiffRegion[] = [];

  const { leftLineCount, rightLineCount } = countLinesByType(diffLines, 'inline');

  if (leftLineCount === 0 && rightLineCount === 0) {
    return { leftRegions, rightRegions };
  }

  let currentDeletion: { startLine: number; endLine: number } | null = null;
  let currentAddition: { startLine: number; endLine: number } | null = null;

  for (const line of diffLines) {
    // Handle deletions
    if (line.type === 'deletion' && line.oldLineNumber != null) {
      if (currentDeletion === null) {
        currentDeletion = { startLine: line.oldLineNumber, endLine: line.oldLineNumber };
      } else {
        currentDeletion.endLine = line.oldLineNumber;
      }
    } else if (currentDeletion !== null && leftLineCount > 0) {
      leftRegions.push({
        startRatio: (currentDeletion.startLine - 1) / leftLineCount,
        endRatio: currentDeletion.endLine / leftLineCount,
        type: 'deletion',
      });
      currentDeletion = null;
    }

    // Handle additions
    if (line.type === 'addition' && line.newLineNumber != null) {
      if (currentAddition === null) {
        currentAddition = { startLine: line.newLineNumber, endLine: line.newLineNumber };
      } else {
        currentAddition.endLine = line.newLineNumber;
      }
    } else if (currentAddition !== null && rightLineCount > 0) {
      rightRegions.push({
        startRatio: (currentAddition.startLine - 1) / rightLineCount,
        endRatio: currentAddition.endLine / rightLineCount,
        type: 'addition',
      });
      currentAddition = null;
    }
  }

  // Flush remaining regions
  if (currentDeletion !== null && leftLineCount > 0) {
    leftRegions.push({
      startRatio: (currentDeletion.startLine - 1) / leftLineCount,
      endRatio: currentDeletion.endLine / leftLineCount,
      type: 'deletion',
    });
  }

  if (currentAddition !== null && rightLineCount > 0) {
    rightRegions.push({
      startRatio: (currentAddition.startLine - 1) / rightLineCount,
      endRatio: currentAddition.endLine / rightLineCount,
      type: 'addition',
    });
  }

  return { leftRegions, rightRegions };
}

/**
 * Calculate diff regions from aligned (side-by-side) lines
 */
function calculateDiffRegionsFromAligned(
  alignedLines: AlignedDiffLine[]
): { leftRegions: DiffRegion[]; rightRegions: DiffRegion[] } {
  const leftRegions: DiffRegion[] = [];
  const rightRegions: DiffRegion[] = [];

  const { leftLineCount, rightLineCount } = countLinesByType(alignedLines, 'side-by-side');

  if (leftLineCount === 0 && rightLineCount === 0) {
    return { leftRegions, rightRegions };
  }

  let currentDeletion: { startLine: number; endLine: number } | null = null;
  let currentAddition: { startLine: number; endLine: number } | null = null;

  for (const line of alignedLines) {
    // Handle deletions on left side
    if (line.left?.type === 'deletion' && line.left.oldLineNumber != null) {
      if (currentDeletion === null) {
        currentDeletion = { startLine: line.left.oldLineNumber, endLine: line.left.oldLineNumber };
      } else {
        currentDeletion.endLine = line.left.oldLineNumber;
      }
    } else if (currentDeletion !== null && leftLineCount > 0) {
      leftRegions.push({
        startRatio: (currentDeletion.startLine - 1) / leftLineCount,
        endRatio: currentDeletion.endLine / leftLineCount,
        type: 'deletion',
      });
      currentDeletion = null;
    }

    // Handle additions on right side
    if (line.right?.type === 'addition' && line.right.newLineNumber != null) {
      if (currentAddition === null) {
        currentAddition = { startLine: line.right.newLineNumber, endLine: line.right.newLineNumber };
      } else {
        currentAddition.endLine = line.right.newLineNumber;
      }
    } else if (currentAddition !== null && rightLineCount > 0) {
      rightRegions.push({
        startRatio: (currentAddition.startLine - 1) / rightLineCount,
        endRatio: currentAddition.endLine / rightLineCount,
        type: 'addition',
      });
      currentAddition = null;
    }
  }

  // Flush remaining regions
  if (currentDeletion !== null && leftLineCount > 0) {
    leftRegions.push({
      startRatio: (currentDeletion.startLine - 1) / leftLineCount,
      endRatio: currentDeletion.endLine / leftLineCount,
      type: 'deletion',
    });
  }

  if (currentAddition !== null && rightLineCount > 0) {
    rightRegions.push({
      startRatio: (currentAddition.startLine - 1) / rightLineCount,
      endRatio: currentAddition.endLine / rightLineCount,
      type: 'addition',
    });
  }

  return { leftRegions, rightRegions };
}

// ============================================================================
// Bar Height Calculation
// ============================================================================

/**
 * Calculate proportional bar heights based on line counts
 *
 * The bar with more lines gets full height, the other is proportionally shorter.
 * Both bars have a minimum height to remain visible.
 *
 * @param leftLineCount - Number of lines in left file
 * @param rightLineCount - Number of lines in right file
 * @param renderAreaHeight - Available height for rendering
 * @returns Heights for left and right bars
 */
export function calculateBarHeights(
  leftLineCount: number,
  rightLineCount: number,
  renderAreaHeight: number
): BarHeights {
  if (leftLineCount === 0 && rightLineCount === 0) {
    return { leftHeight: 0, rightHeight: 0 };
  }

  const maxLineCount = Math.max(leftLineCount, rightLineCount);

  if (maxLineCount === 0) {
    return { leftHeight: 0, rightHeight: 0 };
  }

  // Both bars are scaled relative to the maximum
  const leftHeight = (leftLineCount / maxLineCount) * renderAreaHeight;
  const rightHeight = (rightLineCount / maxLineCount) * renderAreaHeight;

  return { leftHeight, rightHeight };
}

// ============================================================================
// Viewport Lasso Calculation
// ============================================================================

/**
 * Calculate asymmetric viewport lasso positions
 *
 * The lasso can have different heights on each bar when files have different
 * line counts or when scrolling through regions with additions/deletions.
 * Each bar is centered vertically, so leftBarTop and rightBarTop may differ.
 *
 * When visibleLeftRange and visibleRightRange are provided, they are used
 * directly for accurate lasso positioning. Otherwise, falls back to estimation
 * from scroll ratios (less accurate for diffs with pure additions/deletions).
 *
 * @param params - Calculation parameters
 * @returns Lasso coordinates or null if cannot calculate
 */
export function calculateAsymmetricViewportLasso(params: {
  scrollRatio: number;
  viewportRatio: number;
  leftLineCount: number;
  rightLineCount: number;
  leftBarTop: number;
  leftBarHeight: number;
  rightBarTop: number;
  rightBarHeight: number;
  /** Actual visible line range on left side (if available) */
  visibleLeftRange?: VisibleLineRange | null;
  /** Actual visible line range on right side (if available) */
  visibleRightRange?: VisibleLineRange | null;
  /** Anchor line number on left side when no left lines visible (last left line before visible range) */
  leftAnchor?: number | null;
  /** Anchor line number on right side when no right lines visible (last right line before visible range) */
  rightAnchor?: number | null;
}): ViewportLasso | null {
  const {
    scrollRatio,
    viewportRatio,
    leftLineCount,
    rightLineCount,
    leftBarTop,
    leftBarHeight,
    rightBarTop,
    rightBarHeight,
    visibleLeftRange,
    visibleRightRange,
    leftAnchor,
    rightAnchor,
  } = params;

  if (leftLineCount === 0 && rightLineCount === 0) {
    return null;
  }

  // Minimum lasso height ensures visibility even with no content on one side
  const MIN_LASSO_HEIGHT = 4;

  // When actual visible ranges are provided, use them directly for accurate positioning
  if (visibleLeftRange || visibleRightRange) {
    // Calculate left lasso position from actual visible lines
    let leftTop: number;
    let leftLassoHeight: number;

    // Calculate position ratios from visible ranges
    // These are null if no lines visible on that side
    const leftStartRatio = visibleLeftRange && leftLineCount > 0
      ? (visibleLeftRange.firstLine - 1) / leftLineCount
      : null;
    const leftEndRatio = visibleLeftRange && leftLineCount > 0
      ? visibleLeftRange.lastLine / leftLineCount
      : null;
    const rightStartRatio = visibleRightRange && rightLineCount > 0
      ? (visibleRightRange.firstLine - 1) / rightLineCount
      : null;
    const rightEndRatio = visibleRightRange && rightLineCount > 0
      ? visibleRightRange.lastLine / rightLineCount
      : null;

    // Calculate left lasso position
    if (leftStartRatio !== null && leftEndRatio !== null) {
      // Directly map line numbers to bar positions
      leftTop = leftBarTop + leftStartRatio * leftBarHeight;
      leftLassoHeight = Math.max(MIN_LASSO_HEIGHT, (leftEndRatio - leftStartRatio) * leftBarHeight);
    } else if (leftAnchor != null && leftLineCount > 0) {
      // No visible left lines but we have an anchor (last left line before visible range)
      // Use anchor position for continuity during transitions
      // The anchor is the last left line BEFORE the visible range, so we position
      // the lasso at that line's position (using same formula as visible lines)
      const anchorRatio = leftAnchor / leftLineCount;
      leftLassoHeight = MIN_LASSO_HEIGHT;
      leftTop = leftBarTop + anchorRatio * leftBarHeight;
    } else if (rightStartRatio !== null) {
      // No visible left lines and no anchor - derive from right side
      leftLassoHeight = MIN_LASSO_HEIGHT;
      leftTop = leftBarTop + rightStartRatio * (leftBarHeight - leftLassoHeight);
    } else {
      // No reference position - use scroll ratio as fallback
      leftLassoHeight = MIN_LASSO_HEIGHT;
      leftTop = leftBarTop + scrollRatio * (leftBarHeight - leftLassoHeight);
    }

    // Calculate right lasso position
    let rightTop: number;
    let rightLassoHeight: number;

    if (rightStartRatio !== null && rightEndRatio !== null) {
      // Directly map line numbers to bar positions
      rightTop = rightBarTop + rightStartRatio * rightBarHeight;
      rightLassoHeight = Math.max(MIN_LASSO_HEIGHT, (rightEndRatio - rightStartRatio) * rightBarHeight);
    } else if (rightAnchor != null && rightLineCount > 0) {
      // No visible right lines but we have an anchor (last right line before visible range)
      // Use anchor position for continuity during transitions
      // The anchor is the last right line BEFORE the visible range, so we position
      // the lasso at that line's position (using same formula as visible lines)
      const anchorRatio = rightAnchor / rightLineCount;
      rightLassoHeight = MIN_LASSO_HEIGHT;
      rightTop = rightBarTop + anchorRatio * rightBarHeight;
    } else if (leftStartRatio !== null) {
      // No visible right lines and no anchor - derive from left side
      rightLassoHeight = MIN_LASSO_HEIGHT;
      rightTop = rightBarTop + leftStartRatio * (rightBarHeight - rightLassoHeight);
    } else {
      // No reference position - use scroll ratio as fallback
      rightLassoHeight = MIN_LASSO_HEIGHT;
      rightTop = rightBarTop + scrollRatio * (rightBarHeight - rightLassoHeight);
    }

    return {
      leftTop,
      leftBottom: leftTop + leftLassoHeight,
      rightTop,
      rightBottom: rightTop + rightLassoHeight,
    };
  }

  // Fallback: estimate from scroll ratios (less accurate for asymmetric diffs)
  const maxLineCount = Math.max(leftLineCount, rightLineCount);

  // Calculate the visible line range in the longer file's coordinate space
  const visibleLines = viewportRatio * maxLineCount;
  const firstVisibleLine = scrollRatio * (maxLineCount - visibleLines);
  const lastVisibleLine = firstVisibleLine + visibleLines;

  // Calculate how much of each file overlaps with the visible range
  const leftVisibleStart = Math.max(0, Math.min(firstVisibleLine, leftLineCount));
  const leftVisibleEnd = Math.max(0, Math.min(lastVisibleLine, leftLineCount));
  const leftVisibleLinesCount = Math.max(0, leftVisibleEnd - leftVisibleStart);

  const rightVisibleStart = Math.max(0, Math.min(firstVisibleLine, rightLineCount));
  const rightVisibleEnd = Math.max(0, Math.min(lastVisibleLine, rightLineCount));
  const rightVisibleLinesCount = Math.max(0, rightVisibleEnd - rightVisibleStart);

  // Lasso height = proportion of that file's lines that are visible
  const leftLassoRatio = leftLineCount > 0 ? leftVisibleLinesCount / leftLineCount : 0;
  const rightLassoRatio = rightLineCount > 0 ? rightVisibleLinesCount / rightLineCount : 0;

  const leftLassoHeight = Math.max(MIN_LASSO_HEIGHT, leftLassoRatio * leftBarHeight);
  const rightLassoHeight = Math.max(MIN_LASSO_HEIGHT, rightLassoRatio * rightBarHeight);

  // Use scroll ratio for positioning (keeps lassos synchronized)
  const leftScrollableRange = leftBarHeight - leftLassoHeight;
  const rightScrollableRange = rightBarHeight - rightLassoHeight;

  const leftTop = leftBarTop + scrollRatio * leftScrollableRange;
  const rightTop = rightBarTop + scrollRatio * rightScrollableRange;

  return {
    leftTop,
    leftBottom: leftTop + leftLassoHeight,
    rightTop,
    rightBottom: rightTop + rightLassoHeight,
  };
}

// ============================================================================
// SVG Path Generation
// ============================================================================

/**
 * Generate SVG path for the viewport lasso
 *
 * Creates a single continuous outline connecting both bars via horizontal edges,
 * forming a shape that visually connects the visible viewport on both sides.
 *
 * @param lasso - Lasso coordinates
 * @returns SVG path string
 */
export function generateLassoPath(lasso: ViewportLasso): string {
  const { leftTop, leftBottom, rightTop, rightBottom } = lasso;
  const { LEFT_BAR_X, RIGHT_BAR_X, BAR_WIDTH, VIEWPORT_CORNER_RADIUS } = MINIMAP_CONSTANTS;

  const leftBarRight = LEFT_BAR_X + BAR_WIDTH;
  const rightBarLeft = RIGHT_BAR_X;
  const rightBarRight = RIGHT_BAR_X + BAR_WIDTH;

  // Calculate effective corner radius (can't exceed half the height)
  const height = Math.min(leftBottom - leftTop, rightBottom - rightTop);
  const r = Math.min(VIEWPORT_CORNER_RADIUS, height / 2);

  if (r <= 0 || height <= 0) {
    return '';
  }

  // Single continuous outline connecting both bars via inner edges (horizontal connections)
  // Shape: top-left of left bar → across top to right bar → down right bar → across bottom back → up left bar
  return `
    M ${LEFT_BAR_X + r} ${leftTop}
    L ${leftBarRight} ${leftTop}
    L ${rightBarLeft} ${rightTop}
    L ${rightBarRight - r} ${rightTop}
    Q ${rightBarRight} ${rightTop} ${rightBarRight} ${rightTop + r}
    L ${rightBarRight} ${rightBottom - r}
    Q ${rightBarRight} ${rightBottom} ${rightBarRight - r} ${rightBottom}
    L ${rightBarLeft} ${rightBottom}
    L ${leftBarRight} ${leftBottom}
    L ${LEFT_BAR_X + r} ${leftBottom}
    Q ${LEFT_BAR_X} ${leftBottom} ${LEFT_BAR_X} ${leftBottom - r}
    L ${LEFT_BAR_X} ${leftTop + r}
    Q ${LEFT_BAR_X} ${leftTop} ${LEFT_BAR_X + r} ${leftTop}
    Z
  `.trim();
}
