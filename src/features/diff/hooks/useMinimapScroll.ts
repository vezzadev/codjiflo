/**
 * useMinimapScroll Hook
 *
 * Tracks scroll state of a container for minimap viewport lasso positioning.
 * Uses a single scroll event listener for efficient updates.
 */

import { useCallback, useEffect, useState, type RefObject } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Scroll state for minimap positioning
 */
export interface ScrollState {
  /** Current scroll position as ratio (0-1) */
  scrollRatio: number;
  /** Viewport size as ratio of total content (0-1) */
  viewportRatio: number;
}

/** Default scroll state */
const DEFAULT_SCROLL_STATE: ScrollState = {
  scrollRatio: 0,
  viewportRatio: 1,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to track scroll state from a container ref
 *
 * @param containerRef - Ref to the container element
 * @param containerHeight - Height of the container for calculations
 * @param contentKey - Optional key that resets state when changed (e.g., filename)
 * @returns Current scroll state
 */
export function useMinimapScroll(
  containerRef: RefObject<HTMLElement | null>,
  containerHeight: number,
  contentKey?: string
): { scrollState: ScrollState } {
  // Use contentKey to force state reset by including it in state key
  // This pattern avoids setState in effect by using state with a key
  const [scrollState, setScrollState] = useState<ScrollState & { key: string | undefined }>({
    ...DEFAULT_SCROLL_STATE,
    key: contentKey,
  });

  // Find the scrollable element within the container
  const findScrollableElement = useCallback((): HTMLElement | null => {
    const container = containerRef.current;
    if (!container) return null;

    // For react-window, look for element with overflow style
    const scrollEl =
      container.querySelector<HTMLElement>('[style*="overflow"]') ??
      container.querySelector<HTMLElement>('.side-by-side-pane-left') ??
      container;

    return scrollEl;
  }, [containerRef]);

  // Calculate scroll state from element
  const calculateScrollState = useCallback((el: HTMLElement): ScrollState => {
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const scrollTop = el.scrollTop;

    if (scrollHeight <= clientHeight) {
      return DEFAULT_SCROLL_STATE;
    }

    const maxScroll = scrollHeight - clientHeight;
    const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const viewportRatio = clientHeight / scrollHeight;

    return {
      scrollRatio: Math.max(0, Math.min(1, scrollRatio)),
      viewportRatio: Math.max(0, Math.min(1, viewportRatio)),
    };
  }, []);

  // Handle scroll events - callback, so setState is allowed
  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    const newState = calculateScrollState(target);
    setScrollState(prev => ({ ...newState, key: contentKey }));
  }, [calculateScrollState, contentKey]);

  // Set up scroll listener - re-runs when contentKey changes to recalculate state
  useEffect(() => {
    const scrollEl = findScrollableElement();
    if (!scrollEl) return;

    // Use requestAnimationFrame to read initial state asynchronously
    const rafId = requestAnimationFrame(() => {
      const initialState = calculateScrollState(scrollEl);
      setScrollState({ ...initialState, key: contentKey });
    });

    // Add scroll listener
    scrollEl.addEventListener('scroll', handleScroll);

    return () => {
      cancelAnimationFrame(rafId);
      scrollEl.removeEventListener('scroll', handleScroll);
    };
  }, [findScrollableElement, calculateScrollState, handleScroll, containerHeight, contentKey]);

  // If contentKey changed, return default state and schedule update
  if (contentKey !== scrollState.key) {
    // Return default state immediately for new content
    // The effect will update with actual scroll state
    return { scrollState: { ...DEFAULT_SCROLL_STATE } };
  }

  return { scrollState: { scrollRatio: scrollState.scrollRatio, viewportRatio: scrollState.viewportRatio } };
}
