/**
 * Hook for managing code region selection for comments
 *
 * Handles multi-line and sub-line selection in the diff view.
 * Provides selection state and floating action button positioning.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CommentRegion, CommentSide } from '../types';
import { singleLineRegion, multiLineRegion, subLineRegion } from '../types';

export interface SelectionPosition {
  /** X position for floating button (relative to scroll container) */
  x: number;
  /** Y position for floating button (relative to scroll container) */
  y: number;
}

export interface RegionSelectionState {
  /** The selected region, or null if nothing selected */
  region: CommentRegion | null;
  /** Side of the selection (LEFT for old code, RIGHT for new code) */
  side: CommentSide | null;
  /** Position for the floating action button */
  buttonPosition: SelectionPosition | null;
  /** Whether the selection is active (mouse button held) */
  isSelecting: boolean;
  /** The selected text content */
  selectedText: string;
}

export interface UseRegionSelectionReturn extends RegionSelectionState {
  /** Start a selection at a line */
  startSelection: (lineIndex: number, side: CommentSide) => void;
  /** Update the selection end point during drag */
  updateSelection: (lineIndex: number, column?: number) => void;
  /** Complete the selection (mouse up) */
  completeSelection: (position: SelectionPosition) => void;
  /** Clear the current selection */
  clearSelection: () => void;
  /** Update selection from native text selection */
  updateFromNativeSelection: (
    selection: Selection,
    getLineIndex: (element: Element) => number | null,
    getSide: (element: Element) => CommentSide | null
  ) => void;
}

/**
 * Hook to manage region selection state
 */
export function useRegionSelection(): UseRegionSelectionReturn {
  const [region, setRegion] = useState<CommentRegion | null>(null);
  const [side, setSide] = useState<CommentSide | null>(null);
  const [buttonPosition, setButtonPosition] = useState<SelectionPosition | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  // Ref to track selection start
  const selectionStartRef = useRef<{
    lineIndex: number;
    column?: number;
    side: CommentSide;
  } | null>(null);

  const startSelection = useCallback((lineIndex: number, selectionSide: CommentSide) => {
    selectionStartRef.current = {
      lineIndex,
      side: selectionSide,
    };
    setIsSelecting(true);
    setSide(selectionSide);
    setRegion(singleLineRegion(lineIndex));
    setButtonPosition(null);
    setSelectedText('');
  }, []);

  const updateSelection = useCallback((lineIndex: number, column?: number) => {
    if (!selectionStartRef.current) return;

    const start = selectionStartRef.current;
    const startLine = Math.min(start.lineIndex, lineIndex);
    const endLine = Math.max(start.lineIndex, lineIndex);

    if (startLine === endLine) {
      // Single line - potentially with column selection
      if (column !== undefined && start.column !== undefined) {
        const startCol = Math.min(start.column, column);
        const endCol = Math.max(start.column, column);
        setRegion(subLineRegion(startLine, startCol, endCol));
      } else {
        setRegion(singleLineRegion(startLine));
      }
    } else {
      // Multi-line selection
      setRegion(multiLineRegion(startLine, endLine));
    }
  }, []);

  const completeSelection = useCallback((position: SelectionPosition) => {
    setIsSelecting(false);
    setButtonPosition(position);

    // Get selected text from native selection
    const selection = window.getSelection();
    if (selection) {
      setSelectedText(selection.toString());
    }
  }, []);

  const clearSelection = useCallback(() => {
    setRegion(null);
    setSide(null);
    setButtonPosition(null);
    setIsSelecting(false);
    setSelectedText('');
    selectionStartRef.current = null;
  }, []);

  const updateFromNativeSelection = useCallback((
    selection: Selection,
    getLineIndex: (element: Element) => number | null,
    getSide: (element: Element) => CommentSide | null
  ) => {
    if (selection.isCollapsed || !selection.anchorNode || !selection.focusNode) {
      clearSelection();
      return;
    }

    // Find the line elements containing the selection
    const anchorElement = selection.anchorNode.parentElement?.closest('[data-line-index]');
    const focusElement = selection.focusNode.parentElement?.closest('[data-line-index]');

    if (!anchorElement || !focusElement) {
      clearSelection();
      return;
    }

    const anchorLineIndex = getLineIndex(anchorElement);
    const focusLineIndex = getLineIndex(focusElement);
    const selectionSide = getSide(anchorElement);

    if (anchorLineIndex === null || focusLineIndex === null || !selectionSide) {
      clearSelection();
      return;
    }

    const startLine = Math.min(anchorLineIndex, focusLineIndex);
    const endLine = Math.max(anchorLineIndex, focusLineIndex);

    // Determine if it's a single line with column selection
    if (startLine === endLine) {
      // For simplicity, treat as full-line selection in the UI
      // Column-level can be extracted from anchorOffset/focusOffset if needed
      setRegion(singleLineRegion(startLine));
    } else {
      setRegion(multiLineRegion(startLine, endLine));
    }

    setSide(selectionSide);
    setSelectedText(selection.toString());

    // Calculate button position from the focus (end) of selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Get scroll container to calculate relative position
    const scrollContainer = focusElement.closest('.diff-content-area');
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      setButtonPosition({
        x: rect.right - containerRect.left + scrollContainer.scrollLeft,
        y: rect.bottom - containerRect.top + scrollContainer.scrollTop,
      });
    }
  }, [clearSelection]);

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;

      // Don't clear if clicking on the comment button or within comment UI
      if (
        target.closest('.region-comment-button') ||
        target.closest('.comment-thread') ||
        target.closest('.comment-editor')
      ) {
        return;
      }

      // Check if clicking within a code line
      if (target.closest('[data-line-index]')) {
        return;
      }

      // Clear selection when clicking elsewhere
      if (region && !isSelecting) {
        clearSelection();
      }
    };

    document.addEventListener('mousedown', handleClick, { capture: true });
    return () => document.removeEventListener('mousedown', handleClick, { capture: true });
  }, [region, isSelecting, clearSelection]);

  return {
    region,
    side,
    buttonPosition,
    isSelecting,
    selectedText,
    startSelection,
    updateSelection,
    completeSelection,
    clearSelection,
    updateFromNativeSelection,
  };
}
