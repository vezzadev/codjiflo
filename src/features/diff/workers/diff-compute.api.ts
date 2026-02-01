/**
 * Diff Compute Worker API
 *
 * Defines the Comlink-exposed interface for the Web Worker that computes diffs.
 * This interface is the contract between the main thread scheduler and the worker.
 */

import type { DiffTask, DiffResult, SpanTrackerResult } from '../scheduler/types';

/**
 * Configuration for initializing the diff compute worker
 */
export interface WorkerConfig {
  /** GitHub auth token (optional for public repos) */
  token?: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
}

/**
 * API interface exposed by the diff compute worker via Comlink
 *
 * The worker handles:
 * - Fetching file contents from GitHub
 * - Computing diffs between commits
 * - Computing SpanTracker line mappings for comment positioning
 */
export interface DiffComputeAPI {
  /**
   * Initialize the worker with GitHub auth and repo context
   *
   * Must be called before computeDiff or computeSpanTracker.
   * Can be called multiple times to update the config (e.g., token refresh).
   */
  init(config: WorkerConfig): Promise<void>;

  /**
   * Compute diff for a file between two commits
   *
   * Fetches file contents from GitHub and computes the diff using
   * the diff engine. Returns parsed and aligned diff lines.
   *
   * @param task - The diff task with file path and commit SHAs
   * @returns DiffResult with status and computed diff lines
   */
  computeDiff(task: DiffTask): Promise<DiffResult>;

  /**
   * Compute SpanTracker line mappings for comment positioning
   *
   * Computes the line number mappings between two versions of a file
   * to support accurate comment positioning across iterations.
   *
   * @param task - The diff task with file path and commit SHAs
   * @returns SpanTrackerResult with line mappings
   */
  computeSpanTracker(task: DiffTask): Promise<SpanTrackerResult>;

  /**
   * Cancel an in-progress task
   *
   * If the task is currently being computed, it will be cancelled
   * and the result will have status 'cancelled'.
   *
   * @param taskId - The ID of the task to cancel
   */
  cancel(taskId: string): void;
}
