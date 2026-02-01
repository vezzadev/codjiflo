/**
 * Type definitions for the diff scheduler
 * Used for priority-based scheduling of diff computation tasks
 */

import type { ParsedDiffLine, AlignedDiffLine } from '../types';

// ============================================================================
// Priority & Task Type Enums
// ============================================================================

/**
 * Priority levels for diff tasks
 * Lower values = higher priority (processed first)
 */
export enum DiffPriority {
  Highest = 0,
  High = 1,
  Medium = 2,
  Low = 3,
}

/**
 * Types of diff computation tasks
 */
export type DiffTaskType = 'compute_diff' | 'compute_span_tracker';

// ============================================================================
// Task Definitions
// ============================================================================

/**
 * A diff computation task to be scheduled
 */
export interface DiffTask {
  taskId: string;
  type: DiffTaskType;
  filePath: string;
  leftSha: string;
  rightSha: string;
  compareMode: '2dot' | '3dot';
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of a diff computation task
 */
export interface DiffResult {
  taskId: string;
  status: 'completed' | 'cancelled' | 'error' | 'unavailable';
  diffLines?: ParsedDiffLine[];
  alignedLines?: AlignedDiffLine[];
  unavailableReason?: '404' | '410';
  error?: string;
}

/**
 * Mapping between left and right line numbers for SpanTracker
 */
export interface LineMapping {
  leftLine: number;
  rightLine: number | null;
  type: 'unchanged' | 'modified' | 'added' | 'deleted';
}

/**
 * Result of a SpanTracker computation task
 */
export interface SpanTrackerResult {
  taskId: string;
  status: 'completed' | 'cancelled' | 'error';
  mappings?: LineMapping[];
  error?: string;
}

// ============================================================================
// Scheduling Options
// ============================================================================

/**
 * Options for scheduling a diff task
 */
export interface ScheduleOptions {
  priority: DiffPriority;
  /** Number of comments on the file - higher count = higher priority */
  commentCount?: number;
  /** Position in UI file list - lower = higher priority */
  uiOrder?: number;
}

/**
 * A task with scheduling metadata
 */
export interface ScheduledTask {
  task: DiffTask;
  priority: DiffPriority;
  commentCount: number;
  uiOrder: number;
  enqueuedAt: number;
}

// ============================================================================
// Scheduler Interface
// ============================================================================

/**
 * Interface for the diff scheduler
 * Manages a priority queue of diff computation tasks
 */
export interface DiffScheduler {
  /**
   * Schedule a diff task for computation
   * @returns taskId for tracking
   */
  schedule(task: DiffTask, options: ScheduleOptions): string;

  /**
   * Bump a task to highest priority (e.g., when user selects file)
   */
  prioritize(taskId: string): void;

  /**
   * Cancel all pending tasks and clear results
   */
  clear(): void;

  /**
   * Get the result of a completed diff task
   */
  getResult(taskId: string): DiffResult | undefined;

  /**
   * Get the result of a completed SpanTracker task
   */
  getSpanTrackerResult(taskId: string): SpanTrackerResult | undefined;

  /**
   * Subscribe to task completion events
   * @returns Unsubscribe function
   */
  onComplete(callback: (result: DiffResult | SpanTrackerResult) => void): () => void;
}
