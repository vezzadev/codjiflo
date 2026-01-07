/**
 * Tests for useIterationStore
 *
 * These tests verify iteration loading and range selection,
 * particularly the fix for issue #133 where ranges are now
 * partitioned by PR to prevent cross-PR range conflicts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useIterationStore } from './useIterationStore';
import type { Iteration, ReviewFileArtifact, ArtifactReference } from '../types';

// Create mock implementations that will be controlled by tests
const mockLoad = vi.fn();
const mockGetIterations = vi.fn();
const mockGetAllArtifacts = vi.fn();
const mockClose = vi.fn();
const mockClearCache = vi.fn();

// Mock dependencies at module level
vi.mock('../artifact-loader', () => ({
  ArtifactLoader: class MockArtifactLoader {
    load = mockLoad;
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
    artifactName: 'codjiflo-iterations',
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
      isDegraded: false,
    });

    // Reset all mocks
    vi.clearAllMocks();
    mockLoad.mockReset();
    mockGetIterations.mockReset();
    mockGetAllArtifacts.mockReset();
    mockClose.mockReset();
    mockClearCache.mockReset();
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
      expect(state.isDegraded).toBe(false);
      expect(state.iterations).toHaveLength(3);
      expect(state.currentPrKey).toBe('owner/repo#1');
      // Default range should be base (0) to latest iteration's right snapshot
      // For 3 iterations, latest revision is 3, right snapshot = 2*3-1 = 5
      expect(state.selectedRanges['owner/repo#1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 5, // iterationToRightSnapshot(3) = 2*3-1 = 5
      });
      // selectedRange getter should return the current PR's range
      expect(state.selectedRange).toEqual({
        fromSnapshot: 0,
        toSnapshot: 5,
      });
    });

    it('should use default range when cached range is invalid (toSnapshot too high)', async () => {
      // Simulate a cached range from when this PR had more iterations
      useIterationStore.setState({
        selectedRanges: { 'owner/repo#1': { fromSnapshot: 0, toSnapshot: 11 } },
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
      expect(state.selectedRanges['owner/repo#1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 3, // iterationToRightSnapshot(2) = 2*2-1 = 3
      });
    });

    it('should use default range when cached range has invalid fromSnapshot', async () => {
      // Cached range with negative fromSnapshot
      useIterationStore.setState({
        selectedRanges: { 'owner/repo#1': { fromSnapshot: -1, toSnapshot: 3 } },
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
      expect(state.selectedRanges['owner/repo#1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 3,
      });
    });

    it('should use default range when fromSnapshot >= toSnapshot', async () => {
      // Invalid: fromSnapshot must be less than toSnapshot
      useIterationStore.setState({
        selectedRanges: { 'owner/repo#1': { fromSnapshot: 3, toSnapshot: 3 } },
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
      expect(state.selectedRanges['owner/repo#1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 3,
      });
    });

    it('should preserve valid cached range for this PR', async () => {
      // Valid cached range for this PR
      useIterationStore.setState({
        selectedRanges: { 'owner/repo#1': { fromSnapshot: 1, toSnapshot: 3 } },
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
      expect(state.selectedRanges['owner/repo#1']).toEqual({
        fromSnapshot: 1,
        toSnapshot: 3,
      });
    });

    it('should isolate ranges between different PRs', async () => {
      // Pre-set a range for PR #2
      useIterationStore.setState({
        selectedRanges: { 'owner/repo#2': { fromSnapshot: 0, toSnapshot: 11 } },
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
      expect(state.currentPrKey).toBe('owner/repo#1');
      expect(state.selectedRanges['owner/repo#1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 3,
      });
      // PR #2's range should still be preserved
      expect(state.selectedRanges['owner/repo#2']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 11,
      });
      // selectedRange getter should return PR #1's range
      expect(state.selectedRange).toEqual({
        fromSnapshot: 0,
        toSnapshot: 3,
      });
    });

    it('should handle degraded mode when no artifact found', async () => {
      mockLoad.mockResolvedValue(null);

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      expect(state.isDegraded).toBe(true);
      expect(state.iterations).toHaveLength(0);
      expect(state.currentPrKey).toBe('owner/repo#1');
      expect(state.selectedRange).toBeNull();
    });

    it('should handle loading errors', async () => {
      mockLoad.mockRejectedValue(new Error('Network error'));

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
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
      expect(state.selectedRanges['owner/repo#1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 5,
      });
      expect(state.selectedRange).toEqual({
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
      expect(useIterationStore.getState().selectedRanges['owner/repo#1']).toEqual({
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

      expect(useIterationStore.getState().selectedRanges['owner/repo#1']).toEqual({
        fromSnapshot: 0,
        toSnapshot: 5,
      });
    });

    it('should set latest iteration range for "latest" preset', () => {
      useIterationStore.getState().selectPreset('latest');

      // Latest = previous iteration end to latest end
      // For 3 iterations: prev is iter 2 (right snapshot = 3), latest is iter 3 (right snapshot = 5)
      expect(useIterationStore.getState().selectedRanges['owner/repo#1']).toEqual({
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
      expect(useIterationStore.getState().currentPrKey).toBe('owner/repo#1');

      // Reset
      useIterationStore.getState().reset();

      const state = useIterationStore.getState();
      expect(state.iterations).toHaveLength(0);
      expect(state.artifacts).toHaveLength(0);
      expect(state.selectedRanges).toEqual({});
      expect(state.currentPrKey).toBeNull();
      expect(state.selectedRange).toBeNull();
      expect(state.client).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isDegraded).toBe(false);
      expect(mockClose).toHaveBeenCalled();
      expect(mockClearCache).toHaveBeenCalled();
    });
  });

  describe('selectedRange property', () => {
    it('should return null when no PR is loaded', () => {
      const state = useIterationStore.getState();
      expect(state.currentPrKey).toBeNull();
      expect(state.selectedRange).toBeNull();
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
      // selectedRange should match the current PR's range
      expect(state.currentPrKey).toBe('owner/repo#2');
      expect(state.selectedRange).toEqual({
        fromSnapshot: 0,
        toSnapshot: 3,
      });
    });
  });
});
