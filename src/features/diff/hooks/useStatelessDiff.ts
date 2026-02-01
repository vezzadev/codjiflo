/**
 * Hook for loading diffs asynchronously via the scheduler (stateless mode).
 *
 * This hook integrates the DiffScheduler with React components to provide
 * async diff loading with caching and priority-based scheduling.
 */

import { useMemo, useSyncExternalStore, useEffect, useRef } from 'react';
import { useScheduler } from '../scheduler/context';
import type { DiffTask } from '../scheduler/types';
import { DiffPriority } from '../scheduler/types';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

/**
 * Result type for the useStatelessDiff hook
 */
export interface UseStatelessDiffResult {
  /** Current status of the diff computation */
  status: 'loading' | 'completed' | 'error' | 'unavailable';
  /** Parsed diff lines (available when status is 'completed') */
  diffLines?: ParsedDiffLine[];
  /** Aligned diff lines for side-by-side view (available when status is 'completed') */
  alignedLines?: AlignedDiffLine[];
  /** Error message (available when status is 'error') */
  error?: string;
  /** Reason the diff is unavailable (available when status is 'unavailable') */
  unavailableReason?: '404' | '410';
}

/**
 * Generate a consistent task ID from diff parameters.
 */
function generateTaskId(
  filePath: string,
  leftSha: string,
  rightSha: string,
  compareMode: '2dot' | '3dot'
): string {
  return `${filePath}:${leftSha}:${rightSha}:${compareMode}`;
}

/**
 * Hook to load diffs asynchronously via the scheduler.
 *
 * - Checks the scheduler cache first
 * - If not cached, schedules at Highest priority (user is viewing this file)
 * - Subscribes to completion events
 * - Returns loading state while computing
 *
 * @param filePath - Path to the file being diffed
 * @param leftSha - Base commit SHA
 * @param rightSha - Head commit SHA
 * @param compareMode - Compare mode ('2dot' for A..B, '3dot' for A...B)
 */
export function useStatelessDiff(
  filePath: string,
  leftSha: string,
  rightSha: string,
  compareMode: '2dot' | '3dot' = '2dot'
): UseStatelessDiffResult {
  const scheduler = useScheduler();

  // Generate task ID for this diff
  const taskId = useMemo(
    () => generateTaskId(filePath, leftSha, rightSha, compareMode),
    [filePath, leftSha, rightSha, compareMode]
  );

  // Track if we've scheduled the task for this taskId
  const scheduledRef = useRef<string | null>(null);

  // Create subscribe function for useSyncExternalStore
  // This function is called by React to subscribe to external state changes
  const subscribe = useMemo(() => {
    return (onStoreChange: () => void) => {
      // Subscribe to completion events from scheduler
      const unsubscribe = scheduler.onComplete((result) => {
        if (result.taskId === taskId) {
          onStoreChange();
        }
      });
      return unsubscribe;
    };
  }, [scheduler, taskId]);

  // Get current snapshot of the result
  const getSnapshot = useMemo(() => {
    return () => scheduler.getResult(taskId);
  }, [scheduler, taskId]);

  // Subscribe to external store (scheduler) and get result
  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Schedule task if not cached (side effect)
  useEffect(() => {
    // Skip if already scheduled for this taskId or if result is cached
    if (scheduledRef.current === taskId) {
      return;
    }

    // Check if result is already cached
    if (scheduler.getResult(taskId)) {
      scheduledRef.current = taskId;
      return;
    }

    // Create the task
    const task: DiffTask = {
      taskId,
      type: 'compute_diff',
      filePath,
      leftSha,
      rightSha,
      compareMode,
    };

    // Schedule at Highest priority since user is actively viewing this file
    scheduler.schedule(task, {
      priority: DiffPriority.Highest,
    });

    scheduledRef.current = taskId;
  }, [scheduler, taskId, filePath, leftSha, rightSha, compareMode]);

  // Convert DiffResult to UseStatelessDiffResult
  return useMemo((): UseStatelessDiffResult => {
    if (!result) {
      return { status: 'loading' };
    }

    switch (result.status) {
      case 'completed': {
        const output: UseStatelessDiffResult = { status: 'completed' };
        if (result.diffLines) {
          output.diffLines = result.diffLines;
        }
        if (result.alignedLines) {
          output.alignedLines = result.alignedLines;
        }
        return output;
      }
      case 'error': {
        const output: UseStatelessDiffResult = { status: 'error' };
        if (result.error) {
          output.error = result.error;
        }
        return output;
      }
      case 'unavailable': {
        const output: UseStatelessDiffResult = { status: 'unavailable' };
        if (result.unavailableReason) {
          output.unavailableReason = result.unavailableReason;
        }
        return output;
      }
      case 'cancelled':
        // Treat cancelled as loading - will be rescheduled
        return { status: 'loading' };
    }
  }, [result]);
}
