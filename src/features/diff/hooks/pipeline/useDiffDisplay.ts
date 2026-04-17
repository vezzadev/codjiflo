/**
 * Pipeline Stage 4: Display Options
 *
 * Applies display preferences:
 * - Whitespace visibility (show/hide whitespace characters)
 * - Content filter (left/both/right)
 * - Line number mode (derived from content filter)
 */

import { useMemo } from 'react';
import { useDiffStore } from '../../stores';
import type { DiffShapeOutput, DiffDisplayOutput } from './types';

/**
 * Hook to apply display preferences to diff data.
 *
 * Branches:
 * - Whitespace: visible (show · and →) vs hidden (normal)
 * - Content filter: left (original only), both (all), right (modified only)
 */
export function useDiffDisplay(shaped: DiffShapeOutput): DiffDisplayOutput {
  const { viewConfig } = useDiffStore();

  // Derive line number mode from content filter
  const lineNumberMode = useMemo(() => {
    if (viewConfig.filter === 'left') return 'left';
    if (viewConfig.filter === 'right') return 'right';
    return 'both';
  }, [viewConfig.filter]);

  return {
    ...shaped,
    showWhitespace: viewConfig.showWhitespace,
    contentFilter: viewConfig.filter,
    lineNumberMode,
    textWrap: viewConfig.textWrap,
  };
}
