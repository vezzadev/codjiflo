'use client';

import { useCallback, useEffect, useRef, MouseEvent } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize?: (delta: number) => void;
  onResizeEnd?: () => void;
}

/**
 * Draggable resize handle for resizing panes
 */
export function ResizeHandle({ direction, onResize, onResizeEnd }: ResizeHandleProps) {
  const isDragging = useRef(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
      document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [direction]
  );

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging.current) return;

      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      startPos.current = currentPos;

      onResize?.(delta);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onResizeEnd?.();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, onResize, onResizeEnd]);

  const className =
    direction === 'horizontal' ? 'resize-handle-v' : 'resize-handle-h';
  const gripClassName =
    direction === 'horizontal' ? 'grip-line-v' : 'grip-line';

  return (
    <div className={className} onMouseDown={handleMouseDown}>
      <div className={gripClassName}></div>
    </div>
  );
}
