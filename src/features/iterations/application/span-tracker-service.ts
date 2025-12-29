/**
 * SpanTracker Application Layer: Service
 *
 * Orchestrates SpanTracker loading, caching, and chaining.
 * Depends on ports (interfaces) not concrete implementations.
 */

import type { ISpanTracker, LineSpan } from '../domain';
import { chainTrackers, IdentitySpanTracker } from '../domain';

// ============================================================================
// Port Interface (Dependency Inversion)
// ============================================================================

/**
 * Port for loading SpanTrackers from storage.
 * Implemented by infrastructure layer (e.g., SQLiteSpanTrackerReader).
 */
export interface ISpanTrackerReader {
  /**
   * Load a precomputed SpanTracker for a specific snapshot pair.
   * Returns null if not found.
   */
  getSpanTracker(
    artifactId: number,
    leftSnapshotIndex: number,
    rightSnapshotIndex: number
  ): Promise<ISpanTracker | null>;

  /**
   * Check if files are identical (for identity optimization)
   */
  areFilesIdentical(
    artifactId: number,
    leftSnapshotIndex: number,
    rightSnapshotIndex: number
  ): Promise<boolean>;
}

// ============================================================================
// Application Service
// ============================================================================

/**
 * SpanTrackerService manages loading, caching, and chaining of SpanTrackers.
 *
 * Use cases:
 * 1. Get tracker for adjacent snapshots (precomputed in artifact)
 * 2. Get tracker for cross-iteration (chain adjacent trackers)
 * 3. Track comment position across iterations
 */
export class SpanTrackerService {
  private reader: ISpanTrackerReader;
  private cache: Map<string, ISpanTracker>;

  constructor(reader: ISpanTrackerReader) {
    this.reader = reader;
    this.cache = new Map();
  }

  /**
   * Get or create a SpanTracker for the given snapshot range.
   *
   * - For adjacent snapshots (e.g., 0→1, 2→3): loads precomputed from storage
   * - For cross-iteration (e.g., 1→5): chains adjacent trackers
   */
  async getTracker(
    artifactId: number,
    leftSnapshotIndex: number,
    rightSnapshotIndex: number
  ): Promise<ISpanTracker> {
    // Validate indices
    if (leftSnapshotIndex < 0 || rightSnapshotIndex < 0) {
      throw new Error('Snapshot indices must be non-negative');
    }
    if (leftSnapshotIndex >= rightSnapshotIndex) {
      throw new Error('Left snapshot must be before right snapshot');
    }

    const cacheKey = this.getCacheKey(artifactId, leftSnapshotIndex, rightSnapshotIndex);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Determine if this is an adjacent pair
    const isAdjacent = this.isAdjacentPair(leftSnapshotIndex, rightSnapshotIndex);

    let tracker: ISpanTracker;

    if (isAdjacent) {
      // Load precomputed tracker
      tracker = await this.loadAdjacentTracker(artifactId, leftSnapshotIndex, rightSnapshotIndex);
    } else {
      // Chain adjacent trackers for cross-iteration
      tracker = await this.buildChainedTracker(artifactId, leftSnapshotIndex, rightSnapshotIndex);
    }

    // Cache and return
    this.cache.set(cacheKey, tracker);
    return tracker;
  }

  /**
   * Track a comment's position forward through iterations.
   *
   * @param artifactId The file artifact
   * @param originalSnapshot The snapshot where comment was created
   * @param originalSpan The line span at creation time
   * @param targetSnapshot The snapshot to track to
   * @returns The line span at target snapshot, or null if deleted
   */
  async trackCommentForward(
    artifactId: number,
    originalSnapshot: number,
    originalSpan: LineSpan,
    targetSnapshot: number
  ): Promise<LineSpan | null> {
    if (targetSnapshot <= originalSnapshot) {
      // No tracking needed if target is same or earlier
      return originalSpan;
    }

    const tracker = await this.getTracker(artifactId, originalSnapshot, targetSnapshot);
    return tracker.trackSpanForward(originalSpan);
  }

  /**
   * Track a comment's position backward to an earlier snapshot.
   */
  async trackCommentBackward(
    artifactId: number,
    currentSnapshot: number,
    currentSpan: LineSpan,
    targetSnapshot: number
  ): Promise<LineSpan | null> {
    if (targetSnapshot >= currentSnapshot) {
      return currentSpan;
    }

    const tracker = await this.getTracker(artifactId, targetSnapshot, currentSnapshot);
    return tracker.trackSpanBackward(currentSpan);
  }

  /**
   * Preload trackers for visible files (performance optimization).
   */
  async preloadTrackers(
    artifactIds: number[],
    leftSnapshotIndex: number,
    rightSnapshotIndex: number
  ): Promise<void> {
    const promises = artifactIds.map((id) =>
      this.getTracker(id, leftSnapshotIndex, rightSnapshotIndex)
    );
    await Promise.all(promises);
  }

  /**
   * Clear the cache (e.g., when switching PRs).
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getCacheKey(artifactId: number, left: number, right: number): string {
    return `${String(artifactId)}:${String(left)}:${String(right)}`;
  }

  /**
   * Check if two snapshot indices form an adjacent pair (same iteration).
   * Adjacent pairs are: (0,1), (2,3), (4,5), etc.
   */
  private isAdjacentPair(left: number, right: number): boolean {
    return left % 2 === 0 && right === left + 1;
  }

  /**
   * Load a precomputed tracker for an adjacent pair.
   */
  private async loadAdjacentTracker(
    artifactId: number,
    left: number,
    right: number
  ): Promise<ISpanTracker> {
    // Check if files are identical (optimization)
    const identical = await this.reader.areFilesIdentical(artifactId, left, right);
    if (identical) {
      return new IdentitySpanTracker(left, right);
    }

    // Load from storage
    const tracker = await this.reader.getSpanTracker(artifactId, left, right);
    if (tracker) {
      return tracker;
    }

    // Fallback to identity if not found
    console.warn(`SpanTracker not found for artifact ${String(artifactId)} (${String(left)}→${String(right)}), using identity`);
    return new IdentitySpanTracker(left, right);
  }

  /**
   * Build a chained tracker for cross-iteration comparison.
   *
   * To go from snapshot 0 → 5:
   * 1. Find all adjacent pairs needed: 0→1, 2→3, 4→5
   * 2. Load each tracker
   * 3. Chain them together
   */
  private async buildChainedTracker(
    artifactId: number,
    left: number,
    right: number
  ): Promise<ISpanTracker> {
    const trackers: ISpanTracker[] = [];

    // Determine which adjacent pairs we need
    // Start from the even index at or below 'left'
    const startPair = left % 2 === 0 ? left : left - 1;

    for (let pairLeft = startPair; pairLeft < right; pairLeft += 2) {
      const pairRight = pairLeft + 1;

      // Skip if this pair is entirely before our range
      if (pairRight <= left) continue;

      // Skip if this pair starts after our range
      if (pairLeft >= right) break;

      const tracker = await this.getTracker(artifactId, pairLeft, pairRight);
      trackers.push(tracker);
    }

    if (trackers.length === 0) {
      // No trackers needed (shouldn't happen with valid input)
      return new IdentitySpanTracker(left, right);
    }

    return chainTrackers(trackers);
  }
}
