import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommitIterationLoader } from './commit-iteration-loader';
import {
  createMockPRCommit,
  createMockForcePushEvent,
  createMockTimelineOtherEvent,
  createMockCompareCommit,
  createMockCompareResponse,
  resetStatelessIterationFactoryCounters,
} from '@/tests/factories';
import type { GitHubPRCommit } from '@/api/github/types';
import { GitHubAPIError } from '@/api/github/github-client';

vi.mock('@/api/github/github-client', async () => {
  const actual = await vi.importActual<typeof import('@/api/github/github-client')>('@/api/github/github-client');
  return {
    ...actual,
    githubClient: {
      fetch: vi.fn(),
    },
  };
});

import { githubClient } from '@/api/github/github-client';

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFetch = vi.mocked(githubClient.fetch);

describe('CommitIterationLoader', () => {
  let loader: CommitIterationLoader;

  beforeEach(() => {
    resetStatelessIterationFactoryCounters();
    vi.clearAllMocks();
    loader = new CommitIterationLoader('owner', 'repo', 42);
  });

  describe('load', () => {
    it('fetches commits and timeline, returns iterations for simple PR', async () => {
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'aaa', commit: { message: 'First', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-01T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      mockFetch
        .mockResolvedValueOnce(commits)
        .mockResolvedValueOnce([]);

      const result = await loader.load('base-sha');

      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/pulls/42/commits');
      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/issues/42/timeline');
      expect(result.iterations).toHaveLength(1);
      expect(result.iterations[0]).toMatchObject({ revision: 1, commitSha: 'aaa', status: 'live' });
    });

    it('discovers discarded commits for force-push events', async () => {
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'live-1', commit: { message: 'Live', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-03T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];
      const forcePush = createMockForcePushEvent({
        id: 100, created_at: '2025-01-02T00:00:00Z',
        before_commit: { sha: 'old-head' }, after_commit: { sha: 'new-head' },
      });
      const discardedCommits = [
        createMockCompareCommit({ sha: 'discarded-1', commit: { message: 'Old', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-01T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      mockFetch
        .mockResolvedValueOnce(commits)
        .mockResolvedValueOnce([forcePush, createMockTimelineOtherEvent('labeled')])
        .mockResolvedValueOnce(createMockCompareResponse(discardedCommits));

      const result = await loader.load('base-sha');

      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/compare/new-head...old-head');
      expect(result.iterations).toHaveLength(2);
      expect(result.collapsedGroups).toHaveLength(1);
    });

    it('handles 404 from compare API as GC result', async () => {
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'live', commit: { message: 'Live', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-02T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];
      const forcePush = createMockForcePushEvent({
        id: 200, created_at: '2025-01-01T00:00:00Z',
        before_commit: { sha: 'gc-sha' }, after_commit: { sha: 'new-sha' },
      });

      mockFetch
        .mockResolvedValueOnce(commits)
        .mockResolvedValueOnce([forcePush])
        .mockRejectedValueOnce(new GitHubAPIError(404, 'Not Found', 'Not Found'));

      const result = await loader.load('base-sha');

      expect(result.iterations).toHaveLength(1);
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]).toMatchObject({ unknownCount: true });
    });

    it('handles 410 from compare API as GC result', async () => {
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'live', commit: { message: 'Live', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-02T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];
      const forcePush = createMockForcePushEvent({
        id: 300, created_at: '2025-01-01T00:00:00Z',
        before_commit: { sha: 'gone-sha' }, after_commit: { sha: 'new-sha' },
      });

      mockFetch
        .mockResolvedValueOnce(commits)
        .mockResolvedValueOnce([forcePush])
        .mockRejectedValueOnce(new GitHubAPIError(410, 'Gone', 'Gone'));

      const result = await loader.load('base-sha');

      expect(result.collapsedGroups[0]).toMatchObject({ unknownCount: true });
    });

    it('gracefully degrades when timeline API requires auth (404)', async () => {
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'aaa', commit: { message: 'First', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-01T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      mockFetch
        .mockResolvedValueOnce(commits) // commits succeed
        .mockRejectedValueOnce(new GitHubAPIError(404, 'Not Found', 'Not Found')); // timeline fails (auth required)

      const result = await loader.load('base-sha');

      expect(result.iterations).toHaveLength(1);
      expect(result.iterations[0]).toMatchObject({ revision: 1, commitSha: 'aaa', status: 'live' });
      expect(result.collapsedGroups).toHaveLength(0); // no force-push detection without timeline
    });

    it('gracefully degrades when timeline API returns 403 (rate limit/auth)', async () => {
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'bbb', commit: { message: 'Second', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-01T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      mockFetch
        .mockResolvedValueOnce(commits)
        .mockRejectedValueOnce(new GitHubAPIError(403, 'Forbidden', 'Resource not accessible'));

      const result = await loader.load('base-sha');

      expect(result.iterations).toHaveLength(1);
      expect(result.collapsedGroups).toHaveLength(0);
    });

    it('propagates non-404/410 errors from compare API', async () => {
      const commits: GitHubPRCommit[] = [];
      const forcePush = createMockForcePushEvent({
        id: 400, before_commit: { sha: 'before' }, after_commit: { sha: 'after' },
      });

      mockFetch
        .mockResolvedValueOnce(commits)
        .mockResolvedValueOnce([forcePush])
        .mockRejectedValueOnce(new GitHubAPIError(500, 'Internal Server Error', 'Server error'));

      await expect(loader.load('base-sha')).rejects.toThrow('Server error');
    });
  });
});
