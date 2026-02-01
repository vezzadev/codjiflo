/**
 * Tests for useStatelessDiff hook and SchedulerProvider context
 * TDD: Write tests first, then implement
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SchedulerProvider, useScheduler } from '../scheduler/context';
import { useStatelessDiff } from './useStatelessDiff';
import type { DiffScheduler, DiffResult, DiffTask, ScheduleOptions } from '../scheduler/types';
import { DiffPriority } from '../scheduler/types';

// Helper to create a mock scheduler
function createMockScheduler(overrides?: Partial<DiffScheduler>): DiffScheduler {
  return {
    schedule: vi.fn().mockReturnValue('mock-task-id'),
    prioritize: vi.fn(),
    clear: vi.fn(),
    getResult: vi.fn().mockReturnValue(undefined),
    onComplete: vi.fn().mockReturnValue(vi.fn()),
    ...overrides,
  };
}

// Wrapper component for providing scheduler context
function createWrapper(scheduler: DiffScheduler) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SchedulerProvider scheduler={scheduler}>
        {children}
      </SchedulerProvider>
    );
  };
}

describe('SchedulerProvider and useScheduler', () => {
  describe('useScheduler outside provider', () => {
    it('throws error when used outside SchedulerProvider', () => {
      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

      expect(() => {
        renderHook(() => useScheduler());
      }).toThrow('useScheduler must be used within SchedulerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useScheduler inside provider', () => {
    it('returns the scheduler from context', () => {
      const mockScheduler = createMockScheduler();
      const wrapper = createWrapper(mockScheduler);

      const { result } = renderHook(() => useScheduler(), { wrapper });

      expect(result.current).toBe(mockScheduler);
    });
  });
});

describe('useStatelessDiff', () => {
  const defaultParams = {
    filePath: 'src/example.ts',
    leftSha: 'abc123',
    rightSha: 'def456',
    compareMode: '2dot' as const,
  };

  describe('when result is already cached', () => {
    it('returns completed status with cached result immediately', () => {
      const cachedResult: DiffResult = {
        taskId: 'src/example.ts:abc123:def456:2dot',
        status: 'completed',
        diffLines: [{ type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 }],
        alignedLines: [{ left: null, right: null, key: 'key-1' }],
      };

      const scheduleMock = vi.fn().mockReturnValue('mock-task-id');
      const mockScheduler = createMockScheduler({
        schedule: scheduleMock,
        getResult: vi.fn().mockReturnValue(cachedResult),
      });
      const wrapper = createWrapper(mockScheduler);

      const { result } = renderHook(
        () => useStatelessDiff(
          defaultParams.filePath,
          defaultParams.leftSha,
          defaultParams.rightSha,
          defaultParams.compareMode
        ),
        { wrapper }
      );

      expect(result.current.status).toBe('completed');
      expect(result.current.diffLines).toEqual(cachedResult.diffLines);
      expect(result.current.alignedLines).toEqual(cachedResult.alignedLines);
      // Should NOT schedule a new task
      expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('returns error status when cached result has error', () => {
      const errorResult: DiffResult = {
        taskId: 'test-task',
        status: 'error',
        error: 'Failed to compute diff',
      };

      const mockScheduler = createMockScheduler({
        getResult: vi.fn().mockReturnValue(errorResult),
      });
      const wrapper = createWrapper(mockScheduler);

      const { result } = renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Failed to compute diff');
    });

    it('returns unavailable status with reason when cached', () => {
      const unavailableResult: DiffResult = {
        taskId: 'test-task',
        status: 'unavailable',
        unavailableReason: '404',
      };

      const mockScheduler = createMockScheduler({
        getResult: vi.fn().mockReturnValue(unavailableResult),
      });
      const wrapper = createWrapper(mockScheduler);

      const { result } = renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      expect(result.current.status).toBe('unavailable');
      expect(result.current.unavailableReason).toBe('404');
    });
  });

  describe('when result is not cached', () => {
    it('schedules a task at Highest priority', () => {
      const scheduleMock = vi.fn().mockReturnValue('mock-task-id');
      const mockScheduler = createMockScheduler({
        schedule: scheduleMock,
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockReturnValue(vi.fn()),
      });
      const wrapper = createWrapper(mockScheduler);

      renderHook(
        () => useStatelessDiff(
          defaultParams.filePath,
          defaultParams.leftSha,
          defaultParams.rightSha,
          defaultParams.compareMode
        ),
        { wrapper }
      );

      expect(scheduleMock).toHaveBeenCalledTimes(1);
      const [task, options] = scheduleMock.mock.calls[0] as [DiffTask, ScheduleOptions];

      expect(task.filePath).toBe(defaultParams.filePath);
      expect(task.leftSha).toBe(defaultParams.leftSha);
      expect(task.rightSha).toBe(defaultParams.rightSha);
      expect(task.compareMode).toBe('2dot');
      expect(task.type).toBe('compute_diff');
      expect(options.priority).toBe(DiffPriority.Highest);
    });

    it('returns loading status initially', () => {
      const mockScheduler = createMockScheduler({
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockReturnValue(vi.fn()),
      });
      const wrapper = createWrapper(mockScheduler);

      const { result } = renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      expect(result.current.status).toBe('loading');
      expect(result.current.diffLines).toBeUndefined();
      expect(result.current.alignedLines).toBeUndefined();
    });

    it('subscribes to completion events', () => {
      const onCompleteMock = vi.fn().mockReturnValue(vi.fn());
      const mockScheduler = createMockScheduler({
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: onCompleteMock,
      });
      const wrapper = createWrapper(mockScheduler);

      renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      expect(onCompleteMock).toHaveBeenCalledTimes(1);
    });

    it('updates state when completion event matches task ID', async () => {
      let capturedCallback: ((result: DiffResult) => void) | null = null;
      let cachedResult: DiffResult | undefined;

      // Simulate task completion
      const completedResult: DiffResult = {
        taskId: 'file.ts:sha1:sha2:2dot',
        status: 'completed',
        diffLines: [{ type: 'addition', content: 'new line', oldLineNumber: null, newLineNumber: 1 }],
        alignedLines: [],
      };

      const mockScheduler = createMockScheduler({
        // getResult returns the cached result (simulating scheduler cache behavior)
        getResult: vi.fn().mockImplementation(() => cachedResult),
        onComplete: vi.fn().mockImplementation((callback: (result: DiffResult) => void) => {
          capturedCallback = callback;
          return vi.fn();
        }),
      });
      const wrapper = createWrapper(mockScheduler);

      const { result } = renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      expect(result.current.status).toBe('loading');

      act(() => {
        // Simulate the scheduler caching the result before notifying
        cachedResult = completedResult;
        capturedCallback?.(completedResult);
      });

      await waitFor(() => {
        expect(result.current.status).toBe('completed');
      });

      expect(result.current.diffLines).toEqual(completedResult.diffLines);
    });

    it('ignores completion events for different task IDs', () => {
      let capturedCallback: ((result: DiffResult) => void) | null = null;

      const mockScheduler = createMockScheduler({
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockImplementation((callback: (result: DiffResult) => void) => {
          capturedCallback = callback;
          return vi.fn();
        }),
      });
      const wrapper = createWrapper(mockScheduler);

      const { result } = renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      // Simulate completion for a different task
      const differentResult: DiffResult = {
        taskId: 'other-file.ts:different:sha:2dot',
        status: 'completed',
        diffLines: [],
      };

      act(() => {
        capturedCallback?.(differentResult);
      });

      // Should still be loading since the task ID didn't match
      expect(result.current.status).toBe('loading');
    });

    it('unsubscribes from completion events on unmount', () => {
      const unsubscribeFn = vi.fn();
      const mockScheduler = createMockScheduler({
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockReturnValue(unsubscribeFn),
      });
      const wrapper = createWrapper(mockScheduler);

      const { unmount } = renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      unmount();

      expect(unsubscribeFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('task ID generation', () => {
    it('generates consistent task IDs from parameters', () => {
      const scheduleMock = vi.fn().mockReturnValue('mock-task-id');
      const mockScheduler = createMockScheduler({
        schedule: scheduleMock,
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockReturnValue(vi.fn()),
      });
      const wrapper = createWrapper(mockScheduler);

      renderHook(
        () => useStatelessDiff('src/app.tsx', 'commit1', 'commit2', '3dot'),
        { wrapper }
      );

      const [task] = scheduleMock.mock.calls[0] as [DiffTask];
      expect(task.taskId).toBe('src/app.tsx:commit1:commit2:3dot');
    });

    it('defaults to 2dot compare mode', () => {
      const scheduleMock = vi.fn().mockReturnValue('mock-task-id');
      const mockScheduler = createMockScheduler({
        schedule: scheduleMock,
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockReturnValue(vi.fn()),
      });
      const wrapper = createWrapper(mockScheduler);

      renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      const [task] = scheduleMock.mock.calls[0] as [DiffTask];
      expect(task.compareMode).toBe('2dot');
      expect(task.taskId).toBe('file.ts:sha1:sha2:2dot');
    });
  });

  describe('parameter changes', () => {
    it('schedules new task when file path changes', () => {
      const scheduleMock = vi.fn().mockReturnValue('mock-task-id');
      const mockScheduler = createMockScheduler({
        schedule: scheduleMock,
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockReturnValue(vi.fn()),
      });
      const wrapper = createWrapper(mockScheduler);

      const { rerender } = renderHook(
        ({ filePath }) => useStatelessDiff(filePath, 'sha1', 'sha2'),
        { wrapper, initialProps: { filePath: 'file1.ts' } }
      );

      // Change file path
      rerender({ filePath: 'file2.ts' });

      expect(scheduleMock).toHaveBeenCalledTimes(2);
      const [, task2] = scheduleMock.mock.calls as [[DiffTask], [DiffTask]];
      expect(task2[0].filePath).toBe('file2.ts');
    });

    it('schedules new task when SHAs change', () => {
      const scheduleMock = vi.fn().mockReturnValue('mock-task-id');
      const mockScheduler = createMockScheduler({
        schedule: scheduleMock,
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockReturnValue(vi.fn()),
      });
      const wrapper = createWrapper(mockScheduler);

      const { rerender } = renderHook(
        ({ leftSha, rightSha }) => useStatelessDiff('file.ts', leftSha, rightSha),
        { wrapper, initialProps: { leftSha: 'sha1', rightSha: 'sha2' } }
      );

      // Change SHAs
      rerender({ leftSha: 'newSha1', rightSha: 'newSha2' });

      expect(scheduleMock).toHaveBeenCalledTimes(2);
    });

    it('does not schedule duplicate task for same parameters', () => {
      const scheduleMock = vi.fn().mockReturnValue('mock-task-id');
      const mockScheduler = createMockScheduler({
        schedule: scheduleMock,
        getResult: vi.fn().mockReturnValue(undefined),
        onComplete: vi.fn().mockReturnValue(vi.fn()),
      });
      const wrapper = createWrapper(mockScheduler);

      const { rerender } = renderHook(
        () => useStatelessDiff('file.ts', 'sha1', 'sha2'),
        { wrapper }
      );

      // Re-render with same parameters
      rerender();

      // Should only schedule once
      expect(scheduleMock).toHaveBeenCalledTimes(1);
    });
  });
});
