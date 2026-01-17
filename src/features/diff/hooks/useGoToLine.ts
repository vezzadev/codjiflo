/**
 * Hook for Go to Line functionality
 *
 * Manages the go-to-line modal state and provides line number to row index
 * mapping for navigation in both inline and side-by-side diff views.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ParsedDiffLine, AlignedDiffLine, DiffViewMode } from '../types';

export interface UseGoToLineReturn {
  /** Whether the go-to-line modal is open */
  isOpen: boolean;
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /**
   * Find the row index for a given line number input.
   * Returns the row index or -1 if line not found.
   */
  findRowIndex: (
    input: string,
    diffLines: ParsedDiffLine[],
    alignedLines: AlignedDiffLine[],
    viewMode: DiffViewMode
  ) => number;
}

/**
 * Parse line input format: "lN" for left/old, "rN" or "N" for right/new
 */
export function parseLineInput(input: string): { lineNumber: number; side: 'left' | 'right' } | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // "lN" format - left/old side
  const leftMatch = /^l(\d+)$/.exec(trimmed);
  if (leftMatch?.[1]) {
    const num = parseInt(leftMatch[1], 10);
    if (num > 0) return { lineNumber: num, side: 'left' };
    return null;
  }

  // "rN" format - right/new side (explicit)
  const rightMatch = /^r(\d+)$/.exec(trimmed);
  if (rightMatch?.[1]) {
    const num = parseInt(rightMatch[1], 10);
    if (num > 0) return { lineNumber: num, side: 'right' };
    return null;
  }

  // "N" format - right/new side (default)
  const numMatch = /^(\d+)$/.exec(trimmed);
  if (numMatch?.[1]) {
    const num = parseInt(numMatch[1], 10);
    if (num > 0) return { lineNumber: num, side: 'right' };
    return null;
  }

  return null;
}

/**
 * Find row index for inline mode (diffLines array)
 */
function findRowIndexInline(
  diffLines: ParsedDiffLine[],
  lineNumber: number,
  side: 'left' | 'right'
): number {
  return diffLines.findIndex((line) =>
    side === 'left'
      ? line.oldLineNumber === lineNumber
      : line.newLineNumber === lineNumber
  );
}

/**
 * Find row index for side-by-side mode (alignedLines array)
 */
function findRowIndexSplit(
  alignedLines: AlignedDiffLine[],
  lineNumber: number,
  side: 'left' | 'right'
): number {
  return alignedLines.findIndex((line) =>
    side === 'left'
      ? line.left?.oldLineNumber === lineNumber
      : line.right?.newLineNumber === lineNumber
  );
}

/**
 * Hook to manage go-to-line modal state and navigation.
 *
 * Listens for Ctrl+G keyboard shortcut to open the modal.
 */
export function useGoToLine(): UseGoToLineReturn {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Global Ctrl+G listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if in input field
      const target = event.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+G (or Cmd+G on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const findRowIndex = useCallback(
    (
      input: string,
      diffLines: ParsedDiffLine[],
      alignedLines: AlignedDiffLine[],
      viewMode: DiffViewMode
    ): number => {
      const parsed = parseLineInput(input);
      if (!parsed) return -1;

      const { lineNumber, side } = parsed;

      if (viewMode === 'inline') {
        return findRowIndexInline(diffLines, lineNumber, side);
      } else {
        return findRowIndexSplit(alignedLines, lineNumber, side);
      }
    },
    []
  );

  return {
    isOpen,
    open,
    close,
    findRowIndex,
  };
}
