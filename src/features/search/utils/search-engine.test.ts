/**
 * Tests for search-engine utility
 */

import { describe, it, expect } from 'vitest';
import {
  createSearchRegex,
  executeSearch,
  searchInDiffLines,
  matchesFileFilter,
} from './search-engine';
import type { SearchOptions, SideFilter } from '../types';

const DEFAULT_OPTIONS: SearchOptions = {
  matchCase: false,
  matchWholeWord: false,
  useRegex: false,
  highlightAll: true,
};

describe('createSearchRegex', () => {
  it('returns null for empty query', () => {
    expect(createSearchRegex('', DEFAULT_OPTIONS)).toBeNull();
  });

  it('creates case-insensitive regex by default', () => {
    const regex = createSearchRegex('test', DEFAULT_OPTIONS);
    expect(regex).not.toBeNull();
    expect(regex?.flags).toContain('i');
  });

  it('creates case-sensitive regex when matchCase is true', () => {
    const regex = createSearchRegex('test', { ...DEFAULT_OPTIONS, matchCase: true });
    expect(regex).not.toBeNull();
    expect(regex?.flags).not.toContain('i');
  });

  it('escapes special characters for literal search', () => {
    const regex = createSearchRegex('foo.bar', DEFAULT_OPTIONS);
    expect(regex).not.toBeNull();
    expect(regex?.test('fooXbar')).toBe(false);
    expect(regex?.test('foo.bar')).toBe(true);
  });

  it('preserves regex patterns when useRegex is true', () => {
    const regex = createSearchRegex('foo.bar', { ...DEFAULT_OPTIONS, useRegex: true });
    expect(regex).not.toBeNull();
    // Test on separate strings to avoid lastIndex state issues with global flag
    expect(regex?.test('contains fooXbar here')).toBe(true);
    // Create fresh regex for second test
    const regex2 = createSearchRegex('foo.bar', { ...DEFAULT_OPTIONS, useRegex: true });
    expect(regex2?.test('foo.bar')).toBe(true);
  });

  it('adds word boundaries when matchWholeWord is true', () => {
    const regex = createSearchRegex('test', { ...DEFAULT_OPTIONS, matchWholeWord: true });
    expect(regex).not.toBeNull();
    expect(regex?.test('test')).toBe(true);
    expect(regex?.test('testing')).toBe(false);
    expect(regex?.test('a test here')).toBe(true);
  });

  it('returns null for invalid regex pattern', () => {
    const regex = createSearchRegex('[invalid', { ...DEFAULT_OPTIONS, useRegex: true });
    expect(regex).toBeNull();
  });
});

describe('executeSearch', () => {
  it('returns empty array for empty query', () => {
    const results = executeSearch('', 'some content', DEFAULT_OPTIONS);
    expect(results).toEqual([]);
  });

  it('finds single match on a line', () => {
    const results = executeSearch('hello', 'hello world', DEFAULT_OPTIONS);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      lineIndex: 0,
      columnStart: 0,
      columnEnd: 5,
      lineContent: 'hello world',
    });
  });

  it('finds multiple matches on same line', () => {
    const results = executeSearch('a', 'abracadabra', DEFAULT_OPTIONS);
    expect(results).toHaveLength(5);
    expect(results[0]?.columnStart).toBe(0);
    expect(results[1]?.columnStart).toBe(3);
    expect(results[2]?.columnStart).toBe(5);
    expect(results[3]?.columnStart).toBe(7);
    expect(results[4]?.columnStart).toBe(10);
  });

  it('finds matches across multiple lines', () => {
    const content = 'line one\nline two\nline three';
    const results = executeSearch('line', content, DEFAULT_OPTIONS);
    expect(results).toHaveLength(3);
    expect(results[0]?.lineIndex).toBe(0);
    expect(results[1]?.lineIndex).toBe(1);
    expect(results[2]?.lineIndex).toBe(2);
  });

  it('respects case sensitivity', () => {
    const content = 'Hello hello HELLO';
    const caseInsensitive = executeSearch('hello', content, DEFAULT_OPTIONS);
    expect(caseInsensitive).toHaveLength(3);

    const caseSensitive = executeSearch('hello', content, { ...DEFAULT_OPTIONS, matchCase: true });
    expect(caseSensitive).toHaveLength(1);
    expect(caseSensitive[0]?.columnStart).toBe(6);
  });

  it('respects whole word matching', () => {
    const content = 'test testing tested';
    const anyMatch = executeSearch('test', content, DEFAULT_OPTIONS);
    expect(anyMatch).toHaveLength(3);

    const wholeWord = executeSearch('test', content, { ...DEFAULT_OPTIONS, matchWholeWord: true });
    expect(wholeWord).toHaveLength(1);
    expect(wholeWord[0]?.columnStart).toBe(0);
  });

  it('handles regex patterns', () => {
    const content = 'foo1 foo2 bar3';
    const results = executeSearch('foo\\d', content, { ...DEFAULT_OPTIONS, useRegex: true });
    expect(results).toHaveLength(2);
    expect(results[0]?.columnStart).toBe(0);
    expect(results[0]?.columnEnd).toBe(4);
    expect(results[1]?.columnStart).toBe(5);
    expect(results[1]?.columnEnd).toBe(9);
  });

  it('handles empty lines', () => {
    const content = 'line one\n\nline three';
    const results = executeSearch('line', content, DEFAULT_OPTIONS);
    expect(results).toHaveLength(2);
    expect(results[0]?.lineIndex).toBe(0);
    expect(results[1]?.lineIndex).toBe(2);
  });
});

