/**
 * SpanTracker Computation
 *
 * Computes line mappings between file versions using diff.
 */

import type { IterationDatabase } from '../db/database';
import { computeLineDiff, lineDiffToSpanMapping } from '@codjiflo/diff-engine';

/**
 * Count lines in a string.
 *
 * Matches the helper in `packages/diff-engine/src/line-diff.ts` so that
 * the added/deleted branches here agree with the semantics used by the
 * rest of the diff pipeline:
 *
 *   - ""          → 0 lines
 *   - "foo"       → 1 line
 *   - "foo\n"     → 1 line (trailing newline is a terminator, not a line)
 *   - "foo\nbar"  → 2 lines
 *   - "foo\nbar\n"→ 2 lines
 *
 * `content.split('\n').length` is wrong for both edge cases: it returns
 * 1 for "" (a phantom line) and 2 for "foo\n" (off by one).
 */
function countLines(text: string): number {
  if (!text) return 0;
  const newlines = (text.match(/\n/g) ?? []).length;
  return text.endsWith('\n') ? newlines : newlines + 1;
}

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
    const lineCount = countLines(rightContent ?? '');
    if (lineCount === 0) {
      // Empty added file: no lines to map.
      return;
    }
    db.insertSpanMapping(
      trackerId,
      null,
      null,
      1,
      lineCount,
      'added'
    );
    return;
  }

  if (rightContent === null) {
    // File deleted - all lines are "deleted"
    const lineCount = countLines(leftContent);
    if (lineCount === 0) {
      // Previously-empty deleted file: no lines to map.
      return;
    }
    db.insertSpanMapping(
      trackerId,
      1,
      lineCount,
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
