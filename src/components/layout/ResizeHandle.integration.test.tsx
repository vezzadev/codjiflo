import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { render } from '@/tests/helpers';
import { ResizeHandle } from './ResizeHandle';
import { useLayoutStore } from '@/stores/useLayoutStore';

function getHandle(selector: string): HTMLElement {
  const handle = document.querySelector(selector);
  if (!handle) throw new Error(`Handle not found: ${selector}`);
  return handle as HTMLElement;
}

describe('ResizeHandle integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Reset layout store to defaults
    act(() => {
      useLayoutStore.setState({
        leftPaneWidth: 330,
        bottomPaneHeight: 200,
      });
    });
  });

  describe('horizontal resize (sidebar)', () => {
    it('calls onResize with delta when dragging horizontally', () => {
      const onResize = vi.fn();
      render(<ResizeHandle direction="horizontal" onResize={onResize} />);

      const handle = getHandle('.resize-handle-v');

      // Start drag at x=100
      fireEvent.mouseDown(handle, { clientX: 100, clientY: 50 });

      // Move to x=150 (delta = 50)
      fireEvent.mouseMove(document, { clientX: 150, clientY: 50 });
      expect(onResize).toHaveBeenCalledWith(50);

      // Move back to x=130 (delta = -20)
      fireEvent.mouseMove(document, { clientX: 130, clientY: 50 });
      expect(onResize).toHaveBeenCalledWith(-20);

      fireEvent.mouseUp(document);
    });

    it('calls onResizeEnd when drag finishes', () => {
      const onResizeEnd = vi.fn();
      render(<ResizeHandle direction="horizontal" onResizeEnd={onResizeEnd} />);

      const handle = getHandle('.resize-handle-v');
      fireEvent.mouseDown(handle, { clientX: 100 });
      fireEvent.mouseUp(document);

      expect(onResizeEnd).toHaveBeenCalledTimes(1);
    });

    it('sets cursor to ew-resize during drag', () => {
      render(<ResizeHandle direction="horizontal" />);

      const handle = getHandle('.resize-handle-v');
      fireEvent.mouseDown(handle, { clientX: 100 });

      expect(document.body.style.cursor).toBe('ew-resize');

      fireEvent.mouseUp(document);
      expect(document.body.style.cursor).toBe('');
    });

    it('integrates with useLayoutStore.resizeLeftPane', () => {
      const { resizeLeftPane } = useLayoutStore.getState();

      render(<ResizeHandle direction="horizontal" onResize={resizeLeftPane} />);

      const initialWidth = useLayoutStore.getState().leftPaneWidth;
      expect(initialWidth).toBe(330);

      const handle = getHandle('.resize-handle-v');
      fireEvent.mouseDown(handle, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 150 });
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().leftPaneWidth).toBe(380);
    });

    it('respects min/max width constraints from store', () => {
      const { resizeLeftPane } = useLayoutStore.getState();

      render(<ResizeHandle direction="horizontal" onResize={resizeLeftPane} />);

      const handle = getHandle('.resize-handle-v');

      // Try to resize beyond max (600px)
      fireEvent.mouseDown(handle, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 500 }); // +400 would be 730px
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().leftPaneWidth).toBe(600); // Clamped to max

      // Try to resize below min (200px)
      fireEvent.mouseDown(handle, { clientX: 500 });
      fireEvent.mouseMove(document, { clientX: 0 }); // -500 would be 100px
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().leftPaneWidth).toBe(200); // Clamped to min
    });
  });

  describe('vertical resize (bottom pane)', () => {
    it('calls onResize with delta when dragging vertically', () => {
      const onResize = vi.fn();
      render(<ResizeHandle direction="vertical" onResize={onResize} />);

      const handle = getHandle('.resize-handle-h');
      expect(handle).toBeInTheDocument();

      // Start drag at y=300
      fireEvent.mouseDown(handle, { clientX: 100, clientY: 300 });

      // Move up to y=250 (delta = -50)
      fireEvent.mouseMove(document, { clientX: 100, clientY: 250 });
      expect(onResize).toHaveBeenCalledWith(-50);

      fireEvent.mouseUp(document);
    });

    it('sets cursor to ns-resize during drag', () => {
      render(<ResizeHandle direction="vertical" />);

      const handle = getHandle('.resize-handle-h');
      fireEvent.mouseDown(handle, { clientY: 300 });

      expect(document.body.style.cursor).toBe('ns-resize');

      fireEvent.mouseUp(document);
      expect(document.body.style.cursor).toBe('');
    });

    it('integrates with useLayoutStore.resizeBottomPane', () => {
      const { resizeBottomPane } = useLayoutStore.getState();

      render(<ResizeHandle direction="vertical" onResize={resizeBottomPane} />);

      const initialHeight = useLayoutStore.getState().bottomPaneHeight;
      expect(initialHeight).toBe(200);

      const handle = getHandle('.resize-handle-h');
      // Dragging up (negative delta) should increase height
      fireEvent.mouseDown(handle, { clientY: 300 });
      fireEvent.mouseMove(document, { clientY: 250 }); // delta = -50
      fireEvent.mouseUp(document);

      // resizeBottomPane inverts delta: newHeight = height - delta = 200 - (-50) = 250
      expect(useLayoutStore.getState().bottomPaneHeight).toBe(250);
    });

    it('respects min/max height constraints from store', () => {
      const { resizeBottomPane } = useLayoutStore.getState();

      render(<ResizeHandle direction="vertical" onResize={resizeBottomPane} />);

      const handle = getHandle('.resize-handle-h');

      // Try to resize beyond max (500px) - drag up by 400
      fireEvent.mouseDown(handle, { clientY: 300 });
      fireEvent.mouseMove(document, { clientY: -100 }); // delta = -400, would be 600px
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().bottomPaneHeight).toBe(500); // Clamped to max

      // Try to resize below min (100px) - drag down by 500
      fireEvent.mouseDown(handle, { clientY: 0 });
      fireEvent.mouseMove(document, { clientY: 500 }); // delta = 500, would be 0px
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().bottomPaneHeight).toBe(100); // Clamped to min
    });
  });

  describe('interaction behavior', () => {
    it('does not call onResize when not dragging', () => {
      const onResize = vi.fn();
      render(<ResizeHandle direction="horizontal" onResize={onResize} />);

      // Mouse move without mousedown should not trigger resize
      fireEvent.mouseMove(document, { clientX: 150 });

      expect(onResize).not.toHaveBeenCalled();
    });

    it('disables text selection during drag', () => {
      render(<ResizeHandle direction="horizontal" />);

      const handle = getHandle('.resize-handle-v');
      fireEvent.mouseDown(handle, { clientX: 100 });

      expect(document.body.style.userSelect).toBe('none');

      fireEvent.mouseUp(document);
      expect(document.body.style.userSelect).toBe('');
    });
  });
});
