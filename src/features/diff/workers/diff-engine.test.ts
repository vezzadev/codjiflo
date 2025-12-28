/**
 * Tests for diff-engine (S-3.0, S-3.1, S-3.2, S-3.4, S-3.5)
 */

import { describe, it, expect } from 'vitest';
import {
  computeLineDiff,
  computeWordDiff,
  enhanceWithWordDiffs,
  computeAlignment,
  filterWhitespaceChanges,
} from './diff-engine';
import type { ParsedDiffLine } from '../types';

describe('computeLineDiff', () => {
  it('returns empty array for identical content', () => {
    const result = computeLineDiff('hello', 'hello', false);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'context',
      content: 'hello',
      oldLineNumber: 1,
      newLineNumber: 1,
    });
  });

  it('detects line additions', () => {
    const result = computeLineDiff('line1', 'line1\nline2', false);
    // Find the addition - algorithm may produce different outputs
    const addition = result.find(l => l.type === 'addition' && l.content === 'line2');
    expect(addition).toBeDefined();
    expect(addition?.newLineNumber).toBeDefined();
  });

  it('detects line deletions', () => {
    const result = computeLineDiff('line1\nline2', 'line1', false);
    // Find the deletion
    const deletion = result.find(l => l.type === 'deletion' && l.content === 'line2');
    expect(deletion).toBeDefined();
    expect(deletion?.oldLineNumber).toBeDefined();
  });

  it('detects line modifications', () => {
    const result = computeLineDiff('old line', 'new line', false);
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('deletion');
    expect(result[0]?.content).toBe('old line');
    expect(result[1]?.type).toBe('addition');
    expect(result[1]?.content).toBe('new line');
  });

  it('handles empty old content (new file)', () => {
    const result = computeLineDiff('', 'line1\nline2', false);
    expect(result.every(l => l.type === 'addition')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('handles empty new content (deleted file)', () => {
    const result = computeLineDiff('line1\nline2', '', false);
    expect(result.every(l => l.type === 'deletion')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('normalizes line endings (CRLF to LF)', () => {
    const result = computeLineDiff('line1\r\nline2', 'line1\nline2', false);
    // Should be treated as identical
    expect(result.every(l => l.type === 'context')).toBe(true);
  });

  it('tracks line numbers correctly', () => {
    const result = computeLineDiff(
      'a\nb\nc',
      'a\nx\nc',
      false
    );

    // Line 1 is context (a)
    expect(result[0]).toMatchObject({
      type: 'context',
      oldLineNumber: 1,
      newLineNumber: 1,
    });

    // Line 2 is deletion (b) then addition (x)
    const deletion = result.find(l => l.type === 'deletion');
    const addition = result.find(l => l.type === 'addition');

    expect(deletion?.oldLineNumber).toBe(2);
    expect(deletion?.newLineNumber).toBeNull();
    expect(addition?.oldLineNumber).toBeNull();
    expect(addition?.newLineNumber).toBe(2);
  });

  describe('ignoreWhitespace', () => {
    it('ignores leading/trailing whitespace when enabled', () => {
      const result = computeLineDiff('  hello  ', 'hello', true);
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('context');
    });

    it('ignores multiple spaces when enabled', () => {
      const result = computeLineDiff('hello   world', 'hello world', true);
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('context');
    });

    it('still detects content changes when whitespace is ignored', () => {
      const result = computeLineDiff('  hello  ', 'world', true);
      expect(result).toHaveLength(2);
      expect(result[0]?.type).toBe('deletion');
      expect(result[1]?.type).toBe('addition');
    });
  });
});

describe('computeWordDiff', () => {
  it('returns unchanged segments for identical lines', () => {
    const result = computeWordDiff('hello world', 'hello world');
    expect(result.oldSegments).toEqual([{ text: 'hello world', type: 'unchanged' }]);
    expect(result.newSegments).toEqual([{ text: 'hello world', type: 'unchanged' }]);
  });

  it('identifies removed words', () => {
    const result = computeWordDiff('hello world', 'hello');
    expect(result.oldSegments).toContainEqual({ text: ' world', type: 'removed' });
    expect(result.newSegments.every(s => s.type === 'unchanged')).toBe(true);
  });

  it('identifies added words', () => {
    const result = computeWordDiff('hello', 'hello world');
    expect(result.newSegments).toContainEqual({ text: ' world', type: 'added' });
  });

  it('identifies changed words', () => {
    const result = computeWordDiff('old value', 'new value');
    expect(result.oldSegments).toContainEqual({ text: 'old', type: 'removed' });
    expect(result.newSegments).toContainEqual({ text: 'new', type: 'added' });
  });

  it('handles empty old line', () => {
    const result = computeWordDiff('', 'new content');
    expect(result.oldSegments).toHaveLength(0);
    expect(result.newSegments).toContainEqual({ text: 'new content', type: 'added' });
  });

  it('handles empty new line', () => {
    const result = computeWordDiff('old content', '');
    expect(result.oldSegments).toContainEqual({ text: 'old content', type: 'removed' });
    expect(result.newSegments).toHaveLength(0);
  });
});

describe('enhanceWithWordDiffs', () => {
  it('does not modify context lines', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'unchanged', oldLineNumber: 1, newLineNumber: 1 },
    ];
    const result = enhanceWithWordDiffs(lines);
    expect(result[0]?.wordDiff).toBeUndefined();
  });

  it('adds word diff to consecutive deletion-addition pairs', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: 'old value', oldLineNumber: 1, newLineNumber: null },
      { type: 'addition', content: 'new value', oldLineNumber: null, newLineNumber: 1 },
    ];
    const result = enhanceWithWordDiffs(lines);
    expect(result[0]?.wordDiff).toBeDefined();
    expect(result[1]?.wordDiff).toBeDefined();
    expect(result[0]?.wordDiff).toContainEqual({ text: 'old', type: 'removed' });
    expect(result[1]?.wordDiff).toContainEqual({ text: 'new', type: 'added' });
  });

  it('does not add word diff to standalone deletions', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: 'deleted', oldLineNumber: 1, newLineNumber: null },
      { type: 'context', content: 'unchanged', oldLineNumber: 2, newLineNumber: 1 },
    ];
    const result = enhanceWithWordDiffs(lines);
    expect(result[0]?.wordDiff).toBeUndefined();
  });

  it('does not add word diff to standalone additions', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'unchanged', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 2 },
    ];
    const result = enhanceWithWordDiffs(lines);
    expect(result[1]?.wordDiff).toBeUndefined();
  });

  it('handles multiple modification pairs', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: 'old1', oldLineNumber: 1, newLineNumber: null },
      { type: 'addition', content: 'new1', oldLineNumber: null, newLineNumber: 1 },
      { type: 'context', content: 'unchanged', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'deletion', content: 'old2', oldLineNumber: 3, newLineNumber: null },
      { type: 'addition', content: 'new2', oldLineNumber: null, newLineNumber: 3 },
    ];
    const result = enhanceWithWordDiffs(lines);
    expect(result[0]?.wordDiff).toBeDefined();
    expect(result[1]?.wordDiff).toBeDefined();
    expect(result[2]?.wordDiff).toBeUndefined();
    expect(result[3]?.wordDiff).toBeDefined();
    expect(result[4]?.wordDiff).toBeDefined();
  });
});

