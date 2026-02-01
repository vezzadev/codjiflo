/**
 * Tests for useSpanTrackerPrecompute hook
 *
 * Validates that SpanTracker tasks are scheduled correctly in stateless mode
 * after the first diff loads, with proper priority and deduplication.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SchedulerProvider } from '../scheduler/context';
import { useSpanTrackerPrecompute, type UseSpanTrackerPrecomputeOptions, type FileWithComments } from './useSpanTrackerPrecompute';
import type { DiffScheduler, DiffTask, ScheduleOptions } from '../scheduler/types';
import { DiffPriority } from '../scheduler/types';

// Type for the mock schedule function with proper typings
type MockScheduleFn = ReturnType<typeof vi.fn<(task: DiffTask, options: ScheduleOptions) => string>>;

// Helper to create a mock scheduler
function createMockScheduler(): DiffScheduler & { scheduleMock: MockScheduleFn } {
  const scheduleMock = vi.fn<(task: DiffTask, options: ScheduleOptions) => string>().mockReturnValue('mock-task-id');
  return {
    schedule: scheduleMock,
    prioritize: vi.fn(),
    clear: vi.fn(),
    getResult: vi.fn().mockReturnValue(undefined),
    getSpanTrackerResult: vi.fn().mockReturnValue(undefined),
    onComplete: vi.fn().mockReturnValue(vi.fn()),
    scheduleMock,
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

// Factory for file with comments
function createFileWithComments(overrides?: Partial<FileWithComments>): FileWithComments {
  return {
    filePath: 'src/example.ts',
    leftSha: 'abc123',
    rightSha: 'def456',
    commentCount: 1,
    ...overrides,
  };
}

// Default options factory
function createOptions(overrides?: Partial<UseSpanTrackerPrecomputeOptions>): UseSpanTrackerPrecomputeOptions {
  return {
    filesWithComments: [createFileWithComments()],
    firstDiffLoaded: true,
    mode: 'stateless',
    ...overrides,
  };
}

describe('useSpanTrackerPrecompute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when firstDiffLoaded is false', () => {
    it('does not schedule SpanTracker tasks before first diff loads', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const options = createOptions({ firstDiffLoaded: false });

      renderHook(() => useSpanTrackerPrecompute(options), { wrapper });

      expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('schedules tasks when firstDiffLoaded changes to true', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);

      const { rerender } = renderHook(
        (props: UseSpanTrackerPrecomputeOptions) => useSpanTrackerPrecompute(props),
        {
          wrapper,
          initialProps: createOptions({ firstDiffLoaded: false }),
        }
      );

      expect(scheduleMock).not.toHaveBeenCalled();

      // Simulate first diff loading
      rerender(createOptions({ firstDiffLoaded: true }));

      expect(scheduleMock).toHaveBeenCalled();
    });
  });

  describe('when in stateless mode', () => {
    it('schedules SpanTracker tasks at Low priority after first diff loads', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const files = [
        createFileWithComments({ filePath: 'src/file1.ts', commentCount: 3 }),
        createFileWithComments({ filePath: 'src/file2.ts', commentCount: 1 }),
      ];
      const options = createOptions({ filesWithComments: files });

      renderHook(() => useSpanTrackerPrecompute(options), { wrapper });

      expect(scheduleMock).toHaveBeenCalledTimes(2);

      // Verify first task
      const [task1, opts1] = scheduleMock.mock.calls[0] as [DiffTask, ScheduleOptions];
      expect(task1.type).toBe('compute_span_tracker');
      expect(task1.filePath).toBe('src/file1.ts');
      expect(task1.taskId).toBe('span-tracker-src/file1.ts-abc123-def456');
      expect(opts1.priority).toBe(DiffPriority.Low);
      expect(opts1.commentCount).toBe(3);

      // Verify second task
      const [task2, opts2] = scheduleMock.mock.calls[1] as [DiffTask, ScheduleOptions];
      expect(task2.type).toBe('compute_span_tracker');
      expect(task2.filePath).toBe('src/file2.ts');
      expect(opts2.commentCount).toBe(1);
    });

    it('generates correct task ID from file path and SHAs', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const file = createFileWithComments({
        filePath: 'src/components/Button.tsx',
        leftSha: 'commit1',
        rightSha: 'commit2',
      });
      const options = createOptions({ filesWithComments: [file] });

      renderHook(() => useSpanTrackerPrecompute(options), { wrapper });

      const [task] = scheduleMock.mock.calls[0] as [DiffTask, ScheduleOptions];
      expect(task.taskId).toBe('span-tracker-src/components/Button.tsx-commit1-commit2');
      expect(task.leftSha).toBe('commit1');
      expect(task.rightSha).toBe('commit2');
      expect(task.compareMode).toBe('2dot');
    });
  });

  describe('when in stateful mode', () => {
    it('does not schedule tasks in stateful mode', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const options = createOptions({ mode: 'stateful' });

      renderHook(() => useSpanTrackerPrecompute(options), { wrapper });

      expect(scheduleMock).not.toHaveBeenCalled();
    });
  });

  describe('when no files with comments', () => {
    it('does not schedule tasks if filesWithComments is empty', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const options = createOptions({ filesWithComments: [] });

      renderHook(() => useSpanTrackerPrecompute(options), { wrapper });

      expect(scheduleMock).not.toHaveBeenCalled();
    });
  });

  describe('scheduling deduplication', () => {
    it('only schedules once even on re-renders', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const options = createOptions();

      const { rerender } = renderHook(
        () => useSpanTrackerPrecompute(options),
        { wrapper }
      );

      expect(scheduleMock).toHaveBeenCalledTimes(1);

      // Re-render multiple times
      rerender();
      rerender();
      rerender();

      // Should still only have been called once
      expect(scheduleMock).toHaveBeenCalledTimes(1);
    });

    it('does not re-schedule when filesWithComments changes after initial schedule', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const initialFiles = [createFileWithComments({ filePath: 'src/file1.ts' })];
      const newFiles = [
        createFileWithComments({ filePath: 'src/file1.ts' }),
        createFileWithComments({ filePath: 'src/file2.ts' }),
      ];

      const { rerender } = renderHook(
        (props: UseSpanTrackerPrecomputeOptions) => useSpanTrackerPrecompute(props),
        {
          wrapper,
          initialProps: createOptions({ filesWithComments: initialFiles }),
        }
      );

      expect(scheduleMock).toHaveBeenCalledTimes(1);

      // Change files - should not trigger re-schedule
      rerender(createOptions({ filesWithComments: newFiles }));

      expect(scheduleMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles single file correctly', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const options = createOptions({
        filesWithComments: [createFileWithComments({ commentCount: 5 })],
      });

      renderHook(() => useSpanTrackerPrecompute(options), { wrapper });

      expect(scheduleMock).toHaveBeenCalledTimes(1);
      const [, opts] = scheduleMock.mock.calls[0] as [DiffTask, ScheduleOptions];
      expect(opts.commentCount).toBe(5);
    });

    it('handles files with zero comments', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const options = createOptions({
        filesWithComments: [createFileWithComments({ commentCount: 0 })],
      });

      renderHook(() => useSpanTrackerPrecompute(options), { wrapper });

      expect(scheduleMock).toHaveBeenCalledTimes(1);
      const [, opts] = scheduleMock.mock.calls[0] as [DiffTask, ScheduleOptions];
      expect(opts.commentCount).toBe(0);
    });

    it('handles multiple files with varying comment counts', () => {
      const { scheduleMock, ...scheduler } = createMockScheduler();
      const wrapper = createWrapper(scheduler);
      const files = [
        createFileWithComments({ filePath: 'a.ts', commentCount: 10 }),
        createFileWithComments({ filePath: 'b.ts', commentCount: 0 }),
        createFileWithComments({ filePath: 'c.ts', commentCount: 5 }),
      ];
      const options = createOptions({ filesWithComments: files });

      renderHook(() => useSpanTrackerPrecompute(options), { wrapper });

      expect(scheduleMock).toHaveBeenCalledTimes(3);

      // Verify all files are scheduled with their respective comment counts
      const calls = scheduleMock.mock.calls as [DiffTask, ScheduleOptions][];
      const commentCounts = calls.map(([, opts]) => opts.commentCount);
      expect(commentCounts).toEqual([10, 0, 5]);
    });
  });
});
