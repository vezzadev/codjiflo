/**
 * Unit tests for useDiffDisplay pipeline hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDiffDisplay } from './useDiffDisplay';
import { useDiffStore } from '../../stores';
import type { DiffShapeOutput } from './types';

vi.mock('../../stores', () => ({
  useDiffStore: vi.fn(),
}));

describe('useDiffDisplay', () => {
  const mockShapedInput: DiffShapeOutput = {
    patch: 'test patch',
    filename: 'test.ts',
    fileStatus: undefined,
    iterationDiff: null,
    isIterationMode: false,
    diffLines: [],
    alignedLines: [],
    language: 'typescript',
    viewMode: 'inline',
    hunkIndices: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns display options with showWhitespace from store', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: {
        showWhitespace: true,
        filter: 'both',
        textWrap: 'off',
      },
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffDisplay(mockShapedInput));

    expect(result.current.showWhitespace).toBe(true);
    expect(result.current.contentFilter).toBe('both');
    expect(result.current.lineNumberMode).toBe('both');
    expect(result.current.textWrap).toBe('off');
  });

  it('returns left line number mode when filter is left', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: {
        showWhitespace: false,
        filter: 'left',
        textWrap: 'on',
      },
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffDisplay(mockShapedInput));

    expect(result.current.lineNumberMode).toBe('left');
    expect(result.current.contentFilter).toBe('left');
  });

  it('returns right line number mode when filter is right', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: {
        showWhitespace: false,
        filter: 'right',
        textWrap: 'on',
      },
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffDisplay(mockShapedInput));

    expect(result.current.lineNumberMode).toBe('right');
    expect(result.current.contentFilter).toBe('right');
  });

  it('preserves shaped input properties', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: {
        showWhitespace: false,
        filter: 'both',
        textWrap: 'on',
      },
    } as ReturnType<typeof useDiffStore>);

    const customInput: DiffShapeOutput = {
      ...mockShapedInput,
      filename: 'custom.ts',
      language: 'javascript',
      diffLines: [{ content: 'line1', type: 'context', oldLineNumber: 1, newLineNumber: 1 }],
    };

    const { result } = renderHook(() => useDiffDisplay(customInput));

    expect(result.current.filename).toBe('custom.ts');
    expect(result.current.language).toBe('javascript');
    expect(result.current.diffLines).toHaveLength(1);
  });
});
