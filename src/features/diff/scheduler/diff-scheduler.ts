/**
 * Diff Scheduler - Priority-based diff computation scheduler (Task 3.6)
 *
 * Manages a priority queue of diff computation tasks and dispatches them
 * to the Web Worker. Supports priority bumping, caching, and cancellation.
 */

import type { DiffComputeAPI } from '../workers/diff-compute.api';
import type {
  DiffTask,
  DiffResult,
  DiffScheduler,
  ScheduleOptions,
  ScheduledTask,
} from './types';
import { DiffPriority } from './types';
import { PriorityQueue } from './priority-queue';
import { tracer, SemanticAttributes } from '@/lib/tracing';

/**
 * Multi-key comparator for scheduling priority.
 *
 * Sort order (highest priority first):
 * 1. Priority level (lower number = higher priority)
 * 2. Comment count (higher = higher priority)
 * 3. UI order (lower = higher priority, i.e., higher in list)
 * 4. Enqueue time (earlier = higher priority, FIFO)
 */
const scheduledTaskComparator = (a: ScheduledTask, b: ScheduledTask): number => {
  // Lower priority number = higher priority (Highest=0, Low=3)
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  // Higher comment count = higher priority
  if (a.commentCount !== b.commentCount) {
    return b.commentCount - a.commentCount;
  }
  // Lower UI order = higher priority
  if (a.uiOrder !== b.uiOrder) {
    return a.uiOrder - b.uiOrder;
  }
  // Earlier enqueued = higher priority (FIFO)
  return a.enqueuedAt - b.enqueuedAt;
};

/**
 * Create a diff scheduler instance.
 *
 * @param worker - The Comlink-wrapped diff compute worker
 * @returns DiffScheduler instance
 */
export function createDiffScheduler(worker: DiffComputeAPI): DiffScheduler {
  const queue = new PriorityQueue<ScheduledTask>(scheduledTaskComparator);
  const results = new Map<string, DiffResult>();
  const callbacks = new Set<(result: DiffResult) => void>();

  let inFlightTask: ScheduledTask | null = null;
  let isProcessing = false;

  /**
   * Notify all callbacks of a completed task
   */
  function notifyComplete(result: DiffResult): void {
    for (const callback of callbacks) {
      callback(result);
    }
  }

  /**
   * Process the next task from the queue
   */
  async function processNext(): Promise<void> {
    if (isProcessing) {
      return;
    }

    const next = queue.pop();
    if (!next) {
      return;
    }

    // Check if already cached
    const cached = results.get(next.task.taskId);
    if (cached) {
      // Skip processing, result already available
      queueMicrotask(() => {
        void processNext();
      });
      return;
    }

    isProcessing = true;
    inFlightTask = next;

    const span = tracer.startSpan('diff.scheduler.processTask', {
      [SemanticAttributes.TASK_ID]: next.task.taskId,
      [SemanticAttributes.TASK_TYPE]: next.task.type,
      [SemanticAttributes.TASK_PRIORITY]: next.priority,
      [SemanticAttributes.DIFF_FILE_PATH]: next.task.filePath,
      [SemanticAttributes.TASK_QUEUE_DEPTH]: queue.size(),
    });

    try {
      span.addEvent('task.started');

      // Dispatch to appropriate worker method based on task type
      const result = next.task.type === 'compute_span_tracker'
        ? await worker.computeSpanTracker(next.task)
        : await worker.computeDiff(next.task);

      span.addEvent('task.completed', {
        [SemanticAttributes.TASK_STATUS]: result.status,
      });

      // Cache the result
      results.set(next.task.taskId, result);

      // Notify subscribers
      notifyComplete(result);

      span.setStatus('ok');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      span.addEvent('task.error', { error: errorMessage });
      span.setStatus('error', errorMessage);

      // Create error result
      const errorResult: DiffResult = {
        taskId: next.task.taskId,
        status: 'error',
        error: errorMessage,
      };

      results.set(next.task.taskId, errorResult);
      notifyComplete(errorResult);
    } finally {
      span.end();
      inFlightTask = null;
      isProcessing = false;

      // Process next task
      queueMicrotask(() => {
        void processNext();
      });
    }
  }

  /**
   * Check if a new task should preempt the current in-flight task
   */
  function shouldPreempt(newTask: ScheduledTask): boolean {
    if (!inFlightTask) {
      return false;
    }

    // Only preempt if new task has Highest priority and in-flight is lower
    return (
      newTask.priority === DiffPriority.Highest &&
      inFlightTask.priority > DiffPriority.Highest
    );
  }

  const scheduler: DiffScheduler = {
    schedule(task: DiffTask, options: ScheduleOptions): string {
      const span = tracer.startSpan('diff.scheduler.schedule', {
        [SemanticAttributes.TASK_ID]: task.taskId,
        [SemanticAttributes.TASK_PRIORITY]: options.priority,
        [SemanticAttributes.DIFF_FILE_PATH]: task.filePath,
      });

      try {
        // Return cached result immediately if available
        if (results.has(task.taskId)) {
          span.addEvent('cache.hit');
          span.setStatus('ok');
          return task.taskId;
        }

        const scheduledTask: ScheduledTask = {
          task,
          priority: options.priority,
          commentCount: options.commentCount ?? 0,
          uiOrder: options.uiOrder ?? 0,
          enqueuedAt: Date.now(),
        };

        // Check for preemption
        if (shouldPreempt(scheduledTask) && inFlightTask) {
          span.addEvent('preempt.inFlight', {
            cancelledTaskId: inFlightTask.task.taskId,
          });

          // Cancel the in-flight task
          worker.cancel(inFlightTask.task.taskId);
          // Re-queue the cancelled task
          queue.push(inFlightTask);
          inFlightTask = null;
          isProcessing = false;
        }

        queue.push(scheduledTask);

        span.addEvent('task.queued', {
          [SemanticAttributes.TASK_QUEUE_DEPTH]: queue.size(),
        });

        // Start processing if not already
        queueMicrotask(() => {
          void processNext();
        });

        span.setStatus('ok');
        return task.taskId;
      } finally {
        span.end();
      }
    },

    prioritize(taskId: string): void {
      const span = tracer.startSpan('diff.scheduler.prioritize', {
        [SemanticAttributes.TASK_ID]: taskId,
      });

      try {
        const updated = queue.update(
          (item) => item.task.taskId === taskId,
          (item) => ({
            ...item,
            priority: DiffPriority.Highest,
            enqueuedAt: 0, // Ensure it's processed first among equals
          })
        );

        if (updated) {
          span.addEvent('task.prioritized');
        } else {
          span.addEvent('task.notFound');
        }

        span.setStatus('ok');
      } finally {
        span.end();
      }
    },

    clear(): void {
      const span = tracer.startSpan('diff.scheduler.clear', {
        [SemanticAttributes.TASK_QUEUE_DEPTH]: queue.size(),
      });

      try {
        // Cancel in-flight task
        if (inFlightTask) {
          worker.cancel(inFlightTask.task.taskId);
          inFlightTask = null;
          isProcessing = false;
        }

        // Clear queue
        queue.clear();

        // Clear results cache
        results.clear();

        span.addEvent('scheduler.cleared');
        span.setStatus('ok');
      } finally {
        span.end();
      }
    },

    getResult(taskId: string): DiffResult | undefined {
      return results.get(taskId);
    },

    onComplete(callback: (result: DiffResult) => void): () => void {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  };

  return scheduler;
}
