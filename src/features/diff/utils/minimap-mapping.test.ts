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
  type DiffRegion,
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
  left: { type: 'deletion' | 'context' | 'empty'; lineNumber: number | null } | null,
  right: { type: 'addition' | 'context' | 'empty'; lineNumber: number | null } | null
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
      createAlignedLine({ type: 'deletion', lineNumber: 2 }, { type: 'empty', lineNumber: null }),
      createAlignedLine({ type: 'empty', lineNumber: null }, { type: 'addition', lineNumber: 2 }),
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
      expect(result.leftRegions[0]).toEqual({
        startRatio: expect.closeTo(0.25, 2), // Line 2 of 4
        endRatio: expect.closeTo(0.75, 2), // Line 3 of 4
        type: 'deletion',
      });
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
      expect(result.rightRegions[0]).toEqual({
        startRatio: expect.closeTo(0.25, 2), // Line 2 of 4
        endRatio: expect.closeTo(0.75, 2), // Line 3 of 4
        type: 'addition',
      });
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
        createAlignedLine({ type: 'deletion', lineNumber: 2 }, { type: 'empty', lineNumber: null }),
        createAlignedLine({ type: 'context', lineNumber: 3 }, { type: 'context', lineNumber: 2 }),
      ];

      const result = calculateDiffRegions(alignedLines, 'side-by-side');
      expect(result.leftRegions).toHaveLength(1);
      expect(result.leftRegions[0]?.type).toBe('deletion');
    });

    it('calculates addition region from aligned lines', () => {
      const alignedLines: AlignedDiffLine[] = [
        createAlignedLine({ type: 'context', lineNumber: 1 }, { type: 'context', lineNumber: 1 }),
        createAlignedLine({ type: 'empty', lineNumber: null }, { type: 'addition', lineNumber: 2 }),
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
  const renderAreaTop = 10;
  const renderAreaHeight = 200;
  const leftBarHeight = 200;
  const rightBarHeight = 200;

  it('returns null when lines are empty', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.5,
      leftLineCount: 0,
      rightLineCount: 0,
      renderAreaTop,
      leftBarHeight,
      rightBarHeight,
    });
    expect(result).toBeNull();
  });

  it('calculates symmetric lasso for equal line counts', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.3,
      leftLineCount: 100,
      rightLineCount: 100,
      renderAreaTop,
      leftBarHeight: renderAreaHeight,
      rightBarHeight: renderAreaHeight,
    });

    expect(result).not.toBeNull();
    expect(result!.leftTop).toBe(result!.rightTop);
    expect(result!.leftBottom).toBe(result!.rightBottom);
  });

  it('calculates asymmetric lasso for different line counts', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.5,
      leftLineCount: 50,
      rightLineCount: 100,
      renderAreaTop,
      leftBarHeight: 100, // Shorter bar for fewer lines
      rightBarHeight: 200,
    });

    expect(result).not.toBeNull();
    // Left bar is shorter, so lasso spans more of it proportionally
    expect(result!.leftBottom - result!.leftTop).toBeLessThan(result!.rightBottom - result!.rightTop);
  });

  it('positions lasso at start when scrollRatio is 0', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 0,
      viewportRatio: 0.2,
      leftLineCount: 100,
      rightLineCount: 100,
      renderAreaTop,
      leftBarHeight: renderAreaHeight,
      rightBarHeight: renderAreaHeight,
    });

    expect(result).not.toBeNull();
    expect(result!.leftTop).toBe(renderAreaTop);
    expect(result!.rightTop).toBe(renderAreaTop);
  });

  it('positions lasso at end when scrollRatio is 1', () => {
    const result = calculateAsymmetricViewportLasso({
      scrollRatio: 1,
      viewportRatio: 0.2,
      leftLineCount: 100,
      rightLineCount: 100,
      renderAreaTop,
      leftBarHeight: renderAreaHeight,
      rightBarHeight: renderAreaHeight,
    });

    expect(result).not.toBeNull();
    expect(result!.leftBottom).toBeCloseTo(renderAreaTop + renderAreaHeight, 0);
    expect(result!.rightBottom).toBeCloseTo(renderAreaTop + renderAreaHeight, 0);
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
});
