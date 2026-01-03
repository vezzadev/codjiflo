/**
 * Collapses context lines in a full file diff to show only changes
 * with a configurable number of context lines around each change.
 */

import type { ParsedDiffLine } from '../types';

/** Default number of context lines to show around each change */
const DEFAULT_CONTEXT_LINES = 3;

/**
 * Collapse a full file diff to show only changes with surrounding context.
 * This transforms a full file diff into a hunk-based view similar to git diff output.
 *
 * @param lines - Full file diff lines
 * @param contextLines - Number of context lines to show around changes (default: 3)
 * @returns Filtered diff lines with hunk headers
 */
export function collapseToChangesOnly(
  lines: ParsedDiffLine[],
  contextLines: number = DEFAULT_CONTEXT_LINES
): ParsedDiffLine[] {
  if (lines.length === 0) return [];

  // Find indices of all changed lines (additions/deletions)
  const changeIndices: number[] = [];
  lines.forEach((line, index) => {
    if (line.type === 'addition' || line.type === 'deletion') {
      changeIndices.push(index);
    }
  });

  // If no changes, return empty (nothing to show in changes-only mode)
  if (changeIndices.length === 0) {
    return [];
  }

  // Build ranges of lines to include (change + context)
  const includedRanges: { start: number; end: number }[] = [];

  for (const changeIndex of changeIndices) {
    const start = Math.max(0, changeIndex - contextLines);
    const end = Math.min(lines.length - 1, changeIndex + contextLines);

    // Merge with previous range if overlapping or adjacent
    if (includedRanges.length > 0) {
      const lastRange = includedRanges[includedRanges.length - 1];
      if (lastRange !== undefined && start <= lastRange.end + 1) {
        // Extend the last range
        lastRange.end = Math.max(lastRange.end, end);
        continue;
      }
    }

    includedRanges.push({ start, end });
  }

  // Build result with hunk headers between non-contiguous ranges
  const result: ParsedDiffLine[] = [];

  for (const range of includedRanges) {

    // Add hunk header at the start of each range
    const firstLineInRange = lines[range.start];

    // Calculate old/new line numbers for hunk header
    const oldStart = firstLineInRange?.oldLineNumber ?? firstLineInRange?.newLineNumber ?? 1;
    const newStart = firstLineInRange?.newLineNumber ?? firstLineInRange?.oldLineNumber ?? 1;

    // Count lines in this hunk
    let oldCount = 0;
    let newCount = 0;
    for (let i = range.start; i <= range.end; i++) {
      const line = lines[i];
      if (line?.type === 'deletion') {
        oldCount++;
      } else if (line?.type === 'addition') {
        newCount++;
      } else {
        oldCount++;
        newCount++;
      }
    }

    // Add hunk header
    result.push({
      type: 'header',
      content: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
      oldLineNumber: null,
      newLineNumber: null,
    });

    // Add lines in this range
    for (let i = range.start; i <= range.end; i++) {
      const line = lines[i];
      if (line) {
        result.push(line);
      }
    }
  }

  return result;
}

/**
 * Collapse aligned lines for side-by-side view to show only changes with context.
 */
import type { AlignedDiffLine } from '../types';

export function collapseAlignedToChangesOnly(
  alignedLines: AlignedDiffLine[],
  contextLines: number = DEFAULT_CONTEXT_LINES
): AlignedDiffLine[] {
  if (alignedLines.length === 0) return [];

  // Find indices of all changed lines
  const changeIndices: number[] = [];
  alignedLines.forEach((pair, index) => {
    const hasChange =
      pair.left?.type === 'deletion' ||
      pair.left?.type === 'addition' ||
      pair.right?.type === 'deletion' ||
      pair.right?.type === 'addition';
    if (hasChange) {
      changeIndices.push(index);
    }
  });

  // If no changes, return empty
  if (changeIndices.length === 0) {
    return [];
  }

  // Build ranges of lines to include
  const includedRanges: { start: number; end: number }[] = [];

  for (const changeIndex of changeIndices) {
    const start = Math.max(0, changeIndex - contextLines);
    const end = Math.min(alignedLines.length - 1, changeIndex + contextLines);

    if (includedRanges.length > 0) {
      const lastRange = includedRanges[includedRanges.length - 1];
      if (lastRange !== undefined && start <= lastRange.end + 1) {
        lastRange.end = Math.max(lastRange.end, end);
        continue;
      }
    }

    includedRanges.push({ start, end });
  }

  // Build result (for SxS view, we don't add headers - the gap is visual)
  const result: AlignedDiffLine[] = [];

  for (const range of includedRanges) {
    for (let i = range.start; i <= range.end; i++) {
      const line = alignedLines[i];
      if (line) {
        result.push(line);
      }
    }
  }

  return result;
}
