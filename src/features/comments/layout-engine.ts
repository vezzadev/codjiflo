/**
 * Canvas Layout Engine for Floating Comment Bubbles
 *
 * Pure logic for calculating comment bubble positions with collision avoidance.
 * No DOM dependencies - takes measurements as input, outputs coordinates.
 */

import { LineSpan, createLineSpan, singleLine } from "@/features/iterations/domain/text-span";

/**
 * Input: A code line's position in the viewport
 */
export interface CodeLinePosition {
  /** Unique identifier for the line (e.g., diff line index) */
  lineIndex: number;
  /** Top position relative to the scroll container */
  top: number;
  /** Bottom position relative to the scroll container */
  bottom: number;
}

/**
 * Input: A comment bubble that needs positioning
 */
export interface CommentBubbleInput {
  /** Thread ID for identification */
  threadId: string;
  /** The line(s) this comment is attached to */
  anchorSpan: LineSpan;
  /** Measured or estimated height of the bubble content */
  height: number;
  /** Whether the bubble is currently focused/expanded */
  isFocused?: boolean;
}

/**
 * Output: Computed position for a bubble
 */
export interface BubbleLayout {
  /** Thread ID */
  threadId: string;
  /** Horizontal offset from the right edge of code (in pixels) */
  x: number;
  /** Vertical position relative to scroll container */
  y: number;
  /** Width of the bubble */
  width: number;
  /** Height of the bubble */
  height: number;
  /** Z-index for stacking (higher = on top) */
  zIndex: number;
  /** Line span this bubble is anchored to */
  anchorSpan: LineSpan;
  /** Whether this bubble has been pushed from its ideal position */
  isDisplaced: boolean;
  /** The ideal Y position (before collision adjustment) */
  idealY: number;
}

/**
 * Configuration for the layout engine
 */
export interface LayoutConfig {
  /** Width of comment bubbles (default: 320) */
  bubbleWidth: number;
  /** Minimum vertical gap between bubbles (default: 8) */
  minVerticalGap: number;
  /** Horizontal offset from code edge (default: 16) */
  horizontalOffset: number;
  /** Maximum vertical displacement before showing connector (default: 100) */
  maxDisplacement: number;
  /** Viewport height for culling off-screen bubbles */
  viewportHeight: number;
  /** Current scroll position */
  scrollTop: number;
  /** Buffer zone for rendering bubbles just outside viewport (default: 200) */
  renderBuffer: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  bubbleWidth: 320,
  minVerticalGap: 8,
  horizontalOffset: 16,
  maxDisplacement: 100,
  viewportHeight: 800,
  scrollTop: 0,
  renderBuffer: 200,
};

/**
 * Find the ideal Y position for a bubble based on its anchor lines
 */
export function calculateIdealPosition(
  anchorSpan: LineSpan,
  linePositions: Map<number, CodeLinePosition>
): number | null {
  const startLine = linePositions.get(anchorSpan.startLine);
  const endLine = linePositions.get(anchorSpan.endLine);

  if (!startLine) return null;

  if (!endLine || anchorSpan.startLine === anchorSpan.endLine) {
    // Single line: center vertically on the line
    return startLine.top + (startLine.bottom - startLine.top) / 2;
  }

  // Multi-line: center on the span
  const spanTop = startLine.top;
  const spanBottom = endLine.bottom;
  return spanTop + (spanBottom - spanTop) / 2;
}

/**
 * Check if two vertical ranges overlap
 */
function rangesOverlap(
  aTop: number,
  aBottom: number,
  bTop: number,
  bBottom: number
): boolean {
  return aTop < bBottom && bTop < aBottom;
}

/**
 * Collision avoidance: push bubbles down to avoid overlap
 * Uses a greedy top-to-bottom algorithm
 */
function resolveCollisions(
  bubbles: BubbleLayout[],
  minGap: number
): BubbleLayout[] {
  if (bubbles.length <= 1) return bubbles;

  // Sort by ideal Y position (top to bottom)
  const sorted = [...bubbles].sort((a, b) => a.idealY - b.idealY);
  const resolved: BubbleLayout[] = [];

  for (const bubble of sorted) {
    let y = bubble.idealY;

    // Check for collisions with already-placed bubbles
    for (const placed of resolved) {
      const placedBottom = placed.y + placed.height;
      const bubbleTop = y;
      const bubbleBottom = y + bubble.height;

      if (rangesOverlap(bubbleTop, bubbleBottom, placed.y, placedBottom + minGap)) {
        // Push down below the conflicting bubble
        y = placedBottom + minGap;
      }
    }

    resolved.push({
      ...bubble,
      y,
      isDisplaced: y !== bubble.idealY,
    });
  }

  return resolved;
}

