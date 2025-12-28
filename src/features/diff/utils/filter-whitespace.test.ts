/**
 * Tests for filter-whitespace utility (S-3.5)
 */

import { describe, it, expect } from 'vitest';
import { filterWhitespaceChanges, filterAlignedWhitespace } from './filter-whitespace';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

describe('filterWhitespaceChanges', () => {
  // Re-exported from diff-engine, main tests are in diff-engine.test.ts
  // Just verify the re-export works
  it('is re-exported from diff-engine', () => {
    expect(typeof filterWhitespaceChanges).toBe('function');
  });

  it('filters whitespace-only changes', () => {
    const lines: ParsedDiffLine[] = [
      { type: 'deletion', content: '  hello  ', oldLineNumber: 1, newLineNumber: null },
      { type: 'addition', content: 'hello', oldLineNumber: null, newLineNumber: 1 },
    ];
    const result = filterWhitespaceChanges(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('context');
  });
});

describe('filterAlignedWhitespace', () => {
  it('keeps header lines', () => {
    const header: ParsedDiffLine = {
      type: 'header',
      content: '@@ -1,1 +1,1 @@',
      oldLineNumber: null,
      newLineNumber: null,
    };
    const lines: AlignedDiffLine[] = [
      { left: header, right: header, key: 'header-0' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left?.type).toBe('header');
  });

  it('keeps context lines', () => {
    const context: ParsedDiffLine = {
      type: 'context',
      content: 'unchanged',
      oldLineNumber: 1,
      newLineNumber: 1,
    };
    const lines: AlignedDiffLine[] = [
      { left: context, right: context, key: 'ctx-1-1' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left?.type).toBe('context');
  });

  it('converts whitespace-only modifications to context', () => {
    const deletion: ParsedDiffLine = {
      type: 'deletion',
      content: '  hello  ',
      oldLineNumber: 1,
      newLineNumber: null,
    };
    const addition: ParsedDiffLine = {
      type: 'addition',
      content: 'hello',
      oldLineNumber: null,
      newLineNumber: 1,
    };
    const lines: AlignedDiffLine[] = [
      { left: deletion, right: addition, key: 'mod-1-1' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left?.type).toBe('context');
    expect(result[0]?.right?.type).toBe('context');
    expect(result[0]?.left?.content).toBe('hello');
  });

  it('removes empty whitespace-only deletions', () => {
    const deletion: ParsedDiffLine = {
      type: 'deletion',
      content: '   ',
      oldLineNumber: 1,
      newLineNumber: null,
    };
    const lines: AlignedDiffLine[] = [
      { left: deletion, right: null, key: 'del-1' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result).toHaveLength(0);
  });

  it('removes empty whitespace-only additions', () => {
    const addition: ParsedDiffLine = {
      type: 'addition',
      content: '   ',
      oldLineNumber: null,
      newLineNumber: 1,
    };
    const lines: AlignedDiffLine[] = [
      { left: null, right: addition, key: 'add-1' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result).toHaveLength(0);
  });

  it('keeps real content changes', () => {
    const deletion: ParsedDiffLine = {
      type: 'deletion',
      content: 'old value',
      oldLineNumber: 1,
      newLineNumber: null,
    };
    const addition: ParsedDiffLine = {
      type: 'addition',
      content: 'new value',
      oldLineNumber: null,
      newLineNumber: 1,
    };
    const lines: AlignedDiffLine[] = [
      { left: deletion, right: addition, key: 'mod-1-1' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left?.type).toBe('deletion');
    expect(result[0]?.right?.type).toBe('addition');
  });

  it('keeps pure additions with non-whitespace content', () => {
    const addition: ParsedDiffLine = {
      type: 'addition',
      content: 'new line',
      oldLineNumber: null,
      newLineNumber: 1,
    };
    const lines: AlignedDiffLine[] = [
      { left: null, right: addition, key: 'add-1' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.right?.type).toBe('addition');
  });

  it('keeps pure deletions with non-whitespace content', () => {
    const deletion: ParsedDiffLine = {
      type: 'deletion',
      content: 'removed line',
      oldLineNumber: 1,
      newLineNumber: null,
    };
    const lines: AlignedDiffLine[] = [
      { left: deletion, right: null, key: 'del-1' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result).toHaveLength(1);
    expect(result[0]?.left?.type).toBe('deletion');
  });

  it('creates unique keys for converted context lines', () => {
    const deletion: ParsedDiffLine = {
      type: 'deletion',
      content: '  hello  ',
      oldLineNumber: 1,
      newLineNumber: null,
    };
    const addition: ParsedDiffLine = {
      type: 'addition',
      content: 'hello',
      oldLineNumber: null,
      newLineNumber: 1,
    };
    const lines: AlignedDiffLine[] = [
      { left: deletion, right: addition, key: 'mod-1-1' },
    ];
    const result = filterAlignedWhitespace(lines);
    expect(result[0]?.key).toContain('ctx-ws');
  });
});
