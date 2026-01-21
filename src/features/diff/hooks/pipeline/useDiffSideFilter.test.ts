/**
 * Unit tests for useDiffSideFilter pipeline hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDiffSideFilter } from './useDiffSideFilter';
import type { DiffDisplayOutput } from './types';
import type { ParsedDiffLine, AlignedDiffLine } from '../../types';

describe('useDiffSideFilter', () => {
  const contextLine: ParsedDiffLine = { content: 'context', type: 'context', oldLineNumber: 1, newLineNumber: 1 };
  const additionLine: ParsedDiffLine = { content: '+added', type: 'addition', oldLineNumber: null, newLineNumber: 2 };
  const deletionLine: ParsedDiffLine = { content: '-deleted', type: 'deletion', oldLineNumber: 2, newLineNumber: null };
  const headerLine: ParsedDiffLine = { content: '@@', type: 'header', oldLineNumber: null, newLineNumber: null };

  const mockDisplayInput: DiffDisplayOutput = {
    patch: 'test patch',
    filename: 'test.ts',
    fileStatus: undefined,
    iterationDiff: null,
    isIterationMode: false,
    diffLines: [contextLine, additionLine, deletionLine, headerLine],
    alignedLines: [],
    language: 'typescript',
    viewMode: 'inline',
    hunkIndices: [],
    showWhitespace: false,
    contentFilter: 'both',
    lineNumberMode: 'both',
    textWrap: 'off',
  };

  describe('diffLines filtering', () => {
    it('passes all lines through when filter is "both"', () => {
      const input: DiffDisplayOutput = { ...mockDisplayInput, contentFilter: 'both' };

      const { result } = renderHook(() => useDiffSideFilter(input));

      expect(result.current.diffLines).toHaveLength(4);
    });

    it('keeps only deletions, context, and headers when filter is "left"', () => {
      const input: DiffDisplayOutput = { ...mockDisplayInput, contentFilter: 'left' };

      const { result } = renderHook(() => useDiffSideFilter(input));

      expect(result.current.diffLines).toHaveLength(3);
      expect(result.current.diffLines.map(l => l.type)).toEqual(['context', 'deletion', 'header']);
    });

    it('keeps only additions, context, and headers when filter is "right"', () => {
      const input: DiffDisplayOutput = { ...mockDisplayInput, contentFilter: 'right' };

      const { result } = renderHook(() => useDiffSideFilter(input));

      expect(result.current.diffLines).toHaveLength(3);
      expect(result.current.diffLines.map(l => l.type)).toEqual(['context', 'addition', 'header']);
    });
  });

  describe('alignedLines filtering', () => {
    const alignedContext: AlignedDiffLine = {
      left: { content: 'ctx', type: 'context', oldLineNumber: 1, newLineNumber: 1 },
      right: { content: 'ctx', type: 'context', oldLineNumber: 1, newLineNumber: 1 },
    };
    const alignedChange: AlignedDiffLine = {
      left: { content: 'old', type: 'deletion', oldLineNumber: 2, newLineNumber: null },
      right: { content: 'new', type: 'addition', oldLineNumber: null, newLineNumber: 2 },
    };
    const pureAddition: AlignedDiffLine = {
      left: null,
      right: { content: '+added', type: 'addition', oldLineNumber: null, newLineNumber: 3 },
    };
    const pureDeletion: AlignedDiffLine = {
      left: { content: '-deleted', type: 'deletion', oldLineNumber: 3, newLineNumber: null },
      right: null,
    };

    const alignedInput: DiffDisplayOutput = {
      ...mockDisplayInput,
      alignedLines: [alignedContext, alignedChange, pureAddition, pureDeletion],
      viewMode: 'split',
    };

    it('passes all aligned lines through when filter is "both"', () => {
      const input: DiffDisplayOutput = { ...alignedInput, contentFilter: 'both' };

      const { result } = renderHook(() => useDiffSideFilter(input));

      expect(result.current.alignedLines).toHaveLength(4);
    });

    it('filters out pure additions when filter is "left"', () => {
      const input: DiffDisplayOutput = { ...alignedInput, contentFilter: 'left' };

      const { result } = renderHook(() => useDiffSideFilter(input));

      // Should keep: context, change (has left), pure deletion (has left)
      // Should filter: pure addition (left is null and right is pure addition)
      expect(result.current.alignedLines).toHaveLength(3);
    });

    it('filters out pure deletions when filter is "right"', () => {
      const input: DiffDisplayOutput = { ...alignedInput, contentFilter: 'right' };

      const { result } = renderHook(() => useDiffSideFilter(input));

      // Should keep: context, change (has right), pure addition (has right)
      // Should filter: pure deletion (right is null and left is pure deletion)
      expect(result.current.alignedLines).toHaveLength(3);
    });
  });

  it('preserves display input properties', () => {
    const customInput: DiffDisplayOutput = {
      ...mockDisplayInput,
      filename: 'custom.tsx',
      language: 'typescriptreact',
      showWhitespace: true,
    };

    const { result } = renderHook(() => useDiffSideFilter(customInput));

    expect(result.current.filename).toBe('custom.tsx');
    expect(result.current.language).toBe('typescriptreact');
    expect(result.current.showWhitespace).toBe(true);
  });
});
