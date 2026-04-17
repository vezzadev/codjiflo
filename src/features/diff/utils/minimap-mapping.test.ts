/**
 * Unit tests for minimap mapping utilities
 *
 * TDD: These tests are written BEFORE implementation.
 * Each test should fail initially, then pass after implementation.
 */

import { describe, it, expect } from 'vitest';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';
import {
  MINIMAP_CONSTANTS,
  pixelToLine,
  lineToPixel,
  getClickSide,
  calculateDiffRegions,
  calculateAsymmetricViewportLasso,
  generateLassoPath,
  calculateBarHeights,
  countLinesByType,
  type ViewportLasso,
} from './minimap-mapping';

// ============================================================================
// Test Fixtures
// ============================================================================

function createDiffLine(
  type: 'addition' | 'deletion' | 'context',
  oldLineNumber: number | null,
  newLineNumber: number | null,
  content = ''
): ParsedDiffLine {
  return {
    type,
    oldLineNumber,
    newLineNumber,
    content,
  };
}

function createAlignedLine(
  left: { type: 'deletion' | 'context'; lineNumber: number | null } | null,
  right: { type: 'addition' | 'context'; lineNumber: number | null } | null,
  key?: string
): AlignedDiffLine {
  return {
    left: left
      ? {
          type: left.type,
          oldLineNumber: left.lineNumber,
          newLineNumber: null,
          content: '',
        }
      : null,
    right: right
      ? {
          type: right.type,
          oldLineNumber: null,
          newLineNumber: right.lineNumber,
          content: '',
        }
      : null,
    key: key ?? `line-${left?.lineNumber ?? 'null'}-${right?.lineNumber ?? 'null'}`,
  };
}

// ============================================================================
// Constants Tests
// ============================================================================

describe('MINIMAP_CONSTANTS', () => {
  it('defines expected minimap dimensions', () => {
    expect(MINIMAP_CONSTANTS.WIDTH).toBe(60);
    expect(MINIMAP_CONSTANTS.BAR_WIDTH).toBe(16);
    expect(MINIMAP_CONSTANTS.LEFT_BAR_X).toBe(8);
    expect(MINIMAP_CONSTANTS.RIGHT_BAR_X).toBe(36);
    expect(MINIMAP_CONSTANTS.PADDING_VERTICAL).toBe(10);
    expect(MINIMAP_CONSTANTS.VIEWPORT_CORNER_RADIUS).toBe(4);
    expect(MINIMAP_CONSTANTS.CLICK_THRESHOLD).toBe(30);
  });
});

// ============================================================================
// Coordinate Mapping Tests
// ============================================================================

