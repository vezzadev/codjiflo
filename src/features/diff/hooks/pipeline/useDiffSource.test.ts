/**
 * Unit tests for useDiffSource pipeline hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDiffSource } from './useDiffSource';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../../stores';
import { useIterationDiff, useIterationAwareFiles } from '..';
import { FileChangeStatus } from '@/api/types';

vi.mock('../../stores', () => ({
  useDiffStore: vi.fn(),
  PR_DESCRIPTION_INDEX: -1,
}));

vi.mock('..', () => ({
  useIterationDiff: vi.fn(),
  useIterationAwareFiles: vi.fn(),
}));

describe('useDiffSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns patch and filename from stateless mode', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [
        { filename: 'test.ts', patch: 'patch content', status: FileChangeStatus.Modified },
      ],
      selectedFileIndex: 0,
    });

    vi.mocked(useIterationDiff).mockReturnValue({
      isIterationMode: false,
      getFileDiffByPath: vi.fn(),
      selectedRange: null,
      changedFiles: [],
      getArtifactByPath: vi.fn(),
    });

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: [],
      isIterationMode: false,
      totalFilesInPR: 1,
    });

    const { result } = renderHook(() => useDiffSource());

    expect(result.current.filename).toBe('test.ts');
    expect(result.current.patch).toBe('patch content');
    expect(result.current.fileStatus).toBe(FileChangeStatus.Modified);
    expect(result.current.isIterationMode).toBe(false);
    expect(result.current.iterationDiff).toBeNull();
  });

  it('returns iteration diff in iteration mode', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [
        { filename: 'test.ts', patch: 'api patch', status: FileChangeStatus.Modified },
      ],
      selectedFileIndex: 0,
    });

    const mockIterationDiff = { base: null, head: null, diffLines: [], alignedLines: [] };

    vi.mocked(useIterationDiff).mockReturnValue({
      isIterationMode: true,
      getFileDiffByPath: vi.fn(() => mockIterationDiff),
      selectedRange: { fromSnapshot: 1, toSnapshot: 2 },
      changedFiles: [{ id: 1, changeTrackingId: 'test.ts', repoPaths: ['test.ts'], firstSnapshotIndex: 0, lastSnapshotIndex: 1 }],
      getArtifactByPath: vi.fn(),
    });

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: [{ filename: 'test.ts', originalIndex: 0, status: FileChangeStatus.Modified, additions: 1, deletions: 0, changes: 1, patch: '' }],
      isIterationMode: true,
      totalFilesInPR: 1,
    });

    const { result } = renderHook(() => useDiffSource());

    expect(result.current.isIterationMode).toBe(true);
    expect(result.current.iterationDiff).toBe(mockIterationDiff);
  });

  it('returns undefined for PR description view', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [{ filename: 'test.ts', patch: 'patch' }],
      selectedFileIndex: PR_DESCRIPTION_INDEX,
    });

    vi.mocked(useIterationDiff).mockReturnValue({
      isIterationMode: false,
      getFileDiffByPath: vi.fn(),
      selectedRange: null,
      changedFiles: [],
      getArtifactByPath: vi.fn(),
    });

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: [],
      isIterationMode: false,
      totalFilesInPR: 0,
    });

    const { result } = renderHook(() => useDiffSource());

    expect(result.current.patch).toBeUndefined();
    expect(result.current.filename).toBeUndefined();
    expect(result.current.fileStatus).toBeUndefined();
    expect(result.current.iterationDiff).toBeNull();
  });

  it('handles no selected file in stateless mode', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [],
      selectedFileIndex: 0,
    });

    vi.mocked(useIterationDiff).mockReturnValue({
      isIterationMode: false,
      getFileDiffByPath: vi.fn(),
      selectedRange: null,
      changedFiles: [],
      getArtifactByPath: vi.fn(),
    });

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: [],
      isIterationMode: false,
      totalFilesInPR: 0,
    });

    const { result } = renderHook(() => useDiffSource());

    expect(result.current.patch).toBeUndefined();
    expect(result.current.filename).toBeUndefined();
  });

  it('prefers iteration-aware file in iteration mode', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [
        { filename: 'old-name.ts', patch: 'api patch', status: FileChangeStatus.Modified },
      ],
      selectedFileIndex: 0,
    });

    vi.mocked(useIterationDiff).mockReturnValue({
      isIterationMode: true,
      getFileDiffByPath: vi.fn(() => null),
      selectedRange: { fromSnapshot: 1, toSnapshot: 2 },
      changedFiles: [{ id: 1, changeTrackingId: 'iteration-file.ts', repoPaths: ['iteration-file.ts'], firstSnapshotIndex: 0, lastSnapshotIndex: 1 }],
      getArtifactByPath: vi.fn(),
    });

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: [
        {
          filename: 'iteration-file.ts',
          originalIndex: 0,
          status: FileChangeStatus.Added,
          patch: 'iteration patch',
          additions: 1,
          deletions: 0,
          changes: 1,
        },
      ],
      isIterationMode: true,
      totalFilesInPR: 1,
    });

    const { result } = renderHook(() => useDiffSource());

    expect(result.current.filename).toBe('iteration-file.ts');
    expect(result.current.fileStatus).toBe(FileChangeStatus.Added);
  });
});
