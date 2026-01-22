/**
 * Search Keyboard Shortcuts Hook
 *
 * Handles Ctrl+F, Ctrl+Shift+F, F3, and Shift+F3 shortcuts.
 */

import { useEffect, useCallback } from 'react';
import { useSearchStore } from '../stores';

/**
 * Hook that registers global keyboard shortcuts for search functionality.
 * - Ctrl+F: Open find in current file
 * - Ctrl+Shift+F: Open find in all files
 * - F3: Navigate to next match
 * - Shift+F3: Navigate to previous match
 */
export function useSearchKeyboardShortcuts() {
  const openFindInFile = useSearchStore((s) => s.openFindInFile);
  const openFindInAllFiles = useSearchStore((s) => s.openFindInAllFiles);
  const nextMatch = useSearchStore((s) => s.nextMatch);
  const previousMatch = useSearchStore((s) => s.previousMatch);
  const mode = useSearchStore((s) => s.mode);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if user is in an input field (except our search input)
      const target = e.target as HTMLElement | null;
      const isInSearchInput = target?.hasAttribute?.('data-search-input') ?? false;

      const isInInput =
        target !== null &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable) &&
        !isInSearchInput;

      // Ctrl+F: Open find in current file
      if (e.key === 'f' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        openFindInFile();
        return;
      }

      // Ctrl+Shift+F: Open find in all files
      if ((e.key === 'f' || e.key === 'F') && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        openFindInAllFiles();
        return;
      }

      // Don't handle F3 navigation if in any input field (search input handles F3 locally)
      if (isInInput || isInSearchInput) return;

      // F3 / Shift+F3: Navigate matches (only when search is active)
      if (e.key === 'F3') {
        e.preventDefault();
        if (mode === 'current-file') {
          if (e.shiftKey) {
            previousMatch();
          } else {
            nextMatch();
          }
        }
        return;
      }
    },
    [mode, openFindInFile, openFindInAllFiles, nextMatch, previousMatch]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
