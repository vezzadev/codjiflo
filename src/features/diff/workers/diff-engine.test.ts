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

  describe('line count accuracy (matches GitHub)', () => {
    /**
     * Helper to count additions and deletions from diff result
     */
    function countDiffStats(lines: ParsedDiffLine[]) {
      let additions = 0;
      let deletions = 0;
      for (const line of lines) {
        if (line.type === 'addition') additions++;
        else if (line.type === 'deletion') deletions++;
      }
      return { additions, deletions, net: additions - deletions };
    }

    it('counts single line modification as 1 addition and 1 deletion', () => {
      const result = computeLineDiff('old line', 'new line', false);
      const stats = countDiffStats(result);
      expect(stats.additions).toBe(1);
      expect(stats.deletions).toBe(1);
      expect(stats.net).toBe(0);
    });

    it('produces correct net for additions with minimal overhead', () => {
      // Base: 2 lines, Head: 4 lines
      // diff-match-patch LCS may show some context reordering
      const result = computeLineDiff('line1\nline2', 'line1\nline2\nline3\nline4', false);
      const stats = countDiffStats(result);
      // Net must be correct: +2 (4 - 2 = 2)
      expect(stats.net).toBe(2);
      // Without semantic cleanup, additions should be ≤4 (worst case: all lines)
      // With semantic cleanup, this could inflate further
      expect(stats.additions).toBeLessThanOrEqual(4);
    });

    it('produces correct net for deletions with minimal overhead', () => {
      // Base: 3 lines, Head: 1 line
      const result = computeLineDiff('line1\nline2\nline3', 'line1', false);
      const stats = countDiffStats(result);
      // Net must be correct: -2 (1 - 3 = -2)
      expect(stats.net).toBe(-2);
      // Without semantic cleanup, deletions should be ≤3 (worst case: all lines)
      expect(stats.deletions).toBeLessThanOrEqual(3);
    });

    it('produces correct net change for mixed modifications', () => {
      // Base: 3 lines, Head: 4 lines
      const base = 'line1\nold-line2\nline3';
      const head = 'line1\nnew-line2\nline3\nline4';
      const result = computeLineDiff(base, head, false);
      const stats = countDiffStats(result);
      // Net change should be +1 (4 - 3 = 1)
      expect(stats.net).toBe(1);
    });

    it('produces consistent net line change for complex diff', () => {
      const base = 'a\nb\nc\nd\ne'; // 5 lines
      const head = 'a\nX\nY\nZ\nc\nd\ne\nf\ng'; // 9 lines
      const result = computeLineDiff(base, head, false);
      const stats = countDiffStats(result);

      // Net change should match actual line difference
      expect(stats.net).toBe(4); // 9 - 5 = 4
    });

    it('handles empty lines in diff correctly', () => {
      const base = 'line1\n\nline3'; // Line 2 is empty
      const head = 'line1\nfilled\nline3';
      const result = computeLineDiff(base, head, false);
      const stats = countDiffStats(result);
      // Same number of lines - net 0
      expect(stats.net).toBe(0);
    });

    it('does not inflate counts with semantic grouping', () => {
      // This test ensures we don't use diff_cleanupSemantic
      // which would inflate line counts by regrouping changes
      const base = 'function foo() {\n  return 1;\n}';
      const head = 'function foo() {\n  return 2;\n}';
      const result = computeLineDiff(base, head, false);
      const stats = countDiffStats(result);
      // EXACT: Only one line changed (return statement)
      // Semantic cleanup would inflate by including surrounding context
      expect(stats.additions).toBe(1);
      expect(stats.deletions).toBe(1);
      expect(stats.net).toBe(0);
    });

    it('appending lines produces correct net change', () => {
      // Simulates appending to end of file - common real-world case
      const base = 'line1\nline2\nline3';
      const head = 'line1\nline2\nline3\nline4\nline5';
      const result = computeLineDiff(base, head, false);
      const stats = countDiffStats(result);
      // Net must be +2 (5 - 3 = 2)
      expect(stats.net).toBe(2);
    });

    it('prepending lines produces correct net change', () => {
      // Simulates prepending to beginning of file
      const base = 'line1\nline2\nline3';
      const head = 'line0\nline1\nline2\nline3';
      const result = computeLineDiff(base, head, false);
      const stats = countDiffStats(result);
      // Net must be +1 (4 - 3 = 1)
      expect(stats.net).toBe(1);
    });

    it('does not inflate counts via semantic cleanup', () => {
      // This test catches the bug where diff_cleanupSemantic inflates counts
      // by regrouping interleaved changes. The net stays the same but raw
      // counts increase.
      //
      // Without semantic cleanup: 5 additions, 3 deletions
      // With semantic cleanup:    7 additions, 5 deletions (BUG!)
      const base = `header
line1
line2
line3
line4
line5
footer`;

      const head = `header
line1-modified
line2
line3-modified
line4
line5-modified
extra1
extra2
footer`;

      const result = computeLineDiff(base, head, false);
      const stats = countDiffStats(result);

      // Net must be +2 (9 lines - 7 lines)
      expect(stats.net).toBe(2);

      // EXACT counts - this is what catches the semantic cleanup bug:
      // - 3 modifications (line1, line3, line5) = 3 deletions + 3 additions
      // - 2 pure additions (extra1, extra2)
      // Total: 5 additions, 3 deletions
      expect(stats.additions).toBe(5);
      expect(stats.deletions).toBe(3);
    });

    it('handles large file diff with correct net change', () => {
      // Create files with specific known changes
      const baseLines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const headLines = [...baseLines];

      // Make exactly 5 modifications (net 0 per modification)
      headLines[10] = 'modified line 11';
      headLines[20] = 'modified line 21';
      headLines[30] = 'modified line 31';
      headLines[40] = 'modified line 41';
      headLines[50] = 'modified line 51';

      // Add 3 new lines at the end (net +3)
      headLines.push('new line 101');
      headLines.push('new line 102');
      headLines.push('new line 103');

      const result = computeLineDiff(baseLines.join('\n'), headLines.join('\n'), false);
      const stats = countDiffStats(result);

      // Net should be +3 (100 base + 3 new = 103 head - 100 base = +3)
      expect(stats.net).toBe(3);
    });

    it('matches GitHub counts for real-world example', () => {
      // Simulates the PR#55 case - comparing base vs head content.
      // In that PR, GitHub reported +149/-25 (net +124), but this test only
      // verifies that the net line count change (+124) matches.
      const base = Array.from({ length: 536 }, (_, i) => `base line ${i + 1}`).join('\n');
      const head = Array.from({ length: 660 }, (_, i) => `head line ${i + 1}`).join('\n');

      const result = computeLineDiff(base, head, false);
      const stats = countDiffStats(result);

      // Net change must match: 660 - 536 = 124
      expect(stats.net).toBe(124);
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
