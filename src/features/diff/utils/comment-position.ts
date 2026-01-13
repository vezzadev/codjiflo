/**
 * Comment Position Utilities
 *
 * Maps between diff line indices and GitHub API positions.
 * GitHub uses 1-based position counting that excludes header lines.
 */

import type { ParsedDiffLine } from '../types';

/**
 * Get the GitHub API position for a diff line at a given index.
 * Position is 1-based and counts only non-header lines.
 *
 * @param diffLines - Array of parsed diff lines
 * @param targetIndex - The index of the target line in diffLines
 * @returns The GitHub API position (1-based), or null if the index is invalid or a header
 */
export function getDiffLinePosition(
  diffLines: ParsedDiffLine[],
  targetIndex: number
): number | null {
  if (targetIndex < 0 || targetIndex >= diffLines.length) {
    return null;
  }

  const targetLine = diffLines[targetIndex];
  if (!targetLine || targetLine.type === 'header') {
    return null;
  }

  let position = 0;
  for (let i = 0; i <= targetIndex; i += 1) {
    if (diffLines[i]?.type !== 'header') {
      position += 1;
    }
  }

  return position;
}

/**
 * Get the diff line index for a given GitHub API position.
 * Inverse of getDiffLinePosition - converts position back to array index.
 *
 * @param diffLines - Array of parsed diff lines
 * @param position - The GitHub API position (1-based)
 * @returns The index in diffLines, or null if position is invalid
 */
export function getDiffLineIndexForPosition(
  diffLines: ParsedDiffLine[],
  position: number
): number | null {
  if (position <= 0) {
    return null;
  }

  let current = 0;
  for (let i = 0; i < diffLines.length; i += 1) {
    if (diffLines[i]?.type === 'header') {
      continue;
    }
    current += 1;
    if (current === position) {
      return i;
    }
  }

  return null;
}
