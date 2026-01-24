import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRegionSelection } from "./useRegionSelection";

describe("useRegionSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial state with null values", () => {
    const { result } = renderHook(() => useRegionSelection());

    expect(result.current.region).toBeNull();
    expect(result.current.side).toBeNull();
    expect(result.current.buttonPosition).toBeNull();
    expect(result.current.isSelecting).toBe(false);
    expect(result.current.selectedText).toBe("");
  });

  describe("startSelection", () => {
    it("sets region to single line", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      expect(result.current.region).toEqual({
        startLine: 5,
        endLine: 5,
      });
      expect(result.current.side).toBe("RIGHT");
      expect(result.current.isSelecting).toBe(true);
    });

    it("clears button position and selected text", () => {
      const { result } = renderHook(() => useRegionSelection());

      // First complete a selection
      act(() => {
        result.current.startSelection(5, "RIGHT");
        result.current.completeSelection({ x: 100, y: 200 });
      });

      // Now start a new selection
      act(() => {
        result.current.startSelection(10, "LEFT");
      });

      expect(result.current.buttonPosition).toBeNull();
      expect(result.current.selectedText).toBe("");
    });
  });

  describe("updateSelection", () => {
    it("expands selection to multiple lines", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      act(() => {
        result.current.updateSelection(10);
      });

      expect(result.current.region).toEqual({
        startLine: 5,
        endLine: 10,
      });
    });

    it("handles selection in reverse direction", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(10, "RIGHT");
      });

      act(() => {
        result.current.updateSelection(5);
      });

      expect(result.current.region).toEqual({
        startLine: 5,
        endLine: 10,
      });
    });

    it("keeps single line for same line index", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      act(() => {
        result.current.updateSelection(5);
      });

      expect(result.current.region).toEqual({
        startLine: 5,
        endLine: 5,
      });
    });

    it("does nothing if no selection started", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.updateSelection(10);
      });

      expect(result.current.region).toBeNull();
    });
  });

  describe("completeSelection", () => {
    it("sets button position and clears isSelecting", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      act(() => {
        result.current.completeSelection({ x: 100, y: 200 });
      });

      expect(result.current.buttonPosition).toEqual({ x: 100, y: 200 });
      expect(result.current.isSelecting).toBe(false);
    });

    it("captures selected text from window selection", () => {
      const mockSelection = {
        toString: () => "selected text content",
      };
      vi.spyOn(window, "getSelection").mockReturnValue(
        mockSelection as unknown as Selection
      );

      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      act(() => {
        result.current.completeSelection({ x: 100, y: 200 });
      });

      expect(result.current.selectedText).toBe("selected text content");
    });
  });

  describe("clearSelection", () => {
    it("resets all state to initial values", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
        result.current.updateSelection(10);
        result.current.completeSelection({ x: 100, y: 200 });
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.region).toBeNull();
      expect(result.current.side).toBeNull();
      expect(result.current.buttonPosition).toBeNull();
      expect(result.current.isSelecting).toBe(false);
      expect(result.current.selectedText).toBe("");
    });
  });

  describe("updateFromNativeSelection", () => {
    const mockGetLineIndex = (element: Element): number | null => {
      const index = element.getAttribute("data-line-index");
      return index ? parseInt(index, 10) : null;
    };

    const mockGetSide = (element: Element): "LEFT" | "RIGHT" | null => {
      const side = element.getAttribute("data-side");
      return side as "LEFT" | "RIGHT" | null;
    };

    it("clears selection when selection is collapsed", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      const mockSelection = {
        isCollapsed: true,
        anchorNode: null,
        focusNode: null,
      };

      act(() => {
        result.current.updateFromNativeSelection(
          mockSelection as unknown as Selection,
          mockGetLineIndex,
          mockGetSide
        );
      });

      expect(result.current.region).toBeNull();
    });

    it("clears selection when anchor node is null", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      const mockSelection = {
        isCollapsed: false,
        anchorNode: null,
        focusNode: document.createTextNode("text"),
      };

      act(() => {
        result.current.updateFromNativeSelection(
          mockSelection as unknown as Selection,
          mockGetLineIndex,
          mockGetSide
        );
      });

      expect(result.current.region).toBeNull();
    });

    it("clears selection when focus node is null", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      const mockSelection = {
        isCollapsed: false,
        anchorNode: document.createTextNode("text"),
        focusNode: null,
      };

      act(() => {
        result.current.updateFromNativeSelection(
          mockSelection as unknown as Selection,
          mockGetLineIndex,
          mockGetSide
        );
      });

      expect(result.current.region).toBeNull();
    });

    it("clears selection when no line element found", () => {
      const { result } = renderHook(() => useRegionSelection());

      const textNode = document.createTextNode("text");
      const span = document.createElement("span");
      span.appendChild(textNode);
      document.body.appendChild(span);

      const mockSelection = {
        isCollapsed: false,
        anchorNode: textNode,
        focusNode: textNode,
      };

      act(() => {
        result.current.updateFromNativeSelection(
          mockSelection as unknown as Selection,
          mockGetLineIndex,
          mockGetSide
        );
      });

      expect(result.current.region).toBeNull();

      document.body.removeChild(span);
    });

    it("sets single line region for same line selection", () => {
      const { result } = renderHook(() => useRegionSelection());

      // Create mock DOM structure
      const lineElement = document.createElement("div");
      lineElement.setAttribute("data-line-index", "5");
      lineElement.setAttribute("data-side", "RIGHT");
      document.body.appendChild(lineElement);

      const textNode = document.createTextNode("code");
      const innerSpan = document.createElement("span");
      innerSpan.appendChild(textNode);
      lineElement.appendChild(innerSpan);

      // Create a mock range with getBoundingClientRect
      const mockRange = {
        getBoundingClientRect: () => ({
          top: 100,
          left: 50,
          bottom: 120,
          right: 150,
          width: 100,
          height: 20,
        }),
      };

      const mockSelection = {
        isCollapsed: false,
        anchorNode: textNode,
        focusNode: textNode,
        toString: () => "code",
        getRangeAt: () => mockRange,
      };

      act(() => {
        result.current.updateFromNativeSelection(
          mockSelection as unknown as Selection,
          mockGetLineIndex,
          mockGetSide
        );
      });

      expect(result.current.region).toEqual({
        startLine: 5,
        endLine: 5,
      });
      expect(result.current.side).toBe("RIGHT");
      expect(result.current.selectedText).toBe("code");

      document.body.removeChild(lineElement);
    });

    it("sets multi-line region for cross-line selection", () => {
      const { result } = renderHook(() => useRegionSelection());

      // Create mock DOM structure for two lines
      const line1 = document.createElement("div");
      line1.setAttribute("data-line-index", "5");
      line1.setAttribute("data-side", "RIGHT");
      const text1 = document.createTextNode("line 1");
      const span1 = document.createElement("span");
      span1.appendChild(text1);
      line1.appendChild(span1);

      const line2 = document.createElement("div");
      line2.setAttribute("data-line-index", "8");
      line2.setAttribute("data-side", "RIGHT");
      const text2 = document.createTextNode("line 2");
      const span2 = document.createElement("span");
      span2.appendChild(text2);
      line2.appendChild(span2);

      document.body.appendChild(line1);
      document.body.appendChild(line2);

      // Create a mock range with getBoundingClientRect
      const mockRange = {
        getBoundingClientRect: () => ({
          top: 100,
          left: 50,
          bottom: 140,
          right: 150,
          width: 100,
          height: 40,
        }),
      };

      const mockSelection = {
        isCollapsed: false,
        anchorNode: text1,
        focusNode: text2,
        toString: () => "line 1\nline 2",
        getRangeAt: () => mockRange,
      };

      act(() => {
        result.current.updateFromNativeSelection(
          mockSelection as unknown as Selection,
          mockGetLineIndex,
          mockGetSide
        );
      });

      expect(result.current.region).toEqual({
        startLine: 5,
        endLine: 8,
      });

      document.body.removeChild(line1);
      document.body.removeChild(line2);
    });

    it("clears selection when line index cannot be determined", () => {
      const { result } = renderHook(() => useRegionSelection());

      const lineElement = document.createElement("div");
      lineElement.setAttribute("data-line-index", "invalid");
      lineElement.setAttribute("data-side", "RIGHT");
      document.body.appendChild(lineElement);

      const textNode = document.createTextNode("code");
      const innerSpan = document.createElement("span");
      innerSpan.appendChild(textNode);
      lineElement.appendChild(innerSpan);

      const mockSelection = {
        isCollapsed: false,
        anchorNode: textNode,
        focusNode: textNode,
        toString: () => "code",
      };

      const badGetLineIndex = (): number | null => null;

      act(() => {
        result.current.updateFromNativeSelection(
          mockSelection as unknown as Selection,
          badGetLineIndex,
          mockGetSide
        );
      });

      expect(result.current.region).toBeNull();

      document.body.removeChild(lineElement);
    });

    it("clears selection when side cannot be determined", () => {
      const { result } = renderHook(() => useRegionSelection());

      const lineElement = document.createElement("div");
      lineElement.setAttribute("data-line-index", "5");
      document.body.appendChild(lineElement);

      const textNode = document.createTextNode("code");
      const innerSpan = document.createElement("span");
      innerSpan.appendChild(textNode);
      lineElement.appendChild(innerSpan);

      const mockSelection = {
        isCollapsed: false,
        anchorNode: textNode,
        focusNode: textNode,
        toString: () => "code",
      };

      const badGetSide = (): "LEFT" | "RIGHT" | null => null;

      act(() => {
        result.current.updateFromNativeSelection(
          mockSelection as unknown as Selection,
          mockGetLineIndex,
          badGetSide
        );
      });

      expect(result.current.region).toBeNull();

      document.body.removeChild(lineElement);
    });
  });

  describe("click outside handler", () => {
    it("clears selection when clicking outside code lines", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
        result.current.completeSelection({ x: 100, y: 200 });
      });

      expect(result.current.region).not.toBeNull();

      // Simulate click outside
      const outsideElement = document.createElement("div");
      document.body.appendChild(outsideElement);

      act(() => {
        const event = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "target", { value: outsideElement });
        document.dispatchEvent(event);
      });

      expect(result.current.region).toBeNull();

      document.body.removeChild(outsideElement);
    });

    it("does not clear selection when clicking on comment button", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
        result.current.completeSelection({ x: 100, y: 200 });
      });

      const commentButton = document.createElement("button");
      commentButton.className = "region-comment-button";
      document.body.appendChild(commentButton);

      act(() => {
        const event = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "target", { value: commentButton });
        document.dispatchEvent(event);
      });

      expect(result.current.region).not.toBeNull();

      document.body.removeChild(commentButton);
    });

    it("does not clear selection when clicking on comment thread", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
        result.current.completeSelection({ x: 100, y: 200 });
      });

      const commentThread = document.createElement("div");
      commentThread.className = "comment-thread";
      document.body.appendChild(commentThread);

      act(() => {
        const event = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "target", { value: commentThread });
        document.dispatchEvent(event);
      });

      expect(result.current.region).not.toBeNull();

      document.body.removeChild(commentThread);
    });

    it("does not clear selection when clicking on code line", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
        result.current.completeSelection({ x: 100, y: 200 });
      });

      const codeLine = document.createElement("div");
      codeLine.setAttribute("data-line-index", "10");
      document.body.appendChild(codeLine);

      act(() => {
        const event = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "target", { value: codeLine });
        document.dispatchEvent(event);
      });

      expect(result.current.region).not.toBeNull();

      document.body.removeChild(codeLine);
    });

    it("does not clear selection while actively selecting", () => {
      const { result } = renderHook(() => useRegionSelection());

      act(() => {
        result.current.startSelection(5, "RIGHT");
      });

      // isSelecting is true, so clicking outside should not clear
      const outsideElement = document.createElement("div");
      document.body.appendChild(outsideElement);

      act(() => {
        const event = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "target", { value: outsideElement });
        document.dispatchEvent(event);
      });

      expect(result.current.region).not.toBeNull();

      document.body.removeChild(outsideElement);
    });
  });
});
