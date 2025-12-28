/**
 * Tests for align-diff utility (S-3.2, S-3.3)
 */

import { describe, it, expect } from 'vitest';
import { alignDiffLines, applyContentFilter } from './align-diff';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

describe('alignDiffLines', () => {
  it('is an alias for computeAlignment', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'test', oldLineNumber: 1, newLineNumber: 1 },
    ];
    const result = alignDiffLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left).toEqual(lines[0]);
    expect(result[0]?.right).toEqual(lines[0]);
  });
});

describe('applyContentFilter', () => {
  const createAlignedLines = (): AlignedDiffLine[] => {
    const contextLine: ParsedDiffLine = {
      type: 'context',
      content: 'unchanged',
      oldLineNumber: 1,
      newLineNumber: 1,
    };
    const deletion: ParsedDiffLine = {
      type: 'deletion',
      content: 'removed',
      oldLineNumber: 2,
      newLineNumber: null,
    };
    const addition: ParsedDiffLine = {
      type: 'addition',
      content: 'added',
      oldLineNumber: null,
      newLineNumber: 2,
    };
    const modDeletion: ParsedDiffLine = {
      type: 'deletion',
      content: 'old value',
      oldLineNumber: 3,
      newLineNumber: null,
    };
    const modAddition: ParsedDiffLine = {
      type: 'addition',
      content: 'new value',
      oldLineNumber: null,
      newLineNumber: 3,
    };

    return [
      { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      { left: deletion, right: null, key: 'del-2' },
      { left: null, right: addition, key: 'add-2' },
      { left: modDeletion, right: modAddition, key: 'mod-3-3' },
    ];
  };

  describe('filter = both', () => {
    it('returns all lines unchanged', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'both');
      expect(result).toEqual(lines);
    });
  });

  describe('filter = left', () => {
    it('keeps context lines', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'left');
      expect(result.some(p => p.left?.type === 'context')).toBe(true);
    });

    it('keeps pure deletions (left-side content)', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'left');
      const deletion = result.find(p => p.left?.type === 'deletion' && p.right === null);
      expect(deletion).toBeDefined();
    });

    it('removes pure additions (right-side only)', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'left');
      const pureAddition = result.find(p => p.left === null && p.right?.type === 'addition');
      expect(pureAddition).toBeUndefined();
    });

    it('keeps modification pairs', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'left');
      const modification = result.find(
        p => p.left?.type === 'deletion' && p.right?.type === 'addition'
      );
      expect(modification).toBeDefined();
    });
  });

  describe('filter = right', () => {
    it('keeps context lines', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'right');
      expect(result.some(p => p.right?.type === 'context')).toBe(true);
    });

    it('keeps pure additions (right-side content)', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'right');
      const addition = result.find(p => p.left === null && p.right?.type === 'addition');
      expect(addition).toBeDefined();
    });

    it('removes pure deletions (left-side only)', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'right');
      const pureDeletion = result.find(p => p.left?.type === 'deletion' && p.right === null);
      expect(pureDeletion).toBeUndefined();
    });

    it('keeps modification pairs', () => {
      const lines = createAlignedLines();
      const result = applyContentFilter(lines, 'right');
      const modification = result.find(
        p => p.left?.type === 'deletion' && p.right?.type === 'addition'
      );
      expect(modification).toBeDefined();
    });
  });

  it('filters out rows where both sides become null', () => {
    const lines: AlignedDiffLine[] = [
      {
        left: null,
        right: { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 1 },
        key: 'add-1',
      },
    ];
    const result = applyContentFilter(lines, 'left');
    expect(result).toHaveLength(0);
  });
});
