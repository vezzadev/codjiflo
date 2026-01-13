/**
 * Pipeline Stage 3: View Shape
 *
 * Shapes data for inline vs side-by-side rendering:
 * - Inline: Returns diffLines as-is
 * - Split: Computes alignedLines for side-by-side view
 */

import { useMemo } from 'react';
import { useDiffStore } from '../../stores';
import { alignDiffLines } from '../../utils';
import type { DiffFilterOutput, DiffShapeOutput } from './types';

/**
 * Hook to shape diff data for the current view mode.
 *
 * Branches:
 * - Inline: Single column view, uses diffLines directly
 * - Split: Side-by-side view, computes or uses pre-computed alignedLines
 */
export function useDiffShape(filtered: DiffFilterOutput): DiffShapeOutput {
  const { viewConfig } = useDiffStore();

  // Compute aligned lines for side-by-side view
  const alignedLines = useMemo(() => {
    // Not needed for inline mode
    if (viewConfig.mode !== 'split') {
      return [];
    }

    // Use pre-computed aligned lines if available (preserves word diffs)
    if (filtered.sourceAlignedLines) {
      return filtered.sourceAlignedLines;
    }

    // Compute alignment from diffLines
    return alignDiffLines(filtered.diffLines);
  }, [viewConfig.mode, filtered.sourceAlignedLines, filtered.diffLines]);

  return {
    ...filtered,
    alignedLines,
    viewMode: viewConfig.mode,
  };
}
