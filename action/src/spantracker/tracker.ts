/**
 * SpanTracker Computation
 *
 * Computes line mappings between file versions using diff.
 */

import type { IterationDatabase } from '../db/database';
import { computeLineDiff, lineDiffToSpanMapping } from '@codjiflo/diff-engine';

// ============================================================================
// Types
// ============================================================================

interface SpanTrackerInput {
  artifactId: number;
  leftSnapshotIndex: number;
  rightSnapshotIndex: number;
  leftContent: string | null;
  rightContent: string | null;
}

// ============================================================================
// SpanTracker Computation
// ============================================================================

/**
 * Compute and store SpanTrackers for an iteration.
 * Computes:
 * 1. Adjacent tracker (left → right within iteration)
 * 2. Base → right tracker (for full diff comparison)
 */
export function computeSpanTrackers(
  db: IterationDatabase,
  inputs: SpanTrackerInput[]
): void {
  for (const input of inputs) {
    computeSingleTracker(db, input);
  }
}

/**
 * Compute a single SpanTracker from two content snapshots.
 */
function computeSingleTracker(
  db: IterationDatabase,
  input: SpanTrackerInput
): void {
  const { artifactId, leftSnapshotIndex, rightSnapshotIndex, leftContent, rightContent } = input;

  // Insert tracker record
  const trackerId = db.insertSpanTracker(artifactId, leftSnapshotIndex, rightSnapshotIndex);

  // Handle edge cases
  if (leftContent === null && rightContent === null) {
    // Both null - no mappings needed
    return;
  }

  if (leftContent === null) {
    // File added - all lines are "added"
    const lines = (rightContent ?? '').split('\n');
    db.insertSpanMapping(
      trackerId,
      null,
      null,
      1,
      lines.length,
      'added'
    );
    return;
  }

  if (rightContent === null) {
    // File deleted - all lines are "deleted"
    const lines = leftContent.split('\n');
    db.insertSpanMapping(
      trackerId,
      1,
      lines.length,
      null,
      null,
      'deleted'
    );
    return;
  }

  // Compute line diff
  const diffs = computeLineDiff(leftContent, rightContent);

  // Convert diffs to span mappings
  let leftLine = 1;
  let rightLine = 1;

  for (const diff of diffs) {
    const mapping = lineDiffToSpanMapping(diff, leftLine, rightLine);

    db.insertSpanMapping(
      trackerId,
      mapping.left_line_start,
      mapping.left_line_end,
      mapping.right_line_start,
      mapping.right_line_end,
      mapping.mapping_type
    );

    // Advance line counters
    leftLine += diff.leftLines;
    rightLine += diff.rightLines;
  }
}

/**
 * Prepare SpanTracker inputs for a new iteration.
 */
export function prepareSpanTrackerInputs(
  db: IterationDatabase,
  artifactIds: number[],
  leftSnapshotIndex: number,
  rightSnapshotIndex: number
): SpanTrackerInput[] {
  const inputs: SpanTrackerInput[] = [];

  for (const artifactId of artifactIds) {
    const leftContent = db.getArtifactSnapshot(artifactId, leftSnapshotIndex);
    const rightContent = db.getArtifactSnapshot(artifactId, rightSnapshotIndex);

    inputs.push({
      artifactId,
      leftSnapshotIndex,
      rightSnapshotIndex,
      leftContent: leftContent?.content ?? null,
      rightContent: rightContent?.content ?? null,
    });
  }

  return inputs;
}
