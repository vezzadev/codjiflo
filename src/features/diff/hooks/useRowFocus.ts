import { useCallback, useRef, useEffect } from 'react';
import { useDiffStore } from '../stores/useDiffStore';

/**
 * Hook for row-level focus and keyboard text selection in diff views.
 *
 * Enables:
 * - Click on a diff row to place focus and caret at click position
 * - Arrow Up/Down to move focus between rows
 * - Shift+Arrow to extend text selection (browser native)
 * - Escape to exit row focus mode
 *
 * @param totalRows Total number of rows in the diff
 * @returns Object with handlers and state for row focus management
 */
export function useRowFocus(totalRows: number) {
  const focusedRowIndex = useDiffStore((s) => s.focusedRowIndex);
  const setFocusedRow = useDiffStore((s) => s.setFocusedRow);
  const clearRowFocus = useDiffStore((s) => s.clearRowFocus);

  // Track refs to row elements for focus management
  const rowRefsMap = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // Clear stale row refs when totalRows changes (e.g., file switch)
  useEffect(() => {
    rowRefsMap.current.clear();
  }, [totalRows]);

  /**
   * Register a row element ref for focus management.
   * Call this in the row component with the tr element.
   */
  const registerRowRef = useCallback((index: number, element: HTMLTableRowElement | null) => {
    if (element) {
      rowRefsMap.current.set(index, element);
    } else {
      rowRefsMap.current.delete(index);
    }
  }, []);

  /**
   * Focus a specific row by index and optionally place caret at position.
   * Always updates focusedRowIndex even if row element isn't in DOM
   * (e.g., when row is virtualized and not yet rendered).
   */
  const focusRow = useCallback((index: number, caretX?: number) => {
    setFocusedRow(index);

    // Try to focus the actual row element if it's available
    const row = rowRefsMap.current.get(index);
    if (row) {
      row.focus();

      // If caretX is provided, try to place caret at that position
      if (caretX !== undefined) {
        placeCaretAtPosition(row, caretX);
      }
    }
  }, [setFocusedRow]);

  /**
   * Handle click on a diff row.
   * Sets focus to the row and places caret at click position.
   */
  const handleRowClick = useCallback((event: React.MouseEvent, rowIndex: number) => {
    // Don't handle if clicking on interactive elements
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('button') ||
      target.closest('a')
    ) {
      return;
    }

    setFocusedRow(rowIndex);

    // Place caret at click position using Selection API
    const row = rowRefsMap.current.get(rowIndex);
    if (row) {
      row.focus();
      placeCaretAtPosition(row, event.clientX, event.clientY);
    }
  }, [setFocusedRow]);

  /**
   * Handle keyboard navigation on a focused row.
   */
  const handleRowKeyDown = useCallback((event: React.KeyboardEvent, rowIndex: number) => {
    switch (event.key) {
      case 'ArrowUp':
        // Move focus to previous row
        if (rowIndex > 0) {
          event.preventDefault();
          focusRow(rowIndex - 1);
        }
        break;

      case 'ArrowDown':
        // Move focus to next row
        if (rowIndex < totalRows - 1) {
          event.preventDefault();
          focusRow(rowIndex + 1);
        }
        break;

      case 'Escape':
        // Exit row focus mode
        event.preventDefault();
        clearRowFocus();
        // Clear text selection when exiting focus mode
        window.getSelection()?.removeAllRanges();
        break;

      // Let Shift+Arrow keys pass through for native text selection
      // Let Arrow Left/Right pass through for cursor movement
    }
  }, [totalRows, focusRow, clearRowFocus]);

  /**
   * Effect to focus the row element when focusedRowIndex changes.
   */
  useEffect(() => {
    if (focusedRowIndex !== null) {
      const row = rowRefsMap.current.get(focusedRowIndex);
      if (row && document.activeElement !== row) {
        row.focus();
      }
    }
  }, [focusedRowIndex]);

  return {
    focusedRowIndex,
    setFocusedRow,
    clearRowFocus,
    handleRowClick,
    handleRowKeyDown,
    registerRowRef,
    focusRow,
  };
}

/**
 * Place the caret at a specific position within a row element.
 * Uses caretRangeFromPoint for precise positioning.
 */
function placeCaretAtPosition(element: HTMLElement, x: number, y?: number) {
  // If y is not provided, use the middle of the element
  const rect = element.getBoundingClientRect();
  const effectiveY = y ?? rect.top + rect.height / 2;

  // Try to get the caret position at the click point
  // caretRangeFromPoint is deprecated but widely supported (caretPositionFromPoint is the
  // standard but less supported). Access via index to avoid TypeScript deprecation warning.
  // eslint-disable-next-line @typescript-eslint/no-deprecated, @typescript-eslint/unbound-method
  const caretFn = (document as unknown as Record<string, unknown>).caretRangeFromPoint as
    | ((x: number, y: number) => Range | null)
    | undefined;

  if (!caretFn) return;

  const range = caretFn(x, effectiveY);
  if (!range) return;

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/**
 * Returns true if row focus mode is active (a row is focused).
 * Use this to conditionally disable other keyboard shortcuts.
 */
export function useIsRowFocusActive(): boolean {
  return useDiffStore((s) => s.focusedRowIndex !== null);
}
