/**
 * Tests for useCommentTracking hook.
 *
 * Tests position tracking for outdated comments using SpanTracker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCommentTracking } from './useCommentTracking';
import type { ReviewThread } from '../types';

// Mock store state
let mockThreads: ReviewThread[] = [];
let mockUpdateTrackedPositions: ReturnType<typeof vi.fn>;

// Mock iteration store state
let mockIterations: { revision: number; headSha: string }[] = [];
let mockMode: 'stateful' | 'stateless' = 'stateful';
let mockArtifacts: { id: number; repoPaths: (string | null)[] }[] = [];
let mockSelectedRange: { fromSnapshot: number; toSnapshot: number } | null = null;
let mockSpanTrackerService: {
  trackCommentForward: ReturnType<typeof vi.fn>;
} | null = null;

vi.mock('../stores', () => ({
  useCommentsStore: vi.fn(() => ({
    threads: mockThreads,
    updateTrackedPositions: mockUpdateTrackedPositions,
  })),
}));

vi.mock('@/features/iterations/stores', () => ({
  useIterationStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      iterations: mockIterations,
      mode: mockMode,
      artifacts: mockArtifacts,
      getSpanTrackerService: () => mockSpanTrackerService,
    };
    if (selector) {
      return selector(state);
    }
    return state;
  }),
  selectSelectedRange: (state: { selectedRange?: typeof mockSelectedRange }) =>
    state.selectedRange ?? mockSelectedRange,
}));

vi.mock('@/features/iterations/domain', () => ({
  singleLine: (line: number) => ({ startLine: line, endLine: line }),
}));

// Helper to create a thread
function createThread(
  overrides: Partial<ReviewThread> & { id: string; path: string }
): ReviewThread {
  return {
    line: 10,
    side: 'RIGHT',
    isResolved: false,
    originalLine: overrides.line ?? 10,
    originalCommitId: 'abc123',
    trackedLine: null,
    comments: [
      {
        id: 'comment-1',
        body: 'Test comment',
        author: { id: '1', login: 'user', avatarUrl: 'https://example.com' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        path: overrides.path,
        line: overrides.line ?? 10,
        side: overrides.side ?? 'RIGHT',
        position: 1,
        originalLine: overrides.line ?? 10,
        originalCommitId: 'abc123',
      },
    ],
    ...overrides,
  };
}

describe('useCommentTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThreads = [];
    mockIterations = [];
    mockMode = 'stateful';
    mockArtifacts = [];
    mockSelectedRange = null;
    mockSpanTrackerService = null;
    mockUpdateTrackedPositions = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('stateless mode', () => {
    it('does nothing in stateless mode', () => {
      mockMode = 'stateless';
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      expect(mockUpdateTrackedPositions).not.toHaveBeenCalled();
    });
  });

  describe('early exit conditions', () => {
    it('does nothing when no selected range', () => {
      mockMode = 'stateful';
      mockSelectedRange = null;
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      expect(mockUpdateTrackedPositions).not.toHaveBeenCalled();
    });

    it('does nothing when no iterations loaded', () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [];
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      expect(mockUpdateTrackedPositions).not.toHaveBeenCalled();
    });

    it('does nothing when no SpanTracker service', () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'abc123' }];
      mockSpanTrackerService = null;
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      expect(mockUpdateTrackedPositions).not.toHaveBeenCalled();
    });

    it('does nothing when no threads need tracking', () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'abc123' }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn(),
      };
      // Thread has valid line - doesn't need tracking
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: 10,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      expect(mockSpanTrackerService.trackCommentForward).not.toHaveBeenCalled();
      expect(mockUpdateTrackedPositions).not.toHaveBeenCalled();
    });
  });

  describe('position tracking', () => {
    it('tracks outdated comments and updates store', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'abc123' }];
      mockArtifacts = [{ id: 1, repoPaths: ['src/file.ts'] }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn().mockResolvedValue({ startLine: 15, endLine: 15 }),
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null, // Outdated
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      await waitFor(() => {
        expect(mockSpanTrackerService?.trackCommentForward).toHaveBeenCalledWith(
          1, // artifactId
          1, // originalSnapshot (revision 1 -> (1-1)*2+1 = 1)
          { startLine: 10, endLine: 10 }, // originalSpan
          1 // targetSnapshot
        );
        expect(mockUpdateTrackedPositions).toHaveBeenCalledWith(
          new Map([['thread-1', 15]])
        );
      });
    });

    it('sets trackedLine to null when line was deleted', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'abc123' }];
      mockArtifacts = [{ id: 1, repoPaths: ['src/file.ts'] }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn().mockResolvedValue(null), // Line deleted
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      await waitFor(() => {
        expect(mockUpdateTrackedPositions).toHaveBeenCalledWith(
          new Map([['thread-1', null]])
        );
      });
    });

    it('sets trackedLine to null when artifact not found', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'abc123' }];
      mockArtifacts = []; // No artifacts
      mockSpanTrackerService = {
        trackCommentForward: vi.fn(),
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      await waitFor(() => {
        expect(mockUpdateTrackedPositions).toHaveBeenCalledWith(
          new Map([['thread-1', null]])
        );
      });
      expect(mockSpanTrackerService.trackCommentForward).not.toHaveBeenCalled();
    });

    it('sets trackedLine to null when commit not found in iterations', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'different-sha' }]; // Different SHA
      mockArtifacts = [{ id: 1, repoPaths: ['src/file.ts'] }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn(),
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123', // Not in iterations
        }),
      ];

      renderHook(() => useCommentTracking());

      await waitFor(() => {
        expect(mockUpdateTrackedPositions).toHaveBeenCalledWith(
          new Map([['thread-1', null]])
        );
      });
      expect(mockSpanTrackerService.trackCommentForward).not.toHaveBeenCalled();
    });

    it('handles SpanTracker errors gracefully', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'abc123' }];
      mockArtifacts = [{ id: 1, repoPaths: ['src/file.ts'] }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn().mockRejectedValue(new Error('SpanTracker error')),
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      renderHook(() => useCommentTracking());

      await waitFor(() => {
        expect(mockUpdateTrackedPositions).toHaveBeenCalledWith(
          new Map([['thread-1', null]])
        );
      });
    });
  });

  describe('caching', () => {
    it('does not recompute when cache key is unchanged', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'abc123' }];
      mockArtifacts = [{ id: 1, repoPaths: ['src/file.ts'] }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn().mockResolvedValue({ startLine: 15, endLine: 15 }),
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      const { rerender } = renderHook(() => useCommentTracking());

      await waitFor(() => {
        expect(mockUpdateTrackedPositions).toHaveBeenCalledTimes(1);
      });

      // Rerender with same state - should not recompute
      act(() => {
        rerender();
      });

      // Still only called once
      expect(mockUpdateTrackedPositions).toHaveBeenCalledTimes(1);
    });

    it('recomputes when selectedRange changes', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [
        { revision: 1, headSha: 'abc123' },
        { revision: 2, headSha: 'def456' },
      ];
      mockArtifacts = [{ id: 1, repoPaths: ['src/file.ts'] }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn().mockResolvedValue({ startLine: 15, endLine: 15 }),
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'abc123',
        }),
      ];

      const { rerender } = renderHook(() => useCommentTracking());

      await waitFor(() => {
        expect(mockUpdateTrackedPositions).toHaveBeenCalledTimes(1);
      });

      // Change selected range
      mockSelectedRange = { fromSnapshot: 2, toSnapshot: 3 };

      act(() => {
        rerender();
      });

      await waitFor(() => {
        expect(mockUpdateTrackedPositions).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('findSnapshotForCommit logic', () => {
    it('correctly computes snapshot index for revision 1', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 0, toSnapshot: 1 };
      mockIterations = [{ revision: 1, headSha: 'rev1-sha' }];
      mockArtifacts = [{ id: 1, repoPaths: ['src/file.ts'] }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn().mockResolvedValue({ startLine: 20, endLine: 20 }),
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'rev1-sha',
        }),
      ];

      renderHook(() => useCommentTracking());

      await waitFor(() => {
        // Revision 1 -> right snapshot = (1-1)*2+1 = 1
        expect(mockSpanTrackerService?.trackCommentForward).toHaveBeenCalledWith(
          1, 1, { startLine: 10, endLine: 10 }, 1
        );
      });
    });

    it('correctly computes snapshot index for revision 3', async () => {
      mockMode = 'stateful';
      mockSelectedRange = { fromSnapshot: 4, toSnapshot: 5 };
      mockIterations = [
        { revision: 1, headSha: 'rev1-sha' },
        { revision: 2, headSha: 'rev2-sha' },
        { revision: 3, headSha: 'rev3-sha' },
      ];
      mockArtifacts = [{ id: 1, repoPaths: ['src/file.ts'] }];
      mockSpanTrackerService = {
        trackCommentForward: vi.fn().mockResolvedValue({ startLine: 25, endLine: 25 }),
      };
      mockThreads = [
        createThread({
          id: 'thread-1',
          path: 'src/file.ts',
          line: null,
          originalLine: 10,
          originalCommitId: 'rev3-sha',
        }),
      ];

      renderHook(() => useCommentTracking());

      await waitFor(() => {
        // Revision 3 -> right snapshot = (3-1)*2+1 = 5
        expect(mockSpanTrackerService?.trackCommentForward).toHaveBeenCalledWith(
          1, 5, { startLine: 10, endLine: 10 }, 5
        );
      });
    });
  });
});
