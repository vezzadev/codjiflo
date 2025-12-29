/**
 * SpanTracker Domain: Core Interface and Implementations
 *
 * Enables tracking text positions across code changes.
 * Pure domain logic with no infrastructure dependencies.
 *
 * See spec/functional/iterations.md for full documentation.
 */

import type { LineSpan } from './text-span';
import { createLineSpan } from './text-span';
import type { SpanMappingData, LineMapping } from './span-mapping';
import { createSpanMappingData, emptySpanMappingData } from './span-mapping';

// ============================================================================
// Port Interface (Dependency Inversion)
// ============================================================================

/**
 * Core interface for tracking text positions between snapshots.
 * Implementations may be backed by precomputed data or computed on-demand.
 */
export interface ISpanTracker {
  /** Left (source) snapshot index */
  readonly leftSnapshotIndex: number;

  /** Right (target) snapshot index */
  readonly rightSnapshotIndex: number;

  /**
   * Track a line span forward from left to right snapshot.
   * @param span Lines to track from the left snapshot
   * @returns Corresponding lines in the right snapshot, or null if deleted
   */
  trackSpanForward(span: LineSpan): LineSpan | null;

  /**
   * Track a line span backward from right to left snapshot.
   * @param span Lines to track from the right snapshot
   * @returns Corresponding lines in the left snapshot, or null if added
   */
  trackSpanBackward(span: LineSpan): LineSpan | null;

  /**
   * Get the underlying mapping data
   */
  getMappings(): SpanMappingData;
}

// ============================================================================
// Concrete Implementations
// ============================================================================

/**
 * SpanTracker backed by precomputed mapping data.
 * Used when loading from SQLite artifact.
 */
export class PrecomputedSpanTracker implements ISpanTracker {
  readonly leftSnapshotIndex: number;
  readonly rightSnapshotIndex: number;
  private readonly data: SpanMappingData;

  constructor(leftSnapshotIndex: number, rightSnapshotIndex: number, mappings: LineMapping[]) {
    this.leftSnapshotIndex = leftSnapshotIndex;
    this.rightSnapshotIndex = rightSnapshotIndex;
    this.data = createSpanMappingData(mappings);
  }

  trackSpanForward(span: LineSpan): LineSpan | null {
    const { leftToRight } = this.data;

    // Find mapped position for start line
    const startMapping = leftToRight.get(span.startLine);
    const endMapping = leftToRight.get(span.endLine);

    // If either end is deleted, the span is (partially) gone
    if (startMapping === null || endMapping === null) {
      // Try to find the nearest valid line
      return this.findNearestValidSpanForward(span);
    }

    // If no mapping exists, assume identity (unchanged file region)
    if (startMapping === undefined || endMapping === undefined) {
      return span;
    }

    return createLineSpan(startMapping, endMapping);
  }

  trackSpanBackward(span: LineSpan): LineSpan | null {
    const { rightToLeft } = this.data;

    const startMapping = rightToLeft.get(span.startLine);
    const endMapping = rightToLeft.get(span.endLine);

    if (startMapping === null || endMapping === null) {
      return this.findNearestValidSpanBackward(span);
    }

    if (startMapping === undefined || endMapping === undefined) {
      return span;
    }

    return createLineSpan(startMapping, endMapping);
  }

  getMappings(): SpanMappingData {
    return this.data;
  }

  /**
   * Find nearest valid span when original is deleted
   */
  private findNearestValidSpanForward(span: LineSpan): LineSpan | null {
    const { leftToRight } = this.data;

    // Search outward from the span for a valid mapping
    for (let distance = 1; distance <= 10; distance++) {
      // Try before
      const before = leftToRight.get(span.startLine - distance);
      if (before !== undefined && before !== null) {
        return createLineSpan(before, before);
      }

      // Try after
      const after = leftToRight.get(span.endLine + distance);
      if (after !== undefined && after !== null) {
        return createLineSpan(after, after);
      }
    }

    return null;
  }

