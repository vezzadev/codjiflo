import { describe, expect, it } from 'vitest';
import type { ParsedDiffLine } from '../types';
import { getDiffLineIndexForPosition, getDiffLinePosition } from './comment-position';

const sampleLines: ParsedDiffLine[] = [
  { type: 'header', content: '@@ -1,2 +1,3 @@', oldLineNumber: null, newLineNumber: null },
  { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
  { type: 'deletion', content: 'line 2', oldLineNumber: 2, newLineNumber: null },
  { type: 'addition', content: 'line 2 updated', oldLineNumber: null, newLineNumber: 2 },
];

describe('getDiffLinePosition', () => {
  it('returns null for header lines', () => {
    expect(getDiffLinePosition(sampleLines, 0)).toBeNull();
  });

  it('returns 1-based position for non-header lines', () => {
    expect(getDiffLinePosition(sampleLines, 1)).toBe(1);
    expect(getDiffLinePosition(sampleLines, 2)).toBe(2);
    expect(getDiffLinePosition(sampleLines, 3)).toBe(3);
  });
});

describe('getDiffLineIndexForPosition', () => {
  it('finds the index for a given position', () => {
    expect(getDiffLineIndexForPosition(sampleLines, 1)).toBe(1);
    expect(getDiffLineIndexForPosition(sampleLines, 2)).toBe(2);
  });

  it('returns null when the position is invalid', () => {
    expect(getDiffLineIndexForPosition(sampleLines, 0)).toBeNull();
    expect(getDiffLineIndexForPosition(sampleLines, 99)).toBeNull();
  });
});
