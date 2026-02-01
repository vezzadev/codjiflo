/**
 * Integration Test: Stateless Iteration Flow (Task 1.8)
 *
 * Tests the complete stateless iteration loading flow:
 * 1. Load force-push events from Timeline API (loadTimeline)
 * 2. Load commits from Commits API (loadCommits)
 * 3. Build StatelessIterationData (buildStatelessIterations)
 *
 * This tests that all three components integrate correctly together.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { loadTimeline, loadCommits, buildStatelessIterations, type PRCommit } from './index';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the auth store
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      token: 'ghp_integration_test_token',
      updateRateLimit: vi.fn(),
    })),
  },
}));

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

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock GitHub timeline event for force-push
 */
function createMockTimelineEvent(
  beforeSha: string,
  afterSha: string,
  createdAt: string,
  actor = 'developer'
): Record<string, unknown> {
  return {
    event: 'head_ref_force_pushed',
    before: { sha: beforeSha },
    after: { sha: afterSha },
    created_at: createdAt,
    actor: { login: actor },
  };
}

/**
 * Create a mock GitHub commit response
 */
function createMockGitHubCommit(
  sha: string,
  message: string,
  authorDate: string,
  parentSha?: string,
  authorLogin = 'developer'
): Record<string, unknown> {
  const commit: Record<string, unknown> = {
    sha,
    commit: {
      message,
      author: {
        date: authorDate,
        name: authorLogin,
      },
    },
    author: { login: authorLogin },
    parents: parentSha ? [{ sha: parentSha }] : [],
  };
  return commit;
}

/**
 * Create mock fetch responses for Timeline and Commits APIs
 */
