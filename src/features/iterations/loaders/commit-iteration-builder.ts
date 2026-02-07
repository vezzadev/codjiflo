/**
 * Commit-Based Iteration Builder (S-4.2.1)
 *
 * Pure logic for building stateless iterations from GitHub API responses.
 * No I/O - takes pre-fetched data and returns structured results.
 */

import type {
  GitHubPRCommit,
  GitHubTimelineEvent,
  GitHubTimelineForcePushEvent,
  GitHubCompareResponse,
} from '@/api/github/types';
import type {
  StatelessIteration,
  CollapsedIterationGroup,
  DiscoveryResult,
  CommitIterationResult,
} from '../types';

function isForcePushEvent(
  event: GitHubTimelineEvent
): event is GitHubTimelineForcePushEvent {
  return event.event === 'head_ref_force_pushed';
}

function extractAuthor(commit: GitHubPRCommit): string {
  return commit.author?.login ?? commit.commit.author.name;
}

export function discoverDiscardedCommits(
  compareResponse: GitHubCompareResponse
): DiscoveryResult {
  return {
    status: 'discovered',
    commits: compareResponse.commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.author?.login ?? c.commit.author.name,
      date: c.commit.author.date,
      status: 'available' as const,
    })),
  };
}

export function buildIterationsFromCommits(
  commits: GitHubPRCommit[],
  timeline: GitHubTimelineEvent[],
  baseSha: string,
  discoveryResults: Map<number, DiscoveryResult>
): CommitIterationResult {
  const iterations: StatelessIteration[] = [];
  const collapsedGroups: CollapsedIterationGroup[] = [];

  const forcePushes = timeline
    .filter(isForcePushEvent)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  for (const event of forcePushes) {
    const discovery = discoveryResults.get(event.id);

    if (!discovery || discovery.status === 'gc') {
      collapsedGroups.push({
        forcePushEventId: event.id,
        discardedRevisions: [],
        commits: [],
        reason: 'force_push',
        visibility: 'collapsed',
        unknownCount: true,
      });
      continue;
    }

    const group: CollapsedIterationGroup = {
      forcePushEventId: event.id,
      discardedRevisions: [],
      commits: discovery.commits,
      reason: 'force_push',
      visibility: 'collapsed',
    };

    for (const commit of discovery.commits) {
      iterations.push({
        revision: 0,
        commitSha: commit.sha,
        baseSha,
        author: commit.author,
        createdAt: commit.date,
        status: 'collapsed',
        collapsedGroupId: event.id,
      });
    }

    collapsedGroups.push(group);
  }

  for (const commit of commits) {
    iterations.push({
      revision: 0,
      commitSha: commit.sha,
      baseSha,
      author: extractAuthor(commit),
      createdAt: commit.commit.author.date,
      status: 'live',
    });
  }

  iterations.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (let i = 0; i < iterations.length; i++) {
    const iteration = iterations[i];
    if (iteration) {
      iteration.revision = i + 1;
    }
  }

  for (const group of collapsedGroups) {
    group.discardedRevisions = iterations
      .filter((iter) => iter.collapsedGroupId === group.forcePushEventId)
      .map((iter) => iter.revision);
  }

  return { iterations, collapsedGroups };
}
