/**
 * Hook for preserving and restoring scroll position across file switches and view mode changes.
 *
 * Scroll state is stored as a ratio (0-1) to work across inline/split view modes,
 * which may have different total heights for the same content.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useDiffStore } from '../stores';
import type { ContentMode } from '../types';

interface UseScrollPreservationOptions {
  /** Current filename being displayed */
  filename: string | undefined;
  /** Current content mode (full file vs changes only) */
  contentMode: ContentMode;
  /** Current view mode (inline vs split) - used to trigger save on mode change */
  viewMode: 'inline' | 'split';
  /** Whether the component is ready (view mounted, content loaded) */
  isReady: boolean;
}

interface UseScrollPreservationReturn {
  /** Call this when the scroll container is ready to attach listeners */
  attachScrollListener: (scrollElement: HTMLElement) => void;
  /** Call this to restore scroll position after content loads */
  restoreScrollPosition: (scrollElement: HTMLElement) => void;
}

/**
 * Hook to preserve scroll position across file switches and view mode changes.
 *
 * Usage:
 * ```tsx
 * const { attachScrollListener, restoreScrollPosition } = useScrollPreservation({
 *   filename: pipeline.filename,
 *   contentMode: viewConfig.showFullFile ? 'full' : 'changes',
 *   isReady: !isLoading,
 * });
 *
 * // In effect after view is ready:
 * useEffect(() => {
 *   if (viewRef.current) {
 *     attachScrollListener(viewRef.current.scrollDOM);
 *     restoreScrollPosition(viewRef.current.scrollDOM);
 *   }
 * }, [isViewReady]);
 * ```
 */
export function useScrollPreservation({
  filename,
  contentMode,
  viewMode,
  isReady,
}: UseScrollPreservationOptions): UseScrollPreservationReturn {
  const { saveScrollState, getScrollState } = useDiffStore();

  // Track the last saved ratio to avoid excessive saves
  const lastSavedRatioRef = useRef<number | null>(null);
  // Track if we've restored scroll for this file/mode combo
  const hasRestoredRef = useRef<string | null>(null);
  // Track the scroll listener cleanup and the scroll element
  const cleanupRef = useRef<(() => void) | null>(null);
  const scrollElementRef = useRef<HTMLElement | null>(null);
  // Track current filename and contentMode for cleanup
  const currentFileRef = useRef<{ filename: string; contentMode: ContentMode } | null>(null);

  // Save scroll position before file/mode/viewMode change
  useEffect(() => {
    // Store current values for cleanup
    if (filename) {
      currentFileRef.current = { filename, contentMode };
    }

    return () => {
      // On unmount or before deps change, save current scroll position
      const scrollEl = scrollElementRef.current;
      const fileInfo = currentFileRef.current;
      if (scrollEl && fileInfo) {
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll > 0) {
          const ratio = scrollTop / maxScroll;
          saveScrollState(fileInfo.filename, fileInfo.contentMode, ratio);
        }
      }
    };
  }, [filename, contentMode, viewMode, saveScrollState]);

  // Reset restoration tracking when file, content mode, or view mode changes
  useEffect(() => {
    // Include viewMode in key so restoration happens when switching view modes
    const key = filename ? `${filename}:${contentMode}:${viewMode}` : null;
    if (hasRestoredRef.current !== key) {
      hasRestoredRef.current = null; // Mark as needing restoration
      lastSavedRatioRef.current = null;
    }
  }, [filename, contentMode, viewMode]);

  // Cleanup scroll listener on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      scrollElementRef.current = null;
    };
  }, []);

  const attachScrollListener = useCallback(
    (scrollElement: HTMLElement) => {
      if (!filename) return;

      // Clean up previous listener
      if (cleanupRef.current) {
        cleanupRef.current();
      }

      // Store ref to scroll element for cleanup
      scrollElementRef.current = scrollElement;

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollElement;
        const maxScroll = scrollHeight - clientHeight;

        // Avoid division by zero for content that doesn't need scrolling
        if (maxScroll <= 0) return;

        const ratio = scrollTop / maxScroll;

        // Throttle saves - only save if ratio changed significantly (> 1%)
        if (
          lastSavedRatioRef.current === null ||
          Math.abs(ratio - lastSavedRatioRef.current) > 0.01
        ) {
          lastSavedRatioRef.current = ratio;
          saveScrollState(filename, contentMode, ratio);
        }
      };

      scrollElement.addEventListener('scroll', handleScroll, { passive: true });

      cleanupRef.current = () => {
        scrollElement.removeEventListener('scroll', handleScroll);
      };
    },
    [filename, contentMode, saveScrollState]
  );

  const restoreScrollPosition = useCallback(
    (scrollElement: HTMLElement) => {
      if (!filename || !isReady) return;

      // Key includes viewMode to allow restoration when switching view modes
      const key = `${filename}:${contentMode}:${viewMode}`;

      // Only restore once per file/mode/viewMode combo
      if (hasRestoredRef.current === key) return;

      const savedState = getScrollState(filename, contentMode);
      if (!savedState) {
        hasRestoredRef.current = key;
        return;
      }

      // Use requestAnimationFrame to ensure the DOM has settled
      requestAnimationFrame(() => {
        const { scrollHeight, clientHeight } = scrollElement;
        const maxScroll = scrollHeight - clientHeight;

        if (maxScroll <= 0) {
          hasRestoredRef.current = key;
          return;
        }

        const targetScrollTop = savedState.scrollRatio * maxScroll;
        scrollElement.scrollTop = targetScrollTop;

        // Update last saved ratio to match restored position
        lastSavedRatioRef.current = savedState.scrollRatio;
        hasRestoredRef.current = key;
      });
    },
    [filename, contentMode, viewMode, isReady, getScrollState]
  );

  return {
    attachScrollListener,
    restoreScrollPosition,
  };
}