describe('computeAlignment', () => {
  it('aligns context lines on both sides', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'unchanged', oldLineNumber: 1, newLineNumber: 1 },
    ];
    const result = computeAlignment(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left).toEqual(lines[0]);
    expect(result[0]?.right).toEqual(lines[0]);
  });

  it('aligns headers on both sides', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'header', content: '@@ -1,3 +1,4 @@', oldLineNumber: null, newLineNumber: null },
    ];
    const result = computeAlignment(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left).toEqual(lines[0]);
    expect(result[0]?.right).toEqual(lines[0]);
  });

  it('puts pure deletions on left with null right', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: 'removed', oldLineNumber: 1, newLineNumber: null },
    ];
    const result = computeAlignment(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left).toEqual(lines[0]);
    expect(result[0]?.right).toBeNull();
  });

  it('puts pure additions on right with null left', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 1 },
    ];
    const result = computeAlignment(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left).toBeNull();
    expect(result[0]?.right).toEqual(lines[0]);
  });

  it('pairs consecutive deletion-addition as modification', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: 'old', oldLineNumber: 1, newLineNumber: null },
      { type: 'addition', content: 'new', oldLineNumber: null, newLineNumber: 1 },
    ];
    const result = computeAlignment(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left).toEqual(lines[0]);
    expect(result[0]?.right).toEqual(lines[1]);
  });

  it('generates unique keys for each pair', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'ctx1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'del', oldLineNumber: 2, newLineNumber: null },
      { type: 'addition', content: 'add', oldLineNumber: null, newLineNumber: 2 },
      { type: 'context', content: 'ctx2', oldLineNumber: 3, newLineNumber: 3 },
    ];
    const result = computeAlignment(lines);
    const keys = result.map(r => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('handles complex diff patterns', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'header', content: '@@ -1,4 +1,5 @@', oldLineNumber: null, newLineNumber: null },
      { type: 'context', content: 'line1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'old2', oldLineNumber: 2, newLineNumber: null },
      { type: 'addition', content: 'new2', oldLineNumber: null, newLineNumber: 2 },
      { type: 'addition', content: 'extra', oldLineNumber: null, newLineNumber: 3 },
      { type: 'deletion', content: 'removed', oldLineNumber: 3, newLineNumber: null },
      { type: 'context', content: 'line4', oldLineNumber: 4, newLineNumber: 4 },
    ];
    const result = computeAlignment(lines);

    expect(result).toHaveLength(6);
    // Header on both sides
    expect(result[0]?.left?.type).toBe('header');
    expect(result[0]?.right?.type).toBe('header');
    // Context on both sides
    expect(result[1]?.left?.type).toBe('context');
    expect(result[1]?.right?.type).toBe('context');
    // Modification pair
    expect(result[2]?.left?.type).toBe('deletion');
    expect(result[2]?.right?.type).toBe('addition');
    // Pure addition
    expect(result[3]?.left).toBeNull();
    expect(result[3]?.right?.type).toBe('addition');
    // Pure deletion
    expect(result[4]?.left?.type).toBe('deletion');
    expect(result[4]?.right).toBeNull();
    // Context again
    expect(result[5]?.left?.type).toBe('context');
    expect(result[5]?.right?.type).toBe('context');
  });
});

