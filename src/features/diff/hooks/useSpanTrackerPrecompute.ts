/**
 * useSpanTrackerPrecompute Hook
 *
 * Schedules SpanTracker computation for files with comments at Low priority.
 * Triggers after the first file diff loads to avoid slowing initial render.
 *
 * SpanTracker enables mapping comment positions across iterations in stateless mode,
 * where we don't have pre-computed artifact data from the GitHub Action.
 */

import { useEffect, useRef } from 'react';
import { useScheduler } from '../scheduler/context';
import { DiffPriority } from '../scheduler/types';
import type { DiffTask } from '../scheduler/types';

/**
 * Information about a file that has comments and needs SpanTracker computation
 */
export interface FileWithComments {
  /** Path to the file in the repository */
  filePath: string;
  /** Left commit SHA for the diff */
  leftSha: string;
  /** Right commit SHA for the diff */
  rightSha: string;
  /** Number of comments on this file (used for priority within Low) */
  commentCount: number;
}

export interface UseSpanTrackerPrecomputeOptions {
  /** Files with comments that need SpanTrackers */
  filesWithComments: FileWithComments[];
  /** Whether the first diff has loaded (trigger condition) */
  firstDiffLoaded: boolean;
  /** Current iteration mode */
  mode: 'stateful' | 'stateless';
}

/**
 * Schedules SpanTracker computation for files with comments in stateless mode.
 *
 * This hook waits until the first diff has loaded to avoid slowing the initial
 * render, then schedules Low priority SpanTracker tasks for all files that
 * have comments. The comment count is passed to the scheduler so files with
 * more comments get computed first within the Low priority tier.
 *
 * In stateful mode, SpanTrackers are pre-computed by the GitHub Action and
 * stored in the artifact, so this hook does nothing.
 *
 * @example
 * ```tsx
 * useSpanTrackerPrecompute({
 *   filesWithComments: [
 *     { filePath: 'src/app.ts', leftSha: 'abc', rightSha: 'def', commentCount: 3 }
 *   ],
 *   firstDiffLoaded: true,
 *   mode: 'stateless'
 * });
 * ```
 */
export function useSpanTrackerPrecompute(options: UseSpanTrackerPrecomputeOptions): void {
  const { filesWithComments, firstDiffLoaded, mode } = options;
  const scheduler = useScheduler();
  const hasScheduled = useRef(false);

  useEffect(() => {
    // Only run in stateless mode - in stateful mode, SpanTrackers are pre-computed
    if (mode !== 'stateless') {
      return;
    }

    // Don't schedule until first diff loads to avoid slowing initial render
    if (!firstDiffLoaded) {
      return;
    }

    // Only schedule once - avoid re-scheduling on re-renders
    if (hasScheduled.current) {
      return;
    }

    // Don't schedule if no files with comments
    if (filesWithComments.length === 0) {
      return;
    }

    hasScheduled.current = true;

    // Schedule SpanTracker computation for each file with comments
    for (const file of filesWithComments) {
      const task: DiffTask = {
        taskId: `span-tracker-${file.filePath}-${file.leftSha}-${file.rightSha}`,
        type: 'compute_span_tracker',
        filePath: file.filePath,
        leftSha: file.leftSha,
        rightSha: file.rightSha,
        compareMode: '2dot',
      };

      scheduler.schedule(task, {
        priority: DiffPriority.Low,
        commentCount: file.commentCount,
      });
    }
  }, [mode, firstDiffLoaded, filesWithComments, scheduler]);
}
