/**
 * Filter a full file diff to show only changed lines with context.
 * This converts a full diff (showing all lines) into a patch-like format
 * with hunks containing only changes and surrounding context lines.
 */

import type { ParsedDiffLine, AlignedDiffLine } from '../types';

/** Default number of context lines to show around changes */
const DEFAULT_CONTEXT_LINES = 3;

/**
 * Filter a full diff to show only changes with context lines.
 * Groups consecutive changes into hunks with context lines around them.
 *
 * @param diffLines - Full diff lines (all lines from the file)
 * @param contextLines - Number of context lines to show around changes (default: 3)
 * @returns Filtered diff lines with only changes and context, plus hunk headers
 */
export function filterToChangesOnly(
  diffLines: ParsedDiffLine[],
  contextLines: number = DEFAULT_CONTEXT_LINES
): ParsedDiffLine[] {
  if (diffLines.length === 0) {
    return [];
  }

  // Find indices of all changed lines
  const changedIndices: number[] = [];
  diffLines.forEach((line, i) => {
    if (line.type === 'addition' || line.type === 'deletion') {
      changedIndices.push(i);
    }
  });

  // If no changes, return empty (nothing to show in "changes only" mode)
  if (changedIndices.length === 0) {
    return [];
  }

  // Build ranges of lines to include (change + context)
  const ranges: { start: number; end: number }[] = [];

  for (const changeIdx of changedIndices) {
    const start = Math.max(0, changeIdx - contextLines);
    const end = Math.min(diffLines.length - 1, changeIdx + contextLines);

    // Merge with previous range if overlapping or adjacent
    const lastRange = ranges[ranges.length - 1];
    if (lastRange && start <= lastRange.end + 1) {
      lastRange.end = end;
    } else {
      ranges.push({ start, end });
    }
  }

  // Build output with hunk headers
  const result: ParsedDiffLine[] = [];

  for (const range of ranges) {
    // Calculate line numbers for hunk header
    // Find the old/new line numbers at the start of this hunk
    let oldStart = 1;
    let newStart = 1;

    // Look for the first line in the range with valid line numbers
    const linesInRange = diffLines.slice(range.start, range.end + 1);
    for (const line of linesInRange) {
      if (line.oldLineNumber !== null) {
        oldStart = line.oldLineNumber;
        break;
      }
      if (line.newLineNumber !== null) {
        // For additions at the start, estimate old line number
        oldStart = line.newLineNumber;
        break;
      }
    }

    for (const line of linesInRange) {
      if (line.newLineNumber !== null) {
        newStart = line.newLineNumber;
        break;
      }
      if (line.oldLineNumber !== null) {
        // For deletions at the start, estimate new line number
        newStart = line.oldLineNumber;
        break;
      }
    }

    // Count lines in each category for the hunk
    let oldCount = 0;
    let newCount = 0;

    for (const line of linesInRange) {
      if (line.type === 'context') {
        oldCount++;
        newCount++;
      } else if (line.type === 'deletion') {
        oldCount++;
      } else if (line.type === 'addition') {
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

    // Add lines in the range
    result.push(...linesInRange);
  }

  return result;
}

/**
 * Filter aligned lines to show only changes with context.
 * Used for side-by-side view in "changes only" mode.
 *
 * @param alignedLines - Full aligned diff lines
 * @param contextLines - Number of context lines to show around changes (default: 3)
 * @returns Filtered aligned lines with only changes and context
 */
export function filterAlignedToChangesOnly(
  alignedLines: AlignedDiffLine[],
  contextLines: number = DEFAULT_CONTEXT_LINES
): AlignedDiffLine[] {
  if (alignedLines.length === 0) {
    return [];
  }

  // Find indices of all changed lines (where left or right is addition/deletion)
  const changedIndices: number[] = [];
  alignedLines.forEach((pair, i) => {
    const leftType = pair.left?.type;
    const rightType = pair.right?.type;

    if (
      leftType === 'addition' ||
      leftType === 'deletion' ||
      rightType === 'addition' ||
      rightType === 'deletion'
    ) {
      changedIndices.push(i);
    }
  });

  // If no changes, return empty
  if (changedIndices.length === 0) {
    return [];
  }

  // Build ranges of lines to include (change + context)
  const ranges: { start: number; end: number }[] = [];

  for (const changeIdx of changedIndices) {
    const start = Math.max(0, changeIdx - contextLines);
    const end = Math.min(alignedLines.length - 1, changeIdx + contextLines);

    // Merge with previous range if overlapping or adjacent
    const lastRange = ranges[ranges.length - 1];
    if (lastRange && start <= lastRange.end + 1) {
      lastRange.end = end;
    } else {
      ranges.push({ start, end });
    }
  }

  // Build output (no headers needed for side-by-side view - headers are inline in DiffLine)
  const result: AlignedDiffLine[] = [];

  ranges.forEach((range, rangeIndex) => {
    // Add a separator header row between non-contiguous ranges (except before the first)
    if (rangeIndex > 0) {
      // Get line numbers for the header
      const firstPair = alignedLines[range.start];
      if (firstPair) {
        const oldStart = firstPair.left?.oldLineNumber ?? firstPair.right?.oldLineNumber ?? null;
        const newStart = firstPair.right?.newLineNumber ?? firstPair.left?.newLineNumber ?? null;

        result.push({
          left: {
            type: 'header',
            content: `@@ -${oldStart ?? '?'} +${newStart ?? '?'} @@`,
            oldLineNumber: null,
            newLineNumber: null,
          },
          right: {
            type: 'header',
            content: `@@ -${oldStart ?? '?'} +${newStart ?? '?'} @@`,
            oldLineNumber: null,
            newLineNumber: null,
          },
          key: `header-${rangeIndex}`,
        });
      }
    }

    // Add lines in the range
    result.push(...alignedLines.slice(range.start, range.end + 1));
  });

  return result;
}
