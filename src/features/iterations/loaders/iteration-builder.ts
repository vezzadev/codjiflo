/**
 * Iteration Builder (Task 1.5)
 *
 * Combines commits and force-push events into StatelessIterationData.
 * This is the final step in Phase 1 of stateless iteration loading.
 *
 * @see spec/functional/iterations.md
 */

import { tracer, SemanticAttributes } from '@/lib/tracing';
import type {
  StatelessIteration,
  CollapsedIterationGroup,
  ForcePushEvent,
  StatelessIterationData,
} from '../types';
import type { PRCommit } from './commit-loader';

// ============================================================================
// Types
// ============================================================================

/** Internal representation during building */
interface CommitWithLineage {
  sha: string;
  message: string;
  author: string;
  createdAt: Date;
  lineage: 'current' | 'discarded';
  collapsedGroupId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a CollapsedIterationGroup, only including unavailableReason if needed.
 */
function createCollapsedGroup(
  id: string,
  beforeSha: string,
  afterSha: string,
  hasDiscardedCommits: boolean,
  hasForcePushEvents: boolean
): CollapsedIterationGroup {
  const base: CollapsedIterationGroup = {
    id,
    beforeSha,
    afterSha,
    iterations: [],
    visibility: 'collapsed',
  };

  if (!hasDiscardedCommits && hasForcePushEvents) {
    base.unavailableReason = 'commits_unavailable';
  }

  return base;
}

/**
 * Create a StatelessIteration, only including collapsedGroupId if present.
 */
function createIteration(
  revision: number,
  commitSha: string,
  baseSha: string,
  author: string,
  message: string,
  createdAt: Date,
  lineage: 'current' | 'discarded',
  collapsedGroupId?: string
): StatelessIteration {
  const base: StatelessIteration = {
    revision,
    commitSha,
    baseSha,
    author,
    message,
    createdAt,
    lineage,
  };

  if (collapsedGroupId) {
    base.collapsedGroupId = collapsedGroupId;
  }

  return base;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Build StatelessIterationData from commits and force-push events.
 *
 * @param liveCommits - Commits currently in PR HEAD history
 * @param forcePushEvents - Force-push events from timeline API
 * @param prBaseSha - Base SHA of the PR (target branch merge base)
 * @param discardedCommits - Optional commits orphaned by force-pushes
 * @returns StatelessIterationData with iterations and collapsed groups
 */
export function buildStatelessIterations(
  liveCommits: PRCommit[],
  forcePushEvents: ForcePushEvent[],
  prBaseSha: string,
  discardedCommits?: PRCommit[]
): StatelessIterationData {
  const span = tracer.startSpan('buildStatelessIterations', {
    [SemanticAttributes.ITERATION_COUNT]: liveCommits.length,
    'force_push.count': forcePushEvents.length,
    'discarded.count': discardedCommits?.length ?? 0,
  });

  try {
    // Sort force-push events by timestamp
    const sortedForcePushes = [...forcePushEvents].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Determine if discarded commits are available
    const hasDiscardedCommits = discardedCommits !== undefined && discardedCommits.length > 0;
    const hasForcePushEvents = forcePushEvents.length > 0;

    // Create collapsed groups from force-push events
    const collapsedGroups: CollapsedIterationGroup[] = sortedForcePushes.map((fp, index) =>
      createCollapsedGroup(
        `group-${index}-${fp.afterSha.slice(0, 7)}`,
        fp.beforeSha,
        fp.afterSha,
        hasDiscardedCommits,
        hasForcePushEvents
      )
    );

    // Tag live commits
    const taggedLive: CommitWithLineage[] = liveCommits.map(c => ({
      sha: c.sha,
      message: c.message,
      author: c.author,
      createdAt: c.createdAt,
      lineage: 'current' as const,
    }));

    // Tag discarded commits with their group assignments
    const taggedDiscarded: CommitWithLineage[] = [];
    if (discardedCommits) {
      // Sort discarded commits by timestamp to determine group membership
      const sortedDiscarded = [...discardedCommits].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      // Assign discarded commits to groups
      // A commit belongs to the group whose force-push came after its creation
      for (const commit of sortedDiscarded) {
        // Find the group that discarded this commit
        // The commit is discarded by the first force-push whose beforeSha matches
        // or by any force-push that happened after this commit
        let assignedGroupId: string | undefined;

        for (let i = 0; i < collapsedGroups.length; i++) {
          const group = collapsedGroups[i];
          const forcePush = sortedForcePushes[i];

          if (group && forcePush && commit.createdAt.getTime() < forcePush.timestamp.getTime()) {
            // This commit was created before this force-push
            // Assign to the first matching group
            assignedGroupId ??= group.id;
          }
        }

        // Fallback: if we couldn't determine, assign to the first group
        const firstGroup = collapsedGroups[0];
        assignedGroupId ??= firstGroup?.id;

        const tagged: CommitWithLineage = {
          sha: commit.sha,
          message: commit.message,
          author: commit.author,
          createdAt: commit.createdAt,
          lineage: 'discarded' as const,
        };

        if (assignedGroupId) {
          tagged.collapsedGroupId = assignedGroupId;
        }

        taggedDiscarded.push(tagged);
      }
    }

    // Combine and sort all commits by timestamp
    const allCommits = [...taggedLive, ...taggedDiscarded].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    // Build iterations with sequential revision numbers
    const iterations: StatelessIteration[] = [];
    for (let index = 0; index < allCommits.length; index++) {
      const commit = allCommits[index];
      if (!commit) continue;

      const prevCommit = index > 0 ? allCommits[index - 1] : undefined;
      const baseSha = index === 0 ? prBaseSha : (prevCommit?.sha ?? prBaseSha);

      iterations.push(
        createIteration(
          index + 1,
          commit.sha,
          baseSha,
          commit.author,
          commit.message,
          commit.createdAt,
          commit.lineage,
          commit.collapsedGroupId
        )
      );
    }

    // Populate collapsed group iterations
    for (const group of collapsedGroups) {
      group.iterations = iterations.filter(i => i.collapsedGroupId === group.id);
    }

    span.setAttribute(SemanticAttributes.ITERATION_COUNT, iterations.length);
    span.setAttribute('collapsed_group.count', collapsedGroups.length);
    span.setStatus('ok');

    return {
      iterations,
      collapsedGroups,
    };
  } finally {
    span.end();
  }
}