describe('searchInDiffLines', () => {
  const createDiffLines = () => [
    { content: 'unchanged line', type: 'context' },
    { content: 'deleted line', type: 'delete' },
    { content: 'added line', type: 'add' },
    { content: '@@ hunk header @@', type: 'hunk' },
    { content: 'another unchanged', type: 'context' },
  ];

  it('returns empty array for empty query', () => {
    const results = searchInDiffLines('', createDiffLines(), DEFAULT_OPTIONS, 'both');
    expect(results).toEqual([]);
  });

  it('finds matches in all line types with both filter', () => {
    const diffLines = createDiffLines();
    const results = searchInDiffLines('line', diffLines, DEFAULT_OPTIONS, 'both');
    // Should match: 'unchanged line', 'deleted line', 'added line'
    expect(results).toHaveLength(3);
  });

  it('skips hunk headers', () => {
    const diffLines = createDiffLines();
    const results = searchInDiffLines('hunk', diffLines, DEFAULT_OPTIONS, 'both');
    expect(results).toHaveLength(0);
  });

  it('filters to left side only (deletions + context)', () => {
    const diffLines = createDiffLines();
    const results = searchInDiffLines('line', diffLines, DEFAULT_OPTIONS, 'left' as SideFilter);
    // Should match: 'unchanged line', 'deleted line' (not 'added line')
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.side !== 'right')).toBe(true);
  });

  it('filters to right side only (additions + context)', () => {
    const diffLines = createDiffLines();
    const results = searchInDiffLines('line', diffLines, DEFAULT_OPTIONS, 'right' as SideFilter);
    // Should match: 'unchanged line', 'added line' (not 'deleted line')
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.side !== 'left')).toBe(true);
  });

  it('correctly assigns side based on line type', () => {
    const diffLines = [
      { content: 'foo', type: 'context' },
      { content: 'foo', type: 'delete' },
      { content: 'foo', type: 'add' },
    ];
    const results = searchInDiffLines('foo', diffLines, DEFAULT_OPTIONS, 'both');
    expect(results[0]?.side).toBe('both');
    expect(results[1]?.side).toBe('left');
    expect(results[2]?.side).toBe('right');
  });

  it('includes lineContent in results', () => {
    const diffLines = [{ content: 'test content here', type: 'context' }];
    const results = searchInDiffLines('content', diffLines, DEFAULT_OPTIONS, 'both');
    expect(results[0]?.lineContent).toBe('test content here');
  });
});

describe('matchesFileFilter', () => {
  it('returns true for empty filter', () => {
    expect(matchesFileFilter('any/path.ts', '', false)).toBe(true);
  });

  it('matches substring (case-insensitive)', () => {
    expect(matchesFileFilter('src/utils/format.ts', 'format', false)).toBe(true);
    expect(matchesFileFilter('src/utils/format.ts', 'FORMAT', false)).toBe(true);
    expect(matchesFileFilter('src/utils/format.ts', 'missing', false)).toBe(false);
  });

  it('matches using regex when enabled', () => {
    expect(matchesFileFilter('src/utils/format.ts', '\\.ts$', true)).toBe(true);
    expect(matchesFileFilter('src/utils/format.tsx', '\\.ts$', true)).toBe(false);
    expect(matchesFileFilter('src/components/Button.tsx', 'components.*Button', true)).toBe(true);
  });

  it('returns false for invalid regex', () => {
    expect(matchesFileFilter('any/path.ts', '[invalid', true)).toBe(false);
  });
});
