/**
 * Tests for useIterationStore
 *
 * These tests verify iteration loading and range selection,
 * particularly the fix for issue #133 where ranges are now
 * partitioned by PR to prevent cross-PR range conflicts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useIterationStore, selectSelectedRange } from './useIterationStore';
import type { Iteration, ReviewFileArtifact, ArtifactReference } from '../types';

// Create mock implementations that will be controlled by tests
const mockLoad = vi.fn();
const mockFindArtifactReference = vi.fn();
const mockGetIterations = vi.fn();
const mockGetAllArtifacts = vi.fn();
const mockClose = vi.fn();
const mockClearCache = vi.fn();

// Mock dependencies at module level
vi.mock('../artifact-loader', () => ({
  ArtifactLoader: class MockArtifactLoader {
    load = mockLoad;
    findArtifactReference = mockFindArtifactReference;
  },
}));

vi.mock('../iteration-client', () => ({
  IterationClient: class MockIterationClient {
    getIterations = mockGetIterations;
    getAllArtifacts = mockGetAllArtifacts;
    close = mockClose;
  },
}));

vi.mock('../application', () => ({
  SpanTrackerService: class MockSpanTrackerService {
    clearCache = mockClearCache;
  },
}));

vi.mock('../infrastructure', () => ({
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Mock class for testing
  SQLiteSpanTrackerReader: class MockSQLiteSpanTrackerReader {},
}));

// Helper to create mock iterations
function createMockIterations(count: number): Iteration[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    revision: i + 1,
    createdAt: new Date(2024, 0, i + 1),
    headSha: `head-sha-${i + 1}`,
    baseSha: 'base-sha',
    beforeSha: i === 0 ? null : `head-sha-${i}`,
    author: 'test-user',
  }));
}

// Helper to create mock artifacts
function createMockArtifacts(): ReviewFileArtifact[] {
  return [
    {
      id: 1,
      changeTrackingId: 'sha-1',
      repoPaths: ['src/file1.ts', 'src/file1.ts', 'src/file1.ts'],
      firstSnapshotIndex: 0,
      lastSnapshotIndex: 2,
    },
  ];
}

// Helper to create mock reference
function createMockReference(): ArtifactReference {
  return {
    runId: 123,
    artifactId: 456789,
    timestamp: '2024-01-01T00:00:00Z',
    iterationCount: 2,
  };
}

describe('useIterationStore', () => {
  beforeEach(() => {
    // Reset store state before each test - clear ALL state
    useIterationStore.setState({
      iterations: [],
      artifacts: [],
      artifactTimestamp: null,
      artifactReference: null,
      currentPrKey: null,
      selectedRanges: {},
      client: null,
      spanTrackerService: null,
      isLoading: false,
      error: null,
      mode: 'stateful',
      statelessReason: null,
    });

    // Reset all mocks
    vi.clearAllMocks();
    mockLoad.mockReset();
    mockFindArtifactReference.mockReset();
    mockGetIterations.mockReset();
    mockGetAllArtifacts.mockReset();
    mockClose.mockReset();
    mockClearCache.mockReset();

    // Default: findArtifactReference returns the mock reference
    // Tests can override this when needed (e.g., for stateless mode)
    mockFindArtifactReference.mockResolvedValue(createMockReference());
  });

  describe('loadIterations', () => {
    it('should set default range when no cached range exists for this PR', async () => {
      const mockIterations = createMockIterations(3);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.mode).toBe('stateful');
      expect(state.iterations).toHaveLength(3);
      expect(state.currentPrKey).toBe('https://github.com/owner/repo/pull/1');
      // Default range uses the latest iteration's base to handle rebases correctly (issue #151)
      // For 3 iterations, latest revision is 3:
      // - left snapshot = (3-1)*2 = 4
      // - right snapshot = (3-1)*2+1 = 5
      expect(state.selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 4, // iterationToLeftSnapshot(3) = (3-1)*2 = 4
        toSnapshot: 5, // iterationToRightSnapshot(3) = (3-1)*2+1 = 5
      });
      // selectSelectedRange selector should return the current PR's range
      expect(selectSelectedRange(state)).toEqual({
        fromSnapshot: 4,
        toSnapshot: 5,
      });
    });

    it('should use default range when cached range is invalid (toSnapshot too high)', async () => {
      // Simulate a cached range from when this PR had more iterations
      useIterationStore.setState({
        selectedRanges: { 'https://github.com/owner/repo/pull/1': { fromSnapshot: 0, toSnapshot: 11 } },
      });

      const mockIterations = createMockIterations(2); // Only 2 iterations, max toSnapshot = 3
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      // Should use default range, not the invalid cached one
      // For 2 iterations: left = (2-1)*2 = 2, right = (2-1)*2+1 = 3
      expect(state.selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 2, // iterationToLeftSnapshot(2) = (2-1)*2 = 2
        toSnapshot: 3, // iterationToRightSnapshot(2) = (2-1)*2+1 = 3
      });
    });

    it('should use default range when cached range has invalid fromSnapshot', async () => {
      // Cached range with negative fromSnapshot
      useIterationStore.setState({
        selectedRanges: { 'https://github.com/owner/repo/pull/1': { fromSnapshot: -1, toSnapshot: 3 } },
      });

      const mockIterations = createMockIterations(2);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      // For 2 iterations: left = (2-1)*2 = 2, right = (2-1)*2+1 = 3
      expect(state.selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 2,
        toSnapshot: 3,
      });
    });

    it('should use default range when fromSnapshot >= toSnapshot', async () => {
      // Invalid: fromSnapshot must be less than toSnapshot
      useIterationStore.setState({
        selectedRanges: { 'https://github.com/owner/repo/pull/1': { fromSnapshot: 3, toSnapshot: 3 } },
      });

      const mockIterations = createMockIterations(2);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      // For 2 iterations: left = (2-1)*2 = 2, right = (2-1)*2+1 = 3
      expect(state.selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 2,
        toSnapshot: 3,
      });
    });

    it('should preserve valid cached range for this PR', async () => {
      // Valid cached range for this PR
      useIterationStore.setState({
        selectedRanges: { 'https://github.com/owner/repo/pull/1': { fromSnapshot: 1, toSnapshot: 3 } },
      });

      const mockIterations = createMockIterations(3); // max toSnapshot = 5
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      // Should preserve the valid cached range
      expect(state.selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 1,
        toSnapshot: 3,
      });
    });

    it('should isolate ranges between different PRs', async () => {
      // Pre-set a range for PR #2
      useIterationStore.setState({
        selectedRanges: { 'https://github.com/owner/repo/pull/2': { fromSnapshot: 0, toSnapshot: 11 } },
      });

      const mockIterations = createMockIterations(2);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      // Load PR #1 - should NOT be affected by PR #2's cached range
      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      // PR #1 should have its own default range
      // For 2 iterations: left = (2-1)*2 = 2, right = (2-1)*2+1 = 3
      expect(state.currentPrKey).toBe('https://github.com/owner/repo/pull/1');
      expect(state.selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 2,
        toSnapshot: 3,
      });
      // PR #2's range should still be preserved
      expect(state.selectedRanges['https://github.com/owner/repo/pull/2']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 11,
      });
      // selectSelectedRange selector should return PR #1's range
      expect(selectSelectedRange(state)).toEqual({
        fromSnapshot: 2,
        toSnapshot: 3,
      });
    });

    it('should handle stateless mode when no artifact found', async () => {
      mockLoad.mockResolvedValue(null);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      expect(state.mode).toBe('stateless');
      expect(state.iterations).toHaveLength(0);
      expect(state.currentPrKey).toBe('https://github.com/owner/repo/pull/1');
      expect(selectSelectedRange(state)).toBeNull();
    });

    it('should handle loading errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockLoad.mockRejectedValue(new Error('Network error'));

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load iterations')
      );
      consoleSpy.mockRestore();
    });

    it('should invalidate cached range with fromSnapshot:0 after rebase (issue #151)', async () => {
      // PRE-CONDITION: User previously visited this PR before the rebase
      // and the cached range has fromSnapshot: 0 (the old base)
      useIterationStore.setState({
        selectedRanges: {
          'https://github.com/owner/repo/pull/1': { fromSnapshot: 0, toSnapshot: 3 },
        },
      });

      // Simulate a rebase scenario where iterations have different base commits
      const mockIterations: Iteration[] = [
        {
          id: 1,
          revision: 1,
          createdAt: new Date(2024, 0, 1),
          headSha: 'head-sha-1',
          baseSha: 'old-base-sha', // Original base
          beforeSha: null,
          author: 'test-user',
        },
        {
          id: 2,
          revision: 2,
          createdAt: new Date(2024, 0, 2),
          headSha: 'head-sha-2',
          baseSha: 'new-base-sha', // Different base after rebase!
          beforeSha: 'head-sha-1',
          author: 'test-user',
        },
      ];
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      // The cached range (fromSnapshot: 0) should be INVALIDATED because:
      // - The latest iteration's left snapshot is 2 (not 0)
      // - This indicates a rebase occurred and snapshot 0 is now stale
      // For 2 iterations: left = (2-1)*2 = 2, right = (2-1)*2+1 = 3
      expect(state.selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 2, // Latest iteration's base, NOT the cached 0 (stale old base)
        toSnapshot: 3,
      });
    });

    it('should evict oldest entries when cache exceeds 50 PRs (LRU)', async () => {
      const mockIterations = createMockIterations(2);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      // Pre-populate cache with 50 PRs
      const initialRanges: Record<string, { fromSnapshot: number; toSnapshot: number }> = {};
      for (let i = 1; i <= 50; i++) {
        initialRanges[`https://github.com/old/repo/pull/${i}`] = { fromSnapshot: 0, toSnapshot: 1 };
      }
      useIterationStore.setState({ selectedRanges: initialRanges });

      // Load a new PR (51st entry)
      await useIterationStore.getState().loadIterations('new', 'repo', 999);

      const state = useIterationStore.getState();
      const keys = Object.keys(state.selectedRanges);

      // Should have exactly 50 entries (oldest evicted)
      expect(keys).toHaveLength(50);
      // Oldest entry should be gone
      expect(state.selectedRanges['https://github.com/old/repo/pull/1']).toBeUndefined();
      // Newest entry should exist
      expect(state.selectedRanges['https://github.com/new/repo/pull/999']).toBeDefined();
      // Second oldest should still exist
      expect(state.selectedRanges['https://github.com/old/repo/pull/2']).toBeDefined();
    });
  });

  describe('selectRange', () => {
    beforeEach(async () => {
      const mockIterations = createMockIterations(3);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);
    });

    it('should update selectedRanges for current PR', () => {
      useIterationStore.getState().selectRange(0, 5);

      const state = useIterationStore.getState();
      expect(state.selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 5,
      });
      expect(selectSelectedRange(state)).toEqual({
        fromSnapshot: 0,
        toSnapshot: 5,
      });
    });

    it('should reject range where fromSnapshot >= toSnapshot', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      // First set a valid range
      useIterationStore.getState().selectRange(0, 3);
      // Then try to set an invalid one
      useIterationStore.getState().selectRange(5, 3);

      // Should not change the existing range
      expect(useIterationStore.getState().selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 3,
      });

      consoleSpy.mockRestore();
    });

    it('should warn when no PR is loaded', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Reset to clear currentPrKey
      useIterationStore.setState({ currentPrKey: null, selectedRanges: {} });

      useIterationStore.getState().selectRange(0, 5);

      expect(consoleSpy).toHaveBeenCalledWith('Cannot select range: no PR is currently loaded');
      consoleSpy.mockRestore();
    });
  });

  describe('selectPreset', () => {
    beforeEach(async () => {
      const mockIterations = createMockIterations(3);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);
    });

    it('should set full range for "full" preset', () => {
      useIterationStore.getState().selectPreset('full');

      // For 3 iterations: left = (3-1)*2 = 4, right = (3-1)*2+1 = 5
      // Uses latest iteration's base to handle rebases correctly (issue #151)
      expect(useIterationStore.getState().selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 4,
        toSnapshot: 5,
      });
    });

    it('should set latest iteration range for "latest" preset', () => {
      useIterationStore.getState().selectPreset('latest');

      // Latest = previous iteration end to latest end
      // For 3 iterations: prev is iter 2 (right snapshot = 3), latest is iter 3 (right snapshot = 5)
      expect(useIterationStore.getState().selectedRanges['https://github.com/owner/repo/pull/1']).toEqual({
        fromSnapshot: 3,
        toSnapshot: 5,
      });
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      const mockIterations = createMockIterations(2);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      // Verify state was set
      expect(useIterationStore.getState().iterations).toHaveLength(2);
      expect(useIterationStore.getState().currentPrKey).toBe('https://github.com/owner/repo/pull/1');

      // Reset
      useIterationStore.getState().reset();

      const state = useIterationStore.getState();
      expect(state.iterations).toHaveLength(0);
      expect(state.artifacts).toHaveLength(0);
      expect(state.selectedRanges).toEqual({});
      expect(state.currentPrKey).toBeNull();
      expect(selectSelectedRange(state)).toBeNull();
      expect(state.client).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.mode).toBe('stateful');
      expect(mockClose).toHaveBeenCalled();
      expect(mockClearCache).toHaveBeenCalled();
    });
  });

  describe('selectSelectedRange selector', () => {
    it('should return null when no PR is loaded', () => {
      const state = useIterationStore.getState();
      expect(state.currentPrKey).toBeNull();
      expect(selectSelectedRange(state)).toBeNull();
    });

    it('should be set to current PR range when loading iterations', async () => {
      const mockIterations = createMockIterations(2);
      const mockArtifacts = createMockArtifacts();
      const mockDb = {};

      mockLoad.mockResolvedValue({
        db: mockDb,
        reference: createMockReference(),
      });
      mockGetIterations.mockReturnValue(mockIterations);
      mockGetAllArtifacts.mockReturnValue(mockArtifacts);

      await useIterationStore.getState().loadIterations('owner', 'repo', 2);

      const state = useIterationStore.getState();
      // selectSelectedRange should return the current PR's range
      // For 2 iterations: left = (2-1)*2 = 2, right = (2-1)*2+1 = 3
      expect(state.currentPrKey).toBe('https://github.com/owner/repo/pull/2');
      expect(selectSelectedRange(state)).toEqual({
        fromSnapshot: 2,
        toSnapshot: 3,
      });
    });
  });
});
