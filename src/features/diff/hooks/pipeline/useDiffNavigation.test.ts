/**
 * Unit tests for useDiffNavigation pipeline hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDiffNavigation } from './useDiffNavigation';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../../stores';
import type { DiffDisplayOutput } from './types';

vi.mock('../../stores', () => ({
  useDiffStore: vi.fn(),
  PR_DESCRIPTION_INDEX: -1,
}));

vi.mock('../../utils', () => ({
  calculateHunkIndices: vi.fn((lines: { type: string }[]) => {
    // Return indices of non-context lines
    const indices: number[] = [];
    lines.forEach((line, idx) => {
      if (line.type !== 'context') indices.push(idx);
    });
    return indices;
  }),
  calculateAlignedHunkIndices: vi.fn((lines: { left?: { type: string }; right?: { type: string } }[]) => {
    // Return indices of aligned lines with changes
    const indices: number[] = [];
    lines.forEach((line, idx) => {
      if (line.left?.type !== 'context' || line.right?.type !== 'context') {
        indices.push(idx);
      }
    });
    return indices;
  }),
}));

describe('useDiffNavigation', () => {
  const mockDisplayInput: DiffDisplayOutput = {
    patch: 'test patch',
    filename: 'test.ts',
    fileStatus: undefined,
    iterationDiff: null,
    isIterationMode: false,
    diffLines: [
      { content: 'line1', type: 'context' as const, oldLineNumber: 1, newLineNumber: 1 },
      { content: '+line2', type: 'added' as const, oldLineNumber: null, newLineNumber: 2 },
      { content: 'line3', type: 'context' as const, oldLineNumber: 2, newLineNumber: 3 },
    ],
    alignedLines: [],
    language: 'typescript',
    viewMode: 'inline',
    hunkIndices: [],
    showWhitespace: false,
    contentFilter: 'both',
    lineNumberMode: 'both',
    textWrap: 'off',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates hunk indices for inline mode', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: 0,
      currentChangeIndex: 0,
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffNavigation(mockDisplayInput));

    // Should find index 1 (the added line)
    expect(result.current.hunkIndices).toEqual([1]);
  });

  it('calculates hunk indices for split mode using aligned lines', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: 0,
      currentChangeIndex: 0,
    } as ReturnType<typeof useDiffStore>);

    const splitInput: DiffDisplayOutput = {
      ...mockDisplayInput,
      viewMode: 'split',
      alignedLines: [
        { left: { content: 'old', type: 'deletion' as const }, right: { content: 'new', type: 'addition' as const } },
        { left: { content: 'ctx', type: 'context' as const }, right: { content: 'ctx', type: 'context' as const } },
      ],
    };

    const { result } = renderHook(() => useDiffNavigation(splitInput));

    // Should find index 0 (the changed pair)
    expect(result.current.hunkIndices).toEqual([0]);
  });

  it('returns empty hunk indices for PR description view', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: PR_DESCRIPTION_INDEX,
      currentChangeIndex: 0,
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffNavigation(mockDisplayInput));

    expect(result.current.hunkIndices).toEqual([]);
  });

  it('returns empty hunk indices for fully changed files', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: 0,
      currentChangeIndex: 0,
    } as ReturnType<typeof useDiffStore>);

    const fullChangeInput: DiffDisplayOutput = {
      ...mockDisplayInput,
      isFullFileChange: true,
    };

    const { result } = renderHook(() => useDiffNavigation(fullChangeInput));

    expect(result.current.hunkIndices).toEqual([]);
  });

  it('returns scrollToRowIndex based on currentChangeIndex', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: 0,
      currentChangeIndex: 0,
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffNavigation(mockDisplayInput));

    // With hunkIndices [1] and currentChangeIndex 0, scrollToRowIndex should be 1
    expect(result.current.scrollToRowIndex).toBe(1);
  });

  it('returns undefined scrollToRowIndex when currentChangeIndex is negative', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: 0,
      currentChangeIndex: -1,
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffNavigation(mockDisplayInput));

    expect(result.current.scrollToRowIndex).toBeUndefined();
  });

  it('returns undefined scrollToRowIndex when currentChangeIndex exceeds hunk count', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: 0,
      currentChangeIndex: 10, // Exceeds available hunks
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffNavigation(mockDisplayInput));

    expect(result.current.scrollToRowIndex).toBeUndefined();
  });

  it('preserves display input properties', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: 0,
      currentChangeIndex: 0,
    } as ReturnType<typeof useDiffStore>);

    const customInput: DiffDisplayOutput = {
      ...mockDisplayInput,
      filename: 'custom.tsx',
      language: 'typescriptreact',
      showWhitespace: true,
    };

    const { result } = renderHook(() => useDiffNavigation(customInput));

    expect(result.current.filename).toBe('custom.tsx');
    expect(result.current.language).toBe('typescriptreact');
    expect(result.current.showWhitespace).toBe(true);
  });
});
