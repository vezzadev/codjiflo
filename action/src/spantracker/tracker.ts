/**
 * SpanTracker Computation
 *
 * Computes line mappings between file versions using diff.
 */

import type { IterationDatabase, SpanMappingRow } from '../db/database.js';
import { computeLineDiff, LineDiff } from './diff-engine.js';

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
    const mapping = diffToMapping(diff, leftLine, rightLine);

    db.insertSpanMapping(
      trackerId,
      mapping.left_line_start,
      mapping.left_line_end,
      mapping.right_line_start,
      mapping.right_line_end,
      mapping.mapping_type
    );

    // Advance line counters
    if (diff.type === 'unchanged' || diff.type === 'modified') {
      leftLine += diff.leftLines;
      rightLine += diff.rightLines;
    } else if (diff.type === 'deleted') {
      leftLine += diff.leftLines;
    } else if (diff.type === 'added') {
      rightLine += diff.rightLines;
    }
  }
}

/**
 * Convert a LineDiff to a SpanMappingRow.
 */
function diffToMapping(
  diff: LineDiff,
  leftLine: number,
  rightLine: number
): Omit<SpanMappingRow, 'tracker_id'> {
  switch (diff.type) {
    case 'unchanged':
      return {
        left_line_start: leftLine,
        left_line_end: leftLine + diff.leftLines - 1,
        right_line_start: rightLine,
        right_line_end: rightLine + diff.rightLines - 1,
        mapping_type: 'unchanged',
      };

    case 'modified':
      return {
        left_line_start: leftLine,
        left_line_end: leftLine + diff.leftLines - 1,
        right_line_start: rightLine,
        right_line_end: rightLine + diff.rightLines - 1,
        mapping_type: 'modified',
      };

    case 'deleted':
      return {
        left_line_start: leftLine,
        left_line_end: leftLine + diff.leftLines - 1,
        right_line_start: null,
        right_line_end: null,
        mapping_type: 'deleted',
      };

    case 'added':
      return {
        left_line_start: null,
        left_line_end: null,
        right_line_start: rightLine,
        right_line_end: rightLine + diff.rightLines - 1,
        mapping_type: 'added',
      };
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
    const leftContent = db.getFileContent(artifactId, leftSnapshotIndex);
    const rightContent = db.getFileContent(artifactId, rightSnapshotIndex);

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