describe('pixelToLine', () => {
  const renderAreaTop = 10;
  const renderAreaHeight = 200;
  const totalLineCount = 100;

  it('converts Y position at top of render area to line 0', () => {
    const line = pixelToLine(10, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(line).toBe(0);
  });

  it('converts Y position at bottom of render area to last line', () => {
    const line = pixelToLine(210, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(line).toBe(100);
  });

  it('converts Y position at middle to middle line', () => {
    // Y = 110 is 50% through render area
    const line = pixelToLine(110, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(line).toBe(50);
  });

  it('clamps Y above render area to line 0', () => {
    const line = pixelToLine(0, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(line).toBe(0);
  });

  it('clamps Y below render area to last line', () => {
    const line = pixelToLine(300, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(line).toBe(100);
  });

  it('returns 0 when totalLineCount is 0', () => {
    const line = pixelToLine(100, renderAreaTop, renderAreaHeight, 0);
    expect(line).toBe(0);
  });

  it('returns 0 when renderAreaHeight is 0', () => {
    const line = pixelToLine(100, renderAreaTop, 0, totalLineCount);
    expect(line).toBe(0);
  });
});

describe('lineToPixel', () => {
  const renderAreaTop = 10;
  const renderAreaHeight = 200;
  const totalLineCount = 100;

  it('converts line 0 to top of render area', () => {
    const y = lineToPixel(0, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(y).toBe(10);
  });

  it('converts last line to bottom of render area', () => {
    const y = lineToPixel(100, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(y).toBe(210);
  });

  it('converts middle line to middle of render area', () => {
    const y = lineToPixel(50, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(y).toBe(110);
  });

  it('clamps negative line to top', () => {
    const y = lineToPixel(-10, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(y).toBe(10);
  });

  it('clamps line beyond count to bottom', () => {
    const y = lineToPixel(150, renderAreaTop, renderAreaHeight, totalLineCount);
    expect(y).toBe(210);
  });

  it('returns renderAreaTop when totalLineCount is 0', () => {
    const y = lineToPixel(50, renderAreaTop, renderAreaHeight, 0);
    expect(y).toBe(10);
  });
});

describe('getClickSide', () => {
  it('returns left for X below threshold', () => {
    expect(getClickSide(0)).toBe('left');
    expect(getClickSide(15)).toBe('left');
    expect(getClickSide(29)).toBe('left');
  });

  it('returns right for X at or above threshold', () => {
    expect(getClickSide(30)).toBe('right');
    expect(getClickSide(45)).toBe('right');
    expect(getClickSide(60)).toBe('right');
  });
});

// ============================================================================
// Line Counting Tests
// ============================================================================

describe('countLinesByType', () => {
  it('counts lines correctly for inline diff', () => {
    const diffLines: ParsedDiffLine[] = [
      createDiffLine('context', 1, 1),
      createDiffLine('deletion', 2, null),
      createDiffLine('deletion', 3, null),
      createDiffLine('addition', null, 2),
      createDiffLine('context', 4, 3),
    ];

    const result = countLinesByType(diffLines, 'inline');
    expect(result.leftLineCount).toBe(4); // 3 context/deletion lines + line 4
    expect(result.rightLineCount).toBe(3); // 2 context lines + 1 addition
  });

  it('counts lines correctly for aligned diff', () => {
    const alignedLines: AlignedDiffLine[] = [
      createAlignedLine({ type: 'context', lineNumber: 1 }, { type: 'context', lineNumber: 1 }),
      createAlignedLine({ type: 'deletion', lineNumber: 2 }, null),
      createAlignedLine(null, { type: 'addition', lineNumber: 2 }),
      createAlignedLine({ type: 'context', lineNumber: 3 }, { type: 'context', lineNumber: 3 }),
    ];

    const result = countLinesByType(alignedLines, 'side-by-side');
    expect(result.leftLineCount).toBe(3); // Lines 1, 2, 3
    expect(result.rightLineCount).toBe(3); // Lines 1, 2, 3
  });

  it('returns zeros for empty input', () => {
    const result = countLinesByType([], 'inline');
    expect(result.leftLineCount).toBe(0);
    expect(result.rightLineCount).toBe(0);
  });
});

// ============================================================================
// Diff Region Calculation Tests
// ============================================================================

describe('calculateDiffRegions', () => {
  describe('inline mode', () => {
    it('returns empty regions for empty input', () => {
      const result = calculateDiffRegions([], 'inline');
      expect(result.leftRegions).toEqual([]);
      expect(result.rightRegions).toEqual([]);
    });

    it('calculates deletion region correctly', () => {
      const diffLines: ParsedDiffLine[] = [
        createDiffLine('context', 1, 1),
        createDiffLine('deletion', 2, null),
        createDiffLine('deletion', 3, null),
        createDiffLine('context', 4, 2),
      ];

      const result = calculateDiffRegions(diffLines, 'inline');
      expect(result.leftRegions).toHaveLength(1);
      const region = result.leftRegions[0];
      expect(region?.startRatio).toBeCloseTo(0.25, 2); // Line 2 of 4
      expect(region?.endRatio).toBeCloseTo(0.75, 2); // Line 3 of 4
      expect(region?.type).toBe('deletion');
      expect(result.rightRegions).toEqual([]);
    });

    it('calculates addition region correctly', () => {
      const diffLines: ParsedDiffLine[] = [
        createDiffLine('context', 1, 1),
        createDiffLine('addition', null, 2),
        createDiffLine('addition', null, 3),
        createDiffLine('context', 2, 4),
      ];

      const result = calculateDiffRegions(diffLines, 'inline');
      expect(result.rightRegions).toHaveLength(1);
      const region = result.rightRegions[0];
      expect(region?.startRatio).toBeCloseTo(0.25, 2); // Line 2 of 4
      expect(region?.endRatio).toBeCloseTo(0.75, 2); // Line 3 of 4
      expect(region?.type).toBe('addition');
      expect(result.leftRegions).toEqual([]);
    });

    it('handles multiple non-consecutive regions', () => {
      const diffLines: ParsedDiffLine[] = [
        createDiffLine('deletion', 1, null),
        createDiffLine('context', 2, 1),
        createDiffLine('context', 3, 2),
        createDiffLine('deletion', 4, null),
      ];

      const result = calculateDiffRegions(diffLines, 'inline');
      expect(result.leftRegions).toHaveLength(2);
    });
  });

  describe('side-by-side mode', () => {
    it('returns empty regions for empty input', () => {
      const result = calculateDiffRegions([], 'side-by-side');
      expect(result.leftRegions).toEqual([]);
      expect(result.rightRegions).toEqual([]);
    });

    it('calculates deletion region from aligned lines', () => {
      const alignedLines: AlignedDiffLine[] = [
        createAlignedLine({ type: 'context', lineNumber: 1 }, { type: 'context', lineNumber: 1 }),
        createAlignedLine({ type: 'deletion', lineNumber: 2 }, null),
        createAlignedLine({ type: 'context', lineNumber: 3 }, { type: 'context', lineNumber: 2 }),
      ];

      const result = calculateDiffRegions(alignedLines, 'side-by-side');
      expect(result.leftRegions).toHaveLength(1);
      expect(result.leftRegions[0]?.type).toBe('deletion');
    });

    it('calculates addition region from aligned lines', () => {
      const alignedLines: AlignedDiffLine[] = [
        createAlignedLine({ type: 'context', lineNumber: 1 }, { type: 'context', lineNumber: 1 }),
        createAlignedLine(null, { type: 'addition', lineNumber: 2 }),
        createAlignedLine({ type: 'context', lineNumber: 2 }, { type: 'context', lineNumber: 3 }),
      ];

      const result = calculateDiffRegions(alignedLines, 'side-by-side');
      expect(result.rightRegions).toHaveLength(1);
      expect(result.rightRegions[0]?.type).toBe('addition');
    });
  });
});

// ============================================================================
// Bar Height Calculation Tests
// ============================================================================

describe('calculateBarHeights', () => {
  it('returns equal heights for equal line counts', () => {
    const result = calculateBarHeights(100, 100, 200);
    expect(result.leftHeight).toBe(result.rightHeight);
  });

  it('calculates proportional heights for different line counts', () => {
    const result = calculateBarHeights(100, 200, 200);
    // Right has 2x lines, should be taller
    expect(result.rightHeight).toBeGreaterThan(result.leftHeight);
  });

  it('returns full height for both when both are equal', () => {
    const result = calculateBarHeights(100, 100, 180);
    expect(result.leftHeight).toBe(180);
    expect(result.rightHeight).toBe(180);
  });

  it('caps heights at renderAreaHeight', () => {
    const result = calculateBarHeights(1000, 100, 200);
    expect(result.leftHeight).toBeLessThanOrEqual(200);
    expect(result.rightHeight).toBeLessThanOrEqual(200);
  });

  it('returns 0 for both when line counts are 0', () => {
    const result = calculateBarHeights(0, 0, 200);
    expect(result.leftHeight).toBe(0);
    expect(result.rightHeight).toBe(0);
  });
});

// ============================================================================
// Viewport Lasso Tests
// ============================================================================

describe('calculateAsymmetricViewportLasso', () => {
  const leftBarTop = 10;
  const rightBarTop = 10;
  const leftBarHeight = 200;
  const rightBarHeight = 200;

  it('returns null when lines are empty', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.5,
      leftLineCount: 0,
      rightLineCount: 0,
      leftBarTop,
      leftBarHeight,
      rightBarTop,
      rightBarHeight,
    });
    expect(result).toBeNull();
  });

  it('calculates symmetric lasso for equal line counts and bar positions', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.3,
      leftLineCount: 100,
      rightLineCount: 100,
      leftBarTop,
      leftBarHeight: 200,
      rightBarTop,
      rightBarHeight: 200,
    });

    expect(result).not.toBeNull();
    if (!result) return; // Type guard
    expect(result.leftTop).toBe(result.rightTop);
    expect(result.leftBottom).toBe(result.rightBottom);
  });

  it('calculates asymmetric lasso for different line counts at top', () => {
    // At scrollRatio: 0, viewportRatio: 0.5 = viewing first 50 lines of 100 total
    // Left file (50 lines): all 50 lines visible, so lasso spans full bar (100px)
    // Right file (100 lines): 50/100 lines visible, so lasso spans half bar (100px)
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.5,
      leftLineCount: 50,
      rightLineCount: 100,
      leftBarTop: 60, // Centered: 10 + (200 - 100) / 2 = 60
      leftBarHeight: 100, // Shorter bar for fewer lines
      rightBarTop: 10,
      rightBarHeight: 200,
    });

    expect(result).not.toBeNull();
    if (!result) return; // Type guard
    // At top of file, shorter file (left) is fully visible, so lasso spans full bar
    // Both lassos end up same height (100px) in this scenario
    const leftHeight = result.leftBottom - result.leftTop;
    const rightHeight = result.rightBottom - result.rightTop;
    expect(leftHeight).toBe(100); // Full left bar (all 50 lines visible)
    expect(rightHeight).toBe(100); // Half of right bar (50/100 lines visible)
  });

  it('shrinks lasso when viewing content past the shorter file', () => {
    // Scenario: 50 lines on left, 200 lines on right
    // Scrolled to bottom where only right content exists (lines 150-200)
    // viewportRatio: 0.25 = viewing 50 lines of 200 total at any time
    // scrollRatio: 1.0 = scrolled to very bottom (viewing lines 150-200)
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 1.0,
      viewportRatio: 0.25,
      leftLineCount: 50,
      rightLineCount: 200,
      leftBarTop: 60,
      leftBarHeight: 50, // Shorter bar
      rightBarTop: 10,
      rightBarHeight: 200,
    });

    expect(result).not.toBeNull();
    if (!result) return; // Type guard

    const leftHeight = result.leftBottom - result.leftTop;
    const rightHeight = result.rightBottom - result.rightTop;

    // Left lasso should be at minimum (4px) since no left content is visible (lines 150-200 are beyond left file's 50 lines)
    expect(leftHeight).toBe(4); // MIN_LASSO_HEIGHT
    // Right lasso shows 50/200 = 25% of the bar
    expect(rightHeight).toBe(50); // 0.25 * 200
  });

  it('positions lasso at start when scrollRatio is 0', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.2,
      leftLineCount: 100,
      rightLineCount: 100,
      leftBarTop,
      leftBarHeight: 200,
      rightBarTop,
      rightBarHeight: 200,
    });

    expect(result).not.toBeNull();
    if (!result) return; // Type guard
    expect(result.leftTop).toBe(leftBarTop);
    expect(result.rightTop).toBe(rightBarTop);
  });

  it('positions lasso at end when scrollRatio is 1', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 1,
      viewportRatio: 0.2,
      leftLineCount: 100,
      rightLineCount: 100,
      leftBarTop,
      leftBarHeight: 200,
      rightBarTop,
      rightBarHeight: 200,
    });

    expect(result).not.toBeNull();
    if (!result) return; // Type guard
    expect(result.leftBottom).toBeCloseTo(leftBarTop + 200, 0);
    expect(result.rightBottom).toBeCloseTo(rightBarTop + 200, 0);
  });

  it('handles bars at different top positions (centered bars)', () => {
    // When bars have different heights and are centered, they have different tops
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.2,
      leftLineCount: 50,
      rightLineCount: 100,
      leftBarTop: 60, // Shorter bar centered: 10 + (200 - 100) / 2 = 60
      leftBarHeight: 100,
      rightBarTop: 10, // Full height bar at top
      rightBarHeight: 200,
    });

    expect(result).not.toBeNull();
    if (!result) return; // Type guard
    expect(result.leftTop).toBe(60); // Starts at centered position
    expect(result.rightTop).toBe(10); // Starts at normal position
  });
});