function setupMockFetch(
  timelineEvents: Record<string, unknown>[],
  commits: Record<string, unknown>[]
) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/timeline')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({
          'X-RateLimit-Remaining': '4999',
          'X-RateLimit-Reset': '1700000000',
          'X-RateLimit-Limit': '5000',
        }),
        json: () => Promise.resolve(timelineEvents),
      });
    }

    if (url.includes('/commits')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({
          'X-RateLimit-Remaining': '4998',
          'X-RateLimit-Reset': '1700000000',
          'X-RateLimit-Limit': '5000',
        }),
        json: () => Promise.resolve(commits),
      });
    }

    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Stateless Iteration Flow Integration', () => {
  let consoleSpy: MockInstance;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('complete flow without force-pushes', () => {
    it('loads commits and builds iterations with sequential revisions', async () => {
      // Setup: PR with 3 commits, no force-pushes
      const commits = [
        createMockGitHubCommit('abc123', 'Initial commit', '2024-01-15T10:00:00Z', undefined),
        createMockGitHubCommit('def456', 'Add feature', '2024-01-15T11:00:00Z', 'abc123'),
        createMockGitHubCommit('ghi789', 'Fix bug', '2024-01-15T12:00:00Z', 'def456'),
      ];

      global.fetch = setupMockFetch([], commits);

      // Execute: Load timeline and commits in parallel
      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      // Build iterations
      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000');

      // Verify: No force-push events
      expect(forcePushEvents).toHaveLength(0);

      // Verify: 3 commits loaded
      expect(prCommits).toHaveLength(3);

      // Verify: 3 iterations with correct sequential revisions
      expect(result.iterations).toHaveLength(3);
      expect(result.iterations[0]?.revision).toBe(1);
      expect(result.iterations[0]?.commitSha).toBe('abc123');
      expect(result.iterations[0]?.lineage).toBe('current');
      expect(result.iterations[1]?.revision).toBe(2);
      expect(result.iterations[1]?.commitSha).toBe('def456');
      expect(result.iterations[2]?.revision).toBe(3);
      expect(result.iterations[2]?.commitSha).toBe('ghi789');

      // Verify: No collapsed groups
      expect(result.collapsedGroups).toHaveLength(0);
    });
  });

  describe('complete flow with force-push', () => {
    it('loads timeline and commits, builds iterations with collapsed groups', async () => {
      // Setup: PR with force-push that discarded commits
      // Timeline: 1 force-push event (old123 -> new456)
      // Commits: only the "new" commit after force-push is in current history

      const timelineEvents = [
        { event: 'committed' },
        createMockTimelineEvent('old123', 'new456', '2024-01-15T11:00:00Z'),
        { event: 'reviewed' },
      ];

      const commits = [
        createMockGitHubCommit('new456', 'New approach', '2024-01-15T12:00:00Z', 'base000'),
      ];

      global.fetch = setupMockFetch(timelineEvents, commits);

      // Execute: Load timeline and commits in parallel
      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      // Build iterations (without discarded commits - they're GC'd)
      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000');

      // Verify: 1 force-push event
      expect(forcePushEvents).toHaveLength(1);
      expect(forcePushEvents[0]?.beforeSha).toBe('old123');
      expect(forcePushEvents[0]?.afterSha).toBe('new456');

      // Verify: 1 live commit
      expect(prCommits).toHaveLength(1);
      expect(prCommits[0]?.sha).toBe('new456');

      // Verify: 1 iteration (only live commits)
      expect(result.iterations).toHaveLength(1);
      expect(result.iterations[0]?.commitSha).toBe('new456');
      expect(result.iterations[0]?.lineage).toBe('current');

      // Verify: 1 collapsed group (for the force-push)
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]?.beforeSha).toBe('old123');
      expect(result.collapsedGroups[0]?.afterSha).toBe('new456');
      expect(result.collapsedGroups[0]?.unavailableReason).toBe('commits_unavailable');
      expect(result.collapsedGroups[0]?.visibility).toBe('collapsed');
    });

    it('includes discarded commits when available', async () => {
      // Setup: PR with force-push, but we have the discarded commits
      const timelineEvents = [
        createMockTimelineEvent('disc1', 'live2', '2024-01-15T13:00:00Z'),
      ];

      const liveCommits = [
        createMockGitHubCommit('live2', 'Squashed commit', '2024-01-15T14:00:00Z', 'base000'),
      ];

      // Simulate having discarded commits (perhaps from local git reflog)
      const discardedCommits: PRCommit[] = [
        {
          sha: 'disc1',
          message: 'Old commit 1',
          author: 'developer',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          parentSha: 'base000',
        },
        {
          sha: 'disc0',
          message: 'Old commit 0',
          author: 'developer',
          createdAt: new Date('2024-01-15T09:00:00Z'),
        },
      ];

      global.fetch = setupMockFetch(timelineEvents, liveCommits);

      // Execute
      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      // Build iterations WITH discarded commits
      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000', discardedCommits);

      // Verify: All commits (discarded + live) are in iterations
      expect(result.iterations).toHaveLength(3);

      // Sorted by createdAt: disc0 (09:00), disc1 (10:00), live2 (14:00)
      expect(result.iterations[0]?.commitSha).toBe('disc0');
      expect(result.iterations[0]?.lineage).toBe('discarded');
      expect(result.iterations[1]?.commitSha).toBe('disc1');
      expect(result.iterations[1]?.lineage).toBe('discarded');
      expect(result.iterations[2]?.commitSha).toBe('live2');
      expect(result.iterations[2]?.lineage).toBe('current');

      // Verify: Collapsed group has discarded iterations
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]?.iterations).toHaveLength(2);
      expect(result.collapsedGroups[0]?.unavailableReason).toBeUndefined();
    });
  });

  describe('complete flow with multiple force-pushes', () => {
    it('handles multiple force-push events creating multiple collapsed groups', async () => {
      // Setup: PR with 2 force-pushes
      // Force-push 1: sha1 -> sha2
      // Force-push 2: sha3 -> sha4
      // Current commits: sha4

      const timelineEvents = [
        createMockTimelineEvent('sha1', 'sha2', '2024-01-15T11:00:00Z'),
        { event: 'committed' },
        createMockTimelineEvent('sha3', 'sha4', '2024-01-15T15:00:00Z'),
      ];

      const commits = [
        createMockGitHubCommit('sha4', 'Final version', '2024-01-15T16:00:00Z', 'base000'),
      ];

      global.fetch = setupMockFetch(timelineEvents, commits);

      // Execute
      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000');

      // Verify: 2 force-push events
      expect(forcePushEvents).toHaveLength(2);

      // Verify: 2 collapsed groups
      expect(result.collapsedGroups).toHaveLength(2);

      // Groups should be sorted by timestamp
      expect(result.collapsedGroups[0]?.beforeSha).toBe('sha1');
      expect(result.collapsedGroups[0]?.afterSha).toBe('sha2');
      expect(result.collapsedGroups[1]?.beforeSha).toBe('sha3');
      expect(result.collapsedGroups[1]?.afterSha).toBe('sha4');

      // Both groups should have unavailableReason since no discarded commits provided
      expect(result.collapsedGroups[0]?.unavailableReason).toBe('commits_unavailable');
      expect(result.collapsedGroups[1]?.unavailableReason).toBe('commits_unavailable');
    });
  });

  describe('API error handling', () => {
    it('propagates Timeline API errors', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/timeline')) {
          return Promise.resolve({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            headers: new Headers(),
            json: () => Promise.resolve({ message: 'API rate limit exceeded' }),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      });

      await expect(loadTimeline('owner', 'repo', 123)).rejects.toThrow('API rate limit exceeded');
    });

    it('propagates Commits API errors', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/commits')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            headers: new Headers(),
            json: () => Promise.resolve({ message: 'Not Found' }),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      });

      await expect(loadCommits('owner', 'repo', 123)).rejects.toThrow('Not Found');
    });
  });

  describe('real-world scenarios', () => {
    it('handles squash-and-rebase workflow', async () => {
      // Scenario: Developer makes 3 commits, then squashes them into 1
      // Before squash: commit1, commit2, commit3
      // After squash: squashed_commit

      const timelineEvents = [
        createMockTimelineEvent('commit3', 'squashed_commit', '2024-01-15T14:00:00Z'),
      ];

      const commits = [
        createMockGitHubCommit('squashed_commit', 'feat: add new feature\n\n* commit1\n* commit2\n* commit3', '2024-01-15T14:00:00Z', 'base000'),
      ];

      // Simulating discarded commits being available
      const discardedCommits: PRCommit[] = [
        { sha: 'commit1', message: 'WIP', author: 'dev', createdAt: new Date('2024-01-15T10:00:00Z') },
        { sha: 'commit2', message: 'More WIP', author: 'dev', createdAt: new Date('2024-01-15T11:00:00Z') },
        { sha: 'commit3', message: 'Almost done', author: 'dev', createdAt: new Date('2024-01-15T12:00:00Z') },
      ];

      global.fetch = setupMockFetch(timelineEvents, commits);

      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000', discardedCommits);

      // Verify: 4 total iterations (3 discarded + 1 squashed)
      expect(result.iterations).toHaveLength(4);

      // Verify: Discarded commits have correct lineage
      const discarded = result.iterations.filter(i => i.lineage === 'discarded');
      expect(discarded).toHaveLength(3);

      // Verify: Squashed commit is current
      const current = result.iterations.filter(i => i.lineage === 'current');
      expect(current).toHaveLength(1);
      expect(current[0]?.commitSha).toBe('squashed_commit');

      // Verify: Collapsed group contains the WIP commits
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]?.iterations).toHaveLength(3);
    });

    it('handles rebase onto updated base branch', async () => {
      // Scenario: Feature branch rebased onto updated main
      // Original: A -> B -> C (based on old main)
      // After rebase: A' -> B' -> C' (based on new main)

      const timelineEvents = [
        createMockTimelineEvent('C', 'C_prime', '2024-01-15T15:00:00Z'),
      ];

      const commits = [
        createMockGitHubCommit('A_prime', 'Feature A', '2024-01-15T15:00:00Z', 'new_base'),
        createMockGitHubCommit('B_prime', 'Feature B', '2024-01-15T15:01:00Z', 'A_prime'),
        createMockGitHubCommit('C_prime', 'Feature C', '2024-01-15T15:02:00Z', 'B_prime'),
      ];

      global.fetch = setupMockFetch(timelineEvents, commits);

      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000');

      // Verify: 3 current iterations
      expect(result.iterations).toHaveLength(3);
      expect(result.iterations.every(i => i.lineage === 'current')).toBe(true);

      // Verify: 1 collapsed group (for the rebase force-push)
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]?.unavailableReason).toBe('commits_unavailable');
    });

    it('handles PR with no commits (edge case)', async () => {
      // Scenario: Empty PR (possible during creation)
      global.fetch = setupMockFetch([], []);

      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000');

      expect(result.iterations).toHaveLength(0);
      expect(result.collapsedGroups).toHaveLength(0);
    });
  });

  describe('data integrity', () => {
    it('preserves commit message first line only', async () => {
      const commits = [
        createMockGitHubCommit(
          'abc123',
          'First line\n\nExtended description\nMore details',
          '2024-01-15T10:00:00Z'
        ),
      ];

      global.fetch = setupMockFetch([], commits);

      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000');

      // Commit loader extracts first line only
      expect(result.iterations[0]?.message).toBe('First line');
    });

    it('preserves author information through the flow', async () => {
      const commits = [
        createMockGitHubCommit('abc123', 'Commit', '2024-01-15T10:00:00Z', undefined, 'specific_author'),
      ];

      global.fetch = setupMockFetch([], commits);

      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000');

      expect(result.iterations[0]?.author).toBe('specific_author');
    });

    it('preserves timestamp information through the flow', async () => {
      const timestamp = '2024-01-15T10:30:45Z';
      const commits = [createMockGitHubCommit('abc123', 'Commit', timestamp)];

      global.fetch = setupMockFetch([], commits);

      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      const result = buildStatelessIterations(prCommits, forcePushEvents, 'base000');

      expect(result.iterations[0]?.createdAt).toEqual(new Date(timestamp));
    });

    it('correctly chains baseSha from previous commits', async () => {
      const commits = [
        createMockGitHubCommit('sha1', 'First', '2024-01-15T10:00:00Z'),
        createMockGitHubCommit('sha2', 'Second', '2024-01-15T11:00:00Z', 'sha1'),
        createMockGitHubCommit('sha3', 'Third', '2024-01-15T12:00:00Z', 'sha2'),
      ];

      global.fetch = setupMockFetch([], commits);

      const [forcePushEvents, prCommits] = await Promise.all([
        loadTimeline('owner', 'repo', 123),
        loadCommits('owner', 'repo', 123),
      ]);

      const result = buildStatelessIterations(prCommits, forcePushEvents, 'pr_base');

      // First iteration uses PR base
      expect(result.iterations[0]?.baseSha).toBe('pr_base');

      // Subsequent iterations use previous commit SHA
      expect(result.iterations[1]?.baseSha).toBe('sha1');
      expect(result.iterations[2]?.baseSha).toBe('sha2');
    });
  });
});
