/**
 * Comment Bubble Canvas Component
 *
 * Container that positions floating comment bubbles using the layout engine.
 * Part of S-5.2: Floating Comment Bubbles
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { CommentBubble } from './CommentBubble';
import { LassoOverlay } from './LassoOverlay';
import {
  LayoutEngine,
  type CodeLinePosition,
  type CommentBubbleInput,
  type ConnectorData,
} from '../layout-engine';
import { singleLine } from '@/features/iterations/domain/text-span';
import type { ReviewThread } from '../types';

/** Default bubble height estimate (will be measured) */
const DEFAULT_BUBBLE_HEIGHT = 120;

/** Bubble width from CSS variables */
const BUBBLE_WIDTH = 320;

export interface CommentBubbleCanvasProps {
  /** All threads to display */
  threads: ReviewThread[];
  /** Map of line index to position data */
  linePositions: Map<number, CodeLinePosition>;
  /** Current user login for permissions */
  currentUserLogin: string;
  /** Viewport height for culling */
  viewportHeight: number;
  /** Current scroll position */
  scrollTop: number;
  /** Container width for positioning */
  containerWidth: number;
  /** Handler for adding a reply */
  onAddReply: (threadId: string, body: string) => Promise<void>;
  /** Handler for editing a comment */
  onEditComment: (threadId: string, commentId: string, body: string) => Promise<void>;
  /** Handler for deleting a comment */
  onDeleteComment: (threadId: string, commentId: string) => Promise<void>;
  /** Handler for toggling resolved state */
  onToggleResolved: (threadId: string, resolved: boolean) => Promise<void>;
  /** Whether to show connectors */
  showConnectors?: boolean;
}

/**
 * Canvas container for floating comment bubbles
 */
export function CommentBubbleCanvas({
  threads,
  linePositions,
  currentUserLogin,
  viewportHeight,
  scrollTop,
  containerWidth,
  onAddReply,
  onEditComment,
  onDeleteComment,
  onToggleResolved,
  showConnectors = true,
}: CommentBubbleCanvasProps) {
  // Track focused bubble
  const [focusedThreadId, setFocusedThreadId] = useState<string | null>(null);

  // Track hovered bubble for connector highlighting
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);

  // Track measured bubble heights
  const [bubbleHeights, setBubbleHeights] = useState<Map<string, number>>(new Map());

  // Ref to observe bubble height changes
  const bubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Convert threads to bubble inputs
  const bubbleInputs = useMemo((): CommentBubbleInput[] => {
    const result: CommentBubbleInput[] = [];
    for (const thread of threads) {
      const line = thread.trackedLine ?? thread.line;
      if (line === null || !linePositions.has(line)) {
        continue;
      }
      result.push({
        threadId: thread.id,
        anchorSpan: thread.region
          ? { startLine: thread.region.startLine, endLine: thread.region.endLine }
          : singleLine(line),
        height: bubbleHeights.get(thread.id) ?? DEFAULT_BUBBLE_HEIGHT,
        isFocused: thread.id === focusedThreadId,
      });
    }
    return result;
  }, [threads, linePositions, bubbleHeights, focusedThreadId]);

  // Calculate layouts using a fresh engine instance each time config changes
  const bubbleLayouts = useMemo(() => {
    const engine = new LayoutEngine({
      bubbleWidth: BUBBLE_WIDTH,
      viewportHeight,
      scrollTop,
      horizontalOffset: 16,
      minVerticalGap: 8,
      renderBuffer: 200,
    });
    return engine.calculatePositions(linePositions, bubbleInputs);
  }, [linePositions, bubbleInputs, viewportHeight, scrollTop]);

  // Calculate connectors
  const connectors: ConnectorData[] = useMemo(() => {
    if (!showConnectors) return [];
    const engine = new LayoutEngine({
      bubbleWidth: BUBBLE_WIDTH,
      viewportHeight,
      scrollTop,
      horizontalOffset: 16,
      minVerticalGap: 8,
      renderBuffer: 200,
    });
    const rawConnectors = engine.calculateConnectors(bubbleLayouts, linePositions);
    // Set the startX based on container width
    const codeWidth = containerWidth - BUBBLE_WIDTH - 32; // 32px for padding
    return rawConnectors.map((c) => ({
      ...c,
      startX: codeWidth,
    }));
  }, [bubbleLayouts, linePositions, showConnectors, containerWidth, viewportHeight, scrollTop]);

  // Build thread lookup
  const threadsById = useMemo(() => {
    const map = new Map<string, ReviewThread>();
    for (const thread of threads) {
      map.set(thread.id, thread);
    }
    return map;
  }, [threads]);

  // Handlers
  const handleFocus = useCallback((threadId: string) => {
    setFocusedThreadId(threadId);
  }, []);

  const handleClose = useCallback((threadId: string) => {
    if (focusedThreadId === threadId) {
      setFocusedThreadId(null);
    }
  }, [focusedThreadId]);

  const handleHover = useCallback((threadId: string | null) => {
    setHoveredThreadId(threadId);
  }, []);

  // ResizeObserver to measure bubble heights
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const updates = new Map<string, number>();
      for (const entry of entries) {
        const threadId = (entry.target as HTMLElement).dataset.threadId;
        if (threadId) {
          updates.set(threadId, entry.contentRect.height);
        }
      }
      if (updates.size > 0) {
        setBubbleHeights((prev) => {
          const next = new Map(prev);
          updates.forEach((height, id) => next.set(id, height));
          return next;
        });
      }
    });

    // Observe all bubble refs
    bubbleRefs.current.forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [bubbleLayouts.length]);

  if (bubbleLayouts.length === 0) {
    return null;
  }

  return (
    <div
      className="comment-bubble-canvas"
      style={
        {
          '--bubble-canvas-width': `${BUBBLE_WIDTH + 20}px`,
          '--bubble-width': `${BUBBLE_WIDTH}px`,
        } as React.CSSProperties
      }
    >
      {/* SVG Connector Layer */}
      {showConnectors && (
        <LassoOverlay
          connectors={connectors}
          highlightedThreadId={hoveredThreadId}
          onHover={handleHover}
        />
      )}

      {/* Bubble Layer */}
      {bubbleLayouts.map((layout) => {
        const thread = threadsById.get(layout.threadId);
        if (!thread) return null;

        return (
          <CommentBubble
            key={layout.threadId}
            layout={layout}
            thread={thread}
            currentUserLogin={currentUserLogin}
            isFocused={layout.threadId === focusedThreadId}
            onFocus={handleFocus}
            onClose={handleClose}
            onAddReply={onAddReply}
            onEditComment={onEditComment}
            onDeleteComment={onDeleteComment}
            onToggleResolved={onToggleResolved}
            onHover={handleHover}
          />
        );
      })}
    </div>
  );
}
