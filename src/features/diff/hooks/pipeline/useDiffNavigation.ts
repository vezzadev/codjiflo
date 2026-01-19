/**
 * Pipeline Stage 6: Hunk Navigation
 *
 * Calculates navigation indices and scroll targets:
 * - Hunk indices for J/K navigation
 * - Scroll target for current change
 */

import { useMemo } from 'react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../../stores';
import { calculateHunkIndices, calculateAlignedHunkIndices } from '../../utils';
import type { DiffDisplayOutput, DiffNavigationOutput } from './types';

/**
 * Hook to calculate navigation indices and scroll targets.
 *
 * Note: The actual sync of hunkIndices.length to the store is done in DiffView
 * to ensure the effect runs even when the pipeline hooks are mocked in tests.
 */
export function useDiffNavigation(display: DiffDisplayOutput): DiffNavigationOutput {
  const {
    selectedFileIndex,
    pendingScrollToChange,
  } = useDiffStore();

  const isShowingDescription = selectedFileIndex === PR_DESCRIPTION_INDEX;

  // Calculate hunk indices from diff data
  // For side-by-side mode, use aligned lines; for inline mode, use diffLines
  const hunkIndices = useMemo(() => {
    // No navigation for PR description or fully changed files
    if (isShowingDescription || display.isFullFileChange) {
      return [];
    }

    if (display.viewMode === 'split') {
      // Use aligned lines for side-by-side mode
      return calculateAlignedHunkIndices(display.alignedLines);
    } else {
      // Use diffLines for inline/inline mode
      return calculateHunkIndices(display.diffLines);
    }
  }, [isShowingDescription, display.isFullFileChange, display.viewMode, display.diffLines, display.alignedLines]);

  // Get the row index to scroll to for the pending change request
  // This is a one-shot value that gets cleared after scroll completes
  const scrollToRowIndex = useMemo(() => {
    if (pendingScrollToChange === null || pendingScrollToChange >= hunkIndices.length) {
      return undefined;
    }
    return hunkIndices[pendingScrollToChange];
  }, [pendingScrollToChange, hunkIndices]);

  return {
    ...display,
    hunkIndices,
    scrollToRowIndex,
  };
}
