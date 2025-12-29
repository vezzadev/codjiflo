/**
 * Tests for useIterationDiff hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIterationDiff } from './useIterationDiff';
import { useIterationStore } from '@/features/iterations/stores';

// Mock the iteration store
vi.mock('@/features/iterations/stores', () => ({
  useIterationStore: vi.fn(),
}));

const mockClient = {
  getArtifactsForRange: vi.fn(),
  getFileContent: vi.fn(),
  getFilePath: vi.fn(),
};

describe('useIterationDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when degraded mode', () => {
    it('should return empty results when isDegraded is true', () => {
      vi.mocked(useIterationStore).mockReturnValue({
        client: mockClient,
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        isDegraded: true,
        artifacts: [],
      } as ReturnType<typeof useIterationStore>);

      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.isIterationMode).toBe(false);
      expect(result.current.changedFiles).toEqual([]);
      expect(result.current.selectedRange).toEqual({ fromSnapshot: 0, toSnapshot: 1 });
    });
  });

  describe('when no client', () => {
    it('should return empty results when client is null', () => {
      vi.mocked(useIterationStore).mockReturnValue({
        client: null,
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        isDegraded: false,
        artifacts: [],
      } as ReturnType<typeof useIterationStore>);

      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.isIterationMode).toBe(false);
      expect(result.current.changedFiles).toEqual([]);
    });
  });

  describe('when no selected range', () => {
    it('should return empty results when selectedRange is null', () => {
      vi.mocked(useIterationStore).mockReturnValue({
        client: mockClient,
        selectedRange: null,
        isDegraded: false,
        artifacts: [],
      } as ReturnType<typeof useIterationStore>);

      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.isIterationMode).toBe(false);
      expect(result.current.changedFiles).toEqual([]);
      expect(result.current.selectedRange).toBeNull();
    });
  });

  describe('when iteration mode is active', () => {
    const mockArtifacts = [
      {
        id: 1,
        changeTrackingId: 'file-1',
        repoPaths: [null, 'src/file1.ts', 'src/file1.ts', 'src/file1.ts'],
        firstSnapshotIndex: 1,
        lastSnapshotIndex: 3,
      },
      {
        id: 2,
        changeTrackingId: 'file-2',
        repoPaths: ['src/file2.ts', 'src/file2.ts'],
        firstSnapshotIndex: 0,
        lastSnapshotIndex: 1,
      },
    ];

    beforeEach(() => {
      vi.mocked(useIterationStore).mockReturnValue({
        client: mockClient,
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        isDegraded: false,
        artifacts: mockArtifacts,
      } as unknown);

      mockClient.getArtifactsForRange.mockReturnValue(mockArtifacts);
    });

    it('should be in iteration mode when client and range are available', () => {
      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.isIterationMode).toBe(true);
    });

    it('should return changed files for the selected range', () => {
      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.changedFiles).toEqual(mockArtifacts);
      expect(mockClient.getArtifactsForRange).toHaveBeenCalledWith(0, 1);
    });

    it('should return selectedRange', () => {
      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.selectedRange).toEqual({ fromSnapshot: 0, toSnapshot: 1 });
    });

    describe('getArtifactByPath', () => {
      it('should return artifact by latest path', () => {
        const { result } = renderHook(() => useIterationDiff());

        const artifact = result.current.getArtifactByPath('src/file1.ts');
        expect(artifact).toEqual(mockArtifacts[0]);
      });

      it('should return undefined for unknown path', () => {
        const { result } = renderHook(() => useIterationDiff());

        const artifact = result.current.getArtifactByPath('unknown.ts');
        expect(artifact).toBeUndefined();
      });
    });

    describe('getFileDiffByPath', () => {
      it('should return null when not in iteration mode', () => {
        vi.mocked(useIterationStore).mockReturnValue({
          client: null,
          selectedRange: null,
          isDegraded: true,
          artifacts: [],
        } as ReturnType<typeof useIterationStore>);

        const { result } = renderHook(() => useIterationDiff());
        const diff = result.current.getFileDiffByPath('src/file1.ts');

        expect(diff).toBeNull();
      });

      it('should compute diff for added file', () => {
        mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
          if (snapshotIndex === 0) return undefined; // File didn't exist at base
          return {
            artifactId,
            snapshotIndex,
            content: 'line1\nline2',
            contentHash: 'hash1',
            sizeBytes: 11,
          };
        });

        const { result } = renderHook(() => useIterationDiff());
        const diff = result.current.getFileDiffByPath('src/file1.ts');

        expect(diff).not.toBeNull();
        expect(diff?.base).toBeNull();
        expect(diff?.head).not.toBeNull();
        expect(diff?.diffLines.length).toBe(2);
        expect(diff?.diffLines[0]?.type).toBe('addition');
      });

      it('should compute diff for deleted file', () => {
        mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
          if (snapshotIndex === 1) return undefined; // File deleted at head
          return {
            artifactId,
            snapshotIndex,
            content: 'old-line1\nold-line2',
            contentHash: 'hash1',
            sizeBytes: 19,
          };
        });

        const { result } = renderHook(() => useIterationDiff());
        const diff = result.current.getFileDiffByPath('src/file1.ts');

        expect(diff).not.toBeNull();
        expect(diff?.base).not.toBeNull();
        expect(diff?.head).toBeNull();
        expect(diff?.diffLines.length).toBe(2);
        expect(diff?.diffLines[0]?.type).toBe('deletion');
      });

      it('should compute diff for modified file', () => {
        mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
          const content = snapshotIndex === 0 ? 'original' : 'modified';
          return {
            artifactId,
            snapshotIndex,
            content,
            contentHash: 'hash-' + String(snapshotIndex),
            sizeBytes: content.length,
          };
        });

        const { result } = renderHook(() => useIterationDiff());
        const diff = result.current.getFileDiffByPath('src/file1.ts');

        expect(diff).not.toBeNull();
        expect(diff?.base).not.toBeNull();
        expect(diff?.head).not.toBeNull();
        // Both versions exist, diff computed
        expect(diff?.diffLines.length).toBeGreaterThan(0);
      });

      it('should return empty diff when path not found', () => {
        mockClient.getFileContent.mockReturnValue(undefined);

        const { result } = renderHook(() => useIterationDiff());
        const diff = result.current.getFileDiffByPath('unknown-file.ts');

        // Unknown path = no content found = empty diff
        expect(diff).not.toBeNull();
        expect(diff?.diffLines.length).toBe(0);
      });
    });
  });
});
