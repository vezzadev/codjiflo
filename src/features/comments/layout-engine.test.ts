/**
 * Layout Engine Unit Tests
 *
 * Tests for the canvas layout engine that positions floating comment bubbles.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  LayoutEngine,
  calculateIdealPosition,
  createLayoutEngine,
  createSingleLineAnchor,
  createMultiLineAnchor,
  type CodeLinePosition,
  type CommentBubbleInput,
  type LayoutConfig,
} from "./layout-engine";

describe("LayoutEngine", () => {
  // Helper to create line position map
  function createLinePositions(
    lines: { index: number; top: number; height: number }[]
  ): Map<number, CodeLinePosition> {
    const map = new Map<number, CodeLinePosition>();
    for (const line of lines) {
      map.set(line.index, {
        lineIndex: line.index,
        top: line.top,
        bottom: line.top + line.height,
      });
    }
    return map;
  }

  describe("calculateIdealPosition", () => {
    it("returns null when anchor line is not in the map", () => {
      const positions = createLinePositions([]);
      const anchor = createSingleLineAnchor(5);

      const result = calculateIdealPosition(anchor, positions);

      expect(result).toBeNull();
    });

    it("centers on a single line", () => {
      const positions = createLinePositions([
        { index: 5, top: 100, height: 20 },
      ]);
      const anchor = createSingleLineAnchor(5);

      const result = calculateIdealPosition(anchor, positions);

      expect(result).toBe(110); // 100 + 20/2
    });

    it("centers on multi-line span", () => {
      const positions = createLinePositions([
        { index: 5, top: 100, height: 20 },
        { index: 6, top: 120, height: 20 },
        { index: 7, top: 140, height: 20 },
      ]);
      const anchor = createMultiLineAnchor(5, 7);

      const result = calculateIdealPosition(anchor, positions);

      // Span: top=100, bottom=160, center=130
      expect(result).toBe(130);
    });

    it("falls back to start line when end line is missing", () => {
      const positions = createLinePositions([
        { index: 5, top: 100, height: 20 },
      ]);
      const anchor = createMultiLineAnchor(5, 7);

      const result = calculateIdealPosition(anchor, positions);

      // Only start line available, center on it
      expect(result).toBe(110);
    });
  });

  describe("calculatePositions", () => {
    let engine: LayoutEngine;
    let defaultConfig: Partial<LayoutConfig>;

    beforeEach(() => {
      defaultConfig = {
        bubbleWidth: 300,
        minVerticalGap: 8,
        horizontalOffset: 16,
        viewportHeight: 800,
        scrollTop: 0,
        renderBuffer: 200,
      };
      engine = createLayoutEngine(defaultConfig);
    });

    it("positions a single bubble at its ideal location", () => {
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
        { index: 2, top: 20, height: 20 },
        { index: 3, top: 40, height: 20 },
      ]);

      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(2), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      expect(layouts).toHaveLength(1);
      const layout = layouts[0];
      if (!layout) throw new Error("Expected layout to be defined");
      expect(layout.threadId).toBe("t1");
      expect(layout.y).toBe(30); // Center of line 2 (20 + 20/2)
      expect(layout.isDisplaced).toBe(false);
    });

    it("avoids collision by pushing bubbles down", () => {
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
        { index: 2, top: 20, height: 20 },
        { index: 3, top: 40, height: 20 },
      ]);

      // Two comments on adjacent lines with tall bubbles
      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
        { threadId: "t2", anchorSpan: createSingleLineAnchor(2), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      expect(layouts).toHaveLength(2);

      // First bubble at ideal position
      const first = layouts.find((l) => l.threadId === "t1");
      expect(first).toBeDefined();
      expect(first?.y).toBe(10); // Center of line 1
      expect(first?.isDisplaced).toBe(false);

      // Second bubble pushed down to avoid collision
      const second = layouts.find((l) => l.threadId === "t2");
      expect(second).toBeDefined();
      expect(second?.y).toBe(10 + 60 + 8); // First.y + height + gap
      expect(second?.isDisplaced).toBe(true);
    });

    it("handles multiple collisions with cascade effect", () => {
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
        { index: 2, top: 20, height: 20 },
        { index: 3, top: 40, height: 20 },
      ]);

      // Three overlapping comments
      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 50 },
        { threadId: "t2", anchorSpan: createSingleLineAnchor(1), height: 50 },
        { threadId: "t3", anchorSpan: createSingleLineAnchor(2), height: 50 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      expect(layouts).toHaveLength(3);

      // All should be non-overlapping
      const sorted = layouts.sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (!prev || !curr) throw new Error("Expected prev and curr to be defined");
        expect(curr.y).toBeGreaterThanOrEqual(prev.y + prev.height + 8);
      }
    });

    it("filters bubbles outside viewport with buffer", () => {
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
        { index: 2, top: 1500, height: 20 }, // Far below viewport
      ]);

      engine.updateConfig({ viewportHeight: 800, scrollTop: 0, renderBuffer: 200 });

      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
        { threadId: "t2", anchorSpan: createSingleLineAnchor(2), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      // Only the first bubble should be visible (within viewport + buffer)
      expect(layouts).toHaveLength(1);
      const layout = layouts[0];
      if (!layout) throw new Error("Expected layout to be defined");
      expect(layout.threadId).toBe("t1");
    });

    it("includes bubbles within render buffer", () => {
      const positions = createLinePositions([
        { index: 1, top: 900, height: 20 }, // Just outside viewport but within buffer
      ]);

      engine.updateConfig({ viewportHeight: 800, scrollTop: 0, renderBuffer: 200 });

      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      // Should be included (900 < 800 + 200 = 1000)
      expect(layouts).toHaveLength(1);
    });

    it("assigns higher z-index to focused bubbles", () => {
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
        { index: 2, top: 100, height: 20 },
      ]);

      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
        { threadId: "t2", anchorSpan: createSingleLineAnchor(2), height: 60, isFocused: true },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      const t1 = layouts.find((l) => l.threadId === "t1");
      const t2 = layouts.find((l) => l.threadId === "t2");

      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
      expect(t2?.zIndex).toBeGreaterThan(t1?.zIndex ?? 0);
      expect(t2?.zIndex).toBe(1000);
    });

    it("applies configured bubble width", () => {
      engine.updateConfig({ bubbleWidth: 400 });

      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
      ]);

      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      const layout = layouts[0];
      if (!layout) throw new Error("Expected layout to be defined");
      expect(layout.width).toBe(400);
    });

    it("preserves anchor span information in output", () => {
      const positions = createLinePositions([
        { index: 5, top: 100, height: 20 },
        { index: 6, top: 120, height: 20 },
        { index: 7, top: 140, height: 20 },
      ]);

      const anchor = createMultiLineAnchor(5, 7);
      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: anchor, height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      const layout = layouts[0];
      if (!layout) throw new Error("Expected layout to be defined");
      expect(layout.anchorSpan).toEqual(anchor);
    });
  });

  describe("calculateConnectors", () => {
    let engine: LayoutEngine;

    beforeEach(() => {
      engine = createLayoutEngine({
        bubbleWidth: 300,
        horizontalOffset: 16,
        viewportHeight: 800,
        scrollTop: 0,
        renderBuffer: 200,
      });
    });

    it("calculates connector from code center to bubble center", () => {
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
      ]);

      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);
      const connectors = engine.calculateConnectors(layouts, positions);

      expect(connectors).toHaveLength(1);
      const connector = connectors[0];
      if (!connector) throw new Error("Expected connector to be defined");
      expect(connector.threadId).toBe("t1");
      expect(connector.startY).toBe(10); // Center of line (0 + 20/2)
      expect(connector.endY).toBe(10 + 30); // Layout y + height/2
      expect(connector.endX).toBe(16); // horizontal offset
    });

    it("marks displaced connectors", () => {
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
        { index: 2, top: 20, height: 20 },
      ]);

      // Two comments that will collide
      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 80 },
        { threadId: "t2", anchorSpan: createSingleLineAnchor(2), height: 80 },
      ];

      const layouts = engine.calculatePositions(positions, comments);
      const connectors = engine.calculateConnectors(layouts, positions);

      const c2 = connectors.find((c) => c.threadId === "t2");
      expect(c2).toBeDefined();
      expect(c2?.isDisplaced).toBe(true);
      expect(c2?.displacement).toBeGreaterThan(0);
    });

    it("returns empty array for bubbles with missing anchor lines", () => {
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
      ]);

      // Create layout for line 1, then clear positions
      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      // Now calculate connectors with empty positions
      const emptyPositions = new Map<number, CodeLinePosition>();
      const connectors = engine.calculateConnectors(layouts, emptyPositions);

      expect(connectors).toHaveLength(0);
    });
  });

  describe("updateConfig", () => {
    it("merges configuration updates", () => {
      const engine = createLayoutEngine({ bubbleWidth: 300 });

      engine.updateConfig({ bubbleWidth: 400, minVerticalGap: 12 });

      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
      ]);
      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      const layout = layouts[0];
      if (!layout) throw new Error("Expected layout to be defined");
      expect(layout.width).toBe(400);
    });
  });

  describe("edge cases", () => {
    it("handles empty comments array", () => {
      const engine = createLayoutEngine();
      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
      ]);

      const layouts = engine.calculatePositions(positions, []);

      expect(layouts).toEqual([]);
    });

    it("handles empty line positions", () => {
      const engine = createLayoutEngine();
      const positions = new Map<number, CodeLinePosition>();
      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 60 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      expect(layouts).toEqual([]);
    });

    it("handles very large bubble heights", () => {
      const engine = createLayoutEngine({
        viewportHeight: 800,
        scrollTop: 0,
        renderBuffer: 200,
      });

      const positions = createLinePositions([
        { index: 1, top: 0, height: 20 },
        { index: 2, top: 20, height: 20 },
      ]);

      const comments: CommentBubbleInput[] = [
        { threadId: "t1", anchorSpan: createSingleLineAnchor(1), height: 500 },
        { threadId: "t2", anchorSpan: createSingleLineAnchor(2), height: 500 },
      ];

      const layouts = engine.calculatePositions(positions, comments);

      // Both should be positioned without overlap
      expect(layouts).toHaveLength(2);
      const sorted = layouts.sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const second = sorted[1];
      if (!first || !second) throw new Error("Expected first and second to be defined");
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    });
  });
});
