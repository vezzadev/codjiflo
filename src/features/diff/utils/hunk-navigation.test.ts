import { describe, it, expect } from 'vitest';
import { calculateHunkIndices, calculateAlignedHunkIndices } from './hunk-navigation';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

describe('calculateHunkIndices', () => {
  it('returns empty array for empty input', () => {
    expect(calculateHunkIndices([])).toEqual([]);
  });

  it('returns empty array when no changes', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
    ];
    expect(calculateHunkIndices(lines)).toEqual([]);
  });

  it('identifies single hunk with one change', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 2, newLineNumber: 3 },
    ];
    expect(calculateHunkIndices(lines)).toEqual([1]);
  });

  it('groups consecutive changes into single hunk', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'deleted', oldLineNumber: 2, newLineNumber: null },
      { type: 'addition', content: 'added 1', oldLineNumber: null, newLineNumber: 2 },
      { type: 'addition', content: 'added 2', oldLineNumber: null, newLineNumber: 3 },
      { type: 'context', content: 'line 5', oldLineNumber: 3, newLineNumber: 4 },
    ];
    // Only one hunk starting at index 1
    expect(calculateHunkIndices(lines)).toEqual([1]);
  });

  it('identifies multiple separate hunks', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'ctx 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'addition', content: 'add 1', oldLineNumber: null, newLineNumber: 2 },
      { type: 'context', content: 'ctx 2', oldLineNumber: 2, newLineNumber: 3 },
      { type: 'deletion', content: 'del 1', oldLineNumber: 3, newLineNumber: null },
      { type: 'context', content: 'ctx 3', oldLineNumber: 4, newLineNumber: 4 },
    ];
    // Two hunks: index 1 and index 3
    expect(calculateHunkIndices(lines)).toEqual([1, 3]);
  });

  it('handles hunk at start of file', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'addition', content: 'add 1', oldLineNumber: null, newLineNumber: 1 },
      { type: 'context', content: 'ctx 1', oldLineNumber: 1, newLineNumber: 2 },
    ];
    expect(calculateHunkIndices(lines)).toEqual([0]);
  });

  it('handles hunk at end of file', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'ctx 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'del 1', oldLineNumber: 2, newLineNumber: null },
    ];
    expect(calculateHunkIndices(lines)).toEqual([1]);
  });

  it('ignores header lines', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'header', content: '@@ -1,3 +1,4 @@', oldLineNumber: null, newLineNumber: null },
      { type: 'addition', content: 'add 1', oldLineNumber: null, newLineNumber: 1 },
      { type: 'context', content: 'ctx 1', oldLineNumber: 1, newLineNumber: 2 },
    ];
    // Hunk starts at index 1 (the addition), not index 0 (the header)
    expect(calculateHunkIndices(lines)).toEqual([1]);
  });
});

describe('calculateAlignedHunkIndices', () => {
  it('returns empty array for empty input', () => {
    expect(calculateAlignedHunkIndices([])).toEqual([]);
  });

  it('returns empty array when no changes on either side', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: '0',
        left: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      },
    ];
    expect(calculateAlignedHunkIndices(lines)).toEqual([]);
  });

  it('identifies hunk when left side has change', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: '0',
        left: { type: 'context', content: 'ctx', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'ctx', oldLineNumber: 1, newLineNumber: 1 },
      },
      {
        key: '1',
        left: { type: 'deletion', content: 'del', oldLineNumber: 2, newLineNumber: null },
        right: null,
      },
    ];
    expect(calculateAlignedHunkIndices(lines)).toEqual([1]);
  });

  it('identifies hunk when right side has change', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: '0',
        left: { type: 'context', content: 'ctx', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'ctx', oldLineNumber: 1, newLineNumber: 1 },
      },
      {
        key: '1',
        left: null,
        right: { type: 'addition', content: 'add', oldLineNumber: null, newLineNumber: 2 },
      },
    ];
    expect(calculateAlignedHunkIndices(lines)).toEqual([1]);
  });

  it('groups consecutive aligned changes into single hunk', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: '0',
        left: { type: 'context', content: 'ctx', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'ctx', oldLineNumber: 1, newLineNumber: 1 },
      },
      {
        key: '1',
        left: { type: 'deletion', content: 'del', oldLineNumber: 2, newLineNumber: null },
        right: { type: 'addition', content: 'add', oldLineNumber: null, newLineNumber: 2 },
      },
      {
        key: '2',
        left: null,
        right: { type: 'addition', content: 'add2', oldLineNumber: null, newLineNumber: 3 },
      },
    ];
    // One hunk starting at index 1
    expect(calculateAlignedHunkIndices(lines)).toEqual([1]);
  });

  it('identifies multiple separate hunks', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: '0',
        left: { type: 'deletion', content: 'del', oldLineNumber: 1, newLineNumber: null },
        right: null,
      },
      {
        key: '1',
        left: { type: 'context', content: 'ctx', oldLineNumber: 2, newLineNumber: 1 },
        right: { type: 'context', content: 'ctx', oldLineNumber: 2, newLineNumber: 1 },
      },
      {
        key: '2',
        left: null,
        right: { type: 'addition', content: 'add', oldLineNumber: null, newLineNumber: 2 },
      },
    ];
    // Two hunks at index 0 and 2
    expect(calculateAlignedHunkIndices(lines)).toEqual([0, 2]);
  });
});
