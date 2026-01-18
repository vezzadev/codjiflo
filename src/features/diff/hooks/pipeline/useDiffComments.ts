/**
 * Pipeline Stage 7: Comment Thread Positioning
 *
 * Maps comment threads to diff line positions for rendering:
 * - Groups threads by "lineNumber-side" key
 * - Will expand to support lasso positioning, floating bubbles (M5)
 */

import { useMemo } from 'react';
import { useCommentsStore, type ReviewThread } from '@/features/comments';
import type { DiffNavigationOutput, DiffCommentsOutput } from './types';

/**
 * Hook to map comment threads to diff line positions.
 *
 * This stage will grow as comment features expand:
 * - M5: floating bubbles, lasso positioning
 */
export function useDiffComments(navigation: DiffNavigationOutput): DiffCommentsOutput {
  const { threads } = useCommentsStore();

  // Filter threads for current file
  const threadsForFile = useMemo(() => {
    if (!navigation.filename) return [];

    return threads
      .filter(
        (thread) =>
          thread.path === navigation.filename &&
          thread.comments.length > 0 &&
          thread.comments[0]?.createdAt != null
      )
      .sort((a, b) => {
        const aTime = a.comments[0]?.createdAt.getTime() ?? 0;
        const bTime = b.comments[0]?.createdAt.getTime() ?? 0;
        return aTime - bTime;
      });
  }, [threads, navigation.filename]);

  // Group threads by line number and side for quick lookup during render
  // Key format: "lineNumber-side" → "42-RIGHT", "17-LEFT"
  // Uses trackedLine (SpanTracker result) if available, falling back to line
  // Threads with no position (both null) are excluded
  const threadsByLineAndSide = useMemo(() => {
    const map = new Map<string, ReviewThread[]>();

    threadsForFile.forEach((thread) => {
      // Use trackedLine (from SpanTracker) if available, otherwise fall back to line
      const effectiveLine = thread.trackedLine ?? thread.line;

      // Skip threads that can't be mapped to a line (outdated and not tracked)
      if (effectiveLine === null) return;

      const key = `${String(effectiveLine)}-${thread.side}`;
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, thread]);
    });

    return map;
  }, [threadsForFile]);

  return {
    ...navigation,
    threadsByLineAndSide,
    // Future: lassoPositions, floatingBubbleCoords, etc.
  };
}
