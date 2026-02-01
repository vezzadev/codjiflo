/**
 * Stateless Storage Types (Milestone 4.2)
 *
 * IndexedDB schema types for stateless mode persistence.
 * Used to persist iteration data between sessions without GitHub Action artifacts.
 *
 * Storage persists:
 * - Last seen iteration per PR (for "since last visit" diffs)
 * - Discovered iterations (immutable, for force-push history)
 * - Unavailable iterations (for skipping retries on GC'd commits)
 */

import type { IterationLineage } from '../types';

// ============================================================================
// Record Types (IndexedDB Schema)
// ============================================================================

/**
 * Tracks the last iteration a user viewed for a PR.
 * Used to show "changes since last visit" diffs.
 */
export interface LastSeenRecord {
  /** Primary key: "{owner}/{repo}/{number}" */
  prKey: string;
  /** Last viewed iteration revision */
  iterationRevision: number;
  /** HEAD SHA at time of viewing */
  headSha: string;
  /** Timestamp of last view (ms since epoch) */
  timestamp: number;
}

/**
 * An iteration discovered from commit data.
 * Records are immutable - never overwrite, only add new.
 */
export interface IterationRecord {
  /** Primary key: "{prKey}/{revision}" */
  key: string;
  /** PR identifier: "{owner}/{repo}/{number}" */
  prKey: string;
  /** Iteration revision number */
  revision: number;
  /** Git commit SHA */
  commitSha: string;
  /** Base/parent commit SHA */
  baseSha: string;
  /** Git lineage state: 'current' (in HEAD history) or 'discarded' (orphaned by force-push) */
  lineage: IterationLineage;
  /** Collapsed group ID if discarded */
  collapsedGroupId?: string;
  /** When this iteration was first discovered (ms since epoch) */
  discoveredAt: number;
}

/**
 * Tracks iterations whose commits are no longer available.
 * Used to skip retries on GC'd commits.
 */
export interface UnavailableRecord {
  /** Primary key: "{prKey}/{revision}" */
  key: string;
  /** PR identifier: "{owner}/{repo}/{number}" */
  prKey: string;
  /** Iteration revision number */
  revision: number;
  /** Why unavailable: HTTP status code or unknown */
  reason: '404' | '410' | 'unknown';
  /** When unavailability was detected (ms since epoch) */
  detectedAt: number;
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Abstraction over IndexedDB for stateless iteration persistence.
 * Provides CRUD operations for iteration records.
 */
export interface StatelessStorage {
  // -------------------------------------------------------------------------
  // Last Seen Operations
  // -------------------------------------------------------------------------

  /**
   * Get the last seen record for a PR.
   * @param prKey - PR identifier "{owner}/{repo}/{number}"
   * @returns The last seen record or undefined if never viewed
   */
  getLastSeen(prKey: string): Promise<LastSeenRecord | undefined>;

  /**
   * Update the last seen record for a PR.
   * @param record - The last seen record to save
   */
  setLastSeen(record: LastSeenRecord): Promise<void>;

  // -------------------------------------------------------------------------
  // Iteration Operations (Immutable)
  // -------------------------------------------------------------------------

  /**
   * Get all iterations for a PR.
   * @param prKey - PR identifier "{owner}/{repo}/{number}"
   * @returns Array of iteration records, ordered by revision
   */
  getIterations(prKey: string): Promise<IterationRecord[]>;

  /**
   * Add new iterations (never overwrites existing).
   * Records with matching keys are silently ignored.
   * @param records - Iteration records to add
   */
  addIterations(records: IterationRecord[]): Promise<void>;

  // -------------------------------------------------------------------------
  // Unavailable Operations
  // -------------------------------------------------------------------------

  /**
   * Check if an iteration is marked as unavailable.
   * @param prKey - PR identifier "{owner}/{repo}/{number}"
   * @param revision - Iteration revision number
   * @returns True if the iteration is unavailable
   */
  isUnavailable(prKey: string, revision: number): Promise<boolean>;

  /**
   * Mark an iteration as unavailable.
   * @param record - The unavailable record to save
   */
  markUnavailable(record: UnavailableRecord): Promise<void>;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Close the storage connection.
   * Should be called when storage is no longer needed.
   */
  close(): void;
}
