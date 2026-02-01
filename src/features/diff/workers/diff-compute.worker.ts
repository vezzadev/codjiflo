/**
 * Diff Compute Worker Implementation
 *
 * Web Worker that handles diff computation:
 * - Fetches file contents from GitHub Contents API
 * - Computes diffs using the diff-engine
 * - Supports cancellation via AbortController
 * - Exposed via Comlink for main thread communication
 */

import * as Comlink from 'comlink';
import type { DiffComputeAPI, WorkerConfig } from './diff-compute.api';
import type { DiffTask, DiffResult, SpanTrackerResult, LineMapping } from '../scheduler/types';
import { computeLineDiff, enhanceWithWordDiffs, computeAlignment } from './diff-engine';

/**
 * GitHub Contents API response type
 */
interface GitHubContentsResponse {
  content: string;
  encoding: 'base64';
}

/**
 * Implementation of the DiffComputeAPI interface
 */
export class DiffComputeWorkerImpl implements DiffComputeAPI {
  private config: WorkerConfig | null = null;
  private abortControllers = new Map<string, AbortController>();

  init(config: WorkerConfig): Promise<void> {
    this.config = config;
    return Promise.resolve();
  }

  async computeDiff(task: DiffTask): Promise<DiffResult> {
    if (!this.config) {
      return {
        taskId: task.taskId,
        status: 'error',
        error: 'Worker not initialized - call init() first',
      };
    }

    const abortController = new AbortController();
    this.abortControllers.set(task.taskId, abortController);

    try {
      // Fetch both file versions in parallel
      const [leftResult, rightResult] = await Promise.all([
        this.fetchFileContent(task.filePath, task.leftSha, abortController.signal),
        this.fetchFileContent(task.filePath, task.rightSha, abortController.signal),
      ]);

      // Check if cancelled
      if (abortController.signal.aborted) {
        return {
          taskId: task.taskId,
          status: 'cancelled',
        };
      }

      // Helper to check if a status indicates file not found (expected for new/deleted files)
      const isNotFoundStatus = (status?: number) => status === 404 || status === 410;

      // Handle cases where both fetches failed
      if (leftResult.error && rightResult.error) {
        // Both sides failed - check if it's "unavailable" (404/410) or an actual error
        const leftIsNotFound = isNotFoundStatus(leftResult.status);
        const rightIsNotFound = isNotFoundStatus(rightResult.status);

        // If both are 404/410, the file is unavailable
        if (leftIsNotFound && rightIsNotFound) {
          const reason = leftResult.status === 404 || rightResult.status === 404 ? '404' : '410';
          return {
            taskId: task.taskId,
            status: 'unavailable',
            unavailableReason: reason,
          };
        }

        // Otherwise, it's an actual error (5xx, network, etc.)
        return {
          taskId: task.taskId,
          status: 'error',
          error: leftResult.error || rightResult.error,
        };
      }

      // Handle new file (left side 404) or deleted file (right side 404)
      const leftContent = 'error' in leftResult ? '' : leftResult.content;
      const rightContent = 'error' in rightResult ? '' : rightResult.content;

      // Compute the diff
      const diffLines = computeLineDiff(leftContent, rightContent, false);
      const enhancedLines = enhanceWithWordDiffs(diffLines);
      const alignedLines = computeAlignment(enhancedLines);

      return {
        taskId: task.taskId,
        status: 'completed',
        diffLines: enhancedLines,
        alignedLines,
      };
    } catch (error) {
      // Check if it was a cancellation
      if (abortController.signal.aborted) {
        return {
          taskId: task.taskId,
          status: 'cancelled',
        };
      }

      return {
        taskId: task.taskId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.abortControllers.delete(task.taskId);
    }
  }

  async computeSpanTracker(task: DiffTask): Promise<SpanTrackerResult> {
    if (!this.config) {
      return {
        taskId: task.taskId,
        status: 'error',
        error: 'Worker not initialized - call init() first',
      };
    }

    const abortController = new AbortController();
    this.abortControllers.set(task.taskId, abortController);

    try {
      // Fetch both file versions
      const [leftResult, rightResult] = await Promise.all([
        this.fetchFileContent(task.filePath, task.leftSha, abortController.signal),
        this.fetchFileContent(task.filePath, task.rightSha, abortController.signal),
      ]);

      // Check if cancelled
      if (abortController.signal.aborted) {
        return {
          taskId: task.taskId,
          status: 'cancelled',
        };
      }

      // Handle errors
      if (leftResult.error && rightResult.error) {
        return {
          taskId: task.taskId,
          status: 'error',
          error: `Failed to fetch file contents: ${leftResult.error}`,
        };
      }

      const leftContent = 'error' in leftResult ? '' : leftResult.content;
      const rightContent = 'error' in rightResult ? '' : rightResult.content;

      // Compute diff to build line mappings
      const diffLines = computeLineDiff(leftContent, rightContent, false);

      // Build line mappings from diff
      const mappings: LineMapping[] = [];

      for (const line of diffLines) {
        switch (line.type) {
          case 'context':
            if (line.oldLineNumber !== null) {
              mappings.push({
                leftLine: line.oldLineNumber,
                rightLine: line.newLineNumber,
                type: 'unchanged',
              });
            }
            break;
          case 'deletion':
            if (line.oldLineNumber !== null) {
              mappings.push({
                leftLine: line.oldLineNumber,
                rightLine: null,
                type: 'deleted',
              });
            }
            break;
          case 'addition':
            mappings.push({
              leftLine: 0, // Added lines don't have a left line
              rightLine: line.newLineNumber,
              type: 'added',
            });
            break;
          // Skip headers
        }
      }

      return {
        taskId: task.taskId,
        status: 'completed',
        mappings,
      };
    } catch (error) {
      if (abortController.signal.aborted) {
        return {
          taskId: task.taskId,
          status: 'cancelled',
        };
      }

      return {
        taskId: task.taskId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.abortControllers.delete(task.taskId);
    }
  }

  cancel(taskId: string): void {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
    }
  }

  /**
   * Fetch file content from GitHub Contents API
   */
  private async fetchFileContent(
    filePath: string,
    ref: string,
    signal: AbortSignal
  ): Promise<{ content: string; error?: undefined } | { content?: undefined; error: string; status?: number }> {
    // Config is guaranteed to be set when this is called (checked in computeDiff/computeSpanTracker)
    const config = this.config;
    if (!config) {
      return { error: 'Worker not initialized' };
    }

    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}?ref=${ref}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (config.token) {
      headers.Authorization = `Bearer ${config.token}`;
    }

    try {
      const response = await fetch(url, {
        headers,
        signal,
      });

      if (!response.ok) {
        return {
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      const data = (await response.json()) as GitHubContentsResponse;

      // Decode base64 content
      const content = atob(data.content.replace(/\n/g, ''));

      return { content };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Re-throw abort errors
      }
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Factory function for creating a worker API instance
 * Useful for testing without Comlink
 */
export function createWorkerAPI(): DiffComputeAPI {
  return new DiffComputeWorkerImpl();
}

// Only expose via Comlink in worker context
// Check if we're in a Web Worker context (not main thread or test environment)
// Workers have self but no window; main thread has window; tests have neither or mock them
declare const WorkerGlobalScope: { prototype: object } | undefined;
const isWorkerContext =
  typeof self !== 'undefined' &&
  typeof window === 'undefined' &&
  typeof WorkerGlobalScope !== 'undefined';

if (isWorkerContext) {
  Comlink.expose(new DiffComputeWorkerImpl());
}
