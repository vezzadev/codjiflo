/**
 * Tests for TimelineLoader
 *
 * Verifies commit-based iteration building from GitHub PR Commits API,
 * Timeline API force-push detection, and Compare API discarded commit discovery.
 *
 * Adversarial test strategy: tests ensure the implementation correctly handles
 * ordering, deduplication, API construction, error propagation, and edge cases
 * that a minimal/lazy implementation would get wrong.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineLoader } from './timeline-loader';
import { GitHubAPIError } from '@/api/github/github-client';

// Mock the GitHub client
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));
vi.mock('@/api/github/github-client', async () => {
  const actual = await vi.importActual<typeof import('@/api/github/github-client')>('@/api/github/github-client');
  return {
    ...actual,
    githubClient: { fetch: mockFetch },
  };
});

// ============================================================================
// Test Helpers
// ============================================================================

/** Safe array accessor that throws on undefined (replaces non-null assertion in tests) */
function at<T>(arr: T[], index: number): T {
  const item = arr[index];
  if (item === undefined) throw new Error(`Expected item at index ${index} but array has length ${String(arr.length)}`);
  return item;
}

function makeCommit(sha: string, date: string, author = 'testuser', message = `commit ${sha}`) {
  return {
    sha,
    commit: {
      message,
      author: { name: author, date },
    },
    author: { login: author },
  };
}

function makeForcePushEvent(id: number, _beforeSha: string, afterSha: string, createdAt: string) {
  // Real GitHub API only provides commit_id (the new HEAD after force-push).
  // The beforeSha is inferred at runtime by walking committed events in the timeline.
  return {
    id,
    event: 'head_ref_force_pushed',
    created_at: createdAt,
    commit_id: afterSha,
  };
}

/** Create a committed event (used to track current HEAD for force-push before-SHA inference) */
function makeCommittedEvent(sha: string, createdAt: string) {
  return {
    id: 0,
    event: 'committed',
    created_at: createdAt,
    sha,
  };
}