  private findNearestValidSpanBackward(span: LineSpan): LineSpan | null {
    const { rightToLeft } = this.data;

    for (let distance = 1; distance <= 10; distance++) {
      const before = rightToLeft.get(span.startLine - distance);
      if (before !== undefined && before !== null) {
        return createLineSpan(before, before);
      }

      const after = rightToLeft.get(span.endLine + distance);
      if (after !== undefined && after !== null) {
        return createLineSpan(after, after);
      }
    }

    return null;
  }
}

/**
 * Identity tracker for unchanged files.
 * All spans map to themselves.
 */
export class IdentitySpanTracker implements ISpanTracker {
  readonly leftSnapshotIndex: number;
  readonly rightSnapshotIndex: number;

  constructor(leftSnapshotIndex: number, rightSnapshotIndex: number) {
    this.leftSnapshotIndex = leftSnapshotIndex;
    this.rightSnapshotIndex = rightSnapshotIndex;
  }

  trackSpanForward(span: LineSpan): LineSpan {
    return span;
  }

  trackSpanBackward(span: LineSpan): LineSpan {
    return span;
  }

  getMappings(): SpanMappingData {
    return emptySpanMappingData();
  }
}

/**
 * Chained tracker for cross-iteration tracking.
 * Composes multiple adjacent trackers to track across multiple iterations.
 */
export class ChainedSpanTracker implements ISpanTracker {
  readonly leftSnapshotIndex: number;
  readonly rightSnapshotIndex: number;
  private readonly trackers: readonly ISpanTracker[];

  constructor(trackers: ISpanTracker[]) {
    if (trackers.length === 0) {
      throw new Error('ChainedSpanTracker requires at least one tracker');
    }

    // Validate chain continuity
    for (let i = 1; i < trackers.length; i++) {
      const prev = trackers[i - 1];
      const curr = trackers[i];
      if (prev && curr && prev.rightSnapshotIndex !== curr.leftSnapshotIndex) {
        throw new Error(
          `Tracker chain broken: ${String(prev.rightSnapshotIndex)} != ${String(curr.leftSnapshotIndex)}`
        );
      }
    }

    this.trackers = trackers;
    const firstTracker = trackers[0];
    const lastTracker = trackers[trackers.length - 1];
    if (!firstTracker || !lastTracker) {
      throw new Error('Invalid tracker array');
    }
    this.leftSnapshotIndex = firstTracker.leftSnapshotIndex;
    this.rightSnapshotIndex = lastTracker.rightSnapshotIndex;
  }

  trackSpanForward(span: LineSpan): LineSpan | null {
    let current: LineSpan | null = span;

    for (const tracker of this.trackers) {
      if (current === null) return null;
      current = tracker.trackSpanForward(current);
    }

    return current;
  }

  trackSpanBackward(span: LineSpan): LineSpan | null {
    let current: LineSpan | null = span;

    // Traverse in reverse order
    for (let i = this.trackers.length - 1; i >= 0; i--) {
      if (current === null) return null;
      const tracker = this.trackers[i];
      if (tracker) {
        current = tracker.trackSpanBackward(current);
      }
    }

    return current;
  }

  getMappings(): SpanMappingData {
    // For chained trackers, return empty (mappings are distributed)
    return emptySpanMappingData();
  }

  /**
   * Get the underlying trackers (for debugging/testing)
   */
  getTrackers(): readonly ISpanTracker[] {
    return this.trackers;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a span tracker from serialized mapping data
 */
export function createSpanTracker(
  leftSnapshotIndex: number,
  rightSnapshotIndex: number,
  mappings: LineMapping[]
): ISpanTracker {
  // If no mappings, assume identity
  if (mappings.length === 0) {
    return new IdentitySpanTracker(leftSnapshotIndex, rightSnapshotIndex);
  }

  return new PrecomputedSpanTracker(leftSnapshotIndex, rightSnapshotIndex, mappings);
}

/**
 * Chain multiple trackers for cross-iteration tracking.
 * Returns identity tracker if trackers array is empty.
 */
export function chainTrackers(trackers: ISpanTracker[]): ISpanTracker {
  if (trackers.length === 0) {
    throw new Error('Cannot chain zero trackers');
  }

  const firstTracker = trackers[0];
  if (trackers.length === 1 && firstTracker) {
    return firstTracker;
  }

  return new ChainedSpanTracker(trackers);
}
