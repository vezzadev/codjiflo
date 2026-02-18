/**
 * Hook for tracking comment positions across iterations
 *
 * Uses SpanTracker to map outdated comments (line: null) to their
 * current positions based on original_line and original_commit_id
 * from the GitHub API.
 */

import { useEffect, useRef } from 'react';
import { useCommentsStore } from '../stores';
import { useIterationStore, selectSelectedRange } from '@/features/iterations/stores';
import { singleLine } from '@/features/iterations/domain';
import type { ReviewThread } from '../types';

/**
 * Find the snapshot index for a given commit SHA.
 * Each iteration has a headSha that corresponds to its right snapshot.
 */
function findSnapshotForCommit(
  iterations: { revision: number; headSha: string }[],
  commitSha: string
): number | null {
  for (const iteration of iterations) {
    if (iteration.headSha === commitSha) {
      // Right snapshot = (revision - 1) * 2 + 1
      return (iteration.revision - 1) * 2 + 1;
    }
  }
  return null;
}

/**
 * Hook that tracks comment positions through iterations using SpanTracker.
 *
 * For threads where:
 * - `line` is null (outdated/unmappable)
 * - `originalLine` is not null (we know where it was)
 * - `originalCommitId` matches a known iteration
 *
 * It computes the current position using SpanTracker and updates
 * the `trackedLine` field in the comments store.
 *
 * In stateless mode (no artifact), this hook does nothing.
 */
export function useCommentTracking(): void {
  const { threads, updateTrackedPositions } = useCommentsStore();
  const { iterations, mode, artifacts, getSpanTrackerService } = useIterationStore();
  const selectedRange = useIterationStore(selectSelectedRange);

  // Cache key to prevent redundant computation
  const lastCacheKeyRef = useRef<string>('');

  useEffect(() => {
    // Skip in stateless mode - no SpanTracker data available
    if (mode === 'stateless') return;

    // Skip if no selected range
    if (!selectedRange) return;

    // Skip if no iterations loaded
    if (iterations.length === 0) return;

    const spanTrackerService = getSpanTrackerService();
    if (!spanTrackerService) return;

    // Build cache key from threads needing tracking + selected range
    const threadsNeedingTracking = threads.filter(
      (t) => t.line === null && t.originalLine !== null && t.originalCommitId !== null
    );

    const cacheKey = JSON.stringify({
      threadIds: threadsNeedingTracking.map((t) => t.id).sort(),
      range: selectedRange,
    });

    // Skip if nothing changed
    if (cacheKey === lastCacheKeyRef.current) return;
    lastCacheKeyRef.current = cacheKey;

    // Skip if no threads need tracking
    if (threadsNeedingTracking.length === 0) return;

    // Track positions asynchronously
    void trackPositions(
      threadsNeedingTracking,
      iterations,
      artifacts,
      selectedRange,
      spanTrackerService,
      updateTrackedPositions
    );
  }, [threads, iterations, mode, artifacts, selectedRange, getSpanTrackerService, updateTrackedPositions]);
}

/**
 * Compute tracked positions for threads and update the store.
 */
async function trackPositions(
  threads: ReviewThread[],
  iterations: { revision: number; headSha: string }[],
  artifacts: { id: number; repoPaths: (string | null)[] }[],
  selectedRange: { fromSnapshot: number; toSnapshot: number },
  spanTrackerService: { trackCommentForward: (artifactId: number, originalSnapshot: number, originalSpan: { startLine: number; endLine: number }, targetSnapshot: number) => Promise<{ startLine: number; endLine: number } | null> },
  updateTrackedPositions: (updates: Map<string, number | null>) => void
): Promise<void> {
  const updates: Map<string, number | null> = new Map();

  for (const thread of threads) {
    // Skip if missing required fields (should not happen due to filter above)
    if (thread.originalCommitId === null || thread.originalLine === null) {
      updates.set(thread.id, null);
      continue;
    }

    // Find the original snapshot index from the commit SHA
    const originalSnapshot = findSnapshotForCommit(iterations, thread.originalCommitId);

    if (originalSnapshot === null) {
      // Comment predates our tracking - cannot map
      updates.set(thread.id, null);
      continue;
    }

    // Find artifact for this file path
    const artifact = artifacts.find((a) =>
      a.repoPaths.some((p) => p === thread.path)
    );

    if (!artifact) {
      // File not tracked - cannot map
      updates.set(thread.id, null);
      continue;
    }

    // Track the position forward to the target snapshot
    try {
      const originalSpan = singleLine(thread.originalLine);
      const trackedSpan = await spanTrackerService.trackCommentForward(
        artifact.id,
        originalSnapshot,
        originalSpan,
        selectedRange.toSnapshot
      );

      if (trackedSpan) {
        // Use the start line as the tracked position
        updates.set(thread.id, trackedSpan.startLine);
      } else {
        // Line was deleted
        updates.set(thread.id, null);
      }
    } catch {
      // SpanTracker error - cannot map
      updates.set(thread.id, null);
    }
  }

  // Update store with computed positions
  if (updates.size > 0) {
    updateTrackedPositions(updates);
  }
}
