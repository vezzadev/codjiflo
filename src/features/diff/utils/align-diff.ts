/**
 * Side-by-side alignment utility (S-3.2)
 * Re-exports from diff-engine for main thread usage
 * Can also be used synchronously without Web Worker
 */

import { computeAlignment } from '../workers/diff-engine';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

export { computeAlignment };

/**
 * Apply content filter to aligned diff lines (S-3.3)
 * AC-3.3.6-8: Filter to show only left, both, or right changes
 */
export function applyContentFilter(
  alignedLines: AlignedDiffLine[],
  filter: 'left' | 'both' | 'right'
): AlignedDiffLine[] {
  if (filter === 'both') {
    return alignedLines;
  }

  return alignedLines.map((pair): AlignedDiffLine => {
    if (filter === 'left') {
      // Show left side, hide pure additions
      if (pair.left === null && pair.right?.type === 'addition') {
        return { ...pair, right: null }; // Both null = skip this row
      }
      return pair;
    } else {
      // filter === 'right'
      // Show right side, hide pure deletions
      if (pair.right === null && pair.left?.type === 'deletion') {
        return { ...pair, left: null }; // Both null = skip this row
      }
      return pair;
    }
  }).filter((pair) => pair.left !== null || pair.right !== null);
}

/**
 * Compute aligned diff from parsed lines
 * Convenience wrapper for synchronous usage
 */
export function alignDiffLines(diffLines: ParsedDiffLine[]): AlignedDiffLine[] {
  return computeAlignment(diffLines);
}
