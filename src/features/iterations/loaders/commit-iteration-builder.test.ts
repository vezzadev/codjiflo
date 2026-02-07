import { describe, it, expect, beforeEach } from 'vitest';
import { buildIterationsFromCommits, discoverDiscardedCommits } from './commit-iteration-builder';
import {
  createMockPRCommit,
  createMockForcePushEvent,
  createMockTimelineOtherEvent,
  createMockCompareCommit,
  createMockCompareResponse,
  resetStatelessIterationFactoryCounters,
} from '@/tests/factories';
import type {
  GitHubPRCommit,
  GitHubTimelineEvent,
} from '@/api/github/types';
import type { DiscoveryResult } from '../types';

describe('CommitIterationBuilder', () => {
  beforeEach(() => {
    resetStatelessIterationFactoryCounters();
  });

  describe('buildIterationsFromCommits', () => {
    it('maps each PR commit to a live iteration with sequential revision numbers', () => {
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'aaa', commit: { message: 'First', author: { name: 'Alice', email: 'a@a.com', date: '2025-01-01T00:00:00Z' } }, author: { id: 1, login: 'alice', avatar_url: '' } }),
        createMockPRCommit({ sha: 'bbb', commit: { message: 'Second', author: { name: 'Bob', email: 'b@b.com', date: '2025-01-02T00:00:00Z' } }, author: { id: 2, login: 'bob', avatar_url: '' } }),
        createMockPRCommit({ sha: 'ccc', commit: { message: 'Third', author: { name: 'Alice', email: 'a@a.com', date: '2025-01-03T00:00:00Z' } }, author: { id: 1, login: 'alice', avatar_url: '' } }),
      ];
      const timeline: GitHubTimelineEvent[] = [];
      const baseSha = 'base-sha';
      const discoveryResults = new Map<number, DiscoveryResult>();

      const result = buildIterationsFromCommits(commits, timeline, baseSha, discoveryResults);

      expect(result.iterations).toHaveLength(3);
      expect(result.collapsedGroups).toHaveLength(0);

      expect(result.iterations[0]).toEqual({
        revision: 1, commitSha: 'aaa', baseSha: 'base-sha', author: 'alice', createdAt: '2025-01-01T00:00:00Z', status: 'live',
      });
      expect(result.iterations[1]).toEqual({
        revision: 2, commitSha: 'bbb', baseSha: 'base-sha', author: 'bob', createdAt: '2025-01-02T00:00:00Z', status: 'live',
      });
      expect(result.iterations[2]).toEqual({
        revision: 3, commitSha: 'ccc', baseSha: 'base-sha', author: 'alice', createdAt: '2025-01-03T00:00:00Z', status: 'live',
      });
    });

    it('uses commit.author.name as fallback when author login is null', () => {
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'aaa', commit: { message: 'Commit', author: { name: 'Jane Doe', email: 'j@j.com', date: '2025-01-01T00:00:00Z' } }, author: null }),
      ];
      const result = buildIterationsFromCommits(commits, [], 'base', new Map());
      expect(result.iterations[0]).toMatchObject({ author: 'Jane Doe' });
    });

    it('inserts discovered discarded commits as collapsed iterations before live commits', () => {
      const forcePush = createMockForcePushEvent({
        id: 100, created_at: '2025-01-02T00:00:00Z',
        before_commit: { sha: 'old-head' }, after_commit: { sha: 'new-head' },
      });
      const discoveryResults = new Map<number, DiscoveryResult>([
        [100, {
          status: 'discovered',
          commits: [
            { sha: 'discarded-1', message: 'Old commit 1', author: 'dev', date: '2025-01-01T00:00:00Z', status: 'available' },
            { sha: 'discarded-2', message: 'Old commit 2', author: 'dev', date: '2025-01-01T12:00:00Z', status: 'available' },
          ],
        }],
      ]);
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'live-1', commit: { message: 'New commit', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-03T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      const result = buildIterationsFromCommits(commits, [forcePush], 'base-sha', discoveryResults);

      expect(result.iterations).toHaveLength(3);
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.iterations[0]).toMatchObject({ revision: 1, commitSha: 'discarded-1', status: 'collapsed', collapsedGroupId: 100 });
      expect(result.iterations[1]).toMatchObject({ revision: 2, commitSha: 'discarded-2', status: 'collapsed', collapsedGroupId: 100 });
      expect(result.iterations[2]).toMatchObject({ revision: 3, commitSha: 'live-1', status: 'live' });
      expect(result.collapsedGroups[0]).toMatchObject({ discardedRevisions: [1, 2] });
    });

    it('handles GCd force-push with unknownCount flag', () => {
      const forcePush = createMockForcePushEvent({ id: 200, created_at: '2025-01-01T00:00:00Z' });
      const discoveryResults = new Map<number, DiscoveryResult>([[200, { status: 'gc', commits: [] }]]);
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'live-1', commit: { message: 'Current', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-02T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      const result = buildIterationsFromCommits(commits, [forcePush], 'base', discoveryResults);

      expect(result.iterations).toHaveLength(1);
      expect(result.iterations[0]).toMatchObject({ revision: 1, status: 'live' });
      expect(result.collapsedGroups).toHaveLength(1);
      expect(result.collapsedGroups[0]).toMatchObject({ forcePushEventId: 200, unknownCount: true, discardedRevisions: [], commits: [] });
    });

    it('filters non-force-push timeline events', () => {
      const timeline: GitHubTimelineEvent[] = [
        createMockTimelineOtherEvent('commented', { id: 1 }),
        createMockTimelineOtherEvent('labeled', { id: 2 }),
      ];
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'aaa', commit: { message: 'Commit', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-01T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      const result = buildIterationsFromCommits(commits, timeline, 'base', new Map());

      expect(result.iterations).toHaveLength(1);
      expect(result.collapsedGroups).toHaveLength(0);
    });

    it('sorts all iterations chronologically and reassigns revision numbers', () => {
      const forcePush = createMockForcePushEvent({ id: 300, created_at: '2025-01-05T00:00:00Z' });
      const discoveryResults = new Map<number, DiscoveryResult>([
        [300, { status: 'discovered', commits: [{ sha: 'late-discarded', message: 'Late', author: 'dev', date: '2025-01-04T00:00:00Z', status: 'available' }] }],
      ]);
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'early-live', commit: { message: 'Early', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-01T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
        createMockPRCommit({ sha: 'mid-live', commit: { message: 'Mid', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-03T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      const result = buildIterationsFromCommits(commits, [forcePush], 'base', discoveryResults);

      expect(result.iterations).toHaveLength(3);
      expect(result.iterations[0]).toMatchObject({ revision: 1, commitSha: 'early-live', status: 'live' });
      expect(result.iterations[1]).toMatchObject({ revision: 2, commitSha: 'mid-live', status: 'live' });
      expect(result.iterations[2]).toMatchObject({ revision: 3, commitSha: 'late-discarded', status: 'collapsed' });
      expect(result.collapsedGroups[0]).toMatchObject({ discardedRevisions: [3] });
    });

    it('handles multiple force-push events with interleaved commits', () => {
      const fp1 = createMockForcePushEvent({ id: 10, created_at: '2025-01-02T00:00:00Z' });
      const fp2 = createMockForcePushEvent({ id: 20, created_at: '2025-01-04T00:00:00Z' });
      const discoveryResults = new Map<number, DiscoveryResult>([
        [10, { status: 'discovered', commits: [{ sha: 'fp1-old', message: 'FP1 old', author: 'dev', date: '2025-01-01T00:00:00Z', status: 'available' }] }],
        [20, { status: 'discovered', commits: [{ sha: 'fp2-old', message: 'FP2 old', author: 'dev', date: '2025-01-03T00:00:00Z', status: 'available' }] }],
      ]);
      const commits: GitHubPRCommit[] = [
        createMockPRCommit({ sha: 'final', commit: { message: 'Final', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-05T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
      ];

      const result = buildIterationsFromCommits(commits, [fp1, fp2], 'base', discoveryResults);

      expect(result.iterations).toHaveLength(3);
      expect(result.collapsedGroups).toHaveLength(2);
      expect(result.iterations[0]).toMatchObject({ revision: 1, commitSha: 'fp1-old', collapsedGroupId: 10 });
      expect(result.iterations[1]).toMatchObject({ revision: 2, commitSha: 'fp2-old', collapsedGroupId: 20 });
      expect(result.iterations[2]).toMatchObject({ revision: 3, commitSha: 'final', status: 'live' });
    });

    it('returns empty result for empty commits and no timeline events', () => {
      const result = buildIterationsFromCommits([], [], 'base', new Map());
      expect(result.iterations).toHaveLength(0);
      expect(result.collapsedGroups).toHaveLength(0);
    });
  });

  describe('discoverDiscardedCommits', () => {
    it('returns discovered commits from a successful compare response', () => {
      const compareCommits = [
        createMockCompareCommit({ sha: 'old-1', commit: { message: 'Old 1', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-01T00:00:00Z' } }, author: { id: 1, login: 'dev', avatar_url: '' } }),
        createMockCompareCommit({ sha: 'old-2', commit: { message: 'Old 2', author: { name: 'Dev', email: 'd@d.com', date: '2025-01-02T00:00:00Z' } }, author: null }),
      ];
      const compareResponse = createMockCompareResponse(compareCommits);

      const result = discoverDiscardedCommits(compareResponse);

      expect(result.status).toBe('discovered');
      expect(result.commits).toHaveLength(2);
      expect(result.commits[0]).toEqual({ sha: 'old-1', message: 'Old 1', author: 'dev', date: '2025-01-01T00:00:00Z', status: 'available' });
      expect(result.commits[1]).toMatchObject({ author: 'Dev' });
    });

    it('returns discovered with empty commits for empty compare response', () => {
      const result = discoverDiscardedCommits(createMockCompareResponse([]));
      expect(result).toEqual({ status: 'discovered', commits: [] });
    });
  });
});
