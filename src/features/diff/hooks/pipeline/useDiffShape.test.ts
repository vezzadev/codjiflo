/**
 * Unit tests for useDiffShape pipeline hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDiffShape } from './useDiffShape';
import { useDiffStore } from '../../stores';
import type { DiffFilterOutput } from './types';

vi.mock('../../stores', () => ({
  useDiffStore: vi.fn(),
}));

vi.mock('../../utils', () => ({
  alignDiffLines: vi.fn((lines) => lines.map((line: { content: string }) => ({ left: line, right: null }))),
}));

describe('useDiffShape', () => {
  const mockFilteredInput: DiffFilterOutput = {
    patch: 'test patch',
    filename: 'test.ts',
    fileStatus: undefined,
    iterationDiff: null,
    isIterationMode: false,
    diffLines: [
      { content: 'line1', type: 'context' as const, oldLineNumber: 1, newLineNumber: 1 },
      { content: '+line2', type: 'added' as const, oldLineNumber: null, newLineNumber: 2 },
    ],
    language: 'typescript',
    hunkIndices: [0],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty alignedLines for inline mode', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: { mode: 'inline' },
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffShape(mockFilteredInput));

    expect(result.current.viewMode).toBe('inline');
    expect(result.current.alignedLines).toEqual([]);
    expect(result.current.diffLines).toEqual(mockFilteredInput.diffLines);
  });

  it('computes alignedLines for split mode', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: { mode: 'split' },
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffShape(mockFilteredInput));

    expect(result.current.viewMode).toBe('split');
    expect(result.current.alignedLines).toHaveLength(2);
  });

  it('uses pre-computed aligned lines when available in split mode', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: { mode: 'split' },
    } as ReturnType<typeof useDiffStore>);

    const preComputedAligned = [
      { left: { content: 'old' }, right: { content: 'new' } },
    ];

    const inputWithAligned: DiffFilterOutput = {
      ...mockFilteredInput,
      sourceAlignedLines: preComputedAligned,
    };

    const { result } = renderHook(() => useDiffShape(inputWithAligned));

    expect(result.current.alignedLines).toBe(preComputedAligned);
  });

  it('preserves filtered input properties', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: { mode: 'inline' },
    } as ReturnType<typeof useDiffStore>);

    const customInput: DiffFilterOutput = {
      ...mockFilteredInput,
      filename: 'custom.tsx',
      language: 'typescriptreact',
      isIterationMode: true,
    };

    const { result } = renderHook(() => useDiffShape(customInput));

    expect(result.current.filename).toBe('custom.tsx');
    expect(result.current.language).toBe('typescriptreact');
    expect(result.current.isIterationMode).toBe(true);
  });
});
