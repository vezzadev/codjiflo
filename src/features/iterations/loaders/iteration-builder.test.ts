/**
 * Tests for Iteration Builder (Task 1.5)
 *
 * Tests building StatelessIterationData from commits and force-push events:
 * - Sequential revision numbering
 * - Discarded commit marking with collapsed groups
 * - Handling force-pushes when discarded commits are unavailable
 * - OTel tracing instrumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import type { ForcePushEvent, StatelessIterationData } from '../types';
import type { PRCommit } from './commit-loader';

// Create a reusable mock span factory
function createMockSpan() {
  return {
    setAttribute: vi.fn(),
    addEvent: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
    getContext: vi.fn().mockReturnValue({ traceId: 'test-trace', spanId: 'test-span' }),
  };
}

// Mock the tracing module
vi.mock('@/lib/tracing', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/tracing')>();
  return {
    ...original,
    tracer: {
      startSpan: vi.fn(() => createMockSpan()),
    },
  };
});

import { buildStatelessIterations } from './iteration-builder';
import { tracer } from '@/lib/tracing';

/**
 * Create a mock PRCommit for testing
 */
function createCommit(
  sha: string,
  createdAt: Date,
  options?: {
    message?: string;
    author?: string;
    parentSha?: string;
  }
): PRCommit {
  const commit: PRCommit = {
    sha,
    message: options?.message ?? `Commit ${sha.slice(0, 7)}`,
    author: options?.author ?? 'testuser',
    createdAt,
  };

  if (options?.parentSha) {
    commit.parentSha = options.parentSha;
  }

  return commit;
}

/**
 * Create a mock ForcePushEvent for testing
 */
function createForcePush(
  beforeSha: string,
  afterSha: string,
  timestamp: Date,
  actor = 'testuser'
): ForcePushEvent {
  return {
    beforeSha,
    afterSha,
    timestamp,
    actor,
  };
}

