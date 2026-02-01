/**
 * Tests for DiffScheduler - priority-based diff computation scheduler (Task 3.6)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDiffScheduler } from './diff-scheduler';
import type { DiffComputeAPI } from '../workers/diff-compute.api';
import type { DiffTask, DiffResult, ScheduleOptions, DiffScheduler } from './types';
import { DiffPriority } from './types';

// Mock worker that tracks calls and can be controlled
function createMockWorker(): DiffComputeAPI & {
  computeDiffCalls: DiffTask[];
  resolvers: Map<string, (result: DiffResult) => void>;
  resolveTask: (taskId: string, result: Partial<DiffResult>) => void;
} {
  const computeDiffCalls: DiffTask[] = [];
  const resolvers = new Map<string, (result: DiffResult) => void>();

  return {
    computeDiffCalls,
    resolvers,
    init: vi.fn().mockResolvedValue(undefined),
    computeDiff: vi.fn((task: DiffTask) => {
      computeDiffCalls.push(task);
      return new Promise<DiffResult>((resolve) => {
        resolvers.set(task.taskId, resolve);
      });
    }),
    computeSpanTracker: vi.fn().mockResolvedValue({ taskId: '', status: 'completed' }),
    cancel: vi.fn(),
    resolveTask(taskId: string, result: Partial<DiffResult>) {
      const resolver = resolvers.get(taskId);
      if (resolver) {
        resolver({ taskId, status: 'completed', ...result });
        resolvers.delete(taskId);
      }
    },
  };
}

function createTask(overrides: Partial<DiffTask> = {}): DiffTask {
  return {
    taskId: `task-${Math.random().toString(36).substring(2, 8)}`,
    type: 'compute_diff',
    filePath: 'src/file.ts',
    leftSha: 'abc123',
    rightSha: 'def456',
    compareMode: '2dot',
    ...overrides,
  };
}

function createOptions(overrides: Partial<ScheduleOptions> = {}): ScheduleOptions {
  return {
    priority: DiffPriority.Medium,
    commentCount: 0,
    uiOrder: 0,
    ...overrides,
  };
}

describe('DiffScheduler', () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let scheduler: DiffScheduler;
  let cancelMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWorker = createMockWorker();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    cancelMock = mockWorker.cancel as ReturnType<typeof vi.fn>;
    scheduler = createDiffScheduler(mockWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createDiffScheduler', () => {
    it('creates a scheduler with required methods', () => {
      expect(scheduler).toHaveProperty('schedule');
      expect(scheduler).toHaveProperty('prioritize');
      expect(scheduler).toHaveProperty('clear');
      expect(scheduler).toHaveProperty('getResult');
      expect(scheduler).toHaveProperty('onComplete');
    });
  });

  describe('schedule', () => {
    it('returns the task ID', () => {
      const task = createTask({ taskId: 'my-task-id' });
      const result = scheduler.schedule(task, createOptions());
      expect(result).toBe('my-task-id');
    });

    it('schedules tasks for execution', async () => {
      const task = createTask();
      scheduler.schedule(task, createOptions());

      // Allow microtasks to run
      await vi.runAllTimersAsync();

      expect(mockWorker.computeDiffCalls).toHaveLength(1);
      expect(mockWorker.computeDiffCalls[0]).toEqual(task);
    });

    it('processes higher priority tasks first', async () => {
      const lowTask = createTask({ taskId: 'low-priority' });
      const highTask = createTask({ taskId: 'high-priority' });

      scheduler.schedule(lowTask, createOptions({ priority: DiffPriority.Low }));
      scheduler.schedule(highTask, createOptions({ priority: DiffPriority.High }));

      // First task should start immediately
      await vi.runAllTimersAsync();

      // Complete first task to allow second to start
      mockWorker.resolveTask('high-priority', {});
      await vi.runAllTimersAsync();

      // High priority should have been processed first
      expect(mockWorker.computeDiffCalls[0]?.taskId).toBe('high-priority');
    });

    it('uses comment count as secondary sort key', async () => {
      const fewComments = createTask({ taskId: 'few-comments' });
      const manyComments = createTask({ taskId: 'many-comments' });

      scheduler.schedule(fewComments, createOptions({ priority: DiffPriority.Medium, commentCount: 1 }));
      scheduler.schedule(manyComments, createOptions({ priority: DiffPriority.Medium, commentCount: 10 }));

      await vi.runAllTimersAsync();

      // More comments = higher priority
      expect(mockWorker.computeDiffCalls[0]?.taskId).toBe('many-comments');
    });

    it('uses UI order as tertiary sort key', async () => {
      const lowerInList = createTask({ taskId: 'lower-in-list' });
      const higherInList = createTask({ taskId: 'higher-in-list' });

      scheduler.schedule(lowerInList, createOptions({ priority: DiffPriority.Medium, commentCount: 0, uiOrder: 10 }));
      scheduler.schedule(higherInList, createOptions({ priority: DiffPriority.Medium, commentCount: 0, uiOrder: 1 }));

      await vi.runAllTimersAsync();

      // Lower UI order (higher in list) = higher priority
      expect(mockWorker.computeDiffCalls[0]?.taskId).toBe('higher-in-list');
    });

    it('uses enqueue time as FIFO tiebreaker', async () => {
      const first = createTask({ taskId: 'first' });
      const second = createTask({ taskId: 'second' });

      scheduler.schedule(first, createOptions({ priority: DiffPriority.Medium, commentCount: 0, uiOrder: 0 }));
      vi.advanceTimersByTime(10);
      scheduler.schedule(second, createOptions({ priority: DiffPriority.Medium, commentCount: 0, uiOrder: 0 }));

      await vi.runAllTimersAsync();

      // First scheduled = first processed (FIFO)
      expect(mockWorker.computeDiffCalls[0]?.taskId).toBe('first');
    });
  });

  describe('prioritize', () => {
    it('bumps a pending task to highest priority', async () => {
      const low = createTask({ taskId: 'low' });
      const medium = createTask({ taskId: 'medium' });

      scheduler.schedule(low, createOptions({ priority: DiffPriority.Low }));
      scheduler.schedule(medium, createOptions({ priority: DiffPriority.Medium }));

      await vi.runAllTimersAsync();

      // Medium is processing, low is pending
      // Now bump low to highest
      scheduler.prioritize('low');

      // Complete medium task
      mockWorker.resolveTask('medium', {});
      await vi.runAllTimersAsync();

      // Low should have been bumped and processed
      expect(mockWorker.computeDiffCalls.find((c) => c.taskId === 'low')).toBeDefined();
    });

    it('does nothing for non-existent task', () => {
      expect(() => scheduler.prioritize('non-existent')).not.toThrow();
    });

    it('cancels lower-priority in-flight task when higher priority is scheduled', async () => {
      const low = createTask({ taskId: 'low' });
      const highest = createTask({ taskId: 'highest' });

      scheduler.schedule(low, createOptions({ priority: DiffPriority.Low }));
      await vi.runAllTimersAsync();

      // Low is now in-flight
      expect(mockWorker.computeDiffCalls).toHaveLength(1);

      // Schedule a highest priority task - should cancel in-flight
      scheduler.schedule(highest, createOptions({ priority: DiffPriority.Highest }));
      await vi.runAllTimersAsync();

      // Should have called cancel on the low priority task
      expect(cancelMock).toHaveBeenCalledWith('low');
    });
  });

  describe('clear', () => {
    it('cancels all pending tasks', async () => {
      const task1 = createTask({ taskId: 'task-1' });
      const task2 = createTask({ taskId: 'task-2' });
      const task3 = createTask({ taskId: 'task-3' });

      scheduler.schedule(task1, createOptions());
      scheduler.schedule(task2, createOptions());
      scheduler.schedule(task3, createOptions());

      await vi.runAllTimersAsync();

      scheduler.clear();

      // In-flight task should be cancelled
      expect(cancelMock).toHaveBeenCalled();
    });

    it('clears cached results', async () => {
      const task = createTask({ taskId: 'cached-task' });
      scheduler.schedule(task, createOptions());

      await vi.runAllTimersAsync();

      mockWorker.resolveTask('cached-task', { diffLines: [] });
      await vi.runAllTimersAsync();

      expect(scheduler.getResult('cached-task')).toBeDefined();

      scheduler.clear();

      expect(scheduler.getResult('cached-task')).toBeUndefined();
    });
  });

  describe('getResult', () => {
    it('returns undefined for unknown task', () => {
      expect(scheduler.getResult('unknown')).toBeUndefined();
    });

    it('returns undefined for pending task', () => {
      const task = createTask({ taskId: 'pending' });
      scheduler.schedule(task, createOptions());

      expect(scheduler.getResult('pending')).toBeUndefined();
    });

    it('returns result for completed task', async () => {
      const task = createTask({ taskId: 'completed' });
      scheduler.schedule(task, createOptions());

      await vi.runAllTimersAsync();

      mockWorker.resolveTask('completed', { diffLines: [], status: 'completed' });
      await vi.runAllTimersAsync();

      const result = scheduler.getResult('completed');
      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
    });

    it('caches results for subsequent calls', async () => {
      const task = createTask({ taskId: 'cached' });
      scheduler.schedule(task, createOptions());

      await vi.runAllTimersAsync();

      mockWorker.resolveTask('cached', { diffLines: [] });
      await vi.runAllTimersAsync();

      const result1 = scheduler.getResult('cached');
      const result2 = scheduler.getResult('cached');

      expect(result1).toBe(result2);
    });
  });

  describe('onComplete', () => {
    it('calls callback when task completes', async () => {
      const callback = vi.fn();
      scheduler.onComplete(callback);

      const task = createTask({ taskId: 'completing' });
      scheduler.schedule(task, createOptions());

      await vi.runAllTimersAsync();

      mockWorker.resolveTask('completing', { diffLines: [] });
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'completing' }));
    });

    it('returns unsubscribe function', async () => {
      const callback = vi.fn();
      const unsubscribe = scheduler.onComplete(callback);

      const task1 = createTask({ taskId: 'task-1' });
      scheduler.schedule(task1, createOptions());

      await vi.runAllTimersAsync();
      mockWorker.resolveTask('task-1', {});
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      const task2 = createTask({ taskId: 'task-2' });
      scheduler.schedule(task2, createOptions());

      await vi.runAllTimersAsync();
      mockWorker.resolveTask('task-2', {});
      await vi.runAllTimersAsync();

      // Should not have been called again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports multiple callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      scheduler.onComplete(callback1);
      scheduler.onComplete(callback2);

      const task = createTask({ taskId: 'multi-callback' });
      scheduler.schedule(task, createOptions());

      await vi.runAllTimersAsync();
      mockWorker.resolveTask('multi-callback', {});
      await vi.runAllTimersAsync();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('multi-key comparator', () => {
    it('sorts by priority first, then comment count, then ui order, then enqueue time', async () => {
      // Schedule tasks in "wrong" order to verify sorting
      const tasks = [
        { task: createTask({ taskId: 'last' }), opts: { priority: DiffPriority.Low, commentCount: 0, uiOrder: 10 } },
        { task: createTask({ taskId: 'third' }), opts: { priority: DiffPriority.Medium, commentCount: 0, uiOrder: 5 } },
        { task: createTask({ taskId: 'second' }), opts: { priority: DiffPriority.Medium, commentCount: 5, uiOrder: 1 } },
        { task: createTask({ taskId: 'first' }), opts: { priority: DiffPriority.Highest, commentCount: 0, uiOrder: 100 } },
      ];

      for (const { task, opts } of tasks) {
        scheduler.schedule(task, createOptions(opts));
        vi.advanceTimersByTime(1);
      }

      await vi.runAllTimersAsync();

      // Complete tasks sequentially to verify order
      const expectedOrder = ['first', 'second', 'third', 'last'];
      for (let i = 0; i < expectedOrder.length; i++) {
        const expected = expectedOrder[i] ?? '';
        expect(mockWorker.computeDiffCalls[i]?.taskId).toBe(expected);
        mockWorker.resolveTask(expected, {});
        await vi.runAllTimersAsync();
      }
    });
  });

  describe('error handling', () => {
    it('handles worker errors gracefully', async () => {
      const errorWorker = createMockWorker();
      errorWorker.computeDiff = vi.fn().mockRejectedValue(new Error('Worker error'));

      const errorScheduler = createDiffScheduler(errorWorker);
      const callback = vi.fn();
      errorScheduler.onComplete(callback);

      const task = createTask({ taskId: 'error-task' });
      errorScheduler.schedule(task, createOptions());

      await vi.runAllTimersAsync();

      // Should call onComplete with error status
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'error-task',
          status: 'error',
        })
      );
    });
  });

  describe('duplicate task handling', () => {
    it('returns cached result for same task ID', async () => {
      const task = createTask({ taskId: 'duplicate' });

      scheduler.schedule(task, createOptions());
      await vi.runAllTimersAsync();

      mockWorker.resolveTask('duplicate', { diffLines: [] });
      await vi.runAllTimersAsync();

      // Schedule same task ID again
      const taskId = scheduler.schedule(task, createOptions());

      expect(taskId).toBe('duplicate');
      // Should not call worker again - use cache
      expect(mockWorker.computeDiffCalls).toHaveLength(1);
    });
  });

  describe('task type routing', () => {
    it('calls computeDiff for compute_diff tasks', async () => {
      const task = createTask({ taskId: 'diff-task', type: 'compute_diff' });

      scheduler.schedule(task, createOptions());
      await vi.runAllTimersAsync();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const computeDiffMock = mockWorker.computeDiff as ReturnType<typeof vi.fn>;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const computeSpanTrackerMock = mockWorker.computeSpanTracker as ReturnType<typeof vi.fn>;

      expect(computeDiffMock).toHaveBeenCalledWith(task);
      expect(computeSpanTrackerMock).not.toHaveBeenCalled();
    });

    it('calls computeSpanTracker for compute_span_tracker tasks', async () => {
      const task = createTask({ taskId: 'span-task', type: 'compute_span_tracker' });

      scheduler.schedule(task, createOptions());
      await vi.runAllTimersAsync();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const computeSpanTrackerMock = mockWorker.computeSpanTracker as ReturnType<typeof vi.fn>;

      expect(computeSpanTrackerMock).toHaveBeenCalledWith(task);
      // computeDiff should not have been called for this task
      expect(mockWorker.computeDiffCalls).toHaveLength(0);
    });
  });
});
