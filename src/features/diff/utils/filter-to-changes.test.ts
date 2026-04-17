import { describe, it, expect } from 'vitest';
import { filterToChangesOnly, filterAlignedToChangesOnly } from './filter-to-changes';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

describe('filterToChangesOnly', () => {
  it('returns empty array for empty input', () => {
    expect(filterToChangesOnly([])).toEqual([]);
  });

  it('returns empty array when there are no changes', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
    ];
    expect(filterToChangesOnly(lines)).toEqual([]);
  });

  it('includes changes with surrounding context lines', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
      { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 4 },
      { type: 'deletion', content: 'old line', oldLineNumber: 5, newLineNumber: null },
      { type: 'addition', content: 'new line', oldLineNumber: null, newLineNumber: 5 },
      { type: 'context', content: 'line 6', oldLineNumber: 6, newLineNumber: 6 },
      { type: 'context', content: 'line 7', oldLineNumber: 7, newLineNumber: 7 },
      { type: 'context', content: 'line 8', oldLineNumber: 8, newLineNumber: 8 },
      { type: 'context', content: 'line 9', oldLineNumber: 9, newLineNumber: 9 },
    ];

    const result = filterToChangesOnly(lines);

    // Should have: header + 3 context before + 2 changes + 3 context after
    expect(result).toHaveLength(9); // 1 header + 8 lines

    const [header, ctx1, ctx2, ctx3, del, add, ctx4, ctx5, ctx6] = result;

    expect(header?.type).toBe('header');
    // Line counts: 3 context + 1 deletion + 3 context = 7 old, 3 context + 1 addition + 3 context = 7 new
    expect(header?.content).toMatch(/@@ -2,7 \+2,7 @@/);

    // Context before (lines 2, 3, 4)
    expect(ctx1?.type).toBe('context');
    expect(ctx1?.content).toBe('line 2');
    expect(ctx2?.type).toBe('context');
    expect(ctx2?.content).toBe('line 3');
    expect(ctx3?.type).toBe('context');
    expect(ctx3?.content).toBe('line 4');

    // Changes
    expect(del?.type).toBe('deletion');
    expect(add?.type).toBe('addition');

    // Context after (lines 6, 7, 8)
    expect(ctx4?.type).toBe('context');
    expect(ctx4?.content).toBe('line 6');
    expect(ctx5?.type).toBe('context');
    expect(ctx5?.content).toBe('line 7');
    expect(ctx6?.type).toBe('context');
    expect(ctx6?.content).toBe('line 8');
  });

  it('creates separate hunks for non-contiguous changes', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'deleted', oldLineNumber: 2, newLineNumber: null },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 2 },
      { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 3 },
      { type: 'context', content: 'line 5', oldLineNumber: 5, newLineNumber: 4 },
      { type: 'context', content: 'line 6', oldLineNumber: 6, newLineNumber: 5 },
      { type: 'context', content: 'line 7', oldLineNumber: 7, newLineNumber: 6 },
      { type: 'context', content: 'line 8', oldLineNumber: 8, newLineNumber: 7 },
      { type: 'context', content: 'line 9', oldLineNumber: 9, newLineNumber: 8 },
      { type: 'context', content: 'line 10', oldLineNumber: 10, newLineNumber: 9 },
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 10 },
      { type: 'context', content: 'line 12', oldLineNumber: 11, newLineNumber: 11 },
    ];

    const result = filterToChangesOnly(lines);

    // Should have two hunks: first change (lines 1-5) and second change (lines 8-12)
    const headers = result.filter((line) => line.type === 'header');
    expect(headers).toHaveLength(2);
  });

  it('merges adjacent hunks that would overlap', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'deleted 1', oldLineNumber: 2, newLineNumber: null },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 2 },
      { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 3 },
      { type: 'context', content: 'line 5', oldLineNumber: 5, newLineNumber: 4 },
      { type: 'context', content: 'line 6', oldLineNumber: 6, newLineNumber: 5 },
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 6 },
      { type: 'context', content: 'line 7', oldLineNumber: 7, newLineNumber: 7 },
    ];

    const result = filterToChangesOnly(lines);

    // Changes are 5 lines apart - within 2*3=6 context lines, so should be merged
    const headers = result.filter((line) => line.type === 'header');
    expect(headers).toHaveLength(1);
  });

  it('respects custom context lines parameter', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 4 },
      { type: 'context', content: 'line 5', oldLineNumber: 4, newLineNumber: 5 },
      { type: 'context', content: 'line 6', oldLineNumber: 5, newLineNumber: 6 },
      { type: 'context', content: 'line 7', oldLineNumber: 6, newLineNumber: 7 },
    ];

    // With 1 context line, should only include 1 before and 1 after
    const result = filterToChangesOnly(lines, 1);

    // header + 1 context before + 1 addition + 1 context after = 4 lines
    expect(result).toHaveLength(4);

    const [header, ctxBefore, addition, ctxAfter] = result;
    expect(header?.type).toBe('header');
    expect(ctxBefore?.content).toBe('line 3');
    expect(addition?.type).toBe('addition');
    expect(ctxAfter?.content).toBe('line 5');
  });

  it('handles changes at the beginning of the file', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'addition', content: 'new first line', oldLineNumber: null, newLineNumber: 1 },
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 2 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 3 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 4 },
      { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 5 },
    ];

    const result = filterToChangesOnly(lines);

    const [header, addition] = result;
    expect(header?.type).toBe('header');
    expect(addition?.type).toBe('addition');
    // Should include 3 context lines after
    expect(result).toHaveLength(5); // header + addition + 3 context
  });

  it('handles changes at the end of the file', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
      { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 4 },
      { type: 'addition', content: 'new last line', oldLineNumber: null, newLineNumber: 5 },
    ];

    const result = filterToChangesOnly(lines);

    const [header] = result;
    expect(header?.type).toBe('header');
    // Should include 3 context lines before + addition
    expect(result).toHaveLength(5); // header + 3 context + addition
    expect(result[4]?.type).toBe('addition');
  });
});

