/**
 * Commit-Based Iteration Loader (S-4.2.1)
 *
 * Orchestrates GitHub API calls to fetch PR commits, timeline events,
 * and compare data, then delegates to CommitIterationBuilder for
 * pure iteration construction.
 */

import { githubClient, GitHubAPIError } from '@/api/github/github-client';
import type {
  GitHubPRCommit,
  GitHubTimelineEvent,
  GitHubTimelineForcePushEvent,
  GitHubCompareResponse,
} from '@/api/github/types';
import type { CommitIterationResult, DiscoveryResult } from '../types';
import { buildIterationsFromCommits, discoverDiscardedCommits } from './commit-iteration-builder';

function isForcePushEvent(
  event: GitHubTimelineEvent
): event is GitHubTimelineForcePushEvent {
  return event.event === 'head_ref_force_pushed';
}

export class CommitIterationLoader {
  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly prNumber: number,
  ) {}

  async load(baseSha: string): Promise<CommitIterationResult> {
    const [commits, timeline] = await Promise.all([
      this.fetchCommits(),
      this.fetchTimeline(),
    ]);

    const forcePushEvents = timeline.filter(isForcePushEvent);

    const discoveryEntries = await Promise.all(
      forcePushEvents.map(async (event) => {
        const result = await this.fetchDiscardedCommits(event);
        return [event.id, result] as const;
      })
    );
    const discoveryResults = new Map<number, DiscoveryResult>(discoveryEntries);

    return buildIterationsFromCommits(commits, timeline, baseSha, discoveryResults);
  }

  private async fetchCommits(): Promise<GitHubPRCommit[]> {
    return this.fetchAllPages<GitHubPRCommit>(
      `/repos/${this.owner}/${this.repo}/pulls/${this.prNumber}/commits`
    );
  }

  private async fetchTimeline(): Promise<GitHubTimelineEvent[]> {
    try {
      return await this.fetchAllPages<GitHubTimelineEvent>(
        `/repos/${this.owner}/${this.repo}/issues/${this.prNumber}/timeline`
      );
    } catch (error) {
      // Timeline API requires authentication — gracefully degrade without force-push detection
      if (error instanceof GitHubAPIError && (error.status === 404 || error.status === 403)) {
        console.info('[CodjiFlo] Timeline API unavailable, skipping force-push detection');
        return [];
      }
      throw error;
    }
  }

  /**
   * Fetch all pages from a paginated GitHub REST endpoint.
   * Uses per_page=100 and stops when a page returns fewer items.
   */
  private async fetchAllPages<T>(path: string): Promise<T[]> {
    const perPage = 100;
    const results: T[] = [];
    let page = 1;

    for (;;) {
      const items = await githubClient.fetch<T[]>(
        `${path}?per_page=${perPage}&page=${page}`
      );
      results.push(...items);
      if (items.length < perPage) break;
      page += 1;
    }

    return results;
  }

  private async fetchDiscardedCommits(
    event: GitHubTimelineForcePushEvent
  ): Promise<DiscoveryResult> {
    try {
      const compareResponse = await githubClient.fetch<GitHubCompareResponse>(
        `/repos/${this.owner}/${this.repo}/compare/${event.after_commit.sha}...${event.before_commit.sha}`
      );
      return discoverDiscardedCommits(compareResponse);
    } catch (error) {
      if (error instanceof GitHubAPIError && (error.status === 404 || error.status === 410)) {
        return { status: 'gc', commits: [] };
      }
      throw error;
    }
  }
}
