import { describe, it, expect } from 'vitest';
import { collapseToChangesOnly, collapseAlignedToChangesOnly } from './collapse-context';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

describe('collapseToChangesOnly', () => {
  it('returns empty array for empty input', () => {
    expect(collapseToChangesOnly([])).toEqual([]);
  });

  it('returns empty array when there are no changes', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
    ];
    expect(collapseToChangesOnly(lines)).toEqual([]);
  });

  it('includes change with 3 context lines by default', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
      { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 4 },
      { type: 'addition', content: 'added line', oldLineNumber: null, newLineNumber: 5 },
      { type: 'context', content: 'line 6', oldLineNumber: 5, newLineNumber: 6 },
      { type: 'context', content: 'line 7', oldLineNumber: 6, newLineNumber: 7 },
      { type: 'context', content: 'line 8', oldLineNumber: 7, newLineNumber: 8 },
      { type: 'context', content: 'line 9', oldLineNumber: 8, newLineNumber: 9 },
    ];

    const result = collapseToChangesOnly(lines);

    // Should have: header + 3 context before + addition + 3 context after = 8 lines
    expect(result).toHaveLength(8);
    expect(result[0]?.type).toBe('header');
    expect(result[0]?.content).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    // Context lines 2,3,4 before the addition
    expect(result[1]?.content).toBe('line 2');
    expect(result[2]?.content).toBe('line 3');
    expect(result[3]?.content).toBe('line 4');
    // The addition
    expect(result[4]?.type).toBe('addition');
    expect(result[4]?.content).toBe('added line');
    // Context lines 6,7,8 after the addition
    expect(result[5]?.content).toBe('line 6');
    expect(result[6]?.content).toBe('line 7');
    expect(result[7]?.content).toBe('line 8');
  });

  it('handles deletion lines', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'deleted line', oldLineNumber: 2, newLineNumber: null },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 2 },
    ];

    const result = collapseToChangesOnly(lines);

    expect(result).toHaveLength(4); // header + 3 lines
    expect(result[0]?.type).toBe('header');
    expect(result[2]?.type).toBe('deletion');
  });

  it('merges adjacent change ranges', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'addition', content: 'added 1', oldLineNumber: null, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 2, newLineNumber: 3 },
      { type: 'addition', content: 'added 2', oldLineNumber: null, newLineNumber: 4 },
      { type: 'context', content: 'line 5', oldLineNumber: 3, newLineNumber: 5 },
    ];

    const result = collapseToChangesOnly(lines);

    // Should have single hunk since changes are close together
    const headers = result.filter(l => l.type === 'header');
    expect(headers).toHaveLength(1);
  });

  it('creates separate hunks for distant changes', () => {
    const lines: ParsedDiffLine[] = [];
    // First change at line 5
    for (let i = 1; i <= 4; i++) {
      lines.push({ type: 'context', content: `line ${i}`, oldLineNumber: i, newLineNumber: i });
    }
    lines.push({ type: 'addition', content: 'added 1', oldLineNumber: null, newLineNumber: 5 });
    // Gap of 10 lines
    for (let i = 6; i <= 15; i++) {
      lines.push({ type: 'context', content: `line ${i}`, oldLineNumber: i - 1, newLineNumber: i });
    }
    // Second change at line 16
    lines.push({ type: 'addition', content: 'added 2', oldLineNumber: null, newLineNumber: 16 });
    for (let i = 17; i <= 20; i++) {
      lines.push({ type: 'context', content: `line ${i}`, oldLineNumber: i - 2, newLineNumber: i });
    }

    const result = collapseToChangesOnly(lines);

    // Should have 2 separate hunks
    const headers = result.filter(l => l.type === 'header');
    expect(headers).toHaveLength(2);
  });

  it('respects custom context line count', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 4 },
      { type: 'context', content: 'line 5', oldLineNumber: 4, newLineNumber: 5 },
      { type: 'context', content: 'line 6', oldLineNumber: 5, newLineNumber: 6 },
      { type: 'context', content: 'line 7', oldLineNumber: 6, newLineNumber: 7 },
    ];

    const result = collapseToChangesOnly(lines, 1);

    // Should have: header + 1 context before + addition + 1 context after = 4 lines
    expect(result).toHaveLength(4);
    expect(result[1]?.content).toBe('line 3'); // 1 line before
    expect(result[2]?.content).toBe('added');
    expect(result[3]?.content).toBe('line 5'); // 1 line after
  });

  it('handles changes at the start of file', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'addition', content: 'added first', oldLineNumber: null, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 1, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 2, newLineNumber: 3 },
      { type: 'context', content: 'line 4', oldLineNumber: 3, newLineNumber: 4 },
    ];

    const result = collapseToChangesOnly(lines);

    expect(result).toHaveLength(5); // header + addition + 3 context after
    expect(result[1]?.type).toBe('addition');
    expect(result[1]?.content).toBe('added first');
  });

  it('handles changes at the end of file', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
      { type: 'addition', content: 'added last', oldLineNumber: null, newLineNumber: 4 },
    ];

    const result = collapseToChangesOnly(lines);

    expect(result).toHaveLength(5); // header + 3 context before + addition
    expect(result[4]?.type).toBe('addition');
    expect(result[4]?.content).toBe('added last');
  });

  it('generates correct hunk header line numbers', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line 10', oldLineNumber: 10, newLineNumber: 10 },
      { type: 'context', content: 'line 11', oldLineNumber: 11, newLineNumber: 11 },
      { type: 'deletion', content: 'old line', oldLineNumber: 12, newLineNumber: null },
      { type: 'addition', content: 'new line', oldLineNumber: null, newLineNumber: 12 },
      { type: 'context', content: 'line 13', oldLineNumber: 13, newLineNumber: 13 },
    ];

    const result = collapseToChangesOnly(lines, 2);

    expect(result[0]?.content).toMatch(/@@ -10,/);
  });
});