describe('filterAlignedToChangesOnly', () => {
  it('returns empty array for empty input', () => {
    expect(filterAlignedToChangesOnly([])).toEqual([]);
  });

  it('returns empty array when there are no changes', () => {
    const lines: AlignedDiffLine[] = [
      {
        left: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        key: '1',
      },
    ];
    expect(filterAlignedToChangesOnly(lines)).toEqual([]);
  });

  it('includes changes with context lines', () => {
    const lines: AlignedDiffLine[] = [
      {
        left: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        key: '1',
      },
      {
        left: { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
        right: { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
        key: '2',
      },
      {
        left: { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
        right: { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
        key: '3',
      },
      {
        left: { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 4 },
        right: { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 4 },
        key: '4',
      },
      {
        left: { type: 'deletion', content: 'old line', oldLineNumber: 5, newLineNumber: null },
        right: null,
        key: '5',
      },
      {
        left: null,
        right: { type: 'addition', content: 'new line', oldLineNumber: null, newLineNumber: 5 },
        key: '6',
      },
      {
        left: { type: 'context', content: 'line 6', oldLineNumber: 6, newLineNumber: 6 },
        right: { type: 'context', content: 'line 6', oldLineNumber: 6, newLineNumber: 6 },
        key: '7',
      },
      {
        left: { type: 'context', content: 'line 7', oldLineNumber: 7, newLineNumber: 7 },
        right: { type: 'context', content: 'line 7', oldLineNumber: 7, newLineNumber: 7 },
        key: '8',
      },
      {
        left: { type: 'context', content: 'line 8', oldLineNumber: 8, newLineNumber: 8 },
        right: { type: 'context', content: 'line 8', oldLineNumber: 8, newLineNumber: 8 },
        key: '9',
      },
      {
        left: { type: 'context', content: 'line 9', oldLineNumber: 9, newLineNumber: 9 },
        right: { type: 'context', content: 'line 9', oldLineNumber: 9, newLineNumber: 9 },
        key: '10',
      },
    ];

    const result = filterAlignedToChangesOnly(lines);

    // Should have: 3 context before + 2 changes + 3 context after (no header for first range)
    expect(result).toHaveLength(8);
    expect(result[0]?.left?.content).toBe('line 2');
    expect(result[1]?.left?.content).toBe('line 3');
    expect(result[2]?.left?.content).toBe('line 4');
    expect(result[3]?.left?.type).toBe('deletion');
    expect(result[4]?.right?.type).toBe('addition');
  });

  it('adds header between non-contiguous hunks', () => {
    const lines: AlignedDiffLine[] = [
      {
        left: { type: 'deletion', content: 'deleted', oldLineNumber: 1, newLineNumber: null },
        right: null,
        key: '1',
      },
      ...Array.from({ length: 10 }, (_, i) => ({
        left: { type: 'context' as const, content: `line ${i + 2}`, oldLineNumber: i + 2, newLineNumber: i + 1 },
        right: { type: 'context' as const, content: `line ${i + 2}`, oldLineNumber: i + 2, newLineNumber: i + 1 },
        key: String(i + 2),
      })),
      {
        left: null,
        right: { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 11 },
        key: '12',
      },
    ];

    const result = filterAlignedToChangesOnly(lines);

    // Should have two ranges with a header between them
    const headerRows = result.filter((pair) => pair.left?.type === 'header');
    expect(headerRows).toHaveLength(1); // Only one header (between ranges, not before first)
  });
});
