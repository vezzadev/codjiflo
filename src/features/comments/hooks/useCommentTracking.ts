/**
 * Hook for tracking comment positions across iterations
 *
 * Uses SpanTracker to map outdated comments (line: null) to their
 * current positions based on original_line and original_commit_id
 * from the GitHub API.
 *
 * In stateful mode: Uses artifact-based SpanTracker service
 * In stateless mode: Uses scheduler-computed SpanTracker results
 */

import { useEffect, useRef, useCallback } from 'react';
import { useCommentsStore } from '../stores';
import { useIterationStore, selectSelectedRange } from '@/features/iterations/stores';
import { singleLine } from '@/features/iterations/domain';
import { useScheduler } from '@/features/diff/scheduler/context';
import { usePRStore } from '@/features/pr/stores';
import type { ReviewThread } from '../types';
import type { LineMapping, SpanTrackerResult, DiffResult } from '@/features/diff/scheduler/types';

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
 * Build task ID for SpanTracker result lookup.
 * Must match the format used in useSpanTrackerPrecompute.
 */
function buildSpanTrackerTaskId(filePath: string, leftSha: string, rightSha: string): string {
  return `span-tracker-${filePath}-${leftSha}-${rightSha}`;
}

/**
 * Map a line number using SpanTracker mappings.
 *
 * @param originalLine - The original line number to map
 * @param mappings - Line mappings from SpanTracker computation
 * @returns The mapped line number, or null if line was deleted
 */
function mapLineUsingMappings(
  originalLine: number,
  mappings: LineMapping[]
): number | null {
  // Find the mapping for this specific line
  const mapping = mappings.find((m) => m.leftLine === originalLine);

  if (!mapping) {
    // Line not found in mappings - could be beyond the file
    return null;
  }

  // Return rightLine (null means line was deleted)
  return mapping.rightLine;
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
 * In stateful mode: Uses artifact-based SpanTracker service
 * In stateless mode: Uses scheduler-computed SpanTracker results
 */
export function useCommentTracking(): void {
  const { threads, updateTrackedPositions } = useCommentsStore();
  const { iterations, mode, artifacts, getSpanTrackerService } = useIterationStore();
  const selectedRange = useIterationStore(selectSelectedRange);
  const headSha = usePRStore((s) => s.currentPR?.headSha);
  const scheduler = useScheduler();

  // Cache keys to prevent redundant computation
  const statefulCacheKeyRef = useRef<string>('');
  const statelessCacheKeyRef = useRef<string>('');

  // Stateful mode effect - uses artifact-based SpanTracker
  useEffect(() => {
    if (mode !== 'stateful') return;

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
    if (cacheKey === statefulCacheKeyRef.current) return;
    statefulCacheKeyRef.current = cacheKey;

    // Skip if no threads need tracking
    if (threadsNeedingTracking.length === 0) return;

    // Track positions asynchronously
    void trackPositionsStateful(
      threadsNeedingTracking,
      iterations,
      artifacts,
      selectedRange,
      spanTrackerService,
      updateTrackedPositions
    );
  }, [threads, iterations, mode, artifacts, selectedRange, getSpanTrackerService, updateTrackedPositions]);

  // Callback to process threads in stateless mode
  const processStatelessThreads = useCallback(() => {
    if (mode !== 'stateless') return;

    // Need PR headSha to know target commit
    if (!headSha) return;

    const targetSha = headSha;

    // Filter threads needing tracking
    const threadsNeedingTracking = threads.filter(
      (t) => t.line === null && t.originalLine !== null && t.originalCommitId !== null
    );

    if (threadsNeedingTracking.length === 0) return;

    // Build cache key
    const cacheKey = JSON.stringify({
      threadIds: threadsNeedingTracking.map((t) => t.id).sort(),
      targetSha,
    });

    // Skip if nothing changed
    if (cacheKey === statelessCacheKeyRef.current) return;

    // Compute updates from available scheduler results
    const updates = new Map<string, number | null>();
    let hasAnyResult = false;

    for (const thread of threadsNeedingTracking) {
      if (thread.originalCommitId === null || thread.originalLine === null) {
        continue;
      }

      // Build task ID matching useSpanTrackerPrecompute format
      const taskId = buildSpanTrackerTaskId(
        thread.path,
        thread.originalCommitId,
        targetSha
      );

      // Try to get result from scheduler
      const result = scheduler.getSpanTrackerResult(taskId);

      if (!result) {
        // Result not yet available - will be updated via subscription
        continue;
      }

      hasAnyResult = true;

      if (result.status !== 'completed' || !result.mappings) {
        // Error or cancelled - cannot map
        updates.set(thread.id, null);
        continue;
      }

      // Map the line using the computed mappings
      const mappedLine = mapLineUsingMappings(thread.originalLine, result.mappings);
      updates.set(thread.id, mappedLine);
    }

    // Only update cache key if we processed all threads
    if (hasAnyResult && updates.size === threadsNeedingTracking.length) {
      statelessCacheKeyRef.current = cacheKey;
    }

    // Update store with computed positions
    if (updates.size > 0) {
      updateTrackedPositions(updates);
    }
  }, [mode, headSha, threads, scheduler, updateTrackedPositions]);

  // Stateless mode effect - uses scheduler-computed SpanTracker results
  useEffect(() => {
    if (mode !== 'stateless') return;

    // Process immediately with any available results
    processStatelessThreads();

    // Subscribe to scheduler completion events to handle async results
    const unsubscribe = scheduler.onComplete((result: DiffResult | SpanTrackerResult) => {
      // Only interested in SpanTracker results
      if (!result.taskId.startsWith('span-tracker-')) return;

      // Re-process threads when new results arrive
      processStatelessThreads();
    });

    return unsubscribe;
  }, [mode, scheduler, processStatelessThreads]);
}

/**
 * Compute tracked positions for threads in stateful mode.
 * Uses artifact-based SpanTracker service.
 */
async function trackPositionsStateful(
  threads: ReviewThread[],
  iterations: { revision: number; headSha: string }[],
  artifacts: { id: number; repoPaths: (string | null)[] }[],
  selectedRange: { fromSnapshot: number; toSnapshot: number },
  spanTrackerService: { trackCommentForward: (artifactId: number, originalSnapshot: number, originalSpan: { startLine: number; endLine: number }, targetSnapshot: number) => Promise<{ startLine: number; endLine: number } | null> },
  updateTrackedPositions: (updates: Map<string, number | null>) => void
): Promise<void> {
  const updates = new Map<string, number | null>();

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
