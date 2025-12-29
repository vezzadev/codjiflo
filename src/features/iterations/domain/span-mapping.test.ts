/**
 * Tests for SpanMapping domain types
 */

import { describe, it, expect } from 'vitest';
import {
  emptySpanMappingData,
  createSpanMappingData,
  serializeMappings,
  deserializeMappings,
  type LineMapping,
} from './span-mapping';

describe('SpanMapping', () => {
  describe('emptySpanMappingData', () => {
    it('should create empty mapping data', () => {
      const data = emptySpanMappingData();
      expect(data.mappings).toEqual([]);
      expect(data.leftToRight.size).toBe(0);
      expect(data.rightToLeft.size).toBe(0);
    });
  });

  describe('createSpanMappingData', () => {
    it('should handle empty mappings', () => {
      const data = createSpanMappingData([]);
      expect(data.mappings).toEqual([]);
      expect(data.leftToRight.size).toBe(0);
      expect(data.rightToLeft.size).toBe(0);
    });

    it('should create 1:1 mappings for equal-sized spans', () => {
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 3 },
          rightSpan: { startLine: 1, endLine: 3 },
          type: 'unchanged',
        },
      ];

      const data = createSpanMappingData(mappings);

      expect(data.leftToRight.get(1)).toBe(1);
      expect(data.leftToRight.get(2)).toBe(2);
      expect(data.leftToRight.get(3)).toBe(3);
      expect(data.rightToLeft.get(1)).toBe(1);
      expect(data.rightToLeft.get(2)).toBe(2);
      expect(data.rightToLeft.get(3)).toBe(3);
    });

    it('should map to first line for modified regions with different sizes', () => {
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 3 },
          rightSpan: { startLine: 1, endLine: 5 },
          type: 'modified',
        },
      ];

      const data = createSpanMappingData(mappings);

      // Left side maps to first line of right side
      expect(data.leftToRight.get(1)).toBe(1);
      expect(data.leftToRight.get(2)).toBe(1);
      expect(data.leftToRight.get(3)).toBe(1);

      // Right side maps to first line of left side
      expect(data.rightToLeft.get(1)).toBe(1);
      expect(data.rightToLeft.get(2)).toBe(1);
      expect(data.rightToLeft.get(3)).toBe(1);
      expect(data.rightToLeft.get(4)).toBe(1);
      expect(data.rightToLeft.get(5)).toBe(1);
    });

    it('should map deleted lines to null', () => {
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 5, endLine: 7 },
          rightSpan: null,
          type: 'deleted',
        },
      ];

      const data = createSpanMappingData(mappings);

      expect(data.leftToRight.get(5)).toBe(null);
      expect(data.leftToRight.get(6)).toBe(null);
      expect(data.leftToRight.get(7)).toBe(null);
    });

    it('should map added lines to null in reverse', () => {
      const mappings: LineMapping[] = [
        {
          leftSpan: null,
          rightSpan: { startLine: 10, endLine: 12 },
          type: 'added',
        },
      ];

      const data = createSpanMappingData(mappings);

      expect(data.rightToLeft.get(10)).toBe(null);
      expect(data.rightToLeft.get(11)).toBe(null);
      expect(data.rightToLeft.get(12)).toBe(null);
    });

    it('should handle multiple mappings', () => {
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 3 },
          rightSpan: { startLine: 1, endLine: 3 },
          type: 'unchanged',
        },
        {
          leftSpan: { startLine: 4, endLine: 5 },
          rightSpan: null,
          type: 'deleted',
        },
        {
          leftSpan: null,
          rightSpan: { startLine: 4, endLine: 6 },
          type: 'added',
        },
      ];

      const data = createSpanMappingData(mappings);

      // Unchanged
      expect(data.leftToRight.get(1)).toBe(1);
      expect(data.rightToLeft.get(1)).toBe(1);

      // Deleted
      expect(data.leftToRight.get(4)).toBe(null);
      expect(data.leftToRight.get(5)).toBe(null);

      // Added
      expect(data.rightToLeft.get(4)).toBe(null);
      expect(data.rightToLeft.get(5)).toBe(null);
      expect(data.rightToLeft.get(6)).toBe(null);
    });
  });

  describe('serializeMappings', () => {
    it('should serialize mappings correctly', () => {
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 5 },
          rightSpan: { startLine: 1, endLine: 5 },
          type: 'unchanged',
        },
        {
          leftSpan: { startLine: 6, endLine: 8 },
          rightSpan: null,
          type: 'deleted',
        },
        {
          leftSpan: null,
          rightSpan: { startLine: 6, endLine: 10 },
          type: 'added',
        },
      ];

      const serialized = serializeMappings(mappings);

      expect(serialized).toEqual([
        { leftStart: 1, leftEnd: 5, rightStart: 1, rightEnd: 5, type: 'unchanged' },
        { leftStart: 6, leftEnd: 8, rightStart: null, rightEnd: null, type: 'deleted' },
        { leftStart: null, leftEnd: null, rightStart: 6, rightEnd: 10, type: 'added' },
      ]);
    });
  });

  describe('deserializeMappings', () => {
    it('should deserialize mappings correctly', () => {
      const serialized = [
        { leftStart: 1, leftEnd: 5, rightStart: 1, rightEnd: 5, type: 'unchanged' as const },
        { leftStart: 6, leftEnd: 8, rightStart: null, rightEnd: null, type: 'deleted' as const },
        { leftStart: null, leftEnd: null, rightStart: 6, rightEnd: 10, type: 'added' as const },
      ];

      const mappings = deserializeMappings(serialized);

      const expected: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 5 },
          rightSpan: { startLine: 1, endLine: 5 },
          type: 'unchanged',
        },
        {
          leftSpan: { startLine: 6, endLine: 8 },
          rightSpan: null,
          type: 'deleted',
        },
        {
          leftSpan: null,
          rightSpan: { startLine: 6, endLine: 10 },
          type: 'added',
        },
      ];
      expect(mappings).toEqual(expected);
    });

    it('should roundtrip serialize/deserialize', () => {
      const original: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 10 },
          rightSpan: { startLine: 1, endLine: 12 },
          type: 'modified',
        },
      ];

      const roundtripped = deserializeMappings(serializeMappings(original));
      expect(roundtripped).toEqual(original);
    });
  });
});
