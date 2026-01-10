/**
 * Tests for useIterationDiff hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIterationDiff } from './useIterationDiff';
import type { IterationRange, ReviewFileArtifact, Iteration } from '@/features/iterations/types';

// Store state that tests can configure
interface MockStoreState {
  client: unknown;
  selectedRange: IterationRange | null;
  isDegraded: boolean;
  artifacts: ReviewFileArtifact[];
  iterations: Iteration[];
}

let currentMockState: MockStoreState;

// Mock the iteration store - useIterationStore can be called with or without selector
vi.mock('@/features/iterations/stores', () => ({
  useIterationStore: vi.fn((selector?: (state: unknown) => unknown) => {
    if (typeof selector === 'function') {
      // Called with selector (selectSelectedRange) - return selected range
      return currentMockState.selectedRange;
    }
    // Called without selector - return full state
    return currentMockState;
  }),
  selectSelectedRange: vi.fn((state: { selectedRange: IterationRange | null }) => state.selectedRange),
}));

const mockClient = {
  getArtifactsForRange: vi.fn(),
  getFileContent: vi.fn(),
  getFilePath: vi.fn(),
};

// Helper to setup mock state
function setupMockState(state: Partial<MockStoreState>) {
  currentMockState = {
    client: null,
    selectedRange: null,
    isDegraded: false,
    artifacts: [],
    iterations: [],
    ...state,
  };
}

// Helper to create mock iterations
function createMockIterations(count: number, options?: { rebaseAtRevision?: number }): Iteration[] {
  const iterations: Iteration[] = [];
  let baseSha = 'base-sha-original';

  for (let i = 1; i <= count; i++) {
    // Change base SHA if rebase occurred at this revision
    if (options?.rebaseAtRevision && i >= options.rebaseAtRevision) {
      baseSha = 'base-sha-after-rebase';
    }

    iterations.push({
      id: i,
      revision: i,
      headSha: `head-sha-${i}`,
      baseSha,
      beforeSha: i > 1 ? `head-sha-${i - 1}` : null,
      author: 'test-user',
      createdAt: new Date(`2024-01-0${i}T12:00:00Z`),
    });
  }

  return iterations;
}

describe('useIterationDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when degraded mode', () => {
    it('should return empty results when isDegraded is true', () => {
      setupMockState({
        client: mockClient,
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        isDegraded: true,
        artifacts: [],
      });

      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.isIterationMode).toBe(false);
      expect(result.current.changedFiles).toEqual([]);
      expect(result.current.selectedRange).toEqual({ fromSnapshot: 0, toSnapshot: 1 });
    });
  });

  describe('when no client', () => {
    it('should return empty results when client is null', () => {
      setupMockState({
        client: null,
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        isDegraded: false,
        artifacts: [],
      });

      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.isIterationMode).toBe(false);
      expect(result.current.changedFiles).toEqual([]);
    });
  });

  describe('when no selected range', () => {
    it('should return empty results when selectedRange is null', () => {
      setupMockState({
        client: mockClient,
        selectedRange: null,
        isDegraded: false,
        artifacts: [],
      });

      const { result } = renderHook(() => useIterationDiff());

      expect(result.current.isIterationMode).toBe(false);
      expect(result.current.changedFiles).toEqual([]);
      expect(result.current.selectedRange).toBeNull();
    });
  });

  describe('when iteration mode is active', () => {
    const mockArtifacts: ReviewFileArtifact[] = [
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
      setupMockState({
        client: mockClient,
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        isDegraded: false,
        artifacts: mockArtifacts,
      });

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
        setupMockState({
          client: null,
          selectedRange: null,
          isDegraded: true,
          artifacts: [],
        });

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

        setupMockState({
          client: mockClient,
          selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
          isDegraded: false,
          artifacts: deletedFileArtifacts,
        });

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

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
            isDegraded: false,
            artifacts: [sparseArtifact],
          });

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

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
            isDegraded: false,
            artifacts: [deletedArtifact],
          });

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

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
            isDegraded: false,
            artifacts: [addedLateArtifact],
          });

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

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
            isDegraded: false,
            artifacts: [renamedArtifact],
          });

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

        it('should find base content for file first modified in later iteration (base equivalence, snapshot 0)', () => {
          // Scenario: file existed in PR base, wasn't modified in iteration 1,
          // but was modified in iteration 2.
          // - Artifact firstSnapshotIndex = 2 (left snapshot of iteration 2)
          // - repoPaths = [null, null, 'action.yml', 'action.yml']
          // - Viewing from base (snapshot 0) to iteration 2 (snapshot 3)
          // - Should find base content via "base equivalence" (left snapshots all equal base)
          const lateModifiedArtifact = {
            id: 14,
            changeTrackingId: 'late-modified-file',
            repoPaths: [null, null, 'action.yml', 'action.yml'],
            firstSnapshotIndex: 2, // First captured in iteration 2
            lastSnapshotIndex: 3,
          };

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 3 }, // Base to iteration 2
            isDegraded: false,
            artifacts: [lateModifiedArtifact],
          });

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            // Content only stored at snapshots 2 and 3
            if (snapshotIndex === 2) {
              return {
                artifactId,
                snapshotIndex: 2,
                content: 'base content', // Left snapshot = PR base content
                contentHash: 'hash-base',
                sizeBytes: 12,
              };
            }
            if (snapshotIndex === 3) {
              return {
                artifactId,
                snapshotIndex: 3,
                content: 'modified content',
                contentHash: 'hash-modified',
                sizeBytes: 16,
              };
            }
            return undefined;
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('action.yml');

          // Should find both base and head content
          // This previously failed because lookup at snapshot 0 didn't find the artifact
          // Now uses "base equivalence" to find content from snapshot 2 (left snapshot)
          expect(diff).not.toBeNull();
          expect(diff?.base).not.toBeNull();
          expect(diff?.base?.content).toBe('base content');
          expect(diff?.head).not.toBeNull();
          expect(diff?.head?.content).toBe('modified content');
          // Should show as modified (both exist), not added (only head exists)
          expect(diff?.diffLines.some(l => l.type === 'deletion' || l.type === 'context')).toBe(true);
        });

        it('should find base content when comparing iteration ranges (base equivalence, snapshot 1)', () => {
          // Scenario: comparing iteration 1 to iteration 2 [1, 3]
          // File was first modified in iteration 2, so artifact starts at snapshot 2
          // Snapshot 1 content should equal snapshot 2 content (both are PR base)
          const lateModifiedArtifact = {
            id: 17,
            changeTrackingId: 'late-modified-range',
            repoPaths: [null, null, 'action.yml', 'action.yml'],
            firstSnapshotIndex: 2,
            lastSnapshotIndex: 3,
          };

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 1, toSnapshot: 3 }, // Iteration 1 to iteration 2
            isDegraded: false,
            artifacts: [lateModifiedArtifact],
          });

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            if (snapshotIndex === 2) {
              return {
                artifactId,
                snapshotIndex: 2,
                content: 'base content',
                contentHash: 'hash-base',
                sizeBytes: 12,
              };
            }
            if (snapshotIndex === 3) {
              return {
                artifactId,
                snapshotIndex: 3,
                content: 'modified content',
                contentHash: 'hash-modified',
                sizeBytes: 16,
              };
            }
            return undefined;
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('action.yml');

          // Should find both base (from snapshot 2 via equivalence) and head (snapshot 3)
          expect(diff).not.toBeNull();
          expect(diff?.base).not.toBeNull();
          expect(diff?.base?.content).toBe('base content');
          expect(diff?.head).not.toBeNull();
          expect(diff?.head?.content).toBe('modified content');
          // Should show as modified, not added
          expect(diff?.diffLines.some(l => l.type === 'deletion' || l.type === 'context')).toBe(true);
        });

        it('should NOT use base equivalence for files added in later iteration', () => {
          // File was actually added in iteration 2 (firstSnapshotIndex = 3, odd = right snapshot)
          // Should NOT apply base equivalence
          const addedInIteration2 = {
            id: 15,
            changeTrackingId: 'new-in-iter2',
            repoPaths: [null, null, null, 'new-file.ts'],
            firstSnapshotIndex: 3, // First seen at right snapshot of iteration 2
            lastSnapshotIndex: 3,
          };

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
            isDegraded: false,
            artifacts: [addedInIteration2],
          });

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            if (snapshotIndex === 3) {
              return {
                artifactId,
                snapshotIndex: 3,
                content: 'new file content',
                contentHash: 'hash-new',
                sizeBytes: 16,
              };
            }
            return undefined;
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('new-file.ts');

          // Base should be null (file didn't exist at base)
          // Head should have content
          expect(diff).not.toBeNull();
          expect(diff?.base).toBeNull();
          expect(diff?.head).not.toBeNull();
          expect(diff?.diffLines.every(l => l.type === 'addition')).toBe(true);
        });

        it('should NOT show file when viewing iteration before file was first modified', () => {
          // File existed in PR base, first modified in iteration 2
          // When viewing iteration 1 [0,1], file should NOT appear at all
          // (Previously this incorrectly showed as "deleted")
          const lateModifiedArtifact = {
            id: 16,
            changeTrackingId: 'late-modified',
            repoPaths: [null, null, 'action.yml', 'action.yml'],
            firstSnapshotIndex: 2, // First captured in iteration 2
            lastSnapshotIndex: 3,
          };

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 1 }, // Viewing iteration 1
            isDegraded: false,
            artifacts: [lateModifiedArtifact],
          });

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            // Content only exists at snapshots 2 and 3
            if (snapshotIndex === 2 || snapshotIndex === 3) {
              return {
                artifactId,
                snapshotIndex,
                content: 'file content',
                contentHash: 'hash',
                sizeBytes: 12,
              };
            }
            return undefined;
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('action.yml');

          // Both base and head should be null - file wasn't modified in iteration 1
          // Base equivalence should NOT apply because artifact doesn't overlap with range [0,1]
          expect(diff).not.toBeNull();
          expect(diff?.base).toBeNull();
          expect(diff?.head).toBeNull();
          expect(diff?.diffLines.length).toBe(0);
        });

        it('should NOT use base equivalence after rebase (Issue #151)', () => {
          // Scenario: PR was rebased between iteration 2 and 3.
          // File existed in PR base, first modified in iteration 3 (after rebase).
          // Viewing from base (snapshot 0) to iteration 3 (snapshot 5).
          //
          // Before fix: base equivalence incorrectly used snapshot 4 content as
          // equivalent to snapshot 0, even though base_sha changed after rebase.
          //
          // After fix: base equivalence should NOT apply because a rebase occurred,
          // so the file should show as "added" (no base content, only head content).
          const rebasedArtifact = {
            id: 18,
            changeTrackingId: 'rebased-file',
            repoPaths: [null, null, null, null, 'src/rebased.ts', 'src/rebased.ts'],
            firstSnapshotIndex: 4, // First captured in iteration 3 (after rebase)
            lastSnapshotIndex: 5,
          };

          // Create iterations with rebase at iteration 3
          const iterations = createMockIterations(3, { rebaseAtRevision: 3 });

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 5 }, // Base to iteration 3
            isDegraded: false,
            artifacts: [rebasedArtifact],
            iterations,
          });

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            // Content only stored at snapshots 4 and 5 (iteration 3 after rebase)
            if (snapshotIndex === 4) {
              return {
                artifactId,
                snapshotIndex: 4,
                // This is content from the NEW base (after rebase), NOT the original base
                content: 'content from rebased base',
                contentHash: 'hash-rebased-base',
                sizeBytes: 25,
              };
            }
            if (snapshotIndex === 5) {
              return {
                artifactId,
                snapshotIndex: 5,
                content: 'modified after rebase',
                contentHash: 'hash-modified',
                sizeBytes: 21,
              };
            }
            return undefined;
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('src/rebased.ts');

          // After rebase, we should NOT use base equivalence.
          // The file at snapshot 0 (original base) has different content than
          // snapshot 4 (new rebased base). Since we can't find content at snapshot 0,
          // the file should appear as "added" (no base, only head).
          expect(diff).not.toBeNull();
          expect(diff?.base).toBeNull(); // Key assertion: no base content due to rebase
          expect(diff?.head).not.toBeNull();
          expect(diff?.head?.content).toBe('modified after rebase');
          expect(diff?.diffLines.every(l => l.type === 'addition')).toBe(true);
        });

        it('should still use base equivalence when no rebase occurred', () => {
          // Same scenario as Issue #151 test, but WITHOUT rebase.
          // File existed in PR base, first modified in iteration 3 (NO rebase).
          // Viewing from base (snapshot 0) to iteration 3 (snapshot 5).
          //
          // Base equivalence SHOULD apply: snapshot 4 content equals snapshot 0.
          const noRebaseArtifact = {
            id: 19,
            changeTrackingId: 'no-rebase-file',
            repoPaths: [null, null, null, null, 'src/no-rebase.ts', 'src/no-rebase.ts'],
            firstSnapshotIndex: 4, // First captured in iteration 3
            lastSnapshotIndex: 5,
          };

          // Create iterations WITHOUT rebase
          const iterations = createMockIterations(3);

          setupMockState({
            client: mockClient,
            selectedRange: { fromSnapshot: 0, toSnapshot: 5 }, // Base to iteration 3
            isDegraded: false,
            artifacts: [noRebaseArtifact],
            iterations,
          });

          mockClient.getFileContent.mockImplementation((artifactId: number, snapshotIndex: number) => {
            if (snapshotIndex === 4) {
              return {
                artifactId,
                snapshotIndex: 4,
                content: 'original base content', // Same as snapshot 0 (no rebase)
                contentHash: 'hash-base',
                sizeBytes: 21,
              };
            }
            if (snapshotIndex === 5) {
              return {
                artifactId,
                snapshotIndex: 5,
                content: 'modified content',
                contentHash: 'hash-modified',
                sizeBytes: 16,
              };
            }
            return undefined;
          });

          const { result } = renderHook(() => useIterationDiff());
          const diff = result.current.getFileDiffByPath('src/no-rebase.ts');

          // Without rebase, base equivalence SHOULD apply.
          // File should show as "modified" (both base and head content).
          expect(diff).not.toBeNull();
          expect(diff?.base).not.toBeNull(); // Key assertion: base content found via equivalence
          expect(diff?.base?.content).toBe('original base content');
          expect(diff?.head).not.toBeNull();
          expect(diff?.head?.content).toBe('modified content');
          // Should show as modified, not added
          expect(diff?.diffLines.some(l => l.type === 'deletion' || l.type === 'context')).toBe(true);
        });
      });
    });
  });
});
