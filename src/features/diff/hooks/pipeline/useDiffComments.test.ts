/**
 * Tests for useDiffComments hook.
 *
 * Key behavior: threads with line === null (outdated/unmappable comments)
 * should NOT be included in threadsByLineAndSide map.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDiffComments } from './useDiffComments';
import type { DiffNavigationOutput } from './types';
import type { ReviewThread } from '@/features/comments';

// Mock store state
let mockThreads: ReviewThread[] = [];

vi.mock('@/features/comments', () => ({
  useCommentsStore: vi.fn(() => ({
    threads: mockThreads,
  })),
}));

// Minimal navigation output for testing
const createNavigation = (filename: string | null): DiffNavigationOutput =>
  ({
    filename,
    // Other fields from navigation output are spread through
  }) as DiffNavigationOutput;

// Helper to create a thread
function createThread(
  overrides: Partial<ReviewThread> & { id: string; path: string }
): ReviewThread {
  return {
    line: 10,
    side: 'RIGHT',
    isResolved: false,
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
      },
    ],
    ...overrides,
  };
}

describe('useDiffComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThreads = [];
  });

  describe('threadsByLineAndSide mapping', () => {
    it('includes threads with valid line numbers', () => {
      mockThreads = [
        createThread({ id: 'thread-1', path: 'src/file.ts', line: 10 }),
        createThread({ id: 'thread-2', path: 'src/file.ts', line: 20, side: 'LEFT' }),
      ];

      const { result } = renderHook(() =>
        useDiffComments(createNavigation('src/file.ts'))
      );

      expect(result.current.threadsByLineAndSide.size).toBe(2);
      expect(result.current.threadsByLineAndSide.has('10-RIGHT')).toBe(true);
      expect(result.current.threadsByLineAndSide.has('20-LEFT')).toBe(true);
    });

    it('excludes threads with null line (outdated/unmappable comments)', () => {
      mockThreads = [
        createThread({ id: 'thread-1', path: 'src/file.ts', line: null }),
      ];

      const { result } = renderHook(() =>
        useDiffComments(createNavigation('src/file.ts'))
      );

      // Thread with null line should NOT be in the map
      expect(result.current.threadsByLineAndSide.size).toBe(0);
    });

    it('includes valid threads but excludes null-line threads from same file', () => {
      mockThreads = [
        createThread({ id: 'thread-1', path: 'src/file.ts', line: 10 }),
        createThread({ id: 'thread-2', path: 'src/file.ts', line: null }),
        createThread({ id: 'thread-3', path: 'src/file.ts', line: 30 }),
      ];

      const { result } = renderHook(() =>
        useDiffComments(createNavigation('src/file.ts'))
      );

      // Only threads with valid lines should be included
      expect(result.current.threadsByLineAndSide.size).toBe(2);
      expect(result.current.threadsByLineAndSide.has('10-RIGHT')).toBe(true);
      expect(result.current.threadsByLineAndSide.has('30-RIGHT')).toBe(true);
    });

    it('returns empty map when all threads have null lines', () => {
      mockThreads = [
        createThread({ id: 'thread-1', path: 'src/file.ts', line: null }),
        createThread({ id: 'thread-2', path: 'src/file.ts', line: null, side: 'LEFT' }),
      ];

      const { result } = renderHook(() =>
        useDiffComments(createNavigation('src/file.ts'))
      );

      // All threads have null lines, map should be empty
      expect(result.current.threadsByLineAndSide.size).toBe(0);
    });

    it('treats line 0 as valid (distinct from null)', () => {
      // line: 0 is technically valid (though unusual), only null should be filtered
      mockThreads = [
        createThread({ id: 'thread-1', path: 'src/file.ts', line: 0 }),
      ];

      const { result } = renderHook(() =>
        useDiffComments(createNavigation('src/file.ts'))
      );

      // line: 0 is NOT null, so it should be included
      expect(result.current.threadsByLineAndSide.size).toBe(1);
      expect(result.current.threadsByLineAndSide.has('0-RIGHT')).toBe(true);
    });
  });

  describe('file filtering', () => {
    it('only includes threads for the current file', () => {
      mockThreads = [
        createThread({ id: 'thread-1', path: 'src/file.ts', line: 10 }),
        createThread({ id: 'thread-2', path: 'src/other.ts', line: 20 }),
      ];

      const { result } = renderHook(() =>
        useDiffComments(createNavigation('src/file.ts'))
      );

      expect(result.current.threadsByLineAndSide.size).toBe(1);
      expect(result.current.threadsByLineAndSide.has('10-RIGHT')).toBe(true);
    });

    it('returns empty map when filename is null', () => {
      mockThreads = [
        createThread({ id: 'thread-1', path: 'src/file.ts', line: 10 }),
      ];

      const { result } = renderHook(() => useDiffComments(createNavigation(null)));

      expect(result.current.threadsByLineAndSide.size).toBe(0);
    });
  });
});