describe('collapseAlignedToChangesOnly', () => {
  it('returns empty array for empty input', () => {
    expect(collapseAlignedToChangesOnly([])).toEqual([]);
  });

  it('returns empty array when there are no changes', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: 'line-1',
        left: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      },
      {
        key: 'line-2',
        left: { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
        right: { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      },
    ];
    expect(collapseAlignedToChangesOnly(lines)).toEqual([]);
  });

  it('includes changes with context lines', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: 'line-1',
        left: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      },
      {
        key: 'line-2',
        left: { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
        right: { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 2 },
      },
      {
        key: 'line-3',
        left: { type: 'deletion', content: 'old', oldLineNumber: 3, newLineNumber: null },
        right: { type: 'addition', content: 'new', oldLineNumber: null, newLineNumber: 3 },
      },
      {
        key: 'line-4',
        left: { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 4 },
        right: { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 4 },
      },
      {
        key: 'line-5',
        left: { type: 'context', content: 'line 5', oldLineNumber: 5, newLineNumber: 5 },
        right: { type: 'context', content: 'line 5', oldLineNumber: 5, newLineNumber: 5 },
      },
    ];

    const result = collapseAlignedToChangesOnly(lines, 2);

    // With context of 2: lines 1,2 before + change + lines 4,5 after = 5 lines
    expect(result).toHaveLength(5);
    expect(result[2]?.left?.type).toBe('deletion');
    expect(result[2]?.right?.type).toBe('addition');
  });

  it('detects changes on left side only', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: 'line-1',
        left: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      },
      {
        key: 'line-2',
        left: { type: 'deletion', content: 'deleted', oldLineNumber: 2, newLineNumber: null },
        right: null,
      },
      {
        key: 'line-3',
        left: { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 2 },
        right: { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 2 },
      },
    ];

    const result = collapseAlignedToChangesOnly(lines);

    expect(result.length).toBeGreaterThan(0);
    expect(result.some(l => l.left?.type === 'deletion')).toBe(true);
  });

  it('detects changes on right side only', () => {
    const lines: AlignedDiffLine[] = [
      {
        key: 'line-1',
        left: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      },
      {
        key: 'line-2',
        left: null,
        right: { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 2 },
      },
      {
        key: 'line-3',
        left: { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 3 },
        right: { type: 'context', content: 'line 2', oldLineNumber: 2, newLineNumber: 3 },
      },
    ];

    const result = collapseAlignedToChangesOnly(lines);

    expect(result.length).toBeGreaterThan(0);
    expect(result.some(l => l.right?.type === 'addition')).toBe(true);
  });

  it('merges adjacent ranges', () => {
    const lines: AlignedDiffLine[] = [];
    for (let i = 1; i <= 10; i++) {
      if (i === 3 || i === 5) {
        lines.push({
          key: `line-${i}`,
          left: { type: 'deletion', content: `old ${i}`, oldLineNumber: i, newLineNumber: null },
          right: { type: 'addition', content: `new ${i}`, oldLineNumber: null, newLineNumber: i },
        });
      } else {
        lines.push({
          key: `line-${i}`,
          left: { type: 'context', content: `line ${i}`, oldLineNumber: i, newLineNumber: i },
          right: { type: 'context', content: `line ${i}`, oldLineNumber: i, newLineNumber: i },
        });
      }
    }

    const result = collapseAlignedToChangesOnly(lines);

    // Changes at 3 and 5 are close enough to be in same range with context=3
    // Should include lines 1-8 (context around both changes merged)
    expect(result.length).toBeLessThan(lines.length);
    expect(result.length).toBeGreaterThan(2); // More than just the changes
  });
});
