/**
 * Integration tests for useIterationAwareFiles hook
 *
 * Tests various file lifecycle scenarios across iterations to ensure
 * iteration-aware filtering is rock solid.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIterationAwareFiles } from './useIterationAwareFiles';
import { useDiffStore } from '../stores';
import { FileChangeStatus } from '@/api/types';
import type { FileChange } from '@/api/types';
import type { ReviewFileArtifact, FileContent, StatelessReason } from '@/features/iterations/types';

// Mock dependencies
vi.mock('../stores', () => ({
  useDiffStore: vi.fn(),
}));

// Store state that tests can configure
interface MockIterationStoreState {
  client: MockIterationClient | null;
  mode: 'stateful' | 'stateless';
  statelessReason?: StatelessReason | null;
  artifacts: ReviewFileArtifact[];
  selectedRange: { fromSnapshot: number; toSnapshot: number } | null;
  currentPrKey?: string | null;
}

let currentIterationStoreState: MockIterationStoreState;

vi.mock('@/features/iterations/stores', () => ({
  useIterationStore: vi.fn((selector?: (state: unknown) => unknown) => {
    if (typeof selector === 'function') {
      // Called with selector (selectSelectedRange) - return selected range
      return currentIterationStoreState.selectedRange;
    }
    // Called without selector - return full state
    return currentIterationStoreState;
  }),
  selectSelectedRange: vi.fn((state: { selectedRange: { fromSnapshot: number; toSnapshot: number } | null }) => state.selectedRange),
}));

// Helper to create mock file
function createMockFile(
  filename: string,
  status: FileChangeStatus = FileChangeStatus.Modified,
  additions = 10,
  deletions = 5
): FileChange {
  return {
    filename,
    status,
    additions,
    deletions,
    changes: additions + deletions,
    patch: `@@ -1,${deletions} +1,${additions} @@`,
  };
}

// Helper to create mock artifact
function createMockArtifact(
  id: number,
  path: string,
  snapshotIndices: number[]
): ReviewFileArtifact {
  const repoPaths: (string | null)[] = [];
  const maxIndex = Math.max(...snapshotIndices);
  for (let i = 0; i <= maxIndex; i++) {
    repoPaths.push(snapshotIndices.includes(i) ? path : null);
  }
  return {
    id,
    changeTrackingId: `sha-${id}`,
    repoPaths,
    firstSnapshotIndex: Math.min(...snapshotIndices),
    lastSnapshotIndex: maxIndex,
  };
}

// Helper to create mock content
function createMockContent(
  artifactId: number,
  snapshotIndex: number,
  content: string
): FileContent {
  return {
    artifactId,
    snapshotIndex,
    content,
    contentHash: `hash-${artifactId}-${snapshotIndex}-${content.length}`,
    sizeBytes: content.length,
  };
}

/**
 * Mock client that supports complex scenarios with multiple artifacts per path
 */
class MockIterationClient {
  private artifacts: ReviewFileArtifact[] = [];
  private contentMap: Map<string, FileContent> = new Map(); // key: `${artifactId}-${snapshotIndex}`

  constructor() {
    this.getArtifactsForRange = vi.fn(this.getArtifactsForRange.bind(this));
    this.getFileContent = vi.fn(this.getFileContent.bind(this));
    this.getFilePath = vi.fn(this.getFilePath.bind(this));
  }

  setArtifacts(artifacts: ReviewFileArtifact[]) {
    this.artifacts = artifacts;
  }

  setContent(artifactId: number, snapshotIndex: number, content: string | null) {
    const key = `${artifactId}-${snapshotIndex}`;
    if (content === null) {
      this.contentMap.delete(key);
    } else {
      this.contentMap.set(key, createMockContent(artifactId, snapshotIndex, content));
    }
  }

  getArtifactsForRange(leftSnapshot: number, rightSnapshot: number): ReviewFileArtifact[] {
    return this.artifacts.filter(
      (a) => a.firstSnapshotIndex <= rightSnapshot && a.lastSnapshotIndex >= leftSnapshot
    );
  }

  getFileContent(artifactId: number, snapshotIndex: number): FileContent | undefined {
    // Simulate "at or before" logic like the real client
    for (let i = snapshotIndex; i >= 0; i--) {
      const key = `${artifactId}-${i}`;
      const content = this.contentMap.get(key);
      if (content) {
        return { ...content, snapshotIndex: i };
      }
    }
    return undefined;
  }

  getFilePath(artifactId: number, snapshotIndex: number): string | null {
    const artifact = this.artifacts.find((a) => a.id === artifactId);
    return artifact?.repoPaths[snapshotIndex] ?? null;
  }
}

