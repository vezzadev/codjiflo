/**
 * Hook for tracking container height for virtualization
 *
 * Uses ResizeObserver to track the container height,
 * which is needed by react-window for virtualized rendering.
 */

import { useState, useCallback, useRef, type RefObject } from 'react';

export interface UseContainerHeightReturn {
  /** Current container height in pixels */
  containerHeight: number;
  /** Callback ref to attach to the container element */
  containerRefCallback: (node: HTMLDivElement | null) => void;
  /** Ref to the scroll container (for imperative scrolling) */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

/** Default height before measurement */
const DEFAULT_HEIGHT = 600;

/**
 * Hook to track container height for virtualization.
 *
 * Uses a callback ref pattern to set up ResizeObserver when
 * the container element mounts.
 */
export function useContainerHeight(): UseContainerHeightReturn {
  const [containerHeight, setContainerHeight] = useState(DEFAULT_HEIGHT);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Callback ref that sets up ResizeObserver
  const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
    // Clean up previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    // Store in ref for imperative access
    scrollContainerRef.current = node;

    if (!node) return;

    const updateHeight = () => {
      const newHeight = node.clientHeight;
      // Ignore height 0 - happens during re-renders when container is briefly hidden
      if (newHeight === 0) return;
      setContainerHeight(newHeight);
    };

    // Initial height with slight delay to ensure layout is complete
    requestAnimationFrame(updateHeight);

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(node);
    resizeObserverRef.current = resizeObserver;
  }, []);

  return {
    containerHeight,
    containerRefCallback,
    scrollContainerRef,
  };
}
