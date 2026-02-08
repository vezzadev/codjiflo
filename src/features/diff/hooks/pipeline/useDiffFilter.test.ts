/**
 * Unit tests for useDiffFilter pipeline hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDiffFilter } from './useDiffFilter';
import { useDiffStore, useDiffContentStore } from '../../stores';
import { usePRStore } from '@/features/pr';
import type { DiffSourceOutput } from './types';
import { FileChangeStatus } from '@/api/types';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ owner: 'testowner', repo: 'testrepo' })),
}));

vi.mock('../../stores', () => ({
  useDiffStore: vi.fn(),
  useDiffContentStore: vi.fn(),
}));

vi.mock('@/features/pr', () => ({
  usePRStore: vi.fn(),
}));

vi.mock('../../utils', () => ({
  parsePatch: vi.fn((patch: string) => [
    { content: patch, type: 'context', oldLineNumber: 1, newLineNumber: 1 },
  ]),
  detectLanguage: vi.fn((filename: string) => {
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.js')) return 'javascript';
    return 'plaintext';
  }),
  filterToChangesOnly: vi.fn((lines: { type: string }[]) => lines.filter((l) => l.type !== 'context')),
  filterAlignedToChangesOnly: vi.fn((lines: unknown[]) => lines),
}));

describe('useDiffFilter', () => {
  const mockSourceInput: DiffSourceOutput = {
    patch: '@@ -1,1 +1,2 @@\n line1\n+line2',
    filename: 'test.ts',
    previousFilename: undefined,
    fileStatus: FileChangeStatus.Modified,
    iterationDiff: null,
    isIterationMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: { showFullFile: false },
    } as ReturnType<typeof useDiffStore>);

    vi.mocked(useDiffContentStore).mockReturnValue({
      computeFullFileDiff: vi.fn().mockResolvedValue(null),
      isLoadingContent: false,
    } as ReturnType<typeof useDiffContentStore>);

    vi.mocked(usePRStore).mockReturnValue({
      currentPR: null,
    } as ReturnType<typeof usePRStore>);
  });

  it('parses patch and returns diffLines in stateless mode', () => {
    const { result } = renderHook(() => useDiffFilter(mockSourceInput));

    expect(result.current.diffLines).toHaveLength(1);
    expect(result.current.language).toBe('typescript');
    expect(result.current.isIterationMode).toBe(false);
  });

  it('returns empty diffLines when no patch available', () => {
    const inputNoPatch: DiffSourceOutput = {
      ...mockSourceInput,
      patch: undefined,
    };

    const { result } = renderHook(() => useDiffFilter(inputNoPatch));

    expect(result.current.diffLines).toEqual([]);
    expect(result.current.language).toBe('plaintext');
  });

  it('uses iteration diff when in iteration mode', () => {
    const iterationDiff = {
      base: null,
      head: null,
      diffLines: [
        { content: 'old', type: 'deletion' as const, oldLineNumber: 1, newLineNumber: null },
        { content: 'new', type: 'addition' as const, oldLineNumber: null, newLineNumber: 1 },
      ],
      alignedLines: [],
    };

    const iterationInput: DiffSourceOutput = {
      ...mockSourceInput,
      isIterationMode: true,
      iterationDiff,
    };

    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: { showFullFile: true },
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffFilter(iterationInput));

    expect(result.current.diffLines).toBe(iterationDiff.diffLines);
    expect(result.current.isIterationMode).toBe(true);
  });

  it('filters iteration diff to changes only when showFullFile is false', () => {
    const iterationDiff = {
      base: null,
      head: null,
      diffLines: [
        { content: 'context line', type: 'context' as const, oldLineNumber: 1, newLineNumber: 1 },
        { content: 'added line', type: 'addition' as const, oldLineNumber: null, newLineNumber: 2 },
      ],
      alignedLines: [],
    };

    const iterationInput: DiffSourceOutput = {
      ...mockSourceInput,
      isIterationMode: true,
      iterationDiff,
    };

    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: { showFullFile: false },
    } as ReturnType<typeof useDiffStore>);

    const { result } = renderHook(() => useDiffFilter(iterationInput));

    // Should have filtered out context lines (mock implementation filters by type !== 'context')
    expect(result.current.diffLines).toHaveLength(1);
    expect(result.current.diffLines[0]?.type).toBe('addition');
  });

  it('detects fully added file', () => {
    const addedFileInput: DiffSourceOutput = {
      ...mockSourceInput,
      fileStatus: FileChangeStatus.Added,
    };

    const { result } = renderHook(() => useDiffFilter(addedFileInput));

    expect(result.current.isFullFileChange).toBe(true);
  });

  it('detects fully deleted file', () => {
    const deletedFileInput: DiffSourceOutput = {
      ...mockSourceInput,
      fileStatus: FileChangeStatus.Deleted,
    };

    const { result } = renderHook(() => useDiffFilter(deletedFileInput));

    expect(result.current.isFullFileChange).toBe(true);
  });

  it('detects modified file (not a full file change)', () => {
    const { result } = renderHook(() => useDiffFilter(mockSourceInput));

    expect(result.current.isFullFileChange).toBe(false);
  });

  it('detects language from filename', () => {
    const jsInput: DiffSourceOutput = {
      ...mockSourceInput,
      filename: 'script.js',
    };

    const { result } = renderHook(() => useDiffFilter(jsInput));

    expect(result.current.language).toBe('javascript');
  });

  it('fetches full file content when showFullFile enabled with currentPR', async () => {
    const mockComputeFullFileDiff = vi.fn().mockResolvedValue({
      diffLines: [{ content: 'full file line', type: 'context', oldLineNumber: 1, newLineNumber: 1 }],
      alignedLines: [],
    });

    vi.mocked(useDiffStore).mockReturnValue({
      viewConfig: { showFullFile: true },
    } as ReturnType<typeof useDiffStore>);

    vi.mocked(useDiffContentStore).mockReturnValue({
      computeFullFileDiff: mockComputeFullFileDiff,
      isLoadingContent: false,
    } as ReturnType<typeof useDiffContentStore>);

    vi.mocked(usePRStore).mockReturnValue({
      currentPR: { baseSha: 'base123', headSha: 'head456' },
    } as ReturnType<typeof usePRStore>);

    renderHook(() => useDiffFilter(mockSourceInput));

    await waitFor(() => {
      expect(mockComputeFullFileDiff).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        'test.ts',
        'base123',
        'head456',
        undefined
      );
    });
  });
});