describe('buildStatelessIterations', () => {
  let consoleSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('creates iterations from commits with sequential revision numbers', () => {
      const commits = [
        createCommit('abc123', new Date('2024-01-15T10:00:00Z')),
        createCommit('def456', new Date('2024-01-15T11:00:00Z')),
        createCommit('ghi789', new Date('2024-01-15T12:00:00Z')),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');

      expect(result.iterations).toHaveLength(3);
      expect(result.iterations[0]?.revision).toBe(1);
      expect(result.iterations[1]?.revision).toBe(2);
      expect(result.iterations[2]?.revision).toBe(3);
    });

    it('preserves commit data in iterations', () => {
      const commits = [
        createCommit('abc123', new Date('2024-01-15T10:00:00Z'), {
          message: 'Fix bug',
          author: 'developer',
          parentSha: 'parent1',
        }),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');

      expect(result.iterations).toHaveLength(1);
      const iteration = result.iterations[0];
      expect(iteration).toBeDefined();
      expect(iteration?.commitSha).toBe('abc123');
      expect(iteration?.message).toBe('Fix bug');
      expect(iteration?.author).toBe('developer');
      expect(iteration?.createdAt).toEqual(new Date('2024-01-15T10:00:00Z'));
    });

    it('sets lineage to current for live commits', () => {
      const commits = [
        createCommit('abc123', new Date('2024-01-15T10:00:00Z')),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');

      expect(result.iterations[0]?.lineage).toBe('current');
    });

    it('uses prBaseSha as baseSha for first iteration', () => {
      const commits = [
        createCommit('abc123', new Date('2024-01-15T10:00:00Z'), { parentSha: 'parent1' }),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');

      expect(result.iterations[0]?.baseSha).toBe('base000');
    });

    it('uses previous commit sha as baseSha for subsequent iterations', () => {
      const commits = [
        createCommit('abc123', new Date('2024-01-15T10:00:00Z')),
        createCommit('def456', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');

      expect(result.iterations[1]?.baseSha).toBe('abc123');
    });

    it('returns empty iterations and collapsedGroups when no commits', () => {
      const result = buildStatelessIterations([], [], 'base000');

      expect(result.iterations).toEqual([]);
      expect(result.collapsedGroups).toEqual([]);
    });
  });

  describe('commit sorting', () => {
    it('sorts commits by createdAt timestamp', () => {
      const commits = [
        createCommit('third', new Date('2024-01-15T12:00:00Z')),
        createCommit('first', new Date('2024-01-15T10:00:00Z')),
        createCommit('second', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');

      expect(result.iterations[0]?.commitSha).toBe('first');
      expect(result.iterations[1]?.commitSha).toBe('second');
      expect(result.iterations[2]?.commitSha).toBe('third');
    });

    it('maintains sequential revision numbers after sorting', () => {
      const commits = [
        createCommit('c', new Date('2024-01-15T12:00:00Z')),
        createCommit('a', new Date('2024-01-15T10:00:00Z')),
        createCommit('b', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');

      expect(result.iterations[0]?.revision).toBe(1);
      expect(result.iterations[1]?.revision).toBe(2);
      expect(result.iterations[2]?.revision).toBe(3);
    });
  });

  describe('discarded commits handling', () => {
    it('includes discarded commits with lineage: discarded', () => {
      const liveCommits = [
        createCommit('new123', new Date('2024-01-15T12:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('old123', new Date('2024-01-15T10:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old123', 'new123', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      const discardedIteration = result.iterations.find(i => i.commitSha === 'old123');
      expect(discardedIteration).toBeDefined();
      expect(discardedIteration?.lineage).toBe('discarded');
    });

    it('assigns collapsedGroupId to discarded commits', () => {
      const liveCommits = [
        createCommit('new123', new Date('2024-01-15T12:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('old123', new Date('2024-01-15T10:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old123', 'new123', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      const discardedIteration = result.iterations.find(i => i.commitSha === 'old123');
      expect(discardedIteration?.collapsedGroupId).toBeDefined();
    });

    it('combines and sorts live and discarded commits by createdAt', () => {
      const liveCommits = [
        createCommit('live1', new Date('2024-01-15T10:00:00Z')),
        createCommit('live2', new Date('2024-01-15T14:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('disc1', new Date('2024-01-15T11:00:00Z')),
        createCommit('disc2', new Date('2024-01-15T12:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('disc2', 'live2', new Date('2024-01-15T13:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      expect(result.iterations.map(i => i.commitSha)).toEqual([
        'live1',  // 10:00
        'disc1',  // 11:00
        'disc2',  // 12:00
        'live2',  // 14:00
      ]);
    });
  });

  describe('CollapsedIterationGroup creation', () => {
    it('creates CollapsedIterationGroup for each force-push event', () => {
      const liveCommits = [
        createCommit('new1', new Date('2024-01-15T12:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('old1', new Date('2024-01-15T10:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old1', 'new1', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      expect(result.collapsedGroups).toHaveLength(1);
      const group = result.collapsedGroups[0];
      expect(group?.beforeSha).toBe('old1');
      expect(group?.afterSha).toBe('new1');
      expect(group?.visibility).toBe('collapsed');
    });

    it('populates group iterations with matching discarded commits', () => {
      const liveCommits = [
        createCommit('new1', new Date('2024-01-15T14:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('old1', new Date('2024-01-15T10:00:00Z')),
        createCommit('old2', new Date('2024-01-15T11:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old2', 'new1', new Date('2024-01-15T13:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      expect(result.collapsedGroups).toHaveLength(1);
      const group = result.collapsedGroups[0];
      expect(group?.iterations).toHaveLength(2);
      expect(group?.iterations.map(i => i.commitSha)).toEqual(['old1', 'old2']);
    });

    it('handles multiple force-push events', () => {
      const liveCommits = [
        createCommit('new2', new Date('2024-01-15T17:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('old1', new Date('2024-01-15T10:00:00Z')),
        createCommit('new1', new Date('2024-01-15T12:00:00Z')),
        createCommit('old2', new Date('2024-01-15T14:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old1', 'new1', new Date('2024-01-15T11:00:00Z')),
        createForcePush('old2', 'new2', new Date('2024-01-15T16:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      expect(result.collapsedGroups).toHaveLength(2);
    });

    it('sorts force-push events by timestamp', () => {
      const liveCommits = [
        createCommit('latest', new Date('2024-01-15T20:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('d1', new Date('2024-01-15T10:00:00Z')),
        createCommit('d2', new Date('2024-01-15T14:00:00Z')),
      ];
      const forcePushEvents = [
        // Intentionally out of order
        createForcePush('d2', 'latest', new Date('2024-01-15T18:00:00Z')),
        createForcePush('d1', 'd2', new Date('2024-01-15T12:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      // Groups should be in timestamp order
      expect(result.collapsedGroups[0]?.beforeSha).toBe('d1');
      expect(result.collapsedGroups[1]?.beforeSha).toBe('d2');
    });
  });

  describe('unavailable commits handling', () => {
    it('sets unavailableReason when force-push events exist but no discardedCommits provided', () => {
      const liveCommits = [
        createCommit('new1', new Date('2024-01-15T12:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old1', 'new1', new Date('2024-01-15T11:00:00Z')),
      ];

      // No discardedCommits provided
      const result = buildStatelessIterations(liveCommits, forcePushEvents, 'base000');

      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]?.unavailableReason).toBe('commits_unavailable');
      expect(result.collapsedGroups[0]?.iterations).toEqual([]);
    });

    it('sets unavailableReason when discardedCommits is empty array', () => {
      const liveCommits = [
        createCommit('new1', new Date('2024-01-15T12:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old1', 'new1', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(liveCommits, forcePushEvents, 'base000', []);

      expect(result.collapsedGroups[0]?.unavailableReason).toBe('commits_unavailable');
    });

    it('does not set unavailableReason when discardedCommits are provided', () => {
      const liveCommits = [
        createCommit('new1', new Date('2024-01-15T12:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('old1', new Date('2024-01-15T10:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old1', 'new1', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      expect(result.collapsedGroups[0]?.unavailableReason).toBeUndefined();
    });

    it('does not create collapsedGroups when no force-push events', () => {
      const liveCommits = [
        createCommit('commit1', new Date('2024-01-15T10:00:00Z')),
        createCommit('commit2', new Date('2024-01-15T11:00:00Z')),
      ];

      const result = buildStatelessIterations(liveCommits, [], 'base000');

      expect(result.collapsedGroups).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('handles single commit', () => {
      const commits = [createCommit('only1', new Date('2024-01-15T10:00:00Z'))];

      const result = buildStatelessIterations(commits, [], 'base000');

      expect(result.iterations).toHaveLength(1);
      expect(result.iterations[0]?.revision).toBe(1);
      expect(result.iterations[0]?.baseSha).toBe('base000');
    });

    it('handles commits with identical timestamps', () => {
      const sameTime = new Date('2024-01-15T10:00:00Z');
      const commits = [
        createCommit('aaa', sameTime),
        createCommit('bbb', sameTime),
        createCommit('ccc', sameTime),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');

      // Should have 3 iterations with unique revisions
      expect(result.iterations).toHaveLength(3);
      const revisions = result.iterations.map(i => i.revision);
      expect(new Set(revisions).size).toBe(3);
    });

    it('handles force-push that replaces multiple commits', () => {
      const liveCommits = [
        createCommit('squashed', new Date('2024-01-15T15:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('c1', new Date('2024-01-15T10:00:00Z')),
        createCommit('c2', new Date('2024-01-15T11:00:00Z')),
        createCommit('c3', new Date('2024-01-15T12:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('c3', 'squashed', new Date('2024-01-15T14:00:00Z')),
      ];

      const result = buildStatelessIterations(
        liveCommits,
        forcePushEvents,
        'base000',
        discardedCommits
      );

      expect(result.collapsedGroups[0]?.iterations).toHaveLength(3);
    });
  });

  describe('OTel tracing', () => {
    it('starts a span with correct name', () => {
      const commits = [createCommit('abc123', new Date('2024-01-15T10:00:00Z'))];

      buildStatelessIterations(commits, [], 'base000');

      // Verify the mocked tracer was called with expected attributes
      const mockedTracer = vi.mocked(tracer);
      const calls = mockedTracer.startSpan.mock.calls;
      expect(calls).toHaveLength(1);
      const [name, attributes] = calls[0] ?? [];
      expect(name).toBe('buildStatelessIterations');
      expect(attributes).toBeDefined();
    });

    it('records iteration and group counts in span', () => {
      const mockSpan = createMockSpan();
      vi.mocked(tracer).startSpan.mockReturnValue(mockSpan);

      const liveCommits = [
        createCommit('new1', new Date('2024-01-15T12:00:00Z')),
      ];
      const discardedCommits = [
        createCommit('old1', new Date('2024-01-15T10:00:00Z')),
      ];
      const forcePushEvents = [
        createForcePush('old1', 'new1', new Date('2024-01-15T11:00:00Z')),
      ];

      buildStatelessIterations(liveCommits, forcePushEvents, 'base000', discardedCommits);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('iteration.count', 2);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('collapsed_group.count', 1);
    });

    it('ends span with ok status', () => {
      const mockSpan = createMockSpan();
      vi.mocked(tracer).startSpan.mockReturnValue(mockSpan);

      const commits = [createCommit('abc123', new Date('2024-01-15T10:00:00Z'))];

      buildStatelessIterations(commits, [], 'base000');

      expect(mockSpan.setStatus).toHaveBeenCalledWith('ok');
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('StatelessIterationData shape', () => {
    it('returns correct structure', () => {
      const commits = [createCommit('abc123', new Date('2024-01-15T10:00:00Z'))];

      const result: StatelessIterationData = buildStatelessIterations(commits, [], 'base000');

      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('collapsedGroups');
      expect(Array.isArray(result.iterations)).toBe(true);
      expect(Array.isArray(result.collapsedGroups)).toBe(true);
    });

    it('iterations have all required fields', () => {
      const commits = [
        createCommit('abc123', new Date('2024-01-15T10:00:00Z'), {
          message: 'Test',
          author: 'dev',
        }),
      ];

      const result = buildStatelessIterations(commits, [], 'base000');
      const iteration = result.iterations[0];

      expect(iteration).toBeDefined();
      expect(typeof iteration?.revision).toBe('number');
      expect(typeof iteration?.commitSha).toBe('string');
      expect(typeof iteration?.baseSha).toBe('string');
      expect(typeof iteration?.author).toBe('string');
      expect(typeof iteration?.message).toBe('string');
      expect(iteration?.createdAt).toBeInstanceOf(Date);
      expect(['current', 'discarded']).toContain(iteration?.lineage);
    });
  });
});
