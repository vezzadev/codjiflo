/**
 * Pipeline Stage 4.5: Side Filter
 *
 * Applies left/both/right content filter to diffLines and alignedLines.
 * This stage runs BEFORE navigation so hunk indices are calculated on
 * filtered data, eliminating the need for scroll-index mapping.
 */

import { useMemo } from 'react';
import type { DiffDisplayOutput, DiffSideFilterOutput } from './types';
import type { ParsedDiffLine, AlignedDiffLine, ContentFilter } from '../../types';

/**
 * Filter unified diff lines by content filter.
 * - left: show only deletions (keep headers and context)
 * - right: show only additions (keep headers and context)
 * - both: no filtering
 */
function filterDiffLines(
  lines: ParsedDiffLine[],
  filter: ContentFilter
): ParsedDiffLine[] {
  if (filter === 'both') return lines;

  return lines.filter((line) => {
    // Always keep headers and context lines
    if (line.type === 'header' || line.type === 'context') return true;
    if (filter === 'left') {
      return line.type === 'deletion';
    }
    return line.type === 'addition';
  });
}

/**
 * Filter aligned line pairs by content filter.
 * - left: keep pairs where left side has content (not pure additions)
 * - right: keep pairs where right side has content (not pure deletions)
 * - both: no filtering
 */
function filterAlignedLines(
  lines: AlignedDiffLine[],
  filter: ContentFilter
): AlignedDiffLine[] {
  if (filter === 'both') return lines;

  return lines.filter((pair) => {
    if (filter === 'left') {
      // Keep if left has content, or if right is not a pure addition
      return pair.left !== null || pair.right?.type !== 'addition';
    } else {
      // Keep if right has content, or if left is not a pure deletion
      return pair.right !== null || pair.left?.type !== 'deletion';
    }
  });
}

/**
 * Hook to apply side filter (left/both/right) to diff content.
 * Runs before navigation so hunk indices are calculated on filtered data.
 */
export function useDiffSideFilter(display: DiffDisplayOutput): DiffSideFilterOutput {
  const { diffLines, alignedLines, contentFilter } = display;

  // Filter diff lines for unified view
  const filteredDiffLines = useMemo(
    () => filterDiffLines(diffLines, contentFilter),
    [diffLines, contentFilter]
  );

  // Filter aligned lines for side-by-side view
  const filteredAlignedLines = useMemo(
    () => filterAlignedLines(alignedLines, contentFilter),
    [alignedLines, contentFilter]
  );

  return {
    ...display,
    diffLines: filteredDiffLines,
    alignedLines: filteredAlignedLines,
  };
}