function makeCompareResult(commits: { sha: string; date: string; author?: string; message?: string }[]) {
  return {
    commits: commits.map(c => makeCommit(c.sha, c.date, c.author, c.message)),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('TimelineLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('simple PR (no force-pushes)', () => {
    it('maps each commit to one live iteration with sequential revisions', async () => {
      mockFetch
        .mockResolvedValueOnce([ // commits
          makeCommit('aaa111', '2024-01-01T10:00:00Z'),
          makeCommit('bbb222', '2024-01-02T10:00:00Z'),
          makeCommit('ccc333', '2024-01-03T10:00:00Z'),
        ])
        .mockResolvedValueOnce([]); // timeline (no events)

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      expect(result.iterations).toHaveLength(3);
      expect(result.collapsedGroups).toHaveLength(0);

      // All live with sequential revisions
      expect(result.iterations[0]).toMatchObject({
        revision: 1,
        headSha: 'aaa111',
        baseSha: 'base-sha',
        status: 'live',
        author: 'testuser',
      });
      expect(result.iterations[1]).toMatchObject({
        revision: 2,
        headSha: 'bbb222',
        status: 'live',
      });
      expect(result.iterations[2]).toMatchObject({
        revision: 3,
        headSha: 'ccc333',
        status: 'live',
      });

      // IDs should be negative (stateless convention)
      expect(at(result.iterations, 0).id).toBeLessThan(0);
      expect(at(result.iterations, 1).id).toBeLessThan(0);
      expect(at(result.iterations, 2).id).toBeLessThan(0);

      // IDs must be unique
      const ids = result.iterations.map(i => i.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('returns empty iterations for PR with no commits', async () => {
      mockFetch
        .mockResolvedValueOnce([]) // commits
        .mockResolvedValueOnce([]); // timeline

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      expect(result.iterations).toHaveLength(0);
      expect(result.collapsedGroups).toHaveLength(0);
    });

    it('uses commit author login, falls back to commit author name', async () => {
      mockFetch
        .mockResolvedValueOnce([
          {
            sha: 'aaa111',
            commit: { message: 'test', author: { name: 'John Doe', date: '2024-01-01T10:00:00Z' } },
            author: null, // no GitHub user linked
          },
        ])
        .mockResolvedValueOnce([]); // timeline

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      expect(at(result.iterations, 0).author).toBe('John Doe');
    });

    it('parses commit date as createdAt', async () => {
      mockFetch
        .mockResolvedValueOnce([
          makeCommit('aaa111', '2024-01-01T10:00:00Z', 'dev', 'fix: critical bug'),
        ])
        .mockResolvedValueOnce([]);

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      // Iteration should have valid createdAt date
      expect(at(result.iterations, 0).createdAt).toEqual(new Date('2024-01-01T10:00:00Z'));
    });

    it('sorts iterations chronologically even if commits come out of order', async () => {
      // API might return commits in any order
      mockFetch
        .mockResolvedValueOnce([
          makeCommit('later', '2024-01-03T10:00:00Z'),
          makeCommit('earlier', '2024-01-01T10:00:00Z'),
          makeCommit('middle', '2024-01-02T10:00:00Z'),
        ])
        .mockResolvedValueOnce([]);

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      // Must be sorted chronologically
      expect(at(result.iterations, 0).headSha).toBe('earlier');
      expect(at(result.iterations, 1).headSha).toBe('middle');
      expect(at(result.iterations, 2).headSha).toBe('later');

      // Revisions must be sequential after sort
      expect(result.iterations.map(i => i.revision)).toEqual([1, 2, 3]);
    });

    it('assigns baseSha from constructor to ALL iterations', async () => {
      mockFetch
        .mockResolvedValueOnce([
          makeCommit('aaa', '2024-01-01T10:00:00Z'),
          makeCommit('bbb', '2024-01-02T10:00:00Z'),
        ])
        .mockResolvedValueOnce([]);

      const loader = new TimelineLoader('owner', 'repo', 42, 'my-base-sha');
      const result = await loader.load();

      for (const iteration of result.iterations) {
        expect(iteration.baseSha).toBe('my-base-sha');
      }
    });

    it('single commit PR produces exactly one iteration with revision 1', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('only-one', '2024-01-01T10:00:00Z')])
        .mockResolvedValueOnce([]);

      const loader = new TimelineLoader('owner', 'repo', 1, 'base');
      const result = await loader.load();

      expect(result.iterations).toHaveLength(1);
      expect(at(result.iterations, 0).revision).toBe(1);
      expect(at(result.iterations, 0).status).toBe('live');
      expect(at(result.iterations, 0).collapsedGroupId).toBeUndefined();
    });
  });

  describe('PR with force-push (discoverable discarded commits)', () => {
    it('builds collapsed iterations from discarded commits', async () => {
      // Timeline: committed event establishes HEAD, then force-push replaces it
      // Compare API discovers 2 discarded commits
      mockFetch
        .mockResolvedValueOnce([ // commits (current)
          makeCommit('new111', '2024-01-03T10:00:00Z'),
        ])
        .mockResolvedValueOnce([ // timeline
          makeCommittedEvent('old-sha', '2024-01-01T12:00:00Z'),
          makeForcePushEvent(1001, 'old-sha', 'new-sha', '2024-01-02T12:00:00Z'),
        ])
        .mockResolvedValueOnce( // compare: afterSha...beforeSha -> discarded commits
          makeCompareResult([
            { sha: 'disc-a', date: '2024-01-01T10:00:00Z', message: 'discarded 1' },
            { sha: 'disc-b', date: '2024-01-01T11:00:00Z', message: 'discarded 2' },
          ])
        );

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      // 2 collapsed + 1 live = 3 iterations
      expect(result.iterations).toHaveLength(3);

      // Collapsed iterations (ordered chronologically, so they come first)
      const collapsed = result.iterations.filter(i => i.status === 'collapsed');
      expect(collapsed).toHaveLength(2);
      expect(at(collapsed, 0).headSha).toBe('disc-a');
      expect(at(collapsed, 0).collapsedGroupId).toBe('1001');
      expect(at(collapsed, 1).headSha).toBe('disc-b');
      expect(at(collapsed, 1).collapsedGroupId).toBe('1001');

      // Live iteration
      const live = result.iterations.filter(i => i.status === 'live');
      expect(live).toHaveLength(1);
      expect(at(live, 0).headSha).toBe('new111');
      expect(at(live, 0).collapsedGroupId).toBeUndefined();

      // Sequential revision numbers across all
      expect(result.iterations.map(i => i.revision)).toEqual([1, 2, 3]);

      // Collapsed group
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]).toMatchObject({
        forcePushEventId: '1001',
        discardedRevisions: [1, 2],
        reason: 'force_push',
        visibility: 'collapsed',
      });
      const group0 = at(result.collapsedGroups, 0);
      expect(group0.commits).toHaveLength(2);
      expect(at(group0.commits, 0).status).toBe('available');
      expect(at(group0.commits, 0).sha).toBe('disc-a');
      expect(at(group0.commits, 0).message).toBe('discarded 1');
      expect(at(group0.commits, 1).sha).toBe('disc-b');
    });

    it('collapsed group unknownCount is NOT set for discoverable commits', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('new1', '2024-01-02T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('old', '2024-01-01T10:00:00Z'),
          makeForcePushEvent(100, 'old', 'new', '2024-01-01T12:00:00Z'),
        ])
        .mockResolvedValueOnce(makeCompareResult([
          { sha: 'disc', date: '2024-01-01T10:00:00Z' },
        ]));

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      expect(at(result.collapsedGroups, 0).unknownCount).toBeUndefined();
    });
  });

  describe("PR with force-push (GC'd before SHA)", () => {
    it('creates unknown-count collapsed group when compare returns 404', async () => {
      mockFetch
        .mockResolvedValueOnce([ // commits (current)
          makeCommit('new111', '2024-01-03T10:00:00Z'),
        ])
        .mockResolvedValueOnce([ // timeline
          makeCommittedEvent('gc-sha', '2024-01-01T12:00:00Z'),
          makeForcePushEvent(2001, 'gc-sha', 'new-sha', '2024-01-02T12:00:00Z'),
        ])
        .mockRejectedValueOnce( // compare returns 404
          new GitHubAPIError(404, 'Not Found', 'Not Found')
        );

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      // Only the live commit, no collapsed iterations (unknown count)
      expect(result.iterations).toHaveLength(1);
      expect(at(result.iterations, 0).status).toBe('live');
      expect(at(result.iterations, 0).revision).toBe(1);

      // Collapsed group with unknownCount flag
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]).toMatchObject({
        forcePushEventId: '2001',
        discardedRevisions: [],
        commits: [],
        unknownCount: true,
        visibility: 'collapsed',
      });
    });

    it('handles 410 Gone the same as 404', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('new111', '2024-01-03T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('deleted-sha', '2024-01-01T12:00:00Z'),
          makeForcePushEvent(3001, 'deleted-sha', 'new-sha', '2024-01-02T12:00:00Z'),
        ])
        .mockRejectedValueOnce(
          new GitHubAPIError(410, 'Gone', 'Gone')
        );

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      expect(at(result.collapsedGroups, 0).unknownCount).toBe(true);
      expect(at(result.collapsedGroups, 0).commits).toHaveLength(0);
      expect(at(result.collapsedGroups, 0).discardedRevisions).toHaveLength(0);
    });
  });

  describe('multiple force-pushes', () => {
    it('handles mixed discoverable and GC\'d force-pushes', async () => {
      mockFetch
        .mockResolvedValueOnce([ // commits (current)
          makeCommit('final-1', '2024-01-05T10:00:00Z'),
          makeCommit('final-2', '2024-01-06T10:00:00Z'),
        ])
        .mockResolvedValueOnce([ // timeline: committed events + two force-pushes
          makeCommittedEvent('old-before-1', '2024-01-01T10:00:00Z'),
          makeForcePushEvent(100, 'old-before-1', 'after-1', '2024-01-02T10:00:00Z'),
          makeCommittedEvent('gc-before', '2024-01-03T10:00:00Z'),
          makeForcePushEvent(200, 'gc-before', 'after-2', '2024-01-04T10:00:00Z'),
        ])
        .mockResolvedValueOnce( // first compare: discoverable
          makeCompareResult([
            { sha: 'disc-x', date: '2024-01-01T10:00:00Z' },
          ])
        )
        .mockRejectedValueOnce( // second compare: GC'd
          new GitHubAPIError(404, 'Not Found', 'Not Found')
        );

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      // 1 discoverable collapsed + 2 live = 3 iterations
      expect(result.iterations).toHaveLength(3);
      expect(result.iterations.filter(i => i.status === 'collapsed')).toHaveLength(1);
      expect(result.iterations.filter(i => i.status === 'live')).toHaveLength(2);

      // 2 collapsed groups (one with commits, one unknown)
      expect(result.collapsedGroups).toHaveLength(2);
      expect(at(result.collapsedGroups, 0).commits).toHaveLength(1);
      expect(at(result.collapsedGroups, 0).unknownCount).toBeUndefined();
      expect(at(result.collapsedGroups, 1).unknownCount).toBe(true);

      // All iterations must have sequential revisions
      expect(result.iterations.map(i => i.revision)).toEqual([1, 2, 3]);
    });

    it('maintains chronological ordering of collapsed groups', async () => {
      // Two discoverable force-pushes — first force-push discarded commits should come first
      mockFetch
        .mockResolvedValueOnce([ // commits (current)
          makeCommit('latest', '2024-01-10T10:00:00Z'),
        ])
        .mockResolvedValueOnce([ // timeline: committed events + two force-pushes
          makeCommittedEvent('old-1', '2024-01-02T10:00:00Z'),
          makeForcePushEvent(100, 'old-1', 'after-1', '2024-01-03T10:00:00Z'),
          makeCommittedEvent('old-2', '2024-01-05T10:00:00Z'),
          makeForcePushEvent(200, 'old-2', 'after-2', '2024-01-06T10:00:00Z'),
        ])
        .mockResolvedValueOnce( // first compare
          makeCompareResult([
            { sha: 'early-disc', date: '2024-01-01T10:00:00Z' },
          ])
        )
        .mockResolvedValueOnce( // second compare
          makeCompareResult([
            { sha: 'later-disc', date: '2024-01-05T10:00:00Z' },
          ])
        );

      const loader = new TimelineLoader('owner', 'repo', 123, 'base-sha');
      const result = await loader.load();

      // Chronological order: early-disc (Jan 1), later-disc (Jan 5), latest (Jan 10)
      expect(result.iterations).toHaveLength(3);
      expect(at(result.iterations, 0).headSha).toBe('early-disc');
      expect(at(result.iterations, 0).status).toBe('collapsed');
      expect(at(result.iterations, 1).headSha).toBe('later-disc');
      expect(at(result.iterations, 1).status).toBe('collapsed');
      expect(at(result.iterations, 2).headSha).toBe('latest');
      expect(at(result.iterations, 2).status).toBe('live');

      // Each collapsed group should reference correct revisions
      expect(at(result.collapsedGroups, 0).discardedRevisions).toEqual([1]);
      expect(at(result.collapsedGroups, 1).discardedRevisions).toEqual([2]);
    });
  });

  describe('API endpoint construction', () => {
    it('fetches commits and timeline in parallel from correct endpoints', async () => {
      mockFetch
        .mockResolvedValueOnce([]) // commits
        .mockResolvedValueOnce([]); // timeline

      const loader = new TimelineLoader('my-org', 'my-repo', 42, 'base-sha');
      await loader.load();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith('/repos/my-org/my-repo/pulls/42/commits?per_page=100&page=1');
      expect(mockFetch).toHaveBeenCalledWith('/repos/my-org/my-repo/issues/42/timeline?per_page=100&page=1');
    });

    it('calls compare API with correct afterSha...beforeSha format', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('curr', '2024-01-02T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('before-abc', '2024-01-01T10:00:00Z'),
          makeForcePushEvent(1, 'before-abc', 'after-def', '2024-01-01T12:00:00Z'),
        ])
        .mockResolvedValueOnce(makeCompareResult([]));

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      await loader.load();

      // Compare: afterSha...beforeSha (discovers commits reachable from before but not from after)
      expect(mockFetch).toHaveBeenCalledWith('/repos/o/r/compare/after-def...before-abc');
    });

    it('uses the correct owner/repo/prNumber in all API calls', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('c1', '2024-01-01T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('b', '2024-01-01T10:00:00Z'),
          makeForcePushEvent(1, 'b', 'a', '2024-01-01T12:00:00Z'),
        ])
        .mockResolvedValueOnce(makeCompareResult([]));

      const loader = new TimelineLoader('special-org', 'special-repo', 999, 'base');
      await loader.load();

      // Verify all 3 calls use the correct owner/repo
      const calls = mockFetch.mock.calls.map(c => c[0] as string);
      expect(calls[0]).toBe('/repos/special-org/special-repo/pulls/999/commits?per_page=100&page=1');
      expect(calls[1]).toBe('/repos/special-org/special-repo/issues/999/timeline?per_page=100&page=1');
      expect(calls[2]).toBe('/repos/special-org/special-repo/compare/a...b');
    });
  });

  describe('non-force-push timeline events are ignored', () => {
    it('ignores non-force-push events in timeline', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('aaa', '2024-01-01T10:00:00Z')])
        .mockResolvedValueOnce([
          { id: 1, event: 'labeled', created_at: '2024-01-01T10:00:00Z' },
          { id: 2, event: 'commented', created_at: '2024-01-01T11:00:00Z' },
          { id: 3, event: 'merged', created_at: '2024-01-01T12:00:00Z' },
          { id: 4, event: 'head_ref_deleted', created_at: '2024-01-01T13:00:00Z' },
          { id: 5, event: 'reviewed', created_at: '2024-01-01T14:00:00Z' },
        ]);

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      // No compare API calls, no collapsed groups
      expect(mockFetch).toHaveBeenCalledTimes(2); // only commits + timeline
      expect(result.collapsedGroups).toHaveLength(0);
      expect(result.iterations).toHaveLength(1);
      expect(at(result.iterations, 0).status).toBe('live');
    });

    it('ignores force-push events missing commit_id', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('aaa', '2024-01-01T10:00:00Z')])
        .mockResolvedValueOnce([
          // Force-push event without commit_id — should be ignored
          { id: 1, event: 'head_ref_force_pushed', created_at: '2024-01-01T10:00:00Z' },
          // Another without commit_id
          { id: 2, event: 'head_ref_force_pushed', created_at: '2024-01-01T11:00:00Z' },
        ]);

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      // Should not make any compare API calls for malformed events
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.collapsedGroups).toHaveLength(0);
    });

    it('creates unknown-count group when no committed event precedes force-push', async () => {
      // Force-push with commit_id but no prior committed event to infer before SHA
      mockFetch
        .mockResolvedValueOnce([makeCommit('aaa', '2024-01-02T10:00:00Z')])
        .mockResolvedValueOnce([
          makeForcePushEvent(99, '', 'new-head', '2024-01-01T10:00:00Z'),
        ]);

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      // No compare API call since before SHA is unknown
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.collapsedGroups).toHaveLength(1);
      expect(at(result.collapsedGroups, 0).unknownCount).toBe(true);
    });
  });

  describe('error propagation', () => {
    it('propagates non-404/410 errors from compare API', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('aaa', '2024-01-01T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('before', '2024-01-01T08:00:00Z'),
          makeForcePushEvent(1, 'before', 'after', '2024-01-01T10:00:00Z'),
        ])
        .mockRejectedValueOnce(
          new GitHubAPIError(500, 'Internal Server Error', 'Server error')
        );

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      await expect(loader.load()).rejects.toThrow('Server error');
    });

    it('propagates 403 errors (not swallowed like 404/410)', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('aaa', '2024-01-01T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('before', '2024-01-01T08:00:00Z'),
          makeForcePushEvent(1, 'before', 'after', '2024-01-01T10:00:00Z'),
        ])
        .mockRejectedValueOnce(
          new GitHubAPIError(403, 'Forbidden', 'API rate limit exceeded')
        );

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      await expect(loader.load()).rejects.toThrow('API rate limit exceeded');
    });

    it('propagates errors from commits API', async () => {
      mockFetch.mockRejectedValueOnce(
        new GitHubAPIError(401, 'Unauthorized', 'Bad credentials')
      );

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      await expect(loader.load()).rejects.toThrow('Bad credentials');
    });

    it('propagates errors from timeline API', async () => {
      mockFetch
        .mockResolvedValueOnce([]) // commits succeed
        .mockRejectedValueOnce(
          new GitHubAPIError(500, 'Internal Server Error', 'Timeline unavailable')
        );

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      await expect(loader.load()).rejects.toThrow('Timeline unavailable');
    });

    it('propagates non-GitHubAPIError errors from compare API', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('aaa', '2024-01-01T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('before', '2024-01-01T08:00:00Z'),
          makeForcePushEvent(1, 'before', 'after', '2024-01-01T10:00:00Z'),
        ])
        .mockRejectedValueOnce(new Error('Network failed'));

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      await expect(loader.load()).rejects.toThrow('Network failed');
    });
  });

  describe('edge cases', () => {
    it('force-push with zero discarded commits from compare API', async () => {
      // Compare returns successfully but with no commits (all were already on the new branch)
      mockFetch
        .mockResolvedValueOnce([makeCommit('new1', '2024-01-02T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('old', '2024-01-01T10:00:00Z'),
          makeForcePushEvent(100, 'old', 'new', '2024-01-01T12:00:00Z'),
        ])
        .mockResolvedValueOnce(makeCompareResult([])); // empty commits

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      // Should have 1 live iteration
      expect(result.iterations).toHaveLength(1);
      expect(at(result.iterations, 0).status).toBe('live');
      expect(at(result.iterations, 0).revision).toBe(1);

      // Collapsed group exists but with no discarded revisions
      expect(result.collapsedGroups).toHaveLength(1);
      expect(at(result.collapsedGroups, 0).discardedRevisions).toHaveLength(0);
      expect(at(result.collapsedGroups, 0).commits).toHaveLength(0);
      expect(at(result.collapsedGroups, 0).unknownCount).toBeUndefined();
    });

    it('all live iterations have no collapsedGroupId', async () => {
      mockFetch
        .mockResolvedValueOnce([
          makeCommit('a', '2024-01-01T10:00:00Z'),
          makeCommit('b', '2024-01-02T10:00:00Z'),
        ])
        .mockResolvedValueOnce([]);

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      for (const iter of result.iterations) {
        expect(iter.collapsedGroupId).toBeUndefined();
      }
    });

    it('collapsed iterations have collapsedGroupId matching their group', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('live1', '2024-01-05T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('old', '2024-01-02T10:00:00Z'),
          makeForcePushEvent(777, 'old', 'new', '2024-01-03T10:00:00Z'),
        ])
        .mockResolvedValueOnce(makeCompareResult([
          { sha: 'disc1', date: '2024-01-01T10:00:00Z' },
          { sha: 'disc2', date: '2024-01-02T10:00:00Z' },
        ]));

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      const collapsed = result.iterations.filter(i => i.status === 'collapsed');
      for (const iter of collapsed) {
        expect(iter.collapsedGroupId).toBe('777');
      }
    });

    it('createdAt is a Date object for all iterations', async () => {
      mockFetch
        .mockResolvedValueOnce([
          makeCommit('a', '2024-01-01T10:00:00Z'),
          makeCommit('b', '2024-01-02T10:00:00Z'),
        ])
        .mockResolvedValueOnce([]);

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      for (const iter of result.iterations) {
        expect(iter.createdAt).toBeInstanceOf(Date);
        expect(Number.isNaN(iter.createdAt.getTime())).toBe(false);
      }
    });

    it('collapsed group forcePushEventId is string even when event id is numeric', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('live', '2024-01-02T10:00:00Z')])
        .mockResolvedValueOnce([
          makeCommittedEvent('old', '2024-01-01T08:00:00Z'),
          makeForcePushEvent(42, 'old', 'new', '2024-01-01T10:00:00Z'),
        ])
        .mockResolvedValueOnce(makeCompareResult([
          { sha: 'disc', date: '2024-01-01T08:00:00Z' },
        ]));

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      expect(typeof at(result.collapsedGroups, 0).forcePushEventId).toBe('string');
      expect(at(result.collapsedGroups, 0).forcePushEventId).toBe('42');

      // And the iteration's collapsedGroupId matches
      const collapsed = result.iterations.filter(i => i.status === 'collapsed');
      expect(at(collapsed, 0).collapsedGroupId).toBe('42');
    });

    it('IDs are sequential negative numbers matching -revision', async () => {
      mockFetch
        .mockResolvedValueOnce([
          makeCommit('a', '2024-01-01T10:00:00Z'),
          makeCommit('b', '2024-01-02T10:00:00Z'),
          makeCommit('c', '2024-01-03T10:00:00Z'),
        ])
        .mockResolvedValueOnce([]);

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      // IDs must be deterministic: -1, -2, -3 (not random)
      expect(at(result.iterations, 0).id).toBe(-1);
      expect(at(result.iterations, 1).id).toBe(-2);
      expect(at(result.iterations, 2).id).toBe(-3);
    });

    it('collapsed iterations have beforeSha set to the force-push before_commit SHA', async () => {
      mockFetch
        .mockResolvedValueOnce([makeCommit('live1', '2024-01-05T10:00:00Z')])
        .mockResolvedValueOnce([
          makeForcePushEvent(100, 'the-before-sha', 'the-after-sha', '2024-01-03T10:00:00Z'),
        ])
        .mockResolvedValueOnce(makeCompareResult([
          { sha: 'disc1', date: '2024-01-01T10:00:00Z' },
        ]));

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      const collapsed = result.iterations.filter(i => i.status === 'collapsed');
      expect(collapsed).toHaveLength(1);
      // beforeSha must be the force-push event's before_commit SHA (for force-push tracking)
      expect(at(collapsed, 0).beforeSha).toBe('the-before-sha');

      // Live iterations have null beforeSha
      const live = result.iterations.filter(i => i.status === 'live');
      expect(at(live, 0).beforeSha).toBeNull();
    });
  });

  describe('pagination', () => {
    it('fetches additional pages when first page returns exactly 100 items', async () => {
      // Generate exactly 100 commits for page 1, then 3 for page 2
      const page1Commits = Array.from({ length: 100 }, (_, i) =>
        makeCommit(`sha-${String(i).padStart(3, '0')}`, `2024-01-01T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`)
      );
      const page2Commits = [
        makeCommit('sha-100', '2024-01-02T10:00:00Z'),
        makeCommit('sha-101', '2024-01-02T11:00:00Z'),
        makeCommit('sha-102', '2024-01-02T12:00:00Z'),
      ];

      // fetchCommits and fetchTimeline run in parallel via Promise.all.
      // Both call fetchAllPages which issues sequential requests.
      // The mock must return values in the order calls arrive:
      // commits page 1, timeline page 1 (concurrent), then commits page 2 (sequential after page 1)
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/commits?per_page=100&page=1')) return Promise.resolve(page1Commits);
        if (url.includes('/commits?per_page=100&page=2')) return Promise.resolve(page2Commits);
        if (url.includes('/timeline')) return Promise.resolve([]);
        throw new Error(`Unexpected URL: ${url}`);
      });

      const loader = new TimelineLoader('o', 'r', 1, 'base');
      const result = await loader.load();

      // All 103 commits should become iterations
      expect(result.iterations).toHaveLength(103);
      expect(result.iterations.map(i => i.revision)).toEqual(
        Array.from({ length: 103 }, (_, i) => i + 1)
      );

      // Should have fetched page 2 for commits
      expect(mockFetch).toHaveBeenCalledWith('/repos/o/r/pulls/1/commits?per_page=100&page=2');
    });
  });
});
