/**
 * Tests for Diff Compute Worker
 * TDD: These tests are written first, before the implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiffComputeAPI, WorkerConfig } from './diff-compute.api';
import type { DiffTask, SpanTrackerResult } from '../scheduler/types';

// Mock fetch globally - partial Response interface for testing
interface MockResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  json?: () => Promise<{ content: string; encoding: string }>;
}
const mockFetch = vi.fn() as ReturnType<typeof vi.fn> & {
  mockResolvedValueOnce: (value: MockResponse) => typeof mockFetch;
  mockReturnValueOnce: (value: Promise<unknown>) => typeof mockFetch;
};
vi.stubGlobal('fetch', mockFetch);

// We'll import the createWorkerAPI factory function after it's created
let createWorkerAPI: () => DiffComputeAPI;

describe('DiffComputeWorkerImpl', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamic import to get fresh instance
    const workerModule = await import('./diff-compute.worker');
    createWorkerAPI = workerModule.createWorkerAPI;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('should initialize with provided config', async () => {
      const worker = createWorkerAPI();
      const config: WorkerConfig = {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      };

      // Should not throw
      await expect(worker.init(config)).resolves.not.toThrow();
    });

    it('should allow initialization without token (public repos)', async () => {
      const worker = createWorkerAPI();
      const config: WorkerConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
      };

      await expect(worker.init(config)).resolves.not.toThrow();
    });

    it('should allow re-initialization (token refresh)', async () => {
      const worker = createWorkerAPI();

      await worker.init({ owner: 'owner1', repo: 'repo1', token: 'token1' });
      await worker.init({ owner: 'owner1', repo: 'repo1', token: 'token2' });

      // Should not throw
    });
  });

  describe('computeDiff', () => {
    const baseConfig: WorkerConfig = {
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    };

    const baseTask: DiffTask = {
      taskId: 'task-1',
      type: 'compute_diff',
      filePath: 'src/file.ts',
      leftSha: 'abc123',
      rightSha: 'def456',
      compareMode: '2dot',
    };

    it('should fetch file contents and compute diff', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      // Mock GitHub Contents API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('old content').toString('base64'),
            encoding: 'base64',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('new content').toString('base64'),
            encoding: 'base64',
          }),
        });

      const result = await worker.computeDiff(baseTask);

      expect(result.taskId).toBe('task-1');
      expect(result.status).toBe('completed');
      expect(result.diffLines).toBeDefined();
      expect(result.alignedLines).toBeDefined();
    });

    it('should include Authorization header when token is provided', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('content').toString('base64'),
            encoding: 'base64',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('content').toString('base64'),
            encoding: 'base64',
          }),
        });

      await worker.computeDiff(baseTask);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.github.com'),
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should not include Authorization header when no token', async () => {
      const worker = createWorkerAPI();
      await worker.init({ owner: 'test-owner', repo: 'test-repo' });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('content').toString('base64'),
            encoding: 'base64',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('content').toString('base64'),
            encoding: 'base64',
          }),
        });

      await worker.computeDiff(baseTask);

      // Check that Authorization is NOT in headers
      const firstCall = mockFetch.mock.calls[0];
      const callOptions = firstCall?.[1] as RequestInit | undefined;
      const callHeaders = callOptions?.headers as Record<string, string> | undefined;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });

    it('should return unavailable status with 404 reason when both versions not found', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      // Both left and right fetch fail with 404
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

      const result = await worker.computeDiff(baseTask);

      expect(result.taskId).toBe('task-1');
      expect(result.status).toBe('unavailable');
      expect(result.unavailableReason).toBe('404');
    });

    it('should return unavailable status with 410 reason when both versions gone', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      // Both left and right fetch fail with 410
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 410,
          statusText: 'Gone',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 410,
          statusText: 'Gone',
        });

      const result = await worker.computeDiff(baseTask);

      expect(result.taskId).toBe('task-1');
      expect(result.status).toBe('unavailable');
      expect(result.unavailableReason).toBe('410');
    });

    it('should return error status for other HTTP errors', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      // Left fetch fails with 500, right will also fail (Promise.all behavior)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

      const result = await worker.computeDiff(baseTask);

      expect(result.taskId).toBe('task-1');
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should handle new files (leftSha fetch fails with 404)', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      // Left SHA (old version) doesn't exist - new file
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('new file content\nline 2').toString('base64'),
            encoding: 'base64',
          }),
        });

      const result = await worker.computeDiff(baseTask);

      expect(result.status).toBe('completed');
      expect(result.diffLines).toBeDefined();
      // All lines should be additions
      const additions = result.diffLines?.filter(l => l.type === 'addition');
      expect(additions?.length).toBeGreaterThan(0);
    });

    it('should handle deleted files (rightSha fetch fails with 404)', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      // Old version exists
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('old file content\nline 2').toString('base64'),
            encoding: 'base64',
          }),
        })
        // New version doesn't exist - deleted file
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

      const result = await worker.computeDiff(baseTask);

      expect(result.status).toBe('completed');
      expect(result.diffLines).toBeDefined();
      // All lines should be deletions
      const deletions = result.diffLines?.filter(l => l.type === 'deletion');
      expect(deletions?.length).toBeGreaterThan(0);
    });

    it('should throw if not initialized', async () => {
      const worker = createWorkerAPI();

      // Don't call init
      const result = await worker.computeDiff(baseTask);

      expect(result.status).toBe('error');
      expect(result.error).toContain('not initialized');
    });

    it('should construct correct GitHub Contents API URL', async () => {
      const worker = createWorkerAPI();
      await worker.init({
        token: 'test-token',
        owner: 'my-org',
        repo: 'my-repo',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('content').toString('base64'),
            encoding: 'base64',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('content').toString('base64'),
            encoding: 'base64',
          }),
        });

      const task: DiffTask = {
        taskId: 'task-1',
        type: 'compute_diff',
        filePath: 'src/components/Button.tsx',
        leftSha: 'commit-a',
        rightSha: 'commit-b',
        compareMode: '2dot',
      };

      await worker.computeDiff(task);

      // Verify the URLs are correctly constructed
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/my-org/my-repo/contents/src/components/Button.tsx?ref=commit-a',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/my-org/my-repo/contents/src/components/Button.tsx?ref=commit-b',
        expect.any(Object)
      );
    });
  });

  describe('computeSpanTracker', () => {
    const baseConfig: WorkerConfig = {
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    };

    const baseTask: DiffTask = {
      taskId: 'span-task-1',
      type: 'compute_span_tracker',
      filePath: 'src/file.ts',
      leftSha: 'abc123',
      rightSha: 'def456',
      compareMode: '2dot',
    };

    it('should compute line mappings for unchanged lines', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      const content = 'line1\nline2\nline3';
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
          }),
        });

      const result: SpanTrackerResult = await worker.computeSpanTracker(baseTask);

      expect(result.taskId).toBe('span-task-1');
      expect(result.status).toBe('completed');
      expect(result.mappings).toBeDefined();

      // All lines should map 1:1
      expect(result.mappings).toHaveLength(3);
      result.mappings?.forEach((mapping, i) => {
        expect(mapping.leftLine).toBe(i + 1);
        expect(mapping.rightLine).toBe(i + 1);
        expect(mapping.type).toBe('unchanged');
      });
    });

    it('should compute line mappings for added lines', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('line1\nline2').toString('base64'),
            encoding: 'base64',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('line1\nnew line\nline2').toString('base64'),
            encoding: 'base64',
          }),
        });

      const result: SpanTrackerResult = await worker.computeSpanTracker(baseTask);

      expect(result.status).toBe('completed');
      expect(result.mappings).toBeDefined();

      // Find the added line
      const addedMapping = result.mappings?.find(m => m.type === 'added');
      expect(addedMapping).toBeDefined();
    });

    it('should compute line mappings for deleted lines', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('line1\nold line\nline2').toString('base64'),
            encoding: 'base64',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('line1\nline2').toString('base64'),
            encoding: 'base64',
          }),
        });

      const result: SpanTrackerResult = await worker.computeSpanTracker(baseTask);

      expect(result.status).toBe('completed');
      expect(result.mappings).toBeDefined();

      // Find the deleted line
      const deletedMapping = result.mappings?.find(m => m.type === 'deleted');
      expect(deletedMapping).toBeDefined();
      expect(deletedMapping?.rightLine).toBeNull();
    });

    it('should return error status if not initialized', async () => {
      const worker = createWorkerAPI();

      const result = await worker.computeSpanTracker(baseTask);

      expect(result.status).toBe('error');
      expect(result.error).toContain('not initialized');
    });
  });

  describe('cancel', () => {
    const baseConfig: WorkerConfig = {
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    };

    it('should cancel an in-progress task', async () => {
      const worker = createWorkerAPI();
      await worker.init(baseConfig);

      // Set up a slow fetch that we can cancel
      let fetchResolve: ((value: unknown) => void) | undefined;
      const slowFetchPromise = new Promise((resolve) => {
        fetchResolve = resolve;
      });

      mockFetch.mockReturnValueOnce(slowFetchPromise);

      const task: DiffTask = {
        taskId: 'cancellable-task',
        type: 'compute_diff',
        filePath: 'src/file.ts',
        leftSha: 'abc123',
        rightSha: 'def456',
        compareMode: '2dot',
      };

      // Start the task
      const resultPromise = worker.computeDiff(task);

      // Cancel immediately
      worker.cancel('cancellable-task');

      // Resolve the fetch to let the promise complete
      if (fetchResolve) {
        fetchResolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            content: Buffer.from('content').toString('base64'),
            encoding: 'base64',
          }),
        });
      }

      const result = await resultPromise;

      expect(result.status).toBe('cancelled');
    });

    it('should do nothing if task is not found', () => {
      const worker = createWorkerAPI();

      // Should not throw
      expect(() => worker.cancel('non-existent-task')).not.toThrow();
    });
  });
});
