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
        // Set up artifact for deleted file: exists at snapshot 0, deleted at snapshot 1
        const deletedFileArtifacts = [
          {
            id: 3,
            changeTrackingId: 'deleted-file',
            repoPaths: ['src/deleted.ts'], // Only exists at snapshot 0
            firstSnapshotIndex: 0,
            lastSnapshotIndex: 0,
          },
        ];

        vi.mocked(useIterationStore).mockReturnValue({
          client: mockClient,
          selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
          isDegraded: false,
          artifacts: deletedFileArtifacts,
        } as unknown);

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
        const diff = result.current.getFileDiffByPath('src/deleted.ts');

        expect(diff).not.toBeNull();
        expect(diff?.base).not.toBeNull();
        expect(diff?.head).toBeNull();
        expect(diff?.diffLines.length).toBe(2);
        expect(diff?.diffLines[0]?.type).toBe('deletion');
      });

      it('should compute diff for modified file', () => {
        // Use file2 which exists at both snapshot 0 and 1 (repoPaths: ['src/file2.ts', 'src/file2.ts'])
        mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
          const content = snapshotIndex === 0 ? 'original' : 'modified';
          return {
            artifactId,
            snapshotIndex,
            content,
            contentHash: `hash-${snapshotIndex}`,
            sizeBytes: content.length,
          };
        });

        const { result } = renderHook(() => useIterationDiff());
        const diff = result.current.getFileDiffByPath('src/file2.ts');

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

      describe('delta storage (sparse repoPaths)', () => {
        it('should find content when repoPaths array is shorter than snapshotIndex', () => {
          // Scenario: artifact_snapshots only has entry for snapshot 0
          // but file exists through snapshot 1 (lastSnapshotIndex: 1)
          // repoPaths array has only 1 entry due to delta storage
          const sparseArtifact = {
            id: 10,
            changeTrackingId: 'sparse-file',
            repoPaths: ['src/sparse.ts'], // Only index 0, but file exists at both snapshots
            firstSnapshotIndex: 0,
            lastSnapshotIndex: 1, // File exists through snapshot 1
          };

          vi.mocked(useIterationStore).mockReturnValue({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
            isDegraded: false,
            artifacts: [sparseArtifact],
          } as unknown);

          // getFileContent returns content at or before requested snapshot
          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            // Content stored only at snapshot 0, but valid for snapshot 1 too
            return {
              artifactId,
              snapshotIndex: 0, // Returns snapshot 0 content for both queries
              content: snapshotIndex === 0 ? 'base content' : 'head content',
              contentHash: `hash-${snapshotIndex}`,
              sizeBytes: 12,
            };
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('src/sparse.ts');

          // Should find content for both base and head despite sparse repoPaths
          expect(diff).not.toBeNull();
          expect(diff?.base).not.toBeNull();
          expect(diff?.head).not.toBeNull();
        });

        it('should not find content when snapshotIndex exceeds lastSnapshotIndex', () => {
          // File was deleted after snapshot 0 (lastSnapshotIndex: 0)
          const deletedArtifact = {
            id: 11,
            changeTrackingId: 'deleted-early',
            repoPaths: ['src/deleted-early.ts'],
            firstSnapshotIndex: 0,
            lastSnapshotIndex: 0, // File only exists at snapshot 0
          };

          vi.mocked(useIterationStore).mockReturnValue({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
            isDegraded: false,
            artifacts: [deletedArtifact],
          } as unknown);

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            if (snapshotIndex <= 0) {
              return {
                artifactId,
                snapshotIndex: 0,
                content: 'old content',
                contentHash: 'hash-0',
                sizeBytes: 11,
              };
            }
            return undefined;
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('src/deleted-early.ts');

          // Base exists, head doesn't (file was deleted)
          expect(diff).not.toBeNull();
          expect(diff?.base).not.toBeNull();
          expect(diff?.head).toBeNull();
          expect(diff?.diffLines.every(l => l.type === 'deletion')).toBe(true);
        });

        it('should not find content when snapshotIndex is before firstSnapshotIndex', () => {
          // File was added in snapshot 1 (firstSnapshotIndex: 1)
          const addedLateArtifact = {
            id: 12,
            changeTrackingId: 'added-late',
            repoPaths: [null, 'src/added-late.ts'], // null at 0, path at 1
            firstSnapshotIndex: 1,
            lastSnapshotIndex: 1,
          };

          vi.mocked(useIterationStore).mockReturnValue({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
            isDegraded: false,
            artifacts: [addedLateArtifact],
          } as unknown);

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            if (snapshotIndex >= 1) {
              return {
                artifactId,
                snapshotIndex: 1,
                content: 'new content',
                contentHash: 'hash-1',
                sizeBytes: 11,
              };
            }
            return undefined;
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('src/added-late.ts');

          // Base doesn't exist, head exists (file was added)
          expect(diff).not.toBeNull();
          expect(diff?.base).toBeNull();
          expect(diff?.head).not.toBeNull();
          expect(diff?.diffLines.every(l => l.type === 'addition')).toBe(true);
        });

        it('should handle renamed file with path change at snapshot', () => {
          // File renamed: old-name.ts -> new-name.ts
          const renamedArtifact = {
            id: 13,
            changeTrackingId: 'renamed-file',
            repoPaths: ['src/old-name.ts', 'src/new-name.ts'],
            firstSnapshotIndex: 0,
            lastSnapshotIndex: 1,
          };

          vi.mocked(useIterationStore).mockReturnValue({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
            isDegraded: false,
            artifacts: [renamedArtifact],
          } as unknown);

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => ({
            artifactId,
            snapshotIndex,
            content: snapshotIndex === 0 ? 'old content' : 'new content',
            contentHash: `hash-${snapshotIndex}`,
            sizeBytes: 11,
          }));

          const { result } = renderHook(() => useIterationDiff());

          // Looking up by new name should find the artifact
          const diffByNewName = result.current.getFileDiffByPath('src/new-name.ts');
          expect(diffByNewName).not.toBeNull();

          // Looking up by old name should also find the artifact
          const diffByOldName = result.current.getFileDiffByPath('src/old-name.ts');
          expect(diffByOldName).not.toBeNull();
        });
      });
    });
  });
});
