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
 *
 * @param params - Calculation parameters
 * @returns Lasso coordinates or null if cannot calculate
 */
export function calculateAsymmetricViewportLasso(params: {
  scrollRatio: number;
  viewportRatio: number;
  leftLineCount: number;
  rightLineCount: number;
  renderAreaTop: number;
  leftBarHeight: number;
  rightBarHeight: number;
}): ViewportLasso | null {
  const {
    scrollRatio,
    viewportRatio,
    leftLineCount,
    rightLineCount,
    renderAreaTop,
    leftBarHeight,
    rightBarHeight,
  } = params;

  if (leftLineCount === 0 && rightLineCount === 0) {
    return null;
  }

  // Calculate lasso height as proportion of bar height
  const leftLassoHeight = Math.max(4, viewportRatio * leftBarHeight);
  const rightLassoHeight = Math.max(4, viewportRatio * rightBarHeight);

  // Calculate top positions based on scroll ratio
  const leftScrollableRange = leftBarHeight - leftLassoHeight;
  const rightScrollableRange = rightBarHeight - rightLassoHeight;

  const leftTop = renderAreaTop + scrollRatio * leftScrollableRange;
  const rightTop = renderAreaTop + scrollRatio * rightScrollableRange;

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
 * Creates a path that connects the left and right bar positions,
 * forming a quadrilateral that shows the visible viewport region.
 *
 * @param lasso - Lasso coordinates
 * @returns SVG path string
 */
export function generateLassoPath(lasso: ViewportLasso): string {
  const { leftTop, leftBottom, rightTop, rightBottom } = lasso;
  const { LEFT_BAR_X, RIGHT_BAR_X, BAR_WIDTH, VIEWPORT_CORNER_RADIUS: r } = MINIMAP_CONSTANTS;

  const leftBarRight = LEFT_BAR_X + BAR_WIDTH;
  const rightBarRight = RIGHT_BAR_X + BAR_WIDTH;

  // Generate path connecting left bar to right bar
  // Start at top-left of left bar, go clockwise
  return `
    M ${LEFT_BAR_X + r} ${leftTop}
    L ${leftBarRight - r} ${leftTop}
    Q ${leftBarRight} ${leftTop} ${leftBarRight} ${leftTop + r}
    L ${leftBarRight} ${leftBottom - r}
    Q ${leftBarRight} ${leftBottom} ${leftBarRight - r} ${leftBottom}
    L ${LEFT_BAR_X + r} ${leftBottom}
    Q ${LEFT_BAR_X} ${leftBottom} ${LEFT_BAR_X} ${leftBottom - r}
    L ${LEFT_BAR_X} ${leftTop + r}
    Q ${LEFT_BAR_X} ${leftTop} ${LEFT_BAR_X + r} ${leftTop}
    Z
    M ${RIGHT_BAR_X + r} ${rightTop}
    L ${rightBarRight - r} ${rightTop}
    Q ${rightBarRight} ${rightTop} ${rightBarRight} ${rightTop + r}
    L ${rightBarRight} ${rightBottom - r}
    Q ${rightBarRight} ${rightBottom} ${rightBarRight - r} ${rightBottom}
    L ${RIGHT_BAR_X + r} ${rightBottom}
    Q ${RIGHT_BAR_X} ${rightBottom} ${RIGHT_BAR_X} ${rightBottom - r}
    L ${RIGHT_BAR_X} ${rightTop + r}
    Q ${RIGHT_BAR_X} ${rightTop} ${RIGHT_BAR_X + r} ${rightTop}
    Z
  `.trim().replace(/\s+/g, ' ');
}