/**
 * Filter bubbles to only those visible in viewport (with buffer)
 */
function filterVisibleBubbles(
  bubbles: BubbleLayout[],
  config: LayoutConfig
): BubbleLayout[] {
  const viewTop = config.scrollTop - config.renderBuffer;
  const viewBottom = config.scrollTop + config.viewportHeight + config.renderBuffer;

  return bubbles.filter((bubble) => {
    const bubbleTop = bubble.y;
    const bubbleBottom = bubble.y + bubble.height;
    return rangesOverlap(bubbleTop, bubbleBottom, viewTop, viewBottom);
  });
}

/**
 * Main layout engine class
 */
export class LayoutEngine {
  private config: LayoutConfig;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration (e.g., on scroll or resize)
   */
  updateConfig(updates: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Calculate positions for all comment bubbles
   *
   * @param linePositions - Map of line index to position data
   * @param comments - Array of comment bubbles to position
   * @returns Array of positioned bubbles, sorted by Y position
   */
  calculatePositions(
    linePositions: Map<number, CodeLinePosition>,
    comments: CommentBubbleInput[]
  ): BubbleLayout[] {
    // Step 1: Calculate ideal positions
    const initialLayouts: BubbleLayout[] = [];
    let baseZIndex = 1;

    for (const comment of comments) {
      const idealY = calculateIdealPosition(comment.anchorSpan, linePositions);

      if (idealY === null) {
        // Anchor line not visible, skip
        continue;
      }

      initialLayouts.push({
        threadId: comment.threadId,
        x: this.config.horizontalOffset,
        y: idealY,
        width: this.config.bubbleWidth,
        height: comment.height,
        zIndex: comment.isFocused ? 1000 : baseZIndex++,
        anchorSpan: comment.anchorSpan,
        isDisplaced: false,
        idealY,
      });
    }

    // Step 2: Resolve collisions
    const resolved = resolveCollisions(initialLayouts, this.config.minVerticalGap);

    // Step 3: Filter to visible bubbles
    const visible = filterVisibleBubbles(resolved, this.config);

    return visible;
  }

  /**
   * Calculate connector line data for displaced bubbles
   */
  calculateConnectors(
    layouts: BubbleLayout[],
    linePositions: Map<number, CodeLinePosition>
  ): ConnectorData[] {
    const connectors: ConnectorData[] = [];

    for (const layout of layouts) {
      // Always show connector for visual connection
      const anchorLine = linePositions.get(layout.anchorSpan.startLine);
      if (!anchorLine) continue;

      const codeY = anchorLine.top + (anchorLine.bottom - anchorLine.top) / 2;
      const bubbleY = layout.y + layout.height / 2;

      connectors.push({
        threadId: layout.threadId,
        startX: 0, // Will be set by the component based on actual code width
        startY: codeY,
        endX: layout.x,
        endY: bubbleY,
        isDisplaced: layout.isDisplaced,
        displacement: Math.abs(bubbleY - codeY),
      });
    }

    return connectors;
  }
}

/**
 * Data for rendering connector lines between code and bubbles
 */
export interface ConnectorData {
  threadId: string;
  /** X position where connector starts (right edge of code) */
  startX: number;
  /** Y position at the code anchor */
  startY: number;
  /** X position where connector ends (left edge of bubble) */
  endX: number;
  /** Y position at the bubble */
  endY: number;
  /** Whether the bubble is displaced from its ideal position */
  isDisplaced: boolean;
  /** Vertical distance between ideal and actual position */
  displacement: number;
}

/**
 * Helper: Create a single-line anchor span
 */
export function createSingleLineAnchor(lineIndex: number): LineSpan {
  return singleLine(lineIndex);
}

/**
 * Helper: Create a multi-line anchor span
 */
export function createMultiLineAnchor(startLine: number, endLine: number): LineSpan {
  return createLineSpan(startLine, endLine);
}

/**
 * Factory function to create a layout engine with default config
 */
export function createLayoutEngine(config?: Partial<LayoutConfig>): LayoutEngine {
  return new LayoutEngine(config);
}