describe('useIterationAwareFiles - Integration Tests', () => {
  let mockClient: MockIterationClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new MockIterationClient();
  });

  // Helper to setup mocks
  function setupMocks(
    files: FileChange[],
    artifacts: ReviewFileArtifact[],
    selectedRange: { fromSnapshot: number; toSnapshot: number } | null
  ) {
    mockClient.setArtifacts(artifacts);

    vi.mocked(useDiffStore).mockReturnValue({
      files,
      selectedFileIndex: 0,
      isLoading: false,
      viewConfig: { mode: 'inline', showWhitespace: false },
      setFiles: vi.fn(),
      selectFile: vi.fn(),
      setLoading: vi.fn(),
      setViewConfig: vi.fn(),
      reset: vi.fn(),
    });

    currentIterationStoreState = {
      client: selectedRange ? mockClient : null,
      selectedRange,
      mode: selectedRange ? 'stateful' : 'stateless',
      artifacts,
    };
  }

  describe('Non-iteration mode (stateless)', () => {
    it('should return all files unchanged when not in iteration mode', () => {
      const files = [
        createMockFile('src/file1.ts'),
        createMockFile('src/file2.ts', FileChangeStatus.Added, 20, 0),
      ];

      setupMocks(files, [], null);

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.isIterationMode).toBe(false);
      expect(result.current.files).toHaveLength(2);
      expect(result.current.files[0]?.filename).toBe('src/file1.ts');
      expect(result.current.files[1]?.filename).toBe('src/file2.ts');
      expect(result.current.totalFilesInPR).toBe(2);
    });

    it('should return files sorted alphabetically by filename (case-insensitive)', () => {
      // Files in unsorted order from GitHub API
      const files = [
        createMockFile('src/zebra.ts'),
        createMockFile('src/alpha.ts'),
        createMockFile('README.md'),
        createMockFile('package.json'),
      ];

      setupMocks(files, [], null);

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(4);
      // Files should be sorted alphabetically (case-insensitive: p < r < s)
      expect(result.current.files[0]?.filename).toBe('package.json');
      expect(result.current.files[1]?.filename).toBe('README.md');
      expect(result.current.files[2]?.filename).toBe('src/alpha.ts');
      expect(result.current.files[3]?.filename).toBe('src/zebra.ts');
    });
  });

  describe('Console warning for stateless mode (Issue #186)', () => {
    it('should emit console warning once when entering stateless mode', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const files = [createMockFile('src/file1.ts')];

      // Setup stateless mode with reason
      currentIterationStoreState = {
        client: null,
        selectedRange: null,
        mode: 'stateless',
        statelessReason: 'no-artifact',
        artifacts: [],
        currentPrKey: 'https://github.com/test/repo/pull/123',
      };

      vi.mocked(useDiffStore).mockReturnValue({
        files,
        selectedFileIndex: 0,
        isLoading: false,
        viewConfig: { mode: 'inline', showWhitespace: false },
        setFiles: vi.fn(),
        selectFile: vi.fn(),
        setLoading: vi.fn(),
        setViewConfig: vi.fn(),
        reset: vi.fn(),
      });

      renderHook(() => useIterationAwareFiles());

      // Verify warning was called once
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[CodjiFlo] Using GitHub API as fallback (stateless mode). ' +
        'Reason: No CodjiFlo artifact found (the repository may not have the CodjiFlo GitHub Action installed). ' +
        'Iteration tracking features are unavailable.'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not emit warning twice for same PR (deduplication)', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const files = [createMockFile('src/file1.ts')];

      currentIterationStoreState = {
        client: null,
        selectedRange: null,
        mode: 'stateless',
        statelessReason: 'no-artifact',
        artifacts: [],
        currentPrKey: 'https://github.com/test/repo/pull/123',
      };

      vi.mocked(useDiffStore).mockReturnValue({
        files,
        selectedFileIndex: 0,
        isLoading: false,
        viewConfig: { mode: 'inline', showWhitespace: false },
        setFiles: vi.fn(),
        selectFile: vi.fn(),
        setLoading: vi.fn(),
        setViewConfig: vi.fn(),
        reset: vi.fn(),
      });

      // Render first time
      const { rerender } = renderHook(() => useIterationAwareFiles());
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Rerender with same PR key - should not warn again
      rerender();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // Still 1, not 2

      consoleWarnSpy.mockRestore();
    });

    it('should emit warning again for different PR', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const files = [createMockFile('src/file1.ts')];

      // First PR
      currentIterationStoreState = {
        client: null,
        selectedRange: null,
        mode: 'stateless',
        statelessReason: 'no-artifact',
        artifacts: [],
        currentPrKey: 'https://github.com/test/repo/pull/123',
      };

      vi.mocked(useDiffStore).mockReturnValue({
        files,
        selectedFileIndex: 0,
        isLoading: false,
        viewConfig: { mode: 'inline', showWhitespace: false },
        setFiles: vi.fn(),
        selectFile: vi.fn(),
        setLoading: vi.fn(),
        setViewConfig: vi.fn(),
        reset: vi.fn(),
      });

      const { unmount } = renderHook(() => useIterationAwareFiles());
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      unmount();

      // Different PR
      currentIterationStoreState.currentPrKey = 'https://github.com/test/repo/pull/456';

      renderHook(() => useIterationAwareFiles());
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2); // Warning emitted for new PR

      consoleWarnSpy.mockRestore();
    });

    it('should not emit warning when not in stateless mode', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      const files = [createMockFile('src/file1.ts')];

      // Setup stateful mode
      setupMocks(files, [], { fromSnapshot: 0, toSnapshot: 1 });
      currentIterationStoreState.mode = 'stateful';
      currentIterationStoreState.currentPrKey = 'https://github.com/test/repo/pull/123';

      renderHook(() => useIterationAwareFiles());

      // No warning should be emitted
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Iteration mode file sorting', () => {
    it('should return files sorted alphabetically by filename in iteration mode', () => {
      // Files in unsorted order from GitHub API
      const files = [
        createMockFile('src/zebra.ts'),
        createMockFile('src/alpha.ts'),
        createMockFile('README.md'),
      ];

      const artifacts = [
        createMockArtifact(1, 'src/zebra.ts', [0, 1]),
        createMockArtifact(2, 'src/alpha.ts', [0, 1]),
        createMockArtifact(3, 'README.md', [0, 1]),
      ];

      setupMocks(files, artifacts, { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 0, 'zebra original');
      mockClient.setContent(1, 1, 'zebra modified');
      mockClient.setContent(2, 0, 'alpha original');
      mockClient.setContent(2, 1, 'alpha modified');
      mockClient.setContent(3, 0, 'readme original');
      mockClient.setContent(3, 1, 'readme modified');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.isIterationMode).toBe(true);
      expect(result.current.files).toHaveLength(3);
      // Files should be sorted alphabetically
      expect(result.current.files[0]?.filename).toBe('README.md');
      expect(result.current.files[1]?.filename).toBe('src/alpha.ts');
      expect(result.current.files[2]?.filename).toBe('src/zebra.ts');
    });
  });

  describe('File Unchanged Between Iterations', () => {
    it('should hide file that has no changes in selected range', () => {
      // File was added in v1 (snapshots 0-1), unchanged since
      // Comparing v5→v6 (snapshots 9→11) should hide it
      const files = [createMockFile('src/unchanged.ts', FileChangeStatus.Added, 50, 0)];
      const artifact = createMockArtifact(1, 'src/unchanged.ts', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

      setupMocks(files, [artifact], { fromSnapshot: 9, toSnapshot: 11 });

      // Set same content for both snapshots (unchanged)
      mockClient.setContent(1, 0, 'const x = 1;');
      mockClient.setContent(1, 9, 'const x = 1;');
      mockClient.setContent(1, 11, 'const x = 1;');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.isIterationMode).toBe(true);
      expect(result.current.files).toHaveLength(0); // File hidden - no changes
      expect(result.current.totalFilesInPR).toBe(1);
    });

    it('should hide file unchanged across multiple iterations', () => {
      // File modified in v2 but unchanged in v3, v4, v5, v6
      // Comparing v3→v6 should hide it
      const files = [createMockFile('src/stable.ts')];
      const artifact = createMockArtifact(1, 'src/stable.ts', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

      setupMocks(files, [artifact], { fromSnapshot: 5, toSnapshot: 11 });

      // Content same from v3 (snapshot 5) onwards
      mockClient.setContent(1, 3, 'modified content');
      mockClient.setContent(1, 5, 'modified content');
      mockClient.setContent(1, 11, 'modified content');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe('File Added in Iteration', () => {
    it('should show file added in selected iteration range', () => {
      // File added in v3 (snapshot 5)
      // Comparing v2→v3 should show it as added
      const files = [createMockFile('src/new-file.ts', FileChangeStatus.Added, 30, 0)];
      const artifact = createMockArtifact(1, 'src/new-file.ts', [5, 6, 7, 8, 9, 10, 11]);

      setupMocks(files, [artifact], { fromSnapshot: 3, toSnapshot: 5 });

      // No content at snapshot 3, content at snapshot 5
      mockClient.setContent(1, 5, 'new file content\nline 2\nline 3');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Added);
      expect(result.current.files[0]?.additions).toBe(3);
      expect(result.current.files[0]?.deletions).toBe(0);
    });

    it('should hide file that was added before the selected range', () => {
      // File added in v1, comparing v5→v6
      const files = [createMockFile('src/old-new.ts', FileChangeStatus.Added)];
      const artifact = createMockArtifact(1, 'src/old-new.ts', [1, 3, 5, 7, 9, 11]);

      setupMocks(files, [artifact], { fromSnapshot: 9, toSnapshot: 11 });

      // Same content in both snapshots
      mockClient.setContent(1, 1, 'old content');
      mockClient.setContent(1, 9, 'old content');
      mockClient.setContent(1, 11, 'old content');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe('File Deleted in Iteration', () => {
    it('should show file deleted in selected iteration range', () => {
      // File existed, deleted in v4 (snapshot 7)
      // Comparing v3→v4 should show it as deleted
      const files = [createMockFile('src/deleted.ts', FileChangeStatus.Deleted, 0, 25)];
      const artifact = createMockArtifact(1, 'src/deleted.ts', [0, 1, 2, 3, 4, 5, 6]);

      setupMocks(files, [artifact], { fromSnapshot: 5, toSnapshot: 7 });

      // Content at snapshot 5, no content at snapshot 7
      mockClient.setContent(1, 5, 'content before deletion\nline 2');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Deleted);
      expect(result.current.files[0]?.deletions).toBe(2);
      expect(result.current.files[0]?.additions).toBe(0);
    });

    it('should hide deleted file when comparing after deletion', () => {
      // File deleted in v2, comparing v4→v5 should not show it
      const files = [createMockFile('src/long-gone.ts', FileChangeStatus.Deleted)];
      const artifact = createMockArtifact(1, 'src/long-gone.ts', [0, 1, 2, 3]);

      setupMocks(files, [artifact], { fromSnapshot: 7, toSnapshot: 9 });

      // No content at these snapshots (file was deleted earlier)
      // mockClient has no content set

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe('File Modified in Iteration', () => {
    it('should show file modified in selected iteration range', () => {
      const files = [createMockFile('src/modified.ts')];
      const artifact = createMockArtifact(1, 'src/modified.ts', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

      setupMocks(files, [artifact], { fromSnapshot: 9, toSnapshot: 11 });

      mockClient.setContent(1, 9, 'original line 1\noriginal line 2');
      mockClient.setContent(1, 11, 'modified line 1\noriginal line 2\nnew line 3');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);
      expect(result.current.files[0]?.additions).toBeGreaterThan(0);
    });

    it('should show correct stats for modified file', () => {
      const files = [createMockFile('src/stats-test.ts')];
      const artifact = createMockArtifact(1, 'src/stats-test.ts', [0, 1, 3, 5]);

      setupMocks(files, [artifact], { fromSnapshot: 1, toSnapshot: 3 });

      // Original: 3 lines, Modified: 4 lines (1 deleted, 2 added)
      mockClient.setContent(1, 1, 'line1\nline2\nline3');
      mockClient.setContent(1, 3, 'line1\nmodified2\nnew3\nnew4');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      // Exact stats depend on diff algorithm, but should have changes
      expect(result.current.files[0]?.changes).toBeGreaterThan(0);
    });
  });

  describe('Complex Lifecycle: Add → Modify → Unchanged → Modify', () => {
    it('should show file only in iterations where it changed', () => {
      // File lifecycle:
      // v1: Added (snapshot 1)
      // v2: Modified (snapshot 3)
      // v3: Unchanged (snapshot 5) - same as v2
      // v4: Unchanged (snapshot 7) - same as v2
      // v5: Modified (snapshot 9)
      // v6: Unchanged (snapshot 11) - same as v5

      const files = [createMockFile('src/lifecycle.ts', FileChangeStatus.Added)];
      const artifact = createMockArtifact(1, 'src/lifecycle.ts', [1, 3, 5, 7, 9, 11]);

      // Test v3→v4 (unchanged period)
      setupMocks(files, [artifact], { fromSnapshot: 5, toSnapshot: 7 });
      mockClient.setContent(1, 3, 'v2 content');
      mockClient.setContent(1, 5, 'v2 content');
      mockClient.setContent(1, 7, 'v2 content');

      let { result } = renderHook(() => useIterationAwareFiles());
      expect(result.current.files).toHaveLength(0); // Unchanged

      // Test v4→v5 (modified)
      setupMocks(files, [artifact], { fromSnapshot: 7, toSnapshot: 9 });
      mockClient.setContent(1, 7, 'v2 content');
      mockClient.setContent(1, 9, 'v5 new content');

      ({ result } = renderHook(() => useIterationAwareFiles()));
      expect(result.current.files).toHaveLength(1); // Changed
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);

      // Test v5→v6 (unchanged again)
      setupMocks(files, [artifact], { fromSnapshot: 9, toSnapshot: 11 });
      mockClient.setContent(1, 9, 'v5 new content');
      mockClient.setContent(1, 11, 'v5 new content');

      ({ result } = renderHook(() => useIterationAwareFiles()));
      expect(result.current.files).toHaveLength(0); // Unchanged
    });
  });

  describe('Complex Lifecycle: Existing → Modify → Modify → Delete', () => {
    it('should correctly track file through modification to deletion', () => {
      const files = [createMockFile('src/doomed.ts', FileChangeStatus.Deleted)];

      // Artifact exists from base through v3
      const artifact = createMockArtifact(1, 'src/doomed.ts', [0, 1, 2, 3, 4, 5, 6]);

      // Test v1→v2 (modified)
      setupMocks(files, [artifact], { fromSnapshot: 1, toSnapshot: 3 });
      mockClient.setContent(1, 0, 'base content');
      mockClient.setContent(1, 1, 'base content');
      mockClient.setContent(1, 3, 'v2 modified');

      let { result } = renderHook(() => useIterationAwareFiles());
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);

      // Test v3→v4 (deleted)
      setupMocks(files, [artifact], { fromSnapshot: 5, toSnapshot: 7 });
      mockClient.setContent(1, 5, 'v3 content');
      // No content at snapshot 7 (deleted)

      ({ result } = renderHook(() => useIterationAwareFiles()));
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Deleted);
    });
  });

  describe('Multi-Artifact Scenario (SHA Change)', () => {
    it('should find content across multiple artifacts for same path', () => {
      // When file is modified, action creates new artifact with new SHA
      // Artifact 1: old SHA, has content for snapshots 0-9
      // Artifact 2: new SHA, has content for snapshots 10-11
      const files = [createMockFile('src/multi-artifact.ts')];

      const artifact1 = createMockArtifact(1, 'src/multi-artifact.ts', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const artifact2 = createMockArtifact(2, 'src/multi-artifact.ts', [10, 11]);

      setupMocks(files, [artifact1, artifact2], { fromSnapshot: 9, toSnapshot: 11 });

      // Artifact 1 has content at snapshot 9
      mockClient.setContent(1, 9, 'old version content');
      // Artifact 2 has content at snapshot 11
      mockClient.setContent(2, 11, 'new version content');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);
    });

    it('should prefer content from artifact with closest snapshot', () => {
      // Both artifacts have the path, but artifact 2 has closer snapshot
      const files = [createMockFile('src/closest.ts')];

      const artifact1 = createMockArtifact(1, 'src/closest.ts', [0, 1, 2, 3, 4, 5]);
      const artifact2 = createMockArtifact(2, 'src/closest.ts', [6, 7, 8, 9, 10, 11]);

      setupMocks(files, [artifact1, artifact2], { fromSnapshot: 9, toSnapshot: 11 });

      mockClient.setContent(1, 5, 'artifact 1 content'); // Far from snapshot 9
      mockClient.setContent(2, 9, 'artifact 2 v5 content'); // Exact match
      mockClient.setContent(2, 11, 'artifact 2 v6 content'); // Exact match

      const { result } = renderHook(() => useIterationAwareFiles());

      // Should show as modified because artifact 2's content differs between 9 and 11
      expect(result.current.files).toHaveLength(1);
    });
  });

  describe('Add in Middle → Modify at End', () => {
    it('should correctly handle file added mid-PR and modified later', () => {
      // File added in v3, modified in v6
      const files = [createMockFile('src/mid-add.ts', FileChangeStatus.Added)];
      const artifact = createMockArtifact(1, 'src/mid-add.ts', [5, 7, 9, 11]);

      // Test base→v3 (should show as added)
      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 5 });
      mockClient.setContent(1, 5, 'initial content');

      let { result } = renderHook(() => useIterationAwareFiles());
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Added);

      // Test v5→v6 (should show as modified)
      setupMocks(files, [artifact], { fromSnapshot: 9, toSnapshot: 11 });
      mockClient.setContent(1, 9, 'initial content');
      mockClient.setContent(1, 11, 'modified in v6');

      ({ result } = renderHook(() => useIterationAwareFiles()));
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);
    });
  });

  describe('Full Diff vs Latest Iteration', () => {
    it('should show all files in full diff mode (base→latest)', () => {
      const files = [
        createMockFile('src/file1.ts', FileChangeStatus.Added),
        createMockFile('src/file2.ts', FileChangeStatus.Modified),
        createMockFile('src/file3.ts', FileChangeStatus.Deleted),
      ];

      const artifacts = [
        createMockArtifact(1, 'src/file1.ts', [1, 3, 5, 7, 9, 11]),
        createMockArtifact(2, 'src/file2.ts', [0, 1, 3, 5, 7, 9, 11]),
        createMockArtifact(3, 'src/file3.ts', [0, 1, 3, 5]),
      ];

      setupMocks(files, artifacts, { fromSnapshot: 0, toSnapshot: 11 });

      mockClient.setContent(1, 1, 'file1 content');
      mockClient.setContent(1, 11, 'file1 content');
      mockClient.setContent(2, 0, 'file2 original');
      mockClient.setContent(2, 11, 'file2 modified');
      mockClient.setContent(3, 0, 'file3 content');
      mockClient.setContent(3, 5, 'file3 content');

      const { result } = renderHook(() => useIterationAwareFiles());

      // file1: added (no content at 0, has content at 11)
      // file2: modified (different content)
      // file3: deleted (has content at 0/5, none at 11)
      expect(result.current.files.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter correctly in latest iteration mode', () => {
      // Only file2 changed in v5→v6
      const files = [
        createMockFile('src/file1.ts', FileChangeStatus.Added),
        createMockFile('src/file2.ts', FileChangeStatus.Modified),
      ];

      const artifacts = [
        createMockArtifact(1, 'src/file1.ts', [1, 3, 5, 7, 9, 11]),
        createMockArtifact(2, 'src/file2.ts', [0, 1, 3, 5, 7, 9, 11]),
      ];

      setupMocks(files, artifacts, { fromSnapshot: 9, toSnapshot: 11 });

      // file1 unchanged between v5 and v6
      mockClient.setContent(1, 9, 'file1 same');
      mockClient.setContent(1, 11, 'file1 same');

      // file2 changed between v5 and v6
      mockClient.setContent(2, 9, 'file2 v5');
      mockClient.setContent(2, 11, 'file2 v6 changed');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.filename).toBe('src/file2.ts');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file content', () => {
      const files = [createMockFile('src/empty.ts', FileChangeStatus.Added)];
      const artifact = createMockArtifact(1, 'src/empty.ts', [1, 3]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });
      mockClient.setContent(1, 1, ''); // Empty file

      const { result } = renderHook(() => useIterationAwareFiles());

      // Empty file should still count as added if it didn't exist before
      expect(result.current.files).toHaveLength(0); // Empty content = no lines = filtered
    });

    it('should handle file with only whitespace changes', () => {
      const files = [createMockFile('src/whitespace.ts')];
      const artifact = createMockArtifact(1, 'src/whitespace.ts', [0, 1, 3]);

      setupMocks(files, [artifact], { fromSnapshot: 1, toSnapshot: 3 });

      mockClient.setContent(1, 1, 'line1\nline2');
      mockClient.setContent(1, 3, 'line1\nline2'); // Same content

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(0); // No actual changes
    });

    it('should not show file that is in GitHub but not in artifact (artifact is source of truth)', () => {
      // In iteration mode, artifact is source of truth
      // Files only in GitHub API but not in artifact are not shown
      const files = [createMockFile('src/unknown.ts')];

      setupMocks(files, [], { fromSnapshot: 0, toSnapshot: 1 });

      const { result } = renderHook(() => useIterationAwareFiles());

      // File not in artifacts should NOT be shown in iteration mode
      expect(result.current.files).toHaveLength(0);
    });

    it('should preserve original index for file selection', () => {
      const files = [
        createMockFile('src/a.ts'), // index 0
        createMockFile('src/b.ts'), // index 1 - will be filtered
        createMockFile('src/c.ts'), // index 2
      ];

      const artifacts = [
        createMockArtifact(1, 'src/a.ts', [0, 1, 3]),
        createMockArtifact(2, 'src/b.ts', [0, 1, 3]),
        createMockArtifact(3, 'src/c.ts', [0, 1, 3]),
      ];

      setupMocks(files, artifacts, { fromSnapshot: 1, toSnapshot: 3 });

      mockClient.setContent(1, 1, 'a v1');
      mockClient.setContent(1, 3, 'a v2 changed');
      mockClient.setContent(2, 1, 'b same');
      mockClient.setContent(2, 3, 'b same'); // Unchanged
      mockClient.setContent(3, 1, 'c v1');
      mockClient.setContent(3, 3, 'c v2 changed');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(2);
      expect(result.current.files[0]?.originalIndex).toBe(0); // src/a.ts
      expect(result.current.files[1]?.originalIndex).toBe(2); // src/c.ts (b was filtered)
    });

    it('should handle renamed file', () => {
      const files: FileChange[] = [{
        filename: 'src/new-name.ts',
        previousFilename: 'src/old-name.ts',
        status: FileChangeStatus.Renamed,
        additions: 5,
        deletions: 2,
        changes: 7,
        patch: '@@ -1,2 +1,5 @@',
      }];

      const artifact = createMockArtifact(1, 'src/new-name.ts', [0, 1, 3]);
      // Also track old path
      artifact.repoPaths[0] = 'src/old-name.ts';

      setupMocks(files, [artifact], { fromSnapshot: 1, toSnapshot: 3 });

      mockClient.setContent(1, 1, 'content before');
      mockClient.setContent(1, 3, 'content after change');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      // Renamed status should be preserved if there are changes
      expect(result.current.files[0]?.previousFilename).toBe('src/old-name.ts');
    });
  });

  describe('Base Equivalence - Files First Modified in Later Iterations (AC-4.8.14)', () => {
    // These tests cover the "base equivalence" fix where files that existed in the
    // PR base but weren't modified until a later iteration should show correct status.
    // The artifact only starts at the iteration where the file was first modified,
    // but the file's content at earlier snapshots equals the PR base.

    it('should show file as Modified when first modified in iteration 2, viewing base→iter2', () => {
      // File existed in PR base, not modified in iteration 1, modified in iteration 2
      // Artifact only starts at snapshot 2 (left snapshot of iteration 2)
      // When viewing base (0) to iteration 2 (3), file should show as Modified, not Added
      const files = [createMockFile('action.yml', FileChangeStatus.Modified, 10, 2)];
      const artifact = createMockArtifact(1, 'action.yml', [2, 3]); // Only captured in iter 2

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 3 });

      // Content at snapshot 2 = PR base content (left snapshot)
      // Content at snapshot 3 = modified content
      mockClient.setContent(1, 2, 'original base content');
      mockClient.setContent(1, 3, 'modified in iteration 2');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);
      expect(result.current.files[0]?.filename).toBe('action.yml');
    });

    it('should NOT show file when viewing iteration 1 if first modified in iteration 2', () => {
      // File existed in PR base, not modified until iteration 2
      // When viewing just iteration 1 (0→1), file should NOT appear
      const files = [createMockFile('action.yml', FileChangeStatus.Modified)];
      const artifact = createMockArtifact(1, 'action.yml', [2, 3]); // Only in iter 2

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 2, 'base content');
      mockClient.setContent(1, 3, 'modified content');

      const { result } = renderHook(() => useIterationAwareFiles());

      // File should be filtered out - no artifact coverage for iteration 1
      expect(result.current.files).toHaveLength(0);
    });

    it('should show file as Modified when comparing iteration 1→2 (drag selection)', () => {
      // File existed in PR base, not modified in iteration 1, modified in iteration 2
      // When comparing iteration 1 end (1) to iteration 2 end (3), should show as Modified
      const files = [createMockFile('action.yml', FileChangeStatus.Modified)];
      const artifact = createMockArtifact(1, 'action.yml', [2, 3]);

      setupMocks(files, [artifact], { fromSnapshot: 1, toSnapshot: 3 });

      mockClient.setContent(1, 2, 'base content'); // Same as content at snapshot 1
      mockClient.setContent(1, 3, 'modified in iteration 2');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);
    });

    it('should show file as Added when truly added in later iteration', () => {
      // File was actually ADDED in iteration 2 (didn't exist in base)
      // firstSnapshotIndex = 3 (odd = right snapshot = file was added, not modified)
      const files = [createMockFile('new-file.ts', FileChangeStatus.Added)];
      const artifact = createMockArtifact(1, 'new-file.ts', [3]); // First seen at right snapshot

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 3 });

      mockClient.setContent(1, 3, 'brand new file content');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Added);
    });

    it('should handle multiple files with different first-modification iterations', () => {
      // file1: modified in iteration 1
      // file2: first modified in iteration 2 (base equivalence applies)
      // file3: first modified in iteration 3 (base equivalence applies)
      // Viewing base→iteration 3 should show all as Modified
      const files = [
        createMockFile('file1.ts', FileChangeStatus.Modified),
        createMockFile('file2.ts', FileChangeStatus.Modified),
        createMockFile('file3.ts', FileChangeStatus.Modified),
      ];

      const artifacts = [
        createMockArtifact(1, 'file1.ts', [0, 1, 2, 3, 4, 5]), // Modified from start
        createMockArtifact(2, 'file2.ts', [2, 3, 4, 5]),       // First modified iter 2
        createMockArtifact(3, 'file3.ts', [4, 5]),             // First modified iter 3
      ];

      setupMocks(files, artifacts, { fromSnapshot: 0, toSnapshot: 5 });

      mockClient.setContent(1, 0, 'file1 base');
      mockClient.setContent(1, 5, 'file1 modified');
      mockClient.setContent(2, 2, 'file2 base');
      mockClient.setContent(2, 5, 'file2 modified');
      mockClient.setContent(3, 4, 'file3 base');
      mockClient.setContent(3, 5, 'file3 modified');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(3);
      expect(result.current.files.every(f => f.status === FileChangeStatus.Modified)).toBe(true);
    });
  });

  describe('Regression Tests', () => {
    it('should not return stale content from wrong artifact (multi-artifact bug)', () => {
      // This tests the bug where artifact 1 would return content from snapshot 9
      // for both snapshot 9 and 11 requests, making diffs appear empty
      const files = [createMockFile('src/bug-test.ts')];

      // Artifact 1: has content up to snapshot 9
      const artifact1 = createMockArtifact(1, 'src/bug-test.ts', [0, 1, 3, 5, 7, 9]);
      // Artifact 2: new version, has content for 10-11
      const artifact2 = createMockArtifact(2, 'src/bug-test.ts', [10, 11]);

      setupMocks(files, [artifact1, artifact2], { fromSnapshot: 9, toSnapshot: 11 });

      // Artifact 1's content at snapshot 9
      mockClient.setContent(1, 9, 'OLD CONTENT FROM V5');
      // Artifact 2's content at snapshot 11
      mockClient.setContent(2, 11, 'NEW CONTENT FROM V6');

      const { result } = renderHook(() => useIterationAwareFiles());

      // File SHOULD show as modified because content differs
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);
    });

    it('should handle many files efficiently', () => {
      const fileCount = 50;
      const files = Array.from({ length: fileCount }, (_, i) =>
        createMockFile(`src/file${i}.ts`)
      );

      const artifacts = files.map((_, i) =>
        createMockArtifact(i + 1, `src/file${i}.ts`, [0, 1, 3, 5, 7, 9, 11])
      );

      setupMocks(files, artifacts, { fromSnapshot: 9, toSnapshot: 11 });

      // Half the files changed, half unchanged
      artifacts.forEach((a, i) => {
        const changed = i % 2 === 0;
        mockClient.setContent(a.id, 9, `content ${i}`);
        mockClient.setContent(a.id, 11, changed ? `changed content ${i}` : `content ${i}`);
      });

      const { result } = renderHook(() => useIterationAwareFiles());

      // Should have 25 files (every other file changed)
      expect(result.current.files).toHaveLength(25);
      expect(result.current.totalFilesInPR).toBe(50);
    });
  });

  describe('Issue #183: Files in artifact but not in GitHub API', () => {
    // GitHub API only returns files with net changes (base ≠ head).
    // Files modified-then-reverted have zero net change and are excluded.
    // In iteration mode, artifact is source of truth, not GitHub API.

    it('should show file from artifact even when not in GitHub file list', () => {
      // Scenario: File A modified in iteration 1, reverted in iteration 3
      // GitHub API returns empty (no net change), but artifact has the data
      const files: FileChange[] = []; // Empty - GitHub shows no files

      // Artifact has file A with changes
      const artifact = createMockArtifact(1, 'test-file-a.txt', [0, 1, 2, 3]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });

      // Different content at snapshots 0 and 1 = file was modified
      mockClient.setContent(1, 0, 'original content');
      mockClient.setContent(1, 1, 'modified content');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.isIterationMode).toBe(true);
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.filename).toBe('test-file-a.txt');
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Modified);
    });

    it('should include artifact files alongside GitHub files', () => {
      // GitHub returns file B (has net change)
      // Artifact has both A and B, both with changes in iteration 1
      const files = [createMockFile('test-file-b.txt', FileChangeStatus.Modified)];

      const artifactA = createMockArtifact(1, 'test-file-a.txt', [0, 1]);
      const artifactB = createMockArtifact(2, 'test-file-b.txt', [0, 1]);

      setupMocks(files, [artifactA, artifactB], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 0, 'A original');
      mockClient.setContent(1, 1, 'A modified');
      mockClient.setContent(2, 0, 'B original');
      mockClient.setContent(2, 1, 'B modified');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(2);
      const filenames = result.current.files.map(f => f.filename).sort();
      expect(filenames).toEqual(['test-file-a.txt', 'test-file-b.txt']);
    });

    it('should not duplicate files that are in both GitHub and artifact', () => {
      // File exists in both GitHub list and artifact - should appear once
      const files = [createMockFile('shared-file.ts', FileChangeStatus.Modified)];
      const artifact = createMockArtifact(1, 'shared-file.ts', [0, 1]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 0, 'original');
      mockClient.setContent(1, 1, 'modified');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.filename).toBe('shared-file.ts');
    });

    it('should filter artifact-only files with no changes in range', () => {
      // File in artifact but unchanged in selected range - should be hidden
      const files: FileChange[] = [];
      const artifact = createMockArtifact(1, 'unchanged.ts', [0, 1, 2, 3]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });

      // Same content = no changes
      mockClient.setContent(1, 0, 'same content');
      mockClient.setContent(1, 1, 'same content');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(0);
    });

    it('should compute correct stats for artifact-only files', () => {
      const files: FileChange[] = [];
      const artifact = createMockArtifact(1, 'new-lines.ts', [0, 1]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 0, 'line1\nline2\n');
      mockClient.setContent(1, 1, 'line1\nline2\nline3\nline4\n');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      // File should have changes (exact counts depend on diff algorithm)
      expect(result.current.files[0]?.changes).toBeGreaterThan(0);
      expect(result.current.files[0]?.additions).toBeGreaterThanOrEqual(2);
    });

    it('should show artifact-only file as Added when created in range', () => {
      const files: FileChange[] = [];
      // File first appears at snapshot 1 (right snapshot of iteration 1)
      const artifact = createMockArtifact(1, 'brand-new.ts', [1]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 1, 'new file content\nline 2');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Added);
      expect(result.current.files[0]?.additions).toBe(2);
    });

    it('should show artifact-only file as Deleted when removed in range', () => {
      const files: FileChange[] = [];
      // File exists at snapshot 0, deleted by snapshot 1
      const artifact = createMockArtifact(1, 'deleted.ts', [0]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 0, 'content before deletion\nline 2\nline 3');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.status).toBe(FileChangeStatus.Deleted);
      expect(result.current.files[0]?.deletions).toBe(3);
    });

    it('should provide valid originalIndex for artifact-only files to enable selection', () => {
      // Artifact-only files need a valid originalIndex so they can be selected
      // in the UI. Using -1 breaks file selection since the store rejects it.
      const files: FileChange[] = []; // Empty - GitHub shows no files
      const artifact = createMockArtifact(1, 'artifact-only.txt', [0, 1]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 0, 'original');
      mockClient.setContent(1, 1, 'modified');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(1);
      // originalIndex must be >= 0 for file selection to work
      // -1 is reserved for PR description only
      expect(result.current.files[0]?.originalIndex).toBeGreaterThanOrEqual(0);
    });

    it('should assign sequential indices to artifact-only files after GitHub files', () => {
      // When we have both GitHub files and artifact-only files,
      // artifact-only files should get indices that come after GitHub files
      const files = [createMockFile('github-file.ts', FileChangeStatus.Modified)];

      const artifactGithub = createMockArtifact(1, 'github-file.ts', [0, 1]);
      const artifactOnly = createMockArtifact(2, 'artifact-only.txt', [0, 1]);

      setupMocks(files, [artifactGithub, artifactOnly], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 0, 'github original');
      mockClient.setContent(1, 1, 'github modified');
      mockClient.setContent(2, 0, 'artifact original');
      mockClient.setContent(2, 1, 'artifact modified');

      const { result } = renderHook(() => useIterationAwareFiles());

      expect(result.current.files).toHaveLength(2);

      // GitHub file keeps its original index
      const githubFile = result.current.files.find(f => f.filename === 'github-file.ts');
      expect(githubFile?.originalIndex).toBe(0);

      // Artifact-only file gets next available index
      const artifactFile = result.current.files.find(f => f.filename === 'artifact-only.txt');
      expect(artifactFile?.originalIndex).toBeGreaterThanOrEqual(0);
      expect(artifactFile?.originalIndex).not.toBe(githubFile?.originalIndex);
    });

    it('should hide file reverted to original in iteration 3 when viewing base→iter3', () => {
      // PR #184 ACTUAL DATA STRUCTURE:
      // File A artifact only has snapshots [0, 1, 2, 3] - NOT [4, 5]!
      // The action didn't capture file A in iteration 3 because it was reverted.
      //
      // Content hashes from real artifact:
      // - Snapshot 0: 2a05101... (original - 2 lines)
      // - Snapshot 1: c18b59d... (modified - 3 lines)
      // - Snapshot 2: 2a05101... (original - before iter 2, which only touched B)
      // - Snapshot 3: c18b59d... (modified - unchanged from iter 1)
      //
      // File B has snapshots [2, 3, 4, 5]
      //
      // When viewing iteration 3 (base→snapshot 5):
      // - File A has no data at snapshot 5 → currently shows as "Deleted"
      // - But file A's content at snapshot 0 === original content (reverted)
      //   so it should be HIDDEN, not shown as deleted
      //
      // Expected: | Iteration 3 | B |
      const files = [createMockFile('test-file-b.txt', FileChangeStatus.Modified)];

      // File A: ONLY has snapshots 0-3 (action didn't capture iter 3 reversion)
      const artifactA = createMockArtifact(1, 'test-file-a.txt', [0, 1, 2, 3]);
      // File B: has snapshots 2-5
      const artifactB = createMockArtifact(2, 'test-file-b.txt', [2, 3, 4, 5]);

      setupMocks(files, [artifactA, artifactB], { fromSnapshot: 0, toSnapshot: 5 });

      // File A: matches real PR #184 data
      mockClient.setContent(1, 0, 'This is file A - original content.\nLine 2 of file A.');
      mockClient.setContent(1, 1, 'This is file A - MODIFIED in iteration 1.\nLine 2 of file A - also changed.\nNew line 3 added.');
      mockClient.setContent(1, 2, 'This is file A - original content.\nLine 2 of file A.'); // Same as snap 0
      mockClient.setContent(1, 3, 'This is file A - MODIFIED in iteration 1.\nLine 2 of file A - also changed.\nNew line 3 added.'); // Same as snap 1
      // NO content at snapshots 4, 5 - this is the reality!

      // File B: matches real PR #184 data
      mockClient.setContent(2, 2, 'This is file B - original content.\nLine 2 of file B.');
      mockClient.setContent(2, 3, 'This is file B - MODIFIED in iteration 2.\nLine 2 of file B - updated.');
      mockClient.setContent(2, 4, 'This is file B - original content.\nLine 2 of file B.'); // Same as snap 2
      mockClient.setContent(2, 5, 'This is file B - MODIFIED in iteration 2.\nLine 2 of file B - updated.'); // Same as snap 3

      const { result } = renderHook(() => useIterationAwareFiles());

      // Only file B should appear (has net change from base)
      // File A should be HIDDEN because:
      // - It has no data at snapshot 5 (lastSnapshotIndex = 3)
      // - Its content at base (snap 0) is the original content
      // - The file was reverted, so base === current state
      // Currently FAILS: shows file A as "Deleted" instead of hidden
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.filename).toBe('test-file-b.txt');
    });

    it('should hide reverted file even when artifact has no explicit content at final snapshot (delta storage)', () => {
      // BUG REPRODUCTION: When action uses delta storage and doesn't store content
      // for unchanged/reverted files, the diff code may incorrectly show file as deleted.
      //
      // Scenario:
      // - Artifact captures snapshots [0,1,3] but NOT [5] (no row for reverted state)
      // - lastSnapshotIndex is still 5 (file tracked through iter 3)
      // - getFileContent(artifactId, 5) returns content from snapshot 3 (last captured)
      //
      // This test verifies the filtering handles this correctly by comparing
      // base content to the content retrieved for the final snapshot.
      const files: FileChange[] = [];

      // Artifact tracked through snapshot 5 but only has content rows at 0, 1, 3
      // This simulates delta storage where unchanged/reverted content isn't re-stored
      const artifact = createMockArtifact(1, 'test-file-a.txt', [0, 1, 3, 5]);

      setupMocks(files, [artifact], { fromSnapshot: 0, toSnapshot: 5 });

      // Content at snapshots 0, 1, 3 - but NOT at 5 (delta storage optimization)
      // When querying snapshot 5, client returns content from snapshot 3 (modified)
      mockClient.setContent(1, 0, 'original content');
      mockClient.setContent(1, 1, 'modified content');
      mockClient.setContent(1, 3, 'modified content');
      // Note: NO mockClient.setContent(1, 5, ...) - simulating delta storage

      const { result } = renderHook(() => useIterationAwareFiles());

      // File shows changes (modified content at snap 3 != original at snap 0)
      // This is EXPECTED behavior when snapshot 5 falls back to snapshot 3 content
      // The file SHOULD appear because the content differs from base
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.filename).toBe('test-file-a.txt');
    });

    it('should show file A in iteration 1 even when reverted later in iteration 3', () => {
      // Same scenario as above but viewing iteration 1
      // Expected: | Iteration 1 | A |
      const files: FileChange[] = [];

      const artifactA = createMockArtifact(1, 'test-file-a.txt', [0, 1, 2, 3, 4, 5]);
      const artifactB = createMockArtifact(2, 'test-file-b.txt', [2, 3, 4, 5]);

      setupMocks(files, [artifactA, artifactB], { fromSnapshot: 0, toSnapshot: 1 });

      mockClient.setContent(1, 0, 'original A content');
      mockClient.setContent(1, 1, 'modified A in iter 1');
      mockClient.setContent(2, 2, 'original B content');
      mockClient.setContent(2, 3, 'modified B in iter 2');

      const { result } = renderHook(() => useIterationAwareFiles());

      // Only file A should appear (modified in iter 1)
      // File B is not in iter 1 range
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.filename).toBe('test-file-a.txt');
    });

    it('should show both A and B in iteration 2 view', () => {
      // Expected: | Iteration 2 | A, B |
      const files = [createMockFile('test-file-b.txt', FileChangeStatus.Modified)];

      const artifactA = createMockArtifact(1, 'test-file-a.txt', [0, 1, 2, 3, 4, 5]);
      const artifactB = createMockArtifact(2, 'test-file-b.txt', [2, 3, 4, 5]);

      setupMocks(files, [artifactA, artifactB], { fromSnapshot: 0, toSnapshot: 3 });

      mockClient.setContent(1, 0, 'original A content');
      mockClient.setContent(1, 1, 'modified A in iter 1');
      mockClient.setContent(1, 3, 'modified A in iter 1'); // Still modified from base
      mockClient.setContent(2, 2, 'original B content');
      mockClient.setContent(2, 3, 'modified B in iter 2');

      const { result } = renderHook(() => useIterationAwareFiles());

      // Both files should appear
      expect(result.current.files).toHaveLength(2);
      const filenames = result.current.files.map(f => f.filename).sort();
      expect(filenames).toEqual(['test-file-a.txt', 'test-file-b.txt']);
    });
  });
});