describe('filterWhitespaceChanges', () => {
  it('keeps headers unchanged', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'header', content: '@@ -1,1 +1,1 @@', oldLineNumber: null, newLineNumber: null },
    ];
    const result = filterWhitespaceChanges(lines);
    expect(result).toEqual(lines);
  });

  it('keeps context lines unchanged', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'unchanged', oldLineNumber: 1, newLineNumber: 1 },
    ];
    const result = filterWhitespaceChanges(lines);
    expect(result).toEqual(lines);
  });

  it('converts whitespace-only changes to context', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: '  hello  ', oldLineNumber: 1, newLineNumber: null },
      { type: 'addition', content: 'hello', oldLineNumber: null, newLineNumber: 1 },
    ];
    const result = filterWhitespaceChanges(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('context');
    expect(result[0]?.oldLineNumber).toBe(1);
    expect(result[0]?.newLineNumber).toBe(1);
  });

  it('keeps real content changes', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: 'old value', oldLineNumber: 1, newLineNumber: null },
      { type: 'addition', content: 'new value', oldLineNumber: null, newLineNumber: 1 },
    ];
    const result = filterWhitespaceChanges(lines);
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('deletion');
    expect(result[1]?.type).toBe('addition');
  });

  it('removes empty whitespace-only deletions', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: '   ', oldLineNumber: 1, newLineNumber: null },
    ];
    const result = filterWhitespaceChanges(lines);
    expect(result).toHaveLength(0);
  });

  it('removes empty whitespace-only additions', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'addition', content: '   ', oldLineNumber: null, newLineNumber: 1 },
    ];
    const result = filterWhitespaceChanges(lines);
    expect(result).toHaveLength(0);
  });

  it('handles mixed whitespace and content changes', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'context', content: 'line1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: '  spaced  ', oldLineNumber: 2, newLineNumber: null },
      { type: 'addition', content: 'spaced', oldLineNumber: null, newLineNumber: 2 },
      { type: 'deletion', content: 'actual', oldLineNumber: 3, newLineNumber: null },
      { type: 'addition', content: 'change', oldLineNumber: null, newLineNumber: 3 },
    ];
    const result = filterWhitespaceChanges(lines);
    // context, converted context, deletion, addition
    expect(result).toHaveLength(4);
    expect(result[0]?.type).toBe('context');
    expect(result[1]?.type).toBe('context');
    expect(result[2]?.type).toBe('deletion');
    expect(result[3]?.type).toBe('addition');
  });
});
