/**
 * Timeline Loader
 *
 * Builds iteration history from GitHub's native APIs for stateless mode.
 * Each PR commit maps to one iteration. Force-push history detected via
 * Timeline API, discarded commits discovered via Compare API.
 *
 * See openspec/specs/iterations/spec.md (Stateless Mode requirements) for full architecture.
 */

import { githubClient, GitHubAPIError } from '@/api/github/github-client';
import type {
  Iteration,
  CollapsedIterationGroup,
  DiscardedCommit,
  TimelineLoaderResult,
} from './types';

// ============================================================================
// GitHub API Response Types (private)
// ============================================================================

interface PRCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string } | null;
}

interface TimelineEvent {
  id: number;
  event: string;
  created_at: string;
  before_commit?: { sha: string };
  after_commit?: { sha: string };
}

interface CompareResult {
  commits: PRCommit[];
}

type DiscoveryResult =
  | { status: 'discovered'; commits: DiscardedCommit[] }
  | { status: 'gc'; commits: [] };

// ============================================================================
// TimelineLoader Class
// ============================================================================

export class TimelineLoader {
  private owner: string;
  private repo: string;
  private prNumber: number;
  private baseSha: string;

  constructor(owner: string, repo: string, prNumber: number, baseSha: string) {
    this.owner = owner;
    this.repo = repo;
    this.prNumber = prNumber;
    this.baseSha = baseSha;
  }

  /**
   * Load iterations from GitHub Commits + Timeline APIs.
   * Returns iterations (live + collapsed) and collapsed groups.
   */
  async load(): Promise<TimelineLoaderResult> {
    const prKey = `${this.owner}/${this.repo}#${String(this.prNumber)}`;
    console.info(`[CodjiFlo] TimelineLoader: fetching commits and timeline for ${prKey}`);

    const [commits, timeline] = await Promise.all([
      this.fetchCommits(),
      this.fetchTimeline(),
    ]);

    console.info(
      `[CodjiFlo] TimelineLoader: found ${String(commits.length)} commit(s) and ` +
      `${String(timeline.length)} timeline event(s) for ${prKey}`
    );

    return this.buildIterations(commits, timeline);
  }

  // --------------------------------------------------------------------------
  // API Fetchers
  // --------------------------------------------------------------------------

  /**
   * Fetch all pages for a paginated GitHub REST endpoint returning arrays.
   * Uses per_page=100 and stops when a partial or empty page is returned.
   */
  private async fetchAllPages<T>(basePath: string): Promise<T[]> {
    const perPage = 100;
    const allItems: T[] = [];

    for (let page = 1; ; page++) {
      const pageItems = await githubClient.fetch<T[]>(
        `${basePath}?per_page=${String(perPage)}&page=${String(page)}`
      );
      allItems.push(...pageItems);

      if (pageItems.length < perPage) {
        break;
      }
    }

    return allItems;
  }

  private async fetchCommits(): Promise<PRCommit[]> {
    return this.fetchAllPages<PRCommit>(
      `/repos/${this.owner}/${this.repo}/pulls/${String(this.prNumber)}/commits`
    );
  }

  private async fetchTimeline(): Promise<TimelineEvent[]> {
    return this.fetchAllPages<TimelineEvent>(
      `/repos/${this.owner}/${this.repo}/issues/${String(this.prNumber)}/timeline`
    );
  }

  private async discoverDiscardedCommits(
    afterSha: string,
    beforeSha: string
  ): Promise<DiscoveryResult> {
    try {
      const comparison = await githubClient.fetch<CompareResult>(
        `/repos/${this.owner}/${this.repo}/compare/${afterSha}...${beforeSha}`
      );

      return {
        status: 'discovered',
        commits: comparison.commits.map((c) => ({
          sha: c.sha,
          message: c.commit.message,
          author: c.author?.login ?? c.commit.author.name,
          date: c.commit.author.date,
          status: 'available' as const,
        })),
      };
    } catch (error) {
      if (error instanceof GitHubAPIError && (error.status === 404 || error.status === 410)) {
        return { status: 'gc', commits: [] };
      }
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Iteration Building
  // --------------------------------------------------------------------------

  private async buildIterations(
    commits: PRCommit[],
    timeline: TimelineEvent[]
  ): Promise<TimelineLoaderResult> {
    const iterations: Iteration[] = [];
    const collapsedGroups: CollapsedIterationGroup[] = [];

    // Step 1: Extract force-push events, sorted chronologically
    const forcePushes = timeline
      .filter((e): e is TimelineEvent & { before_commit: { sha: string }; after_commit: { sha: string } } =>
        e.event === 'head_ref_force_pushed' &&
        e.before_commit !== undefined &&
        e.after_commit !== undefined
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (forcePushes.length > 0) {
      console.info(
        `[CodjiFlo] TimelineLoader: detected ${String(forcePushes.length)} force-push event(s)`
      );
    }

    // Step 2: Discover discarded commits for each force-push (sequential -- each needs API call)
    for (const event of forcePushes) {
      const discovery = await this.discoverDiscardedCommits(
        event.after_commit.sha,
        event.before_commit.sha
      );

      const eventId = String(event.id);

      if (discovery.status === 'discovered') {
        console.info(
          `[CodjiFlo] TimelineLoader: discovered ${String(discovery.commits.length)} discarded ` +
          `commit(s) from force-push (before: ${event.before_commit.sha.slice(0, 7)})`
        );

        const group: CollapsedIterationGroup = {
          forcePushEventId: eventId,
          discardedRevisions: [], // assigned after sorting
          commits: discovery.commits,
          reason: 'force_push',
          visibility: 'collapsed',
        };

        for (const commit of discovery.commits) {
          iterations.push({
            id: 0, // placeholder, assigned after sorting
            revision: 0, // placeholder, assigned after sorting
            headSha: commit.sha,
            baseSha: this.baseSha,
            beforeSha: event.before_commit.sha,
            author: commit.author,
            createdAt: new Date(commit.date),
            status: 'collapsed',
            collapsedGroupId: eventId,
          });
        }

        collapsedGroups.push(group);
      } else {
        // GC'd: no individual commits, just record the force-push happened
        // This is an expected condition when old commits are garbage-collected
        console.info(
          `[CodjiFlo] TimelineLoader: discarded commits from force-push are no longer accessible ` +
          `(before SHA ${event.before_commit.sha.slice(0, 7)} garbage-collected)`
        );
        collapsedGroups.push({
          forcePushEventId: eventId,
          discardedRevisions: [],
          commits: [],
          reason: 'force_push',
          visibility: 'collapsed',
          unknownCount: true,
        });
      }
    }

    // Step 3: Add current PR commits as live iterations
    for (const commit of commits) {
      iterations.push({
        id: 0, // placeholder
        revision: 0, // placeholder
        headSha: commit.sha,
        baseSha: this.baseSha,
        beforeSha: null,
        author: commit.author?.login ?? commit.commit.author.name,
        createdAt: new Date(commit.commit.author.date),
        status: 'live',
      });
    }

    // Step 4: Sort chronologically
    iterations.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Step 5: Assign sequential revision numbers and negative IDs
    for (const [i, iteration] of iterations.entries()) {
      const revision = i + 1;
      iteration.revision = revision;
      iteration.id = -revision; // negative IDs for stateless
    }

    // Step 6: Update collapsed group revision numbers
    for (const group of collapsedGroups) {
      group.discardedRevisions = iterations
        .filter((i) => i.collapsedGroupId === group.forcePushEventId)
        .map((i) => i.revision);
    }

    return { iterations, collapsedGroups };
  }
}
