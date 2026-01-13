/**
 * Pipeline Stage 6: Hunk Navigation
 *
 * Calculates navigation indices and scroll targets:
 * - Hunk indices for J/K navigation
 * - Scroll target for current change
 * - Virtualization threshold
 */

import { useMemo } from 'react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../../stores';
import { calculateHunkIndices, calculateAlignedHunkIndices } from '../../utils';
import type { DiffDisplayOutput, DiffNavigationOutput } from './types';

/** Threshold for enabling virtualization (500+ lines) */
const VIRTUALIZATION_THRESHOLD = 500;

/**
 * Hook to calculate navigation indices and scroll targets.
 *
 * Note: The actual sync of hunkIndices.length to the store is done in DiffView
 * to ensure the effect runs even when the pipeline hooks are mocked in tests.
 */
export function useDiffNavigation(display: DiffDisplayOutput): DiffNavigationOutput {
  const {
    selectedFileIndex,
    currentChangeIndex,
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
      // Use diffLines for inline/unified mode
      return calculateHunkIndices(display.diffLines);
    }
  }, [isShowingDescription, display.isFullFileChange, display.viewMode, display.diffLines, display.alignedLines]);

  // Get the row index to scroll to for the current change
  const scrollToRowIndex = useMemo(() => {
    if (currentChangeIndex < 0 || currentChangeIndex >= hunkIndices.length) {
      return undefined;
    }
    return hunkIndices[currentChangeIndex];
  }, [currentChangeIndex, hunkIndices]);

  // Determine if virtualization is needed
  const isVirtualized = display.diffLines.length > VIRTUALIZATION_THRESHOLD;

  return {
    ...display,
    hunkIndices,
    scrollToRowIndex,
    isVirtualized,
  };
}
