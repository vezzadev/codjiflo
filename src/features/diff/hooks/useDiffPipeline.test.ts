/**
 * Unit tests for useDiffPipeline composite hook
 *
 * This hook chains all diff pipeline stages together:
 * Source → Filter → Shape → Display → SideFilter → Navigation → Comments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDiffPipeline } from './useDiffPipeline';
import {
  useDiffSource,
  useDiffFilter,
  useDiffShape,
  useDiffDisplay,
  useDiffSideFilter,
  useDiffNavigation,
  useDiffComments,
  type DiffSourceOutput,
  type DiffFilterOutput,
  type DiffShapeOutput,
  type DiffDisplayOutput,
  type DiffSideFilterOutput,
  type DiffNavigationOutput,
  type DiffCommentsOutput,
} from './pipeline';
import { FileChangeStatus } from '@/api/types';

// Mock all pipeline stages
vi.mock('./pipeline', () => ({
  useDiffSource: vi.fn(),
  useDiffFilter: vi.fn(),
  useDiffShape: vi.fn(),
  useDiffDisplay: vi.fn(),
  useDiffSideFilter: vi.fn(),
  useDiffNavigation: vi.fn(),
  useDiffComments: vi.fn(),
}));

describe('useDiffPipeline', () => {
  // Mock outputs for each stage
  const mockSourceOutput: DiffSourceOutput = {
    patch: '@@ -1,1 +1,2 @@\n line1\n+line2',
    filename: 'test.ts',
    previousFilename: undefined,
    fileStatus: FileChangeStatus.Modified,
    iterationDiff: null,
    isIterationMode: false,
  };

  const mockFilterOutput: DiffFilterOutput = {
    diffLines: [
      { content: 'line1', type: 'context', oldLineNumber: 1, newLineNumber: 1 },
      { content: 'line2', type: 'addition', oldLineNumber: null, newLineNumber: 2 },
    ],
    sourceAlignedLines: null,
    language: 'typescript',
    isFullFileChange: false,
    filename: 'test.ts',
    isIterationMode: false,
  };

  const mockShapeOutput: DiffShapeOutput = {
    ...mockFilterOutput,
    alignedLines: [],
    viewMode: 'inline',
  };

  const mockDisplayOutput: DiffDisplayOutput = {
    ...mockShapeOutput,
    showWhitespace: false,
    contentFilter: 'both',
    lineNumberMode: 'both',
    textWrap: 'nowrap',
  };

  const mockSideFilterOutput: DiffSideFilterOutput = mockDisplayOutput;

  const mockNavigationOutput: DiffNavigationOutput = {
    ...mockSideFilterOutput,
    hunkIndices: [0],
    scrollToRowIndex: undefined,
  };

  const mockCommentsOutput: DiffCommentsOutput = {
    ...mockNavigationOutput,
    threadsByLineAndSide: new Map(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock return values for pipeline chain
    vi.mocked(useDiffSource).mockReturnValue(mockSourceOutput);
    vi.mocked(useDiffFilter).mockReturnValue(mockFilterOutput);
    vi.mocked(useDiffShape).mockReturnValue(mockShapeOutput);
    vi.mocked(useDiffDisplay).mockReturnValue(mockDisplayOutput);
    vi.mocked(useDiffSideFilter).mockReturnValue(mockSideFilterOutput);
    vi.mocked(useDiffNavigation).mockReturnValue(mockNavigationOutput);
    vi.mocked(useDiffComments).mockReturnValue(mockCommentsOutput);
  });

  it('chains all pipeline stages in correct order', () => {
    renderHook(() => useDiffPipeline());

    // Verify call order: each stage receives output from previous stage
    expect(useDiffSource).toHaveBeenCalled();
    expect(useDiffFilter).toHaveBeenCalledWith(mockSourceOutput);
    expect(useDiffShape).toHaveBeenCalledWith(mockFilterOutput);
    expect(useDiffDisplay).toHaveBeenCalledWith(mockShapeOutput);
    expect(useDiffSideFilter).toHaveBeenCalledWith(mockDisplayOutput);
    expect(useDiffNavigation).toHaveBeenCalledWith(mockSideFilterOutput);
    expect(useDiffComments).toHaveBeenCalledWith(mockNavigationOutput);
  });

  it('returns final comments stage output', () => {
    const { result } = renderHook(() => useDiffPipeline());

    expect(result.current).toBe(mockCommentsOutput);
    expect(result.current.diffLines).toEqual(mockCommentsOutput.diffLines);
    expect(result.current.threadsByLineAndSide).toBe(mockCommentsOutput.threadsByLineAndSide);
  });

  it('provides access to all inherited pipeline properties', () => {
    const { result } = renderHook(() => useDiffPipeline());

    // From source stage
    expect(result.current.isIterationMode).toBe(false);

    // From filter stage
    expect(result.current.language).toBe('typescript');
    expect(result.current.isFullFileChange).toBe(false);

    // From shape stage
    expect(result.current.viewMode).toBe('inline');
    expect(result.current.alignedLines).toEqual([]);

    // From display stage
    expect(result.current.showWhitespace).toBe(false);
    expect(result.current.contentFilter).toBe('both');
    expect(result.current.textWrap).toBe('nowrap');

    // From navigation stage
    expect(result.current.hunkIndices).toEqual([0]);
    expect(result.current.scrollToRowIndex).toBeUndefined();
  });

  it('passes iteration mode data through pipeline', () => {
    const iterationSourceOutput: DiffSourceOutput = {
      ...mockSourceOutput,
      isIterationMode: true,
      iterationDiff: {
        base: null,
        head: null,
        diffLines: [{ content: 'iteration line', type: 'addition', oldLineNumber: null, newLineNumber: 1 }],
        alignedLines: [],
      },
    };

    const iterationFilterOutput: DiffFilterOutput = {
      ...mockFilterOutput,
      isIterationMode: true,
      diffLines: [{ content: 'iteration line', type: 'addition', oldLineNumber: null, newLineNumber: 1 }],
    };

    vi.mocked(useDiffSource).mockReturnValue(iterationSourceOutput);
    vi.mocked(useDiffFilter).mockReturnValue(iterationFilterOutput);

    renderHook(() => useDiffPipeline());

    expect(useDiffFilter).toHaveBeenCalledWith(iterationSourceOutput);
  });

  it('passes loading state through pipeline', () => {
    const loadingFilterOutput: DiffFilterOutput = {
      ...mockFilterOutput,
      _isLoadingFullFile: true,
    };

    const loadingShapeOutput: DiffShapeOutput = {
      ...mockShapeOutput,
      _isLoadingFullFile: true,
    };

    const loadingDisplayOutput: DiffDisplayOutput = {
      ...mockDisplayOutput,
      _isLoadingFullFile: true,
    };

    const loadingNavigationOutput: DiffNavigationOutput = {
      ...mockNavigationOutput,
      _isLoadingFullFile: true,
    };

    const loadingCommentsOutput: DiffCommentsOutput = {
      ...mockCommentsOutput,
      _isLoadingFullFile: true,
    };

    vi.mocked(useDiffFilter).mockReturnValue(loadingFilterOutput);
    vi.mocked(useDiffShape).mockReturnValue(loadingShapeOutput);
    vi.mocked(useDiffDisplay).mockReturnValue(loadingDisplayOutput);
    vi.mocked(useDiffSideFilter).mockReturnValue(loadingDisplayOutput);
    vi.mocked(useDiffNavigation).mockReturnValue(loadingNavigationOutput);
    vi.mocked(useDiffComments).mockReturnValue(loadingCommentsOutput);

    const { result } = renderHook(() => useDiffPipeline());

    expect(result.current._isLoadingFullFile).toBe(true);
  });

  it('passes split view mode through pipeline', () => {
    const splitShapeOutput: DiffShapeOutput = {
      ...mockFilterOutput,
      alignedLines: [
        {
          left: { content: 'old', type: 'deletion', oldLineNumber: 1, newLineNumber: null, wordDiff: [] },
          right: { content: 'new', type: 'addition', oldLineNumber: null, newLineNumber: 1, wordDiff: [] },
          key: 'line-1',
        },
      ],
      viewMode: 'split',
    };

    const splitDisplayOutput: DiffDisplayOutput = {
      ...splitShapeOutput,
      showWhitespace: false,
      contentFilter: 'both',
      lineNumberMode: 'both',
      textWrap: 'nowrap',
    };

    const splitNavigationOutput: DiffNavigationOutput = {
      ...splitDisplayOutput,
      hunkIndices: [0],
      scrollToRowIndex: undefined,
    };

    const splitCommentsOutput: DiffCommentsOutput = {
      ...splitNavigationOutput,
      threadsByLineAndSide: new Map(),
    };

    vi.mocked(useDiffShape).mockReturnValue(splitShapeOutput);
    vi.mocked(useDiffDisplay).mockReturnValue(splitDisplayOutput);
    vi.mocked(useDiffSideFilter).mockReturnValue(splitDisplayOutput);
    vi.mocked(useDiffNavigation).mockReturnValue(splitNavigationOutput);
    vi.mocked(useDiffComments).mockReturnValue(splitCommentsOutput);

    const { result } = renderHook(() => useDiffPipeline());

    expect(result.current.viewMode).toBe('split');
    expect(result.current.alignedLines).toHaveLength(1);
  });

  it('passes comment threads through pipeline', () => {
    const threadsMap = new Map([
      ['1-right', [{ id: 1, originalLine: 1, path: 'test.ts', comments: [] }]],
    ]);

    const commentsWithThreads: DiffCommentsOutput = {
      ...mockNavigationOutput,
      threadsByLineAndSide: threadsMap as unknown as Map<string, never[]>,
    };

    vi.mocked(useDiffComments).mockReturnValue(commentsWithThreads);

    const { result } = renderHook(() => useDiffPipeline());

    expect(result.current.threadsByLineAndSide.size).toBe(1);
    expect(result.current.threadsByLineAndSide.has('1-right')).toBe(true);
  });
});