// ============================================================================
// SVG Path Generation Tests
// ============================================================================

describe('generateLassoPath', () => {
  it('generates SVG path connecting left and right lasso positions', () => {
    const lasso: ViewportLasso = {
      leftTop: 10,
      leftBottom: 50,
      rightTop: 15,
      rightBottom: 45,
    };

    const path = generateLassoPath(lasso);

    // Path should be a valid SVG path string
    expect(path).toMatch(/^M\s*[\d.]+/); // Starts with M (move)
    expect(path).toContain('L'); // Contains line commands
  });

  it('creates path with correct coordinates', () => {
    const lasso: ViewportLasso = {
      leftTop: 10,
      leftBottom: 50,
      rightTop: 10,
      rightBottom: 50,
    };

    const path = generateLassoPath(lasso);

    // Path should include the left bar x positions
    expect(path).toContain(String(MINIMAP_CONSTANTS.LEFT_BAR_X));
    // Path should include the right bar x positions
    expect(path).toContain(String(MINIMAP_CONSTANTS.RIGHT_BAR_X + MINIMAP_CONSTANTS.BAR_WIDTH));
  });

  it('creates single connected shape bridging both bars (not two separate rectangles)', () => {
    const lasso: ViewportLasso = {
      leftTop: 20,
      leftBottom: 60,
      rightTop: 25,
      rightBottom: 55,
    };

    const path = generateLassoPath(lasso);

    // Single connected shape should have exactly one Z (close path) command
    // Two separate rectangles would have two Z commands
    const zCount = (path.match(/Z/gi) ?? []).length;
    expect(zCount).toBe(1);

    // Path should connect from left bar to right bar (contains both bar X positions)
    expect(path).toContain(String(MINIMAP_CONSTANTS.LEFT_BAR_X + MINIMAP_CONSTANTS.BAR_WIDTH)); // left bar right edge
    expect(path).toContain(String(MINIMAP_CONSTANTS.RIGHT_BAR_X)); // right bar left edge
  });

  it('returns empty string when lasso height is zero or negative', () => {
    const zeroHeightLasso: ViewportLasso = {
      leftTop: 50,
      leftBottom: 50, // same as top = zero height
      rightTop: 50,
      rightBottom: 50,
    };

    expect(generateLassoPath(zeroHeightLasso)).toBe('');

    const negativeHeightLasso: ViewportLasso = {
      leftTop: 60,
      leftBottom: 50, // bottom above top = negative height
      rightTop: 60,
      rightBottom: 50,
    };

    expect(generateLassoPath(negativeHeightLasso)).toBe('');
  });
});
