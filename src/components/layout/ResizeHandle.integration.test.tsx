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

      // Try to resize beyond max (2000px)
      fireEvent.mouseDown(handle, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 2100 }); // +2000 would be 2330px
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().leftPaneWidth).toBe(2000); // Clamped to max

      // Reset to default
      useLayoutStore.getState().setLeftPaneWidth(300);

      // Resize down below minimum triggers collapse
      fireEvent.mouseDown(handle, { clientX: 300 });
      fireEvent.mouseMove(document, { clientX: 150 }); // -150 would be 150px < 200 min
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().leftPaneWidth).toBe(0); // Collapsed
      expect(useLayoutStore.getState().isLeftPaneCollapsed).toBe(true);
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

      // Try to resize beyond max (2000px) - drag up by 1900
      fireEvent.mouseDown(handle, { clientY: 2000 });
      fireEvent.mouseMove(document, { clientY: 100 }); // delta = -1900, would be 2100px
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().bottomPaneHeight).toBe(2000); // Clamped to max

      // Reset to default
      useLayoutStore.getState().setBottomPaneHeight(200);

      // Resize down below minimum triggers collapse
      fireEvent.mouseDown(handle, { clientY: 0 });
      fireEvent.mouseMove(document, { clientY: 120 }); // delta = 120, would be 80px < 100 min
      fireEvent.mouseUp(document);

      expect(useLayoutStore.getState().bottomPaneHeight).toBe(0); // Collapsed
      expect(useLayoutStore.getState().isBottomPaneCollapsed).toBe(true);
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
