/**
 * Utilities for calculating hunk (change group) positions in diff data
 * Used for J/K keyboard navigation between changes
 */

import type { ParsedDiffLine, AlignedDiffLine } from '../types';

/**
 * Calculate the starting indices of each hunk (group of consecutive changes)
 * A hunk is a contiguous group of addition/deletion lines separated by context/header lines
 *
 * @param diffLines - Array of parsed diff lines
 * @returns Array of indices where each hunk starts
 */
export function calculateHunkIndices(diffLines: ParsedDiffLine[]): number[] {
  const hunkStartIndices: number[] = [];
  let inHunk = false;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];
    if (!line) continue;

    const isChange = line.type === 'addition' || line.type === 'deletion';

    if (isChange && !inHunk) {
      // Start of a new hunk
      hunkStartIndices.push(i);
      inHunk = true;
    } else if (!isChange) {
      // Context or header line - end of hunk
      inHunk = false;
    }
  }

  return hunkStartIndices;
}

/**
 * Calculate the starting indices of each hunk for aligned (side-by-side) diff lines
 * A hunk starts when either left or right side has a change after a non-change line
 *
 * @param alignedLines - Array of aligned diff line pairs
 * @returns Array of indices where each hunk starts
 */
export function calculateAlignedHunkIndices(alignedLines: AlignedDiffLine[]): number[] {
  const hunkStartIndices: number[] = [];
  let inHunk = false;

  for (let i = 0; i < alignedLines.length; i++) {
    const pair = alignedLines[i];
    if (!pair) continue;

    const leftIsChange = pair.left?.type === 'addition' || pair.left?.type === 'deletion';
    const rightIsChange = pair.right?.type === 'addition' || pair.right?.type === 'deletion';
    const isChange = leftIsChange || rightIsChange;

    if (isChange && !inHunk) {
      // Start of a new hunk
      hunkStartIndices.push(i);
      inHunk = true;
    } else if (!isChange) {
      // Context or header line on both sides - end of hunk
      inHunk = false;
    }
  }

  return hunkStartIndices;
}
