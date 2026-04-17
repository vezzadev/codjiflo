/**
 * Tests for TextSpan and LineSpan domain value objects
 */

import { describe, it, expect } from 'vitest';
import {
  createSpan,
  spanEnd,
  spansOverlap,
  spanContains,
  spanFromRange,
  shiftSpan,
  emptySpan,
  isEmptySpan,
  createLineSpan,
  singleLine,
  lineCount,
  lineSpansOverlap,
} from './text-span';

describe('TextSpan', () => {
  describe('createSpan', () => {
    it('should create a span with start and length', () => {
      const span = createSpan(10, 5);
      expect(span.start).toBe(10);
      expect(span.length).toBe(5);
    });

    it('should allow zero length spans', () => {
      const span = createSpan(5, 0);
      expect(span.start).toBe(5);
      expect(span.length).toBe(0);
    });

    it('should throw for negative length', () => {
      expect(() => createSpan(0, -1)).toThrow('TextSpan length cannot be negative');
    });
  });

  describe('spanEnd', () => {
    it('should calculate end position correctly', () => {
      expect(spanEnd(createSpan(10, 5))).toBe(15);
      expect(spanEnd(createSpan(0, 10))).toBe(10);
      expect(spanEnd(createSpan(5, 0))).toBe(5);
    });
  });

  describe('spansOverlap', () => {
    it('should detect overlapping spans', () => {
      const a = createSpan(0, 10);
      const b = createSpan(5, 10);
      expect(spansOverlap(a, b)).toBe(true);
      expect(spansOverlap(b, a)).toBe(true);
    });

    it('should detect non-overlapping spans', () => {
      const a = createSpan(0, 5);
      const b = createSpan(10, 5);
      expect(spansOverlap(a, b)).toBe(false);
    });

    it('should not consider adjacent spans as overlapping', () => {
      const a = createSpan(0, 5);
      const b = createSpan(5, 5);
      expect(spansOverlap(a, b)).toBe(false);
    });

    it('should detect fully contained spans as overlapping', () => {
      const outer = createSpan(0, 20);
      const inner = createSpan(5, 5);
      expect(spansOverlap(outer, inner)).toBe(true);
    });
  });

  describe('spanContains', () => {
    it('should detect when span contains another', () => {
      const outer = createSpan(0, 20);
      const inner = createSpan(5, 5);
      expect(spanContains(outer, inner)).toBe(true);
    });

    it('should return true for equal spans', () => {
      const span = createSpan(5, 10);
      expect(spanContains(span, span)).toBe(true);
    });

    it('should return false when container is smaller', () => {
      const small = createSpan(5, 5);
      const large = createSpan(0, 20);
      expect(spanContains(small, large)).toBe(false);
    });

    it('should handle edge-aligned spans', () => {
      const outer = createSpan(0, 10);
      const atStart = createSpan(0, 5);
      const atEnd = createSpan(5, 5);
      expect(spanContains(outer, atStart)).toBe(true);
      expect(spanContains(outer, atEnd)).toBe(true);
    });
  });

  describe('spanFromRange', () => {
    it('should create span from start and end', () => {
      const span = spanFromRange(10, 20);
      expect(span.start).toBe(10);
      expect(span.length).toBe(10);
    });

    it('should handle same start and end', () => {
      const span = spanFromRange(5, 5);
      expect(span.start).toBe(5);
      expect(span.length).toBe(0);
    });
  });

  describe('shiftSpan', () => {
    it('should shift span by positive offset', () => {
      const span = shiftSpan(createSpan(10, 5), 3);
      expect(span.start).toBe(13);
      expect(span.length).toBe(5);
    });

    it('should shift span by negative offset', () => {
      const span = shiftSpan(createSpan(10, 5), -5);
      expect(span.start).toBe(5);
      expect(span.length).toBe(5);
    });
  });

  describe('emptySpan', () => {
    it('should create zero-length span at position', () => {
      const span = emptySpan(10);
      expect(span.start).toBe(10);
      expect(span.length).toBe(0);
    });
  });

  describe('isEmptySpan', () => {
    it('should return true for zero-length spans', () => {
      expect(isEmptySpan(createSpan(5, 0))).toBe(true);
    });

    it('should return false for non-empty spans', () => {
      expect(isEmptySpan(createSpan(5, 1))).toBe(false);
    });
  });
});

describe('LineSpan', () => {
  describe('createLineSpan', () => {
    it('should create a line span with start and end', () => {
      const span = createLineSpan(1, 10);
      expect(span.startLine).toBe(1);
      expect(span.endLine).toBe(10);
    });

    it('should allow single line spans', () => {
      const span = createLineSpan(5, 5);
      expect(span.startLine).toBe(5);
      expect(span.endLine).toBe(5);
    });

    it('should throw for line numbers < 1', () => {
      expect(() => createLineSpan(0, 5)).toThrow('Line numbers must be >= 1');
      expect(() => createLineSpan(1, 0)).toThrow('Line numbers must be >= 1');
      expect(() => createLineSpan(-1, 5)).toThrow('Line numbers must be >= 1');
    });

    it('should throw when end < start', () => {
      expect(() => createLineSpan(10, 5)).toThrow('End line must be >= start line');
    });
  });

  describe('singleLine', () => {
    it('should create a single line span', () => {
      const span = singleLine(7);
      expect(span.startLine).toBe(7);
      expect(span.endLine).toBe(7);
    });
  });

  describe('lineCount', () => {
    it('should count lines correctly', () => {
      expect(lineCount(createLineSpan(1, 10))).toBe(10);
      expect(lineCount(createLineSpan(5, 5))).toBe(1);
      expect(lineCount(createLineSpan(1, 100))).toBe(100);
    });
  });

  describe('lineSpansOverlap', () => {
    it('should detect overlapping line spans', () => {
      const a = createLineSpan(1, 10);
      const b = createLineSpan(5, 15);
      expect(lineSpansOverlap(a, b)).toBe(true);
      expect(lineSpansOverlap(b, a)).toBe(true);
    });

    it('should detect adjacent line spans as overlapping', () => {
      // Line spans are inclusive, so [1,5] and [5,10] overlap at line 5
      const a = createLineSpan(1, 5);
      const b = createLineSpan(5, 10);
      expect(lineSpansOverlap(a, b)).toBe(true);
    });

    it('should detect non-overlapping line spans', () => {
      const a = createLineSpan(1, 5);
      const b = createLineSpan(7, 10);
      expect(lineSpansOverlap(a, b)).toBe(false);
    });

    it('should detect contained spans as overlapping', () => {
      const outer = createLineSpan(1, 20);
      const inner = createLineSpan(5, 10);
      expect(lineSpansOverlap(outer, inner)).toBe(true);
    });
  });
});
