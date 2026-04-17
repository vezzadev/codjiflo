/**
 * useMinimapScroll Hook
 *
 * Tracks scroll state of a container for minimap viewport lasso positioning.
 * Uses a single scroll event listener for efficient updates.
 *
 * The hook returns viewportRatio: 0 until it finds a valid scroll container with
 * significant scroll range (> 100px). This prevents incorrect lasso sizing when
 * multiple overflow elements exist (e.g., wrapper vs react-window list).
 *
 * The minimap component should hide the lasso when viewportRatio === 0 to avoid
 * showing a full-bar-height lasso before the actual ratio is calculated.
 */

import { useCallback, useEffect, useState, useRef, type RefObject } from 'react';

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
  /** Raw scroll position in pixels */
  scrollTop: number;
  /** Viewport height in pixels */
  clientHeight: number;
  /** Total scrollable content height in pixels */
  scrollHeight: number;
}

/** Default scroll state - viewportRatio of 0 means "not initialized" */
const DEFAULT_SCROLL_STATE: ScrollState = {
  scrollRatio: 0,
  viewportRatio: 0,
  scrollTop: 0,
  clientHeight: 0,
  scrollHeight: 0,
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
  const [scrollState, setScrollState] = useState<ScrollState & { key: string | undefined }>({
    ...DEFAULT_SCROLL_STATE,
    key: contentKey,
  });

  // Track if we've done initial measurement to avoid double calculation
  const initializedRef = useRef(false);

  // Find the scrollable element within the container
  // Returns null if no valid scrollable element is found (CodeMirror/react-window not yet rendered)
  const findScrollableElement = useCallback((): HTMLElement | null => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }

    // First try CodeMirror scroller (primary for CodeMirror 6 diff view)
    const cmScroller = container.querySelector<HTMLElement>('.cm-scroller');
    if (cmScroller) {
      const cmScrollRange = cmScroller.scrollHeight - cmScroller.clientHeight;
      if (cmScrollRange > 100) {
        return cmScroller;
      }
    }

    // For react-window, look for element with overflow style
    // There may be multiple elements with overflow; we need the one with the most scrollable content
    const candidates = container.querySelectorAll<HTMLElement>('[style*="overflow"]');

    // Find the element with the largest scrollable range (scrollHeight - clientHeight)
    // This ensures we get the actual react-window list, not a wrapper with minimal scroll
    let bestEl: HTMLElement | null = null;
    let maxScrollRange = 0;

    for (const el of candidates) {
      const scrollRange = el.scrollHeight - el.clientHeight;
      if (scrollRange > maxScrollRange) {
        maxScrollRange = scrollRange;
        bestEl = el;
      }
    }

    // Only return if we found an element with meaningful scroll range
    // A file with 500 lines should have scrollRange > 1000 (500 * 23px line height - viewport)
    // Threshold of 100px prevents selecting elements with minor overflow
    if (bestEl && maxScrollRange > 100) {
      return bestEl;
    }

    // Fallback for side-by-side view
    const sxsPane = container.querySelector<HTMLElement>('.side-by-side-pane-left');
    if (sxsPane) {
      const sxsScrollRange = sxsPane.scrollHeight - sxsPane.clientHeight;
      if (sxsScrollRange > 100) {
        return sxsPane;
      }
    }

    // If no scrollable element found yet, return null to indicate not ready
    // This prevents incorrect viewportRatio calculation from non-scrollable elements
    return null;
  }, [containerRef]);

  // Calculate scroll state from element
  const calculateScrollState = useCallback((el: HTMLElement): ScrollState => {
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const scrollTop = el.scrollTop;

    // If content fits in viewport, no scrolling needed
    if (scrollHeight <= clientHeight) {
      return { scrollRatio: 0, viewportRatio: 1, scrollTop, clientHeight, scrollHeight };
    }

    const maxScroll = scrollHeight - clientHeight;
    const scrollRatio = scrollTop / maxScroll;
    const viewportRatio = clientHeight / scrollHeight;

    return {
      scrollRatio: Math.max(0, Math.min(1, scrollRatio)),
      viewportRatio: Math.max(0, Math.min(1, viewportRatio)),
      scrollTop,
      clientHeight,
      scrollHeight,
    };
  }, []);

  // Handle scroll events
  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    const newState = calculateScrollState(target);
    setScrollState({ ...newState, key: contentKey });
  }, [calculateScrollState, contentKey]);

  // Set up scroll listener and calculate initial state
  // Uses polling via rAF to wait for react-window to render
  useEffect(() => {
    let rafId: number;
    let currentScrollEl: HTMLElement | null = null;
    let isCleanedUp = false;

    // Poll until we find a valid scrollable element
    const trySetup = () => {
      if (isCleanedUp) return;

      const scrollEl = findScrollableElement();
      if (!scrollEl) {
        // Element not ready yet, retry on next frame
        rafId = requestAnimationFrame(trySetup);
        return;
      }

      // Accept metrics immediately on first frame with valid scroll element
      // Previously we waited for 2 stable frames, but this caused ~1s delays
      // on large files because React rendering blocked the main thread.
      // Since react-window sets correct scrollHeight on first render,
      // we can accept immediately. If scrollHeight changes later, the
      // scroll event listener will update the state.

      // Found scrollable element - set up listener and calculate initial state
      currentScrollEl = scrollEl;
      const initialState = calculateScrollState(scrollEl);
      setScrollState({ ...initialState, key: contentKey });
      initializedRef.current = true;

      // Add scroll listener
      scrollEl.addEventListener('scroll', handleScroll);
    };

    // Start polling
    rafId = requestAnimationFrame(trySetup);

    return () => {
      isCleanedUp = true;
      cancelAnimationFrame(rafId);
      if (currentScrollEl) {
        currentScrollEl.removeEventListener('scroll', handleScroll);
      }
      initializedRef.current = false;
    };
  }, [findScrollableElement, calculateScrollState, handleScroll, containerHeight, contentKey]);

  // Return current state - the effect will update it asynchronously when ready
  // viewportRatio: 0 indicates "not initialized" and hides the lasso
  return { scrollState };
}
